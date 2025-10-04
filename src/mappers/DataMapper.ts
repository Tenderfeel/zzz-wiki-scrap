import { Specialty, Stats, AttackType, Rarity, Lang } from "../types/index.js";
import { MappingError } from "../errors";
import { AttackTypeFallbackService } from "../services/index.js";
import { logger, LogMessages } from "../utils/Logger.js";

/**
 * データマッピング機能を提供するクラス
 * 日本語の生データを英語の列挙値にマッピングし、多言語オブジェクトを生成する
 */
export class DataMapper {
  private attackTypeFallback: AttackTypeFallbackService;

  /**
   * DataMapperのコンストラクタ
   * AttackTypeFallbackServiceを初期化し、依存性注入を行う
   */
  constructor() {
    this.attackTypeFallback = new AttackTypeFallbackService();
    // サービスの初期化（非同期だが、コンストラクタでは待機しない）
    this.attackTypeFallback.initialize().catch((error) => {
      logger.error(
        "Failed to initialize AttackTypeFallbackService in DataMapper",
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
    });
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
    氷属性: "ice",
    炎属性: "fire",
    電気属性: "electric",
    物理属性: "physical",
    エーテル属性: "ether",
    霜烈属性: "frostAttribute",
    玄墨属性: "auricInk",
  };

  // 攻撃タイプマッピング
  private static readonly ATTACK_TYPE_MAPPING: Record<string, AttackType> = {
    打撃: "strike",
    斬撃: "slash",
    刺突: "pierce",
  };

  // レア度マッピング
  private static readonly RARITY_MAPPING: Record<string, Rarity> = {
    S: "S",
    A: "A",
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
   * 日本語の攻撃タイプ名を英語の列挙値にマッピング
   * フォールバック機能付きで、wiki データから取得できない場合は
   * json/data/list.json からの取得を試行する
   * @param rawAttackType 日本語の攻撃タイプ名
   * @param pageId キャラクターのページID（フォールバック用、オプション）
   * @returns 対応するAttackType列挙値
   * @throws MappingError 未知の攻撃タイプ名でフォールバックも失敗した場合
   */
  public mapAttackType(rawAttackType: string, pageId?: string): AttackType {
    // 既存の日本語マッピングを優先して試行
    const mapped = DataMapper.ATTACK_TYPE_MAPPING[rawAttackType];
    if (mapped) {
      logger.debug(LogMessages.WIKI_DATA_USED, {
        rawAttackType,
        mappedValue: mapped,
      });
      return mapped;
    }

    // 日本語マッピングが失敗し、pageIdが提供されている場合はフォールバック機能を使用
    if (pageId !== undefined) {
      logger.info("Wiki data mapping failed, trying fallback", {
        rawAttackType,
        pageId,
      });
      return this.mapAttackTypeWithFallback(rawAttackType, pageId);
    }

    // フォールバック機能も使用できない場合はエラー
    throw new MappingError(
      `未知の攻撃タイプ値です: "${rawAttackType}". 有効な値: ${Object.keys(
        DataMapper.ATTACK_TYPE_MAPPING
      ).join(", ")}`
    );
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
   * フォールバック機能付きの攻撃タイプマッピング
   * wiki データ取得失敗時にjson/data/list.jsonからの取得を試行する
   * @param rawAttackType 日本語の攻撃タイプ名（失敗したもの）
   * @param pageId キャラクターのページID
   * @returns 攻撃タイプ（フォールバックまたはデフォルト値）
   */
  private mapAttackTypeWithFallback(
    rawAttackType: string,
    pageId: string
  ): AttackType {
    try {
      // AttackTypeFallbackServiceを使用してフォールバック取得を試行
      const fallbackResult =
        this.attackTypeFallback.getAttackTypeByPageId(pageId);

      if (fallbackResult) {
        logger.info(LogMessages.FALLBACK_USED, {
          pageId,
          result: fallbackResult,
        });
        return fallbackResult;
      }

      // フォールバックも失敗した場合はデフォルト値を使用
      logger.warn(LogMessages.MAPPING_FALLBACK_TO_DEFAULT, {
        pageId,
        rawAttackType,
        defaultValue: "strike",
      });
      return "strike";
    } catch (error) {
      // フォールバック処理中にエラーが発生した場合
      logger.error("Error during fallback processing", {
        pageId,
        error: error instanceof Error ? error.message : String(error),
      });

      // エラー時もデフォルト値"strike"を返して処理を継続
      logger.info("Using default value for error recovery", {
        pageId,
        defaultValue: "strike",
      });
      return "strike";
    }
  }

  /**
   * 利用可能なマッピング値を取得（デバッグ用）
   */
  public static getAvailableMappings() {
    return {
      specialty: Object.keys(DataMapper.SPECIALTY_MAPPING),
      stats: Object.keys(DataMapper.STATS_MAPPING),
      attackType: Object.keys(DataMapper.ATTACK_TYPE_MAPPING),
      rarity: Object.keys(DataMapper.RARITY_MAPPING),
    };
  }
}
