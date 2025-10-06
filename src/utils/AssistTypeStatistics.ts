import { AssistType } from "../types/index";
import { logger } from "./Logger";

/**
 * 支援タイプ統計情報を管理するクラス
 */
export class AssistTypeStatistics {
  private statistics: {
    total: number;
    evasive: number;
    defensive: number;
    unknown: number;
    errors: number;
  };

  private characterDetails: {
    evasive: string[];
    defensive: string[];
    unknown: string[];
    errors: Array<{ characterId: string; error: string }>;
  };

  constructor() {
    this.statistics = {
      total: 0,
      evasive: 0,
      defensive: 0,
      unknown: 0,
      errors: 0,
    };

    this.characterDetails = {
      evasive: [],
      defensive: [],
      unknown: [],
      errors: [],
    };
  }

  /**
   * キャラクターの支援タイプ処理結果を記録
   * @param characterId キャラクターID
   * @param assistType 支援タイプ（undefinedの場合は不明として記録）
   */
  public recordCharacter(
    characterId: string,
    assistType: AssistType | undefined
  ): void {
    this.statistics.total++;

    if (assistType === "evasive") {
      this.statistics.evasive++;
      this.characterDetails.evasive.push(characterId);
      logger.debug("支援タイプ統計: 回避支援キャラクターを記録", {
        characterId,
        assistType,
      });
    } else if (assistType === "defensive") {
      this.statistics.defensive++;
      this.characterDetails.defensive.push(characterId);
      logger.debug("支援タイプ統計: パリィ支援キャラクターを記録", {
        characterId,
        assistType,
      });
    } else {
      this.statistics.unknown++;
      this.characterDetails.unknown.push(characterId);
      logger.debug("支援タイプ統計: 支援タイプ不明キャラクターを記録", {
        characterId,
        assistType: "unknown",
      });
    }
  }

  /**
   * エラーが発生したキャラクターを記録
   * @param characterId キャラクターID
   * @param error エラーメッセージ
   */
  public recordError(characterId: string, error: string): void {
    this.statistics.errors++;
    this.characterDetails.errors.push({ characterId, error });
    logger.debug("支援タイプ統計: エラーを記録", {
      characterId,
      error,
    });
  }

  /**
   * 統計情報を取得
   */
  public getStatistics() {
    return { ...this.statistics };
  }

  /**
   * 詳細情報を取得
   */
  public getDetails() {
    return {
      evasive: [...this.characterDetails.evasive],
      defensive: [...this.characterDetails.defensive],
      unknown: [...this.characterDetails.unknown],
      errors: [...this.characterDetails.errors],
    };
  }

  /**
   * 統計情報をログに出力
   */
  public logStatistics(): void {
    const stats = this.getStatistics();
    const details = this.getDetails();

    logger.info("支援タイプ処理統計情報", {
      summary: {
        総キャラクター数: stats.total,
        回避支援: stats.evasive,
        パリィ支援: stats.defensive,
        支援タイプ不明: stats.unknown,
        処理エラー: stats.errors,
      },
      percentages: {
        回避支援率:
          stats.total > 0
            ? ((stats.evasive / stats.total) * 100).toFixed(1) + "%"
            : "0%",
        パリィ支援率:
          stats.total > 0
            ? ((stats.defensive / stats.total) * 100).toFixed(1) + "%"
            : "0%",
        不明率:
          stats.total > 0
            ? ((stats.unknown / stats.total) * 100).toFixed(1) + "%"
            : "0%",
        エラー率:
          stats.total > 0
            ? ((stats.errors / stats.total) * 100).toFixed(1) + "%"
            : "0%",
      },
    });

    // 詳細情報をデバッグレベルで出力
    if (details.evasive.length > 0) {
      logger.debug("回避支援キャラクター一覧", {
        count: details.evasive.length,
        characters: details.evasive,
      });
    }

    if (details.defensive.length > 0) {
      logger.debug("パリィ支援キャラクター一覧", {
        count: details.defensive.length,
        characters: details.defensive,
      });
    }

    if (details.unknown.length > 0) {
      logger.debug("支援タイプ不明キャラクター一覧", {
        count: details.unknown.length,
        characters: details.unknown,
      });
    }

    if (details.errors.length > 0) {
      logger.warn("支援タイプ処理エラー一覧", {
        count: details.errors.length,
        errors: details.errors,
      });
    }
  }

  /**
   * 統計情報をリセット
   */
  public reset(): void {
    this.statistics = {
      total: 0,
      evasive: 0,
      defensive: 0,
      unknown: 0,
      errors: 0,
    };

    this.characterDetails = {
      evasive: [],
      defensive: [],
      unknown: [],
      errors: [],
    };

    logger.debug("支援タイプ統計情報をリセット");
  }

  /**
   * 統計サマリーを文字列として取得
   */
  public getSummaryString(): string {
    const stats = this.getStatistics();
    return `支援タイプ統計: 総数=${stats.total}, 回避=${stats.evasive}, パリィ=${stats.defensive}, 不明=${stats.unknown}, エラー=${stats.errors}`;
  }
}
