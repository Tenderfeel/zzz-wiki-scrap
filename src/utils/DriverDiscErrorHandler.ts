import { ApiResponse } from "../types/api";
import {
  ProcessedDriverDiscData,
  DriverDiscErrorContext,
  DriverDiscEntry,
  BilingualApiData,
} from "../types/processing";
import { logger, LogMessages } from "./Logger";
import { PartialDataHandler } from "./PartialDataHandler";

/**
 * ドライバーディスク処理専用のエラーハンドリングクラス
 * 要件: 4.1, 4.2, 4.3, 5.3
 */
export class DriverDiscErrorHandler {
  private partialDataHandler: PartialDataHandler;
  private maxRetryAttempts: number = 3;
  private retryDelayMs: number = 1000;

  constructor(partialDataHandler?: PartialDataHandler) {
    this.partialDataHandler = partialDataHandler || new PartialDataHandler();
  }

  /**
   * ドライバーディスクAPI失敗に対するリトライロジック
   * 要件: 4.1, 4.2, 4.3
   */
  async retryDriverDiscApiRequest<T>(
    apiCall: () => Promise<T>,
    discId: string,
    operation: string,
    maxRetries?: number
  ): Promise<T | null> {
    const retryAttempts = maxRetries || this.maxRetryAttempts;

    logger.info(LogMessages.DRIVER_DISC_ERROR_RECOVERY_START, {
      discId,
      operation,
      maxRetries: retryAttempts,
      retryDelay: `${this.retryDelayMs}ms`,
      timestamp: new Date().toISOString(),
    });

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        logger.debug(LogMessages.DRIVER_DISC_PROCESSING_RETRY, {
          discId,
          operation,
          attempt,
          maxAttempts: retryAttempts,
        });

        const result = await apiCall();

        logger.info(LogMessages.DRIVER_DISC_ERROR_RECOVERY_SUCCESS, {
          discId,
          operation,
          attempt,
          totalAttempts: attempt,
          recoveryMethod: "retry_success",
        });

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const isLastAttempt = attempt === retryAttempts;

        logger.warn(LogMessages.DRIVER_DISC_PROCESSING_RETRY, {
          discId,
          operation,
          attempt,
          maxAttempts: retryAttempts,
          error: errorMessage,
          isLastAttempt,
          nextRetryIn: isLastAttempt
            ? null
            : `${this.retryDelayMs * Math.pow(2, attempt - 1)}ms`,
        });

        if (isLastAttempt) {
          logger.error(LogMessages.DRIVER_DISC_ERROR_RECOVERY_FAILURE, {
            discId,
            operation,
            totalAttempts: retryAttempts,
            finalError: errorMessage,
            recoveryResult: "failed",
          });
          return null;
        }

        // 指数バックオフでリトライ間隔を調整
        const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
        await this.sleep(delay);
      }
    }

    return null;
  }

  /**
   * ドライバーディスク処理の部分的失敗に対するグレースフル劣化
   * 要件: 4.1, 4.2, 4.3
   */
  async handleDriverDiscPartialFailure(
    apiData: BilingualApiData,
    originalError: Error,
    discId: string
  ): Promise<ProcessedDriverDiscData | null> {
    logger.info(LogMessages.DRIVER_DISC_GRACEFUL_DEGRADATION, {
      discId,
      originalError: originalError.message,
      degradationMethod: "partial_data_processing",
      timestamp: new Date().toISOString(),
    });

    try {
      // 日本語データを優先して処理
      let workingData = apiData.ja;
      let dataSource = "ja";

      // 日本語データが不完全な場合は英語データを試行
      if (!this.isDriverDiscDataComplete(workingData)) {
        logger.info(LogMessages.DRIVER_DISC_PARTIAL_DATA_PROCESSING, {
          discId,
          reason: "incomplete_japanese_data",
          fallbackTo: "english_data",
        });

        if (apiData.en && this.isDriverDiscDataComplete(apiData.en)) {
          workingData = apiData.en;
          dataSource = "en";
        }
      }

      // 欠損フィールドを検出
      const missingFields = this.detectDriverDiscMissingFields(workingData);

      logger.info(
        "ドライバーディスクグレースフル劣化: 欠損フィールド分析完了",
        {
          discId,
          dataSource,
          missingFields,
          missingCount: missingFields.length,
          dataCompleteness:
            this.calculateDriverDiscDataCompleteness(missingFields),
        }
      );

      // 処理可能性を評価
      const processingViability =
        this.assessDriverDiscProcessingViability(missingFields);

      if (processingViability === "impossible") {
        logger.warn("ドライバーディスクグレースフル劣化: 処理不可能と判定", {
          discId,
          reason: "insufficient_data",
          missingFields,
          degradationResult: "aborted",
        });
        return null;
      }

      // 部分データ処理を実行
      const partialData = await this.processDriverDiscPartialData(
        workingData,
        missingFields,
        discId
      );

      if (!partialData) {
        logger.error(
          "ドライバーディスクグレースフル劣化: 部分データ処理も失敗",
          {
            discId,
            missingFields,
            degradationResult: "failed",
          }
        );
        return null;
      }

      // 部分データの妥当性を検証
      const isValid = this.validateDriverDiscPartialData(partialData, discId);

      if (!isValid) {
        logger.error(
          "ドライバーディスクグレースフル劣化: 部分データ検証に失敗",
          {
            discId,
            missingFields,
            degradationResult: "validation_failed",
          }
        );
        return null;
      }

      logger.info(LogMessages.DRIVER_DISC_ERROR_RECOVERY_SUCCESS, {
        discId,
        originalError: originalError.message,
        recoveryMethod: "graceful_degradation",
        dataSource,
        processingViability,
        degradationResult: "success",
      });

      return partialData;
    } catch (degradationError) {
      const errorMessage =
        degradationError instanceof Error
          ? degradationError.message
          : String(degradationError);

      logger.error("ドライバーディスクグレースフル劣化処理中にエラーが発生", {
        discId,
        originalError: originalError.message,
        degradationError: errorMessage,
        degradationResult: "error",
      });

      return null;
    }
  }

  /**
   * 個別ドライバーディスク失敗時の処理継続機能
   * 要件: 4.1, 4.2
   */
  handleIndividualDriverDiscFailure(
    discId: string,
    error: Error,
    processingContext: {
      totalDiscs: number;
      processedCount: number;
      successCount: number;
      failureCount: number;
    }
  ): void {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.warn("個別ドライバーディスク処理失敗、処理を継続", {
      discId,
      error: errorMessage,
      errorType: error.constructor.name,
      processingContext: {
        ...processingContext,
        remainingDiscs:
          processingContext.totalDiscs - processingContext.processedCount,
        successRate: `${Math.round(
          (processingContext.successCount / processingContext.processedCount) *
            100
        )}%`,
      },
      continuationStrategy: "skip_and_continue",
      timestamp: new Date().toISOString(),
    });

    // 失敗統計を更新
    this.updateDriverDiscFailureStatistics(discId, error);

    // 処理継続の判断
    const shouldContinue =
      this.shouldContinueDriverDiscProcessing(processingContext);

    if (!shouldContinue) {
      logger.error("ドライバーディスク処理失敗率が高すぎるため処理を中止", {
        processingContext,
        failureRate: `${Math.round(
          (processingContext.failureCount / processingContext.processedCount) *
            100
        )}%`,
        decision: "abort_processing",
      });
      throw new Error("ドライバーディスク処理失敗率が許容範囲を超えました");
    }

    logger.info("ドライバーディスク処理継続を決定", {
      processingContext,
      failureRate: `${Math.round(
        (processingContext.failureCount / processingContext.processedCount) *
          100
      )}%`,
      decision: "continue_processing",
    });
  }

  /**
   * ドライバーディスク専用のエラー分類と対応策決定
   * 要件: 4.3, 5.3
   */
  classifyDriverDiscErrorAndDetermineStrategy(
    error: Error,
    discId: string,
    processingPhase: "parsing" | "api_fetch" | "mapping" | "generation"
  ): DriverDiscErrorContext {
    const errorMessage = error.message.toLowerCase();

    // ネットワークエラー
    if (
      errorMessage.includes("network") ||
      errorMessage.includes("timeout") ||
      errorMessage.includes("econnreset") ||
      errorMessage.includes("enotfound")
    ) {
      return {
        discId,
        operation: processingPhase,
        processingPhase,
        errorType: "network",
        severity: "moderate",
        recoveryStrategy: "retry",
      };
    }

    // API応答エラー
    if (errorMessage.includes("404") || errorMessage.includes("not found")) {
      return {
        discId,
        operation: processingPhase,
        processingPhase,
        errorType: "api",
        severity: "low",
        recoveryStrategy: "skip",
      };
    }

    // データ構造エラー
    if (
      errorMessage.includes("parsing") ||
      errorMessage.includes("json") ||
      errorMessage.includes("undefined") ||
      errorMessage.includes("null")
    ) {
      return {
        discId,
        operation: processingPhase,
        processingPhase,
        errorType: "data_structure",
        severity: "moderate",
        recoveryStrategy: "partial_data",
      };
    }

    // バリデーションエラー
    if (
      errorMessage.includes("validation") ||
      errorMessage.includes("invalid")
    ) {
      return {
        discId,
        operation: processingPhase,
        processingPhase,
        errorType: "validation",
        severity: "low",
        recoveryStrategy: "graceful_degradation",
      };
    }

    // システムエラー
    if (
      errorMessage.includes("memory") ||
      errorMessage.includes("system") ||
      errorMessage.includes("fatal")
    ) {
      return {
        discId,
        operation: processingPhase,
        processingPhase,
        errorType: "system",
        severity: "critical",
        recoveryStrategy: "abort",
      };
    }

    // 不明なエラー
    return {
      discId,
      operation: processingPhase,
      processingPhase,
      errorType: "unknown",
      severity: "moderate",
      recoveryStrategy: "retry",
    };
  }

  /**
   * ドライバーディスク処理統計レポートの生成
   * 要件: 4.2, 5.3
   */
  generateDriverDiscProcessingReport(results: {
    successful: any[];
    failed: { discId: string; error: string; partialData?: any }[];
    statistics: {
      total: number;
      successful: number;
      failed: number;
      processingTime: number;
      startTime: Date;
      endTime?: Date;
    };
  }): string {
    const { successful, failed, statistics } = results;
    const successRate = (statistics.successful / statistics.total) * 100;
    const failureRate = (statistics.failed / statistics.total) * 100;

    const report = [
      "=== ドライバーディスク処理統計レポート ===",
      "",
      `処理開始時刻: ${statistics.startTime.toISOString()}`,
      `処理終了時刻: ${statistics.endTime?.toISOString() || "未完了"}`,
      `総処理時間: ${Math.round(statistics.processingTime / 1000)}秒`,
      "",
      `総ドライバーディスク数: ${statistics.total}`,
      `成功: ${statistics.successful} (${successRate.toFixed(1)}%)`,
      `失敗: ${statistics.failed} (${failureRate.toFixed(1)}%)`,
      "",
      "=== 成功したドライバーディスク ===",
      ...successful.map(
        (disc, index) =>
          `${index + 1}. ${disc.name?.ja || disc.name?.en || disc.id} (ID: ${
            disc.id
          })`
      ),
      "",
      "=== 失敗したドライバーディスク ===",
      ...failed.map(
        (failure, index) => `${index + 1}. ${failure.discId}: ${failure.error}`
      ),
      "",
      "=== エラー分析 ===",
      ...this.analyzeDriverDiscErrors(failed),
      "",
      "=== 推奨事項 ===",
      ...this.generateDriverDiscRecommendations(statistics, failed),
    ];

    return report.join("\n");
  }

  // プライベートヘルパーメソッド

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isDriverDiscDataComplete(apiData: ApiResponse): boolean {
    return !!(
      apiData?.data?.page?.id &&
      apiData?.data?.page?.name &&
      apiData?.data?.page?.modules
    );
  }

  private detectDriverDiscMissingFields(apiData: ApiResponse): string[] {
    const missingFields: string[] = [];

    if (!apiData?.data?.page) missingFields.push("page");
    if (!apiData?.data?.page?.id) missingFields.push("page.id");
    if (!apiData?.data?.page?.name) missingFields.push("page.name");
    if (!apiData?.data?.page?.modules) missingFields.push("page.modules");

    return missingFields;
  }

  private calculateDriverDiscDataCompleteness(missingFields: string[]): number {
    const totalFields = ["page", "page.id", "page.name", "page.modules"];
    const availableFields = totalFields.length - missingFields.length;
    return Math.round((availableFields / totalFields.length) * 100);
  }

  private assessDriverDiscProcessingViability(missingFields: string[]): string {
    const criticalFields = ["page", "page.id"];
    const hasCriticalMissing = criticalFields.some((field) =>
      missingFields.includes(field)
    );

    if (hasCriticalMissing) {
      return "impossible";
    }

    const basicFields = ["page.name", "page.modules"];
    const missingBasicCount = basicFields.filter((field) =>
      missingFields.includes(field)
    ).length;

    if (missingBasicCount === 0) {
      return "full";
    } else if (missingBasicCount <= 1) {
      return "partial";
    } else {
      return "minimal";
    }
  }

  private async processDriverDiscPartialData(
    apiData: ApiResponse,
    missingFields: string[],
    discId: string
  ): Promise<ProcessedDriverDiscData | null> {
    try {
      // 基本情報の抽出（可能な限り）
      const basicInfo = {
        id: parseInt(apiData?.data?.page?.id || discId),
        name: apiData?.data?.page?.name || `Unknown Disc ${discId}`,
        releaseVersion: undefined,
      };

      // セット効果情報の抽出（可能な限り）
      const setEffectInfo = {
        fourSetEffect: "効果情報が取得できませんでした",
        twoSetEffect: "効果情報が取得できませんでした",
      };

      // デフォルト特性
      const specialty = "support" as import("../types/index").Specialty;

      return {
        basicInfo,
        setEffectInfo,
        specialty,
      };
    } catch (error) {
      logger.error("ドライバーディスク部分データ処理エラー", {
        discId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private validateDriverDiscPartialData(
    partialData: ProcessedDriverDiscData,
    discId: string
  ): boolean {
    try {
      // 基本的な妥当性チェック
      if (!partialData.basicInfo?.id || !partialData.basicInfo?.name) {
        return false;
      }

      if (!partialData.setEffectInfo) {
        return false;
      }

      if (!partialData.specialty) {
        return false;
      }

      return true;
    } catch (error) {
      logger.error("ドライバーディスク部分データ検証エラー", {
        discId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private updateDriverDiscFailureStatistics(
    discId: string,
    error: Error
  ): void {
    logger.debug("ドライバーディスク失敗統計を更新", {
      discId,
      errorType: error.constructor.name,
      errorMessage: error.message,
    });
  }

  private shouldContinueDriverDiscProcessing(processingContext: {
    totalDiscs: number;
    processedCount: number;
    successCount: number;
    failureCount: number;
  }): boolean {
    // 失敗率が50%を超えた場合は処理を中止
    const failureRate =
      processingContext.failureCount / processingContext.processedCount;
    return failureRate <= 0.5;
  }

  private analyzeDriverDiscErrors(
    failed: { discId: string; error: string; partialData?: any }[]
  ): string[] {
    const errorTypes: { [key: string]: number } = {};

    failed.forEach((failure) => {
      const errorType = this.categorizeDriverDiscError(failure.error);
      errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
    });

    return Object.entries(errorTypes).map(
      ([type, count]) => `${type}: ${count}件`
    );
  }

  private categorizeDriverDiscError(errorMessage: string): string {
    const message = errorMessage.toLowerCase();

    if (message.includes("network") || message.includes("timeout")) {
      return "ネットワークエラー";
    }
    if (message.includes("404") || message.includes("not found")) {
      return "APIデータ不存在";
    }
    if (message.includes("parsing") || message.includes("json")) {
      return "データ解析エラー";
    }
    if (message.includes("validation")) {
      return "データ検証エラー";
    }

    return "その他のエラー";
  }

  private generateDriverDiscRecommendations(
    statistics: any,
    failed: { discId: string; error: string; partialData?: any }[]
  ): string[] {
    const recommendations: string[] = [];
    const failureRate = (statistics.failed / statistics.total) * 100;

    if (failureRate > 20) {
      recommendations.push("- 失敗率が高いため、API接続設定を確認してください");
    }

    if (failed.some((f) => f.error.includes("network"))) {
      recommendations.push(
        "- ネットワークエラーが発生しています。接続を確認してください"
      );
    }

    if (failed.some((f) => f.error.includes("404"))) {
      recommendations.push(
        "- 一部のドライバーディスクデータが見つかりません。disc-list.jsonを更新してください"
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("- 処理は正常に完了しました");
    }

    return recommendations;
  }
}
