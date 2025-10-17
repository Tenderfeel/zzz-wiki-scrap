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
import { ReleaseVersionStatistics } from "../utils/ReleaseVersionStatistics";
import { GracefulDegradation } from "../utils/GracefulDegradation";
import { PartialDataHandler } from "../utils/PartialDataHandler";
import { ErrorRecoveryHandler } from "../utils/ErrorRecoveryHandler";

/**
 * データプロセッサー - API レスポンスからキャラクター情報を抽出
 */
export class DataProcessor {
  protected dataMapper: DataMapper;
  protected assistTypeStatistics: AssistTypeStatistics;
  protected releaseVersionStatistics: ReleaseVersionStatistics;
  protected partialDataHandler: PartialDataHandler;
  protected errorRecoveryHandler: ErrorRecoveryHandler;

  constructor(
    dataMapper?: DataMapper,
    assistTypeStatistics?: AssistTypeStatistics,
    releaseVersionStatistics?: ReleaseVersionStatistics,
    partialDataHandler?: PartialDataHandler,
    errorRecoveryHandler?: ErrorRecoveryHandler
  ) {
    this.dataMapper = dataMapper || new DataMapper();
    this.assistTypeStatistics =
      assistTypeStatistics || new AssistTypeStatistics();
    this.releaseVersionStatistics =
      releaseVersionStatistics || new ReleaseVersionStatistics();
    this.partialDataHandler = partialDataHandler || new PartialDataHandler();
    this.errorRecoveryHandler =
      errorRecoveryHandler || new ErrorRecoveryHandler(this.partialDataHandler);
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

    logger.debug("実装バージョン抽出処理を開始", {
      characterId,
      timestamp: new Date().toISOString(),
    });

    try {
      const page = apiData.data.page;

      if (!page) {
        const reason = "missing_page_data";
        logger.warn(
          "APIレスポンスにpageデータが存在しません（実装バージョン抽出）",
          {
            characterId,
            reason,
            defaultVersion: 0,
          }
        );

        // グレースフルデグラデーションを試行
        const degradationResult =
          GracefulDegradation.handleReleaseVersionDegradation(
            characterId,
            apiData,
            reason
          );

        if (degradationResult.success && degradationResult.version > 0) {
          logger.info(
            "グレースフルデグラデーションによる実装バージョン回復成功",
            {
              characterId,
              version: degradationResult.version,
              method: degradationResult.method,
              degradationLevel: degradationResult.degradationLevel,
            }
          );
          this.releaseVersionStatistics.recordSuccess(
            characterId,
            degradationResult.version,
            `degradation:${degradationResult.method}`
          );
          return degradationResult.version;
        }

        this.releaseVersionStatistics.recordFailure(characterId, reason);
        this.releaseVersionStatistics.recordDefaultUsed(characterId, reason);
        return 0;
      }

      if (!page.modules || !Array.isArray(page.modules)) {
        const reason = "missing_modules_array";
        logger.warn(
          "APIレスポンスにmodulesが存在しません（実装バージョン抽出）",
          {
            characterId,
            reason,
            modulesType: typeof page.modules,
            defaultVersion: 0,
          }
        );
        this.releaseVersionStatistics.recordFailure(characterId, reason);
        this.releaseVersionStatistics.recordDefaultUsed(characterId, reason);
        return 0;
      }

      logger.debug("モジュール検索を開始", {
        characterId,
        totalModules: page.modules.length,
        moduleNames: page.modules.map((m: any) => m.name).filter(Boolean),
      });

      // baseInfoコンポーネントを探す
      const baseInfoComponent = this.findComponent(page.modules, "baseInfo");
      if (!baseInfoComponent) {
        const reason = "baseinfo_component_not_found";
        logger.warn("baseInfoコンポーネントが見つかりません", {
          characterId,
          reason,
          availableComponents: page.modules
            .flatMap((m: any) => m.components?.map((c: any) => c.component_id))
            .filter(Boolean),
          defaultVersion: 0,
        });

        // グレースフルデグラデーションを試行
        const degradationResult =
          GracefulDegradation.handleReleaseVersionDegradation(
            characterId,
            apiData,
            reason
          );

        if (degradationResult.success && degradationResult.version > 0) {
          logger.info(
            "グレースフルデグラデーションによる実装バージョン回復成功",
            {
              characterId,
              version: degradationResult.version,
              method: degradationResult.method,
              degradationLevel: degradationResult.degradationLevel,
            }
          );
          this.releaseVersionStatistics.recordSuccess(
            characterId,
            degradationResult.version,
            `degradation:${degradationResult.method}`
          );
          return degradationResult.version;
        }

        this.releaseVersionStatistics.recordFailure(characterId, reason);
        this.releaseVersionStatistics.recordDefaultUsed(characterId, reason);
        return 0;
      }

      logger.debug("baseInfoコンポーネントを発見", {
        characterId,
        componentId: baseInfoComponent.component_id,
        hasData: !!baseInfoComponent.data,
        dataLength: baseInfoComponent.data?.length || 0,
      });

      if (!baseInfoComponent.data) {
        const reason = "baseinfo_data_missing";
        logger.warn("baseInfoコンポーネントにdataが存在しません", {
          characterId,
          reason,
          componentId: baseInfoComponent.component_id,
          defaultVersion: 0,
        });
        this.releaseVersionStatistics.recordFailure(characterId, reason);
        this.releaseVersionStatistics.recordDefaultUsed(characterId, reason);
        return 0;
      }

      // baseInfoデータをパース
      let baseInfoData;
      try {
        baseInfoData = JSON.parse(baseInfoComponent.data);
        logger.debug("baseInfoデータのパース成功", {
          characterId,
          dataKeys: Object.keys(baseInfoData),
          listLength: baseInfoData.list?.length || 0,
        });
      } catch (parseError) {
        const errorMessage =
          parseError instanceof Error ? parseError.message : String(parseError);
        const reason = "json_parse_error";
        logger.error("baseInfoデータのパースに失敗", {
          characterId,
          error: errorMessage,
          dataPreview: baseInfoComponent.data.substring(0, 100),
          reason,
          defaultVersion: 0,
        });

        // グレースフルデグラデーションを試行
        const degradationResult =
          GracefulDegradation.handleReleaseVersionDegradation(
            characterId,
            apiData,
            reason
          );

        if (degradationResult.success && degradationResult.version > 0) {
          logger.info(
            "グレースフルデグラデーションによる実装バージョン回復成功",
            {
              characterId,
              version: degradationResult.version,
              method: degradationResult.method,
              degradationLevel: degradationResult.degradationLevel,
            }
          );
          this.releaseVersionStatistics.recordSuccess(
            characterId,
            degradationResult.version,
            `degradation:${degradationResult.method}`
          );
          return degradationResult.version;
        }

        this.releaseVersionStatistics.recordFailure(
          characterId,
          reason,
          errorMessage
        );
        this.releaseVersionStatistics.recordDefaultUsed(characterId, reason);
        return 0;
      }

      if (!baseInfoData.list || !Array.isArray(baseInfoData.list)) {
        const reason = "baseinfo_list_missing";
        logger.warn("baseInfoデータにlistが存在しません", {
          characterId,
          reason,
          baseInfoDataKeys: Object.keys(baseInfoData),
          listType: typeof baseInfoData.list,
          defaultVersion: 0,
        });
        this.releaseVersionStatistics.recordFailure(characterId, reason);
        this.releaseVersionStatistics.recordDefaultUsed(characterId, reason);
        return 0;
      }

      logger.debug("baseInfoリスト検索を開始", {
        characterId,
        listItemCount: baseInfoData.list.length,
        availableKeys: baseInfoData.list
          .map((item: any) => item.key)
          .filter(Boolean),
      });

      // 実装バージョンキーを検索
      const versionItem = baseInfoData.list.find(
        (item: any) => item.key === "実装バージョン"
      );

      if (!versionItem) {
        const reason = "version_key_not_found";
        logger.warn("実装バージョンキーが見つかりません", {
          characterId,
          reason,
          availableKeys: baseInfoData.list
            .map((item: any) => item.key)
            .filter(Boolean),
          searchedKey: "実装バージョン",
          defaultVersion: 0,
        });

        // グレースフルデグラデーションを試行
        const degradationResult =
          GracefulDegradation.handleReleaseVersionDegradation(
            characterId,
            apiData,
            reason
          );

        if (degradationResult.success && degradationResult.version > 0) {
          logger.info(
            "グレースフルデグラデーションによる実装バージョン回復成功",
            {
              characterId,
              version: degradationResult.version,
              method: degradationResult.method,
              degradationLevel: degradationResult.degradationLevel,
            }
          );
          this.releaseVersionStatistics.recordSuccess(
            characterId,
            degradationResult.version,
            `degradation:${degradationResult.method}`
          );
          return degradationResult.version;
        }

        this.releaseVersionStatistics.recordFailure(characterId, reason);
        this.releaseVersionStatistics.recordDefaultUsed(characterId, reason);
        return 0;
      }

      logger.debug("実装バージョンキーを発見", {
        characterId,
        versionItemId: versionItem.id,
        hasValue: !!versionItem.value,
        valueType: typeof versionItem.value,
        valueLength: Array.isArray(versionItem.value)
          ? versionItem.value.length
          : 0,
      });

      if (
        !versionItem.value ||
        !Array.isArray(versionItem.value) ||
        versionItem.value.length === 0
      ) {
        const reason = "invalid_version_value";
        logger.warn("実装バージョンの値が無効です", {
          characterId,
          reason,
          versionValue: versionItem.value,
          valueType: typeof versionItem.value,
          isArray: Array.isArray(versionItem.value),
          defaultVersion: 0,
        });
        this.releaseVersionStatistics.recordFailure(characterId, reason);
        this.releaseVersionStatistics.recordDefaultUsed(characterId, reason);
        return 0;
      }

      // HTMLタグを含むバージョン文字列を取得
      const versionString = versionItem.value[0];
      if (typeof versionString !== "string") {
        const reason = "version_value_not_string";
        logger.warn("実装バージョンの値が文字列ではありません", {
          characterId,
          reason,
          versionValue: versionString,
          valueType: typeof versionString,
          defaultVersion: 0,
        });
        this.releaseVersionStatistics.recordFailure(characterId, reason);
        this.releaseVersionStatistics.recordDefaultUsed(characterId, reason);
        return 0;
      }

      logger.debug("実装バージョン文字列を取得", {
        characterId,
        rawVersionString: versionString,
        stringLength: versionString.length,
        hasHtmlTags: /<[^>]*>/.test(versionString),
      });

      // バージョン解析ロジックを呼び出し
      const parsedVersion = this.parseVersionNumber(versionString);

      if (parsedVersion > 0) {
        logger.info("実装バージョン抽出成功", {
          characterId,
          rawVersion: versionString,
          parsedVersion,
          extractionTime: new Date().toISOString(),
          success: true,
        });
        this.releaseVersionStatistics.recordSuccess(
          characterId,
          parsedVersion,
          versionString
        );
      } else {
        const reason = "parse_returned_zero";
        logger.warn("実装バージョン解析でデフォルト値を使用", {
          characterId,
          rawVersion: versionString,
          parsedVersion,
          reason,
          defaultVersion: 0,
        });
        this.releaseVersionStatistics.recordFailure(characterId, reason);
        this.releaseVersionStatistics.recordDefaultUsed(characterId, reason);
      }

      return parsedVersion;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const reason = "unexpected_error";
      logger.error("実装バージョン処理中に予期しないエラーが発生", {
        error: errorMessage,
        characterId,
        errorType:
          error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
        defaultVersion: 0,
      });
      this.releaseVersionStatistics.recordFailure(
        characterId,
        reason,
        errorMessage
      );
      this.releaseVersionStatistics.recordDefaultUsed(characterId, reason);
      return 0;
    }
  }

  /**
   * バージョン文字列から数値を抽出
   * 要件: 2.2, 2.3
   */
  private parseVersionNumber(versionString: string): number {
    logger.debug("バージョン解析処理を開始", {
      originalString: versionString,
      stringLength: versionString.length,
      timestamp: new Date().toISOString(),
    });

    try {
      // HTMLタグを除去
      const cleanString = versionString.replace(/<[^>]*>/g, "");
      const htmlTagsRemoved = versionString !== cleanString;

      logger.debug("HTMLタグ除去処理完了", {
        originalString: versionString,
        cleanString,
        htmlTagsRemoved,
        removedContent: htmlTagsRemoved
          ? versionString.replace(cleanString, "")
          : null,
      });

      // Ver.X.Y 形式を抽出する正規表現
      const VERSION_PATTERN = /Ver\.(\d+\.\d+)/;
      const match = cleanString.match(VERSION_PATTERN);

      logger.debug("正規表現マッチング実行", {
        pattern: VERSION_PATTERN.source,
        cleanString,
        matchFound: !!match,
        matchedGroups: match ? match.length : 0,
        fullMatch: match ? match[0] : null,
        versionGroup: match ? match[1] : null,
      });

      if (!match || !match[1]) {
        logger.warn("バージョンパターンが見つかりません", {
          cleanString,
          originalString: versionString,
          pattern: VERSION_PATTERN.source,
          reason: "regex_no_match",
          suggestedFormats: ["Ver.1.0", "Ver.1.1", "Ver.2.0"],
          defaultValue: 0,
        });
        return 0;
      }

      // 数値変換
      const extractedVersion = match[1];
      const versionNumber = parseFloat(extractedVersion);

      logger.debug("数値変換処理", {
        extractedVersion,
        parsedNumber: versionNumber,
        isValidNumber: !isNaN(versionNumber),
        isFinite: isFinite(versionNumber),
        isPositive: versionNumber > 0,
      });

      if (isNaN(versionNumber)) {
        logger.error("バージョン数値変換に失敗", {
          extractedVersion,
          originalString: versionString,
          cleanString,
          parseFloatResult: versionNumber,
          reason: "parse_float_nan",
          defaultValue: 0,
        });
        return 0;
      }

      if (!isFinite(versionNumber)) {
        logger.error("バージョン数値が無限値です", {
          extractedVersion,
          originalString: versionString,
          parsedNumber: versionNumber,
          reason: "infinite_number",
          defaultValue: 0,
        });
        return 0;
      }

      if (versionNumber < 0) {
        logger.warn("バージョン数値が負の値です", {
          extractedVersion,
          originalString: versionString,
          parsedNumber: versionNumber,
          reason: "negative_version",
          defaultValue: 0,
        });
        return 0;
      }

      logger.info("バージョン解析成功", {
        originalString: versionString,
        cleanString,
        extractedVersion,
        parsedNumber: versionNumber,
        processingTime: new Date().toISOString(),
        success: true,
      });

      return versionNumber;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("バージョン解析中に予期しないエラーが発生", {
        error: errorMessage,
        versionString,
        errorType:
          error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
        defaultValue: 0,
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
   * 部分的なデータでキャラクター処理を実行（グレースフル劣化対応）
   * 要件: 6.1, 6.2, 6.3, 6.4
   */
  processCharacterDataWithPartialSupport(
    apiData: ApiResponse
  ): ProcessedData | null {
    const characterId = apiData.data?.page?.id || "unknown";

    logger.info("部分データ対応キャラクター処理を開始", {
      characterId,
      timestamp: new Date().toISOString(),
    });

    try {
      // まず通常の処理を試行
      return this.processCharacterData(apiData);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.warn("通常処理が失敗、部分データ処理に切り替え", {
        characterId,
        originalError: errorMessage,
        fallbackMethod: "partial_data_processing",
      });

      // 欠損フィールドを検出
      const missingFields =
        this.partialDataHandler.detectMissingFields(apiData);

      logger.info("データ欠損分析完了", {
        characterId,
        missingFields,
        missingCount: missingFields.length,
        dataCompleteness: this.calculateDataCompleteness(missingFields),
      });

      // 部分データ処理を実行
      const partialData = this.partialDataHandler.handlePartialData(
        apiData,
        missingFields
      );

      if (!partialData) {
        logger.error("部分データ処理も失敗", {
          characterId,
          missingFields,
          reason: "insufficient_data",
        });
        return null;
      }

      // 部分データの妥当性を検証
      const isValid = this.partialDataHandler.validatePartialData(
        partialData,
        characterId
      );

      if (!isValid) {
        logger.error("部分データ検証に失敗", {
          characterId,
          missingFields,
          reason: "validation_failed",
        });
        return null;
      }

      logger.info("部分データ処理成功", {
        characterId,
        missingFields,
        recoveredFields: this.getRecoveredFields(partialData),
        processingMethod: "graceful_degradation",
      });

      return partialData;
    }
  }

  /**
   * 欠損フィールドを検出してログに記録
   * 要件: 6.1, 6.4
   */
  detectAndLogMissingFields(apiData: ApiResponse): string[] {
    const characterId = apiData.data?.page?.id || "unknown";

    logger.debug("欠損フィールド検出を開始", {
      characterId,
      timestamp: new Date().toISOString(),
    });

    const missingFields = this.partialDataHandler.detectMissingFields(apiData);

    if (missingFields.length > 0) {
      logger.warn("データ欠損を検出", {
        characterId,
        missingFields,
        missingCount: missingFields.length,
        dataCompleteness: this.calculateDataCompleteness(missingFields),
        severity: this.assessDataLossSeverity(missingFields),
      });

      // 各欠損フィールドの詳細ログ
      missingFields.forEach((field) => {
        logger.debug("欠損フィールド詳細", {
          characterId,
          missingField: field,
          fieldType: this.getFieldType(field),
          isEssential: this.isEssentialField(field),
          fallbackAvailable: this.hasFallbackValue(field),
        });
      });
    } else {
      logger.debug("データ欠損なし", {
        characterId,
        dataCompleteness: "100%",
      });
    }

    return missingFields;
  }

  /**
   * 非必須フィールドに対するグレースフル劣化処理
   * 要件: 6.2, 6.3, 6.4
   */
  applyGracefulDegradation(
    apiData: ApiResponse,
    missingFields: string[]
  ): ProcessedData | null {
    const characterId = apiData.data?.page?.id || "unknown";

    logger.info("グレースフル劣化処理を開始", {
      characterId,
      missingFields,
      degradationLevel: this.assessDegradationLevel(missingFields),
    });

    try {
      // 必須フィールドの欠損チェック
      const essentialMissing = missingFields.filter((field) =>
        this.isEssentialField(field)
      );

      if (essentialMissing.length > 0) {
        logger.error("必須フィールドが欠損しているため処理を中止", {
          characterId,
          essentialMissing,
          reason: "essential_fields_missing",
        });
        return null;
      }

      // 部分データ処理を実行
      const partialData = this.partialDataHandler.handlePartialData(
        apiData,
        missingFields
      );

      if (!partialData) {
        logger.error("グレースフル劣化処理に失敗", {
          characterId,
          missingFields,
          reason: "partial_processing_failed",
        });
        return null;
      }

      // 劣化レベルに応じた追加処理
      const degradationLevel = this.assessDegradationLevel(missingFields);
      this.logDegradationDetails(characterId, degradationLevel, missingFields);

      logger.info("グレースフル劣化処理完了", {
        characterId,
        degradationLevel,
        appliedFallbacks: this.getAppliedFallbacks(missingFields),
        dataQuality: this.assessDataQuality(partialData),
      });

      return partialData;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("グレースフル劣化処理中にエラーが発生", {
        characterId,
        error: errorMessage,
        missingFields,
        degradationLevel: this.assessDegradationLevel(missingFields),
      });

      return null;
    }
  }

  /**
   * 支援タイプ統計情報を取得
   */
  public getAssistTypeStatistics(): AssistTypeStatistics {
    return this.assistTypeStatistics;
  }

  /**
   * 実装バージョン統計情報を取得
   */
  public getReleaseVersionStatistics(): ReleaseVersionStatistics {
    return this.releaseVersionStatistics;
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
   * 実装バージョン統計情報をログに出力
   */
  public logReleaseVersionStatistics(): void {
    logger.info("実装バージョン処理統計の出力を開始");
    this.releaseVersionStatistics.logStatistics();
    logger.info("実装バージョン処理統計の出力を完了");
  }

  /**
   * 統計情報をリセット
   */
  public resetStatistics(): void {
    this.assistTypeStatistics.reset();
    this.releaseVersionStatistics.reset();
    logger.debug("DataProcessor: 支援タイプ・実装バージョン統計情報をリセット");
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

  // 部分データ処理用のヘルパーメソッド

  /**
   * データ完全性を計算（パーセンテージ）
   */
  private calculateDataCompleteness(missingFields: string[]): string {
    const totalFields = 9; // page, filter_values, specialty, stats, rarity, faction, modules, ascension, baseInfo
    const missingCount = missingFields.length;
    const completeness = Math.max(
      0,
      ((totalFields - missingCount) / totalFields) * 100
    );
    return `${completeness.toFixed(1)}%`;
  }

  /**
   * データ損失の深刻度を評価
   */
  private assessDataLossSeverity(
    missingFields: string[]
  ): "low" | "medium" | "high" | "critical" {
    const essentialMissing = missingFields.filter((field) =>
      this.isEssentialField(field)
    );

    if (essentialMissing.length > 0) {
      return "critical";
    }

    if (missingFields.length >= 5) {
      return "high";
    }

    if (missingFields.length >= 3) {
      return "medium";
    }

    return "low";
  }

  /**
   * フィールドタイプを取得
   */
  private getFieldType(field: string): "structural" | "content" | "metadata" {
    const structuralFields = ["page", "filter_values", "modules"];
    const contentFields = [
      "specialty",
      "stats",
      "rarity",
      "faction",
      "ascension",
    ];
    const metadataFields = ["baseInfo"];

    if (structuralFields.includes(field)) {
      return "structural";
    }

    if (contentFields.includes(field)) {
      return "content";
    }

    return "metadata";
  }

  /**
   * 必須フィールドかどうかを判定
   */
  private isEssentialField(field: string): boolean {
    const essentialFields = ["page", "filter_values"];
    return essentialFields.includes(field);
  }

  /**
   * フォールバック値が利用可能かどうかを判定
   */
  private hasFallbackValue(field: string): boolean {
    const fallbackAvailableFields = [
      "specialty",
      "stats",
      "rarity",
      "faction",
      "ascension",
      "baseInfo",
    ];
    return fallbackAvailableFields.includes(field);
  }

  /**
   * 劣化レベルを評価
   */
  private assessDegradationLevel(
    missingFields: string[]
  ): "none" | "minimal" | "moderate" | "severe" {
    if (missingFields.length === 0) {
      return "none";
    }

    if (missingFields.length <= 2) {
      return "minimal";
    }

    if (missingFields.length <= 4) {
      return "moderate";
    }

    return "severe";
  }

  /**
   * 劣化詳細をログに記録
   */
  private logDegradationDetails(
    characterId: string,
    degradationLevel: string,
    missingFields: string[]
  ): void {
    logger.info("データ劣化詳細分析", {
      characterId,
      degradationLevel,
      missingFields,
      fieldAnalysis: missingFields.map((field) => ({
        field,
        type: this.getFieldType(field),
        essential: this.isEssentialField(field),
        fallbackAvailable: this.hasFallbackValue(field),
      })),
      recommendedAction: this.getRecommendedAction(degradationLevel),
    });
  }

  /**
   * 推奨アクションを取得
   */
  private getRecommendedAction(degradationLevel: string): string {
    switch (degradationLevel) {
      case "none":
        return "通常処理を継続";
      case "minimal":
        return "部分データ処理で対応可能";
      case "moderate":
        return "フォールバック値を適用して処理";
      case "severe":
        return "データ品質の確認が必要";
      default:
        return "処理方法を検討";
    }
  }

  /**
   * 回復されたフィールドを取得
   */
  private getRecoveredFields(partialData: ProcessedData): string[] {
    const recoveredFields: string[] = [];

    if (partialData.basicInfo) {
      recoveredFields.push("basicInfo");
    }

    if (partialData.factionInfo) {
      recoveredFields.push("factionInfo");
    }

    if (partialData.attributesInfo) {
      recoveredFields.push("attributesInfo");
    }

    if (partialData.assistType) {
      recoveredFields.push("assistType");
    }

    return recoveredFields;
  }

  /**
   * 適用されたフォールバックを取得
   */
  private getAppliedFallbacks(missingFields: string[]): string[] {
    return missingFields.filter((field) => this.hasFallbackValue(field));
  }

  /**
   * データ品質を評価
   */
  private assessDataQuality(
    partialData: ProcessedData
  ): "high" | "medium" | "low" {
    let qualityScore = 0;

    if (partialData.basicInfo) qualityScore += 40;
    if (partialData.factionInfo) qualityScore += 20;
    if (partialData.attributesInfo) qualityScore += 30;
    if (partialData.assistType) qualityScore += 10;

    if (qualityScore >= 80) return "high";
    if (qualityScore >= 50) return "medium";
    return "low";
  }

  /**
   * バージョン2.3キャラクター専用の処理（エラー回復機能付き）
   * 要件: 4.1, 4.2, 4.3, 4.4
   */
  async processVersion23CharacterWithRecovery(
    apiData: ApiResponse,
    characterId: string
  ): Promise<ProcessedData | null> {
    logger.info("バージョン2.3キャラクター処理開始（エラー回復機能付き）", {
      characterId,
      timestamp: new Date().toISOString(),
      processingMode: "version23_with_recovery",
    });

    try {
      // まず通常の処理を試行
      const processedData = this.processCharacterData(apiData);

      logger.info("バージョン2.3キャラクター通常処理成功", {
        characterId,
        processingResult: "normal_success",
        hasAssistType: !!processedData.assistType,
      });

      return processedData;
    } catch (error) {
      const originalError = error as Error;

      logger.warn("バージョン2.3キャラクター通常処理失敗、エラー回復を開始", {
        characterId,
        originalError: originalError.message,
        errorType: originalError.constructor.name,
        recoveryMode: "error_recovery_initiated",
      });

      // エラー分類と対応策決定
      const errorStrategy =
        this.errorRecoveryHandler.classifyErrorAndDetermineStrategy(
          originalError,
          characterId
        );

      logger.info("エラー分析完了", {
        characterId,
        errorClassification: errorStrategy,
        recoveryStrategy: errorStrategy.recoveryStrategy,
      });

      // 回復策に応じた処理
      switch (errorStrategy.recoveryStrategy) {
        case "partial_data_processing":
        case "graceful_degradation":
          return await this.errorRecoveryHandler.handlePartialProcessingFailure(
            apiData,
            originalError,
            characterId
          );

        case "skip_character":
          logger.warn("キャラクター処理をスキップ", {
            characterId,
            reason: errorStrategy.errorType,
            severity: errorStrategy.severity,
          });
          return null;

        case "abort_processing":
          logger.error("重大なエラーにより処理を中止", {
            characterId,
            errorType: errorStrategy.errorType,
            severity: errorStrategy.severity,
          });
          throw originalError;

        default:
          logger.warn("不明な回復策、キャラクターをスキップ", {
            characterId,
            recoveryStrategy: errorStrategy.recoveryStrategy,
          });
          return null;
      }
    }
  }

  /**
   * バージョン2.3キャラクターのバッチ処理（エラー分離機能付き）
   * 要件: 4.1, 4.2
   */
  async processVersion23CharactersBatch(
    characterDataList: Array<{ characterId: string; apiData: ApiResponse }>
  ): Promise<{
    results: Array<{
      characterId: string;
      data: ProcessedData | null;
      success: boolean;
      error?: string;
    }>;
    summary: {
      total: number;
      successful: number;
      failed: number;
      skipped: number;
      successRate: number;
    };
  }> {
    const results: Array<{
      characterId: string;
      data: ProcessedData | null;
      success: boolean;
      error?: string;
    }> = [];

    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;

    logger.info("バージョン2.3キャラクターバッチ処理開始", {
      totalCharacters: characterDataList.length,
      characterIds: characterDataList.map((item) => item.characterId),
      timestamp: new Date().toISOString(),
    });

    for (let i = 0; i < characterDataList.length; i++) {
      const { characterId, apiData } = characterDataList[i];
      const processingContext = {
        totalCharacters: characterDataList.length,
        processedCount: i + 1,
        successCount,
        failureCount,
      };

      try {
        logger.debug("個別キャラクター処理開始", {
          characterId,
          progress: `${i + 1}/${characterDataList.length}`,
          currentSuccessRate:
            i > 0 ? `${Math.round((successCount / i) * 100)}%` : "N/A",
        });

        const processedData = await this.processVersion23CharacterWithRecovery(
          apiData,
          characterId
        );

        if (processedData) {
          results.push({
            characterId,
            data: processedData,
            success: true,
          });
          successCount++;

          logger.info("個別キャラクター処理成功", {
            characterId,
            progress: `${i + 1}/${characterDataList.length}`,
            successCount,
            failureCount,
          });
        } else {
          results.push({
            characterId,
            data: null,
            success: false,
            error: "処理がスキップされました",
          });
          skippedCount++;

          logger.warn("個別キャラクター処理スキップ", {
            characterId,
            progress: `${i + 1}/${characterDataList.length}`,
            reason: "processing_skipped",
          });
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        results.push({
          characterId,
          data: null,
          success: false,
          error: errorMessage,
        });
        failureCount++;

        try {
          // 個別キャラクター失敗処理
          this.errorRecoveryHandler.handleIndividualCharacterFailure(
            characterId,
            error as Error,
            processingContext
          );
        } catch (batchError) {
          logger.error("バッチ処理中止", {
            characterId,
            batchError:
              batchError instanceof Error
                ? batchError.message
                : String(batchError),
            processedSoFar: i + 1,
            successCount,
            failureCount,
          });
          break;
        }
      }
    }

    const summary = {
      total: characterDataList.length,
      successful: successCount,
      failed: failureCount,
      skipped: skippedCount,
      successRate: Math.round((successCount / characterDataList.length) * 100),
    };

    logger.info("バージョン2.3キャラクターバッチ処理完了", {
      summary,
      processingTime: new Date().toISOString(),
      results: results.map((r) => ({
        characterId: r.characterId,
        success: r.success,
        hasData: !!r.data,
      })),
    });

    return { results, summary };
  }
}
