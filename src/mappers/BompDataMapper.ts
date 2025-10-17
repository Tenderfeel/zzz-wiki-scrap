import { DataMapper } from "./DataMapper";
import { AttributesProcessor } from "../processors/AttributesProcessor";
import { ApiResponse, Module } from "../types/api";
import { Stats, Lang, Attributes } from "../types";
import { MappingError, ParsingError } from "../errors";
import { logger } from "../utils/Logger";
import factions from "../../data/factions";

/**
 * ボンプデータマッピング機能を提供するクラス
 * API レスポンスからボンプオブジェクトへのデータマッピングを行う
 */
export class BompDataMapper extends DataMapper {
  private attributesProcessor: AttributesProcessor;

  constructor() {
    super();
    this.attributesProcessor = new AttributesProcessor();
  }

  /**
   * API レスポンスから基本ボンプ情報を抽出
   * @param apiResponse API レスポンス
   * @param bompId ボンプID
   * @returns 基本ボンプ情報
   */
  public extractBasicBompInfo(
    apiResponse: ApiResponse,
    bompId: string
  ): {
    id: string;
    name: string;
    stats: Stats[];
    releaseVersion?: number;
  } {
    try {
      if (!apiResponse?.data?.page) {
        throw new MappingError("API レスポンスが無効です");
      }

      const page = apiResponse.data.page;

      // 名前を抽出
      const name = page.name;
      if (!name || typeof name !== "string") {
        throw new MappingError("ボンプ名が見つかりません");
      }

      // 属性を抽出してマッピング
      let rawStats: string;
      if (page.agent_stats?.values?.[0]) {
        rawStats = page.agent_stats.values[0];
      } else {
        // フォールバック: modulesから属性情報を探す
        rawStats = this.extractStatsStringFromModules(page.modules);
      }

      // 日本語属性を英語にマッピング
      const stats = this.mapStats(rawStats);

      // リリースバージョンを抽出（オプショナル）
      const releaseVersion = this.extractReleaseVersion(page.modules);

      logger.debug("基本ボンプ情報抽出成功", {
        bompId,
        name,
        stats,
        releaseVersion,
      });

      return {
        id: bompId,
        name,
        stats,
        releaseVersion,
      };
    } catch (error) {
      logger.error("基本ボンプ情報の抽出に失敗しました", {
        bompId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * APIレスポンスから陣営情報を抽出
   * @param apiResponse API レスポンス
   * @returns 陣営ID配列
   */
  public extractBompFactions(apiResponse: ApiResponse): number[] {
    try {
      if (!apiResponse?.data?.page) {
        logger.debug("APIレスポンスが無効なため、空の陣営配列を返します");
        return [];
      }

      const page = apiResponse.data.page;
      const factionIds: number[] = [];

      // filter_valuesから陣営情報を取得
      const filterValues = (page as any).filter_values;
      if (filterValues?.agent_faction?.values) {
        const factionNames = filterValues.agent_faction.values;

        logger.debug("agent_factionから陣営名を取得", {
          factionNames,
          count: factionNames.length,
        });

        for (const factionName of factionNames) {
          if (typeof factionName === "string" && factionName.trim()) {
            try {
              const factionId = this.resolveFactionId(factionName.trim());
              if (factionId > 0) {
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
      }

      // 重複を除去
      const uniqueFactionIds = Array.from(new Set(factionIds));

      logger.debug("ボンプ陣営情報抽出完了", {
        extractedIds: factionIds,
        uniqueIds: uniqueFactionIds,
      });

      return uniqueFactionIds;
    } catch (error) {
      logger.error("ボンプ陣営情報の抽出に失敗しました", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * 多言語名オブジェクトを生成
   * @param jaName 日本語名
   * @param enName 英語名
   * @returns 多言語名オブジェクト
   */
  public createBompMultiLangName(
    jaName: string,
    enName?: string
  ): { [key in Lang]: string } {
    try {
      if (!jaName || jaName.trim() === "") {
        throw new MappingError("日本語名が空または無効です");
      }

      // 英語名が提供されていない場合は日本語名をフォールバックとして使用
      const effectiveEnName =
        enName && enName.trim() !== "" ? enName.trim() : jaName.trim();

      const result = {
        ja: jaName.trim(),
        en: effectiveEnName,
      };

      logger.debug("ボンプ多言語名生成成功", {
        jaName: result.ja,
        enName: result.en,
        usedFallback: !enName || enName.trim() === "",
      });

      return result;
    } catch (error) {
      logger.error("ボンプ多言語名の生成に失敗しました", {
        jaName,
        enName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * ascension コンポーネントからボンプ属性データを抽出
   * @param modules モジュール配列
   * @returns 属性データ
   */
  public extractBompAttributes(modules: Module[]): Attributes {
    try {
      if (!modules || !Array.isArray(modules)) {
        throw new MappingError("モジュールデータが無効です");
      }

      // ascension コンポーネントを検索（日本語名「突破」または英語名「ascension」）
      const ascensionModule = modules.find(
        (module) => module.name === "突破" || module.name === "ascension"
      );
      if (!ascensionModule) {
        throw new MappingError("ascension モジュールが見つかりません");
      }

      const ascensionComponent = ascensionModule.components?.find(
        (component) => component.component_id === "ascension"
      );
      if (!ascensionComponent) {
        throw new MappingError("ascension コンポーネントが見つかりません");
      }

      if (!ascensionComponent.data) {
        throw new MappingError("ascension データが存在しません");
      }

      // AttributesProcessor を使用してデータを処理
      const attributes = this.attributesProcessor.processAscensionData(
        ascensionComponent.data
      );

      logger.debug("ボンプ属性データ抽出成功", {
        hpLevels: attributes.hp.length,
        atkLevels: attributes.atk.length,
        defLevels: attributes.def.length,
        impact: attributes.impact,
        critRate: attributes.critRate,
      });

      return attributes;
    } catch (error) {
      if (error instanceof ParsingError || error instanceof MappingError) {
        throw error;
      }
      logger.error("ボンプ属性データの抽出に失敗しました", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new MappingError(
        "ボンプ属性データの抽出に失敗しました",
        error as Error
      );
    }
  }

  /**
   * modules データから『追加能力』情報を抽出
   * @param modules モジュール配列
   * @returns 追加能力の説明文
   */
  public extractExtraAbility(modules: Module[]): string {
    try {
      if (!modules || !Array.isArray(modules)) {
        logger.warn(
          "モジュールデータが無効なため、追加能力を空文字列で返します"
        );
        return "";
      }

      // talent または skill コンポーネントを検索
      const talentModule = modules.find(
        (module) => module.name === "talent" || module.name === "skill"
      );

      if (!talentModule) {
        logger.debug("talent/skill モジュールが見つかりません");
        return "";
      }

      const talentComponent = talentModule.components?.find(
        (component) =>
          component.component_id === "talent" ||
          component.component_id === "skill"
      );

      if (!talentComponent || !talentComponent.data) {
        logger.debug("talent/skill コンポーネントまたはデータが見つかりません");
        return "";
      }

      // JSON データを解析
      let talentData;
      try {
        talentData = JSON.parse(talentComponent.data);
      } catch (parseError) {
        logger.warn("talent/skill データのJSON解析に失敗しました", {
          error:
            parseError instanceof Error
              ? parseError.message
              : String(parseError),
        });
        return "";
      }

      // 追加能力の説明文を抽出
      const extraAbility = this.extractAbilityDescription(talentData);

      logger.debug("追加能力抽出成功", {
        abilityLength: extraAbility.length,
        hasAbility: extraAbility.length > 0,
      });

      return extraAbility;
    } catch (error) {
      logger.error("追加能力の抽出に失敗しました", {
        error: error instanceof Error ? error.message : String(error),
      });
      return ""; // エラー時は空文字列を返す
    }
  }

  /**
   * modulesから属性情報を抽出（フォールバック用）
   * @param modules モジュール配列
   * @returns 属性文字列
   */
  private extractStatsStringFromModules(modules: Module[]): string {
    // ステータス モジュールから属性情報を探す（日本語名「ステータス」または英語名「baseInfo」）
    const baseInfoModule = modules?.find(
      (module) => module.name === "ステータス" || module.name === "baseInfo"
    );
    if (baseInfoModule) {
      const baseInfoComponent = baseInfoModule.components?.find(
        (component) => component.component_id === "baseInfo"
      );

      if (baseInfoComponent?.data) {
        try {
          const baseInfoData = JSON.parse(baseInfoComponent.data);
          if (baseInfoData.list) {
            for (const item of baseInfoData.list) {
              if (
                item.key &&
                item.key === "属性" &&
                item.value &&
                Array.isArray(item.value)
              ) {
                // HTMLタグを除去して属性名を抽出
                const rawValue = item.value[0];
                if (typeof rawValue === "string") {
                  // HTMLタグを除去
                  const cleanValue = rawValue.replace(/<[^>]*>/g, "").trim();

                  // 属性名の正規化
                  let attributeName: string;

                  // 英語属性名の場合はそのまま返す
                  if (
                    [
                      "ice",
                      "fire",
                      "electric",
                      "physical",
                      "ether",
                      "frost",
                      "auricInk",
                    ].includes(cleanValue.toLowerCase())
                  ) {
                    attributeName = cleanValue;
                  } else if (cleanValue.endsWith("属性")) {
                    // 既に「属性」が含まれている場合
                    attributeName = cleanValue;
                  } else {
                    // 日本語の属性名に「属性」を付加
                    attributeName = cleanValue + "属性";
                  }

                  logger.debug("ボンプ属性をbaseInfoから抽出", {
                    rawValue,
                    cleanValue,
                    attributeName,
                  });

                  return attributeName;
                }
              }
            }
          }
        } catch (error) {
          logger.warn("baseInfo データの解析に失敗しました", { error });
        }
      }
    }

    // デフォルト値として物理属性を返す
    logger.warn(
      "属性情報が見つからないため、デフォルト値 '物理属性' を使用します"
    );
    return "物理属性";
  }

  /**
   * リリースバージョンを抽出
   * @param modules モジュール配列
   * @returns リリースバージョン
   */
  private extractReleaseVersion(modules: Module[]): number | undefined {
    // baseInfo モジュールからバージョン情報を探す（日本語名「ステータス」または英語名「baseInfo」）
    const baseInfoModule = modules?.find(
      (module) => module.name === "ステータス" || module.name === "baseInfo"
    );
    if (baseInfoModule) {
      const baseInfoComponent = baseInfoModule.components?.find(
        (component) => component.component_id === "baseInfo"
      );

      if (baseInfoComponent?.data) {
        try {
          const baseInfoData = JSON.parse(baseInfoComponent.data);
          if (baseInfoData.list) {
            for (const item of baseInfoData.list) {
              // 実装バージョンキーを探す
              if (
                item.key &&
                (item.key.includes("実装バージョン") ||
                  item.key.includes("Ver."))
              ) {
                // value配列の最初の要素からバージョンを抽出
                if (
                  item.value &&
                  Array.isArray(item.value) &&
                  item.value.length > 0
                ) {
                  const versionText = item.value[0];
                  if (typeof versionText === "string") {
                    const version = this.parseVersionNumber(versionText);
                    return version !== null ? version : undefined;
                  }
                }
              }
            }
          }
        } catch (error) {
          logger.debug("バージョン情報の解析に失敗しました", { error });
        }
      }
    }

    return undefined;
  }

  /**
   * talent データから能力説明文を抽出
   * @param talentData talent JSON データ
   * @returns 能力説明文
   */
  private extractAbilityDescription(talentData: any): string {
    try {
      if (!talentData || typeof talentData !== "object") {
        return "";
      }

      // list 配列から説明文を探す
      if (talentData.list && Array.isArray(talentData.list)) {
        for (const item of talentData.list) {
          // children 配列から説明文を探す
          if (item.children && Array.isArray(item.children)) {
            for (const child of item.children) {
              if (child.desc && typeof child.desc === "string") {
                // HTMLタグを除去してクリーンアップ
                return this.cleanAbilityText(child.desc);
              }
            }
          }

          // 直接 desc フィールドがある場合
          if (item.desc && typeof item.desc === "string") {
            return this.cleanAbilityText(item.desc);
          }
        }
      }

      return "";
    } catch (error) {
      logger.warn("能力説明文の抽出中にエラーが発生しました", {
        error: error instanceof Error ? error.message : String(error),
      });
      return "";
    }
  }

  /**
   * 陣営名から/data/factions.tsのIDにマッピング
   * @param factionName 陣営名
   * @returns 陣営ID
   */
  private resolveFactionId(factionName: string): number {
    try {
      const faction = factions.find((f) => f.name.ja === factionName);
      if (!faction) {
        const availableFactions = factions.map((f) => f.name.ja).join(", ");
        throw new MappingError(
          `未知の陣営名: "${factionName}". 利用可能な陣営: ${availableFactions}`
        );
      }
      return faction.id;
    } catch (error) {
      if (error instanceof MappingError) {
        throw error;
      }
      throw new MappingError("陣営IDの解決に失敗しました", error as Error);
    }
  }

  /**
   * 日本語テキストの適切な処理とクリーニング
   * @param text 元のテキスト
   * @returns クリーニング済みテキスト
   */
  private cleanAbilityText(text: string): string {
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

    // 余分な空白を除去
    cleaned = cleaned.replace(/\s+/g, " ");
    cleaned = cleaned.trim();

    return cleaned;
  }
}
