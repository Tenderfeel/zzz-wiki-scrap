import { ApiResponse } from "../types/api";
import { ProcessedData } from "../types/processing";
import { logger, LogMessages } from "./Logger";
import { PartialDataHandler } from "./PartialDataHandler";

/**
 * バージョン2.3キャラクター専用のエラー回復機能
 * 要件: 4.1, 4.2, 4.3, 4.4
 */
export class ErrorRecoveryHandler {
  private partialDataHandler: PartialDataHandler;
  private maxRetryAttempts: number = 3;
  private retryDelayMs: number = 1000;

  constructor(partialDataHandler?: PartialDataHandler) {
    this.partialDataHandler = partialDataHandler || new PartialDataHandler();
  }

  /**
   * API失敗に対するリトライロジック（バージョン2.3キャラクター専用）
   * 要件: 4.1, 4.2, 4.3, 4.4
   */
  async retryApiRequest<T>(
    apiCall: () => Promise<T>,
    characterId: string,
    operation: string
  ): Promise<T | null> {
    logger.info(LogMessages.ERROR_RECOVERY_START, {
      characterId,
      operation,
      maxRetries: this.maxRetryAttempts,
      retryDelay: `${this.retryDelayMs}ms`,
      timestamp: new Date().toISOString(),
    });

    for (let attempt = 1; attempt <= this.maxRetryAttempts; attempt++) {
      try {
        logger.debug(LogMessages.ERROR_RECOVERY_RETRY_ATTEMPT, {
          characterId,
          operation,
          attempt,
          maxAttempts: this.maxRetryAttempts,
        });

        const result = await apiCall();

        logger.info(LogMessages.ERROR_RECOVERY_RETRY_SUCCESS, {
          characterId,
          operation,
          attempt,
          totalAttempts: attempt,
          recoveryMethod: "retry_success",
        });

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const isLastAttempt = attempt === this.maxRetryAttempts;

        logger.warn(LogMessages.ERROR_RECOVERY_RETRY_FAILURE, {
          characterId,
          operation,
          attempt,
          maxAttempts: this.maxRetryAttempts,
          error: errorMessage,
          isLastAttempt,
          nextRetryIn: isLastAttempt ? null : `${this.retryDelayMs}ms`,
        });

        if (isLastAttempt) {
          logger.error(LogMessages.ERROR_RECOVERY_FAILURE, {
            characterId,
            operation,
            totalAttempts: this.maxRetryAttempts,
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
   * 部分的処理失敗に対するグレースフル劣化
   * 要件: 4.1, 4.2, 4.3, 4.4
   */
  async handlePartialProcessingFailure(
    apiData: ApiResponse,
    originalError: Error,
    characterId: string
  ): Promise<ProcessedData | null> {
    logger.info(LogMessages.ERROR_RECOVERY_GRACEFUL_DEGRADATION, {
      characterId,
      originalError: originalError.message,
      degradationMethod: "partial_data_processing",
      timestamp: new Date().toISOString(),
    });

    try {
      // 欠損フィールドを検出
      const missingFields =
        this.partialDataHandler.detectMissingFields(apiData);

      logger.info("グレースフル劣化: 欠損フィールド分析完了", {
        characterId,
        missingFields,
        missingCount: missingFields.length,
        dataCompleteness: this.calculateDataCompleteness(missingFields),
      });

      // 処理可能性を評価
      const processingViability = this.assessProcessingViability(missingFields);

      if (processingViability === "impossible") {
        logger.warn("グレースフル劣化: 処理不可能と判定", {
          characterId,
          reason: "insufficient_data",
          missingFields,
          degradationResult: "aborted",
        });
        return null;
      }

      // 部分データ処理を実行
      const partialData = this.partialDataHandler.handlePartialData(
        apiData,
        missingFields
      );

      if (!partialData) {
        logger.error("グレースフル劣化: 部分データ処理も失敗", {
          characterId,
          missingFields,
          degradationResult: "failed",
        });
        return null;
      }

      // 部分データの妥当性を検証
      const isValid = this.partialDataHandler.validatePartialData(
        partialData,
        characterId
      );

      if (!isValid) {
        logger.error("グレースフル劣化: 部分データ検証に失敗", {
          characterId,
          missingFields,
          degradationResult: "validation_failed",
        });
        return null;
      }

      logger.info(LogMessages.ERROR_RECOVERY_COMPLETE, {
        characterId,
        originalError: originalError.message,
        recoveryMethod: "graceful_degradation",
        recoveredFields: this.getRecoveredFields(partialData),
        processingViability,
        degradationResult: "success",
      });

      return partialData;
    } catch (degradationError) {
      const errorMessage =
        degradationError instanceof Error
          ? degradationError.message
          : String(degradationError);

      logger.error("グレースフル劣化処理中にエラーが発生", {
        characterId,
        originalError: originalError.message,
        degradationError: errorMessage,
        degradationResult: "error",
      });

      return null;
    }
  }

  /**
   * 個別キャラクター失敗時の処理継続機能
   * 要件: 4.1, 4.2
   */
  handleIndividualCharacterFailure(
    characterId: string,
    error: Error,
    processingContext: {
      totalCharacters: number;
      processedCount: number;
      successCount: number;
      failureCount: number;
    }
  ): void {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.warn("個別キャラクター処理失敗、処理を継続", {
      characterId,
      error: errorMessage,
      errorType: error.constructor.name,
      processingContext: {
        ...processingContext,
        remainingCharacters:
          processingContext.totalCharacters - processingContext.processedCount,
        successRate: `${Math.round(
          (processingContext.successCount / processingContext.processedCount) *
            100
        )}%`,
      },
      continuationStrategy: "skip_and_continue",
      timestamp: new Date().toISOString(),
    });

    // 失敗統計を更新
    this.updateFailureStatistics(characterId, error);

    // 処理継続の判断
    const shouldContinue = this.shouldContinueProcessing(processingContext);

    if (!shouldContinue) {
      logger.error("失敗率が高すぎるため処理を中止", {
        processingContext,
        failureRate: `${Math.round(
          (processingContext.failureCount / processingContext.processedCount) *
            100
        )}%`,
        decision: "abort_processing",
      });
      throw new Error("処理失敗率が許容範囲を超えました");
    }

    logger.info("処理継続を決定", {
      processingContext,
      failureRate: `${Math.round(
        (processingContext.failureCount / processingContext.processedCount) *
          100
      )}%`,
      decision: "continue_processing",
    });
  }

  /**
   * バージョン2.3キャラクター専用のエラー分類と対応策決定
   * 要件: 4.3, 4.4
   */
  classifyErrorAndDetermineStrategy(
    error: Error,
    characterId: string
  ): {
    errorType: string;
    severity: string;
    recoveryStrategy: string;
    shouldRetry: boolean;
    shouldContinue: boolean;
  } {
    const errorMessage = error.message.toLowerCase();

    // ネットワークエラー
    if (
      errorMessage.includes("network") ||
      errorMessage.includes("timeout") ||
      errorMessage.includes("econnreset") ||
      errorMessage.includes("enotfound")
    ) {
      return {
        errorType: "network",
        severity: "moderate",
        recoveryStrategy: "retry_with_backoff",
        shouldRetry: true,
        shouldContinue: true,
      };
    }

    // API応答エラー
    if (errorMessage.includes("404") || errorMessage.includes("not found")) {
      return {
        errorType: "api_not_found",
        severity: "low",
        recoveryStrategy: "skip_character",
        shouldRetry: false,
        shouldContinue: true,
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
        errorType: "data_structure",
        severity: "moderate",
        recoveryStrategy: "partial_data_processing",
        shouldRetry: false,
        shouldContinue: true,
      };
    }

    // バリデーションエラー
    if (
      errorMessage.includes("validation") ||
      errorMessage.includes("invalid")
    ) {
      return {
        errorType: "validation",
        severity: "low",
        recoveryStrategy: "graceful_degradation",
        shouldRetry: false,
        shouldContinue: true,
      };
    }

    // システムエラー
    if (
      errorMessage.includes("memory") ||
      errorMessage.includes("system") ||
      errorMessage.includes("fatal")
    ) {
      return {
        errorType: "system",
        severity: "critical",
        recoveryStrategy: "abort_processing",
        shouldRetry: false,
        shouldContinue: false,
      };
    }

    // 不明なエラー
    return {
      errorType: "unknown",
      severity: "moderate",
      recoveryStrategy: "retry_once_then_skip",
      shouldRetry: true,
      shouldContinue: true,
    };
  }

  // プライベートヘルパーメソッド

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private calculateDataCompleteness(missingFields: string[]): number {
    const totalFields = [
      "page",
      "filter_values",
      "specialty",
      "stats",
      "rarity",
      "faction",
      "modules",
      "ascension",
      "baseInfo",
    ];
    const availableFields = totalFields.length - missingFields.length;
    return Math.round((availableFields / totalFields.length) * 100);
  }

  private assessProcessingViability(missingFields: string[]): string {
    const criticalFields = ["page", "filter_values"];
    const hasCriticalMissing = criticalFields.some((field) =>
      missingFields.includes(field)
    );

    if (hasCriticalMissing) {
      return "impossible";
    }

    const basicFields = ["specialty", "stats", "rarity", "faction"];
    const missingBasicCount = basicFields.filter((field) =>
      missingFields.includes(field)
    ).length;

    if (missingBasicCount === 0) {
      return "full";
    } else if (missingBasicCount <= 2) {
      return "partial";
    } else {
      return "minimal";
    }
  }

  private getRecoveredFields(processedData: ProcessedData): string[] {
    const recoveredFields: string[] = [];

    if (processedData.basicInfo) {
      if (processedData.basicInfo.id) recoveredFields.push("id");
      if (processedData.basicInfo.name) recoveredFields.push("name");
      if (processedData.basicInfo.specialty) recoveredFields.push("specialty");
      if (processedData.basicInfo.stats) recoveredFields.push("stats");
      if (processedData.basicInfo.rarity) recoveredFields.push("rarity");
    }

    if (processedData.factionInfo) {
      recoveredFields.push("faction");
    }

    if (processedData.attributesInfo) {
      recoveredFields.push("attributes");
    }

    return recoveredFields;
  }

  private updateFailureStatistics(characterId: string, error: Error): void {
    // 失敗統計の更新（実装は統計クラスに委譲）
    logger.debug("失敗統計を更新", {
      characterId,
      errorType: error.constructor.name,
      errorMessage: error.message,
    });
  }

  private shouldContinueProcessing(processingContext: {
    totalCharacters: number;
    processedCount: number;
    successCount: number;
    failureCount: number;
  }): boolean {
    // 失敗率が50%を超えた場合は処理を中止
    const failureRate =
      processingContext.failureCount / processingContext.processedCount;
    return failureRate <= 0.5;
  }
}
