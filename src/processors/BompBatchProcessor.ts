import { BompEntry, Bomp } from "../types";
import {
  ProcessedBompData,
  BompProcessingResult,
  BatchProcessingOptions,
  ProcessingStatistics,
} from "../types/processing";
import { BompDataProcessor } from "./BompDataProcessor";
import { BompGenerator } from "../generators/BompGenerator";
import { BompListParser } from "../parsers/BompListParser";
import { ProcessingStage, BatchProcessingError } from "../errors";
import { logger } from "../utils/Logger";

/**
 * ログ出力制御
 */
const isTestEnvironment =
  process.env.NODE_ENV === "test" ||
  process.env.VITEST === "true" ||
  process.env.SUPPRESS_LOGS === "true";
const log = isTestEnvironment ? () => {} : console.log;
const warn = isTestEnvironment ? () => {} : console.warn;
const info = isTestEnvironment ? () => {} : console.info;

/**
 * 失敗したボンプの情報
 */
export interface FailedBomp {
  entry: BompEntry;
  error: string;
  stage: ProcessingStage;
  timestamp: Date;
}

/**
 * プログレス情報
 */
export interface BompProgressInfo {
  current: number;
  total: number;
  percentage: number;
  currentBomp: string;
  stage: string;
  elapsedTime: number;
  estimatedTimeRemaining?: number;
}

/**
 * ボンプバッチプロセッサー
 * 全 32 ボンプの順次処理機能
 * API レート制限対応（リクエスト間遅延）
 * 処理統計とプログレス追跡機能
 * 要件: 1.1, 4.3
 */
export class BompBatchProcessor {
  private readonly bompDataProcessor: BompDataProcessor;
  private readonly bompGenerator: BompGenerator;
  private readonly bompListParser: BompListParser;
  private readonly defaultOptions: Required<BatchProcessingOptions> = {
    batchSize: 5,
    delayMs: 500,
    maxRetries: 3,
  };

  // プログレス管理
  private progressCallback?: (progress: BompProgressInfo) => void;
  private startTime: Date = new Date();
  private processedCount: number = 0;

  constructor(
    bompDataProcessor?: BompDataProcessor,
    bompGenerator?: BompGenerator,
    bompListParser?: BompListParser
  ) {
    this.bompDataProcessor = bompDataProcessor || new BompDataProcessor();
    this.bompGenerator = bompGenerator || new BompGenerator();
    this.bompListParser = bompListParser || new BompListParser();
  }

  /**
   * プログレスコールバックを設定する
   * @param callback プログレス更新時に呼び出されるコールバック
   */
  setProgressCallback(callback: (progress: BompProgressInfo) => void): void {
    this.progressCallback = callback;
  }

  /**
   * 全ボンプを処理する
   * @param scrapingFilePath Scraping.mdファイルのパス
   * @param options バッチ処理オプション
   * @returns Promise<BompProcessingResult> 処理結果
   */
  async processAllBomps(
    scrapingFilePath: string = "Scraping.md",
    options: BatchProcessingOptions = {}
  ): Promise<BompProcessingResult> {
    const opts = { ...this.defaultOptions, ...options };
    this.startTime = new Date();
    this.processedCount = 0;

    log(`\n=== ボンプバッチ処理開始 ===`);
    log(`処理開始時刻: ${this.startTime.toLocaleString()}`);
    log(`バッチサイズ: ${opts.batchSize}`);
    log(`リクエスト間遅延: ${opts.delayMs}ms`);
    log(`最大リトライ回数: ${opts.maxRetries}`);
    log(`===============================\n`);

    const successful: Bomp[] = [];
    const failed: FailedBomp[] = [];

    try {
      // Scraping.mdからボンプエントリーを抽出
      log(`📄 Scraping.mdからボンプエントリーを抽出中...`);
      const bompEntries = await this.bompListParser.parseScrapingFile(
        scrapingFilePath
      );

      log(`✓ ${bompEntries.length}個のボンプエントリーを抽出しました`);

      // 初期プログレス更新
      this.updateProgress(0, bompEntries.length, "開始", "初期化");

      // バッチ単位で処理
      for (let i = 0; i < bompEntries.length; i += opts.batchSize) {
        const batch = bompEntries.slice(i, i + opts.batchSize);
        const batchNumber = Math.floor(i / opts.batchSize) + 1;
        const totalBatches = Math.ceil(bompEntries.length / opts.batchSize);

        log(
          `\n--- バッチ ${batchNumber}/${totalBatches} (${batch.length}ボンプ) ---`
        );

        // バッチ内で順次処理（API レート制限対応）
        for (const bompEntry of batch) {
          const globalIndex = i + batch.indexOf(bompEntry);

          // プログレス更新
          this.updateProgress(
            globalIndex,
            bompEntries.length,
            bompEntry.id,
            "処理中"
          );

          try {
            log(`  🔄 ${bompEntry.id} (${bompEntry.jaName}) 処理開始...`);

            // ボンプデータを処理（リトライ機能付き）
            const processedData = await this.processBompWithRetry(
              bompEntry,
              opts.maxRetries
            );

            // Bompオブジェクトを生成
            const bomp = this.bompGenerator.generateBomp(
              processedData,
              null, // 英語データは現在未対応
              bompEntry.id
            );

            // 検証
            const validationResult = this.bompGenerator.validateBomp(bomp);
            if (!validationResult.isValid) {
              logger.warn("ボンプ検証に失敗しましたが、処理を継続します", {
                bompId: bompEntry.id,
                errors: validationResult.errors,
              });
            }

            successful.push(bomp);
            log(`  ✓ ${bompEntry.id} 処理完了`);
          } catch (error) {
            const failedBomp: FailedBomp = {
              entry: bompEntry,
              error: error instanceof Error ? error.message : String(error),
              stage: ProcessingStage.DATA_PROCESSING,
              timestamp: new Date(),
            };

            failed.push(failedBomp);
            log(`  ✗ ${bompEntry.id} 処理失敗: ${failedBomp.error}`);
          }

          // プログレス更新
          this.updateProgress(
            globalIndex + 1,
            bompEntries.length,
            bompEntry.id,
            "完了"
          );

          // API レート制限対応の遅延（最後のボンプでない場合）
          if (globalIndex < bompEntries.length - 1) {
            log(`⏳ API レート制限対応遅延 ${opts.delayMs}ms...`);
            await this.delay(opts.delayMs);
          }
        }

        log(`--- バッチ ${batchNumber}/${totalBatches} 完了 ---`);
      }

      const endTime = new Date();
      const statistics = this.generateStatistics(
        successful,
        failed,
        this.startTime,
        endTime
      );

      // 最終統計表示
      this.displayFinalStatistics(statistics, successful, failed);

      return {
        successful,
        failed: failed.map((f) => ({
          bompId: f.entry.id,
          error: f.error,
          partialData: undefined,
        })),
        statistics,
      };
    } catch (error) {
      const endTime = new Date();
      const statistics = this.generateStatistics(
        successful,
        failed,
        this.startTime,
        endTime
      );

      throw new BatchProcessingError(
        failed.map((f) => f.entry.id),
        successful.length + failed.length,
        `ボンプバッチ処理中にエラーが発生しました: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * リトライ機能付きでボンプデータを処理
   * API 失敗時のリトライ機構（最大 3 回）
   * 部分的失敗での処理継続機能
   * 詳細なエラーログとレポート生成
   * 要件: 1.5, 4.2, 4.5
   */
  private async processBompWithRetry(
    bompEntry: BompEntry,
    maxRetries: number
  ): Promise<ProcessedBompData> {
    let lastError: Error | null = null;
    const retryHistory: Array<{
      attempt: number;
      error: string;
      timestamp: Date;
      retryDelay?: number;
    }> = [];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug("ボンプデータ処理を試行", {
          bompId: bompEntry.id,
          attempt,
          maxRetries,
          pageId: bompEntry.pageId,
        });

        const processedData = await this.bompDataProcessor.processBompData(
          bompEntry
        );

        if (attempt > 1) {
          logger.info("リトライによりボンプデータ処理が成功しました", {
            bompId: bompEntry.id,
            successfulAttempt: attempt,
            totalRetries: attempt - 1,
            retryHistory,
          });
        }

        return processedData;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const errorInfo = {
          attempt,
          error: lastError.message,
          timestamp: new Date(),
          retryDelay: undefined as number | undefined,
        };

        // エラーの種類を分析
        const errorType = this.analyzeErrorType(lastError);

        logger.warn("ボンプデータ処理に失敗しました", {
          bompId: bompEntry.id,
          attempt,
          maxRetries,
          error: lastError.message,
          errorType,
          pageId: bompEntry.pageId,
        });

        // 最後の試行でない場合は遅延してリトライ
        if (attempt < maxRetries) {
          const retryDelay = this.calculateRetryDelay(attempt, errorType);
          errorInfo.retryDelay = retryDelay;

          logger.debug("リトライ前の遅延", {
            bompId: bompEntry.id,
            retryDelay,
            nextAttempt: attempt + 1,
            errorType,
          });

          await this.delay(retryDelay);
        }

        retryHistory.push(errorInfo);
      }
    }

    // 全ての試行が失敗した場合
    logger.error("全てのリトライが失敗しました", {
      bompId: bompEntry.id,
      maxRetries,
      finalError: lastError?.message,
      retryHistory,
      pageId: bompEntry.pageId,
    });

    // 詳細なエラーレポートを生成
    const errorReport = this.generateErrorReport(
      bompEntry,
      retryHistory,
      lastError
    );
    logger.error("詳細エラーレポート", { bompId: bompEntry.id, errorReport });

    throw lastError || new Error("ボンプデータ処理に失敗しました");
  }

  /**
   * エラーの種類を分析
   */
  private analyzeErrorType(error: Error): string {
    const message = error.message.toLowerCase();

    if (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("timeout")
    ) {
      return "NETWORK_ERROR";
    } else if (message.includes("api") || message.includes("http")) {
      return "API_ERROR";
    } else if (message.includes("parse") || message.includes("json")) {
      return "PARSING_ERROR";
    } else if (message.includes("validation") || message.includes("invalid")) {
      return "VALIDATION_ERROR";
    } else if (message.includes("mapping") || message.includes("transform")) {
      return "MAPPING_ERROR";
    } else {
      return "UNKNOWN_ERROR";
    }
  }

  /**
   * エラータイプに基づいてリトライ遅延時間を計算
   */
  private calculateRetryDelay(attempt: number, errorType: string): number {
    let baseDelay = 500;

    // エラータイプに応じて基本遅延時間を調整
    switch (errorType) {
      case "NETWORK_ERROR":
        baseDelay = 1000; // ネットワークエラーは長めの遅延
        break;
      case "API_ERROR":
        baseDelay = 2000; // APIエラーはさらに長めの遅延
        break;
      case "PARSING_ERROR":
      case "VALIDATION_ERROR":
      case "MAPPING_ERROR":
        baseDelay = 200; // データ処理エラーは短めの遅延
        break;
      default:
        baseDelay = 500;
    }

    // 指数バックオフ: baseDelay * 2^(attempt-1)
    return baseDelay * Math.pow(2, attempt - 1);
  }

  /**
   * 詳細なエラーレポートを生成
   */
  private generateErrorReport(
    bompEntry: BompEntry,
    retryHistory: Array<{
      attempt: number;
      error: string;
      timestamp: Date;
      retryDelay?: number;
    }>,
    finalError: Error | null
  ): string {
    let report = `ボンプ処理エラーレポート\n`;
    report += `ボンプID: ${bompEntry.id}\n`;
    report += `ボンプ名: ${bompEntry.jaName}\n`;
    report += `ページID: ${bompEntry.pageId}\n`;
    report += `Wiki URL: ${bompEntry.wikiUrl}\n`;
    report += `最終エラー: ${finalError?.message || "不明"}\n\n`;

    report += `リトライ履歴:\n`;
    retryHistory.forEach((retry, index) => {
      report += `  ${index + 1}. 試行${
        retry.attempt
      } (${retry.timestamp.toLocaleString()})\n`;
      report += `     エラー: ${retry.error}\n`;
      if (retry.retryDelay) {
        report += `     次回試行まで: ${retry.retryDelay}ms\n`;
      }
      report += `\n`;
    });

    return report;
  }

  /**
   * 失敗したボンプのみを再処理する
   * @param previousResult 前回の処理結果
   * @param options バッチ処理オプション
   * @returns Promise<BompProcessingResult> 再処理結果
   */
  async retryFailedBomps(
    previousResult: BompProcessingResult,
    options: BatchProcessingOptions = {}
  ): Promise<BompProcessingResult> {
    const failedBompIds = previousResult.failed.map((f) => f.bompId);

    if (failedBompIds.length === 0) {
      log("🎉 再処理が必要なボンプはありません。");
      return {
        successful: [],
        failed: [],
        statistics: {
          total: 0,
          successful: 0,
          failed: 0,
          processingTime: 0,
          startTime: new Date(),
          endTime: new Date(),
        },
      };
    }

    log(`\n🔄 === 失敗ボンプの再処理 ===`);
    log(`対象ボンプ数: ${failedBompIds.length}`);
    log(`失敗ボンプ: ${failedBompIds.join(", ")}`);
    log(`================================\n`);

    // 失敗したボンプのエントリーを再取得する必要がある
    // 実際の実装では、Scraping.mdから再度パースするか、
    // 前回の結果からエントリー情報を保持する必要がある
    throw new Error(
      "retryFailedBomps機能は現在未実装です。全体の再処理を行ってください。"
    );
  }

  /**
   * プログレス情報を更新する
   */
  private updateProgress(
    current: number,
    total: number,
    currentBomp: string,
    stage: string
  ): void {
    const now = new Date();
    const elapsedTime = now.getTime() - this.startTime.getTime();
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

    // 残り時間の推定
    let estimatedTimeRemaining: number | undefined;
    if (current > 0 && current < total) {
      const avgTimePerItem = elapsedTime / current;
      const remainingItems = total - current;
      estimatedTimeRemaining = avgTimePerItem * remainingItems;
    }

    const progress: BompProgressInfo = {
      current,
      total,
      percentage,
      currentBomp,
      stage,
      elapsedTime,
      estimatedTimeRemaining,
    };

    // コンソール表示
    if (currentBomp) {
      const elapsed = this.formatDuration(elapsedTime);
      const remaining = estimatedTimeRemaining
        ? ` (残り約${this.formatDuration(estimatedTimeRemaining)})`
        : "";

      log(
        `📊 進捗: ${current}/${total} (${percentage}%) | ${currentBomp} | ${stage} | 経過時間: ${elapsed}${remaining}`
      );
    }

    // コールバック実行
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }

  /**
   * 最終統計情報を表示する
   */
  private displayFinalStatistics(
    statistics: ProcessingStatistics,
    successful: Bomp[],
    failed: FailedBomp[]
  ): void {
    log(`\n🎉 === 全ボンプ処理完了 ===`);
    log(`処理開始時刻: ${statistics.startTime.toLocaleString()}`);
    log(`処理終了時刻: ${statistics.endTime?.toLocaleString()}`);
    log(`総処理時間: ${this.formatDuration(statistics.processingTime)}`);
    log(`================================`);
    log(`📊 処理結果統計:`);
    log(`  総ボンプ数: ${statistics.total}`);
    log(`  成功: ${statistics.successful}`);
    log(`  失敗: ${statistics.failed}`);
    log(
      `  成功率: ${Math.round(
        (statistics.successful / statistics.total) * 100
      )}%`
    );

    if (failed.length > 0) {
      log(`\n❌ 失敗したボンプ:`);
      failed.forEach((f) => {
        log(`  - ${f.entry.id} (${f.entry.jaName}): ${f.error}`);
      });
    }

    if (successful.length > 0) {
      log(`\n✅ 成功したボンプ:`);
      successful.forEach((s) => {
        log(`  - ${s.id} (${s.name.ja})`);
      });
    }

    log(`================================\n`);
  }

  /**
   * 統計情報を生成する
   */
  private generateStatistics(
    successful: Bomp[],
    failed: FailedBomp[],
    startTime: Date,
    endTime: Date
  ): ProcessingStatistics {
    return {
      total: successful.length + failed.length,
      successful: successful.length,
      failed: failed.length,
      processingTime: endTime.getTime() - startTime.getTime(),
      startTime,
      endTime,
    };
  }

  /**
   * 処理レポートを生成する
   */
  generateProcessingReport(result: BompProcessingResult): string {
    const { statistics, successful, failed } = result;
    const successRate = (statistics.successful / statistics.total) * 100;

    let report = `# 全ボンプ処理レポート\n\n`;
    report += `## 処理概要\n`;
    report += `- 処理開始時刻: ${statistics.startTime.toLocaleString()}\n`;
    report += `- 処理終了時刻: ${statistics.endTime?.toLocaleString()}\n`;
    report += `- 総処理時間: ${this.formatDuration(
      statistics.processingTime
    )}\n`;
    report += `- 総ボンプ数: ${statistics.total}\n`;
    report += `- 成功: ${statistics.successful}\n`;
    report += `- 失敗: ${statistics.failed}\n`;
    report += `- 成功率: ${Math.round(successRate)}%\n\n`;

    if (successful.length > 0) {
      report += `## 成功したボンプ (${successful.length})\n`;
      successful.forEach((s, index) => {
        report += `${index + 1}. ${s.id} (${s.name.ja})\n`;
      });
      report += `\n`;
    }

    if (failed.length > 0) {
      report += `## 失敗したボンプ (${failed.length})\n`;
      failed.forEach((f, index) => {
        report += `${index + 1}. ${f.bompId} - ${f.error}\n`;
      });
      report += `\n`;
    }

    return report;
  }

  /**
   * 遅延処理
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 処理結果を検証する
   * @param result 処理結果
   * @param minSuccessRate 最小成功率（0-1）
   * @throws BatchProcessingError 成功率が基準を下回る場合
   */
  validateProcessingResult(
    result: BompProcessingResult,
    minSuccessRate: number = 0.8
  ): void {
    const successRate = result.statistics.successful / result.statistics.total;

    if (successRate < minSuccessRate) {
      const failedBompIds = result.failed.map((f) => f.bompId);

      throw new BatchProcessingError(
        failedBompIds,
        result.statistics.total,
        `ボンプ処理成功率が基準を下回りました: ${Math.round(
          successRate * 100
        )}% < ${Math.round(minSuccessRate * 100)}%`
      );
    }

    if (
      process.env.NODE_ENV !== "test" &&
      process.env.VITEST !== "true" &&
      !process.env.SUPPRESS_LOGS
    ) {
      console.log(
        `✅ ボンプ処理結果検証完了: 成功率 ${Math.round(successRate * 100)}%`
      );
    }
  }

  /**
   * 時間をフォーマット
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}時間${minutes % 60}分${seconds % 60}秒`;
    } else if (minutes > 0) {
      return `${minutes}分${seconds % 60}秒`;
    } else {
      return `${seconds}秒`;
    }
  }
}
