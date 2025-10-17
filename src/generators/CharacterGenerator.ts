import { Character } from "../types";
import { ProcessedData, ValidationResult } from "../types/processing";
import { DataMapper } from "../mappers/DataMapper";
import { AttributesProcessor } from "../processors/AttributesProcessor";
import { PartialDataHandler } from "../utils/PartialDataHandler";
import { ValidationError, ParsingError } from "../errors";
import { logger, LogMessages } from "../utils/Logger";
import * as fs from "fs";

/**
 * キャラクタージェネレーター - 最終的な Character オブジェクトの生成と出力
 * 要件: 5.1, 5.3, 5.4, 5.5
 */
export class CharacterGenerator {
  private dataMapper: DataMapper;
  private attributesProcessor: AttributesProcessor;
  private partialDataHandler: PartialDataHandler;

  constructor() {
    this.dataMapper = new DataMapper();
    this.attributesProcessor = new AttributesProcessor();
    this.partialDataHandler = new PartialDataHandler();
  }

  /**
   * Character オブジェクト生成機能を実装
   * 処理済みデータから Character オブジェクトを構築
   * 事前定義された名前マッピングを優先使用し、フォールバック処理を実装
   * 要件: 5.1, 5.3, 5.4, 1.1, 1.4, 2.2, 2.4
   */
  generateCharacter(
    jaData: ProcessedData,
    enData: ProcessedData,
    characterId: string
  ): Character {
    try {
      logger.debug(LogMessages.CHARACTER_GENERATION_START, { characterId });

      // 入力データの検証
      if (!jaData) {
        throw new ValidationError("日本語データが存在しません");
      }
      if (!enData) {
        throw new ValidationError("英語データが存在しません");
      }
      if (!jaData.basicInfo) {
        throw new ValidationError("日本語の基本情報が存在しません");
      }
      if (!enData.basicInfo) {
        throw new ValidationError("英語の基本情報が存在しません");
      }
      if (!jaData.factionInfo) {
        throw new ValidationError("陣営情報が存在しません");
      }
      if (!jaData.attributesInfo) {
        throw new ValidationError("属性情報が存在しません");
      }
      if (!characterId || characterId.trim() === "") {
        throw new ValidationError("キャラクターIDが指定されていません");
      }

      // 基本情報のマッピング
      const specialty = this.dataMapper.mapSpecialty(
        jaData.basicInfo.specialty
      );
      const stats = this.dataMapper.mapStats(jaData.basicInfo.stats);
      const rarity = this.dataMapper.mapRarity(jaData.basicInfo.rarity);

      // fullName: Wikiから取得した生のAPI名を常に使用
      const fullName = this.dataMapper.createMultiLangName(
        jaData.basicInfo.name,
        enData.basicInfo.name
      );

      // name: Scraping.mdの値（名前マッピング）を優先使用、フォールバックでAPI名
      const name = this.dataMapper.createNamesWithFallback(
        characterId,
        jaData.basicInfo.name,
        enData.basicInfo.name
      );

      // 属性データの処理
      const attributes = this.attributesProcessor.processAscensionData(
        jaData.attributesInfo.ascensionData
      );

      // Character オブジェクトを構築
      const character: Character = {
        id: characterId, // 明示的に受け取ったキャラクターIDを使用
        name,
        fullName,
        specialty,
        stats,
        faction: jaData.factionInfo.id, // 陣営ID
        rarity,
        attr: attributes,
        releaseVersion: jaData.basicInfo.releaseVersion || 0, // 実装バージョン（デフォルト: 0）
      };

      logger.debug(LogMessages.CHARACTER_GENERATION_SUCCESS, {
        characterId: character.id,
      });
      return character;
    } catch (error) {
      logger.error(LogMessages.CHARACTER_GENERATION_ERROR, {
        characterId,
        error: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(
        "Characterオブジェクトの生成に失敗しました",
        error as Error
      );
    }
  }

  /**
   * 部分データからCharacterオブジェクトを生成
   * 欠損フィールドに対してグレースフル劣化処理を適用
   * 要件: 6.1, 6.2, 6.3, 6.4
   */
  generateCharacterFromPartialData(
    partialData: Partial<ProcessedData>,
    characterId: string,
    missingFields: string[] = []
  ): Character | null {
    try {
      logger.info("部分データからのCharacter生成を開始", {
        characterId,
        missingFields,
        missingCount: missingFields.length,
      });

      // 部分データの妥当性検証
      if (
        !this.partialDataHandler.validatePartialData(partialData, characterId)
      ) {
        logger.warn("部分データの検証に失敗", { characterId, missingFields });
        return null;
      }

      // 最低限必要なデータの確認
      if (!partialData.basicInfo) {
        logger.warn("基本情報が不足しているためCharacter生成を中止", {
          characterId,
        });
        return null;
      }

      // 空の値を取得
      const emptyValues = this.partialDataHandler.getEmptyValues(characterId);

      // 基本情報の処理（フォールバック付き）
      const name = this.processPartialName(
        partialData.basicInfo.name,
        characterId
      );
      const fullName = name; // 部分データではnameと同じ

      // 特技のマッピング（フォールバック付き）
      let specialty = undefined;
      if (
        partialData.basicInfo.specialty &&
        !missingFields.includes("specialty")
      ) {
        specialty = this.dataMapper.mapSpecialty(
          partialData.basicInfo.specialty
        );
      }
      if (!specialty) {
        specialty = emptyValues.specialty;
        logger.warn("特技データが欠損、空の値を適用", {
          characterId,
          originalValue: partialData.basicInfo.specialty,
          appliedValue: specialty,
        });
      }

      // 属性のマッピング（フォールバック付き）
      let stats: import("../types").Stats[] = [];
      if (partialData.basicInfo.stats && !missingFields.includes("stats")) {
        try {
          stats = this.dataMapper.mapStats(partialData.basicInfo.stats);
        } catch (error) {
          logger.warn("属性マッピングに失敗、空の値を適用", {
            characterId,
            originalValue: partialData.basicInfo.stats,
            error: error instanceof Error ? error.message : String(error),
          });
          stats = [];
        }
      }
      if (!stats || stats.length === 0) {
        stats = emptyValues.stats || [];
        logger.warn("属性データが欠損、空の値を適用", {
          characterId,
          originalValue: partialData.basicInfo.stats,
          appliedValue: stats,
        });
      }

      // レアリティのマッピング（フォールバック付き）
      let rarity = undefined;
      if (partialData.basicInfo.rarity && !missingFields.includes("rarity")) {
        rarity = this.dataMapper.mapRarity(partialData.basicInfo.rarity);
      }
      if (!rarity) {
        rarity = emptyValues.rarity;
        logger.warn("レアリティデータが欠損、空の値を適用", {
          characterId,
          originalValue: partialData.basicInfo.rarity,
          appliedValue: rarity,
        });
      }

      // 陣営情報の処理（フォールバック付き）
      let faction = 0;
      if (partialData.factionInfo && !missingFields.includes("faction")) {
        faction = partialData.factionInfo.id;
      }
      if (!faction) {
        faction = emptyValues.faction || 0;
        logger.warn("陣営データが欠損、空の値を適用", {
          characterId,
          appliedValue: faction,
        });
      }

      // 属性データの処理（フォールバック付き）
      let attributes = emptyValues.attr;
      if (partialData.attributesInfo && !missingFields.includes("ascension")) {
        try {
          attributes = this.attributesProcessor.processAscensionData(
            partialData.attributesInfo.ascensionData
          );
        } catch (error) {
          logger.warn("属性データの処理に失敗、空の値を適用", {
            characterId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Characterオブジェクトを構築
      const character: Character = {
        id: characterId,
        name,
        fullName,
        specialty: specialty!,
        stats,
        faction,
        rarity: rarity!,
        attr: attributes!,
        assistType: partialData.assistType || emptyValues.assistType,
        releaseVersion:
          partialData.basicInfo.releaseVersion || emptyValues.releaseVersion,
      };

      // 欠損フィールドに空の値を適用
      const filledCharacter =
        this.partialDataHandler.fillMissingFieldsWithEmpty(character);

      logger.info("部分データからのCharacter生成完了", {
        characterId,
        hasSpecialty: !!filledCharacter.specialty,
        hasStats: filledCharacter.stats.length > 0,
        hasFaction: !!filledCharacter.faction,
        hasRarity: !!filledCharacter.rarity,
        missingFieldsCount: missingFields.length,
      });

      return filledCharacter;
    } catch (error) {
      logger.error("部分データからのCharacter生成中にエラーが発生", {
        characterId,
        error: error instanceof Error ? error.message : String(error),
        missingFields,
      });
      return null;
    }
  }

  /**
   * 部分データから名前情報を処理
   * フォールバック機能付き
   */
  private processPartialName(
    apiName: string,
    characterId: string
  ): { ja: string; en: string } {
    try {
      // 名前マッピングを優先使用
      const mappedName = this.dataMapper.createNamesWithFallback(
        characterId,
        apiName,
        apiName // 部分データでは英語名も同じ
      );
      return mappedName;
    } catch (error) {
      logger.warn("名前マッピング処理に失敗、フォールバック名を使用", {
        characterId,
        apiName,
        error: error instanceof Error ? error.message : String(error),
      });

      // フォールバック: キャラクターIDを名前として使用
      return {
        ja: characterId,
        en: characterId,
      };
    }
  }

  /**
   * データ検証機能を実装
   * 必須フィールドの存在確認
   * 数値配列の長さ検証（HP、ATK、DEF 配列が 7 要素）
   * 列挙値の妥当性確認
   * 多言語オブジェクトの完全性確認
   * 要件: 6.1, 6.2, 6.3, 6.4, 6.5
   */
  validateCharacter(
    character: Character,
    allowPartialData: boolean = false
  ): ValidationResult {
    const errors: string[] = [];

    // 必須フィールドの存在確認（部分データモードでは緩和）
    if (!character.id || character.id.trim() === "") {
      errors.push("id フィールドが空または存在しません");
    }

    if (!character.name) {
      errors.push("name フィールドが存在しません");
    }

    if (!character.fullName) {
      errors.push("fullName フィールドが存在しません");
    }

    // 部分データモードでは、以下のフィールドは警告のみ
    if (!character.specialty) {
      if (allowPartialData) {
        logger.warn("specialty フィールドが存在しません（部分データモード）", {
          characterId: character.id,
        });
      } else {
        errors.push("specialty フィールドが存在しません");
      }
    }

    if (
      !character.stats ||
      (Array.isArray(character.stats) && character.stats.length === 0)
    ) {
      if (allowPartialData) {
        logger.warn(
          "stats フィールドが存在しないか空です（部分データモード）",
          {
            characterId: character.id,
          }
        );
      } else {
        errors.push("stats フィールドが存在しません");
      }
    }

    if (character.faction === undefined || character.faction === null) {
      if (allowPartialData) {
        logger.warn("faction フィールドが存在しません（部分データモード）", {
          characterId: character.id,
        });
      } else {
        errors.push("faction フィールドが存在しません");
      }
    }

    if (!character.rarity) {
      if (allowPartialData) {
        logger.warn("rarity フィールドが存在しません（部分データモード）", {
          characterId: character.id,
        });
      } else {
        errors.push("rarity フィールドが存在しません");
      }
    }

    if (!character.attr) {
      errors.push("attr フィールドが存在しません");
    }

    // releaseVersion フィールドの検証
    if (
      character.releaseVersion !== undefined &&
      character.releaseVersion !== null
    ) {
      if (
        typeof character.releaseVersion !== "number" ||
        isNaN(character.releaseVersion)
      ) {
        errors.push("releaseVersion は有効な数値である必要があります");
      }
      if (character.releaseVersion < 0) {
        errors.push("releaseVersion は0以上の値である必要があります");
      }
    }

    // 多言語オブジェクトの完全性確認
    if (character.name) {
      if (!character.name.ja || character.name.ja.trim() === "") {
        errors.push("name.ja が空または存在しません");
      }
      if (!character.name.en || character.name.en.trim() === "") {
        errors.push("name.en が空または存在しません");
      }
    }

    if (character.fullName) {
      if (!character.fullName.ja || character.fullName.ja.trim() === "") {
        errors.push("fullName.ja が空または存在しません");
      }
      if (!character.fullName.en || character.fullName.en.trim() === "") {
        errors.push("fullName.en が空または存在しません");
      }
    }

    // 数値配列の長さ検証（HP、ATK、DEF 配列が 7 要素）
    if (character.attr) {
      if (!Array.isArray(character.attr.hp) || character.attr.hp.length !== 7) {
        errors.push("attr.hp 配列は正確に 7 つの値を含む必要があります");
      }
      if (
        !Array.isArray(character.attr.atk) ||
        character.attr.atk.length !== 7
      ) {
        errors.push("attr.atk 配列は正確に 7 つの値を含む必要があります");
      }
      if (
        !Array.isArray(character.attr.def) ||
        character.attr.def.length !== 7
      ) {
        errors.push("attr.def 配列は正確に 7 つの値を含む必要があります");
      }

      // 固定ステータスの数値確認
      const fixedStats = [
        "impact",
        "critRate",
        "critDmg",
        "anomalyMastery",
        "anomalyProficiency",
        "penRatio",
        "energy",
      ];
      fixedStats.forEach((stat) => {
        const value = (character.attr as any)[stat];
        if (typeof value !== "number" || isNaN(value)) {
          errors.push(`attr.${stat} は有効な数値である必要があります`);
        }
      });
    }

    // 列挙値の妥当性確認
    const validSpecialties = [
      "attack",
      "stun",
      "anomaly",
      "support",
      "defense",
      "rupture",
    ];
    if (
      character.specialty &&
      !validSpecialties.includes(character.specialty)
    ) {
      errors.push(
        `specialty "${character.specialty}" は有効な値ではありません`
      );
    }

    const validStats = [
      "ether",
      "fire",
      "ice",
      "physical",
      "electric",
      "frost",
      "auricInk",
    ];
    if (character.stats) {
      if (!Array.isArray(character.stats) || character.stats.length === 0) {
        errors.push(`stats は空でない配列である必要があります`);
      } else {
        for (const stat of character.stats) {
          if (!validStats.includes(stat)) {
            errors.push(`stats "${stat}" は有効な値ではありません`);
          }
        }
      }
    }

    const validRarities = ["A", "S"];
    if (character.rarity && !validRarities.includes(character.rarity)) {
      errors.push(`rarity "${character.rarity}" は有効な値ではありません`);
    }

    const result = {
      isValid: errors.length === 0,
      errors,
    };

    // 検証失敗時の詳細ログ
    if (!result.isValid) {
      console.warn("Character検証エラー:", errors);
    }

    return result;
  }

  /**
   * 部分データ用の設定可能な検証ルールを適用
   * 要件: 6.1, 6.2, 6.3, 6.4
   */
  validatePartialCharacter(
    character: Character,
    requiredFields: string[] = ["id", "name", "attr"],
    optionalFields: string[] = ["specialty", "stats", "faction", "rarity"]
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      logger.debug("部分データ検証を開始", {
        characterId: character.id,
        requiredFields,
        optionalFields,
      });

      // 必須フィールドの検証
      for (const field of requiredFields) {
        switch (field) {
          case "id":
            if (!character.id || character.id.trim() === "") {
              errors.push("id フィールドが空または存在しません");
            }
            break;
          case "name":
            if (!character.name) {
              errors.push("name フィールドが存在しません");
            } else {
              if (!character.name.ja || character.name.ja.trim() === "") {
                errors.push("name.ja が空または存在しません");
              }
              if (!character.name.en || character.name.en.trim() === "") {
                errors.push("name.en が空または存在しません");
              }
            }
            break;
          case "attr":
            if (!character.attr) {
              errors.push("attr フィールドが存在しません");
            } else {
              // 属性配列の基本検証
              if (
                !Array.isArray(character.attr.hp) ||
                character.attr.hp.length !== 7
              ) {
                errors.push(
                  "attr.hp 配列は正確に 7 つの値を含む必要があります"
                );
              }
              if (
                !Array.isArray(character.attr.atk) ||
                character.attr.atk.length !== 7
              ) {
                errors.push(
                  "attr.atk 配列は正確に 7 つの値を含む必要があります"
                );
              }
              if (
                !Array.isArray(character.attr.def) ||
                character.attr.def.length !== 7
              ) {
                errors.push(
                  "attr.def 配列は正確に 7 つの値を含む必要があります"
                );
              }
            }
            break;
        }
      }

      // オプショナルフィールドの検証（警告のみ）
      for (const field of optionalFields) {
        switch (field) {
          case "specialty":
            if (!character.specialty) {
              warnings.push(
                "specialty フィールドが存在しません（オプショナル）"
              );
            } else {
              const validSpecialties = [
                "attack",
                "stun",
                "anomaly",
                "support",
                "defense",
                "rupture",
              ];
              if (!validSpecialties.includes(character.specialty)) {
                warnings.push(
                  `specialty "${character.specialty}" は有効な値ではありません`
                );
              }
            }
            break;
          case "stats":
            if (
              !character.stats ||
              (Array.isArray(character.stats) && character.stats.length === 0)
            ) {
              warnings.push(
                "stats フィールドが存在しないか空です（オプショナル）"
              );
            } else {
              const validStats = [
                "ether",
                "fire",
                "ice",
                "physical",
                "electric",
                "frost",
                "auricInk",
              ];
              for (const stat of character.stats) {
                if (!validStats.includes(stat)) {
                  warnings.push(`stats "${stat}" は有効な値ではありません`);
                }
              }
            }
            break;
          case "faction":
            if (character.faction === undefined || character.faction === null) {
              warnings.push("faction フィールドが存在しません（オプショナル）");
            }
            break;
          case "rarity":
            if (!character.rarity) {
              warnings.push("rarity フィールドが存在しません（オプショナル）");
            } else {
              const validRarities = ["A", "S"];
              if (!validRarities.includes(character.rarity)) {
                warnings.push(
                  `rarity "${character.rarity}" は有効な値ではありません`
                );
              }
            }
            break;
        }
      }

      const result = {
        isValid: errors.length === 0,
        errors,
        warnings,
      };

      logger.debug("部分データ検証完了", {
        characterId: character.id,
        isValid: result.isValid,
        errorCount: errors.length,
        warningCount: warnings.length,
      });

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("部分データ検証中にエラーが発生", {
        characterId: character.id,
        error: errorMessage,
      });

      return {
        isValid: false,
        errors: [`検証処理中にエラーが発生: ${errorMessage}`],
        warnings,
      };
    }
  }

  /**
   * 欠損データシナリオに対する適切なエラーメッセージを生成
   * 要件: 6.1, 6.2, 6.3, 6.4
   */
  generateMissingDataErrorMessage(
    characterId: string,
    missingFields: string[]
  ): string {
    if (missingFields.length === 0) {
      return "データは完全です";
    }

    const criticalFields = ["page", "filter_values"];
    const basicFields = ["specialty", "stats", "rarity", "faction"];
    const attributeFields = ["ascension", "modules"];

    const criticalMissing = missingFields.filter((field) =>
      criticalFields.includes(field)
    );
    const basicMissing = missingFields.filter((field) =>
      basicFields.includes(field)
    );
    const attributeMissing = missingFields.filter((field) =>
      attributeFields.includes(field)
    );

    let message = `キャラクター "${characterId}" のデータ処理で以下の問題が発生しました:\n`;

    if (criticalMissing.length > 0) {
      message += `- 重要なデータが欠損: ${criticalMissing.join(", ")}\n`;
      message += "  → このキャラクターは処理をスキップします\n";
    }

    if (basicMissing.length > 0) {
      message += `- 基本情報が欠損: ${basicMissing.join(", ")}\n`;
      message += "  → 空の値またはデフォルト値を適用します\n";
    }

    if (attributeMissing.length > 0) {
      message += `- 属性データが欠損: ${attributeMissing.join(", ")}\n`;
      message += "  → ゼロ値の属性データを適用します\n";
    }

    return message.trim();
  }

  /**
   * character.ts ファイル出力機能を実装
   * Character オブジェクトを TypeScript 配列形式で出力
   * 適切な export 文と as Character[]型注釈を含む
   * 要件: 5.5
   */
  outputCharacterFile(
    character: Character,
    outputPath: string = "data/characters.ts"
  ): void {
    try {
      if (!character) {
        throw new ValidationError(
          "出力するCharacterオブジェクトが存在しません"
        );
      }

      if (!outputPath || outputPath.trim() === "") {
        throw new ValidationError("出力ファイルパスが無効です");
      }

      // 出力ディレクトリを作成（存在しない場合）
      const outputDir = outputPath.substring(0, outputPath.lastIndexOf("/"));
      if (outputDir && !fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Character オブジェクトを整形された TypeScript コードとして出力
      const characterCode = this.formatCharacterObject(character);

      // importパスを出力ファイルの位置に応じて調整
      const importPath = outputPath.startsWith("data/")
        ? "../src/types"
        : "./src/types";

      const fileContent = `import { Character } from "${importPath}";

export default [
${characterCode}
] as Character[];
`;

      // ファイルに書き込み
      try {
        fs.writeFileSync(outputPath, fileContent, "utf-8");
      } catch (error) {
        throw new ParsingError(
          `ファイル "${outputPath}" の書き込みに失敗しました`,
          error as Error
        );
      }
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ParsingError) {
        throw error;
      }
      throw new ParsingError("ファイル出力に失敗しました", error as Error);
    }
  }

  /**
   * Character オブジェクトを整形された TypeScript コードとして出力
   */
  private formatCharacterObject(character: Character): string {
    const indent = "  ";

    // stats配列を適切にフォーマット
    const statsArray = Array.isArray(character.stats)
      ? `[${character.stats.map((stat) => `"${stat}"`).join(", ")}]`
      : `["${character.stats}"]`; // 後方互換性のため

    return `${indent}{
${indent}  id: "${character.id}",
${indent}  name: { ja: "${this.escapeString(
      character.name.ja
    )}", en: "${this.escapeString(character.name.en)}" },
${indent}  fullName: { ja: "${this.escapeString(
      character.fullName.ja
    )}", en: "${this.escapeString(character.fullName.en)}" },
${indent}  specialty: "${character.specialty}",
${indent}  stats: ${statsArray},
${indent}  faction: ${character.faction},
${indent}  rarity: "${character.rarity}",
${indent}  releaseVersion: ${character.releaseVersion || 0},
${indent}  attr: {
${indent}    hp: [${character.attr.hp.join(", ")}],
${indent}    atk: [${character.attr.atk.join(", ")}],
${indent}    def: [${character.attr.def.join(", ")}],
${indent}    impact: ${character.attr.impact},
${indent}    critRate: ${character.attr.critRate},
${indent}    critDmg: ${character.attr.critDmg},
${indent}    anomalyMastery: ${character.attr.anomalyMastery},
${indent}    anomalyProficiency: ${character.attr.anomalyProficiency},
${indent}    penRatio: ${character.attr.penRatio},
${indent}    energy: ${character.attr.energy},
${indent}  },
${indent}}`;
  }

  /**
   * 文字列内のダブルクォートをエスケープ
   */
  private escapeString(str: string): string {
    return str.replace(/"/g, '\\"');
  }
}
