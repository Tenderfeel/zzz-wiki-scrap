import { Stats } from "../types";
import { AttributeExtractionMappingError } from "../errors";
import { logger } from "../utils/Logger";

/**
 * 属性マッピングクラス
 * 日本語属性名から英語属性名への変換を担当
 */
export class AttributeMapper {
  /**
   * 日本語属性名から英語属性名へのマッピング定義
   */
  private static readonly ATTRIBUTE_MAPPING: Record<string, Stats> = {
    炎属性: "fire",
    氷属性: "ice",
    電気属性: "electric",
    物理属性: "physical",
    エーテル属性: "ether",
  };

  /**
   * 日本語属性名を英語に変換
   * @param japaneseAttribute 日本語属性名
   * @param weaponId 武器ID（エラーログ用、オプショナル）
   * @returns 対応する英語属性名、存在しない場合はnull
   */
  static mapToEnglish(
    japaneseAttribute: string,
    weaponId?: number
  ): Stats | null {
    const logContext = weaponId ? { weaponId } : {};

    try {
      // 入力検証
      if (!japaneseAttribute) {
        logger.debug("空の日本語属性名が渡されました", logContext);
        return null;
      }

      if (typeof japaneseAttribute !== "string") {
        logger.warn("日本語属性名が文字列ではありません", {
          ...logContext,
          attributeType: typeof japaneseAttribute,
          attribute: japaneseAttribute,
        });
        return null;
      }

      // 前後の空白を除去
      const trimmedAttribute = japaneseAttribute.trim();

      if (trimmedAttribute === "") {
        logger.debug("空白のみの日本語属性名が渡されました", logContext);
        return null;
      }

      const result = this.ATTRIBUTE_MAPPING[trimmedAttribute] || null;

      if (result === null) {
        logger.debug("未知の日本語属性名です", {
          ...logContext,
          japaneseAttribute: trimmedAttribute,
          supportedAttributes: Object.keys(this.ATTRIBUTE_MAPPING),
        });
      } else {
        logger.debug("属性マッピング成功", {
          ...logContext,
          japaneseAttribute: trimmedAttribute,
          englishAttribute: result,
        });
      }

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("属性マッピング中にエラーが発生", {
        ...logContext,
        japaneseAttribute,
        error: errorMessage,
      });

      if (weaponId) {
        throw new AttributeExtractionMappingError(
          weaponId,
          `属性マッピング中にエラーが発生: ${errorMessage}`,
          error instanceof Error ? error : undefined
        );
      }

      return null;
    }
  }

  /**
   * 複数の日本語属性名を英語に変換
   * @param japaneseAttributes 日本語属性名の配列
   * @param weaponId 武器ID（エラーログ用、オプショナル）
   * @returns 対応する英語属性名の配列（変換できないものは除外）
   */
  static mapMultipleToEnglish(
    japaneseAttributes: string[],
    weaponId?: number
  ): Stats[] {
    const logContext = weaponId ? { weaponId } : {};

    try {
      // 入力検証
      if (!japaneseAttributes) {
        logger.debug("日本語属性名の配列がnullまたはundefinedです", logContext);
        return [];
      }

      if (!Array.isArray(japaneseAttributes)) {
        logger.warn("日本語属性名が配列ではありません", {
          ...logContext,
          attributesType: typeof japaneseAttributes,
        });
        return [];
      }

      if (japaneseAttributes.length === 0) {
        logger.debug("空の日本語属性名配列が渡されました", logContext);
        return [];
      }

      logger.debug("複数属性マッピングを開始", {
        ...logContext,
        inputAttributes: japaneseAttributes,
        inputCount: japaneseAttributes.length,
      });

      const results: Stats[] = [];
      const errors: string[] = [];

      for (let i = 0; i < japaneseAttributes.length; i++) {
        const attr = japaneseAttributes[i];

        try {
          const mappedAttr = this.mapToEnglish(attr, weaponId);
          if (mappedAttr !== null) {
            results.push(mappedAttr);
          } else {
            errors.push(`インデックス ${i}: "${attr}" は未知の属性名です`);
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          errors.push(
            `インデックス ${i}: "${attr}" の処理でエラー: ${errorMessage}`
          );

          // 個別のエラーはログに記録するが、処理は継続
          logger.warn("個別属性マッピングでエラー", {
            ...logContext,
            index: i,
            attribute: attr,
            error: errorMessage,
          });
        }
      }

      if (errors.length > 0) {
        logger.debug("一部の属性マッピングに失敗", {
          ...logContext,
          errors,
          successfulCount: results.length,
          failedCount: errors.length,
        });
      }

      logger.debug("複数属性マッピング完了", {
        ...logContext,
        inputCount: japaneseAttributes.length,
        outputCount: results.length,
        outputAttributes: results,
      });

      return results;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("複数属性マッピング中にエラーが発生", {
        ...logContext,
        japaneseAttributes,
        error: errorMessage,
      });

      if (weaponId) {
        throw new AttributeExtractionMappingError(
          weaponId,
          `複数属性マッピング中にエラーが発生: ${errorMessage}`,
          error instanceof Error ? error : undefined
        );
      }

      return [];
    }
  }

  /**
   * 英語属性名が有効かチェック
   * @param attribute チェックする属性名
   * @returns 有効な属性名の場合true
   */
  static isValidAttribute(attribute: string): attribute is Stats {
    return Object.values(this.ATTRIBUTE_MAPPING).includes(attribute as Stats);
  }

  /**
   * 利用可能な属性マッピングの一覧を取得
   * @returns 日本語→英語のマッピングオブジェクト
   */
  static getAttributeMapping(): Record<string, Stats> {
    return { ...this.ATTRIBUTE_MAPPING };
  }

  /**
   * サポートされている日本語属性名の一覧を取得
   * @returns 日本語属性名の配列
   */
  static getSupportedJapaneseAttributes(): string[] {
    return Object.keys(this.ATTRIBUTE_MAPPING);
  }

  /**
   * サポートされている英語属性名の一覧を取得
   * @returns 英語属性名の配列
   */
  static getSupportedEnglishAttributes(): Stats[] {
    return Object.values(this.ATTRIBUTE_MAPPING);
  }
}
