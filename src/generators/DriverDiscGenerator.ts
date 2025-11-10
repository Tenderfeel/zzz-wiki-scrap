import { DriverDisc, Lang } from "../types";
import { ProcessedDriverDiscData, ValidationResult } from "../types";
import { DataMapper } from "../mappers/DataMapper";
import { ValidationError, ParsingError } from "../errors";
import { logger } from "../utils/Logger";
import * as fs from "fs";

/**
 * ドライバーディスクジェネレーター - 最終的な DriverDisc オブジェクトの生成と出力
 * 要件: 3.1, 3.2, 5.2
 */
export class DriverDiscGenerator {
  private dataMapper: DataMapper;

  constructor() {
    this.dataMapper = new DataMapper();
  }

  /**
   * ProcessedDriverDiscData から DriverDisc オブジェクトへの変換
   * 多言語データの統合と名前フォールバック処理
   * 要件: 3.1, 3.2
   */
  generateDriverDisc(
    jaData: ProcessedDriverDiscData,
    enData: ProcessedDriverDiscData | null,
    discId: string
  ): DriverDisc {
    try {
      logger.debug("ドライバーディスクオブジェクト生成を開始", { discId });

      // 入力データの検証
      if (!jaData) {
        throw new ValidationError("日本語データが存在しません");
      }
      if (!jaData.basicInfo) {
        throw new ValidationError("日本語の基本情報が存在しません");
      }
      if (!jaData.setEffectInfo) {
        throw new ValidationError("セット効果情報が存在しません");
      }
      if (!discId || discId.trim() === "") {
        throw new ValidationError("ドライバーディスクIDが指定されていません");
      }

      // 多言語名の作成（英語データがない場合は日本語をフォールバック）
      const name = this.createMultiLanguageName(jaData, enData);

      // 多言語セット効果の作成
      const setEffects = this.createMultiLanguageSetEffect(jaData, enData);

      // DriverDisc オブジェクトを構築
      const driverDisc: DriverDisc = {
        id: jaData.basicInfo.id,
        name,
        fourSetEffect: setEffects.fourSetEffect,
        twoSetEffect: setEffects.twoSetEffect,
        releaseVersion: jaData.basicInfo.releaseVersion || 1.0, // デフォルト値
        specialty: jaData.specialty,
      };

      logger.debug("ドライバーディスクオブジェクト生成完了", {
        discId: driverDisc.id,
        specialty: driverDisc.specialty,
        releaseVersion: driverDisc.releaseVersion,
      });

      return driverDisc;
    } catch (error) {
      logger.error("ドライバーディスクオブジェクト生成に失敗しました", {
        discId,
        error: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(
        "DriverDiscオブジェクトの生成に失敗しました",
        error as Error
      );
    }
  }

  /**
   * data/driverDiscs.ts ファイルの生成機能
   * TypeScript 型定義に準拠したデータ構造の検証を追加
   * 要件: 5.2
   */
  generateDriverDiscsFile(
    driverDiscs: DriverDisc[],
    outputPath: string = "data/driverDiscs.ts"
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (!driverDiscs || !Array.isArray(driverDiscs)) {
          throw new ValidationError(
            "出力するDriverDiscオブジェクト配列が存在しません"
          );
        }

        if (!outputPath || outputPath.trim() === "") {
          throw new ValidationError("出力ファイルパスが無効です");
        }

        // 各DriverDiscオブジェクトの検証
        for (const driverDisc of driverDiscs) {
          const validationResult = this.validateDriverDisc(driverDisc);
          if (!validationResult.isValid) {
            throw new ValidationError(
              `DriverDiscオブジェクトの検証に失敗しました (ID: ${
                driverDisc.id
              }): ${validationResult.errors.join(", ")}`
            );
          }
        }

        // 出力ディレクトリを作成（存在しない場合）
        const outputDir = outputPath.substring(0, outputPath.lastIndexOf("/"));
        if (outputDir && !fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        // DriverDisc 配列を整形された TypeScript コードとして出力
        const driverDiscArrayCode = this.formatDriverDiscArray(driverDiscs);

        // importパスを出力ファイルの位置に応じて調整
        const importPath = outputPath.startsWith("data/")
          ? "../src/types"
          : "./src/types";

        const fileContent = `import { DriverDisc } from "${importPath}";

export default [
${driverDiscArrayCode}
] as DriverDisc[];
`;

        // ファイルに書き込み
        try {
          fs.writeFileSync(outputPath, fileContent, "utf-8");
          logger.info("ドライバーディスクファイル出力完了", {
            outputPath,
            driverDiscCount: driverDiscs.length,
          });
          resolve();
        } catch (error) {
          throw new ParsingError(
            `ファイル "${outputPath}" の書き込みに失敗しました`,
            error as Error
          );
        }
      } catch (error) {
        logger.error("ドライバーディスクファイル出力に失敗しました", {
          outputPath,
          driverDiscCount: driverDiscs?.length || 0,
          error: error instanceof Error ? error.message : String(error),
        });

        if (error instanceof ValidationError || error instanceof ParsingError) {
          reject(error);
        } else {
          reject(
            new ParsingError("ファイル出力に失敗しました", error as Error)
          );
        }
      }
    });
  }

  /**
   * 生成された DriverDisc オブジェクトの完全性チェック
   * TypeScript 型定義に準拠したデータ構造の検証
   */
  validateDriverDisc(driverDisc: DriverDisc): ValidationResult {
    const errors: string[] = [];

    try {
      // 必須フィールドの存在確認
      if (typeof driverDisc.id !== "number" || isNaN(driverDisc.id)) {
        errors.push("id フィールドが有効な数値ではありません");
      }

      if (!driverDisc.name) {
        errors.push("name フィールドが存在しません");
      }

      if (!driverDisc.fourSetEffect) {
        errors.push("fourSetEffect フィールドが存在しません");
      }

      if (!driverDisc.twoSetEffect) {
        errors.push("twoSetEffect フィールドが存在しません");
      }

      if (
        typeof driverDisc.releaseVersion !== "number" ||
        isNaN(driverDisc.releaseVersion)
      ) {
        errors.push("releaseVersion フィールドが有効な数値ではありません");
      }

      if (!driverDisc.specialty) {
        errors.push("specialty フィールドが存在しません");
      }

      // 多言語オブジェクトの完全性確認
      if (driverDisc.name) {
        if (!driverDisc.name.ja || driverDisc.name.ja.trim() === "") {
          errors.push("name.ja が空または存在しません");
        }
        if (!driverDisc.name.en || driverDisc.name.en.trim() === "") {
          errors.push("name.en が空または存在しません");
        }
      }

      if (driverDisc.fourSetEffect) {
        if (
          !driverDisc.fourSetEffect.ja ||
          driverDisc.fourSetEffect.ja.trim() === ""
        ) {
          errors.push("fourSetEffect.ja が空または存在しません");
        }
        if (
          !driverDisc.fourSetEffect.en ||
          driverDisc.fourSetEffect.en.trim() === ""
        ) {
          errors.push("fourSetEffect.en が空または存在しません");
        }
      }

      if (driverDisc.twoSetEffect) {
        if (
          !driverDisc.twoSetEffect.ja ||
          driverDisc.twoSetEffect.ja.trim() === ""
        ) {
          errors.push("twoSetEffect.ja が空または存在しません");
        }
        if (
          !driverDisc.twoSetEffect.en ||
          driverDisc.twoSetEffect.en.trim() === ""
        ) {
          errors.push("twoSetEffect.en が空または存在しません");
        }
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
        driverDisc.specialty &&
        !validSpecialties.includes(driverDisc.specialty)
      ) {
        errors.push(
          `specialty "${driverDisc.specialty}" は有効な値ではありません`
        );
      }

      const result = {
        isValid: errors.length === 0,
        errors,
        warnings: [],
        suggestions: [],
      };

      // 検証結果のログ記録
      if (!result.isValid) {
        logger.warn("DriverDisc検証エラー", {
          driverDiscId: driverDisc.id,
          errors,
        });
      } else {
        logger.debug("DriverDisc検証成功", {
          driverDiscId: driverDisc.id,
        });
      }

      return result;
    } catch (error) {
      let driverDiscId = "unknown";
      try {
        driverDiscId = driverDisc?.id?.toString() || "unknown";
      } catch {
        // Ignore errors when accessing driverDisc.id for logging
      }

      logger.error("DriverDisc検証中にエラーが発生しました", {
        driverDiscId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        isValid: false,
        errors: [
          "データ検証中にエラーが発生しました: " +
            (error instanceof Error ? error.message : String(error)),
        ],
        warnings: [],
        suggestions: [],
      };
    }
  }

  // プライベートヘルパーメソッド

  /**
   * 多言語名オブジェクトを作成
   * 英語データがない場合は日本語をフォールバックとして使用
   */
  private createMultiLanguageName(
    jaData: ProcessedDriverDiscData,
    enData: ProcessedDriverDiscData | null
  ): { [key in Lang]: string } {
    try {
      const jaName = jaData.basicInfo.name;
      const enName = enData?.basicInfo?.name || jaName; // フォールバック処理

      return this.dataMapper.createMultiLangName(jaName, enName);
    } catch (error) {
      logger.error("多言語名の作成に失敗しました", {
        jaName: jaData.basicInfo?.name,
        enName: enData?.basicInfo?.name,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 多言語セット効果オブジェクトを作成
   * 英語データがない場合は日本語をフォールバックとして使用
   */
  private createMultiLanguageSetEffect(
    jaData: ProcessedDriverDiscData,
    enData: ProcessedDriverDiscData | null
  ): {
    fourSetEffect: { [key in Lang]: string };
    twoSetEffect: { [key in Lang]: string };
  } {
    try {
      const jaFourSetEffect = jaData.setEffectInfo.fourSetEffect;
      const jaTwoSetEffect = jaData.setEffectInfo.twoSetEffect;

      const enFourSetEffect =
        enData?.setEffectInfo?.fourSetEffect || jaFourSetEffect;
      const enTwoSetEffect =
        enData?.setEffectInfo?.twoSetEffect || jaTwoSetEffect;

      return {
        fourSetEffect: {
          ja: jaFourSetEffect,
          en: enFourSetEffect,
        },
        twoSetEffect: {
          ja: jaTwoSetEffect,
          en: enTwoSetEffect,
        },
      };
    } catch (error) {
      logger.error("多言語セット効果の作成に失敗しました", {
        jaFourSetEffect: jaData.setEffectInfo?.fourSetEffect?.substring(0, 50),
        jaTwoSetEffect: jaData.setEffectInfo?.twoSetEffect?.substring(0, 50),
        enFourSetEffect: enData?.setEffectInfo?.fourSetEffect?.substring(0, 50),
        enTwoSetEffect: enData?.setEffectInfo?.twoSetEffect?.substring(0, 50),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * DriverDisc 配列を整形された TypeScript コードとして出力
   */
  private formatDriverDiscArray(driverDiscs: DriverDisc[]): string {
    if (!driverDiscs || driverDiscs.length === 0) {
      return "";
    }

    return driverDiscs
      .map((driverDisc) => this.formatDriverDiscObject(driverDisc))
      .join(",\n");
  }

  /**
   * DriverDisc オブジェクトを整形された TypeScript コードとして出力
   */
  private formatDriverDiscObject(driverDisc: DriverDisc): string {
    const indent = "  ";

    return `${indent}{
${indent}  id: ${driverDisc.id},
${indent}  name: { ja: "${this.escapeString(
      driverDisc.name.ja
    )}", en: "${this.escapeString(driverDisc.name.en)}" },
${indent}  fourSetEffect: { ja: "${this.escapeString(
      driverDisc.fourSetEffect.ja
    )}", en: "${this.escapeString(driverDisc.fourSetEffect.en)}" },
${indent}  twoSetEffect: { ja: "${this.escapeString(
      driverDisc.twoSetEffect.ja
    )}", en: "${this.escapeString(driverDisc.twoSetEffect.en)}" },
${indent}  releaseVersion: ${driverDisc.releaseVersion},
${indent}  specialty: "${driverDisc.specialty}",
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
