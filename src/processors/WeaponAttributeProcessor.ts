import {
  Weapon,
  EnhancedWeapon,
  Stats,
  ValidationResult,
  AttributeProcessingResult,
  FailedProcessing,
  ProcessingStatistics,
  AttributeExtractionResult,
} from "../types";
import { WeaponAttributeExtractor } from "../extractors/WeaponAttributeExtractor";
import {
  AttributeExtractionError,
  AttributeExtractionDataError,
  AttributeExtractionValidationError,
  AttributeExtractionBatchError,
} from "../errors";
import { logger } from "../utils/Logger";

/**
 * 武器属性処理クラス
 * 武器データに属性抽出結果を統合し、バリデーションを行う
 */
export class WeaponAttributeProcessor {
  private extractor: WeaponAttributeExtractor;

  constructor(extractor?: WeaponAttributeExtractor) {
    this.extractor = extractor || new WeaponAttributeExtractor();
  }

  /**
   * 単一の武器データに抽出された属性を追加
   * @param weapon 武器データ
   * @returns 拡張された武器データ
   */
  processWeapon(weapon: Weapon): EnhancedWeapon {
    const processingStartTime = Date.now();

    logger.debug("武器属性処理を開始", {
      weaponId: weapon.id,
      weaponName: weapon.name.ja,
      existingStats: weapon.stats,
      timestamp: new Date().toISOString(),
    });

    try {
      // 武器データの基本検証
      if (!weapon) {
        throw new AttributeExtractionDataError(
          0,
          "武器データがnullまたはundefinedです"
        );
      }

      if (!weapon.id || typeof weapon.id !== "number") {
        throw new AttributeExtractionDataError(
          weapon.id || 0,
          "武器IDが無効です"
        );
      }

      if (!weapon.equipmentSkillDesc) {
        logger.warn("スキル説明が存在しません", {
          weaponId: weapon.id,
        });
        return {
          ...weapon,
          extractedAttributes: [],
        };
      }

      // スキル説明の検証
      const hasValidSkillDesc =
        (weapon.equipmentSkillDesc.ja &&
          weapon.equipmentSkillDesc.ja.trim() !== "") ||
        (weapon.equipmentSkillDesc.en &&
          weapon.equipmentSkillDesc.en.trim() !== "");

      if (!hasValidSkillDesc) {
        logger.debug("有効なスキル説明がないため、属性抽出をスキップ", {
          weaponId: weapon.id,
        });
        return {
          ...weapon,
          extractedAttributes: [],
        };
      }

      // スキル説明から属性を抽出
      const extractedAttributes = this.extractor.extractFromMultiLang(
        weapon.equipmentSkillDesc,
        weapon.id
      );

      logger.debug("属性抽出完了", {
        weaponId: weapon.id,
        extractedAttributes,
        extractedCount: extractedAttributes.length,
      });

      // 拡張された武器データを作成
      const enhancedWeapon: EnhancedWeapon = {
        ...weapon,
        extractedAttributes,
      };

      // バリデーションを実行
      const validationResult = this.validateExtraction(
        weapon,
        extractedAttributes
      );

      if (!validationResult.isValid) {
        logger.warn("属性抽出結果のバリデーションに失敗", {
          weaponId: weapon.id,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
        });

        // バリデーション失敗時でも、致命的でなければ抽出結果を保持
        const hasCriticalErrors = validationResult.errors.some(
          (error) => error.includes("無効な属性") || error.includes("重複")
        );

        if (hasCriticalErrors) {
          logger.warn("致命的なバリデーションエラーのため、抽出結果をクリア", {
            weaponId: weapon.id,
          });
          enhancedWeapon.extractedAttributes = [];
        }
      }

      const processingTime = Date.now() - processingStartTime;

      logger.debug("武器属性処理完了", {
        weaponId: weapon.id,
        finalExtractedAttributes: enhancedWeapon.extractedAttributes,
        processingTime: `${processingTime}ms`,
        validationPassed: validationResult.isValid,
      });

      return enhancedWeapon;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const processingTime = Date.now() - processingStartTime;

      logger.error("武器属性処理中にエラーが発生", {
        weaponId: weapon.id,
        error: errorMessage,
        errorType:
          error instanceof Error ? error.constructor.name : typeof error,
        processingTime: `${processingTime}ms`,
      });

      // AttributeExtractionErrorの場合は再スロー
      if (error instanceof AttributeExtractionError) {
        throw error;
      }

      // その他のエラーの場合は新しいエラーとしてラップ
      throw new AttributeExtractionDataError(
        weapon?.id || 0,
        `武器属性処理中にエラーが発生: ${errorMessage}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 複数の武器データを一括処理
   * @param weapons 武器データの配列
   * @param continueOnError エラー時に処理を継続するかどうか（デフォルト: true）
   * @returns 処理結果
   */
  processWeapons(
    weapons: Weapon[],
    continueOnError: boolean = true
  ): AttributeProcessingResult<EnhancedWeapon> {
    const processingStartTime = Date.now();
    const successful: EnhancedWeapon[] = [];
    const failed: FailedProcessing[] = [];

    try {
      // 入力検証
      if (!weapons || !Array.isArray(weapons)) {
        throw new AttributeExtractionBatchError(
          [],
          0,
          "武器データの配列が無効です"
        );
      }

      if (weapons.length === 0) {
        logger.warn("処理対象の武器データが空です");
        return {
          successful: [],
          failed: [],
          statistics: {
            totalProcessed: 0,
            successful: 0,
            failed: 0,
            successRate: 0,
            totalTime: 0,
            averageTimePerItem: 0,
          },
        };
      }

      logger.info("武器属性一括処理を開始", {
        totalWeapons: weapons.length,
        continueOnError,
        timestamp: new Date().toISOString(),
      });

      for (let i = 0; i < weapons.length; i++) {
        const weapon = weapons[i];

        try {
          // 武器データの基本検証
          if (!weapon) {
            throw new AttributeExtractionDataError(
              0,
              `インデックス ${i} の武器データがnullです`
            );
          }

          const enhancedWeapon = this.processWeapon(weapon);
          successful.push(enhancedWeapon);

          // 進捗ログ（100件ごと）
          if ((i + 1) % 100 === 0) {
            logger.info("武器属性処理進捗", {
              processed: i + 1,
              total: weapons.length,
              successful: successful.length,
              failed: failed.length,
              progress: `${(((i + 1) / weapons.length) * 100).toFixed(1)}%`,
            });
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          logger.error("武器属性処理に失敗", {
            weaponIndex: i,
            weaponId: weapon?.id,
            weaponName: weapon?.name?.ja,
            error: errorMessage,
            errorType:
              error instanceof Error ? error.constructor.name : typeof error,
          });

          const failedItem: FailedProcessing = {
            weaponId: weapon?.id || 0,
            error: errorMessage,
            partialData: weapon
              ? {
                  ...weapon,
                  extractedAttributes: [],
                }
              : undefined,
          };

          failed.push(failedItem);

          // エラー時の処理継続判定
          if (!continueOnError) {
            logger.error("エラー時処理継続が無効のため、バッチ処理を中断", {
              processedCount: i + 1,
              successfulCount: successful.length,
              failedCount: failed.length,
            });

            throw new AttributeExtractionBatchError(
              failed.map((f) => f.weaponId),
              weapons.length,
              `武器ID ${weapon?.id} の処理でエラーが発生し、処理を中断: ${errorMessage}`,
              error instanceof Error ? error : undefined
            );
          }
        }
      }

      const totalTime = Date.now() - processingStartTime;
      const statistics: ProcessingStatistics = {
        totalProcessed: weapons.length,
        successful: successful.length,
        failed: failed.length,
        successRate: (successful.length / weapons.length) * 100,
        totalTime,
        averageTimePerItem: weapons.length > 0 ? totalTime / weapons.length : 0,
      };

      logger.info("武器属性一括処理完了", {
        totalWeapons: weapons.length,
        successful: successful.length,
        failed: failed.length,
        successRate: `${statistics.successRate.toFixed(2)}%`,
        totalTime: `${totalTime}ms`,
        averageTimePerItem: `${statistics.averageTimePerItem.toFixed(2)}ms`,
      });

      // 失敗率が高い場合は警告
      if (statistics.successRate < 50) {
        logger.warn("武器属性抽出の成功率が低いです", {
          successRate: `${statistics.successRate.toFixed(2)}%`,
          failedWeapons: failed.length,
        });
      }

      return {
        successful,
        failed,
        statistics,
      };
    } catch (error) {
      const totalTime = Date.now() - processingStartTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("武器属性一括処理中に致命的エラーが発生", {
        error: errorMessage,
        processedCount: successful.length + failed.length,
        totalTime: `${totalTime}ms`,
      });

      // AttributeExtractionBatchErrorの場合は再スロー
      if (error instanceof AttributeExtractionBatchError) {
        throw error;
      }

      // その他のエラーの場合は新しいバッチエラーとしてラップ
      throw new AttributeExtractionBatchError(
        failed.map((f) => f.weaponId),
        weapons.length,
        `一括処理中に致命的エラーが発生: ${errorMessage}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 抽出結果のバリデーション
   * @param weapon 元の武器データ
   * @param extractedAttributes 抽出された属性
   * @returns バリデーション結果
   */
  validateExtraction(
    weapon: Weapon,
    extractedAttributes: Stats[]
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    logger.debug("属性抽出バリデーションを開始", {
      weaponId: weapon.id,
      extractedAttributes,
      existingStats: weapon.stats,
    });

    try {
      // 抽出された属性が有効なStats型かチェック
      const validStats: Stats[] = [
        "ether",
        "fire",
        "ice",
        "physical",
        "electric",
        "frost",
        "auricInk",
      ];

      for (const attr of extractedAttributes) {
        if (!validStats.includes(attr)) {
          errors.push(`無効な属性が抽出されました: ${attr}`);
        }
      }

      // 既存のstats配列との比較
      if (weapon.stats && weapon.stats.length > 0) {
        const existingStats = new Set(weapon.stats);
        const extractedStats = new Set(extractedAttributes);

        // 既存の属性と抽出された属性の一致度をチェック
        const intersection = new Set(
          [...existingStats].filter((x) => extractedStats.has(x))
        );

        if (intersection.size === 0 && extractedAttributes.length > 0) {
          warnings.push(
            `抽出された属性が既存の属性と一致しません。既存: [${weapon.stats.join(
              ", "
            )}], 抽出: [${extractedAttributes.join(", ")}]`
          );
          suggestions.push(
            "スキル説明の内容と既存の属性データを確認してください"
          );
        }

        if (extractedAttributes.length > existingStats.size) {
          warnings.push(
            `抽出された属性数が既存の属性数より多いです。既存: ${existingStats.size}, 抽出: ${extractedAttributes.length}`
          );
        }
      }

      // 重複チェック
      const uniqueAttributes = new Set(extractedAttributes);
      if (uniqueAttributes.size !== extractedAttributes.length) {
        errors.push("抽出された属性に重複があります");
      }

      // 空のスキル説明の場合の警告
      if (
        (!weapon.equipmentSkillDesc.ja ||
          weapon.equipmentSkillDesc.ja.trim() === "") &&
        (!weapon.equipmentSkillDesc.en ||
          weapon.equipmentSkillDesc.en.trim() === "")
      ) {
        warnings.push("スキル説明が空のため、属性を抽出できませんでした");
      }

      // 抽出結果が空の場合の提案
      if (extractedAttributes.length === 0) {
        if (
          weapon.equipmentSkillDesc.ja &&
          weapon.equipmentSkillDesc.ja.length > 0
        ) {
          suggestions.push(
            "スキル説明に属性情報が含まれていない可能性があります。パターンマッチングの改善を検討してください"
          );
        }
      }

      const isValid = errors.length === 0;

      logger.debug("属性抽出バリデーション完了", {
        weaponId: weapon.id,
        isValid,
        errorCount: errors.length,
        warningCount: warnings.length,
        suggestionCount: suggestions.length,
      });

      return {
        isValid,
        errors,
        warnings,
        suggestions,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("属性抽出バリデーション中にエラーが発生", {
        weaponId: weapon.id,
        error: errorMessage,
      });

      return {
        isValid: false,
        errors: [`バリデーション処理中にエラーが発生: ${errorMessage}`],
        warnings,
        suggestions,
      };
    }
  }

  /**
   * 抽出結果の詳細バリデーション（期待パターンとの比較）
   * @param weapon 武器データ
   * @param extractionResult 詳細抽出結果
   * @returns 詳細バリデーション結果
   */
  validateExtractionWithDetails(
    weapon: Weapon,
    extractionResult: AttributeExtractionResult
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    logger.debug("詳細属性抽出バリデーションを開始", {
      weaponId: weapon.id,
      extractedAttributes: extractionResult.attributes,
      confidence: extractionResult.confidence,
      matchedPatterns: extractionResult.matchedPatterns.length,
    });

    try {
      // 基本バリデーションを実行
      const basicValidation = this.validateExtraction(
        weapon,
        extractionResult.attributes
      );
      errors.push(...basicValidation.errors);
      warnings.push(...basicValidation.warnings);
      suggestions.push(...basicValidation.suggestions);

      // 信頼度チェック
      if (extractionResult.confidence < 0.5) {
        warnings.push(
          `抽出の信頼度が低いです: ${(
            extractionResult.confidence * 100
          ).toFixed(1)}%`
        );
        suggestions.push("パターンマッチングの精度向上を検討してください");
      }

      // マッチパターンの詳細チェック
      for (const pattern of extractionResult.matchedPatterns) {
        if (pattern.matchCount === 0) {
          warnings.push(
            `属性 '${pattern.attribute}' のパターン '${pattern.pattern}' がマッチしませんでした`
          );
        }

        if (pattern.matchCount > 5) {
          warnings.push(
            `属性 '${pattern.attribute}' が異常に多くマッチしました (${pattern.matchCount}回)`
          );
          suggestions.push("スキル説明に重複した表現がないか確認してください");
        }
      }

      // 警告メッセージの処理
      if (extractionResult.warnings.length > 0) {
        warnings.push(...extractionResult.warnings);
      }

      // 期待パターンとの比較
      const expectedPatterns = this.getExpectedPatterns(weapon);
      if (expectedPatterns.length > 0) {
        const foundPatterns = extractionResult.matchedPatterns.map(
          (p) => p.pattern
        );
        const missingPatterns = expectedPatterns.filter(
          (pattern) => !foundPatterns.includes(pattern)
        );

        if (missingPatterns.length > 0) {
          warnings.push(
            `期待されるパターンが見つかりませんでした: [${missingPatterns.join(
              ", "
            )}]`
          );
          suggestions.push("パターン定義の見直しを検討してください");
        }
      }

      const isValid = errors.length === 0;

      logger.debug("詳細属性抽出バリデーション完了", {
        weaponId: weapon.id,
        isValid,
        errorCount: errors.length,
        warningCount: warnings.length,
        suggestionCount: suggestions.length,
        confidence: extractionResult.confidence,
      });

      return {
        isValid,
        errors,
        warnings,
        suggestions,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("詳細属性抽出バリデーション中にエラーが発生", {
        weaponId: weapon.id,
        error: errorMessage,
      });

      return {
        isValid: false,
        errors: [`詳細バリデーション処理中にエラーが発生: ${errorMessage}`],
        warnings,
        suggestions,
      };
    }
  }

  /**
   * 手動検証用の比較ユーティリティ
   * @param weapons 武器データの配列
   * @returns 比較結果のレポート
   */
  generateComparisonReport(weapons: Weapon[]): string {
    const report: string[] = [];
    report.push("=== 属性抽出比較レポート ===");
    report.push(`生成日時: ${new Date().toISOString()}`);
    report.push(`対象武器数: ${weapons.length}`);
    report.push("");

    let totalProcessed = 0;
    let totalMatched = 0;
    let totalMismatched = 0;
    let totalEmpty = 0;

    for (const weapon of weapons) {
      try {
        const extractedAttributes = this.extractor.extractFromMultiLang(
          weapon.equipmentSkillDesc
        );
        const extractionDetails = this.extractor.extractWithDetails(
          weapon.equipmentSkillDesc.ja,
          "ja"
        );

        totalProcessed++;

        const existingStats = weapon.stats || [];
        const hasMatch =
          existingStats.length > 0 &&
          extractedAttributes.some((attr) => existingStats.includes(attr));

        if (extractedAttributes.length === 0) {
          totalEmpty++;
        } else if (hasMatch) {
          totalMatched++;
        } else {
          totalMismatched++;
        }

        report.push(`武器ID: ${weapon.id} (${weapon.name.ja})`);
        report.push(`  既存属性: [${existingStats.join(", ")}]`);
        report.push(`  抽出属性: [${extractedAttributes.join(", ")}]`);
        report.push(
          `  信頼度: ${(extractionDetails.confidence * 100).toFixed(1)}%`
        );
        report.push(
          `  マッチ状況: ${
            hasMatch
              ? "一致"
              : extractedAttributes.length === 0
              ? "抽出なし"
              : "不一致"
          }`
        );

        if (extractionDetails.matchedPatterns.length > 0) {
          report.push("  マッチパターン:");
          for (const pattern of extractionDetails.matchedPatterns) {
            report.push(
              `    - ${pattern.attribute}: "${pattern.pattern}" (${pattern.matchCount}回)`
            );
          }
        }

        if (extractionDetails.warnings.length > 0) {
          report.push("  警告:");
          for (const warning of extractionDetails.warnings) {
            report.push(`    - ${warning}`);
          }
        }

        report.push("");
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        report.push(`武器ID: ${weapon.id} - エラー: ${errorMessage}`);
        report.push("");
      }
    }

    // 統計情報
    report.push("=== 統計情報 ===");
    report.push(`処理済み武器数: ${totalProcessed}`);
    report.push(
      `一致: ${totalMatched} (${((totalMatched / totalProcessed) * 100).toFixed(
        1
      )}%)`
    );
    report.push(
      `不一致: ${totalMismatched} (${(
        (totalMismatched / totalProcessed) *
        100
      ).toFixed(1)}%)`
    );
    report.push(
      `抽出なし: ${totalEmpty} (${((totalEmpty / totalProcessed) * 100).toFixed(
        1
      )}%)`
    );

    return report.join("\n");
  }

  /**
   * 期待されるパターンを取得（武器の既存属性に基づく）
   * @param weapon 武器データ
   * @returns 期待されるパターンの配列
   */
  private getExpectedPatterns(weapon: Weapon): string[] {
    const expectedPatterns: string[] = [];

    if (weapon.stats && weapon.stats.length > 0) {
      const attributeMapping: Record<Stats, string[]> = {
        fire: ["炎属性"],
        ice: ["氷属性"],
        electric: ["電気属性"],
        physical: ["物理属性"],
        ether: ["エーテル属性"],
        frost: ["霜烈"],
        auricInk: ["玄墨"],
      };

      for (const stat of weapon.stats) {
        const patterns = attributeMapping[stat];
        if (patterns) {
          expectedPatterns.push(...patterns);
        }
      }
    }

    return expectedPatterns;
  }
}
