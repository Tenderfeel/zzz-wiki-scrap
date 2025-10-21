import { FileLoader } from "../loaders/FileLoader";
import { WeaponIconProcessor } from "../processors/WeaponIconProcessor";
import {
  WeaponEntry,
  WeaponIconConfig,
  WeaponIconInfo,
  WeaponIconDownloadResult,
  WeaponIconProcessingResult,
} from "../types/processing";
import { logger, LogMessages } from "../utils/Logger";
import { WeaponIconBatchError } from "../errors";
import { promises as fs } from "fs";
import * as path from "path";

/**
 * 武器アイコンダウンロードの統合処理を担当するクラス
 * SとAレアリティの武器アイコンのみを効率的にダウンロードし、統計情報を提供する
 * 要件: 1.4, 5.5
 */
export class WeaponIconGenerator {
  private readonly fileLoader: FileLoader;
  private readonly weaponIconProcessor: WeaponIconProcessor;
  private readonly config: WeaponIconConfig;

  constructor(
    fileLoader: FileLoader,
    weaponIconProcessor: WeaponIconProcessor,
    config: WeaponIconConfig
  ) {
    this.fileLoader = fileLoader;
    this.weaponIconProcessor = weaponIconProcessor;
    this.config = config;
  }

  /**
   * 全武器アイコンのダウンロード処理を実行
   * 要件: 1.4, 5.5
   */
  async generateWeaponIcons(): Promise<WeaponIconProcessingResult> {
    const startTime = Date.now();

    // 詳細な開始ログ
    logger.info(LogMessages.WEAPON_ICON_GENERATION_START, {
      startTime: new Date(startTime).toISOString(),
      config: {
        outputDirectory: this.config.outputDirectory,
        maxConcurrency: this.config.maxConcurrency,
        retryAttempts: this.config.retryAttempts,
        retryDelayMs: this.config.retryDelayMs,
        requestDelayMs: this.config.requestDelayMs,
        skipExisting: this.config.skipExisting,
        validateDownloads: this.config.validateDownloads,
        maxFileSizeMB: this.config.maxFileSizeMB,
      },
      systemInfo: {
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    });

    try {
      // 出力ディレクトリの検証と作成
      await this.validateOutputDirectory();

      // weapon-list.jsonから武器エントリを取得
      const weaponEntries = await this.loadWeaponList();

      logger.info(`${weaponEntries.length}個の武器エントリを取得しました`, {
        weaponIds: weaponEntries.map((entry) => entry.entry_page_id),
      });

      // バッチ処理でアイコンをダウンロード
      const results = await this.processWeaponsBatch(weaponEntries);

      // 結果を集計
      const successful: WeaponIconInfo[] = [];
      const failed: Array<{
        weaponId: string;
        weaponName: string;
        error: string;
        iconUrl?: string;
      }> = [];

      let totalSizeBytes = 0;

      for (const result of results) {
        if (result.success && result.iconInfo) {
          successful.push(result.iconInfo);
          totalSizeBytes += result.iconInfo.fileSize || 0;
        } else {
          // 武器名を取得するために元のエントリを検索
          const originalEntry = weaponEntries.find(
            (entry) => entry.entry_page_id === result.weaponId
          );
          failed.push({
            weaponId: result.weaponId,
            weaponName: originalEntry?.name || "不明",
            error: result.error || "不明なエラー",
            iconUrl: originalEntry?.icon_url,
          });
        }
      }

      const processingTimeMs = Date.now() - startTime;

      const processingResult: WeaponIconProcessingResult = {
        successful,
        failed,
        statistics: {
          total: weaponEntries.length,
          successful: successful.length,
          failed: failed.length,
          totalSizeBytes,
          processingTimeMs,
        },
      };

      // 統計情報をログ出力
      this.logProcessingStatistics(processingResult);

      logger.info(LogMessages.WEAPON_ICON_GENERATION_SUCCESS, {
        totalProcessed: processingResult.statistics.total,
        successful: processingResult.statistics.successful,
        failed: processingResult.statistics.failed,
        processingTimeMs: processingResult.statistics.processingTimeMs,
        performance: {
          totalExecutionTimeMs: processingTimeMs,
          avgProcessingTimePerWeapon:
            processingTimeMs / processingResult.statistics.total,
          throughputPerSecond:
            (processingResult.statistics.total / processingTimeMs) * 1000,
          successRate:
            (processingResult.statistics.successful /
              processingResult.statistics.total) *
            100,
        },
        systemInfo: {
          finalMemoryUsage: process.memoryUsage(),
          endTime: new Date().toISOString(),
        },
      });

      // 詳細な成功ログ
      logger.debug("武器アイコン生成完了 - 詳細情報", {
        processingResult: {
          ...processingResult,
          successful: processingResult.successful.map((icon) => ({
            ...icon,
            downloadedAt: icon.downloadedAt?.toISOString(),
          })),
        },
        performanceMetrics: {
          totalExecutionTimeMs: processingTimeMs,
          processingTimeMs: processingResult.statistics.processingTimeMs,
          overheadTimeMs:
            processingTimeMs - processingResult.statistics.processingTimeMs,
          avgProcessingTimePerWeapon:
            processingTimeMs / processingResult.statistics.total,
          avgSuccessfulProcessingTime:
            processingResult.statistics.successful > 0
              ? processingResult.statistics.processingTimeMs /
                processingResult.statistics.successful
              : 0,
          throughputPerSecond:
            (processingResult.statistics.total / processingTimeMs) * 1000,
          successRate:
            (processingResult.statistics.successful /
              processingResult.statistics.total) *
            100,
        },
        systemMetrics: {
          startMemoryUsage: process.memoryUsage(),
          finalMemoryUsage: process.memoryUsage(),
          startTime: new Date(startTime).toISOString(),
          endTime: new Date().toISOString(),
        },
      });

      return processingResult;
    } catch (error) {
      const errorTime = Date.now();
      const executionTimeMs = errorTime - startTime;

      const errorContext = {
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : "Unknown",
        errorStack: error instanceof Error ? error.stack : undefined,
        timing: {
          executionTimeMs,
          errorTime: new Date(errorTime).toISOString(),
          startTime: new Date(startTime).toISOString(),
        },
        systemInfo: {
          memoryUsage: process.memoryUsage(),
          timestamp: new Date().toISOString(),
        },
        configSnapshot: {
          ...this.config,
        },
      };

      logger.error(LogMessages.WEAPON_ICON_GENERATION_ERROR, errorContext);

      // バッチエラーの場合は詳細情報を追加
      if (error instanceof WeaponIconBatchError) {
        logger.error("バッチ処理詳細エラー", {
          ...errorContext,
          batchErrorDetails: {
            failedWeapons: error.failedWeapons,
            totalWeapons: error.totalWeapons,
            details: error.details,
            originalError: error.originalError?.message,
            failureRate: error.failedWeapons.length / error.totalWeapons,
          },
        });
      }

      // 詳細なデバッグエラー情報
      logger.debug("武器アイコン生成エラー - 完全なデバッグ情報", {
        ...errorContext,
        errorDetails: {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : "Unknown",
          stack: error instanceof Error ? error.stack : undefined,
          cause: error instanceof Error ? (error as any).cause : undefined,
        },
        processingState: {
          executionTimeMs,
          wasProcessingStarted: true,
          errorOccurredAt: "generation_phase",
        },
        systemState: {
          memoryUsage: process.memoryUsage(),
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
        },
      });

      throw error;
    }
  }

  /**
   * weapon-list.jsonから武器エントリを読み込み、SとAレアリティのみをフィルタリング
   * 要件: 1.4, 5.5
   */
  async loadWeaponList(): Promise<WeaponEntry[]> {
    try {
      logger.info("weapon-list.json読み込み開始", {
        filePath: "json/data/weapon-list.json",
      });

      // weapon-list.jsonを読み込み
      const fileContent = await fs.readFile(
        "json/data/weapon-list.json",
        "utf-8"
      );
      const allWeapons: WeaponEntry[] = JSON.parse(fileContent);

      logger.info(`全武器エントリ数: ${allWeapons.length}`);

      // SとAレアリティのみをフィルタリング
      const filteredWeapons = allWeapons.filter((weapon) => {
        const rarityValues = weapon.filter_values?.w_engine_rarity?.values;
        if (!rarityValues || !Array.isArray(rarityValues)) {
          logger.warn("レアリティ情報が見つかりません", {
            weaponId: weapon.entry_page_id,
            weaponName: weapon.name,
          });
          return false;
        }

        const isValidRarity = rarityValues.some(
          (rarity) => rarity === "S" || rarity === "A"
        );

        if (!isValidRarity) {
          logger.debug("レアリティフィルタによりスキップ", {
            weaponId: weapon.entry_page_id,
            weaponName: weapon.name,
            rarity: rarityValues,
          });
        }

        return isValidRarity;
      });

      logger.info(
        `フィルタリング後の武器エントリ数: ${filteredWeapons.length}`,
        {
          filteredWeaponIds: filteredWeapons.map(
            (weapon) => weapon.entry_page_id
          ),
          rarityDistribution: this.analyzeRarityDistribution(filteredWeapons),
        }
      );

      return filteredWeapons;
    } catch (error) {
      logger.error("weapon-list.json読み込みエラー", {
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : "Unknown",
      });
      throw error;
    }
  }

  /**
   * 武器エントリをバッチ処理で並行ダウンロード
   * 3-5件ずつの並行処理とリクエスト間遅延を実装
   * 要件: 3.1, 3.3
   */
  async processWeaponsBatch(
    weaponEntries: WeaponEntry[]
  ): Promise<WeaponIconDownloadResult[]> {
    const results: WeaponIconDownloadResult[] = [];
    const batchSize = this.config.maxConcurrency;
    const totalBatches = Math.ceil(weaponEntries.length / batchSize);
    const startTime = Date.now();

    // 進捗追跡用の統計
    const overallStats = {
      totalProcessed: 0,
      totalSuccessful: 0,
      totalFailed: 0,
      startTime,
    };

    logger.info(LogMessages.WEAPON_ICON_BATCH_START, {
      batchSize,
      totalWeapons: weaponEntries.length,
      totalBatches,
      maxConcurrency: this.config.maxConcurrency,
      requestDelayMs: this.config.requestDelayMs,
    });

    // バッチごとに処理
    for (let i = 0; i < weaponEntries.length; i += batchSize) {
      const batch = weaponEntries.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      logger.info(`バッチ ${batchNumber}/${totalBatches} 処理開始`, {
        batchSize: batch.length,
        weaponIds: batch.map((entry) => entry.entry_page_id),
        weaponNames: batch.map((entry) => entry.name),
      });

      // 並行処理でバッチ内の武器を処理
      const batchPromises = batch.map(async (weaponEntry, index) => {
        // バッチ内でも少し遅延を入れてリクエストを分散
        if (index > 0) {
          await this.sleep(100 * index); // 100ms * インデックス
        }
        return this.weaponIconProcessor.processWeaponIcon(weaponEntry);
      });

      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // 統計を更新
        overallStats.totalProcessed += batchResults.length;
        overallStats.totalSuccessful += batchResults.filter(
          (r) => r.success
        ).length;
        overallStats.totalFailed += batchResults.filter(
          (r) => !r.success
        ).length;

        // リアルタイム進捗表示
        this.logBatchProgress(
          batchNumber,
          totalBatches,
          batchResults,
          overallStats
        );
      } catch (error) {
        logger.error(LogMessages.WEAPON_ICON_BATCH_ERROR, {
          batchNumber,
          totalBatches,
          batchSize: batch.length,
          weaponIds: batch.map((entry) => entry.entry_page_id),
          error: error instanceof Error ? error.message : String(error),
          errorType:
            error instanceof Error ? error.constructor.name : "Unknown",
        });

        // バッチ処理が失敗した場合、個別に処理を試行
        logger.info(LogMessages.WEAPON_ICON_BATCH_INDIVIDUAL_FALLBACK, {
          batchNumber,
          batchSize: batch.length,
        });

        const individualResults: WeaponIconDownloadResult[] = [];
        for (const weaponEntry of batch) {
          try {
            const result = await this.weaponIconProcessor.processWeaponIcon(
              weaponEntry
            );
            individualResults.push(result);
          } catch (individualError) {
            logger.error("個別処理でもエラーが発生", {
              weaponId: weaponEntry.entry_page_id,
              weaponName: weaponEntry.name,
              error:
                individualError instanceof Error
                  ? individualError.message
                  : String(individualError),
              errorType:
                individualError instanceof Error
                  ? individualError.constructor.name
                  : "Unknown",
            });

            individualResults.push({
              success: false,
              weaponId: weaponEntry.entry_page_id,
              error:
                individualError instanceof Error
                  ? individualError.message
                  : String(individualError),
              retryCount: 0,
            });
          }
        }

        results.push(...individualResults);

        // 統計を更新
        overallStats.totalProcessed += individualResults.length;
        overallStats.totalSuccessful += individualResults.filter(
          (r) => r.success
        ).length;
        overallStats.totalFailed += individualResults.filter(
          (r) => !r.success
        ).length;

        // 進捗表示
        this.logBatchProgress(
          batchNumber,
          totalBatches,
          individualResults,
          overallStats
        );
      }

      // バッチ間の遅延（最後のバッチ以外）
      if (i + batchSize < weaponEntries.length) {
        logger.debug(`バッチ間遅延: ${this.config.requestDelayMs}ms`);
        await this.sleep(this.config.requestDelayMs);
      }
    }

    return results;
  }

  /**
   * 出力ディレクトリの検証と作成
   */
  async validateOutputDirectory(): Promise<void> {
    try {
      await fs.access(this.config.outputDirectory);
      logger.debug(LogMessages.WEAPON_ICON_OUTPUT_DIRECTORY_VALIDATION, {
        outputDirectory: this.config.outputDirectory,
        status: "exists",
      });
    } catch {
      logger.info(LogMessages.WEAPON_ICON_OUTPUT_DIRECTORY_CREATED, {
        outputDirectory: this.config.outputDirectory,
      });
      await fs.mkdir(this.config.outputDirectory, { recursive: true });
    }

    // ディレクトリの書き込み権限をチェック
    const testFile = path.join(this.config.outputDirectory, ".write-test");
    try {
      await fs.writeFile(testFile, "test");
      await fs.unlink(testFile);
      logger.debug(LogMessages.WEAPON_ICON_OUTPUT_DIRECTORY_WRITE_TEST, {
        outputDirectory: this.config.outputDirectory,
        status: "success",
      });
    } catch (error) {
      const writeError = new WeaponIconBatchError(
        [],
        0,
        `出力ディレクトリに書き込み権限がありません: ${this.config.outputDirectory}`,
        error instanceof Error ? error : new Error(String(error))
      );

      logger.error(LogMessages.WEAPON_ICON_OUTPUT_DIRECTORY_WRITE_TEST, {
        outputDirectory: this.config.outputDirectory,
        status: "failed",
        error: writeError.message,
      });

      throw writeError;
    }
  }

  /**
   * 指定時間待機する
   * @param ms 待機時間（ミリ秒）
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  } /**
   *
 処理統計情報をログ出力
   * リアルタイム進捗表示、成功・失敗統計、処理時間とファイルサイズ記録
   * 要件: 3.5, 4.3, 4.4
   */
  logProcessingStatistics(result: WeaponIconProcessingResult): void {
    const { statistics, successful, failed } = result;

    logger.info(LogMessages.WEAPON_ICON_STATISTICS_SUMMARY, {
      total: statistics.total,
      successful: statistics.successful,
      failed: statistics.failed,
      successRate: this.calculatePercentage(
        statistics.successful,
        statistics.total
      ),
      failureRate: this.calculatePercentage(
        statistics.failed,
        statistics.total
      ),
      processingTimeMs: statistics.processingTimeMs,
      processingTimeFormatted: this.formatProcessingTime(
        statistics.processingTimeMs
      ),
      totalSizeBytes: statistics.totalSizeBytes,
      totalSizeFormatted: this.formatFileSize(statistics.totalSizeBytes),
    });

    if (statistics.successful > 0) {
      const avgFileSize = statistics.totalSizeBytes / statistics.successful;
      logger.info("平均ファイルサイズ統計", {
        avgFileSizeBytes: avgFileSize,
        avgFileSizeFormatted: this.formatFileSize(avgFileSize),
      });
    }

    // 成功したダウンロードの詳細
    if (successful.length > 0) {
      logger.info("成功したダウンロード詳細", {
        count: successful.length,
        items: successful.map((iconInfo, index) => ({
          index: index + 1,
          weaponId: iconInfo.weaponId,
          weaponName: iconInfo.weaponName,
          fileSize: iconInfo.fileSize || 0,
          fileSizeFormatted: this.formatFileSize(iconInfo.fileSize || 0),
          localPath: iconInfo.localPath,
          downloadedAt: iconInfo.downloadedAt?.toISOString(),
        })),
      });
    }

    // 失敗したダウンロードの詳細
    if (failed.length > 0) {
      logger.warn("失敗したダウンロード詳細", {
        count: failed.length,
        items: failed.map((failedItem, index) => ({
          index: index + 1,
          weaponId: failedItem.weaponId,
          weaponName: failedItem.weaponName,
          error: failedItem.error,
          iconUrl: failedItem.iconUrl,
        })),
      });
    }

    // パフォーマンス統計
    const throughput = statistics.total / (statistics.processingTimeMs / 1000);
    const avgProcessingTime =
      statistics.successful > 0
        ? statistics.processingTimeMs / statistics.successful
        : 0;

    logger.info(LogMessages.WEAPON_ICON_PERFORMANCE_METRICS, {
      throughputPerSecond: parseFloat(throughput.toFixed(2)),
      avgProcessingTimeMs: parseFloat(avgProcessingTime.toFixed(0)),
      totalProcessingTimeMs: statistics.processingTimeMs,
      totalProcessingTimeFormatted: this.formatProcessingTime(
        statistics.processingTimeMs
      ),
    });
  }

  /**
   * リアルタイム進捗表示機能
   * バッチ処理中の進捗状況をリアルタイムで表示
   * 要件: 3.5
   */
  private logBatchProgress(
    batchNumber: number,
    totalBatches: number,
    batchResults: WeaponIconDownloadResult[],
    overallStats: {
      totalProcessed: number;
      totalSuccessful: number;
      totalFailed: number;
      startTime: number;
    }
  ): void {
    const batchSuccessful = batchResults.filter((r) => r.success).length;
    const batchFailed = batchResults.filter((r) => !r.success).length;
    const progressPercentage = Math.round((batchNumber / totalBatches) * 100);
    const elapsedTime = Date.now() - overallStats.startTime;
    const estimatedRemainingMs = this.calculateEstimatedRemainingTime(
      batchNumber,
      totalBatches,
      elapsedTime
    );

    logger.info(LogMessages.WEAPON_ICON_BATCH_PROGRESS, {
      progress: {
        percentage: progressPercentage,
        completedBatches: batchNumber,
        totalBatches,
      },
      batchResults: {
        successful: batchSuccessful,
        failed: batchFailed,
        total: batchResults.length,
      },
      overallResults: {
        processed: overallStats.totalProcessed,
        successful: overallStats.totalSuccessful,
        failed: overallStats.totalFailed,
        successRate: this.calculatePercentage(
          overallStats.totalSuccessful,
          overallStats.totalProcessed
        ),
      },
      timing: {
        elapsedMs: elapsedTime,
        elapsedFormatted: this.formatProcessingTime(elapsedTime),
        estimatedRemainingMs,
        estimatedRemainingFormatted:
          this.formatProcessingTime(estimatedRemainingMs),
      },
    });
  }

  /**
   * 残り処理時間の推定
   */
  private calculateEstimatedRemainingTime(
    completedBatches: number,
    totalBatches: number,
    elapsedTime: number
  ): number {
    if (completedBatches === 0) return 0;

    const avgTimePerBatch = elapsedTime / completedBatches;
    const remainingBatches = totalBatches - completedBatches;
    return Math.round(avgTimePerBatch * remainingBatches);
  }

  /**
   * パーセンテージ計算
   */
  private calculatePercentage(value: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  }

  /**
   * 処理時間のフォーマット
   */
  private formatProcessingTime(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}秒`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      return `${minutes}分${seconds}秒`;
    }
  }

  /**
   * ファイルサイズのフォーマット
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";

    const units = ["B", "KB", "MB", "GB"];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
  }

  /**
   * レアリティ分布の分析
   */
  private analyzeRarityDistribution(weaponEntries: WeaponEntry[]): {
    S: number;
    A: number;
  } {
    const distribution = { S: 0, A: 0 };

    weaponEntries.forEach((weapon) => {
      const rarityValues = weapon.filter_values?.w_engine_rarity?.values;
      if (rarityValues && Array.isArray(rarityValues)) {
        if (rarityValues.includes("S")) {
          distribution.S++;
        } else if (rarityValues.includes("A")) {
          distribution.A++;
        }
      }
    });

    return distribution;
  }

  /**
   * 詳細な統計情報の収集と記録
   * 処理時間、ファイルサイズ、エラー分析を含む
   * 要件: 4.3, 4.4
   */
  private collectDetailedStatistics(
    results: WeaponIconDownloadResult[],
    processingTimeMs: number
  ): WeaponIconProcessingResult["statistics"] & {
    errorAnalysis: {
      networkErrors: number;
      fileSystemErrors: number;
      validationErrors: number;
      securityErrors: number;
      otherErrors: number;
    };
    performanceMetrics: {
      avgProcessingTimeMs: number;
      avgFileSizeBytes: number;
      throughputPerSecond: number;
    };
  } {
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    // エラー分析
    const errorAnalysis = {
      networkErrors: 0,
      fileSystemErrors: 0,
      validationErrors: 0,
      securityErrors: 0,
      otherErrors: 0,
    };

    failed.forEach((result) => {
      const error = result.error?.toLowerCase() || "";
      if (
        error.includes("network") ||
        error.includes("fetch") ||
        error.includes("http")
      ) {
        errorAnalysis.networkErrors++;
      } else if (
        error.includes("file") ||
        error.includes("directory") ||
        error.includes("permission")
      ) {
        errorAnalysis.fileSystemErrors++;
      } else if (
        error.includes("validation") ||
        error.includes("invalid") ||
        error.includes("検証")
      ) {
        errorAnalysis.validationErrors++;
      } else if (
        error.includes("security") ||
        error.includes("セキュリティ") ||
        error.includes("安全")
      ) {
        errorAnalysis.securityErrors++;
      } else {
        errorAnalysis.otherErrors++;
      }
    });

    // パフォーマンス指標
    const totalSizeBytes = successful.reduce((sum, result) => {
      return sum + (result.iconInfo?.fileSize || 0);
    }, 0);

    const performanceMetrics = {
      avgProcessingTimeMs:
        successful.length > 0 ? processingTimeMs / successful.length : 0,
      avgFileSizeBytes:
        successful.length > 0 ? totalSizeBytes / successful.length : 0,
      throughputPerSecond:
        processingTimeMs > 0 ? (results.length / processingTimeMs) * 1000 : 0,
    };

    return {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      totalSizeBytes,
      processingTimeMs,
      errorAnalysis,
      performanceMetrics,
    };
  }
}
