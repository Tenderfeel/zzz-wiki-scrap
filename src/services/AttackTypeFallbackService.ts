import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { AttackType, ListJsonData } from "../types/index.js";
import { logger, LogMessages } from "../utils/Logger.js";

/**
 * 攻撃タイプのフォールバック機能を提供するサービスクラス
 * json/data/list.json から攻撃タイプ情報を取得し、
 * wiki データから取得できなかった場合のフォールバック機能を提供する
 */
export class AttackTypeFallbackService {
  private listData: ListJsonData | null = null;
  private isInitialized: boolean = false;

  /**
   * list.jsonデータの初期化（一度だけ実行）
   * ファイルの存在確認、読み込み、JSON解析を行う
   */
  public async initialize(): Promise<void> {
    // 既に初期化済みの場合は何もしない
    if (this.isInitialized) {
      return;
    }

    const listJsonPath = join(process.cwd(), "json", "data", "list.json");

    try {
      // ファイル存在確認
      if (!existsSync(listJsonPath)) {
        logger.warn(LogMessages.LIST_JSON_NOT_FOUND, { path: listJsonPath });
        this.isInitialized = true;
        return;
      }

      // ファイル読み込み
      const fileContent = readFileSync(listJsonPath, "utf-8");

      // JSON解析と型安全性の確保
      const parsedData = JSON.parse(fileContent) as ListJsonData;

      // データ構造の基本的な検証
      if (!parsedData.data || !Array.isArray(parsedData.data.list)) {
        throw new Error("Invalid list.json structure: missing data.list array");
      }

      this.listData = parsedData;
      logger.info(LogMessages.FALLBACK_SERVICE_INITIALIZED, {
        characterCount: parsedData.data.list.length,
      });
    } catch (error) {
      logger.error(LogMessages.FALLBACK_SERVICE_INIT_ERROR, {
        error: error instanceof Error ? error.message : String(error),
      });
      this.listData = null;
    } finally {
      this.isInitialized = true;
    }
  }

  /**
   * キャラクターのページIDに基づいて攻撃タイプを取得
   * @param pageId キャラクターのページID
   * @returns 攻撃タイプ（見つからない場合はnull）
   */
  public getAttackTypeByPageId(pageId: string): AttackType | null {
    // 初期化されていない、またはデータが存在しない場合
    if (!this.isInitialized || !this.listData) {
      logger.debug("AttackTypeFallbackService not available", { pageId });
      return null;
    }

    // キャラクターを検索
    const character = this.listData.data.list.find(
      (item) => item.entry_page_id === pageId
    );

    if (!character) {
      logger.debug(LogMessages.CHARACTER_NOT_FOUND_IN_LIST, { pageId });
      return null;
    }

    // 攻撃タイプ情報の取得
    const attackTypeData = character.filter_values.agent_attack_type;
    if (
      !attackTypeData ||
      !attackTypeData.values ||
      attackTypeData.values.length === 0
    ) {
      logger.debug("No attack type data found for character", {
        characterName: character.name,
        pageId,
      });
      return null;
    }

    // 複数攻撃タイプがある場合は最初の値を使用
    const englishAttackType = attackTypeData.values[0];
    logger.debug(LogMessages.CHARACTER_FOUND_IN_LIST, {
      characterName: character.name,
      pageId,
      attackType: englishAttackType,
    });

    // 英語の攻撃タイプをenum値にマッピング
    return this.mapEnglishAttackType(englishAttackType);
  }

  /**
   * 英語の攻撃タイプ値をenum値にマッピング
   * @param englishValue 英語の攻撃タイプ値（"Slash", "Pierce", "Strike"）
   * @returns 対応するAttackType enum値（マッピングできない場合はnull）
   */
  private mapEnglishAttackType(englishValue: string): AttackType | null {
    const mapping: Record<string, AttackType> = {
      Slash: "slash",
      Pierce: "pierce",
      Strike: "strike",
    };

    const mappedValue = mapping[englishValue];

    if (!mappedValue) {
      logger.warn(LogMessages.UNKNOWN_ATTACK_TYPE, {
        englishValue,
        defaultValue: "strike",
      });
      return "strike"; // デフォルト値として"strike"を返す
    }

    logger.debug(LogMessages.ATTACK_TYPE_MAPPED, {
      englishValue,
      mappedValue,
    });
    return mappedValue;
  }
}
