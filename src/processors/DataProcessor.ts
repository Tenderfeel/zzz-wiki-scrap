import { ApiResponse, Module, Component, AgentTalentData } from "../types/api";
import {
  BasicCharacterInfo,
  FactionInfo,
  AttributesInfo,
  ProcessedData,
} from "../types/processing";
import { AssistType } from "../types/index";
import factions from "../../data/factions";
import { ParsingError, MappingError } from "../errors";
import { DataMapper } from "../mappers/DataMapper";
import { logger } from "../utils/Logger";
import { AssistTypeStatistics } from "../utils/AssistTypeStatistics";

/**
 * データプロセッサー - API レスポンスからキャラクター情報を抽出
 */
export class DataProcessor {
  protected dataMapper: DataMapper;
  protected assistTypeStatistics: AssistTypeStatistics;

  constructor(
    dataMapper?: DataMapper,
    assistTypeStatistics?: AssistTypeStatistics
  ) {
    this.dataMapper = dataMapper || new DataMapper();
    this.assistTypeStatistics =
      assistTypeStatistics || new AssistTypeStatistics();
  }
  /**
   * 基本キャラクター情報を抽出
   * 要件: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
   */
  extractBasicInfo(apiData: ApiResponse): BasicCharacterInfo {
    try {
      const page = apiData.data.page;

      if (!page) {
        throw new ParsingError("APIレスポンスにpageデータが存在しません");
      }

      // filter_valuesからデータを抽出
      const filterValues = (page as any).filter_values;

      if (!filterValues) {
        throw new ParsingError("APIレスポンスにfilter_valuesが存在しません");
      }

      // 必須フィールドの存在確認
      const specialty = filterValues?.agent_specialties?.values?.[0];
      const stats = filterValues?.agent_stats?.values?.[0];
      const rarity = filterValues?.agent_rarity?.values?.[0];

      if (!specialty) {
        throw new ParsingError("特性データ(agent_specialties)が見つかりません");
      }
      if (!stats) {
        throw new ParsingError("属性データ(agent_stats)が見つかりません");
      }
      if (!rarity) {
        throw new ParsingError("レア度データ(agent_rarity)が見つかりません");
      }

      // 実装バージョンを抽出
      const releaseVersion = this.extractReleaseVersion(apiData);

      return {
        id: page.id,
        name: page.name,
        specialty,
        stats,
        rarity,
        releaseVersion,
      };
    } catch (error) {
      if (error instanceof ParsingError) {
        throw error;
      }
      throw new ParsingError(
        "基本キャラクター情報の抽出に失敗しました",
        error as Error
      );
    }
  }

  /**
   * 陣営情報を抽出
   * 要件: 3.1, 3.2, 3.3
   */
  extractFactionInfo(apiData: ApiResponse): FactionInfo {
    try {
      const page = apiData.data.page;

      if (!page) {
        throw new ParsingError("APIレスポンスにpageデータが存在しません");
      }

      // filter_valuesから陣営名を取得
      const filterValues = (page as any).filter_values;

      if (!filterValues) {
        throw new ParsingError("APIレスポンスにfilter_valuesが存在しません");
      }

      const factionName = filterValues?.agent_faction?.values?.[0];

      if (!factionName) {
        throw new ParsingError("陣営情報(agent_faction)が見つかりません");
      }

      // 陣営名からIDを解決
      const factionId = this.resolveFactionId(factionName);

      return {
        id: factionId,
        name: factionName,
      };
    } catch (error) {
      if (error instanceof ParsingError || error instanceof MappingError) {
        throw error;
      }
      throw new ParsingError("陣営情報の抽出に失敗しました", error as Error);
    }
  }

  /**
   * 実装バージョン情報を抽出
   * 要件: 2.1, 2.2
   */
  extractReleaseVersion(apiData: ApiResponse): number {
    const characterId = apiData.data?.page?.id || "unknown";

    try {
      const page = apiData.data.page;

      if (!page) {
        logger.debug(
          "APIレスポンスにpageデータが存在しません（実装バージョン抽出）",
          {
            characterId,
          }
        );
        return 0;
      }

      if (!page.modules || !Array.isArray(page.modules)) {
        logger.debug(
          "APIレスポンスにmodulesが存在しません（実装バージョン抽出）",
          {
            characterId,
          }
        );
        return 0;
      }

      // baseInfoコンポーネントを探す
      const baseInfoComponent = this.findComponent(page.modules, "baseInfo");
      if (!baseInfoComponent) {
        logger.debug("baseInfoコンポーネントが見つかりません", {
          characterId,
        });
        return 0;
      }

      if (!baseInfoComponent.data) {
        logger.debug("baseInfoコンポーネントにdataが存在しません", {
          characterId,
        });
        return 0;
      }

      // baseInfoデータをパース
      let baseInfoData;
      try {
        baseInfoData = JSON.parse(baseInfoComponent.data);
      } catch (parseError) {
        const errorMessage =
          parseError instanceof Error ? parseError.message : String(parseError);
        logger.warn("baseInfoデータのパースに失敗", {
          characterId,
          error: errorMessage,
        });
        return 0;
      }

      if (!baseInfoData.list || !Array.isArray(baseInfoData.list)) {
        logger.debug("baseInfoデータにlistが存在しません", {
          characterId,
          baseInfoDataKeys: Object.keys(baseInfoData),
        });
        return 0;
      }

      // 実装バージョンキーを検索
      const versionItem = baseInfoData.list.find(
        (item: any) => item.key === "実装バージョン"
      );

      if (!versionItem) {
        logger.debug("実装バージョンキーが見つかりません", {
          characterId,
          availableKeys: baseInfoData.list
            .map((item: any) => item.key)
            .filter(Boolean),
        });
        return 0;
      }

      if (
        !versionItem.value ||
        !Array.isArray(versionItem.value) ||
        versionItem.value.length === 0
      ) {
        logger.debug("実装バージョンの値が無効です", {
          characterId,
          versionValue: versionItem.value,
        });
        return 0;
      }

      // HTMLタグを含むバージョン文字列を取得
      const versionString = versionItem.value[0];
      if (typeof versionString !== "string") {
        logger.debug("実装バージョンの値が文字列ではありません", {
          characterId,
          versionValue: versionString,
        });
        return 0;
      }

      logger.debug("実装バージョン文字列を取得", {
        characterId,
        rawVersionString: versionString,
      });

      // バージョン解析ロジックを呼び出し
      const parsedVersion = this.parseVersionNumber(versionString);

      logger.debug("実装バージョン抽出完了", {
        characterId,
        rawVersion: versionString,
        parsedVersion,
      });

      return parsedVersion;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.warn("実装バージョン処理中にエラーが発生", {
        error: errorMessage,
        characterId,
      });
      return 0;
    }
  }

  /**
   * バージョン文字列から数値を抽出
   * 要件: 2.2, 2.3
   */
  private parseVersionNumber(versionString: string): number {
    try {
      // HTMLタグを除去
      const cleanString = versionString.replace(/<[^>]*>/g, "");

      // Ver.X.Y 形式を抽出する正規表現
      const VERSION_PATTERN = /Ver\.(\d+\.\d+)/;
      const match = cleanString.match(VERSION_PATTERN);

      if (!match || !match[1]) {
        logger.debug("バージョンパターンが見つかりません", {
          cleanString,
          originalString: versionString,
        });
        return 0;
      }

      // 数値変換
      const versionNumber = parseFloat(match[1]);

      if (isNaN(versionNumber)) {
        logger.warn("バージョン数値変換に失敗", {
          extractedVersion: match[1],
          originalString: versionString,
        });
        return 0;
      }

      logger.debug("バージョン解析成功", {
        originalString: versionString,
        cleanString,
        extractedVersion: match[1],
        parsedNumber: versionNumber,
      });

      return versionNumber;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.warn("バージョン解析中にエラーが発生", {
        error: errorMessage,
        versionString,
      });
      return 0;
    }
  }

  /**
   * 支援タイプ情報を抽出
   * 要件: 2.1, 2.2, 4.2, 4.3
   */
  extractAssistType(apiData: ApiResponse): AssistType | undefined {
    const characterId = apiData.data?.page?.id || "unknown";

    try {
      const page = apiData.data.page;

      if (!page) {
        logger.debug(
          "APIレスポンスにpageデータが存在しません（支援タイプ抽出）",
          { characterId }
        );
        return undefined;
      }

      if (!page.modules || !Array.isArray(page.modules)) {
        logger.debug("APIレスポンスにmodulesが存在しません（支援タイプ抽出）", {
          characterId,
        });
        return undefined;
      }

      // エージェントスキルモジュールを探す
      const skillModule = page.modules.find(
        (module) =>
          module.name &&
          (module.name.includes("スキル") || module.name.includes("Skills"))
      );

      if (!skillModule) {
        logger.debug("エージェントスキルモジュールが見つかりません", {
          characterId,
          availableModules: page.modules
            .map((m) => (m as any).name)
            .filter(Boolean),
        });
        return undefined;
      }

      // agent_talentコンポーネントを探す
      const agentTalentComponent = skillModule.components.find(
        (c) => c.component_id === "agent_talent"
      );

      if (!agentTalentComponent) {
        logger.debug("agent_talentコンポーネントが見つかりません", {
          characterId,
          availableComponents: skillModule.components.map(
            (c) => c.component_id
          ),
        });
        return undefined;
      }

      // agent_talentデータをパース
      let talentData;
      try {
        talentData = JSON.parse(agentTalentComponent.data);
      } catch (parseError) {
        const errorMessage =
          parseError instanceof Error ? parseError.message : String(parseError);
        logger.warn("agent_talentデータのパースに失敗", {
          characterId,
          error: errorMessage,
        });
        this.assistTypeStatistics.recordError(
          characterId,
          `JSONパースエラー: ${errorMessage}`
        );
        return undefined;
      }

      if (!talentData.list || !Array.isArray(talentData.list)) {
        logger.debug("agent_talentデータにlistが存在しません", {
          characterId,
          talentDataKeys: Object.keys(talentData),
        });
        return undefined;
      }

      // 支援スキルを探す
      const assistSkill = talentData.list.find(
        (item: any) =>
          item.title &&
          (item.title.includes("支援") || item.title.includes("Support"))
      );

      if (!assistSkill) {
        logger.debug("支援スキルが見つかりません", {
          characterId,
          availableSkills: talentData.list
            .map((item: any) => item.title)
            .filter(Boolean),
        });
        return undefined;
      }

      // 支援タイプを特定
      let assistType: AssistType | undefined = undefined;

      // childrenから支援タイプを探す
      if (assistSkill.children && Array.isArray(assistSkill.children)) {
        for (const child of assistSkill.children) {
          if (child.title) {
            if (
              child.title.includes("パリィ支援") ||
              child.title.includes("Defensive Assist")
            ) {
              assistType = "defensive";
              logger.debug("パリィ支援を検出", {
                characterId,
                childTitle: child.title,
              });
              break;
            } else if (
              child.title.includes("回避支援") ||
              child.title.includes("Evasive Assist")
            ) {
              assistType = "evasive";
              logger.debug("回避支援を検出", {
                characterId,
                childTitle: child.title,
              });
              break;
            }
          }
        }
      }

      // attributesからも支援タイプを探す（フォールバック）
      if (
        !assistType &&
        assistSkill.attributes &&
        Array.isArray(assistSkill.attributes)
      ) {
        for (const attr of assistSkill.attributes) {
          if (attr.key) {
            if (
              attr.key.includes("パリィ支援") ||
              attr.key.includes("Defensive Assist")
            ) {
              assistType = "defensive";
              logger.debug("パリィ支援を属性から検出", {
                characterId,
                attributeKey: attr.key,
              });
              break;
            } else if (
              attr.key.includes("回避支援") ||
              attr.key.includes("Evasive Assist")
            ) {
              assistType = "evasive";
              logger.debug("回避支援を属性から検出", {
                characterId,
                attributeKey: attr.key,
              });
              break;
            }
          }
        }
      }

      if (assistType) {
        logger.debug("支援タイプ抽出成功", {
          characterId,
          assistType,
        });
      } else {
        logger.debug("支援タイプを特定できませんでした", {
          characterId,
          assistSkillTitle: assistSkill.title,
          childrenCount: assistSkill.children ? assistSkill.children.length : 0,
          attributesCount: assistSkill.attributes
            ? assistSkill.attributes.length
            : 0,
        });
      }

      return assistType;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.warn("支援タイプ処理中にエラーが発生", {
        error: errorMessage,
        characterId,
      });
      this.assistTypeStatistics.recordError(
        characterId,
        `処理エラー: ${errorMessage}`
      );
      return undefined;
    }
  }

  /**
   * 属性データを抽出
   * 要件: 4.1, 4.2
   */
  extractAttributes(apiData: ApiResponse): AttributesInfo {
    try {
      const page = apiData.data.page;

      if (!page) {
        throw new ParsingError("APIレスポンスにpageデータが存在しません");
      }

      if (!page.modules || !Array.isArray(page.modules)) {
        throw new ParsingError(
          "APIレスポンスにmodulesが存在しないか、配列ではありません"
        );
      }

      // ascensionコンポーネントを特定
      const ascensionComponent = this.findComponent(page.modules, "ascension");
      if (!ascensionComponent) {
        throw new ParsingError("ascensionコンポーネントが見つかりません");
      }

      if (!ascensionComponent.data) {
        throw new ParsingError("ascensionコンポーネントにdataが存在しません");
      }

      return {
        ascensionData: ascensionComponent.data,
      };
    } catch (error) {
      if (error instanceof ParsingError) {
        throw error;
      }
      throw new ParsingError("属性データの抽出に失敗しました", error as Error);
    }
  }

  /**
   * 陣営名から/data/factions.tsのIDにマッピング
   */
  resolveFactionId(factionName: string): number {
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
   * キャラクターデータを統合処理
   * 要件: 1.1, 3.1, 3.2
   */
  processCharacterData(apiData: ApiResponse): ProcessedData {
    try {
      logger.debug("キャラクターデータ処理を開始", {
        pageId: apiData.data?.page?.id,
      });

      // 基本情報を抽出
      const basicInfo = this.extractBasicInfo(apiData);
      logger.debug("基本情報抽出完了", { characterId: basicInfo.id });

      // 陣営情報を抽出
      const factionInfo = this.extractFactionInfo(apiData);
      logger.debug("陣営情報抽出完了", { factionId: factionInfo.id });

      // 属性データを抽出
      const attributesInfo = this.extractAttributes(apiData);
      logger.debug("属性データ抽出完了");

      // 支援タイプを抽出（エラー時はundefinedを返すため、処理は継続）
      const assistType = this.extractAssistType(apiData);

      // 統計情報に記録
      this.assistTypeStatistics.recordCharacter(basicInfo.id, assistType);

      if (assistType) {
        logger.debug("支援タイプ抽出完了", {
          characterId: basicInfo.id,
          assistType,
        });
      } else {
        logger.debug("支援タイプ情報なし", {
          characterId: basicInfo.id,
        });
      }

      const processedData: ProcessedData = {
        basicInfo,
        factionInfo,
        attributesInfo,
        assistType,
      };

      logger.debug("キャラクターデータ処理完了", {
        characterId: basicInfo.id,
        hasAssistType: !!assistType,
      });

      return processedData;
    } catch (error) {
      const characterId = apiData.data?.page?.id || "unknown";
      logger.error("キャラクターデータ処理中にエラーが発生", {
        characterId,
        error: error instanceof Error ? error.message : String(error),
      });

      // 既存の処理に影響を与えないよう、元のエラーを再スロー
      throw error;
    }
  }

  /**
   * 支援タイプ統計情報を取得
   */
  public getAssistTypeStatistics(): AssistTypeStatistics {
    return this.assistTypeStatistics;
  }

  /**
   * 支援タイプ統計情報をログに出力
   */
  public logAssistTypeStatistics(): void {
    logger.info("支援タイプ処理統計の出力を開始");
    this.assistTypeStatistics.logStatistics();
    logger.info("支援タイプ処理統計の出力を完了");
  }

  /**
   * 統計情報をリセット
   */
  public resetStatistics(): void {
    this.assistTypeStatistics.reset();
    logger.debug("DataProcessor: 支援タイプ統計情報をリセット");
  }

  /**
   * モジュールから指定されたコンポーネントを検索
   */
  private findComponent(
    modules: Module[],
    componentId: string
  ): Component | null {
    for (const module of modules) {
      const component = module.components.find(
        (c) => c.component_id === componentId
      );
      if (component) {
        return component;
      }
    }
    return null;
  }
}
