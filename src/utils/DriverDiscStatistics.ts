import {
  DriverDiscProcessingResult,
  ProcessingStatistics,
} from "../types/processing";
import { logger, LogMessages } from "./Logger";

/**
 * ドライバーディスク処理統計とレポート生成クラス
 * 要件: 4.2, 4.4, 5.3
 */
export class DriverDiscStatistics {
  private startTime: Date;
  private endTime?: Date;
  private processingMetrics: {
    totalDiscs: number;
    processedCount: number;
    successCount: number;
    failureCount: number;
    partialSuccessCount: number;
    skippedCount: number;
    retryCount: number;
    totalRetryAttempts: number;
  };
  private performanceMetrics: {
    totalProcessingTimeMs: number;
    averageProcessingTimePerDisc: number;
    apiRequestCount: number;
    totalApiResponseTime: number;
    memoryUsagePeak: number;
    memoryUsageCurrent: number;
  };
  private errorMetrics: {
    networkErrors: number;
    apiErrors: number;
    dataStructureErrors: number;
    validationErrors: number;
    systemErrors: number;
    unknownErrors: number;
  };

  constructor() {
    this.startTime = new Date();
    this.processingMetrics = {
      totalDiscs: 0,
      processedCount: 0,
      successCount: 0,
      failureCount: 0,
      partialSuccessCount: 0,
      skippedCount: 0,
      retryCount: 0,
      totalRetryAttempts: 0,
    };
    this.performanceMetrics = {
      totalProcessingTimeMs: 0,
      averageProcessingTimePerDisc: 0,
      apiRequestCount: 0,
      totalApiResponseTime: 0,
      memoryUsagePeak: 0,
      memoryUsageCurrent: 0,
    };
    this.errorMetrics = {
      networkErrors: 0,
      apiErrors: 0,
      dataStructureErrors: 0,
      validationErrors: 0,
      systemErrors: 0,
      unknownErrors: 0,
    };
  }

  /**
   * 処理開始時の統計初期化
   * 要件: 4.4
   */
  initializeProcessing(totalDiscs: number): void {
    this.startTime = new Date();
    this.processingMetrics.totalDiscs = totalDiscs;
    this.updateMemoryUsage();

    logger.info(LogMessages.DRIVER_DISC_STATISTICS_SUMMARY, {
      action: "initialize",
      totalDiscs,
      startTime: this.startTime.toISOString(),
      initialMemoryUsage: `${Math.round(
        this.performanceMetrics.memoryUsageCurrent / 1024 / 1024
      )}MB`,
    });
  }

  /**
   * 個別ドライバーディスク処理成功の記録
   * 要件: 4.2, 4.4
   */
  recordSuccess(
    discId: string,
    processingTimeMs: number,
    isPartial: boolean = false
  ): void {
    this.processingMetrics.processedCount++;

    if (isPartial) {
      this.processingMetrics.partialSuccessCount++;
    } else {
      this.processingMetrics.successCount++;
    }

    this.updatePerformanceMetrics(processingTimeMs);
    this.updateMemoryUsage();

    logger.debug("ドライバーディスク処理成功を記録", {
      discId,
      processingTimeMs,
      isPartial,
      currentProgress: this.getProgressSummary(),
    });
  }

  /**
   * 個別ドライバーディスク処理失敗の記録
   * 要件: 4.2, 4.4
   */
  recordFailure(
    discId: string,
    error: Error,
    errorType: string,
    processingTimeMs: number,
    retryAttempts: number = 0
  ): void {
    this.processingMetrics.processedCount++;
    this.processingMetrics.failureCount++;

    if (retryAttempts > 0) {
      this.processingMetrics.retryCount++;
      this.processingMetrics.totalRetryAttempts += retryAttempts;
    }

    this.recordErrorType(errorType);
    this.updatePerformanceMetrics(processingTimeMs);
    this.updateMemoryUsage();

    logger.debug("ドライバーディスク処理失敗を記録", {
      discId,
      error: error.message,
      errorType,
      processingTimeMs,
      retryAttempts,
      currentProgress: this.getProgressSummary(),
    });
  }

  /**
   * スキップされたドライバーディスクの記録
   * 要件: 4.2
   */
  recordSkipped(discId: string, reason: string): void {
    this.processingMetrics.skippedCount++;

    logger.debug("ドライバーディスクスキップを記録", {
      discId,
      reason,
      currentProgress: this.getProgressSummary(),
    });
  }

  /**
   * API リクエストの記録
   * 要件: 4.4
   */
  recordApiRequest(responseTimeMs: number): void {
    this.performanceMetrics.apiRequestCount++;
    this.performanceMetrics.totalApiResponseTime += responseTimeMs;
  }

  /**
   * 処理完了時の統計確定
   * 要件: 4.2, 4.4
   */
  finalizeProcessing(): ProcessingStatistics {
    this.endTime = new Date();
    this.performanceMetrics.totalProcessingTimeMs =
      this.endTime.getTime() - this.startTime.getTime();

    if (this.processingMetrics.processedCount > 0) {
      this.performanceMetrics.averageProcessingTimePerDisc =
        this.performanceMetrics.totalProcessingTimeMs /
        this.processingMetrics.processedCount;
    }

    this.updateMemoryUsage();

    const statistics: ProcessingStatistics = {
      total: this.processingMetrics.totalDiscs,
      successful:
        this.processingMetrics.successCount +
        this.processingMetrics.partialSuccessCount,
      failed: this.processingMetrics.failureCount,
      processingTime: this.performanceMetrics.totalProcessingTimeMs,
      startTime: this.startTime,
      endTime: this.endTime,
    };

    logger.info(LogMessages.DRIVER_DISC_STATISTICS_SUMMARY, {
      action: "finalize",
      statistics,
      performanceMetrics: this.getPerformanceMetrics(),
      errorMetrics: this.errorMetrics,
    });

    return statistics;
  }

  /**
   * リアルタイム進捗情報の取得
   * 要件: 4.4
   */
  getProgressSummary(): {
    processed: number;
    total: number;
    successRate: number;
    failureRate: number;
    remainingCount: number;
    estimatedTimeRemaining?: number;
  } {
    const processed = this.processingMetrics.processedCount;
    const total = this.processingMetrics.totalDiscs;
    const successRate =
      processed > 0
        ? ((this.processingMetrics.successCount +
            this.processingMetrics.partialSuccessCount) /
            processed) *
          100
        : 0;
    const failureRate =
      processed > 0
        ? (this.processingMetrics.failureCount / processed) * 100
        : 0;
    const remainingCount = total - processed;

    let estimatedTimeRemaining: number | undefined;
    if (processed > 0 && remainingCount > 0) {
      const averageTimePerDisc =
        this.performanceMetrics.averageProcessingTimePerDisc ||
        (Date.now() - this.startTime.getTime()) / processed;
      estimatedTimeRemaining = averageTimePerDisc * remainingCount;
    }

    return {
      processed,
      total,
      successRate: Math.round(successRate * 10) / 10,
      failureRate: Math.round(failureRate * 10) / 10,
      remainingCount,
      estimatedTimeRemaining,
    };
  }

  /**
   * パフォーマンス統計の取得
   * 要件: 4.4
   */
  getPerformanceMetrics(): {
    totalProcessingTimeMs: number;
    averageProcessingTimePerDisc: number;
    apiRequestCount: number;
    averageApiResponseTime: number;
    memoryUsagePeakMB: number;
    memoryUsageCurrentMB: number;
    throughputDiscsPerSecond: number;
  } {
    const averageApiResponseTime =
      this.performanceMetrics.apiRequestCount > 0
        ? this.performanceMetrics.totalApiResponseTime /
          this.performanceMetrics.apiRequestCount
        : 0;

    const throughputDiscsPerSecond =
      this.performanceMetrics.totalProcessingTimeMs > 0
        ? (this.processingMetrics.processedCount /
            this.performanceMetrics.totalProcessingTimeMs) *
          1000
        : 0;

    return {
      totalProcessingTimeMs: this.performanceMetrics.totalProcessingTimeMs,
      averageProcessingTimePerDisc:
        this.performanceMetrics.averageProcessingTimePerDisc,
      apiRequestCount: this.performanceMetrics.apiRequestCount,
      averageApiResponseTime: Math.round(averageApiResponseTime),
      memoryUsagePeakMB: Math.round(
        this.performanceMetrics.memoryUsagePeak / 1024 / 1024
      ),
      memoryUsageCurrentMB: Math.round(
        this.performanceMetrics.memoryUsageCurrent / 1024 / 1024
      ),
      throughputDiscsPerSecond:
        Math.round(throughputDiscsPerSecond * 100) / 100,
    };
  }

  /**
   * エラー統計の取得
   * 要件: 4.2, 4.3
   */
  getErrorMetrics(): typeof this.errorMetrics & {
    totalErrors: number;
    retrySuccessRate: number;
  } {
    const totalErrors = Object.values(this.errorMetrics).reduce(
      (sum, count) => sum + count,
      0
    );
    const retrySuccessRate =
      this.processingMetrics.totalRetryAttempts > 0
        ? ((this.processingMetrics.totalRetryAttempts -
            this.processingMetrics.failureCount) /
            this.processingMetrics.totalRetryAttempts) *
          100
        : 0;

    return {
      ...this.errorMetrics,
      totalErrors,
      retrySuccessRate: Math.round(retrySuccessRate * 10) / 10,
    };
  }

  /**
   * 詳細な統計レポートの生成
   * 要件: 4.2, 4.4, 5.3
   */
  generateDetailedReport(): string {
    const progress = this.getProgressSummary();
    const performance = this.getPerformanceMetrics();
    const errors = this.getErrorMetrics();
    const processingDuration = this.endTime
      ? this.endTime.getTime() - this.startTime.getTime()
      : Date.now() - this.startTime.getTime();

    const report = [
      "=== ドライバーディスク処理統計レポート ===",
      "",
      "■ 処理概要",
      `処理開始時刻: ${this.startTime.toISOString()}`,
      `処理終了時刻: ${this.endTime?.toISOString() || "処理中"}`,
      `総処理時間: ${Math.round(processingDuration / 1000)}秒`,
      "",
      "■ 処理結果",
      `総ドライバーディスク数: ${progress.total}`,
      `処理済み: ${progress.processed} / ${progress.total} (${Math.round(
        (progress.processed / progress.total) * 100
      )}%)`,
      `成功: ${this.processingMetrics.successCount} (完全成功)`,
      `部分成功: ${this.processingMetrics.partialSuccessCount} (グレースフル劣化)`,
      `失敗: ${this.processingMetrics.failureCount}`,
      `スキップ: ${this.processingMetrics.skippedCount}`,
      `成功率: ${progress.successRate}%`,
      `失敗率: ${progress.failureRate}%`,
      "",
      "■ パフォーマンス統計",
      `平均処理時間/ディスク: ${Math.round(
        performance.averageProcessingTimePerDisc
      )}ms`,
      `処理スループット: ${performance.throughputDiscsPerSecond} ディスク/秒`,
      `API リクエスト数: ${performance.apiRequestCount}`,
      `平均API応答時間: ${performance.averageApiResponseTime}ms`,
      `メモリ使用量ピーク: ${performance.memoryUsagePeakMB}MB`,
      `現在のメモリ使用量: ${performance.memoryUsageCurrentMB}MB`,
      "",
      "■ エラー統計",
      `総エラー数: ${errors.totalErrors}`,
      `ネットワークエラー: ${errors.networkErrors}`,
      `APIエラー: ${errors.apiErrors}`,
      `データ構造エラー: ${errors.dataStructureErrors}`,
      `バリデーションエラー: ${errors.validationErrors}`,
      `システムエラー: ${errors.systemErrors}`,
      `不明なエラー: ${errors.unknownErrors}`,
      `リトライ実行回数: ${this.processingMetrics.retryCount}`,
      `総リトライ試行数: ${this.processingMetrics.totalRetryAttempts}`,
      `リトライ成功率: ${errors.retrySuccessRate}%`,
      "",
      "■ 推奨事項",
      ...this.generateRecommendations(progress, performance, errors),
    ];

    return report.join("\n");
  }

  // プライベートヘルパーメソッド

  private updatePerformanceMetrics(processingTimeMs: number): void {
    this.performanceMetrics.totalProcessingTimeMs += processingTimeMs;

    if (this.processingMetrics.processedCount > 0) {
      this.performanceMetrics.averageProcessingTimePerDisc =
        this.performanceMetrics.totalProcessingTimeMs /
        this.processingMetrics.processedCount;
    }
  }

  private updateMemoryUsage(): void {
    if (typeof process !== "undefined" && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      this.performanceMetrics.memoryUsageCurrent = memUsage.heapUsed;

      if (memUsage.heapUsed > this.performanceMetrics.memoryUsagePeak) {
        this.performanceMetrics.memoryUsagePeak = memUsage.heapUsed;
      }
    }
  }

  private recordErrorType(errorType: string): void {
    switch (errorType.toLowerCase()) {
      case "network":
        this.errorMetrics.networkErrors++;
        break;
      case "api":
        this.errorMetrics.apiErrors++;
        break;
      case "data_structure":
        this.errorMetrics.dataStructureErrors++;
        break;
      case "validation":
        this.errorMetrics.validationErrors++;
        break;
      case "system":
        this.errorMetrics.systemErrors++;
        break;
      default:
        this.errorMetrics.unknownErrors++;
        break;
    }
  }

  private generateRecommendations(
    progress: any,
    performance: any,
    errors: any
  ): string[] {
    const recommendations: string[] = [];

    // 失敗率に基づく推奨事項
    if (progress.failureRate > 20) {
      recommendations.push(
        "- 失敗率が高いため、ネットワーク接続とAPI設定を確認してください"
      );
    }

    // パフォーマンスに基づく推奨事項
    if (performance.averageProcessingTimePerDisc > 5000) {
      recommendations.push(
        "- 処理時間が長いため、バッチサイズの調整を検討してください"
      );
    }

    if (performance.memoryUsagePeakMB > 500) {
      recommendations.push(
        "- メモリ使用量が多いため、バッチサイズを小さくすることを推奨します"
      );
    }

    // エラータイプに基づく推奨事項
    if (errors.networkErrors > errors.totalErrors * 0.3) {
      recommendations.push(
        "- ネットワークエラーが多発しています。接続の安定性を確認してください"
      );
    }

    if (errors.apiErrors > errors.totalErrors * 0.3) {
      recommendations.push(
        "- APIエラーが多発しています。disc-list.jsonの更新を検討してください"
      );
    }

    if (errors.dataStructureErrors > errors.totalErrors * 0.3) {
      recommendations.push(
        "- データ構造エラーが多発しています。APIレスポンス形式の変更を確認してください"
      );
    }

    // リトライに基づく推奨事項
    if (
      errors.retrySuccessRate < 50 &&
      this.processingMetrics.totalRetryAttempts > 0
    ) {
      recommendations.push(
        "- リトライ成功率が低いため、リトライ間隔の調整を検討してください"
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("- 処理は正常に完了しました。特に問題はありません");
    }

    return recommendations;
  }
}
