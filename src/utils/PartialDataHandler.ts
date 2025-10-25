import { ApiResponse } from "../types/api";
import {
  ProcessedData,
  BasicCharacterInfo,
  FactionInfo,
  AttributesInfo,
} from "../types/processing";
import {
  Character,
  Attributes,
  Specialty,
  Stats,
  Rarity,
  AssistType,
} from "../types/index";
import { logger } from "./Logger";

/**
 * 部分的なデータ欠損を処理するためのユーティリティクラス
 * 要件: 6.1, 6.2, 6.3
 */
export class PartialDataHandler {
  /**
   * APIレスポンスから欠損フィールドを検出
   * 要件: 6.1, 6.2
   */
  detectMissingFields(apiData: ApiResponse): string[] {
    const characterId = apiData.data?.page?.id || "unknown";
    const missingFields: string[] = [];

    logger.info("部分データ検出処理を開始", {
      characterId,
      timestamp: new Date().toISOString(),
      processingStep: "missing_field_detection",
    });

    try {
      const page = apiData.data?.page;

      if (!page) {
        missingFields.push("page");
        logger.warn("重要データ欠損: pageデータが存在しません", {
          characterId,
          missingField: "page",
          severity: "critical",
          impact: "processing_impossible",
        });
        return missingFields;
      }

      // filter_valuesの存在確認
      const filterValues = (page as any).filter_values;
      if (!filterValues) {
        missingFields.push("filter_values");
        logger.warn("重要データ欠損: filter_valuesが存在しません", {
          characterId,
          missingField: "filter_values",
          severity: "critical",
          impact: "basic_info_unavailable",
        });
        return missingFields;
      }

      // 基本フィールドの存在確認
      if (!filterValues.agent_specialties?.values?.[0]) {
        missingFields.push("specialty");
        logger.warn("基本データ欠損: 特技情報が見つかりません", {
          characterId,
          missingField: "specialty",
          severity: "moderate",
          impact: "empty_value_applied",
          fieldPath: "filter_values.agent_specialties.values[0]",
        });
      }

      if (!filterValues.agent_stats?.values?.[0]) {
        missingFields.push("stats");
        logger.warn("基本データ欠損: 属性情報が見つかりません", {
          characterId,
          missingField: "stats",
          severity: "moderate",
          impact: "empty_value_applied",
          fieldPath: "filter_values.agent_stats.values[0]",
        });
      }

      if (!filterValues.agent_rarity?.values?.[0]) {
        missingFields.push("rarity");
        logger.warn("基本データ欠損: レアリティ情報が見つかりません", {
          characterId,
          missingField: "rarity",
          severity: "moderate",
          impact: "empty_value_applied",
          fieldPath: "filter_values.agent_rarity.values[0]",
        });
      }

      if (!filterValues.agent_faction?.values?.[0]) {
        missingFields.push("faction");
        logger.warn("基本データ欠損: 陣営情報が見つかりません", {
          characterId,
          missingField: "faction",
          severity: "moderate",
          impact: "default_faction_applied",
          fieldPath: "filter_values.agent_faction.values[0]",
        });
      }

      // modulesの存在確認
      if (!page.modules || !Array.isArray(page.modules)) {
        missingFields.push("modules");
        logger.warn("構造データ欠損: modulesが存在しません", {
          characterId,
          missingField: "modules",
          severity: "high",
          impact: "attribute_data_unavailable",
          modulesType: typeof page.modules,
        });
      } else {
        logger.debug("modules構造を検証中", {
          characterId,
          moduleCount: page.modules.length,
          moduleNames: page.modules.map((m: any) => m.name).filter(Boolean),
        });

        // ascensionコンポーネントの存在確認
        const hasAscension = page.modules.some((module: any) =>
          module.components?.some(
            (comp: any) => comp.component_id === "ascension"
          )
        );

        if (!hasAscension) {
          missingFields.push("ascension");
          logger.warn(
            "属性データ欠損: ascensionコンポーネントが見つかりません",
            {
              characterId,
              missingField: "ascension",
              severity: "high",
              impact: "zero_attributes_applied",
              availableComponents: page.modules
                .flatMap((m: any) =>
                  m.components?.map((c: any) => c.component_id)
                )
                .filter(Boolean),
            }
          );
        }

        // baseInfoコンポーネントの存在確認
        const hasBaseInfo = page.modules.some((module: any) =>
          module.components?.some(
            (comp: any) => comp.component_id === "baseInfo"
          )
        );

        if (!hasBaseInfo) {
          missingFields.push("baseInfo");
          logger.warn(
            "メタデータ欠損: baseInfoコンポーネントが見つかりません",
            {
              characterId,
              missingField: "baseInfo",
              severity: "low",
              impact: "release_version_unavailable",
              availableComponents: page.modules
                .flatMap((m: any) =>
                  m.components?.map((c: any) => c.component_id)
                )
                .filter(Boolean),
            }
          );
        }
      }

      // 検出結果のサマリーログ
      const dataCompleteness = this.calculateDataCompleteness(missingFields);
      logger.info("部分データ検出完了", {
        characterId,
        missingFields,
        totalMissing: missingFields.length,
        dataCompleteness: `${dataCompleteness}%`,
        processingViability: this.assessProcessingViability(missingFields),
        timestamp: new Date().toISOString(),
      });

      return missingFields;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("欠損フィールド検出中にエラーが発生", {
        error: errorMessage,
        characterId,
        errorType:
          error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
        processingStep: "missing_field_detection",
      });

      // エラー時は全フィールドを欠損として扱う
      const allMissingFields = [
        "page",
        "filter_values",
        "specialty",
        "stats",
        "rarity",
        "faction",
        "modules",
        "ascension",
        "baseInfo",
      ];

      logger.warn("エラーにより全フィールドを欠損として扱います", {
        characterId,
        missingFields: allMissingFields,
        totalMissing: allMissingFields.length,
        dataCompleteness: "0%",
        processingViability: "impossible",
      });

      return allMissingFields;
    }
  }

  /**
   * 部分的なデータから処理可能なProcessedDataを生成
   * 要件: 6.1, 6.2, 6.3
   */
  handlePartialData(
    apiData: ApiResponse,
    missingFields: string[]
  ): ProcessedData | null {
    const characterId = apiData.data?.page?.id || "unknown";
    const processingStartTime = Date.now();

    logger.info("部分データ処理を開始", {
      characterId,
      missingFields,
      missingCount: missingFields.length,
      dataCompleteness: `${this.calculateDataCompleteness(missingFields)}%`,
      processingViability: this.assessProcessingViability(missingFields),
      timestamp: new Date().toISOString(),
      processingStep: "partial_data_processing",
    });

    try {
      // 最低限必要なフィールドの確認
      if (missingFields.includes("page")) {
        logger.error("重要データ欠損により処理を中止", {
          characterId,
          reason: "page_data_missing",
          severity: "critical",
          processingResult: "aborted",
        });
        return null;
      }

      if (missingFields.includes("filter_values")) {
        logger.error("重要データ欠損により処理を中止", {
          characterId,
          reason: "filter_values_missing",
          severity: "critical",
          processingResult: "aborted",
        });
        return null;
      }

      const page = apiData.data.page;

      // 基本情報の生成（部分的でも可能な限り）
      logger.debug("基本情報生成を開始", {
        characterId,
        processingStep: "basic_info_generation",
        missingBasicFields: missingFields.filter((f) =>
          ["specialty", "stats", "rarity"].includes(f)
        ),
      });

      const basicInfo = this.createPartialBasicInfo(page, missingFields);
      if (!basicInfo) {
        logger.error("基本情報の生成に失敗", {
          characterId,
          missingFields,
          reason: "basic_info_generation_failed",
          processingResult: "failed",
        });
        return null;
      }

      logger.info("基本情報生成成功", {
        characterId,
        hasId: !!basicInfo.id,
        hasName: !!basicInfo.name,
        hasSpecialty: !!basicInfo.specialty,
        hasStats: !!basicInfo.stats,
        hasRarity: !!basicInfo.rarity,
        releaseVersion: basicInfo.releaseVersion,
      });

      // 陣営情報の生成
      logger.debug("陣営情報生成を開始", {
        characterId,
        processingStep: "faction_info_generation",
        hasFactionMissing: missingFields.includes("faction"),
      });

      const factionInfo = this.createPartialFactionInfo(page, missingFields);

      logger.info("陣営情報生成完了", {
        characterId,
        factionId: factionInfo.id,
        factionName: factionInfo.name,
        isDefaultFaction: factionInfo.id === 0,
      });

      // 属性情報の生成
      logger.debug("属性情報生成を開始", {
        characterId,
        processingStep: "attributes_info_generation",
        hasAscensionMissing: missingFields.includes("ascension"),
        hasModulesMissing: missingFields.includes("modules"),
      });

      const attributesInfo = this.createPartialAttributesInfo(
        page,
        missingFields
      );

      logger.info("属性情報生成完了", {
        characterId,
        hasAttributesData: !!attributesInfo.ascensionData,
        isEmptyAttributes:
          attributesInfo.ascensionData === JSON.stringify({ list: [] }),
      });

      const processedData: ProcessedData = {
        basicInfo,
        factionInfo,
        attributesInfo,
        assistType: undefined, // 部分データでは支援タイプは取得しない
      };

      const processingTime = Date.now() - processingStartTime;

      logger.info("部分データ処理完了", {
        characterId,
        hasBasicInfo: !!basicInfo,
        hasFactionInfo: !!factionInfo,
        hasAttributesInfo: !!attributesInfo,
        processingTime: `${processingTime}ms`,
        recoveredFields: this.getRecoveredFields(processedData),
        appliedDefaults: this.getAppliedDefaults(processedData, missingFields),
        processingResult: "success",
        timestamp: new Date().toISOString(),
      });

      return processedData;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const processingTime = Date.now() - processingStartTime;

      logger.error("部分データ処理中にエラーが発生", {
        characterId,
        error: errorMessage,
        errorType:
          error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
        missingFields,
        processingTime: `${processingTime}ms`,
        processingStep: "partial_data_processing",
        processingResult: "error",
      });
      return null;
    }
  }

  /**
   * 部分的なCharacterオブジェクトを生成
   * 要件: 6.1, 6.2, 6.3
   */
  createPartialCharacter(
    partialData: Partial<ProcessedData>
  ): Character | null {
    if (!partialData.basicInfo) {
      logger.warn("基本情報が不足しているためCharacter生成を中止");
      return null;
    }

    const characterId = partialData.basicInfo.id;

    try {
      // 空の値を取得
      const emptyValues = this.getEmptyValues(characterId);

      // 基本的なCharacterオブジェクトを構築
      const character: Character = {
        id: partialData.basicInfo.id,
        name: this.parseMultilingualName(partialData.basicInfo.name),
        fullName: this.parseMultilingualName(partialData.basicInfo.name), // 部分データではnameと同じ
        specialty:
          this.mapSpecialty(partialData.basicInfo.specialty) ||
          emptyValues.specialty!,
        stats: this.mapStats(partialData.basicInfo.stats) || emptyValues.stats!,
        faction: partialData.factionInfo?.id || emptyValues.faction!,
        rarity:
          this.mapRarity(partialData.basicInfo.rarity) || emptyValues.rarity!,
        attr:
          this.parseAttributes(partialData.attributesInfo) || emptyValues.attr!,
        assistType: partialData.assistType || emptyValues.assistType,
        releaseVersion:
          partialData.basicInfo.releaseVersion || emptyValues.releaseVersion,
      };

      logger.info("部分的なCharacterオブジェクト生成完了", {
        characterId,
        hasSpecialty: !!character.specialty,
        hasStats: character.stats.length > 0,
        hasFaction: !!character.faction,
        hasRarity: !!character.rarity,
      });

      return character;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("部分的なCharacter生成中にエラーが発生", {
        characterId,
        error: errorMessage,
      });
      return null;
    }
  }

  /**
   * キャラクターIDに基づいて適切な空の値を生成
   * 要件: 6.2, 6.3
   */
  getEmptyValues(characterId: string): Partial<Character> {
    const emptyAttributes: Attributes = {
      hp: [],
      atk: [],
      def: [],
      impact: 0,
      critRate: 0,
      critDmg: 0,
      anomalyMastery: 0,
      anomalyProficiency: 0,
      penRatio: 0,
      energy: 0,
    };

    return {
      specialty: undefined,
      stats: [],
      assistType: undefined,
      faction: 0, // デフォルト陣営ID
      rarity: undefined,
      attr: emptyAttributes,
      releaseVersion: 2.3, // version 2.3キャラクター用のデフォルト値
    };
  }

  /**
   * 部分的なデータの妥当性を検証
   * 要件: 6.3
   */
  validatePartialData(
    data: Partial<ProcessedData>,
    characterId: string
  ): boolean {
    try {
      // 最低限必要なフィールドの確認
      if (!data.basicInfo) {
        logger.warn("基本情報が不足", { characterId });
        return false;
      }

      if (!data.basicInfo.id) {
        logger.warn("キャラクターIDが不足", { characterId });
        return false;
      }

      if (!data.basicInfo.name) {
        logger.warn("キャラクター名が不足", { characterId });
        return false;
      }

      logger.debug("部分データ検証完了", {
        characterId,
        hasBasicInfo: !!data.basicInfo,
        hasFactionInfo: !!data.factionInfo,
        hasAttributesInfo: !!data.attributesInfo,
      });

      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("部分データ検証中にエラーが発生", {
        characterId,
        error: errorMessage,
      });
      return false;
    }
  }

  /**
   * 欠損フィールドに空の値を適用してCharacterオブジェクトを完成
   * 要件: 6.2, 6.3
   */
  fillMissingFieldsWithEmpty(character: Partial<Character>): Character {
    const characterId = character.id || "unknown";
    const emptyValues = this.getEmptyValues(characterId);

    const filledCharacter: Character = {
      id: character.id || characterId,
      name: character.name || { ja: characterId, en: characterId },
      fullName: character.fullName ||
        character.name || { ja: characterId, en: characterId },
      specialty: character.specialty || emptyValues.specialty!,
      stats: character.stats || emptyValues.stats!,
      faction: character.faction || emptyValues.faction!,
      rarity: character.rarity || emptyValues.rarity!,
      attr: character.attr || emptyValues.attr!,
      assistType: character.assistType || emptyValues.assistType,
      releaseVersion: character.releaseVersion || emptyValues.releaseVersion,
    };

    // 適用された空の値をログに記録
    const appliedEmptyFields: string[] = [];
    if (!character.specialty) appliedEmptyFields.push("specialty");
    if (!character.stats || character.stats.length === 0)
      appliedEmptyFields.push("stats");
    if (!character.faction) appliedEmptyFields.push("faction");
    if (!character.rarity) appliedEmptyFields.push("rarity");
    if (!character.attr) appliedEmptyFields.push("attr");
    if (!character.assistType) appliedEmptyFields.push("assistType");
    if (!character.releaseVersion) appliedEmptyFields.push("releaseVersion");

    if (appliedEmptyFields.length > 0) {
      logger.warn("欠損フィールドに空の値を適用", {
        characterId,
        appliedEmptyFields,
        emptyFieldCount: appliedEmptyFields.length,
      });
    }

    return filledCharacter;
  }

  /**
   * データ完全性を計算（パーセンテージ）
   * 要件: 6.1, 6.4
   */
  private calculateDataCompleteness(missingFields: string[]): number {
    const totalFields = [
      "page",
      "filter_values",
      "specialty",
      "stats",
      "rarity",
      "faction",
      "modules",
      "ascension",
      "baseInfo",
    ];

    const availableFields = totalFields.length - missingFields.length;
    return Math.round((availableFields / totalFields.length) * 100);
  }

  /**
   * 処理可能性を評価
   * 要件: 6.1, 6.2
   */
  private assessProcessingViability(missingFields: string[]): string {
    const criticalFields = ["page", "filter_values"];
    const hasCriticalMissing = criticalFields.some((field) =>
      missingFields.includes(field)
    );

    if (hasCriticalMissing) {
      return "impossible";
    }

    const basicFields = ["specialty", "stats", "rarity", "faction"];
    const missingBasicCount = basicFields.filter((field) =>
      missingFields.includes(field)
    ).length;

    if (missingBasicCount === 0) {
      return "full";
    } else if (missingBasicCount <= 2) {
      return "partial";
    } else {
      return "minimal";
    }
  }

  /**
   * 回復されたフィールドを取得
   * 要件: 6.1, 6.4
   */
  private getRecoveredFields(processedData: ProcessedData): string[] {
    const recoveredFields: string[] = [];

    if (processedData.basicInfo) {
      if (processedData.basicInfo.id) recoveredFields.push("id");
      if (processedData.basicInfo.name) recoveredFields.push("name");
      if (processedData.basicInfo.specialty) recoveredFields.push("specialty");
      if (processedData.basicInfo.stats) recoveredFields.push("stats");
      if (processedData.basicInfo.rarity) recoveredFields.push("rarity");
      if (processedData.basicInfo.releaseVersion)
        recoveredFields.push("releaseVersion");
    }

    if (processedData.factionInfo) {
      recoveredFields.push("faction");
    }

    if (processedData.attributesInfo) {
      recoveredFields.push("attributes");
    }

    return recoveredFields;
  }

  /**
   * 適用されたデフォルト値を取得
   * 要件: 6.1, 6.4
   */
  private getAppliedDefaults(
    processedData: ProcessedData,
    missingFields: string[]
  ): string[] {
    const appliedDefaults: string[] = [];

    if (
      missingFields.includes("specialty") &&
      processedData.basicInfo?.specialty === ""
    ) {
      appliedDefaults.push("specialty");
    }

    if (
      missingFields.includes("stats") &&
      processedData.basicInfo?.stats === ""
    ) {
      appliedDefaults.push("stats");
    }

    if (
      missingFields.includes("rarity") &&
      processedData.basicInfo?.rarity === ""
    ) {
      appliedDefaults.push("rarity");
    }

    if (
      missingFields.includes("faction") &&
      processedData.factionInfo?.id === 0
    ) {
      appliedDefaults.push("faction");
    }

    if (
      missingFields.includes("ascension") &&
      processedData.attributesInfo?.ascensionData ===
        JSON.stringify({ list: [] })
    ) {
      appliedDefaults.push("attributes");
    }

    return appliedDefaults;
  }

  // プライベートヘルパーメソッド

  private createPartialBasicInfo(
    page: any,
    missingFields: string[]
  ): BasicCharacterInfo | null {
    try {
      const filterValues = page.filter_values;

      return {
        id: page.id,
        name: page.name,
        specialty: missingFields.includes("specialty")
          ? ""
          : filterValues?.agent_specialties?.values?.[0] || "",
        stats: missingFields.includes("stats")
          ? ""
          : filterValues?.agent_stats?.values?.[0] || "",
        rarity: missingFields.includes("rarity")
          ? ""
          : filterValues?.agent_rarity?.values?.[0] || "",
        releaseVersion: 2.3, // version 2.3キャラクター用のデフォルト値
      };
    } catch (error) {
      logger.error("部分的な基本情報生成に失敗", {
        characterId: page?.id || "unknown",
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private createPartialFactionInfo(
    page: any,
    missingFields: string[]
  ): FactionInfo {
    if (missingFields.includes("faction")) {
      return {
        id: 0, // デフォルト陣営ID
        name: "不明", // デフォルト陣営名
      };
    }

    try {
      const filterValues = page.filter_values;
      const factionName = filterValues?.agent_faction?.values?.[0] || "不明";

      return {
        id: 0, // 実際の陣営IDマッピングは後で処理
        name: factionName,
      };
    } catch (error) {
      logger.error("部分的な陣営情報生成に失敗", {
        characterId: page?.id || "unknown",
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        id: 0,
        name: "不明",
      };
    }
  }

  private createPartialAttributesInfo(
    page: any,
    missingFields: string[]
  ): AttributesInfo {
    if (
      missingFields.includes("ascension") ||
      missingFields.includes("modules")
    ) {
      return {
        ascensionData: JSON.stringify({ list: [] }), // 空のascensionデータ
      };
    }

    try {
      // ascensionコンポーネントを探す
      const ascensionComponent = page.modules
        ?.find((module: any) =>
          module.components?.find(
            (comp: any) => comp.component_id === "ascension"
          )
        )
        ?.components?.find((comp: any) => comp.component_id === "ascension");

      if (ascensionComponent?.data) {
        return {
          ascensionData: ascensionComponent.data,
        };
      }
    } catch (error) {
      logger.error("部分的な属性情報生成に失敗", {
        characterId: page?.id || "unknown",
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      ascensionData: JSON.stringify({ list: [] }), // 空のascensionデータ
    };
  }

  private parseMultilingualName(name: string): { ja: string; en: string } {
    // 簡単な実装：実際の多言語名解析は別途実装が必要
    return {
      ja: name,
      en: name,
    };
  }

  private mapSpecialty(specialty: string): Specialty | undefined {
    const specialtyMap: { [key: string]: Specialty } = {
      撃破: "stun",
      強攻: "attack",
      異常: "anomaly",
      支援: "support",
      防護: "defense",
      命破: "rupture",
    };

    return specialtyMap[specialty];
  }

  private mapStats(stats: string): Stats[] {
    const statsMap: { [key: string]: Stats } = {
      氷属性: "ice",
      炎属性: "fire",
      電気属性: "electric",
      物理属性: "physical",
      エーテル属性: "ether",
      霜烈: "frost",
      玄墨: "auricInk",
    };

    const mappedStat = statsMap[stats];
    return mappedStat ? [mappedStat] : [];
  }

  private mapRarity(rarity: string): Rarity | undefined {
    if (rarity === "A" || rarity === "S") {
      return rarity as Rarity;
    }
    return undefined;
  }

  private parseAttributes(
    attributesInfo?: AttributesInfo
  ): Attributes | undefined {
    if (!attributesInfo?.ascensionData) {
      return undefined;
    }

    try {
      const ascensionData = JSON.parse(attributesInfo.ascensionData);

      if (!ascensionData.list || !Array.isArray(ascensionData.list)) {
        return undefined;
      }

      // 簡単な実装：実際の属性解析は既存のロジックを使用
      // ここでは空の属性を返す
      return {
        hp: [],
        atk: [],
        def: [],
        impact: 0,
        critRate: 0,
        critDmg: 0,
        anomalyMastery: 0,
        anomalyProficiency: 0,
        penRatio: 0,
        energy: 0,
      };
    } catch (error) {
      logger.error("属性データ解析に失敗", {
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }
}
