import { ApiResponse } from "../types/api";
import {
  ProcessedDriverDiscData,
  DriverDiscEntry,
  BilingualApiData,
  SetEffectInfo,
  BasicDriverDiscInfo,
} from "../types/processing";
import { Specialty } from "../types/index";
import { logger, LogMessages } from "./Logger";

/**
 * ドライバーディスク処理のグレースフル劣化機能
 * 部分的失敗でも処理を継続し、可能な限りデータを回復する
 * 要件: 4.1, 4.2, 4.3
 */
export class DriverDiscGracefulDegradation {
  /**
   * 部分的なAPIデータからドライバーディスク情報を抽出
   * 要件: 4.1, 4.2, 4.3
   */
  async processPartialDriverDiscData(
    apiData: BilingualApiData,
    discEntry: DriverDiscEntry,
    originalError: Error
  ): Promise<ProcessedDriverDiscData | null> {
    logger.info(LogMessages.DRIVER_DISC_GRACEFUL_DEGRADATION, {
      discId: discEntry.id,
      discName: discEntry.name,
      originalError: originalError.message,
      degradationMethod: "partial_data_extraction",
      timestamp: new Date().toISOString(),
    });

    try {
      // データソースの優先順位を決定
      const { primaryData, secondaryData, dataSource } =
        this.selectBestDataSource(apiData);

      // 基本情報の抽出
      const basicInfo = await this.extractBasicInfoWithFallback(
        primaryData,
        secondaryData,
        discEntry
      );

      if (!basicInfo) {
        logger.warn("ドライバーディスク基本情報の抽出に失敗", {
          discId: discEntry.id,
          dataSource,
        });
        return null;
      }

      // セット効果情報の抽出
      const setEffectInfo = await this.extractSetEffectInfoWithFallback(
        primaryData,
        secondaryData,
        discEntry
      );

      // 特性の推定
      const specialty = await this.estimateSpecialtyWithFallback(
        setEffectInfo,
        discEntry
      );

      const processedData: ProcessedDriverDiscData = {
        basicInfo,
        setEffectInfo,
        specialty,
      };

      // 部分データの妥当性を検証
      const validationResult = this.validatePartialData(
        processedData,
        discEntry.id
      );

      if (!validationResult.isValid) {
        logger.warn("ドライバーディスク部分データ検証に失敗", {
          discId: discEntry.id,
          validationErrors: validationResult.errors,
          degradationResult: "validation_failed",
        });
        return null;
      }

      logger.info(LogMessages.DRIVER_DISC_ERROR_RECOVERY_SUCCESS, {
        discId: discEntry.id,
        originalError: originalError.message,
        recoveryMethod: "graceful_degradation",
        dataSource,
        recoveredFields: this.getRecoveredFields(processedData),
        degradationResult: "success",
      });

      return processedData;
    } catch (degradationError) {
      const errorMessage =
        degradationError instanceof Error
          ? degradationError.message
          : String(degradationError);

      logger.error("ドライバーディスクグレースフル劣化処理中にエラーが発生", {
        discId: discEntry.id,
        originalError: originalError.message,
        degradationError: errorMessage,
        degradationResult: "error",
      });

      return null;
    }
  }

  /**
   * 欠損データに対するフォールバック値の提供
   * 要件: 4.1, 4.2
   */
  provideFallbackData(
    discEntry: DriverDiscEntry,
    missingFields: string[]
  ): Partial<ProcessedDriverDiscData> {
    logger.info(LogMessages.DRIVER_DISC_PARTIAL_DATA_PROCESSING, {
      discId: discEntry.id,
      missingFields,
      fallbackMethod: "default_values",
    });

    const fallbackData: Partial<ProcessedDriverDiscData> = {};

    // 基本情報のフォールバック
    if (
      missingFields.includes("basicInfo") ||
      missingFields.includes("page.id")
    ) {
      fallbackData.basicInfo = {
        id: parseInt(discEntry.id) || 0,
        name: discEntry.name || `Unknown Disc ${discEntry.id}`,
        releaseVersion: undefined,
      };
    }

    // セット効果情報のフォールバック
    if (
      missingFields.includes("setEffectInfo") ||
      missingFields.includes("page.modules")
    ) {
      fallbackData.setEffectInfo = {
        fourSetEffect: "セット効果情報が取得できませんでした",
        twoSetEffect: "セット効果情報が取得できませんでした",
      };
    }

    // 特性のフォールバック（名前から推測）
    if (missingFields.includes("specialty")) {
      fallbackData.specialty = this.guessSpecialtyFromName(discEntry.name);
    }

    return fallbackData;
  }

  /**
   * データの完全性を評価し、処理可能性を判定
   * 要件: 4.1, 4.3
   */
  assessDataCompleteness(
    apiData: BilingualApiData,
    discEntry: DriverDiscEntry
  ): {
    completeness: number;
    processingViability: "full" | "partial" | "minimal" | "impossible";
    availableFields: string[];
    missingFields: string[];
    recommendations: string[];
  } {
    const availableFields: string[] = [];
    const missingFields: string[] = [];

    // 日本語データの評価
    const jaData = apiData.ja;
    if (jaData?.data?.page?.id) availableFields.push("ja.page.id");
    else missingFields.push("ja.page.id");

    if (jaData?.data?.page?.name) availableFields.push("ja.page.name");
    else missingFields.push("ja.page.name");

    if (jaData?.data?.page?.modules) availableFields.push("ja.page.modules");
    else missingFields.push("ja.page.modules");

    // 英語データの評価
    const enData = apiData.en;
    if (enData?.data?.page?.id) availableFields.push("en.page.id");
    else missingFields.push("en.page.id");

    if (enData?.data?.page?.name) availableFields.push("en.page.name");
    else missingFields.push("en.page.name");

    if (enData?.data?.page?.modules) availableFields.push("en.page.modules");
    else missingFields.push("en.page.modules");

    // 完全性の計算
    const totalPossibleFields = 6; // ja/en × (id, name, modules)
    const completeness = Math.round(
      (availableFields.length / totalPossibleFields) * 100
    );

    // 処理可能性の判定
    let processingViability: "full" | "partial" | "minimal" | "impossible";
    const hasBasicId = availableFields.some((field) =>
      field.includes("page.id")
    );
    const hasBasicName = availableFields.some((field) =>
      field.includes("page.name")
    );

    if (!hasBasicId) {
      processingViability = "impossible";
    } else if (completeness >= 80) {
      processingViability = "full";
    } else if (completeness >= 50 && hasBasicName) {
      processingViability = "partial";
    } else if (hasBasicId) {
      processingViability = "minimal";
    } else {
      processingViability = "impossible";
    }

    // 推奨事項の生成
    const recommendations = this.generateDataRecoveryRecommendations(
      availableFields,
      missingFields,
      processingViability
    );

    logger.debug("ドライバーディスクデータ完全性評価完了", {
      discId: discEntry.id,
      completeness,
      processingViability,
      availableFieldsCount: availableFields.length,
      missingFieldsCount: missingFields.length,
    });

    return {
      completeness,
      processingViability,
      availableFields,
      missingFields,
      recommendations,
    };
  }

  // プライベートヘルパーメソッド

  private selectBestDataSource(apiData: BilingualApiData): {
    primaryData: ApiResponse;
    secondaryData: ApiResponse | null;
    dataSource: string;
  } {
    // 日本語データを優先、英語データをフォールバックとして使用
    const jaComplete = this.isDataComplete(apiData.ja);
    const enComplete = apiData.en ? this.isDataComplete(apiData.en) : false;

    if (jaComplete) {
      return {
        primaryData: apiData.ja,
        secondaryData: apiData.en,
        dataSource: "ja_primary_en_secondary",
      };
    } else if (enComplete) {
      return {
        primaryData: apiData.en!,
        secondaryData: apiData.ja,
        dataSource: "en_primary_ja_secondary",
      };
    } else {
      // どちらも不完全な場合は日本語を優先
      return {
        primaryData: apiData.ja,
        secondaryData: apiData.en,
        dataSource: "ja_primary_incomplete",
      };
    }
  }

  private isDataComplete(apiData: ApiResponse): boolean {
    return !!(
      apiData?.data?.page?.id &&
      apiData?.data?.page?.name &&
      apiData?.data?.page?.modules
    );
  }

  private async extractBasicInfoWithFallback(
    primaryData: ApiResponse,
    secondaryData: ApiResponse | null,
    discEntry: DriverDiscEntry
  ): Promise<BasicDriverDiscInfo | null> {
    try {
      // プライマリデータから抽出を試行
      let id = primaryData?.data?.page?.id;
      let name = primaryData?.data?.page?.name;

      // フォールバックデータから補完
      if (!id && secondaryData?.data?.page?.id) {
        id = secondaryData.data.page.id;
      }

      if (!name && secondaryData?.data?.page?.name) {
        name = secondaryData.data.page.name;
      }

      // 最終フォールバック
      if (!id) {
        id = discEntry.id;
      }

      if (!name) {
        name = discEntry.name;
      }

      return {
        id: parseInt(id) || 0,
        name: name || `Unknown Disc ${discEntry.id}`,
        releaseVersion: undefined,
      };
    } catch (error) {
      logger.error("ドライバーディスク基本情報抽出エラー", {
        discId: discEntry.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async extractSetEffectInfoWithFallback(
    primaryData: ApiResponse,
    secondaryData: ApiResponse | null,
    discEntry: DriverDiscEntry
  ): Promise<SetEffectInfo> {
    try {
      let fourSetEffect = "";
      let twoSetEffect = "";

      // プライマリデータから抽出を試行
      const primaryModules = primaryData?.data?.page?.modules;
      if (primaryModules && Array.isArray(primaryModules)) {
        const setEffectModule = primaryModules.find(
          (module: any) => module.components && Array.isArray(module.components)
        );

        if (setEffectModule) {
          const components = setEffectModule.components;
          for (const component of components) {
            if (component.data && typeof component.data === "string") {
              try {
                const componentData = JSON.parse(component.data);
                if (componentData.four_set_effect) {
                  fourSetEffect = this.cleanHtmlTags(
                    componentData.four_set_effect
                  );
                }
                if (componentData.two_set_effect) {
                  twoSetEffect = this.cleanHtmlTags(
                    componentData.two_set_effect
                  );
                }
              } catch (parseError) {
                // JSON解析エラーは無視して続行
              }
            }
          }
        }
      }

      // セカンダリデータから補完
      if ((!fourSetEffect || !twoSetEffect) && secondaryData) {
        const secondaryModules = secondaryData?.data?.page?.modules;
        if (secondaryModules && Array.isArray(secondaryModules)) {
          const setEffectModule = secondaryModules.find(
            (module: any) =>
              module.components && Array.isArray(module.components)
          );

          if (setEffectModule) {
            const components = setEffectModule.components;
            for (const component of components) {
              if (component.data && typeof component.data === "string") {
                try {
                  const componentData = JSON.parse(component.data);
                  if (!fourSetEffect && componentData.four_set_effect) {
                    fourSetEffect = this.cleanHtmlTags(
                      componentData.four_set_effect
                    );
                  }
                  if (!twoSetEffect && componentData.two_set_effect) {
                    twoSetEffect = this.cleanHtmlTags(
                      componentData.two_set_effect
                    );
                  }
                } catch (parseError) {
                  // JSON解析エラーは無視して続行
                }
              }
            }
          }
        }
      }

      // 最終フォールバック
      if (!fourSetEffect) {
        fourSetEffect = "4セット効果情報が取得できませんでした";
      }

      if (!twoSetEffect) {
        twoSetEffect = "2セット効果情報が取得できませんでした";
      }

      return {
        fourSetEffect,
        twoSetEffect,
      };
    } catch (error) {
      logger.error("ドライバーディスクセット効果抽出エラー", {
        discId: discEntry.id,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        fourSetEffect: "セット効果情報の取得中にエラーが発生しました",
        twoSetEffect: "セット効果情報の取得中にエラーが発生しました",
      };
    }
  }

  private async estimateSpecialtyWithFallback(
    setEffectInfo: SetEffectInfo,
    discEntry: DriverDiscEntry
  ): Promise<Specialty> {
    try {
      // 4セット効果から特性を推定
      const specialty = this.extractSpecialtyFromText(
        setEffectInfo.fourSetEffect
      );

      if (specialty !== "support") {
        return specialty;
      }

      // 2セット効果からも試行
      const specialtyFromTwo = this.extractSpecialtyFromText(
        setEffectInfo.twoSetEffect
      );

      if (specialtyFromTwo !== "support") {
        return specialtyFromTwo;
      }

      // 名前から推測
      return this.guessSpecialtyFromName(discEntry.name);
    } catch (error) {
      logger.error("ドライバーディスク特性推定エラー", {
        discId: discEntry.id,
        error: error instanceof Error ? error.message : String(error),
      });

      return "support"; // デフォルト値
    }
  }

  private extractSpecialtyFromText(text: string): Specialty {
    const specialtyPatterns = {
      撃破: "stun",
      強攻: "attack",
      異常: "anomaly",
      支援: "support",
      防護: "defense",
      命破: "rupture",
    } as const;

    const lowerText = text.toLowerCase();

    for (const [pattern, specialty] of Object.entries(specialtyPatterns)) {
      if (lowerText.includes(pattern)) {
        return specialty as Specialty;
      }
    }

    return "support"; // デフォルト値
  }

  private guessSpecialtyFromName(name: string): Specialty {
    const namePatterns = {
      攻撃: "attack",
      防御: "defense",
      支援: "support",
      異常: "anomaly",
      撃破: "stun",
      命破: "rupture",
    } as const;

    const lowerName = name.toLowerCase();

    for (const [pattern, specialty] of Object.entries(namePatterns)) {
      if (lowerName.includes(pattern)) {
        return specialty as Specialty;
      }
    }

    return "support"; // デフォルト値
  }

  private cleanHtmlTags(text: string): string {
    if (!text || typeof text !== "string") {
      return "";
    }

    return text
      .replace(/<[^>]*>/g, "") // HTMLタグを除去
      .replace(/&nbsp;/g, " ") // &nbsp;をスペースに変換
      .replace(/&lt;/g, "<") // &lt;を<に変換
      .replace(/&gt;/g, ">") // &gt;を>に変換
      .replace(/&amp;/g, "&") // &amp;を&に変換
      .trim();
  }

  private validatePartialData(
    processedData: ProcessedDriverDiscData,
    discId: string
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 基本情報の検証
    if (!processedData.basicInfo) {
      errors.push("基本情報が存在しません");
    } else {
      if (!processedData.basicInfo.id) {
        errors.push("IDが存在しません");
      }
      if (!processedData.basicInfo.name) {
        errors.push("名前が存在しません");
      }
    }

    // セット効果情報の検証
    if (!processedData.setEffectInfo) {
      errors.push("セット効果情報が存在しません");
    } else {
      if (!processedData.setEffectInfo.fourSetEffect) {
        errors.push("4セット効果が存在しません");
      }
      if (!processedData.setEffectInfo.twoSetEffect) {
        errors.push("2セット効果が存在しません");
      }
    }

    // 特性の検証
    if (!processedData.specialty) {
      errors.push("特性が存在しません");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private getRecoveredFields(processedData: ProcessedDriverDiscData): string[] {
    const recoveredFields: string[] = [];

    if (processedData.basicInfo?.id) recoveredFields.push("id");
    if (processedData.basicInfo?.name) recoveredFields.push("name");
    if (processedData.setEffectInfo?.fourSetEffect)
      recoveredFields.push("fourSetEffect");
    if (processedData.setEffectInfo?.twoSetEffect)
      recoveredFields.push("twoSetEffect");
    if (processedData.specialty) recoveredFields.push("specialty");

    return recoveredFields;
  }

  private generateDataRecoveryRecommendations(
    availableFields: string[],
    missingFields: string[],
    processingViability: string
  ): string[] {
    const recommendations: string[] = [];

    if (processingViability === "impossible") {
      recommendations.push("データが不完全すぎるため処理できません");
      recommendations.push("disc-list.jsonの更新を検討してください");
    } else if (processingViability === "minimal") {
      recommendations.push("最小限のデータのみ利用可能です");
      recommendations.push("部分的な情報での処理となります");
    } else if (processingViability === "partial") {
      recommendations.push("部分的なデータが利用可能です");
      recommendations.push("グレースフル劣化での処理が推奨されます");
    } else {
      recommendations.push("十分なデータが利用可能です");
    }

    if (missingFields.some((field) => field.includes("modules"))) {
      recommendations.push("セット効果情報が不足しています");
    }

    if (missingFields.some((field) => field.includes("name"))) {
      recommendations.push("名前情報が不足しています");
    }

    return recommendations;
  }
}
