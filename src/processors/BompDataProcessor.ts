import { DataProcessor } from "./DataProcessor";
import { HoyoLabApiClient } from "../clients/HoyoLabApiClient";
import { BompDataMapper } from "../mappers/BompDataMapper";
import { ApiResponse, Module } from "../types/api";
import { BompEntry, Stats, Attributes } from "../types";
import {
  ProcessedBompData,
  BasicBompInfo,
  ValidationResult,
} from "../types/processing";
import { ParsingError, MappingError, ApiError } from "../errors";
import { logger } from "../utils/Logger";
import { GracefulDegradation } from "../utils/GracefulDegradation";

/**
 * ボンプデータプロセッサー - ボンプデータの変換とビジネスロジック処理
 * 要件: 1.2, 1.5, 4.2, 5.3, 3.5, 4.5
 */
export class BompDataProcessor extends DataProcessor {
  private apiClient: HoyoLabApiClient;
  private bompDataMapper: BompDataMapper;

  constructor(apiClient?: HoyoLabApiClient, bompDataMapper?: BompDataMapper) {
    super();
    this.apiClient = apiClient || new HoyoLabApiClient();
    this.bompDataMapper = bompDataMapper || new BompDataMapper();
  }

  /**
   * BompEntry から ProcessedBompData への変換機能を実装
   * 既存の HoyoLabApiClient を使用した API データ取得
   * 日本語・英語両方のデータ取得とエラーハンドリング
   * 要件: 1.2, 1.5, 4.2, 5.3
   */
  public async processBompData(
    bompEntry: BompEntry
  ): Promise<ProcessedBompData> {
    logger.info("ボンプデータ処理を開始", {
      bompId: bompEntry.id,
      pageId: bompEntry.pageId,
      jaName: bompEntry.jaName,
    });

    try {
      // API データを取得（日本語優先、英語フォールバック）
      const apiData = await this.fetchBompApiData(bompEntry);

      // 基本情報を抽出
      const basicInfo = this.extractBasicBompInfo(apiData.ja, bompEntry.id);

      // 属性データを抽出
      const attributesInfo = this.extractBompAttributesInfo(apiData.ja);

      // 追加能力を抽出
      const extraAbility = this.extractBompExtraAbility(apiData.ja);

      // 派閥情報を抽出
      const factionIds = this.extractBompFactions(apiData.ja);

      const processedData: ProcessedBompData = {
        basicInfo,
        attributesInfo,
        extraAbility,
        factionIds,
      };

      // データ検証
      const validationResult = this.validateBompData(processedData);
      if (!validationResult.isValid) {
        logger.warn("ボンプデータ検証に失敗しましたが、処理を継続します", {
          bompId: bompEntry.id,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
        });
      }

      logger.info("ボンプデータ処理完了", {
        bompId: bompEntry.id,
        hasExtraAbility: extraAbility.length > 0,
        factionCount: factionIds.length,
        validationPassed: validationResult.isValid,
      });

      return processedData;
    } catch (error) {
      logger.error("ボンプデータ処理に失敗しました", {
        bompId: bompEntry.id,
        pageId: bompEntry.pageId,
        error: error instanceof Error ? error.message : String(error),
      });

      // グレースフル劣化を試行
      const degradationResult = await this.attemptGracefulDegradation(
        bompEntry,
        error
      );

      if (degradationResult) {
        logger.info("グレースフル劣化によりボンプデータを部分的に回復", {
          bompId: bompEntry.id,
          recoveredFields: Object.keys(degradationResult),
        });
        return degradationResult;
      }

      throw error;
    }
  }

  /**
   * APIレスポンスから派閥 ID を抽出
   * キャラクターと同様にagent_factionフィールドから陣営情報を取得
   * 複数派閥への所属可能性を考慮した配列処理
   * 要件: 3.5
   */
  public extractBompFactions(apiData: ApiResponse): number[] {
    logger.debug("ボンプ派閥情報抽出を開始");

    try {
      const page = apiData.data.page;

      if (!page) {
        logger.warn("APIレスポンスにpageデータが存在しません");
        return [];
      }

      // filter_valuesから陣営情報を取得（キャラクターと同じ方法）
      const filterValues = (page as any).filter_values;

      if (filterValues?.agent_faction?.values) {
        const factionNames = filterValues.agent_faction.values;
        const factionIds: number[] = [];

        logger.debug("agent_factionから陣営名を取得", {
          factionNames,
          count: factionNames.length,
        });

        // 各陣営名をIDに変換
        for (const factionName of factionNames) {
          if (typeof factionName === "string" && factionName.trim()) {
            try {
              const factionId = this.resolveFactionId(factionName.trim());
              if (this.validateFactionId(factionId)) {
                factionIds.push(factionId);
              }
            } catch (error) {
              logger.warn("陣営名の解決に失敗しました", {
                factionName,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
        }

        // 重複を除去
        const uniqueFactionIds = Array.from(new Set(factionIds));

        logger.debug("ボンプ派閥情報抽出完了（agent_faction）", {
          factionNames,
          extractedIds: factionIds,
          uniqueIds: uniqueFactionIds,
        });

        return uniqueFactionIds;
      }

      // フォールバック: baseInfoモジュールから陣営情報を探す
      logger.debug("agent_factionが見つからないため、baseInfoモジュールを検索");

      if (!page.modules || !Array.isArray(page.modules)) {
        logger.debug("modulesが存在しません");
        return [];
      }

      const baseInfoModule = page.modules.find(
        (module) => module.name === "baseInfo" || module.name === "ステータス"
      );

      if (!baseInfoModule) {
        logger.debug("baseInfoモジュールが見つかりません");
        return [];
      }

      const baseInfoComponent = baseInfoModule.components?.find(
        (component) => component.component_id === "baseInfo"
      );

      if (!baseInfoComponent || !baseInfoComponent.data) {
        logger.debug("baseInfoコンポーネントまたはデータが見つかりません");
        return [];
      }

      // JSON データを解析
      let baseInfoData;
      try {
        baseInfoData = JSON.parse(baseInfoComponent.data);
      } catch (parseError) {
        logger.warn("baseInfoデータのJSON解析に失敗しました", {
          error:
            parseError instanceof Error
              ? parseError.message
              : String(parseError),
        });
        return [];
      }

      const factionIds: number[] = [];

      // list 配列から派閥情報を抽出
      if (baseInfoData.list && Array.isArray(baseInfoData.list)) {
        for (const item of baseInfoData.list) {
          if (
            item.key &&
            (item.key.includes("陣営") || item.key.includes("派閥"))
          ) {
            const extractedIds = this.extractFactionIdsFromItem(item);
            factionIds.push(...extractedIds);
          }
        }
      }

      // 重複を除去し、有効な派閥IDのみを保持
      const uniqueFactionIds = Array.from(new Set(factionIds)).filter((id) =>
        this.validateFactionId(id)
      );

      logger.debug("ボンプ派閥情報抽出完了（baseInfo）", {
        extractedCount: factionIds.length,
        uniqueCount: uniqueFactionIds.length,
        factionIds: uniqueFactionIds,
      });

      return uniqueFactionIds;
    } catch (error) {
      logger.error("ボンプ派閥情報の抽出に失敗しました", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * ProcessedBompData の妥当性検証機能
   * 必須フィールドの存在確認と型チェック
   * グレースフル劣化とエラー回復機能の実装
   * 要件: 4.2, 4.5
   */
  public validateBompData(data: ProcessedBompData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 基本情報の検証
      if (!data.basicInfo) {
        errors.push("基本情報が存在しません");
      } else {
        if (!data.basicInfo.id || typeof data.basicInfo.id !== "string") {
          errors.push("ボンプIDが無効です");
        }

        if (!data.basicInfo.name || typeof data.basicInfo.name !== "string") {
          errors.push("ボンプ名が無効です");
        }

        if (!data.basicInfo.stats || typeof data.basicInfo.stats !== "string") {
          errors.push("ボンプ属性が無効です");
        }

        if (
          data.basicInfo.releaseVersion !== undefined &&
          (typeof data.basicInfo.releaseVersion !== "number" ||
            data.basicInfo.releaseVersion <= 0)
        ) {
          warnings.push("リリースバージョンが無効です");
        }
      }

      // 属性情報の検証
      if (!data.attributesInfo) {
        errors.push("属性情報が存在しません");
      } else {
        if (
          !data.attributesInfo.ascensionData ||
          typeof data.attributesInfo.ascensionData !== "string"
        ) {
          errors.push("アセンションデータが無効です");
        }
      }

      // 追加能力の検証
      if (typeof data.extraAbility !== "string") {
        warnings.push("追加能力が文字列ではありません");
      }

      // 派閥IDの検証
      if (data.factionIds) {
        if (!Array.isArray(data.factionIds)) {
          warnings.push("派閥IDが配列ではありません");
        } else {
          const invalidFactionIds = data.factionIds.filter(
            (id) => typeof id !== "number" || id <= 0
          );
          if (invalidFactionIds.length > 0) {
            warnings.push(
              `無効な派閥IDが含まれています: ${invalidFactionIds.join(", ")}`
            );
          }
        }
      }

      const isValid = errors.length === 0;

      logger.debug("ボンプデータ検証完了", {
        isValid,
        errorCount: errors.length,
        warningCount: warnings.length,
      });

      return {
        isValid,
        errors,
        warnings,
      };
    } catch (error) {
      logger.error("ボンプデータ検証中にエラーが発生しました", {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        isValid: false,
        errors: [
          "データ検証中にエラーが発生しました: " +
            (error instanceof Error ? error.message : String(error)),
        ],
        warnings,
      };
    }
  }

  /**
   * API データを取得（日本語優先、英語フォールバック）
   */
  private async fetchBompApiData(bompEntry: BompEntry): Promise<{
    ja: ApiResponse;
    en?: ApiResponse;
  }> {
    try {
      // 日本語データを取得
      const jaData = await this.apiClient.fetchCharacterData(
        bompEntry.pageId,
        "ja-jp"
      );

      logger.debug("日本語ボンプデータ取得成功", {
        bompId: bompEntry.id,
        pageId: bompEntry.pageId,
      });

      // 英語データも取得を試行（フォールバック用）
      let enData: ApiResponse | undefined;
      try {
        enData = await this.apiClient.fetchCharacterData(
          bompEntry.pageId,
          "en-us"
        );
        logger.debug("英語ボンプデータ取得成功", {
          bompId: bompEntry.id,
          pageId: bompEntry.pageId,
        });
      } catch (enError) {
        logger.warn(
          "英語ボンプデータの取得に失敗しましたが、処理を継続します",
          {
            bompId: bompEntry.id,
            error: enError instanceof Error ? enError.message : String(enError),
          }
        );
      }

      return { ja: jaData, en: enData };
    } catch (error) {
      if (error instanceof ApiError) {
        throw new ApiError(
          `ボンプAPIデータの取得に失敗しました (${bompEntry.id}): ${error.message}`,
          error
        );
      }
      throw error;
    }
  }

  /**
   * 基本ボンプ情報を抽出
   */
  private extractBasicBompInfo(
    apiData: ApiResponse,
    bompId: string
  ): BasicBompInfo {
    try {
      return this.bompDataMapper.extractBasicBompInfo(apiData, bompId);
    } catch (error) {
      logger.error("基本ボンプ情報の抽出に失敗しました", {
        bompId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new MappingError(
        `基本ボンプ情報の抽出に失敗しました (${bompId})`,
        error as Error
      );
    }
  }

  /**
   * ボンプ属性情報を抽出
   */
  private extractBompAttributesInfo(apiData: ApiResponse) {
    try {
      const modules = apiData.data.page.modules;
      this.bompDataMapper.extractBompAttributes(modules);

      // AttributesInfo 形式で返す
      const ascensionModule = modules.find(
        (module) => module.name === "突破" || module.name === "ascension"
      );
      const ascensionComponent = ascensionModule?.components?.find(
        (component) => component.component_id === "ascension"
      );

      if (!ascensionComponent?.data) {
        throw new MappingError("アセンションデータが見つかりません");
      }

      return {
        ascensionData: ascensionComponent.data,
      };
    } catch (error) {
      logger.error("ボンプ属性情報の抽出に失敗しました", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new MappingError(
        "ボンプ属性情報の抽出に失敗しました",
        error as Error
      );
    }
  }

  /**
   * ボンプ追加能力を抽出
   */
  private extractBompExtraAbility(apiData: ApiResponse): string {
    try {
      const modules = apiData.data.page.modules;
      return this.bompDataMapper.extractExtraAbility(modules);
    } catch (error) {
      logger.warn("ボンプ追加能力の抽出に失敗しましたが、空文字列を返します", {
        error: error instanceof Error ? error.message : String(error),
      });
      return "";
    }
  }

  /**
   * アイテムから派閥IDを抽出
   */
  private extractFactionIdsFromItem(item: any): number[] {
    const factionIds: number[] = [];

    try {
      // value 配列から派閥情報を取得
      if (item.value && Array.isArray(item.value)) {
        for (const valueItem of item.value) {
          if (typeof valueItem === "string") {
            // 特殊形式 $[JSON]$ の解析
            if (valueItem.startsWith("$[") && valueItem.endsWith("]$")) {
              try {
                const jsonStr = valueItem.slice(2, -2); // $[ と ]$ を除去
                const factionData = JSON.parse(jsonStr);

                logger.debug("陣営データを解析", {
                  rawValue: valueItem,
                  parsedData: factionData,
                });

                if (factionData.name) {
                  const factionId = this.resolveFactionNameToId(
                    factionData.name
                  );
                  if (factionId > 0) {
                    factionIds.push(factionId);
                  }
                }
              } catch (parseError) {
                logger.warn("特殊形式陣営データの解析に失敗", {
                  valueItem,
                  error:
                    parseError instanceof Error
                      ? parseError.message
                      : String(parseError),
                });
              }
            } else {
              // 通常の陣営名として処理
              const factionId = this.resolveFactionNameToId(valueItem);
              if (factionId > 0) {
                factionIds.push(factionId);
              }
            }
          }
        }
      }

      // 直接的な派閥ID参照がある場合
      if (item.faction_id && typeof item.faction_id === "number") {
        factionIds.push(item.faction_id);
      }
    } catch (error) {
      logger.warn("派閥ID抽出中にエラーが発生しました", {
        error: error instanceof Error ? error.message : String(error),
        item: JSON.stringify(item).substring(0, 100),
      });
    }

    return factionIds;
  }

  /**
   * 派閥名から派閥IDを解決
   */
  private resolveFactionNameToId(factionName: string): number {
    try {
      // 既存の resolveFactionId メソッドを使用
      return this.resolveFactionId(factionName);
    } catch (error) {
      logger.debug("派閥名の解決に失敗しました", {
        factionName,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * 派閥IDの妥当性を検証
   */
  private validateFactionId(factionId: number): boolean {
    return typeof factionId === "number" && factionId > 0 && factionId <= 100;
  }

  /**
   * グレースフル劣化を試行
   */
  private async attemptGracefulDegradation(
    bompEntry: BompEntry,
    originalError: any
  ): Promise<ProcessedBompData | null> {
    logger.info("ボンプデータのグレースフル劣化を試行", {
      bompId: bompEntry.id,
      originalError:
        originalError instanceof Error
          ? originalError.message
          : String(originalError),
    });

    try {
      // 最小限の基本情報を作成
      const basicInfo: BasicBompInfo = {
        id: bompEntry.id,
        name: bompEntry.jaName, // Scraping.mdから取得した日本語名を使用
        stats: "physical", // デフォルト属性
        releaseVersion: undefined,
      };

      // 空の属性情報を作成
      const attributesInfo = {
        ascensionData: JSON.stringify({
          list: [],
          combatList: {
            hp: { values: [0, 0, 0, 0, 0, 0, 0] },
            atk: { values: [0, 0, 0, 0, 0, 0, 0] },
            def: { values: [0, 0, 0, 0, 0, 0, 0] },
          },
        }),
      };

      const processedData: ProcessedBompData = {
        basicInfo,
        attributesInfo,
        extraAbility: "",
        factionIds: [],
      };

      logger.info("グレースフル劣化によるボンプデータ作成完了", {
        bompId: bompEntry.id,
      });

      return processedData;
    } catch (degradationError) {
      logger.error("グレースフル劣化に失敗しました", {
        bompId: bompEntry.id,
        degradationError:
          degradationError instanceof Error
            ? degradationError.message
            : String(degradationError),
      });
      return null;
    }
  }
}
