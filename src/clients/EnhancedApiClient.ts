import { HoyoLabApiClient } from "./HoyoLabApiClient";
import { ApiResponse } from "../types/api";
import { CharacterEntry } from "../types";
import {
  BilingualApiData,
  ApiDataResult,
  BatchProcessingOptions,
  ProcessingStatistics,
} from "../types/processing";
import {
  ApiError,
  RateLimitError,
  BatchProcessingError,
  AllCharactersError,
  ProcessingStage,
} from "../errors";

/**
 * バッチ処理機能を持つ拡張APIクライアント
 */
export class EnhancedApiClient extends HoyoLabApiClient {
  private readonly defaultOptions: Required<BatchProcessingOptions> = {
    batchSize: 5,
    delayMs: 200,
    maxRetries: 3,
  };

  // レート制限管理
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private readonly maxRequestsPerMinute: number = 60;

  /**
   * 複数キャラクターのデータを並行取得する
   * @param entries キャラクターエントリーの配列
   * @param options バッチ処理オプション
   * @returns Promise<ApiDataResult[]> 各キャラクターの取得結果
   */
  async fetchCharacterDataBatch(
    entries: CharacterEntry[],
    options: BatchProcessingOptions = {}
  ): Promise<ApiDataResult[]> {
    const opts = { ...this.defaultOptions, ...options };
    const results: ApiDataResult[] = [];

    if (
      process.env.NODE_ENV !== "test" &&
      process.env.VITEST !== "true" &&
      !process.env.SUPPRESS_LOGS
    ) {
      console.log(`\n=== バッチAPI取得開始 ===`);
      console.log(`対象キャラクター数: ${entries.length}`);
      console.log(`バッチサイズ: ${opts.batchSize}`);
      console.log(`リクエスト間隔: ${opts.delayMs}ms`);
      console.log(`最大リトライ回数: ${opts.maxRetries}`);
      console.log(`========================\n`);
    }

    // バッチ単位で処理
    for (let i = 0; i < entries.length; i += opts.batchSize) {
      const batch = entries.slice(i, i + opts.batchSize);
      const batchNumber = Math.floor(i / opts.batchSize) + 1;
      const totalBatches = Math.ceil(entries.length / opts.batchSize);

      if (
        process.env.NODE_ENV !== "test" &&
        process.env.VITEST !== "true" &&
        !process.env.SUPPRESS_LOGS
      ) {
        console.log(`バッチ ${batchNumber}/${totalBatches} 処理中...`);
      }

      // バッチ内の並行処理
      const batchPromises = batch.map((entry) =>
        this.fetchSingleCharacterWithRetry(entry, opts.maxRetries)
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // 進捗表示
      if (
        process.env.NODE_ENV !== "test" &&
        process.env.VITEST !== "true" &&
        !process.env.SUPPRESS_LOGS
      ) {
        const processed = Math.min(i + opts.batchSize, entries.length);
        console.log(
          `進捗: ${processed}/${entries.length} (${Math.round(
            (processed / entries.length) * 100
          )}%)`
        );
      }

      // 最後のバッチでない場合は遅延
      if (i + opts.batchSize < entries.length) {
        if (
          process.env.NODE_ENV !== "test" &&
          process.env.VITEST !== "true" &&
          !process.env.SUPPRESS_LOGS
        ) {
          console.log(`${opts.delayMs}ms 待機中...`);
        }
        await this.delay(opts.delayMs);
      }
    }

    // 統計情報を表示
    this.displayBatchStatistics(results);

    return results;
  }

  /**
   * レート制限をチェックし、必要に応じて待機する
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // 最小間隔の確保
    if (timeSinceLastRequest < this.defaultOptions.delayMs) {
      const waitTime = this.defaultOptions.delayMs - timeSinceLastRequest;
      await this.delay(waitTime);
    }

    // 1分間のリクエスト数制限チェック
    if (this.requestCount >= this.maxRequestsPerMinute) {
      const waitTime = 60000; // 1分待機
      if (
        process.env.NODE_ENV !== "test" &&
        process.env.VITEST !== "true" &&
        !process.env.SUPPRESS_LOGS
      ) {
        console.log(
          `⚠ レート制限に達しました。${waitTime / 1000}秒待機します...`
        );
      }
      await this.delay(waitTime);
      this.requestCount = 0;
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * 単一キャラクターのデータをリトライ機能付きで取得
   * @param entry キャラクターエントリー
   * @param maxRetries 最大リトライ回数
   * @returns Promise<ApiDataResult> 取得結果
   */
  private async fetchSingleCharacterWithRetry(
    entry: CharacterEntry,
    maxRetries: number
  ): Promise<ApiDataResult> {
    let lastError: Error | null = null;
    let attemptCount = 0;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      attemptCount++;
      try {
        if (
          process.env.NODE_ENV !== "test" &&
          process.env.VITEST !== "true" &&
          !process.env.SUPPRESS_LOGS
        ) {
          console.log(
            `  ${entry.id} (pageId: ${entry.pageId}) 取得中... (試行 ${attempt}/${maxRetries})`
          );
        }

        // レート制限チェック
        await this.checkRateLimit();

        const data = await this.fetchBothLanguages(entry.pageId);

        if (
          process.env.NODE_ENV !== "test" &&
          process.env.VITEST !== "true" &&
          !process.env.SUPPRESS_LOGS
        ) {
          console.log(`  ✓ ${entry.id} 取得成功`);
        }
        return {
          entry,
          data,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // エラーハンドリング
        const errorResult = this.handleApiError(lastError, entry, attempt);

        if (attempt < maxRetries && errorResult.shouldRetry) {
          if (
            process.env.NODE_ENV !== "test" &&
            process.env.VITEST !== "true" &&
            !process.env.SUPPRESS_LOGS
          ) {
            console.log(`  ${errorResult.waitTime}ms 後にリトライします...`);
          }
          await this.delay(errorResult.waitTime);
        } else if (!errorResult.shouldRetry) {
          if (
            process.env.NODE_ENV !== "test" &&
            process.env.VITEST !== "true" &&
            !process.env.SUPPRESS_LOGS
          ) {
            console.log(
              `  ✗ ${entry.id} リトライ不可能なエラー: ${lastError.message}`
            );
          }
          break;
        } else {
          if (
            process.env.NODE_ENV !== "test" &&
            process.env.VITEST !== "true" &&
            !process.env.SUPPRESS_LOGS
          ) {
            console.log(
              `  ✗ ${entry.id} 取得失敗 (全試行終了): ${lastError.message}`
            );
          }
        }
      }
    }

    return {
      entry,
      data: null,
      error: lastError?.message || "不明なエラー",
    };
  }

  /**
   * 日本語と英語の両方でキャラクターデータを取得する
   * @param pageId キャラクターのページID
   * @returns Promise<BilingualApiData> 両言語のAPIレスポンス
   */
  async fetchBothLanguages(pageId: number): Promise<BilingualApiData> {
    try {
      // 既存のメソッドを使用
      const result = await this.fetchCharacterDataBothLanguages(pageId);
      return result;
    } catch (error) {
      throw new ApiError(
        `多言語データの取得に失敗しました (pageId: ${pageId}): ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * APIエラーを適切に処理する
   * @param error 発生したエラー
   * @param entry 対象のキャラクターエントリー
   * @param attempt 現在の試行回数
   * @returns 処理されたエラー情報
   */
  handleApiError(
    error: Error,
    entry: CharacterEntry,
    attempt: number = 1
  ): {
    shouldRetry: boolean;
    waitTime: number;
    errorType: string;
  } {
    const errorInfo = {
      characterId: entry.id,
      pageId: entry.pageId,
      error: error.message,
      attempt,
      timestamp: new Date().toISOString(),
    };

    // エラータイプの判定
    if (error.message.includes("429") || error.message.includes("rate limit")) {
      if (
        process.env.NODE_ENV !== "test" &&
        process.env.VITEST !== "true" &&
        !process.env.SUPPRESS_LOGS
      ) {
        console.warn(`⚠ レート制限エラー [${entry.id}]:`, errorInfo);
      }
      return {
        shouldRetry: true,
        waitTime: Math.min(attempt * 2000, 10000), // 最大10秒
        errorType: "RATE_LIMIT",
      };
    }

    if (
      error.message.includes("timeout") ||
      error.message.includes("TIMEOUT")
    ) {
      if (
        process.env.NODE_ENV !== "test" &&
        process.env.VITEST !== "true" &&
        !process.env.SUPPRESS_LOGS
      ) {
        console.warn(`⚠ タイムアウトエラー [${entry.id}]:`, errorInfo);
      }
      return {
        shouldRetry: true,
        waitTime: attempt * 1000,
        errorType: "TIMEOUT",
      };
    }

    if (
      error.message.includes("500") ||
      error.message.includes("502") ||
      error.message.includes("503")
    ) {
      if (
        process.env.NODE_ENV !== "test" &&
        process.env.VITEST !== "true" &&
        !process.env.SUPPRESS_LOGS
      ) {
        console.warn(`⚠ サーバーエラー [${entry.id}]:`, errorInfo);
      }
      return {
        shouldRetry: true,
        waitTime: attempt * 2000,
        errorType: "SERVER_ERROR",
      };
    }

    if (error.message.includes("404")) {
      if (
        process.env.NODE_ENV !== "test" &&
        process.env.VITEST !== "true" &&
        !process.env.SUPPRESS_LOGS
      ) {
        console.error(
          `✗ キャラクターが見つかりません [${entry.id}]:`,
          errorInfo
        );
      }
      return {
        shouldRetry: false,
        waitTime: 0,
        errorType: "NOT_FOUND",
      };
    }

    // その他のエラー
    if (
      process.env.NODE_ENV !== "test" &&
      process.env.VITEST !== "true" &&
      !process.env.SUPPRESS_LOGS
    ) {
      console.error(`✗ 予期しないエラー [${entry.id}]:`, errorInfo);
    }
    return {
      shouldRetry: true,
      waitTime: attempt * 1000,
      errorType: "UNKNOWN",
    };
  }

  /**
   * バッチ処理の統計情報を表示する
   * @param results バッチ処理結果
   */
  private displayBatchStatistics(results: ApiDataResult[]): void {
    const successful = results.filter((r) => r.data !== null).length;
    const failed = results.filter((r) => r.data === null).length;

    if (
      process.env.NODE_ENV !== "test" &&
      process.env.VITEST !== "true" &&
      !process.env.SUPPRESS_LOGS
    ) {
      console.log(`\n=== バッチ処理統計 ===`);
      console.log(`総キャラクター数: ${results.length}`);
      console.log(`成功: ${successful}`);
      console.log(`失敗: ${failed}`);
      console.log(
        `成功率: ${Math.round((successful / results.length) * 100)}%`
      );

      if (failed > 0) {
        console.log(`\n失敗したキャラクター:`);
        results
          .filter((r) => r.data === null)
          .forEach((r) => {
            console.log(
              `  - ${r.entry.id} (pageId: ${r.entry.pageId}): ${r.error}`
            );
          });
      }

      console.log(`=====================\n`);
    }
  }

  /**
   * 指定された時間だけ待機する
   * @param ms 待機時間（ミリ秒）
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * バッチ処理結果を検証する
   * @param results バッチ処理結果
   * @param minSuccessRate 最小成功率（0-1）
   * @throws BatchProcessingError 成功率が基準を下回る場合
   */
  validateBatchResults(
    results: ApiDataResult[],
    minSuccessRate: number = 0.8
  ): void {
    const successful = results.filter((r) => r.data !== null).length;
    const successRate = successful / results.length;

    if (successRate < minSuccessRate) {
      const failedCharacters = results
        .filter((r) => r.data === null)
        .map((r) => r.entry.id);

      throw new BatchProcessingError(
        failedCharacters,
        results.length,
        `成功率が基準を下回りました: ${Math.round(
          successRate * 100
        )}% < ${Math.round(minSuccessRate * 100)}%`
      );
    }
  }

  /**
   * 失敗したキャラクターのみを再処理する
   * @param results 前回のバッチ処理結果
   * @param options バッチ処理オプション
   * @returns Promise<ApiDataResult[]> 再処理結果
   */
  async retryFailedCharacters(
    results: ApiDataResult[],
    options: BatchProcessingOptions = {}
  ): Promise<ApiDataResult[]> {
    const failedEntries = results
      .filter((r) => r.data === null)
      .map((r) => r.entry);

    if (failedEntries.length === 0) {
      if (
        process.env.NODE_ENV !== "test" &&
        process.env.VITEST !== "true" &&
        !process.env.SUPPRESS_LOGS
      ) {
        console.log("再処理が必要なキャラクターはありません。");
      }
      return [];
    }

    if (
      process.env.NODE_ENV !== "test" &&
      process.env.VITEST !== "true" &&
      !process.env.SUPPRESS_LOGS
    ) {
      console.log(`\n=== 失敗キャラクターの再処理 ===`);
      console.log(`対象キャラクター数: ${failedEntries.length}`);
    }

    return await this.fetchCharacterDataBatch(failedEntries, options);
  }

  /**
   * 処理統計情報を生成する
   * @param results バッチ処理結果
   * @param startTime 処理開始時刻
   * @param endTime 処理終了時刻
   * @returns ProcessingStatistics 統計情報
   */
  generateStatistics(
    results: ApiDataResult[],
    startTime: Date,
    endTime: Date
  ): ProcessingStatistics {
    const successful = results.filter((r) => r.data !== null).length;
    const failed = results.filter((r) => r.data === null).length;
    const processingTime = endTime.getTime() - startTime.getTime();

    return {
      total: results.length,
      successful,
      failed,
      processingTime,
      startTime,
      endTime,
    };
  }
}
