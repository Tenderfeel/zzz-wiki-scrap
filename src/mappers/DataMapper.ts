import { Specialty, Stats, Rarity, Lang, AssistType } from "../types/index";
import { MappingError } from "../errors";
import { logger, LogMessages } from "../utils/Logger";
import { NameResolver } from "./NameResolver";

/**
 * データマッピング機能を提供するクラス
 * 日本語の生データを英語の列挙値にマッピングし、多言語オブジェクトを生成する
 */
export class DataMapper {
  private nameResolver: NameResolver;

  /**
   * DataMapperのコンストラクタ
   * @param nameResolver 名前解決機能を提供するNameResolverインスタンス
   */
  constructor(nameResolver?: NameResolver) {
    this.nameResolver = nameResolver || new NameResolver();

    // 初期化時に名前マッピングファイルの可用性をチェック
    const availability = this.nameResolver.checkMappingFileAvailability();
    if (!availability.available) {
      logger.warn("名前マッピング機能が制限されます", {
        reason: availability.error,
        fallbackMode: availability.fallbackMode,
      });
    }
  }
  // 特性マッピング
  private static readonly SPECIALTY_MAPPING: Record<string, Specialty> = {
    撃破: "stun",
    強攻: "attack",
    異常: "anomaly",
    支援: "support",
    防護: "defense",
    命破: "rupture",
  };

  // 属性マッピング
  private static readonly STATS_MAPPING: Record<string, Stats> = {
    // 日本語属性名
    氷属性: "ice",
    炎属性: "fire",
    電気属性: "electric",
    物理属性: "physical",
    エーテル属性: "ether",
    霜烈属性: "frost",
    玄墨属性: "auricInk",
    // 英語属性名（APIから直接返される場合）
    ice: "ice",
    fire: "fire",
    electric: "electric",
    physical: "physical",
    ether: "ether",
    frost: "frost",
    auricInk: "auricInk",
    // 英語属性名（大文字）
    Ice: "ice",
    Fire: "fire",
    Electric: "electric",
    Physical: "physical",
    Ether: "ether",
    Frost: "frost",
    "Auric Ink": "auricInk",
    "Frost Attribute": "frost",
  };

  // レア度マッピング
  private static readonly RARITY_MAPPING: Record<string, Rarity> = {
    S: "S",
    A: "A",
  };

  // 支援タイプマッピング
  private static readonly ASSIST_TYPE_MAPPING: Record<string, AssistType> = {
    回避支援: "evasive",
    パリィ支援: "defensive",
    "Evasive Assist": "evasive",
    "Defensive Assist": "defensive",
  };

  /**
   * 日本語の特性名を英語の列挙値にマッピング
   * @param rawSpecialty 日本語の特性名
   * @returns 対応するSpecialty列挙値
   * @throws MappingError 未知の特性名の場合
   */
  public mapSpecialty(rawSpecialty: string): Specialty {
    const mapped = DataMapper.SPECIALTY_MAPPING[rawSpecialty];
    if (!mapped) {
      throw new MappingError(
        `未知の特性値です: "${rawSpecialty}". 有効な値: ${Object.keys(
          DataMapper.SPECIALTY_MAPPING
        ).join(", ")}`
      );
    }
    return mapped;
  }

  /**
   * 日本語の属性名を英語の列挙値にマッピング
   * @param rawStats 日本語の属性名
   * @returns 対応するStats列挙値
   * @throws MappingError 未知の属性名の場合
   */
  public mapStats(rawStats: string): Stats {
    const mapped = DataMapper.STATS_MAPPING[rawStats];
    if (!mapped) {
      throw new MappingError(
        `未知の属性値です: "${rawStats}". 有効な値: ${Object.keys(
          DataMapper.STATS_MAPPING
        ).join(", ")}`
      );
    }
    return mapped;
  }

  /**
   * レア度文字列を列挙値にマッピング
   * @param rawRarity レア度文字列
   * @returns 対応するRarity列挙値
   * @throws MappingError 未知のレア度の場合
   */
  public mapRarity(rawRarity: string): Rarity {
    const mapped = DataMapper.RARITY_MAPPING[rawRarity];
    if (!mapped) {
      throw new MappingError(
        `未知のレア度値です: "${rawRarity}". 有効な値: ${Object.keys(
          DataMapper.RARITY_MAPPING
        ).join(", ")}`
      );
    }
    return mapped;
  }

  /**
   * 日本語または英語の支援タイプ名を英語の列挙値にマッピング
   * @param rawAssistType 日本語または英語の支援タイプ名
   * @returns 対応するAssistType列挙値、または未知の値の場合はundefined
   */
  public mapAssistType(rawAssistType: string): AssistType | undefined {
    // 入力値の検証
    if (!rawAssistType || typeof rawAssistType !== "string") {
      logger.debug("支援タイプの入力値が無効です", {
        rawAssistType,
        type: typeof rawAssistType,
      });
      return undefined;
    }

    const trimmedValue = rawAssistType.trim();
    if (trimmedValue === "") {
      logger.debug("支援タイプの入力値が空文字列です");
      return undefined;
    }

    // マッピングを試行
    const mapped = DataMapper.ASSIST_TYPE_MAPPING[trimmedValue];

    if (mapped) {
      logger.debug("支援タイプマッピング成功", {
        input: trimmedValue,
        output: mapped,
      });
      return mapped;
    }

    // 未知の値の場合は警告をログ出力し、undefinedを返す
    logger.warn("未知の支援タイプ値です", {
      rawAssistType: trimmedValue,
      availableValues: Object.keys(DataMapper.ASSIST_TYPE_MAPPING),
    });

    return undefined;
  }

  /**
   * 日本語と英語のデータから多言語名オブジェクトを生成
   * @param jaName 日本語名
   * @param enName 英語名
   * @returns 多言語名オブジェクト
   * @throws MappingError 名前が空または無効な場合
   */
  public createMultiLangName(
    jaName: string,
    enName: string
  ): { [key in Lang]: string } {
    if (!jaName || jaName.trim() === "") {
      throw new MappingError("日本語名が空または無効です");
    }
    if (!enName || enName.trim() === "") {
      throw new MappingError("英語名が空または無効です");
    }

    return {
      ja: jaName.trim(),
      en: enName.trim(),
    };
  }

  /**
   * キャラクターIDから事前定義された名前マッピングを取得
   * @param characterId キャラクターID
   * @returns 多言語名オブジェクト、マッピングが見つからない場合はnull
   */
  public createNamesFromMapping(
    characterId: string
  ): { [key in Lang]: string } | null {
    if (!characterId || characterId.trim() === "") {
      logger.warn("キャラクターIDが空または無効です", {
        characterId,
        type: typeof characterId,
      });
      return null;
    }

    const normalizedId = characterId.toLowerCase().trim();
    logger.debug(`名前マッピング取得を試行: ${normalizedId}`, {
      originalId: characterId,
      normalizedId,
    });

    try {
      const mapping = this.nameResolver.resolveNames(normalizedId);

      if (!mapping) {
        logger.debug(
          `キャラクターID "${normalizedId}" の名前マッピングが見つかりません`,
          {
            characterId: normalizedId,
            mappingStats: this.nameResolver.getMappingStats(),
          }
        );
        return null;
      }

      logger.debug(`名前マッピング取得成功: ${normalizedId}`, {
        characterId: normalizedId,
        jaName: mapping.ja,
        enName: mapping.en,
      });

      return {
        ja: mapping.ja,
        en: mapping.en,
      };
    } catch (error) {
      logger.error(
        `名前マッピング取得中にエラーが発生しました (ID: ${normalizedId})`,
        {
          characterId: normalizedId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }
      );
      return null;
    }
  }

  /**
   * 名前マッピングが見つからない場合のフォールバック処理を提供
   * @param characterId キャラクターID
   * @param fallbackJaName フォールバック用日本語名
   * @param fallbackEnName フォールバック用英語名
   * @returns 多言語名オブジェクト
   * @throws MappingError フォールバック名が無効な場合
   */
  public createNamesWithFallback(
    characterId: string,
    fallbackJaName: string,
    fallbackEnName: string
  ): { [key in Lang]: string } {
    logger.debug(LogMessages.NAME_FALLBACK_START, {
      characterId,
      fallbackJaName,
      fallbackEnName,
    });

    // 入力パラメータの事前検証
    if (!characterId || characterId.trim() === "") {
      logger.error(LogMessages.NAME_FALLBACK_INVALID_INPUT, {
        issue: "characterId_empty",
        characterId,
        characterIdType: typeof characterId,
      });
      throw new MappingError("キャラクターIDが空または無効です");
    }

    try {
      // まず事前定義されたマッピングを試行
      logger.debug(LogMessages.NAME_FALLBACK_MAPPING_ATTEMPT, {
        characterId,
        step: "predefined_mapping_check",
      });

      const mappedNames = this.createNamesFromMapping(characterId);

      if (mappedNames) {
        logger.info(LogMessages.NAME_FALLBACK_USE_PREDEFINED, {
          characterId,
          source: "predefined_mapping",
          jaName: mappedNames.ja,
          enName: mappedNames.en,
        });
        return mappedNames;
      }

      // マッピングが見つからない場合、フォールバック処理
      logger.warn(LogMessages.NAME_FALLBACK_WARNING_ISSUED, {
        characterId,
        fallbackJaName,
        fallbackEnName,
        mappingStats: this.nameResolver.getMappingStats(),
        availableCharacterIds: this.nameResolver
          .getMappingStats()
          .characterIds.slice(0, 10),
      });

      // フォールバック名の詳細検証
      const validationErrors: string[] = [];

      if (!fallbackJaName || typeof fallbackJaName !== "string") {
        validationErrors.push("日本語名が文字列ではありません");
      } else if (fallbackJaName.trim() === "") {
        validationErrors.push("日本語名が空です");
      }

      if (!fallbackEnName || typeof fallbackEnName !== "string") {
        validationErrors.push("英語名が文字列ではありません");
      } else if (fallbackEnName.trim() === "") {
        validationErrors.push("英語名が空です");
      }

      if (validationErrors.length > 0) {
        const errorMessage = `フォールバック名の検証に失敗しました (キャラクターID: ${characterId}): ${validationErrors.join(
          ", "
        )}`;
        logger.error(LogMessages.NAME_FALLBACK_ERROR, {
          characterId,
          validationErrors,
          fallbackJaName,
          fallbackEnName,
          fallbackJaType: typeof fallbackJaName,
          fallbackEnType: typeof fallbackEnName,
        });
        throw new MappingError(errorMessage);
      }

      // フォールバック名の正規化
      const normalizedFallbackNames = {
        ja: fallbackJaName.trim(),
        en: fallbackEnName.trim(),
      };

      // 追加の品質チェック
      if (normalizedFallbackNames.ja.length > 100) {
        logger.warn("フォールバック日本語名が異常に長いです", {
          characterId,
          jaNameLength: normalizedFallbackNames.ja.length,
          jaName: normalizedFallbackNames.ja.substring(0, 50) + "...",
        });
      }

      if (normalizedFallbackNames.en.length > 100) {
        logger.warn("フォールバック英語名が異常に長いです", {
          characterId,
          enNameLength: normalizedFallbackNames.en.length,
          enName: normalizedFallbackNames.en.substring(0, 50) + "...",
        });
      }

      logger.info(LogMessages.NAME_FALLBACK_API_NAMES_USED, {
        characterId,
        source: "api_fallback",
        jaName: normalizedFallbackNames.ja,
        enName: normalizedFallbackNames.en,
        reason: "mapping_not_found",
        fallbackQuality: "validated",
      });

      return normalizedFallbackNames;
    } catch (error) {
      if (error instanceof MappingError) {
        // 既にログ出力済みのMappingErrorはそのまま再スロー
        throw error;
      }

      // 予期しないエラーの処理
      logger.error(LogMessages.NAME_FALLBACK_ERROR, {
        characterId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        fallbackJaName,
        fallbackEnName,
      });

      throw new MappingError(
        `フォールバック処理中に予期しないエラーが発生しました (キャラクターID: ${characterId})`,
        error as Error
      );
    }
  }

  /**
   * 名前マッピングエラーからの回復を試行する拡張フォールバック処理
   * @param characterId キャラクターID
   * @param fallbackJaName フォールバック用日本語名
   * @param fallbackEnName フォールバック用英語名
   * @param retryCount リトライ回数
   * @returns 多言語名オブジェクト
   */
  public createNamesWithExtendedFallback(
    characterId: string,
    fallbackJaName: string,
    fallbackEnName: string,
    retryCount: number = 1
  ): { [key in Lang]: string } {
    logger.debug("拡張フォールバック処理を開始", {
      characterId,
      retryCount,
      fallbackJaName,
      fallbackEnName,
    });

    try {
      return this.createNamesWithFallback(
        characterId,
        fallbackJaName,
        fallbackEnName
      );
    } catch (error) {
      if (retryCount > 0 && error instanceof MappingError) {
        logger.info(LogMessages.ERROR_RECOVERY_ATTEMPT, {
          characterId,
          retryCount,
          errorMessage: error.message,
        });

        // NameResolverでエラー回復を試行
        const recoveredMapping = this.nameResolver.attemptErrorRecovery(
          error,
          characterId
        );

        if (recoveredMapping) {
          logger.info(LogMessages.ERROR_RECOVERY_SUCCESS, {
            characterId,
            jaName: recoveredMapping.ja,
            enName: recoveredMapping.en,
          });
          return {
            ja: recoveredMapping.ja,
            en: recoveredMapping.en,
          };
        }

        // 回復に失敗した場合、リトライ
        logger.debug("エラー回復に失敗、リトライを実行", {
          characterId,
          remainingRetries: retryCount - 1,
        });

        return this.createNamesWithExtendedFallback(
          characterId,
          fallbackJaName,
          fallbackEnName,
          retryCount - 1
        );
      }

      // リトライ回数を超過した場合、段階的縮退を実行
      const degradationResult =
        this.nameResolver.gracefulDegradation(characterId);

      logger.error(LogMessages.CRITICAL_ERROR_DETECTED, {
        characterId,
        degradationMode: degradationResult.mode,
        reason: degradationResult.reason,
        suggestion: degradationResult.suggestion,
        originalError: error instanceof Error ? error.message : String(error),
      });

      // 最終的にはフォールバック名を使用（検証なし）
      if (fallbackJaName && fallbackEnName) {
        logger.warn("検証なしでフォールバック名を使用", {
          characterId,
          jaName: fallbackJaName,
          enName: fallbackEnName,
          reason: "critical_error_recovery",
        });

        return {
          ja: fallbackJaName.trim() || "Unknown",
          en: fallbackEnName.trim() || "Unknown",
        };
      }

      // 完全に失敗した場合のデフォルト値
      logger.error("すべてのフォールバック処理が失敗、デフォルト名を使用", {
        characterId,
      });

      return {
        ja: "不明なキャラクター",
        en: "Unknown Character",
      };
    }
  }

  /**
   * バージョン文字列から数値を抽出
   * @param versionString "Ver.1.0「バージョン名」" 形式の文字列
   * @returns 数値バージョン（例: 1.0）、解析失敗時はnull
   */
  public parseVersionNumber(versionString: string): number | null {
    // 入力値の検証
    if (!versionString || typeof versionString !== "string") {
      logger.debug("バージョン文字列の入力値が無効です", {
        versionString,
        type: typeof versionString,
      });
      return null;
    }

    const trimmedValue = versionString.trim();
    if (trimmedValue === "") {
      logger.debug("バージョン文字列の入力値が空文字列です");
      return null;
    }

    try {
      // HTMLタグを除去
      const cleanedString = trimmedValue.replace(/<[^>]*>/g, "");

      // Ver.X.Y パターンを抽出する正規表現
      const VERSION_PATTERN = /Ver\.(\d+\.\d+)/;
      const match = cleanedString.match(VERSION_PATTERN);

      if (!match || !match[1]) {
        logger.debug("バージョンパターンが見つかりません", {
          originalString: versionString,
          cleanedString,
          pattern: VERSION_PATTERN.source,
        });
        return null;
      }

      // 数値変換
      const versionNumber = parseFloat(match[1]);

      if (isNaN(versionNumber)) {
        logger.warn("バージョン数値変換に失敗しました", {
          originalString: versionString,
          extractedVersion: match[1],
          parsedValue: versionNumber,
        });
        return null;
      }

      logger.debug("バージョン解析成功", {
        originalString: versionString,
        cleanedString,
        extractedVersion: match[1],
        parsedVersion: versionNumber,
      });

      return versionNumber;
    } catch (error) {
      logger.error("バージョン解析中にエラーが発生しました", {
        versionString,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return null;
    }
  }

  /**
   * 利用可能なマッピング値を取得（デバッグ用）
   */
  public static getAvailableMappings() {
    return {
      specialty: Object.keys(DataMapper.SPECIALTY_MAPPING),
      stats: Object.keys(DataMapper.STATS_MAPPING),
      rarity: Object.keys(DataMapper.RARITY_MAPPING),
      assistType: Object.keys(DataMapper.ASSIST_TYPE_MAPPING),
    };
  }
}
