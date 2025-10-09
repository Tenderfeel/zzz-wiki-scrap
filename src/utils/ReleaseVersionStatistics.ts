import { logger } from "./Logger";

/**
 * 実装バージョン抽出の統計情報を管理するクラス
 */
export class ReleaseVersionStatistics {
  private statistics = {
    total: 0,
    successful: 0,
    failed: 0,
    defaultUsed: 0,
    parseErrors: 0,
    missingData: 0,
  };

  private versionDistribution: Map<number, number> = new Map();
  private characterDetails: {
    successful: Array<{
      characterId: string;
      version: number;
      rawString: string;
    }>;
    failed: Array<{ characterId: string; reason: string; error?: string }>;
  } = {
    successful: [],
    failed: [],
  };

  private processingStartTime: Date | null = null;
  private processingEndTime: Date | null = null;

  /**
   * 処理開始時刻を記録
   */
  public startProcessing(): void {
    this.processingStartTime = new Date();
    logger.debug("実装バージョン統計: 処理開始時刻を記録", {
      startTime: this.processingStartTime.toISOString(),
    });
  }

  /**
   * 処理終了時刻を記録
   */
  public endProcessing(): void {
    this.processingEndTime = new Date();
    logger.debug("実装バージョン統計: 処理終了時刻を記録", {
      endTime: this.processingEndTime.toISOString(),
      duration: this.getProcessingDuration(),
    });
  }

  /**
   * 成功したバージョン抽出を記録
   */
  public recordSuccess(
    characterId: string,
    version: number,
    rawString: string
  ): void {
    this.statistics.total++;
    this.statistics.successful++;

    // バージョン分布を更新
    const currentCount = this.versionDistribution.get(version) || 0;
    this.versionDistribution.set(version, currentCount + 1);

    // 詳細情報を記録
    this.characterDetails.successful.push({
      characterId,
      version,
      rawString,
    });

    logger.debug("実装バージョン統計: 成功を記録", {
      characterId,
      version,
      rawString,
      totalProcessed: this.statistics.total,
      successRate: this.getSuccessRate(),
    });
  }

  /**
   * 失敗したバージョン抽出を記録
   */
  public recordFailure(
    characterId: string,
    reason: string,
    error?: string
  ): void {
    this.statistics.total++;
    this.statistics.failed++;

    // 失敗理由別の統計を更新
    switch (reason) {
      case "parse_error":
      case "json_parse_error":
      case "regex_no_match":
      case "parse_float_nan":
        this.statistics.parseErrors++;
        break;
      case "missing_page_data":
      case "missing_modules_array":
      case "baseinfo_component_not_found":
      case "baseinfo_data_missing":
      case "baseinfo_list_missing":
      case "version_key_not_found":
      case "invalid_version_value":
      case "version_value_not_string":
        this.statistics.missingData++;
        break;
      default:
        // その他の理由
        break;
    }

    // 詳細情報を記録
    this.characterDetails.failed.push({
      characterId,
      reason,
      error,
    });

    logger.debug("実装バージョン統計: 失敗を記録", {
      characterId,
      reason,
      error,
      totalProcessed: this.statistics.total,
      failureRate: this.getFailureRate(),
    });
  }

  /**
   * デフォルト値使用を記録
   */
  public recordDefaultUsed(characterId: string, reason: string): void {
    this.statistics.defaultUsed++;
    logger.debug("実装バージョン統計: デフォルト値使用を記録", {
      characterId,
      reason,
      defaultUsedCount: this.statistics.defaultUsed,
    });
  }

  /**
   * 統計情報を取得
   */
  public getStatistics() {
    return {
      ...this.statistics,
      successRate: this.getSuccessRate(),
      failureRate: this.getFailureRate(),
      processingDuration: this.getProcessingDuration(),
      versionDistribution: Object.fromEntries(this.versionDistribution),
    };
  }

  /**
   * 詳細情報を取得
   */
  public getDetails() {
    return {
      ...this.characterDetails,
      versionDistribution: this.getVersionDistributionDetails(),
    };
  }

  /**
   * 成功率を計算
   */
  private getSuccessRate(): number {
    if (this.statistics.total === 0) return 0;
    return (
      Math.round(
        (this.statistics.successful / this.statistics.total) * 100 * 100
      ) / 100
    );
  }

  /**
   * 失敗率を計算
   */
  private getFailureRate(): number {
    if (this.statistics.total === 0) return 0;
    return (
      Math.round((this.statistics.failed / this.statistics.total) * 100 * 100) /
      100
    );
  }

  /**
   * 処理時間を計算（ミリ秒）
   */
  private getProcessingDuration(): number | null {
    if (!this.processingStartTime || !this.processingEndTime) return null;
    return (
      this.processingEndTime.getTime() - this.processingStartTime.getTime()
    );
  }

  /**
   * バージョン分布の詳細情報を取得
   */
  private getVersionDistributionDetails() {
    const distribution = Array.from(this.versionDistribution.entries())
      .sort(([a], [b]) => a - b)
      .map(([version, count]) => ({
        version,
        count,
        percentage:
          this.statistics.total > 0
            ? Math.round((count / this.statistics.total) * 100 * 100) / 100
            : 0,
      }));

    return distribution;
  }

  /**
   * 統計情報をログに出力
   */
  public logStatistics(): void {
    const stats = this.getStatistics();
    const details = this.getDetails();

    logger.info("実装バージョン抽出統計情報", {
      summary: {
        総処理数: stats.total,
        成功数: stats.successful,
        失敗数: stats.failed,
        成功率: `${stats.successRate}%`,
        失敗率: `${stats.failureRate}%`,
        デフォルト値使用数: stats.defaultUsed,
        解析エラー数: stats.parseErrors,
        データ欠損数: stats.missingData,
        処理時間: stats.processingDuration
          ? `${stats.processingDuration}ms`
          : "未計測",
      },
      versionDistribution: stats.versionDistribution,
    });

    // バージョン分布の詳細をログ出力
    if (details.versionDistribution.length > 0) {
      logger.info("実装バージョン分布詳細", {
        distribution: details.versionDistribution,
        mostCommonVersion: details.versionDistribution.reduce((prev, current) =>
          prev.count > current.count ? prev : current
        ),
      });
    }

    // 成功例の詳細をデバッグレベルで出力
    if (details.successful.length > 0) {
      logger.debug("実装バージョン抽出成功例", {
        count: details.successful.length,
        examples: details.successful.slice(0, 5), // 最初の5件のみ
        allSuccessful:
          details.successful.length <= 5 ? details.successful : undefined,
      });
    }

    // 失敗例の詳細を警告レベルで出力
    if (details.failed.length > 0) {
      logger.warn("実装バージョン抽出失敗例", {
        count: details.failed.length,
        examples: details.failed.slice(0, 10), // 最初の10件のみ
        failureReasons: this.getFailureReasonSummary(details.failed),
      });
    }
  }

  /**
   * 失敗理由の要約を取得
   */
  private getFailureReasonSummary(
    failures: Array<{ characterId: string; reason: string; error?: string }>
  ) {
    const reasonCounts = new Map<string, number>();

    failures.forEach((failure) => {
      const count = reasonCounts.get(failure.reason) || 0;
      reasonCounts.set(failure.reason, count + 1);
    });

    return Array.from(reasonCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([reason, count]) => ({ reason, count }));
  }

  /**
   * 統計情報をリセット
   */
  public reset(): void {
    this.statistics = {
      total: 0,
      successful: 0,
      failed: 0,
      defaultUsed: 0,
      parseErrors: 0,
      missingData: 0,
    };
    this.versionDistribution.clear();
    this.characterDetails = {
      successful: [],
      failed: [],
    };
    this.processingStartTime = null;
    this.processingEndTime = null;

    logger.debug("実装バージョン統計情報をリセット");
  }
}
