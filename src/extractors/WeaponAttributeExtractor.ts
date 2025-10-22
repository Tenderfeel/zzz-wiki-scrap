import {
  Lang,
  Stats,
  AttributeExtractionResult,
  MatchedPattern,
} from "../types";
import { AttributePatterns } from "../utils/AttributePatterns";
import { AttributeMapper } from "../mappers/AttributeMapper";
import {
  AttributeExtractionError,
  AttributeExtractionPatternError,
  AttributeExtractionMappingError,
  AttributeExtractionDataError,
} from "../errors";
import { logger } from "../utils/Logger";

/**
 * 武器属性抽出クラス
 * 武器のスキル説明テキストから属性情報を抽出する
 */
export class WeaponAttributeExtractor {
  /**
   * 単一言語のスキル説明から属性を抽出
   * @param skillDescription スキル説明テキスト
   * @param language 言語（現在は'ja'のみサポート）
   * @param weaponId 武器ID（エラーログ用、オプショナル）
   * @returns 抽出された英語属性名の配列
   */
  extractAttributes(
    skillDescription: string,
    language: Lang,
    weaponId?: number
  ): Stats[] {
    const logContext = weaponId ? { weaponId } : {};

    try {
      // 空またはnullのスキル説明を処理
      if (!skillDescription || skillDescription.trim() === "") {
        logger.debug("スキル説明が空のため、属性抽出をスキップ", logContext);
        return [];
      }

      // 不正な文字列の検出と処理
      if (typeof skillDescription !== "string") {
        logger.warn("スキル説明が文字列ではありません", {
          ...logContext,
          skillDescriptionType: typeof skillDescription,
        });
        return [];
      }

      // 言語サポートチェック
      if (language !== "ja" && language !== "en") {
        logger.warn(`サポートされていない言語: ${language}`, logContext);
        return [];
      }

      // 英語の場合は現在サポートしていない
      if (language === "en") {
        logger.debug(
          "英語のスキル説明は現在サポートされていません",
          logContext
        );
        return [];
      }

      // 異常に長いテキストの処理
      if (skillDescription.length > 10000) {
        logger.warn("スキル説明が異常に長いです", {
          ...logContext,
          length: skillDescription.length,
        });
        // 最初の10000文字のみを処理
        skillDescription = skillDescription.substring(0, 10000);
      }

      logger.debug("属性抽出を開始", {
        ...logContext,
        language,
        skillDescriptionLength: skillDescription.length,
      });

      // 日本語属性パターンを検索
      const japaneseAttributes =
        AttributePatterns.findAttributePatterns(skillDescription);

      logger.debug("日本語属性パターン検索完了", {
        ...logContext,
        foundAttributes: japaneseAttributes,
      });

      // 日本語属性名を英語に変換
      const englishAttributes = AttributeMapper.mapMultipleToEnglish(
        japaneseAttributes,
        weaponId
      );

      logger.debug("属性マッピング完了", {
        ...logContext,
        japaneseAttributes,
        englishAttributes,
      });

      // 重複を除去（Set使用）
      const uniqueAttributes = Array.from(new Set(englishAttributes));

      logger.debug("属性抽出完了", {
        ...logContext,
        finalAttributes: uniqueAttributes,
      });

      return uniqueAttributes;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("属性抽出中にエラーが発生", {
        ...logContext,
        error: errorMessage,
        skillDescription:
          typeof skillDescription === "string"
            ? skillDescription.substring(0, 100) + "..."
            : String(skillDescription),
        language,
      });

      if (weaponId) {
        throw new AttributeExtractionPatternError(
          weaponId,
          `属性抽出中にエラーが発生: ${errorMessage}`,
          error instanceof Error ? error : undefined
        );
      }

      // weaponIdが指定されていない場合は空配列を返す（ベストエフォート）
      return [];
    }
  }

  /**
   * 複数言語のスキル説明から属性を抽出
   * @param skillDesc 多言語スキル説明オブジェクト
   * @param weaponId 武器ID（エラーログ用、オプショナル）
   * @returns 抽出された英語属性名の配列（重複なし）
   */
  extractFromMultiLang(
    skillDesc: { [key in Lang]: string },
    weaponId?: number
  ): Stats[] {
    const logContext = weaponId ? { weaponId } : {};
    const allAttributes = new Set<Stats>();
    const errors: string[] = [];

    try {
      // スキル説明オブジェクトの検証
      if (!skillDesc || typeof skillDesc !== "object") {
        logger.warn("スキル説明オブジェクトが無効です", {
          ...logContext,
          skillDescType: typeof skillDesc,
        });
        return [];
      }

      logger.debug("多言語属性抽出を開始", {
        ...logContext,
        availableLanguages: Object.keys(skillDesc),
      });

      // 各言語から属性を抽出
      for (const [lang, description] of Object.entries(skillDesc) as [
        Lang,
        string
      ][]) {
        try {
          const attributes = this.extractAttributes(
            description,
            lang,
            weaponId
          );
          attributes.forEach((attr) => allAttributes.add(attr));

          logger.debug(`${lang}言語からの属性抽出完了`, {
            ...logContext,
            language: lang,
            extractedAttributes: attributes,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          errors.push(`${lang}言語の処理でエラー: ${errorMessage}`);

          logger.warn(`${lang}言語の属性抽出でエラーが発生、処理を継続`, {
            ...logContext,
            language: lang,
            error: errorMessage,
          });

          // エラーが発生しても他の言語の処理を継続
          continue;
        }
      }

      const finalAttributes = Array.from(allAttributes);

      logger.debug("多言語属性抽出完了", {
        ...logContext,
        finalAttributes,
        errorCount: errors.length,
      });

      // エラーがあった場合でも、抽出できた属性があれば返す
      if (errors.length > 0 && finalAttributes.length === 0) {
        logger.warn("全ての言語で属性抽出に失敗", {
          ...logContext,
          errors,
        });

        if (weaponId) {
          throw new AttributeExtractionPatternError(
            weaponId,
            `全ての言語で属性抽出に失敗: ${errors.join(", ")}`
          );
        }
      }

      return finalAttributes;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("多言語属性抽出中にエラーが発生", {
        ...logContext,
        error: errorMessage,
      });

      if (weaponId) {
        throw new AttributeExtractionPatternError(
          weaponId,
          `多言語属性抽出中にエラーが発生: ${errorMessage}`,
          error instanceof Error ? error : undefined
        );
      }

      // ベストエフォート：エラーが発生しても空配列を返す
      return [];
    }
  }

  /**
   * 抽出結果の詳細情報を取得
   * @param skillDescription スキル説明テキスト
   * @param language 言語
   * @param weaponId 武器ID（エラーログ用、オプショナル）
   * @returns 詳細な抽出結果
   */
  extractWithDetails(
    skillDescription: string,
    language: Lang,
    weaponId?: number
  ): AttributeExtractionResult {
    const logContext = weaponId ? { weaponId } : {};
    const warnings: string[] = [];

    try {
      // 基本的な入力検証
      if (!skillDescription || skillDescription.trim() === "") {
        logger.debug("スキル説明が空のため、詳細抽出をスキップ", logContext);
        return {
          attributes: [],
          confidence: 0,
          matchedPatterns: [],
          warnings: ["スキル説明が空です"],
        };
      }

      if (typeof skillDescription !== "string") {
        logger.warn("スキル説明が文字列ではありません", {
          ...logContext,
          skillDescriptionType: typeof skillDescription,
        });
        return {
          attributes: [],
          confidence: 0,
          matchedPatterns: [],
          warnings: ["スキル説明が文字列ではありません"],
        };
      }

      if (language !== "ja" && language !== "en") {
        logger.warn(`サポートされていない言語: ${language}`, logContext);
        return {
          attributes: [],
          confidence: 0,
          matchedPatterns: [],
          warnings: [`言語 '${language}' はサポートされていません`],
        };
      }

      if (language === "en") {
        logger.debug(
          "英語のスキル説明は現在サポートされていません",
          logContext
        );
        return {
          attributes: [],
          confidence: 0,
          matchedPatterns: [],
          warnings: ["英語のスキル説明は現在サポートされていません"],
        };
      }

      // 異常に長いテキストの処理
      if (skillDescription.length > 10000) {
        warnings.push(
          `スキル説明が異常に長いです (${skillDescription.length}文字)`
        );
        skillDescription = skillDescription.substring(0, 10000);
        warnings.push("最初の10000文字のみを処理しました");
      }

      logger.debug("詳細属性抽出を開始", {
        ...logContext,
        language,
        skillDescriptionLength: skillDescription.length,
      });

      const matchedPatterns: MatchedPattern[] = [];
      const foundAttributes = new Set<Stats>();

      // 各属性パターンをチェック
      const availableAttributes = AttributePatterns.getAvailableAttributes();

      for (const japaneseAttr of availableAttributes) {
        try {
          if (
            AttributePatterns.hasAttributePattern(
              skillDescription,
              japaneseAttr
            )
          ) {
            const englishAttr = AttributeMapper.mapToEnglish(
              japaneseAttr,
              weaponId
            );

            if (englishAttr) {
              foundAttributes.add(englishAttr);

              // マッチした詳細情報を記録
              const matchCount = this.countMatches(
                skillDescription,
                japaneseAttr
              );
              const positions = this.findMatchPositions(
                skillDescription,
                japaneseAttr
              );

              matchedPatterns.push({
                attribute: englishAttr,
                pattern: japaneseAttr,
                matchCount,
                positions,
              });

              logger.debug(
                `属性パターンマッチ: ${japaneseAttr} -> ${englishAttr}`,
                {
                  ...logContext,
                  matchCount,
                  positions: positions.length,
                }
              );
            } else {
              warnings.push(
                `属性 '${japaneseAttr}' の英語マッピングが見つかりません`
              );
              logger.warn("属性マッピングが見つかりません", {
                ...logContext,
                japaneseAttribute: japaneseAttr,
              });
            }
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          warnings.push(
            `属性 '${japaneseAttr}' の処理中にエラー: ${errorMessage}`
          );
          logger.warn("属性パターンチェック中にエラー", {
            ...logContext,
            japaneseAttribute: japaneseAttr,
            error: errorMessage,
          });
          // エラーが発生しても他の属性の処理を継続
          continue;
        }
      }

      const attributes = Array.from(foundAttributes);
      const confidence = this.calculateConfidence(
        attributes.length,
        matchedPatterns
      );

      logger.debug("詳細属性抽出完了", {
        ...logContext,
        extractedAttributes: attributes,
        confidence,
        matchedPatternsCount: matchedPatterns.length,
        warningsCount: warnings.length,
      });

      return {
        attributes,
        confidence,
        matchedPatterns,
        warnings,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("詳細属性抽出中にエラーが発生", {
        ...logContext,
        error: errorMessage,
        skillDescription: skillDescription?.substring(0, 100) + "...",
        language,
      });

      return {
        attributes: [],
        confidence: 0,
        matchedPatterns: [],
        warnings: [...warnings, `詳細抽出中にエラーが発生: ${errorMessage}`],
      };
    }
  }

  /**
   * 特定の属性パターンのマッチ回数をカウント
   * @param text テキスト
   * @param japaneseAttribute 日本語属性名
   * @returns マッチ回数
   */
  private countMatches(text: string, japaneseAttribute: string): number {
    const matchDetails = AttributePatterns.getMatchDetails(
      text,
      japaneseAttribute
    );
    return matchDetails.matchCount;
  }

  /**
   * 特定の属性パターンのマッチ位置を取得
   * @param text テキスト
   * @param japaneseAttribute 日本語属性名
   * @returns マッチ位置の配列
   */
  private findMatchPositions(
    text: string,
    japaneseAttribute: string
  ): number[] {
    const matchDetails = AttributePatterns.getMatchDetails(
      text,
      japaneseAttribute
    );
    return matchDetails.positions;
  }

  /**
   * 抽出の信頼度を計算
   * @param attributeCount 抽出された属性数
   * @param matchedPatterns マッチしたパターンの詳細
   * @returns 信頼度（0-1）
   */
  private calculateConfidence(
    attributeCount: number,
    matchedPatterns: MatchedPattern[]
  ): number {
    if (attributeCount === 0) {
      return 0;
    }

    // 基本信頼度：属性が見つかった場合は0.7
    let confidence = 0.7;

    // マッチ回数による信頼度向上
    const totalMatches = matchedPatterns.reduce(
      (sum, pattern) => sum + pattern.matchCount,
      0
    );
    confidence += Math.min(totalMatches * 0.1, 0.3); // 最大0.3まで向上

    // 複数属性が見つかった場合の信頼度調整
    if (attributeCount > 1) {
      confidence = Math.min(confidence + 0.1, 1.0);
    }

    return Math.min(confidence, 1.0);
  }
}
