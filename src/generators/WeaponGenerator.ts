import {
  Weapon,
  ProcessedWeaponData,
  Lang,
  Specialty,
  Stats,
  Rarity,
  Attribute,
  WeaponAttributes,
} from "../types";
import { ValidationResult } from "../types/processing";
import { DataMapper } from "../mappers/DataMapper";
import { ValidationError, ParsingError } from "../errors";
import { logger } from "../utils/Logger";
import * as fs from "fs";

/**
 * 音動機ジェネレーター - ProcessedWeaponDataからWeaponオブジェクトへの変換と出力
 * 要件: 3.1, 3.2, 4.4
 */
export class WeaponGenerator {
  private dataMapper: DataMapper;

  constructor() {
    this.dataMapper = new DataMapper();
  }

  /**
   * ProcessedWeaponDataからWeaponオブジェクトへの変換
   * 多言語データの統合と名前フォールバック処理
   * 要件: 3.1
   */
  generateWeapon(
    jaData: ProcessedWeaponData,
    enData: ProcessedWeaponData | null,
    weaponId: string
  ): Weapon {
    try {
      logger.debug("音動機オブジェクト生成を開始", { weaponId });

      // 入力データの検証
      if (!jaData) {
        throw new ValidationError("日本語データが存在しません");
      }
      if (!jaData.basicInfo) {
        throw new ValidationError("日本語の基本情報が存在しません");
      }
      if (!jaData.attributesInfo) {
        throw new ValidationError("属性情報が存在しません");
      }
      if (!weaponId || weaponId.trim() === "") {
        throw new ValidationError("音動機IDが指定されていません");
      }

      // 基本情報の取得
      const basicInfo = jaData.basicInfo;
      const skillInfo = jaData.skillInfo;
      const attributesInfo = jaData.attributesInfo;
      const agentInfo = jaData.agentInfo;

      // 多言語名の作成（英語データがない場合は日本語をフォールバック）
      const enName = enData?.basicInfo?.name || basicInfo.name;
      const name = this.dataMapper.createMultiLangName(basicInfo.name, enName);

      // 多言語スキル名の作成
      const enSkillName =
        enData?.skillInfo?.equipmentSkillName || skillInfo.equipmentSkillName;
      const equipmentSkillName = this.dataMapper.createMultiLangName(
        skillInfo.equipmentSkillName,
        enSkillName
      );

      // 多言語スキル説明の作成
      const enSkillDesc =
        enData?.skillInfo?.equipmentSkillDesc || skillInfo.equipmentSkillDesc;
      const equipmentSkillDesc = this.dataMapper.createMultiLangName(
        skillInfo.equipmentSkillDesc,
        enSkillDesc
      );

      // レア度マッピング
      let rarity: Rarity = "A"; // デフォルト値
      try {
        rarity = this.dataMapper.mapRarity(basicInfo.rarity);
        logger.debug("レア度マッピング成功", {
          weaponId,
          rawRarity: basicInfo.rarity,
          mappedRarity: rarity,
        });
      } catch (error) {
        logger.warn("レア度マッピングに失敗、デフォルト値を使用", {
          weaponId,
          rawRarity: basicInfo.rarity,
          defaultRarity: rarity,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // 特性マッピング
      let specialty: Specialty = "attack"; // デフォルト値
      try {
        if (basicInfo.specialty && basicInfo.specialty.trim() !== "") {
          specialty = this.dataMapper.mapSpecialty(basicInfo.specialty);
          logger.debug("特性マッピング成功", {
            weaponId,
            rawSpecialty: basicInfo.specialty,
            mappedSpecialty: specialty,
          });
        }
      } catch (error) {
        logger.warn("特性マッピングに失敗、デフォルト値を使用", {
          weaponId,
          rawSpecialty: basicInfo.specialty,
          defaultSpecialty: specialty,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // 属性配列の作成（デフォルトは物理属性）
      const stats: Stats[] = ["physical"];

      // 音動機属性データの変換
      const attr: WeaponAttributes = {
        hp: attributesInfo.hp,
        atk: attributesInfo.atk,
        def: attributesInfo.def,
        impact: attributesInfo.impact,
        critRate: attributesInfo.critRate,
        critDmg: attributesInfo.critDmg,
        anomalyMastery: attributesInfo.anomalyMastery,
        anomalyProficiency: attributesInfo.anomalyProficiency,
        penRatio: attributesInfo.penRatio,
        energy: attributesInfo.energy,
      };

      // 基礎・上級ステータスの決定（デフォルト値）
      const baseAttr: Attribute = "atk"; // 基礎攻撃力がデフォルト
      const advancedAttr: Attribute = "critRate"; // 会心率がデフォルト

      // Weapon オブジェクトを構築
      const weapon: Weapon = {
        id: parseInt(weaponId, 10),
        name,
        equipmentSkillName,
        equipmentSkillDesc,
        rarity,
        attr,
        specialty,
        stats,
        agentId: agentInfo.agentId || "",
        baseAttr,
        advancedAttr,
      };

      logger.debug("音動機オブジェクト生成完了", {
        weaponId: weapon.id,
        hasSkillName: weapon.equipmentSkillName.ja.length > 0,
        hasSkillDesc: weapon.equipmentSkillDesc.ja.length > 0,
        hasAgentId: weapon.agentId.length > 0,
      });

      return weapon;
    } catch (error) {
      logger.error("音動機オブジェクト生成に失敗しました", {
        weaponId,
        error: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(
        "Weaponオブジェクトの生成に失敗しました",
        error as Error
      );
    }
  }
  /**
   * 生成されたWeaponオブジェクトの完全性チェック
   * 必須フィールドと配列長の検証
   * 列挙値の妥当性確認
   * 要件: 4.4
   */
  validateWeapon(weapon: Weapon): ValidationResult {
    const errors: string[] = [];

    try {
      // 必須フィールドの存在確認
      if (typeof weapon.id !== "number" || isNaN(weapon.id) || weapon.id <= 0) {
        errors.push("id フィールドが無効な数値です");
      }

      if (!weapon.name) {
        errors.push("name フィールドが存在しません");
      }

      if (!weapon.equipmentSkillName) {
        errors.push("equipmentSkillName フィールドが存在しません");
      }

      if (!weapon.equipmentSkillDesc) {
        errors.push("equipmentSkillDesc フィールドが存在しません");
      }

      if (!weapon.rarity) {
        errors.push("rarity フィールドが存在しません");
      }

      if (!weapon.attr) {
        errors.push("attr フィールドが存在しません");
      }

      if (!weapon.specialty) {
        errors.push("specialty フィールドが存在しません");
      }

      if (!weapon.stats) {
        errors.push("stats フィールドが存在しません");
      }

      if (typeof weapon.agentId !== "string") {
        errors.push("agentId フィールドは文字列である必要があります");
      }

      if (!weapon.baseAttr) {
        errors.push("baseAttr フィールドが存在しません");
      }

      if (!weapon.advancedAttr) {
        errors.push("advancedAttr フィールドが存在しません");
      }

      // 多言語オブジェクトの完全性確認
      if (weapon.name) {
        if (!weapon.name.ja || weapon.name.ja.trim() === "") {
          errors.push("name.ja が空または存在しません");
        }
        if (!weapon.name.en || weapon.name.en.trim() === "") {
          errors.push("name.en が空または存在しません");
        }
      }

      if (weapon.equipmentSkillName) {
        if (typeof weapon.equipmentSkillName.ja !== "string") {
          errors.push("equipmentSkillName.ja は文字列である必要があります");
        }
        if (typeof weapon.equipmentSkillName.en !== "string") {
          errors.push("equipmentSkillName.en は文字列である必要があります");
        }
      }

      if (weapon.equipmentSkillDesc) {
        if (typeof weapon.equipmentSkillDesc.ja !== "string") {
          errors.push("equipmentSkillDesc.ja は文字列である必要があります");
        }
        if (typeof weapon.equipmentSkillDesc.en !== "string") {
          errors.push("equipmentSkillDesc.en は文字列である必要があります");
        }
      }

      // 音動機属性配列の長さ検証（全て7要素）
      if (weapon.attr) {
        const attributeKeys = [
          "hp",
          "atk",
          "def",
          "impact",
          "critRate",
          "critDmg",
          "anomalyMastery",
          "anomalyProficiency",
          "penRatio",
          "energy",
        ];

        for (const key of attributeKeys) {
          const value = (weapon.attr as any)[key];
          if (!Array.isArray(value)) {
            errors.push(`attr.${key} は配列である必要があります`);
          } else if (value.length !== 7) {
            errors.push(
              `attr.${key} 配列は正確に7つの値を含む必要があります（現在: ${value.length}）`
            );
          } else {
            // 数値の検証
            for (let i = 0; i < value.length; i++) {
              if (typeof value[i] !== "number" || isNaN(value[i])) {
                errors.push(
                  `attr.${key}[${i}] は有効な数値である必要があります: ${value[i]}`
                );
              }
            }
          }
        }
      }

      // 列挙値の妥当性確認
      const validRarities: Rarity[] = ["A", "S"];
      if (weapon.rarity && !validRarities.includes(weapon.rarity)) {
        errors.push(
          `rarity "${weapon.rarity}" は有効な値ではありません（"A"または"S"である必要があります）`
        );
      }

      const validSpecialties: Specialty[] = [
        "attack",
        "stun",
        "anomaly",
        "support",
        "defense",
        "rupture",
      ];
      if (weapon.specialty && !validSpecialties.includes(weapon.specialty)) {
        errors.push(`specialty "${weapon.specialty}" は有効な値ではありません`);
      }

      const validStats: Stats[] = [
        "ether",
        "fire",
        "ice",
        "physical",
        "electric",
        "frost",
        "auricInk",
      ];
      if (weapon.stats) {
        if (!Array.isArray(weapon.stats) || weapon.stats.length === 0) {
          errors.push("stats は空でない配列である必要があります");
        } else {
          for (const stat of weapon.stats) {
            if (!validStats.includes(stat)) {
              errors.push(`stats "${stat}" は有効な値ではありません`);
            }
          }
        }
      }

      const validAttributes: Attribute[] = [
        "hp",
        "atk",
        "def",
        "impact",
        "critRate",
        "critDmg",
        "anomalyMastery",
        "anomalyProficiency",
        "penRatio",
        "energy",
      ];
      if (weapon.baseAttr && !validAttributes.includes(weapon.baseAttr)) {
        errors.push(`baseAttr "${weapon.baseAttr}" は有効な値ではありません`);
      }

      if (
        weapon.advancedAttr &&
        !validAttributes.includes(weapon.advancedAttr)
      ) {
        errors.push(
          `advancedAttr "${weapon.advancedAttr}" は有効な値ではありません`
        );
      }

      const result = {
        isValid: errors.length === 0,
        errors,
      };

      // 検証結果のログ記録
      if (!result.isValid) {
        logger.warn("Weapon検証エラー", {
          weaponId: weapon.id,
          errors,
        });
      } else {
        logger.debug("Weapon検証成功", {
          weaponId: weapon.id,
        });
      }

      return result;
    } catch (error) {
      let weaponId = "unknown";
      try {
        weaponId = weapon?.id?.toString() || "unknown";
      } catch {
        // Ignore errors when accessing weapon.id for logging
      }

      logger.error("Weapon検証中にエラーが発生しました", {
        weaponId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        isValid: false,
        errors: [
          "データ検証中にエラーが発生しました: " +
            (error instanceof Error ? error.message : String(error)),
        ],
      };
    }
  }

  /**
   * data/weapons.tsファイルの生成
   * 適切なimport文と型注釈を含むファイル構造
   * 音動機配列の整形されたTypeScriptコード出力
   * 要件: 3.1, 3.2
   */
  outputWeaponFile(
    weapons: Weapon[],
    outputPath: string = "data/weapons.ts"
  ): void {
    try {
      if (!weapons || !Array.isArray(weapons)) {
        throw new ValidationError(
          "出力するWeaponオブジェクト配列が存在しません"
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

      // Weapon配列を整形されたTypeScriptコードとして出力
      const weaponArrayCode = this.formatWeaponArray(weapons);

      // importパスを出力ファイルの位置に応じて調整
      const importPath = outputPath.startsWith("data/")
        ? "../src/types"
        : "./src/types";

      const fileContent = `import { Weapon } from "${importPath}";

export default [
${weaponArrayCode}
] as Weapon[];
`;

      // ファイルに書き込み
      try {
        fs.writeFileSync(outputPath, fileContent, "utf-8");
        logger.info("音動機ファイル出力完了", {
          outputPath,
          weaponCount: weapons.length,
        });
      } catch (error) {
        throw new ParsingError(
          `ファイル "${outputPath}" の書き込みに失敗しました`,
          error as Error
        );
      }
    } catch (error) {
      logger.error("音動機ファイル出力に失敗しました", {
        outputPath,
        weaponCount: weapons?.length || 0,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof ValidationError || error instanceof ParsingError) {
        throw error;
      }
      throw new ParsingError("ファイル出力に失敗しました", error as Error);
    }
  }

  /**
   * Weapon配列を整形されたTypeScriptコードとして出力
   */
  private formatWeaponArray(weapons: Weapon[]): string {
    if (!weapons || weapons.length === 0) {
      return "";
    }

    return weapons.map((weapon) => this.formatWeaponObject(weapon)).join(",\n");
  }

  /**
   * Weaponオブジェクトを整形されたTypeScriptコードとして出力
   */
  private formatWeaponObject(weapon: Weapon): string {
    const indent = "  ";

    // stats配列を適切にフォーマット
    const statsArray = Array.isArray(weapon.stats)
      ? `[${weapon.stats.map((stat) => `"${stat}"`).join(", ")}]`
      : `["${weapon.stats}"]`; // 後方互換性のため

    return `${indent}{
${indent}  id: ${weapon.id},
${indent}  name: { ja: "${this.escapeString(
      weapon.name.ja
    )}", en: "${this.escapeString(weapon.name.en)}" },
${indent}  equipmentSkillName: { ja: "${this.escapeString(
      weapon.equipmentSkillName.ja
    )}", en: "${this.escapeString(weapon.equipmentSkillName.en)}" },
${indent}  equipmentSkillDesc: { ja: "${this.escapeString(
      weapon.equipmentSkillDesc.ja
    )}", en: "${this.escapeString(weapon.equipmentSkillDesc.en)}" },
${indent}  rarity: "${weapon.rarity}",
${indent}  attr: {
${indent}    hp: [${weapon.attr.hp.join(", ")}],
${indent}    atk: [${weapon.attr.atk.join(", ")}],
${indent}    def: [${weapon.attr.def.join(", ")}],
${indent}    impact: [${weapon.attr.impact.join(", ")}],
${indent}    critRate: [${weapon.attr.critRate.join(", ")}],
${indent}    critDmg: [${weapon.attr.critDmg.join(", ")}],
${indent}    anomalyMastery: [${weapon.attr.anomalyMastery.join(", ")}],
${indent}    anomalyProficiency: [${weapon.attr.anomalyProficiency.join(", ")}],
${indent}    penRatio: [${weapon.attr.penRatio.join(", ")}],
${indent}    energy: [${weapon.attr.energy.join(", ")}],
${indent}  },
${indent}  specialty: "${weapon.specialty}",
${indent}  stats: ${statsArray},
${indent}  agentId: "${this.escapeString(weapon.agentId)}",
${indent}  baseAttr: "${weapon.baseAttr}",
${indent}  advancedAttr: "${weapon.advancedAttr}",
${indent}}`;
  }

  /**
   * 文字列内のダブルクォートをエスケープ
   */
  private escapeString(str: string): string {
    if (typeof str !== "string") {
      return "";
    }
    return str.replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
  }
}
