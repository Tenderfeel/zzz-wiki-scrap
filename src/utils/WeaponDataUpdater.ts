import { Weapon, EnhancedWeapon, Stats } from "../types";
import { WeaponAttributeProcessor } from "../processors/WeaponAttributeProcessor";
import { logger } from "./Logger";
import * as fs from "fs";

/**
 * 既存の武器データを拡張武器データに更新するユーティリティ
 */
export class WeaponDataUpdater {
  private attributeProcessor: WeaponAttributeProcessor;

  constructor() {
    this.attributeProcessor = new WeaponAttributeProcessor();
  }

  /**
   * 既存の武器データファイルを読み込み、属性抽出を適用して更新
   * @param inputPath 入力ファイルパス
   * @param outputPath 出力ファイルパス（省略時は入力ファイルを上書き）
   * @returns 更新結果
   */
  async updateWeaponDataFile(
    inputPath: string = "data/weapons.ts",
    outputPath?: string
  ): Promise<{
    totalWeapons: number;
    updatedWeapons: number;
    failedWeapons: number;
  }> {
    try {
      logger.info("武器データファイル更新を開始", {
        inputPath,
        outputPath: outputPath || inputPath,
      });

      // 既存の武器データを動的にインポート
      const weaponsModule = await import(`../../${inputPath}`);
      const weapons: Weapon[] = weaponsModule.default;

      if (!Array.isArray(weapons)) {
        throw new Error("武器データが配列ではありません");
      }

      logger.info("武器データ読み込み完了", {
        weaponCount: weapons.length,
      });

      // 属性抽出処理を適用
      const result = this.attributeProcessor.processWeapons(weapons);

      logger.info("属性抽出処理完了", {
        totalWeapons: weapons.length,
        successful: result.successful.length,
        failed: result.failed.length,
        successRate: `${result.statistics.successRate.toFixed(2)}%`,
      });

      // 更新された武器データを出力
      const finalOutputPath = outputPath || inputPath;
      await this.writeUpdatedWeaponFile(result.successful, finalOutputPath);

      return {
        totalWeapons: weapons.length,
        updatedWeapons: result.successful.length,
        failedWeapons: result.failed.length,
      };
    } catch (error) {
      logger.error("武器データファイル更新に失敗", {
        inputPath,
        outputPath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 更新された武器データをファイルに書き込み
   * @param enhancedWeapons 拡張武器データ
   * @param outputPath 出力ファイルパス
   */
  private async writeUpdatedWeaponFile(
    enhancedWeapons: EnhancedWeapon[],
    outputPath: string
  ): Promise<void> {
    try {
      // 拡張武器データを基本武器データに変換（extractedAttributesをstatsに統合）
      const updatedWeapons: Weapon[] = enhancedWeapons.map((enhancedWeapon) => {
        // 既存のstatsと抽出された属性を統合
        const combinedStats = this.mergeStats(
          enhancedWeapon.stats,
          enhancedWeapon.extractedAttributes
        );

        // EnhancedWeaponからWeaponに変換（extractedAttributesを除去）
        const { extractedAttributes, ...weapon } = enhancedWeapon;
        return {
          ...weapon,
          stats: combinedStats,
        };
      });

      // ファイル内容を生成
      const fileContent = this.generateWeaponFileContent(updatedWeapons);

      // ファイルに書き込み
      fs.writeFileSync(outputPath, fileContent, "utf-8");

      logger.info("更新された武器データファイル出力完了", {
        outputPath,
        weaponCount: updatedWeapons.length,
      });
    } catch (error) {
      logger.error("武器データファイル書き込みに失敗", {
        outputPath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 抽出された属性のみを使用
   * @param existingStats 既存の属性配列（使用しない）
   * @param extractedAttributes 抽出された属性配列
   * @returns 抽出された属性配列（重複除去済み）
   */
  private mergeStats(
    existingStats: Stats[],
    extractedAttributes: Stats[]
  ): Stats[] {
    if (!extractedAttributes || extractedAttributes.length === 0) {
      // 抽出された属性がない場合は空配列を返す
      return [];
    }

    // 抽出された属性のみを使用（重複を除去）
    return Array.from(new Set(extractedAttributes));
  }

  /**
   * 武器データファイルの内容を生成
   * @param weapons 武器データ配列
   * @returns ファイル内容
   */
  private generateWeaponFileContent(weapons: Weapon[]): string {
    const weaponArrayCode = weapons
      .map((weapon) => this.formatWeaponObject(weapon))
      .join(",\n");

    return `import { Weapon } from "../src/types";

export default [
${weaponArrayCode}
] as Weapon[];
`;
  }

  /**
   * 武器オブジェクトを整形されたTypeScriptコードとして出力
   */
  private formatWeaponObject(weapon: Weapon): string {
    const indent = "  ";

    // stats配列を適切にフォーマット
    const statsArray = Array.isArray(weapon.stats)
      ? `[${weapon.stats.map((stat) => `"${stat}"`).join(", ")}]`
      : `["${weapon.stats}"]`;

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

  /**
   * 武器データの属性抽出統計を生成
   * @param weapons 武器データ配列
   * @returns 統計レポート
   */
  async generateAttributeExtractionReport(weapons: Weapon[]): Promise<string> {
    try {
      const report = this.attributeProcessor.generateComparisonReport(weapons);
      return report;
    } catch (error) {
      logger.error("属性抽出統計生成に失敗", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
