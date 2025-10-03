import { Character } from "../types";
import { ProcessedData, ValidationResult } from "../types/processing";
import { DataMapper } from "../mappers/DataMapper";
import { AttributesProcessor } from "../processors/AttributesProcessor";
import { ValidationError, ParsingError } from "../errors";
import * as fs from "fs";

/**
 * キャラクタージェネレーター - 最終的な Character オブジェクトの生成と出力
 * 要件: 5.1, 5.3, 5.4, 5.5
 */
export class CharacterGenerator {
  private dataMapper: DataMapper;
  private attributesProcessor: AttributesProcessor;

  constructor() {
    this.dataMapper = new DataMapper();
    this.attributesProcessor = new AttributesProcessor();
  }

  /**
   * Character オブジェクト生成機能を実装
   * 処理済みデータから Character オブジェクトを構築
   * id フィールドに Scraping.md のリンクテキスト（"lycaon"）を設定
   * 要件: 5.1, 5.3, 5.4
   */
  generateCharacter(jaData: ProcessedData, enData: ProcessedData): Character {
    try {
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

      // 基本情報のマッピング
      const specialty = this.dataMapper.mapSpecialty(
        jaData.basicInfo.specialty
      );
      const stats = this.dataMapper.mapStats(jaData.basicInfo.stats);
      const attackType = this.dataMapper.mapAttackType(
        jaData.basicInfo.attackType
      );
      const rarity = this.dataMapper.mapRarity(jaData.basicInfo.rarity);

      // 多言語名オブジェクトの生成
      const name = this.dataMapper.createMultiLangName(
        jaData.basicInfo.name,
        enData.basicInfo.name
      );
      const fullName = this.dataMapper.createMultiLangName(
        jaData.basicInfo.name, // 基本的に name と同じ値
        enData.basicInfo.name
      );

      // 属性データの処理
      const attributes = this.attributesProcessor.processAscensionData(
        jaData.attributesInfo.ascensionData
      );

      // Character オブジェクトを構築
      const character: Character = {
        id: "lycaon", // Scraping.md のリンクテキストと同じ
        name,
        fullName,
        specialty,
        stats,
        attackType,
        faction: jaData.factionInfo.id, // 陣営ID
        rarity,
        attr: attributes,
      };

      return character;
    } catch (error) {
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
   * データ検証機能を実装
   * 必須フィールドの存在確認
   * 数値配列の長さ検証（HP、ATK、DEF 配列が 7 要素）
   * 列挙値の妥当性確認
   * 多言語オブジェクトの完全性確認
   * 要件: 6.1, 6.2, 6.3, 6.4, 6.5
   */
  validateCharacter(character: Character): ValidationResult {
    const errors: string[] = [];

    // 必須フィールドの存在確認
    if (!character.id || character.id.trim() === "") {
      errors.push("id フィールドが空または存在しません");
    }

    if (!character.name) {
      errors.push("name フィールドが存在しません");
    }

    if (!character.fullName) {
      errors.push("fullName フィールドが存在しません");
    }

    if (!character.specialty) {
      errors.push("specialty フィールドが存在しません");
    }

    if (!character.stats) {
      errors.push("stats フィールドが存在しません");
    }

    if (!character.attackType) {
      errors.push("attackType フィールドが存在しません");
    }

    if (character.faction === undefined || character.faction === null) {
      errors.push("faction フィールドが存在しません");
    }

    if (!character.rarity) {
      errors.push("rarity フィールドが存在しません");
    }

    if (!character.attr) {
      errors.push("attr フィールドが存在しません");
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
      "frostAttribute",
      "auricInk",
    ];
    if (character.stats && !validStats.includes(character.stats)) {
      errors.push(`stats "${character.stats}" は有効な値ではありません`);
    }

    const validAttackTypes = ["slash", "pierce", "strike"];
    if (
      character.attackType &&
      !validAttackTypes.includes(character.attackType)
    ) {
      errors.push(
        `attackType "${character.attackType}" は有効な値ではありません`
      );
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

    return `${indent}{
${indent}  id: "${character.id}",
${indent}  name: { ja: "${character.name.ja}", en: "${character.name.en}" },
${indent}  fullName: { ja: "${character.fullName.ja}", en: "${
      character.fullName.en
    }" },
${indent}  specialty: "${character.specialty}",
${indent}  stats: "${character.stats}",
${indent}  attackType: "${character.attackType}",
${indent}  faction: ${character.faction},
${indent}  rarity: "${character.rarity}",
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
}
