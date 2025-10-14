import { Bomp } from "../types";
import { ProcessedBompData, ValidationResult } from "../types/processing";
import { DataMapper } from "../mappers/DataMapper";
import { AttributesProcessor } from "../processors/AttributesProcessor";
import { ValidationError, ParsingError } from "../errors";
import { logger } from "../utils/Logger";
import * as fs from "fs";

/**
 * ボンプジェネレーター - 最終的な Bomp オブジェクトの生成と出力
 * 要件: 5.1, 5.3, 5.4, 1.4
 */
export class BompGenerator {
  private dataMapper: DataMapper;
  private attributesProcessor: AttributesProcessor;

  constructor() {
    this.dataMapper = new DataMapper();
    this.attributesProcessor = new AttributesProcessor();
  }

  /**
   * ProcessedBompData から Bomp オブジェクトへの変換
   * 多言語データの統合と名前フォールバック処理
   * 実装バージョン情報の適切な設定
   * 要件: 5.1, 5.3, 5.4
   */
  generateBomp(
    jaData: ProcessedBompData,
    enData: ProcessedBompData | null,
    bompId: string
  ): Bomp {
    try {
      logger.debug("ボンプオブジェクト生成を開始", { bompId });

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
      if (!bompId || bompId.trim() === "") {
        throw new ValidationError("ボンプIDが指定されていません");
      }

      // 基本情報のマッピング（文字列をStats型に変換）
      const stats = this.dataMapper.mapStats(jaData.basicInfo.stats);

      // 多言語名の作成（英語データがない場合は日本語をフォールバック）
      const enName = enData?.basicInfo?.name || jaData.basicInfo.name;
      const name = this.dataMapper.createMultiLangName(
        jaData.basicInfo.name,
        enName
      );

      // 属性データの処理
      const attributes = this.attributesProcessor.processAscensionData(
        jaData.attributesInfo.ascensionData
      );

      // Bomp オブジェクトを構築
      const bomp: Bomp = {
        id: bompId, // 明示的に受け取ったボンプIDを使用
        name,
        stats,
        attr: attributes,
        extraAbility: jaData.extraAbility || "",
        releaseVersion: jaData.basicInfo.releaseVersion,
        faction: jaData.factionIds || [],
      };

      logger.debug("ボンプオブジェクト生成完了", {
        bompId: bomp.id,
        hasExtraAbility: bomp.extraAbility.length > 0,
        factionCount: bomp.faction.length,
      });

      return bomp;
    } catch (error) {
      logger.error("ボンプオブジェクト生成に失敗しました", {
        bompId,
        error: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(
        "Bompオブジェクトの生成に失敗しました",
        error as Error
      );
    }
  }

  /**
   * 生成された Bomp オブジェクトの完全性チェック
   * 必須フィールドと配列長の検証（HP、ATK、DEF が 7 要素）
   * 列挙値の妥当性確認と多言語オブジェクトの検証
   * 要件: 4.4
   */
  validateBomp(bomp: Bomp): ValidationResult {
    const errors: string[] = [];

    try {
      // 必須フィールドの存在確認
      if (!bomp.id || bomp.id.trim() === "") {
        errors.push("id フィールドが空または存在しません");
      }

      if (!bomp.name) {
        errors.push("name フィールドが存在しません");
      }

      if (!bomp.stats) {
        errors.push("stats フィールドが存在しません");
      }

      if (!bomp.attr) {
        errors.push("attr フィールドが存在しません");
      }

      if (typeof bomp.extraAbility !== "string") {
        errors.push("extraAbility フィールドは文字列である必要があります");
      }

      // releaseVersion フィールドの検証
      if (bomp.releaseVersion !== undefined && bomp.releaseVersion !== null) {
        if (
          typeof bomp.releaseVersion !== "number" ||
          isNaN(bomp.releaseVersion)
        ) {
          errors.push("releaseVersion は有効な数値である必要があります");
        }
        if (bomp.releaseVersion < 0) {
          errors.push("releaseVersion は0以上の値である必要があります");
        }
      }

      // faction フィールドの検証
      if (!Array.isArray(bomp.faction)) {
        errors.push("faction は配列である必要があります");
      } else {
        const invalidFactionIds = bomp.faction.filter(
          (id) => typeof id !== "number" || id <= 0
        );
        if (invalidFactionIds.length > 0) {
          errors.push(
            `無効な派閥IDが含まれています: ${invalidFactionIds.join(", ")}`
          );
        }
      }

      // 多言語オブジェクトの完全性確認
      if (bomp.name) {
        if (!bomp.name.ja || bomp.name.ja.trim() === "") {
          errors.push("name.ja が空または存在しません");
        }
        if (!bomp.name.en || bomp.name.en.trim() === "") {
          errors.push("name.en が空または存在しません");
        }
      }

      // 数値配列の長さ検証（HP、ATK、DEF 配列が 7 要素）
      if (bomp.attr) {
        if (!Array.isArray(bomp.attr.hp) || bomp.attr.hp.length !== 7) {
          errors.push("attr.hp 配列は正確に 7 つの値を含む必要があります");
        }
        if (!Array.isArray(bomp.attr.atk) || bomp.attr.atk.length !== 7) {
          errors.push("attr.atk 配列は正確に 7 つの値を含む必要があります");
        }
        if (!Array.isArray(bomp.attr.def) || bomp.attr.def.length !== 7) {
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
          const value = (bomp.attr as any)[stat];
          if (typeof value !== "number" || isNaN(value)) {
            errors.push(`attr.${stat} は有効な数値である必要があります`);
          }
        });
      }

      // 列挙値の妥当性確認
      const validStats = [
        "ether",
        "fire",
        "ice",
        "physical",
        "electric",
        "frostAttribute",
        "auricInk",
      ];
      if (bomp.stats && !validStats.includes(bomp.stats)) {
        errors.push(`stats "${bomp.stats}" は有効な値ではありません`);
      }

      const result = {
        isValid: errors.length === 0,
        errors,
      };

      // 検証失敗時の詳細ログ
      if (!result.isValid) {
        logger.warn("Bomp検証エラー", { bompId: bomp.id, errors });
      }

      return result;
    } catch (error) {
      let bompId = "unknown";
      try {
        bompId = bomp?.id || "unknown";
      } catch {
        // Ignore errors when accessing bomp.id for logging
      }

      logger.error("Bomp検証中にエラーが発生しました", {
        bompId,
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
  } /**

   * data/bomps.ts ファイルの生成機能
   * 適切な import 文と型注釈を含むファイル構造
   * ボンプ配列の整形された TypeScript コード出力
   * 要件: 1.4
   */
  outputBompFile(bomps: Bomp[], outputPath: string = "data/bomps.ts"): void {
    try {
      if (!bomps || !Array.isArray(bomps)) {
        throw new ValidationError("出力するBompオブジェクト配列が存在しません");
      }

      if (!outputPath || outputPath.trim() === "") {
        throw new ValidationError("出力ファイルパスが無効です");
      }

      // 出力ディレクトリを作成（存在しない場合）
      const outputDir = outputPath.substring(0, outputPath.lastIndexOf("/"));
      if (outputDir && !fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Bomp 配列を整形された TypeScript コードとして出力
      const bompArrayCode = this.formatBompArray(bomps);

      // importパスを出力ファイルの位置に応じて調整
      const importPath = outputPath.startsWith("data/")
        ? "../src/types"
        : "./src/types";

      const fileContent = `import { Bomp } from "${importPath}";

export default [
${bompArrayCode}
] as Bomp[];
`;

      // ファイルに書き込み
      try {
        fs.writeFileSync(outputPath, fileContent, "utf-8");
        logger.info("ボンプファイル出力完了", {
          outputPath,
          bompCount: bomps.length,
        });
      } catch (error) {
        throw new ParsingError(
          `ファイル "${outputPath}" の書き込みに失敗しました`,
          error as Error
        );
      }
    } catch (error) {
      logger.error("ボンプファイル出力に失敗しました", {
        outputPath,
        bompCount: bomps?.length || 0,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof ValidationError || error instanceof ParsingError) {
        throw error;
      }
      throw new ParsingError("ファイル出力に失敗しました", error as Error);
    }
  }

  /**
   * Bomp 配列を整形された TypeScript コードとして出力
   */
  formatBompArray(bomps: Bomp[]): string {
    if (!bomps || bomps.length === 0) {
      return "";
    }

    return bomps.map((bomp) => this.formatBompObject(bomp)).join(",\n");
  }

  /**
   * Bomp オブジェクトを整形された TypeScript コードとして出力
   */
  private formatBompObject(bomp: Bomp): string {
    const indent = "  ";

    // faction フィールドの処理
    const factionStr = `[${bomp.faction.join(", ")}]`;

    return `${indent}{
${indent}  id: "${bomp.id}",
${indent}  name: { ja: "${this.escapeString(
      bomp.name.ja
    )}", en: "${this.escapeString(bomp.name.en)}" },
${indent}  stats: "${bomp.stats}",
${indent}  releaseVersion: ${bomp.releaseVersion || "undefined"},
${indent}  faction: ${factionStr},
${indent}  attr: {
${indent}    hp: [${bomp.attr.hp.join(", ")}],
${indent}    atk: [${bomp.attr.atk.join(", ")}],
${indent}    def: [${bomp.attr.def.join(", ")}],
${indent}    impact: ${bomp.attr.impact},
${indent}    critRate: ${bomp.attr.critRate},
${indent}    critDmg: ${bomp.attr.critDmg},
${indent}    anomalyMastery: ${bomp.attr.anomalyMastery},
${indent}    anomalyProficiency: ${bomp.attr.anomalyProficiency},
${indent}    penRatio: ${bomp.attr.penRatio},
${indent}    energy: ${bomp.attr.energy},
${indent}  },
${indent}  extraAbility: "${this.escapeString(bomp.extraAbility)}",
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
