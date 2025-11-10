import { DataMapper } from "./DataMapper";
import { ApiResponse, Module, Component } from "../types/api";
import {
  BasicDriverDiscInfo,
  SetEffectInfo,
  Specialty,
  Lang,
} from "../types/index";
import { MappingError } from "../errors";
import { logger } from "../utils/Logger";

/**
 * ドライバーディスクデータマッピング機能を提供するクラス
 * HoyoLab API レスポンスからドライバーディスクオブジェクトへのデータマッピングを行う
 */
export class DriverDiscDataMapper extends DataMapper {
  // 特性抽出用のパターンマッピング
  private static readonly SPECIALTY_PATTERNS: Record<string, Specialty> = {
    撃破: "stun",
    強攻: "attack",
    異常: "anomaly",
    支援: "support",
    防護: "defense",
    命破: "rupture",
  };

  constructor() {
    super();
  }

  /**
   * API レスポンスから基本ドライバーディスク情報を抽出
   * @param apiResponse API レスポンス
   * @param discId ドライバーディスクID
   * @returns 基本ドライバーディスク情報
   */
  public extractBasicDriverDiscInfo(
    apiResponse: ApiResponse,
    discId: string
  ): BasicDriverDiscInfo {
    try {
      if (!apiResponse?.data?.page) {
        throw new MappingError("API レスポンスが無効です");
      }

      const page = apiResponse.data.page;

      // IDを数値に変換
      const numericId = parseInt(page.id, 10);
      if (isNaN(numericId)) {
        throw new MappingError(
          `ドライバーディスクIDが数値に変換できません: ${page.id}`
        );
      }

      // 名前を抽出
      const name = page.name;
      if (!name || typeof name !== "string") {
        throw new MappingError("ドライバーディスク名が見つかりません");
      }

      // リリースバージョンを抽出（オプショナル）
      const releaseVersion = this.extractReleaseVersion(page.modules);

      const basicInfo: BasicDriverDiscInfo = {
        id: numericId,
        name: name.trim(),
        releaseVersion,
      };

      logger.debug("基本ドライバーディスク情報抽出成功", {
        discId,
        id: basicInfo.id,
        name: basicInfo.name,
        releaseVersion: basicInfo.releaseVersion,
      });

      return basicInfo;
    } catch (error) {
      logger.error("基本ドライバーディスク情報の抽出に失敗しました", {
        discId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * API レスポンスからセット効果情報を抽出
   * @param apiResponse API レスポンス
   * @returns セット効果情報
   */
  public extractSetEffects(apiResponse: ApiResponse): SetEffectInfo {
    try {
      if (!apiResponse?.data?.page) {
        throw new MappingError("APIレスポンスが無効です");
      }

      const page = apiResponse.data.page;

      // まず、ページレベルのdisplay_fieldから直接抽出を試行
      if ((page as any).display_field) {
        const displayField = (page as any).display_field;

        const fourSetEffect = displayField.four_set_effect
          ? this.cleanHtmlText(displayField.four_set_effect)
          : "";
        const twoSetEffect = displayField.two_set_effect
          ? this.cleanHtmlText(displayField.two_set_effect)
          : "";

        logger.debug("ページレベルdisplay_fieldからセット効果抽出成功", {
          fourSetEffectLength: fourSetEffect.length,
          twoSetEffectLength: twoSetEffect.length,
        });

        return {
          fourSetEffect,
          twoSetEffect,
        };
      }

      // ページレベルにない場合は、modulesから抽出
      if (page.modules) {
        const setEffectInfo = this.extractSetEffectsFromModules(page.modules);

        logger.debug("modulesからセット効果情報抽出成功", {
          fourSetEffectLength: setEffectInfo.fourSetEffect.length,
          twoSetEffectLength: setEffectInfo.twoSetEffect.length,
        });

        return setEffectInfo;
      }

      // どちらも見つからない場合は空の値を返す
      logger.warn("セット効果情報が見つかりませんでした");
      return {
        fourSetEffect: "",
        twoSetEffect: "",
      };
    } catch (error) {
      logger.error("セット効果情報の抽出に失敗しました", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 4セット効果テキストから特性を抽出
   * @param fourSetEffect 4セット効果のテキスト
   * @returns 抽出された特性
   */
  public extractSpecialty(fourSetEffect: string): Specialty {
    try {
      if (!fourSetEffect || typeof fourSetEffect !== "string") {
        logger.warn(
          "4セット効果テキストが無効なため、デフォルト特性を使用します"
        );
        return "attack"; // デフォルト値
      }

      // HTMLタグを除去してクリーンなテキストを取得
      const cleanText = this.cleanHtmlText(fourSetEffect);

      // 特性パターンをマッチング
      const specialty = this.mapSpecialtyFromText(cleanText);

      logger.debug("特性抽出成功", {
        fourSetEffectLength: fourSetEffect.length,
        cleanTextLength: cleanText.length,
        extractedSpecialty: specialty,
      });

      return specialty;
    } catch (error) {
      logger.error("特性の抽出に失敗しました", {
        fourSetEffect: fourSetEffect?.substring(0, 100) + "...",
        error: error instanceof Error ? error.message : String(error),
      });
      // エラー時はデフォルト値を返す
      return "attack";
    }
  }

  /**
   * 多言語セット効果オブジェクトを生成
   * @param jaSetEffect 日本語セット効果
   * @param enSetEffect 英語セット効果（オプショナル）
   * @returns 多言語セット効果オブジェクト
   */
  public createMultiLangSetEffect(
    jaSetEffect: string,
    enSetEffect?: string
  ): { [key in Lang]: string } {
    try {
      if (!jaSetEffect || jaSetEffect.trim() === "") {
        throw new MappingError("日本語セット効果が空または無効です");
      }

      // 英語セット効果が提供されていない場合は日本語をフォールバックとして使用
      const effectiveEnSetEffect =
        enSetEffect && enSetEffect.trim() !== ""
          ? enSetEffect.trim()
          : jaSetEffect.trim();

      const result = {
        ja: jaSetEffect.trim(),
        en: effectiveEnSetEffect,
      };

      logger.debug("多言語セット効果生成成功", {
        jaLength: result.ja.length,
        enLength: result.en.length,
        usedFallback: !enSetEffect || enSetEffect.trim() === "",
      });

      return result;
    } catch (error) {
      logger.error("多言語セット効果の生成に失敗しました", {
        jaSetEffect: jaSetEffect?.substring(0, 50) + "...",
        enSetEffect: enSetEffect?.substring(0, 50) + "...",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // プライベートヘルパーメソッド

  /**
   * modulesからセット効果情報を抽出
   * @param modules モジュール配列
   * @returns セット効果情報
   */
  private extractSetEffectsFromModules(modules: Module[]): SetEffectInfo {
    try {
      // まず、display_fieldコンポーネントを検索
      let fourSetEffect = "";
      let twoSetEffect = "";

      for (const module of modules) {
        if (module.components) {
          for (const component of module.components) {
            // 実際のAPIレスポンスではreliquary_set_effectコンポーネントを使用
            if (
              component.component_id === "reliquary_set_effect" &&
              component.data
            ) {
              try {
                const setEffectData = JSON.parse(component.data);

                if (setEffectData.four_set_effect) {
                  fourSetEffect = this.cleanHtmlText(
                    setEffectData.four_set_effect
                  );
                }

                if (setEffectData.two_set_effect) {
                  twoSetEffect = this.cleanHtmlText(
                    setEffectData.two_set_effect
                  );
                }

                logger.debug("reliquary_set_effectからセット効果抽出成功", {
                  fourSetLength: fourSetEffect.length,
                  twoSetLength: twoSetEffect.length,
                });

                return {
                  fourSetEffect,
                  twoSetEffect,
                };
              } catch (parseError) {
                logger.warn("reliquary_set_effectデータのJSON解析に失敗", {
                  error:
                    parseError instanceof Error
                      ? parseError.message
                      : String(parseError),
                });
              }
            }

            // フォールバック: display_fieldコンポーネントも検索
            if (component.component_id === "display_field" && component.data) {
              try {
                const displayFieldData = JSON.parse(component.data);

                if (displayFieldData.four_set_effect) {
                  fourSetEffect = this.cleanHtmlText(
                    displayFieldData.four_set_effect
                  );
                }

                if (displayFieldData.two_set_effect) {
                  twoSetEffect = this.cleanHtmlText(
                    displayFieldData.two_set_effect
                  );
                }

                logger.debug("display_fieldからセット効果抽出成功", {
                  fourSetLength: fourSetEffect.length,
                  twoSetLength: twoSetEffect.length,
                });

                return {
                  fourSetEffect,
                  twoSetEffect,
                };
              } catch (parseError) {
                logger.warn("display_fieldデータのJSON解析に失敗", {
                  error:
                    parseError instanceof Error
                      ? parseError.message
                      : String(parseError),
                });
              }
            }
          }
        }
      }

      // display_fieldが見つからない場合は、従来のbaseInfoモジュールを検索
      const baseInfoModule = modules.find(
        (module) => module.name === "ステータス" || module.name === "baseInfo"
      );

      if (!baseInfoModule) {
        logger.warn("display_fieldもbaseInfoモジュールも見つかりません");
        return {
          fourSetEffect: "",
          twoSetEffect: "",
        };
      }

      const baseInfoComponent = baseInfoModule.components?.find(
        (component) => component.component_id === "baseInfo"
      );

      if (!baseInfoComponent?.data) {
        logger.warn("baseInfoデータが存在しません");
        return {
          fourSetEffect: "",
          twoSetEffect: "",
        };
      }

      // JSON データを解析
      let baseInfoData;
      try {
        baseInfoData = JSON.parse(baseInfoComponent.data);
      } catch (parseError) {
        logger.error("baseInfoデータのJSON解析に失敗しました", {
          error:
            parseError instanceof Error
              ? parseError.message
              : String(parseError),
        });
        return {
          fourSetEffect: "",
          twoSetEffect: "",
        };
      }

      if (!baseInfoData.list || !Array.isArray(baseInfoData.list)) {
        logger.warn("baseInfo.listが存在しません");
        return {
          fourSetEffect: "",
          twoSetEffect: "",
        };
      }

      // 4セット効果を検索
      const fourSetItem = baseInfoData.list.find(
        (item: any) =>
          item.key === "4セット効果" ||
          item.key === "four_set_effect" ||
          item.key === "4セット"
      );

      // 2セット効果を検索
      const twoSetItem = baseInfoData.list.find(
        (item: any) =>
          item.key === "2セット効果" ||
          item.key === "two_set_effect" ||
          item.key === "2セット"
      );

      // セット効果テキストを抽出
      fourSetEffect = this.extractSetEffectText(fourSetItem);
      twoSetEffect = this.extractSetEffectText(twoSetItem);

      logger.debug("baseInfoからセット効果抽出完了", {
        fourSetFound: !!fourSetItem,
        twoSetFound: !!twoSetItem,
        fourSetLength: fourSetEffect.length,
        twoSetLength: twoSetEffect.length,
      });

      return {
        fourSetEffect,
        twoSetEffect,
      };
    } catch (error) {
      logger.error("modulesからのセット効果抽出に失敗しました", {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        fourSetEffect: "",
        twoSetEffect: "",
      };
    }
  }

  /**
   * セット効果アイテムからテキストを抽出
   * @param setItem セット効果アイテム
   * @returns セット効果テキスト
   */
  private extractSetEffectText(setItem: any): string {
    if (!setItem) {
      return "";
    }

    // value または values 配列から最初の要素を取得
    const values = setItem.value || setItem.values;
    if (!values || !Array.isArray(values) || values.length === 0) {
      return "";
    }

    const rawText = values[0];
    if (typeof rawText !== "string") {
      return "";
    }

    // HTMLタグを除去してクリーンなテキストを返す
    return this.cleanHtmlText(rawText);
  }

  /**
   * リリースバージョンを抽出
   * @param modules モジュール配列
   * @returns リリースバージョン
   */
  private extractReleaseVersion(modules: Module[]): number | undefined {
    try {
      // baseInfoモジュールからバージョン情報を探す
      const baseInfoModule = modules?.find(
        (module) => module.name === "ステータス" || module.name === "baseInfo"
      );

      if (!baseInfoModule) {
        return undefined;
      }

      const baseInfoComponent = baseInfoModule.components?.find(
        (component) => component.component_id === "baseInfo"
      );

      if (!baseInfoComponent?.data) {
        return undefined;
      }

      const baseInfoData = JSON.parse(baseInfoComponent.data);
      if (!baseInfoData.list) {
        return undefined;
      }

      // 実装バージョンキーを探す
      for (const item of baseInfoData.list) {
        if (
          item.key &&
          (item.key.includes("実装バージョン") ||
            item.key.includes("Ver.") ||
            item.key.includes("version"))
        ) {
          const values = item.value || item.values;
          if (values && Array.isArray(values) && values.length > 0) {
            const versionText = values[0];
            if (typeof versionText === "string") {
              const version = this.parseVersionNumber(versionText);
              return version !== null ? version : undefined;
            }
          }
        }
      }

      return undefined;
    } catch (error) {
      logger.debug("バージョン情報の解析に失敗しました", {
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  /**
   * 4セット効果テキストから特性をマッピング
   * @param text 4セット効果のクリーンなテキスト
   * @returns マッピングされた特性
   */
  private mapSpecialtyFromText(text: string): Specialty {
    try {
      if (!text || text.trim() === "") {
        logger.debug("テキストが空のため、デフォルト特性を返します");
        return "attack";
      }

      // 各特性パターンをチェック
      for (const [japaneseSpecialty, englishSpecialty] of Object.entries(
        DriverDiscDataMapper.SPECIALTY_PATTERNS
      )) {
        if (text.includes(japaneseSpecialty)) {
          logger.debug("特性パターンマッチ成功", {
            pattern: japaneseSpecialty,
            specialty: englishSpecialty,
            textPreview: text.substring(0, 100) + "...",
          });
          return englishSpecialty;
        }
      }

      // 英語パターンもチェック
      const englishPatterns: Record<string, Specialty> = {
        stun: "stun",
        attack: "attack",
        anomaly: "anomaly",
        support: "support",
        defense: "defense",
        rupture: "rupture",
      };

      for (const [englishPattern, specialty] of Object.entries(
        englishPatterns
      )) {
        if (text.toLowerCase().includes(englishPattern)) {
          logger.debug("英語特性パターンマッチ成功", {
            pattern: englishPattern,
            specialty,
            textPreview: text.substring(0, 100) + "...",
          });
          return specialty;
        }
      }

      // マッチしない場合はデフォルト値
      logger.debug("特性パターンがマッチしないため、デフォルト特性を返します", {
        textPreview: text.substring(0, 100) + "...",
        availablePatterns: Object.keys(DriverDiscDataMapper.SPECIALTY_PATTERNS),
      });

      return "attack";
    } catch (error) {
      logger.error("特性マッピング中にエラーが発生しました", {
        text: text?.substring(0, 100) + "...",
        error: error instanceof Error ? error.message : String(error),
      });
      return "attack";
    }
  }

  /**
   * HTMLタグを除去してテキストを正規化
   * @param text 元のテキスト
   * @returns クリーニング済みテキスト
   */
  private cleanHtmlText(text: string): string {
    if (!text || typeof text !== "string") {
      return "";
    }

    let cleaned = text;

    // HTMLタグを除去
    cleaned = cleaned.replace(/<[^>]*>/g, "");

    // 特殊文字をデコード
    cleaned = cleaned.replace(/&lt;/g, "<");
    cleaned = cleaned.replace(/&gt;/g, ">");
    cleaned = cleaned.replace(/&amp;/g, "&");
    cleaned = cleaned.replace(/&quot;/g, '"');
    cleaned = cleaned.replace(/&#39;/g, "'");
    cleaned = cleaned.replace(/&nbsp;/g, " ");

    // 余分な空白を除去
    cleaned = cleaned.replace(/\s+/g, " ");
    cleaned = cleaned.trim();

    return cleaned;
  }
}
