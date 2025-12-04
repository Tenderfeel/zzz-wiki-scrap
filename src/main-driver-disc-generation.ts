#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import { DriverDiscListParser } from "./parsers/DriverDiscListParser";
import { DriverDiscDataProcessor } from "./processors/DriverDiscDataProcessor";
import { DriverDiscGenerator } from "./generators/DriverDiscGenerator";
import { HoyoLabApiClient } from "./clients/HoyoLabApiClient";
import { DriverDiscDataMapper } from "./mappers/DriverDiscDataMapper";
import { EnhancedProgressTracker } from "./utils/EnhancedProgressTracker";
import { logger } from "./utils/Logger";
import { ConfigManager } from "./config/ProcessingConfig";
import {
  DriverDiscEntry,
  ProcessedDriverDiscData,
  DriverDisc,
  DriverDiscProcessingConfig,
} from "./types";
import { ParsingError, ValidationError } from "./errors";

/**
 * ドライバーディスク処理統計情報
 */
interface DriverDiscProcessingStatistics {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  retries: number;
  processingTime: number;
  averageItemTime: number;
  successRate: number;
}

/**
 * ドライバーディスク処理結果
 */
interface DriverDiscProcessingResult {
  driverDiscs: DriverDisc[];
  statistics: DriverDiscProcessingStatistics;
  failedDriverDiscs: Array<{
    discId: string;
    discName: string;
    error: string;
    stage: string;
  }>;
  outputPath: string;
  success: boolean;
}

/**
 * ドライバーディスクデータ処理パイプライン
 * DriverDiscListParser、DriverDiscDataProcessor、DriverDiscGenerator を統合
 * バッチ処理と API レート制限対応を実装
 * 要件: 4.4, 5.1
 */
class DriverDiscDataPipeline {
  private driverDiscListParser: DriverDiscListParser;
  private driverDiscDataProcessor: DriverDiscDataProcessor;
  private driverDiscGenerator: DriverDiscGenerator;
  public progressTracker?: EnhancedProgressTracker;
  private config: DriverDiscProcessingConfig;

  constructor(config?: DriverDiscProcessingConfig) {
    this.driverDiscListParser = new DriverDiscListParser();

    // 依存関係を注入
    const apiClient = new HoyoLabApiClient();
    const driverDiscDataMapper = new DriverDiscDataMapper();
    this.driverDiscDataProcessor = new DriverDiscDataProcessor(
      apiClient,
      driverDiscDataMapper
    );

    this.driverDiscGenerator = new DriverDiscGenerator();

    // 設定を取得
    const configManager = ConfigManager.getInstance();
    this.config = config || configManager.getDriverDiscProcessingConfig();
  }

  /**
   * ドライバーディスクデータ処理パイプラインを実行
   * 要件: 4.4, 5.1
   */
  async execute(): Promise<DriverDiscProcessingResult> {
    const startTime = Date.now();

    logger.info("ドライバーディスクデータ処理パイプラインを開始", {
      config: this.config,
      timestamp: new Date().toISOString(),
    });

    let driverDiscEntries: DriverDiscEntry[] = [];
    let processedDriverDiscs: ProcessedDriverDiscData[] = [];
    let driverDiscs: DriverDisc[] = [];
    const failedDriverDiscs: DriverDiscProcessingResult["failedDriverDiscs"] =
      [];
    let statistics: DriverDiscProcessingStatistics = {
      total: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      retries: 0,
      processingTime: 0,
      averageItemTime: 0,
      successRate: 0,
    };

    try {
      // ステップ1: ドライバーディスクリストの解析
      logger.info("ステップ1: ドライバーディスクリスト解析を開始");
      driverDiscEntries = await this.parseDriverDiscList();
      statistics.total = driverDiscEntries.length;

      if (driverDiscEntries.length === 0) {
        throw new ParsingError(
          "処理対象のドライバーディスクが見つかりませんでした"
        );
      }

      // ステップ2: 進捗監視の初期化
      this.initializeProgressTracker(driverDiscEntries.length);

      // ステップ3: バッチ処理でAPIデータを取得・処理
      logger.info("ステップ2: ドライバーディスクデータのバッチ処理を開始", {
        totalDriverDiscs: driverDiscEntries.length,
        batchSize: this.config.batchSize,
      });

      const batchResults = await this.processBatches(driverDiscEntries);
      processedDriverDiscs = batchResults.successful;
      failedDriverDiscs.push(...batchResults.failed);
      statistics.successful = processedDriverDiscs.length;
      statistics.failed = failedDriverDiscs.length;
      statistics.retries = batchResults.retries;

      // ステップ4: DriverDiscオブジェクトの生成
      logger.info("ステップ3: DriverDiscオブジェクト生成を開始", {
        processedDriverDiscs: processedDriverDiscs.length,
      });

      driverDiscs = await this.generateDriverDiscs(processedDriverDiscs);

      // ステップ5: ファイル出力
      logger.info("ステップ4: ファイル出力を開始", {
        driverDiscs: driverDiscs.length,
        outputPath: this.config.outputPath,
      });

      await this.outputDriverDiscFile(driverDiscs);

      // 統計情報の計算
      const endTime = Date.now();
      statistics.processingTime = endTime - startTime;
      statistics.averageItemTime =
        statistics.total > 0 ? statistics.processingTime / statistics.total : 0;
      statistics.successRate =
        statistics.total > 0
          ? (statistics.successful / statistics.total) * 100
          : 0;

      const result: DriverDiscProcessingResult = {
        driverDiscs,
        statistics,
        failedDriverDiscs,
        outputPath: this.config.outputPath,
        success: true,
      };

      logger.info("ドライバーディスクデータ処理パイプライン完了", {
        statistics,
        outputPath: this.config.outputPath,
        processingTime: `${statistics.processingTime}ms`,
      });

      return result;
    } catch (error) {
      const endTime = Date.now();
      statistics.processingTime = endTime - startTime;
      statistics.successRate =
        statistics.total > 0
          ? (statistics.successful / statistics.total) * 100
          : 0;

      logger.error("ドライバーディスクデータ処理パイプラインでエラーが発生", {
        error: error instanceof Error ? error.message : String(error),
        statistics,
        processingTime: `${statistics.processingTime}ms`,
      });

      const result: DriverDiscProcessingResult = {
        driverDiscs,
        statistics,
        failedDriverDiscs,
        outputPath: this.config.outputPath,
        success: false,
      };

      // 部分的な結果があれば保存を試行
      if (driverDiscs.length > 0) {
        await this.savePartialResults(driverDiscs, error);
      }

      throw error;
    } finally {
      // プログレストラッカーのクリーンアップ
      if (this.progressTracker) {
        // 最終統計を表示
        this.displayProgressSummary();
        this.progressTracker.displayFinalStatistics();
        this.progressTracker.cleanup();
      }
    }
  }

  /**
   * ドライバーディスクリストを解析
   * 要件: 1.1, 1.2
   */
  private async parseDriverDiscList(): Promise<DriverDiscEntry[]> {
    try {
      const driverDiscEntries =
        await this.driverDiscListParser.parseDiscListFile(
          this.config.discListPath
        );

      logger.info("ドライバーディスクリスト解析完了", {
        totalEntries: driverDiscEntries.length,
      });

      // 統計情報を表示
      this.driverDiscListParser.displayStatistics(driverDiscEntries);

      return driverDiscEntries;
    } catch (error) {
      logger.error("ドライバーディスクリスト解析に失敗", {
        discListPath: this.config.discListPath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ParsingError(
        `ドライバーディスクリストの解析に失敗しました: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 進捗監視を初期化
   * リアルタイム進捗表示機能を実装
   * 処理速度とメモリ使用量の監視
   * 既存の EnhancedProgressTracker を活用
   * 要件: 4.4
   */
  private initializeProgressTracker(totalDriverDiscs: number): void {
    this.progressTracker = new EnhancedProgressTracker(totalDriverDiscs, {
      showMemoryUsage: true,
      showPerformanceMetrics: true,
      showDetailedTiming: true,
      updateInterval: 1000,
      barWidth: 40,
      useColors: true,
    });

    // カスタム進捗コールバックを設定
    this.progressTracker.setProgressCallback((progress) => {
      // 詳細な進捗情報をログに記録
      logger.debug("ドライバーディスク処理進捗更新", {
        current: progress.current,
        total: progress.total,
        percentage: progress.percentage,
        currentItem: progress.currentItem,
        stage: progress.stage,
        itemsPerSecond: progress.itemsPerSecond,
        estimatedTimeRemaining: progress.estimatedTimeRemaining,
        memoryUsage: progress.memoryUsage,
        successCount: progress.successCount,
        failureCount: progress.failureCount,
        retryCount: progress.retryCount,
      });

      // メモリ使用量が閾値を超えた場合の警告
      if (
        progress.memoryUsage &&
        progress.memoryUsage.heapUsed > 500 * 1024 * 1024
      ) {
        // 500MB
        logger.warn("メモリ使用量が高くなっています", {
          heapUsed: `${Math.round(
            progress.memoryUsage.heapUsed / 1024 / 1024
          )}MB`,
          heapTotal: `${Math.round(
            progress.memoryUsage.heapTotal / 1024 / 1024
          )}MB`,
          recommendation:
            "処理を一時停止してガベージコレクションを実行することを検討してください",
        });
      }

      // 処理速度が低下した場合の警告
      if (progress.itemsPerSecond < 0.1 && progress.current > 5) {
        logger.warn("処理速度が低下しています", {
          itemsPerSecond: progress.itemsPerSecond,
          averageItemTime: `${Math.round(progress.averageItemTime)}ms`,
          recommendation:
            "API遅延時間の調整やバッチサイズの縮小を検討してください",
        });
      }
    });

    // カスタム表示コールバックを設定
    this.progressTracker.setDisplayCallback((display) => {
      // テスト環境以外でのみ表示
      if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
        // 前の行をクリアして新しい進捗を表示
        process.stdout.write("\r\x1b[K" + display);
      }
    });

    logger.info("進捗監視を初期化", {
      totalDriverDiscs,
      progressTrackerEnabled: true,
      memoryMonitoring: true,
      performanceMonitoring: true,
      realTimeDisplay: true,
    });
  }

  /**
   * バッチ処理でAPIデータを取得・処理
   * 要件: 1.3, 1.4, 2.4, 4.3
   */
  private async processBatches(driverDiscEntries: DriverDiscEntry[]): Promise<{
    successful: ProcessedDriverDiscData[];
    failed: DriverDiscProcessingResult["failedDriverDiscs"];
    retries: number;
  }> {
    const successful: ProcessedDriverDiscData[] = [];
    const failed: DriverDiscProcessingResult["failedDriverDiscs"] = [];
    let retries = 0;

    // バッチに分割
    const batches = this.createBatches(
      driverDiscEntries,
      this.config.batchSize
    );

    logger.info("バッチ処理を開始", {
      totalBatches: batches.length,
      batchSize: this.config.batchSize,
      totalDriverDiscs: driverDiscEntries.length,
    });

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      logger.debug(`バッチ ${batchIndex + 1}/${batches.length} を処理中`, {
        batchSize: batch.length,
        discIds: batch.map((d) => d.id),
      });

      // バッチ内の各ドライバーディスクを処理
      for (const driverDiscEntry of batch) {
        let currentRetries = 0;
        let processed = false;

        while (currentRetries <= this.config.maxRetries && !processed) {
          try {
            // 進捗更新
            if (this.progressTracker) {
              this.progressTracker.update(
                successful.length + failed.length,
                driverDiscEntry.name,
                `バッチ ${batchIndex + 1}/${batches.length}`,
                undefined,
                currentRetries > 0
              );
            }

            // ドライバーディスクデータを処理
            const processedData =
              await this.driverDiscDataProcessor.processDriverDiscData(
                driverDiscEntry
              );
            successful.push(processedData);
            processed = true;

            // 進捗更新（成功）
            if (this.progressTracker) {
              this.progressTracker.update(
                successful.length + failed.length,
                driverDiscEntry.name,
                "処理完了",
                true
              );
            }

            logger.debug("ドライバーディスク処理成功", {
              discId: driverDiscEntry.id,
              discName: driverDiscEntry.name,
              retries: currentRetries,
            });
          } catch (error) {
            currentRetries++;
            retries++;

            const errorMessage =
              error instanceof Error ? error.message : String(error);

            logger.warn("ドライバーディスク処理でエラーが発生", {
              discId: driverDiscEntry.id,
              discName: driverDiscEntry.name,
              attempt: currentRetries,
              maxRetries: this.config.maxRetries,
              error: errorMessage,
            });

            if (currentRetries > this.config.maxRetries) {
              // 最大リトライ回数に達した場合は失敗として記録
              failed.push({
                discId: driverDiscEntry.id,
                discName: driverDiscEntry.name,
                error: errorMessage,
                stage: "data_processing",
              });

              // 進捗更新（失敗）
              if (this.progressTracker) {
                this.progressTracker.update(
                  successful.length + failed.length,
                  driverDiscEntry.name,
                  "処理失敗",
                  false
                );
              }

              logger.error("ドライバーディスク処理が最終的に失敗", {
                discId: driverDiscEntry.id,
                discName: driverDiscEntry.name,
                totalRetries: currentRetries - 1,
                finalError: errorMessage,
              });
            } else {
              // リトライ前の遅延
              await this.delay(this.config.delayMs * currentRetries);
            }
          }
        }
      }

      // バッチ間の遅延（最後のバッチ以外）
      if (batchIndex < batches.length - 1) {
        await this.delay(this.config.delayMs);
      }

      // 進捗監視の健全性チェック（5バッチごと）
      if ((batchIndex + 1) % 5 === 0) {
        this.checkProgressHealth();
      }
    }

    logger.info("バッチ処理完了", {
      successful: successful.length,
      failed: failed.length,
      retries,
      successRate: `${Math.round(
        (successful.length / driverDiscEntries.length) * 100
      )}%`,
    });

    return { successful, failed, retries };
  }

  /**
   * DriverDiscオブジェクトを生成
   * 要件: 3.1, 3.2, 5.2
   */
  private async generateDriverDiscs(
    processedDriverDiscs: ProcessedDriverDiscData[]
  ): Promise<DriverDisc[]> {
    const driverDiscs: DriverDisc[] = [];

    logger.info("DriverDiscオブジェクト生成を開始", {
      processedDriverDiscs: processedDriverDiscs.length,
    });

    for (const processedData of processedDriverDiscs) {
      try {
        // 日本語データのみを使用（英語データは現在未実装）
        const driverDisc = this.driverDiscGenerator.generateDriverDisc(
          processedData,
          null, // 英語データは未実装
          processedData.basicInfo.id.toString()
        );

        // 生成されたDriverDiscオブジェクトを検証
        const validationResult =
          this.driverDiscGenerator.validateDriverDisc(driverDisc);
        if (!validationResult.isValid) {
          logger.warn("DriverDiscオブジェクト検証に失敗", {
            discId: driverDisc.id,
            errors: validationResult.errors,
          });
          continue; // 無効なDriverDiscはスキップ
        }

        driverDiscs.push(driverDisc);

        logger.debug("DriverDiscオブジェクト生成成功", {
          discId: driverDisc.id,
          discName: driverDisc.name.ja,
          specialty: driverDisc.specialty,
          releaseVersion: driverDisc.releaseVersion,
        });
      } catch (error) {
        logger.error("DriverDiscオブジェクト生成に失敗", {
          discId: processedData.basicInfo.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info("DriverDiscオブジェクト生成完了", {
      processedDriverDiscs: processedDriverDiscs.length,
      generatedDriverDiscs: driverDiscs.length,
      successRate: `${Math.round(
        (driverDiscs.length / processedDriverDiscs.length) * 100
      )}%`,
    });

    return driverDiscs;
  }

  /**
   * ドライバーディスクファイルを出力
   * 要件: 5.2
   */
  private async outputDriverDiscFile(driverDiscs: DriverDisc[]): Promise<void> {
    try {
      // 出力ディレクトリを確保
      const outputDir = path.dirname(this.config.outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        logger.info("出力ディレクトリを作成", { outputDir });
      }

      // ファイル出力
      await this.driverDiscGenerator.generateDriverDiscsFile(
        driverDiscs,
        this.config.outputPath
      );

      // 出力ファイルの検証
      if (!fs.existsSync(this.config.outputPath)) {
        throw new ValidationError("出力ファイルが生成されませんでした");
      }

      const stats = fs.statSync(this.config.outputPath);
      if (stats.size === 0) {
        throw new ValidationError("出力ファイルが空です");
      }

      logger.info("ドライバーディスクファイル出力完了", {
        outputPath: this.config.outputPath,
        driverDiscCount: driverDiscs.length,
        fileSize: stats.size,
      });
    } catch (error) {
      logger.error("ドライバーディスクファイル出力に失敗", {
        outputPath: this.config.outputPath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 部分的な結果を保存
   */
  private async savePartialResults(
    driverDiscs: DriverDisc[],
    error: unknown
  ): Promise<void> {
    try {
      const partialOutputPath = this.config.outputPath.replace(
        ".ts",
        "-partial.ts"
      );

      logger.info("部分的な結果を保存中", {
        partialOutputPath,
        driverDiscCount: driverDiscs.length,
        originalError: error instanceof Error ? error.message : String(error),
      });

      await this.driverDiscGenerator.generateDriverDiscsFile(
        driverDiscs,
        partialOutputPath
      );

      logger.info("部分的な結果を保存完了", {
        partialOutputPath,
        driverDiscCount: driverDiscs.length,
      });
    } catch (saveError) {
      logger.error("部分的な結果の保存に失敗", {
        error:
          saveError instanceof Error ? saveError.message : String(saveError),
      });
    }
  }

  /**
   * 配列をバッチに分割
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 指定時間待機
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 進捗監視の健全性チェック
   */
  private checkProgressHealth(): void {
    if (!this.progressTracker) {
      return;
    }

    const progressInfo = this.progressTracker.getProgressInfo();

    // メモリ使用量チェック
    if (progressInfo.memoryUsage) {
      const heapUsedMB = progressInfo.memoryUsage.heapUsed / 1024 / 1024;
      if (heapUsedMB > 800) {
        // 800MB
        logger.warn("メモリ使用量が危険レベルに達しています", {
          heapUsedMB: Math.round(heapUsedMB),
          recommendation: "処理の一時停止を検討してください",
        });
      }
    }

    // 処理速度チェック
    if (progressInfo.itemsPerSecond < 0.05 && progressInfo.current > 10) {
      logger.warn("処理速度が著しく低下しています", {
        itemsPerSecond: progressInfo.itemsPerSecond,
        recommendation: "設定の見直しまたは処理の中断を検討してください",
      });
    }
  }

  /**
   * 進捗監視の詳細サマリーを表示
   * 要件: 4.4
   */
  private displayProgressSummary(): void {
    if (!this.progressTracker) {
      return;
    }

    const progressInfo = this.progressTracker.getProgressInfo();

    if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
      console.log("\n📊 === 進捗監視サマリー ===");
      console.log(
        `総処理時間: ${this.formatDuration(progressInfo.elapsedTime)}`
      );
      console.log(
        `平均処理時間: ${Math.round(
          progressInfo.averageItemTime
        )}ms/ドライバーディスク`
      );
      console.log(
        `処理速度: ${progressInfo.itemsPerSecond.toFixed(
          2
        )} ドライバーディスク/秒`
      );
      console.log(`成功: ${progressInfo.successCount}`);
      console.log(`失敗: ${progressInfo.failureCount}`);
      console.log(`リトライ: ${progressInfo.retryCount}`);

      if (progressInfo.memoryUsage) {
        console.log(
          `最終メモリ使用量: ${Math.round(
            progressInfo.memoryUsage.heapUsed / 1024 / 1024
          )}MB`
        );
      }
      console.log("========================\n");
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

  /**
   * 処理統計レポートを生成
   * 成功・失敗の統計情報を含むレポートを生成
   * 詳細なエラー情報と部分的に取得できたデータを記録
   * 処理結果の要約とパフォーマンス指標を出力
   * 要件: 4.4, 5.1
   */
  generateProcessingReport(result: DriverDiscProcessingResult): string {
    const { statistics, failedDriverDiscs, driverDiscs } = result;

    let report = `# ドライバーディスクデータ処理レポート\n\n`;
    report += `生成日時: ${new Date().toLocaleString()}\n`;
    report += `出力ファイル: ${result.outputPath}\n`;
    report += `処理成功: ${result.success ? "✅ 成功" : "❌ 失敗"}\n\n`;

    // 実行概要
    report += `## 実行概要\n`;
    report += `- 設定ファイル: ${this.config.discListPath}\n`;
    report += `- バッチサイズ: ${this.config.batchSize}\n`;
    report += `- API遅延時間: ${this.config.delayMs}ms\n`;
    report += `- 最大リトライ回数: ${this.config.maxRetries}\n`;
    report += `- データ検証: ${
      this.config.enableValidation ? "有効" : "無効"
    }\n\n`;

    // 処理統計
    report += `## 処理統計\n`;
    report += `- 総ドライバーディスク数: ${statistics.total}\n`;
    report += `- 処理成功: ${statistics.successful}\n`;
    report += `- 処理失敗: ${statistics.failed}\n`;
    report += `- スキップ: ${statistics.skipped}\n`;
    report += `- リトライ回数: ${statistics.retries}\n`;
    report += `- 成功率: ${Math.round(statistics.successRate)}%\n`;
    report += `- 総処理時間: ${this.formatDuration(
      statistics.processingTime
    )}\n`;
    report += `- 平均処理時間: ${Math.round(
      statistics.averageItemTime
    )}ms/ドライバーディスク\n\n`;

    // パフォーマンス指標
    const itemsPerSecond =
      statistics.processingTime > 0
        ? (statistics.total * 1000) / statistics.processingTime
        : 0;

    report += `## パフォーマンス指標\n`;
    report += `- 処理速度: ${itemsPerSecond.toFixed(
      2
    )} ドライバーディスク/秒\n`;
    report += `- スループット: ${Math.round(
      (statistics.successful * 1000) / statistics.processingTime
    )} 成功/秒\n`;

    if (statistics.retries > 0) {
      const retryRate = (statistics.retries / statistics.total) * 100;
      report += `- リトライ率: ${Math.round(retryRate)}%\n`;
    }

    // 進捗監視データがある場合
    if (this.progressTracker) {
      const progressInfo = this.progressTracker.getProgressInfo();
      report += `- 実測処理速度: ${progressInfo.itemsPerSecond.toFixed(
        2
      )} ドライバーディスク/秒\n`;

      if (progressInfo.memoryUsage) {
        report += `- 最大メモリ使用量: ${Math.round(
          progressInfo.memoryUsage.heapUsed / 1024 / 1024
        )}MB\n`;
      }
    }
    report += `\n`;

    // エラー分析
    if (failedDriverDiscs.length > 0) {
      report += `## エラー分析\n`;

      // エラーを段階別に分類
      const errorsByStage = failedDriverDiscs.reduce((acc, failed) => {
        acc[failed.stage] = (acc[failed.stage] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      report += `### エラー段階別統計\n`;
      Object.entries(errorsByStage).forEach(([stage, count]) => {
        report += `- ${stage}: ${count}件\n`;
      });
      report += `\n`;

      // エラーメッセージの分析
      const errorMessages = failedDriverDiscs.map((f) => f.error);
      const uniqueErrors = Array.from(new Set(errorMessages));

      report += `### 主要なエラーメッセージ\n`;
      uniqueErrors.slice(0, 10).forEach((error, index) => {
        const count = errorMessages.filter((msg) => msg === error).length;
        report += `${index + 1}. ${error} (${count}件)\n`;
      });

      if (uniqueErrors.length > 10) {
        report += `... その他 ${uniqueErrors.length - 10} 種類のエラー\n`;
      }
      report += `\n`;

      // 失敗したドライバーディスクの詳細
      report += `### 失敗したドライバーディスク詳細\n`;
      failedDriverDiscs.forEach((failed, index) => {
        report += `${index + 1}. **${failed.discName}** (ID: ${
          failed.discId
        })\n`;
        report += `   - エラー: ${failed.error}\n`;
        report += `   - 処理段階: ${failed.stage}\n\n`;
      });
    }

    // 成功したドライバーディスクの分析
    if (driverDiscs.length > 0) {
      report += `## 成功したドライバーディスク分析\n`;

      // 特性別統計（配列形式に対応）
      const specialtyStats = driverDiscs.reduce((acc, driverDisc) => {
        driverDisc.specialty.forEach((specialty) => {
          acc[specialty] = (acc[specialty] || 0) + 1;
        });
        return acc;
      }, {} as Record<string, number>);

      report += `### 特性別統計\n`;
      Object.entries(specialtyStats).forEach(([specialty, count]) => {
        report += `- ${specialty}: ${count}件\n`;
      });
      report += `\n`;

      // リリースバージョン別統計
      const versionStats = driverDiscs.reduce((acc, driverDisc) => {
        const version = driverDisc.releaseVersion.toString();
        acc[version] = (acc[version] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      report += `### リリースバージョン別統計\n`;
      Object.entries(versionStats).forEach(([version, count]) => {
        report += `- v${version}: ${count}件\n`;
      });
      report += `\n`;

      // 生成されたドライバーディスク一覧（最初の20件）
      report += `### 生成されたドライバーディスク一覧\n`;
      driverDiscs.slice(0, 20).forEach((driverDisc, index) => {
        report += `${index + 1}. **${driverDisc.name.ja}** (ID: ${
          driverDisc.id
        })\n`;
        report += `   - 特性: ${driverDisc.specialty}\n`;
        report += `   - リリースバージョン: v${driverDisc.releaseVersion}\n`;
        report += `   - 4セット効果: ${driverDisc.fourSetEffect.ja.substring(
          0,
          100
        )}...\n`;
        report += `   - 2セット効果: ${driverDisc.twoSetEffect.ja.substring(
          0,
          100
        )}...\n\n`;
      });

      if (driverDiscs.length > 20) {
        report += `... その他 ${
          driverDiscs.length - 20
        } 件のドライバーディスク\n\n`;
      }
    }

    // 推奨事項
    report += `## 推奨事項\n`;

    if (statistics.successRate < 80) {
      report += `- ⚠️  成功率が${Math.round(
        statistics.successRate
      )}%と低いです。API遅延時間の増加やバッチサイズの縮小を検討してください。\n`;
    }

    if (statistics.retries > statistics.total * 0.5) {
      report += `- ⚠️  リトライ回数が多いです。ネットワーク接続やAPI制限を確認してください。\n`;
    }

    if (itemsPerSecond < 0.1) {
      report += `- ⚠️  処理速度が遅いです。並列処理の設定やシステムリソースを確認してください。\n`;
    }

    if (failedDriverDiscs.length > 0) {
      const commonErrors = failedDriverDiscs.map((f) => f.error);
      const mostCommonError = commonErrors.reduce((acc, error) => {
        acc[error] = (acc[error] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topError = Object.entries(mostCommonError).sort(
        ([, a], [, b]) => b - a
      )[0];

      if (topError && topError[1] > 1) {
        report += `- 🔍 最も多いエラー「${topError[0]}」が${topError[1]}件発生しています。このエラーの対策を優先してください。\n`;
      }
    }

    if (statistics.successRate >= 95) {
      report += `- ✅ 成功率が${Math.round(
        statistics.successRate
      )}%と高く、良好な処理結果です。\n`;
    }

    report += `\n`;

    // 技術的詳細
    report += `## 技術的詳細\n`;
    report += `- Node.js バージョン: ${process.version}\n`;
    report += `- プラットフォーム: ${process.platform}\n`;
    report += `- アーキテクチャ: ${process.arch}\n`;
    report += `- 実行時刻: ${new Date().toISOString()}\n`;

    if (this.progressTracker) {
      const progressInfo = this.progressTracker.getProgressInfo();
      if (progressInfo.memoryUsage) {
        report += `- 最終メモリ使用量: ヒープ ${Math.round(
          progressInfo.memoryUsage.heapUsed / 1024 / 1024
        )}MB / 総計 ${Math.round(
          progressInfo.memoryUsage.heapTotal / 1024 / 1024
        )}MB\n`;
      }
    }

    report += `\n---\n`;
    report += `レポート生成: ドライバーディスクデータ処理パイプライン v1.0\n`;

    return report;
  }
}

/**
 * デフォルト設定
 */
const DEFAULT_CONFIG: DriverDiscProcessingConfig = {
  discListPath: "json/data/disc-list.json",
  outputPath: "data/driverDiscs.ts",
  batchSize: 5,
  delayMs: 1000,
  maxRetries: 3,
  enableValidation: true,
  logLevel: "info",
};

/**
 * 設定ファイルを読み込む
 */
function loadConfig(configPath?: string): DriverDiscProcessingConfig {
  // 優先順位: 引数 > グローバル変数 > デフォルト
  const finalConfigPath =
    configPath || (global as any).configPath || "processing-config.json";
  try {
    if (fs.existsSync(finalConfigPath)) {
      const configContent = fs.readFileSync(finalConfigPath, "utf-8");
      const config = JSON.parse(configContent);

      // ドライバーディスク固有の設定を抽出（存在する場合）
      const driverDiscConfig = config.driverDiscProcessing || config;

      logger.info("設定ファイルを読み込みました", {
        configPath: finalConfigPath,
        loadedConfig: driverDiscConfig,
      });

      return { ...DEFAULT_CONFIG, ...driverDiscConfig };
    } else {
      logger.warn("設定ファイルが見つかりません。デフォルト設定を使用します", {
        configPath: finalConfigPath,
      });
      return DEFAULT_CONFIG;
    }
  } catch (error) {
    logger.error(
      "設定ファイルの読み込みに失敗しました。デフォルト設定を使用します",
      {
        configPath: finalConfigPath,
        error: error instanceof Error ? error.message : String(error),
      }
    );
    return DEFAULT_CONFIG;
  }
}

/**
 * 出力ディレクトリを確保する
 */
function ensureOutputDirectory(outputPath: string): void {
  const outputDir = path.dirname(outputPath);

  if (!fs.existsSync(outputDir)) {
    logger.info("出力ディレクトリを作成します", { outputDir });
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

/**
 * 処理結果を検証する
 */
function validateResults(
  result: DriverDiscProcessingResult,
  outputPath: string,
  config: DriverDiscProcessingConfig
): void {
  logger.info("処理結果を検証中...");

  // 出力ファイルの存在確認
  if (!fs.existsSync(outputPath)) {
    throw new Error(`出力ファイルが生成されませんでした: ${outputPath}`);
  }

  // 出力ファイルのサイズ確認
  const stats = fs.statSync(outputPath);
  if (stats.size === 0) {
    throw new Error(`出力ファイルが空です: ${outputPath}`);
  }

  logger.info("処理結果検証完了", {
    outputPath,
    fileSize: stats.size,
    successfulDriverDiscs: result.driverDiscs.length,
    failedDriverDiscs: result.failedDriverDiscs.length,
  });
}

/**
 * 処理レポートを生成する
 */
function generateReport(
  result: DriverDiscProcessingResult,
  pipeline: DriverDiscDataPipeline,
  config: DriverDiscProcessingConfig
): void {
  try {
    const reportPath = config.outputPath.replace(
      ".ts",
      "-processing-report.md"
    );

    logger.info("処理レポートを生成中...", {
      reportPath,
    });

    const report = pipeline.generateProcessingReport(result);

    // レポートファイルに書き込み
    fs.writeFileSync(reportPath, report, "utf-8");

    logger.info("処理レポートを生成しました", {
      reportPath,
    });
  } catch (error) {
    logger.error("処理レポートの生成に失敗しました", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * メイン実行関数
 * 全ドライバーディスクデータ生成の統合実行機能
 * 設定ファイルからの処理パラメータ読み込み
 * 実行結果の検証と出力ファイル確認
 * 要件: 4.4, 5.1
 */
async function main(): Promise<void> {
  const startTime = new Date();

  try {
    console.log("🚀 === ドライバーディスクデータ生成開始 ===");
    console.log(`開始時刻: ${startTime.toLocaleString()}`);
    console.log("================================\n");

    // 設定を読み込み
    const config = loadConfig();

    // 出力ディレクトリを確保
    ensureOutputDirectory(config.outputPath);

    // パイプラインを初期化
    const pipeline = new DriverDiscDataPipeline(config);

    // 全ドライバーディスクを処理
    logger.info("ドライバーディスクデータ処理を開始します", {
      discListPath: config.discListPath,
      batchSize: config.batchSize,
      delayMs: config.delayMs,
      maxRetries: config.maxRetries,
    });

    const result = await pipeline.execute();

    // 処理結果を検証
    if (config.enableValidation) {
      validateResults(result, config.outputPath, config);
    }

    // 処理レポートを生成
    generateReport(result, pipeline, config);

    const endTime = new Date();
    const processingTime = endTime.getTime() - startTime.getTime();

    console.log("\n🎉 === ドライバーディスクデータ生成完了 ===");
    console.log(`終了時刻: ${endTime.toLocaleString()}`);
    console.log(`総処理時間: ${formatDuration(processingTime)}`);
    console.log(`成功: ${result.driverDiscs.length}`);
    console.log(`失敗: ${result.failedDriverDiscs.length}`);
    console.log(
      `成功率: ${Math.round(
        (result.driverDiscs.length / result.statistics.total) * 100
      )}%`
    );
    console.log("================================\n");

    // 失敗がある場合は警告を表示
    if (result.failedDriverDiscs.length > 0) {
      console.warn(
        `⚠️  ${result.failedDriverDiscs.length}個のドライバーディスクの処理に失敗しました。詳細はログを確認してください。`
      );

      // 失敗したドライバーディスクのリストを表示
      console.log("\n失敗したドライバーディスク:");
      result.failedDriverDiscs.forEach((failed, index) => {
        console.log(`  ${index + 1}. ${failed.discName}: ${failed.error}`);
      });
    }

    // 成功時の終了コード
    process.exit(0);
  } catch (error) {
    const endTime = new Date();
    const processingTime = endTime.getTime() - startTime.getTime();

    console.error("\n❌ === ドライバーディスクデータ生成失敗 ===");
    console.error(`終了時刻: ${endTime.toLocaleString()}`);
    console.error(`処理時間: ${formatDuration(processingTime)}`);
    console.error(
      `エラー: ${error instanceof Error ? error.message : String(error)}`
    );
    console.error("================================\n");

    logger.error(
      "ドライバーディスクデータ生成中に致命的なエラーが発生しました",
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
    );

    // 失敗時の終了コード
    process.exit(1);
  }
}

/**
 * 時間をフォーマット
 */
function formatDuration(ms: number): string {
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

/**
 * コマンドライン引数の処理
 */
function parseCommandLineArgs(): { configPath?: string; help?: boolean } {
  const args = process.argv.slice(2);
  const result: { configPath?: string; help?: boolean } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--config" || arg === "-c") {
      result.configPath = args[i + 1];
      i++; // 次の引数をスキップ
    }
  }

  return result;
}

/**
 * ヘルプメッセージを表示
 */
function showHelp(): void {
  console.log(`
ドライバーディスクデータ生成スクリプト

使用方法:
  npm run generate:driver-discs [オプション]
  node dist/main-driver-disc-generation.js [オプション]

オプション:
  --config, -c <path>   設定ファイルのパス (デフォルト: processing-config.json)
  --help, -h           このヘルプメッセージを表示

設定ファイル例:
{
  "driverDiscProcessing": {
    "discListPath": "json/data/disc-list.json",
    "outputPath": "data/driverDiscs.ts",
    "batchSize": 5,
    "delayMs": 1000,
    "maxRetries": 3,
    "enableValidation": true,
    "logLevel": "info"
  }
}

例:
  npm run generate:driver-discs
  npm run generate:driver-discs -- --config custom-config.json
  npm run generate:driver-discs -- --help
`);
}

// スクリプトが直接実行された場合のみメイン関数を実行
if (require.main === module) {
  const args = parseCommandLineArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  // 設定ファイルパスが指定された場合は使用
  if (args.configPath) {
    // グローバル変数として設定（loadConfig関数で使用）
    (global as any).configPath = args.configPath;
  }

  main().catch((error) => {
    console.error("予期しないエラーが発生しました:", error);
    process.exit(1);
  });
}

export { main, loadConfig, DriverDiscDataPipeline };
export type { DriverDiscProcessingConfig, DriverDiscProcessingResult };
