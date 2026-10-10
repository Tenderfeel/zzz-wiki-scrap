#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import { WeaponListParser } from "./parsers/WeaponListParser";
import { WeaponDataProcessor } from "./processors/WeaponDataProcessor";
import { WeaponGenerator } from "./generators/WeaponGenerator";
import { HoyoLabApiClient } from "./clients/HoyoLabApiClient";
import { WeaponDataMapper } from "./mappers/WeaponDataMapper";
import { EnhancedProgressTracker } from "./utils/EnhancedProgressTracker";
import { logger } from "./utils/Logger";
import { ConfigManager } from "./config/ProcessingConfig";
import {
  WeaponEntry,
  ProcessedWeaponData,
  Weapon,
  EnhancedWeapon,
} from "./types";
import { WeaponProcessingConfig } from "./types/processing";
import { ParsingError, ValidationError } from "./errors";

/**
 * 音動機処理統計情報
 */
interface WeaponProcessingStatistics {
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
 * 音動機処理結果
 */
interface WeaponProcessingResult {
  weapons: Weapon[];
  statistics: WeaponProcessingStatistics;
  failedWeapons: Array<{
    weaponId: string;
    weaponName: string;
    error: string;
    stage: string;
  }>;
  outputPath: string;
  success: boolean;
}

/**
 * 音動機データ処理パイプライン
 * WeaponListParser、WeaponDataProcessor、WeaponGenerator を統合
 * バッチ処理と API レート制限対応を実装
 * 要件: 1.5, 4.1
 */
class WeaponDataPipeline {
  private weaponListParser: WeaponListParser;
  private weaponDataProcessor: WeaponDataProcessor;
  private weaponGenerator: WeaponGenerator;
  public progressTracker?: EnhancedProgressTracker;
  private config: WeaponProcessingConfig;

  constructor(config?: WeaponProcessingConfig) {
    this.weaponListParser = new WeaponListParser();

    // 依存関係を注入
    const apiClient = new HoyoLabApiClient();
    const weaponDataMapper = new WeaponDataMapper();
    this.weaponDataProcessor = new WeaponDataProcessor(
      apiClient,
      weaponDataMapper
    );

    this.weaponGenerator = new WeaponGenerator();

    // 設定を取得
    const configManager = ConfigManager.getInstance();
    this.config = config || configManager.getWeaponProcessingConfig();
  }

  /**
   * 音動機データ処理パイプラインを実行
   * 要件: 1.5, 4.1
   */
  async execute(): Promise<WeaponProcessingResult> {
    const startTime = Date.now();

    logger.info("音動機データ処理パイプラインを開始", {
      config: this.config,
      timestamp: new Date().toISOString(),
    });

    let weaponEntries: WeaponEntry[] = [];
    let processedWeapons: ProcessedWeaponData[] = [];
    let weapons: Weapon[] = [];
    const failedWeapons: WeaponProcessingResult["failedWeapons"] = [];
    let statistics: WeaponProcessingStatistics = {
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
      // ステップ1: 音動機リストの解析
      logger.info("ステップ1: 音動機リスト解析を開始");
      weaponEntries = await this.parseWeaponList();
      statistics.total = weaponEntries.length;

      if (weaponEntries.length === 0) {
        throw new ParsingError("処理対象の音動機が見つかりませんでした");
      }

      // ステップ2: 進捗監視の初期化
      this.initializeProgressTracker(weaponEntries.length);

      // ステップ3: バッチ処理でAPIデータを取得・処理
      logger.info("ステップ2: 音動機データのバッチ処理を開始", {
        totalWeapons: weaponEntries.length,
        batchSize: this.config.batchSize,
      });

      const batchResults = await this.processBatches(weaponEntries);
      processedWeapons = batchResults.successful;
      failedWeapons.push(...batchResults.failed);
      statistics.successful = processedWeapons.length;
      statistics.failed = failedWeapons.length;
      statistics.retries = batchResults.retries;

      // ステップ4: Weaponオブジェクトの生成
      logger.info("ステップ3: Weaponオブジェクト生成を開始", {
        processedWeapons: processedWeapons.length,
      });

      weapons = await this.generateWeapons(processedWeapons);

      // ステップ5: ファイル出力
      logger.info("ステップ4: ファイル出力を開始", {
        weapons: weapons.length,
        outputPath: this.config.outputPath,
      });

      await this.outputWeaponFile(weapons);

      // 統計情報の計算
      const endTime = Date.now();
      statistics.processingTime = endTime - startTime;
      statistics.averageItemTime =
        statistics.total > 0 ? statistics.processingTime / statistics.total : 0;
      statistics.successRate =
        statistics.total > 0
          ? (statistics.successful / statistics.total) * 100
          : 0;

      const result: WeaponProcessingResult = {
        weapons,
        statistics,
        failedWeapons,
        outputPath: this.config.outputPath,
        success: true,
      };

      logger.info("音動機データ処理パイプライン完了", {
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

      logger.error("音動機データ処理パイプラインでエラーが発生", {
        error: error instanceof Error ? error.message : String(error),
        statistics,
        processingTime: `${statistics.processingTime}ms`,
      });

      const result: WeaponProcessingResult = {
        weapons,
        statistics,
        failedWeapons,
        outputPath: this.config.outputPath,
        success: false,
      };

      // 部分的な結果があれば保存を試行
      if (weapons.length > 0) {
        await this.savePartialResults(weapons, error);
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
   * 音動機リストを解析
   * 要件: 1.1, 1.2, 2.2
   */
  private async parseWeaponList(): Promise<WeaponEntry[]> {
    try {
      const weaponEntries = await this.weaponListParser.parseWeaponList(
        this.config.weaponListPath
      );

      // レア度フィルタリング
      const filteredEntries = weaponEntries.filter((entry) =>
        this.config.includeRarities.includes(entry.rarity)
      );

      logger.info("音動機リスト解析完了", {
        totalEntries: weaponEntries.length,
        filteredEntries: filteredEntries.length,
        includeRarities: this.config.includeRarities,
      });

      // 統計情報を表示
      this.weaponListParser.displayStatistics(filteredEntries);

      return filteredEntries;
    } catch (error) {
      logger.error("音動機リスト解析に失敗", {
        weaponListPath: this.config.weaponListPath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ParsingError(
        `音動機リストの解析に失敗しました: ${
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
   * 要件: 4.1
   */
  private initializeProgressTracker(totalWeapons: number): void {
    this.progressTracker = new EnhancedProgressTracker(totalWeapons, {
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
      logger.debug("音動機処理進捗更新", {
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
      totalWeapons,
      progressTrackerEnabled: true,
      memoryMonitoring: true,
      performanceMonitoring: true,
      realTimeDisplay: true,
    });
  }

  /**
   * バッチ処理でAPIデータを取得・処理
   * 要件: 1.5, 4.1
   */
  private async processBatches(weaponEntries: WeaponEntry[]): Promise<{
    successful: ProcessedWeaponData[];
    failed: WeaponProcessingResult["failedWeapons"];
    retries: number;
  }> {
    const successful: ProcessedWeaponData[] = [];
    const failed: WeaponProcessingResult["failedWeapons"] = [];
    let retries = 0;

    // バッチに分割
    const batches = this.createBatches(weaponEntries, this.config.batchSize);

    logger.info("バッチ処理を開始", {
      totalBatches: batches.length,
      batchSize: this.config.batchSize,
      totalWeapons: weaponEntries.length,
    });

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      logger.debug(`バッチ ${batchIndex + 1}/${batches.length} を処理中`, {
        batchSize: batch.length,
        weaponIds: batch.map((w) => w.id),
      });

      // バッチ内の各音動機を処理
      for (const weaponEntry of batch) {
        let currentRetries = 0;
        let processed = false;

        while (currentRetries <= this.config.maxRetries && !processed) {
          try {
            // 進捗更新
            if (this.progressTracker) {
              this.progressTracker.update(
                successful.length + failed.length,
                weaponEntry.name,
                `バッチ ${batchIndex + 1}/${batches.length}`,
                undefined,
                currentRetries > 0
              );
            }

            // 音動機データを処理
            const processedData =
              await this.weaponDataProcessor.processWeaponData(weaponEntry);
            successful.push(processedData);
            processed = true;

            // 進捗更新（成功）
            if (this.progressTracker) {
              this.progressTracker.update(
                successful.length + failed.length,
                weaponEntry.name,
                "処理完了",
                true
              );
            }

            logger.debug("音動機処理成功", {
              weaponId: weaponEntry.id,
              weaponName: weaponEntry.name,
              retries: currentRetries,
            });
          } catch (error) {
            currentRetries++;
            retries++;

            const errorMessage =
              error instanceof Error ? error.message : String(error);

            logger.warn("音動機処理でエラーが発生", {
              weaponId: weaponEntry.id,
              weaponName: weaponEntry.name,
              attempt: currentRetries,
              maxRetries: this.config.maxRetries,
              error: errorMessage,
            });

            if (currentRetries > this.config.maxRetries) {
              // 最大リトライ回数に達した場合は失敗として記録
              failed.push({
                weaponId: weaponEntry.id,
                weaponName: weaponEntry.name,
                error: errorMessage,
                stage: "data_processing",
              });

              // 進捗更新（失敗）
              if (this.progressTracker) {
                this.progressTracker.update(
                  successful.length + failed.length,
                  weaponEntry.name,
                  "処理失敗",
                  false
                );
              }

              logger.error("音動機処理が最終的に失敗", {
                weaponId: weaponEntry.id,
                weaponName: weaponEntry.name,
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
        (successful.length / weaponEntries.length) * 100
      )}%`,
    });

    return { successful, failed, retries };
  }

  /**
   * Weaponオブジェクトを生成（属性抽出統合版）
   * 要件: 3.1, 3.2
   */
  private async generateWeapons(
    processedWeapons: ProcessedWeaponData[]
  ): Promise<Weapon[]> {
    const weapons: Weapon[] = [];

    logger.info("Weaponオブジェクト生成を開始（属性抽出統合版）", {
      processedWeapons: processedWeapons.length,
    });

    for (const processedData of processedWeapons) {
      try {
        // 日本語データのみを使用（英語データは現在未実装）
        const weapon = this.weaponGenerator.generateWeapon(
          processedData,
          null, // 英語データは未実装
          processedData.basicInfo.id
        );

        // 生成されたWeaponオブジェクトを検証
        const validationResult = this.weaponGenerator.validateWeapon(weapon);
        if (!validationResult.isValid) {
          logger.warn("Weaponオブジェクト検証に失敗", {
            weaponId: weapon.id,
            errors: validationResult.errors,
          });
          continue; // 無効なWeaponはスキップ
        }

        weapons.push(weapon);

        logger.debug("Weaponオブジェクト生成成功", {
          weaponId: weapon.id,
          weaponName: weapon.name.ja,
          stats: weapon.stats,
          hasSkillDesc: weapon.equipmentSkillDesc.ja.length > 0,
        });
      } catch (error) {
        logger.error("Weaponオブジェクト生成に失敗", {
          weaponId: processedData.basicInfo.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info("Weaponオブジェクト生成完了（属性抽出統合版）", {
      processedWeapons: processedWeapons.length,
      generatedWeapons: weapons.length,
      successRate: `${Math.round(
        (weapons.length / processedWeapons.length) * 100
      )}%`,
    });

    return weapons;
  }

  /**
   * 拡張Weaponオブジェクトを生成（属性抽出統合版）
   * 要件: 2.1, 2.2
   */
  private async generateEnhancedWeapons(
    processedWeapons: ProcessedWeaponData[]
  ): Promise<EnhancedWeapon[]> {
    const enhancedWeapons: EnhancedWeapon[] = [];

    logger.info("拡張Weaponオブジェクト生成を開始", {
      processedWeapons: processedWeapons.length,
    });

    for (const processedData of processedWeapons) {
      try {
        // 日本語データのみを使用（英語データは現在未実装）
        const enhancedWeapon = this.weaponGenerator.generateEnhancedWeapon(
          processedData,
          null, // 英語データは未実装
          processedData.basicInfo.id
        );

        // 生成された拡張Weaponオブジェクトを検証
        const validationResult =
          this.weaponGenerator.validateEnhancedWeapon(enhancedWeapon);
        if (!validationResult.isValid) {
          logger.warn("拡張Weaponオブジェクト検証に失敗", {
            weaponId: enhancedWeapon.id,
            errors: validationResult.errors,
          });
          continue; // 無効な拡張Weaponはスキップ
        }

        enhancedWeapons.push(enhancedWeapon);

        logger.debug("拡張Weaponオブジェクト生成成功", {
          weaponId: enhancedWeapon.id,
          weaponName: enhancedWeapon.name.ja,
          stats: enhancedWeapon.stats,
          extractedAttributes: enhancedWeapon.extractedAttributes,
          hasSkillDesc: enhancedWeapon.equipmentSkillDesc.ja.length > 0,
        });
      } catch (error) {
        logger.error("拡張Weaponオブジェクト生成に失敗", {
          weaponId: processedData.basicInfo.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info("拡張Weaponオブジェクト生成完了", {
      processedWeapons: processedWeapons.length,
      generatedEnhancedWeapons: enhancedWeapons.length,
      successRate: `${Math.round(
        (enhancedWeapons.length / processedWeapons.length) * 100
      )}%`,
    });

    return enhancedWeapons;
  }

  /**
   * 音動機ファイルを出力
   * 要件: 3.1, 3.2
   */
  private async outputWeaponFile(weapons: Weapon[]): Promise<void> {
    try {
      // 出力ディレクトリを確保
      const outputDir = path.dirname(this.config.outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        logger.info("出力ディレクトリを作成", { outputDir });
      }

      // ファイル出力
      this.weaponGenerator.outputWeaponFile(weapons, this.config.outputPath);

      // 出力ファイルの検証
      if (!fs.existsSync(this.config.outputPath)) {
        throw new ValidationError("出力ファイルが生成されませんでした");
      }

      const stats = fs.statSync(this.config.outputPath);
      if (stats.size === 0) {
        throw new ValidationError("出力ファイルが空です");
      }

      logger.info("音動機ファイル出力完了", {
        outputPath: this.config.outputPath,
        weaponCount: weapons.length,
        fileSize: stats.size,
      });
    } catch (error) {
      logger.error("音動機ファイル出力に失敗", {
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
    weapons: Weapon[],
    error: unknown
  ): Promise<void> {
    try {
      const partialOutputPath = this.config.outputPath.replace(
        ".ts",
        "-partial.ts"
      );

      logger.info("部分的な結果を保存中", {
        partialOutputPath,
        weaponCount: weapons.length,
        originalError: error instanceof Error ? error.message : String(error),
      });

      this.weaponGenerator.outputWeaponFile(weapons, partialOutputPath);

      logger.info("部分的な結果を保存完了", {
        partialOutputPath,
        weaponCount: weapons.length,
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
   * 処理統計レポートを生成
   * 成功・失敗の統計情報を含むレポートを生成
   * 詳細なエラー情報と部分的に取得できたデータを記録
   * 処理結果の要約とパフォーマンス指標を出力
   * 要件: 4.2, 4.3
   */
  generateProcessingReport(result: WeaponProcessingResult): string {
    const { statistics, failedWeapons, weapons } = result;

    let report = `# 音動機データ処理レポート\n\n`;
    report += `生成日時: ${new Date().toLocaleString()}\n`;
    report += `出力ファイル: ${result.outputPath}\n`;
    report += `処理成功: ${result.success ? "✅ 成功" : "❌ 失敗"}\n\n`;

    // 実行概要
    report += `## 実行概要\n`;
    report += `- 設定ファイル: ${this.config.weaponListPath}\n`;
    report += `- 処理対象レア度: ${this.config.includeRarities.join(", ")}\n`;
    report += `- バッチサイズ: ${this.config.batchSize}\n`;
    report += `- API遅延時間: ${this.config.delayMs}ms\n`;
    report += `- 最大リトライ回数: ${this.config.maxRetries}\n`;
    report += `- データ検証: ${
      this.config.enableValidation ? "有効" : "無効"
    }\n\n`;

    // 処理統計
    report += `## 処理統計\n`;
    report += `- 総音動機数: ${statistics.total}\n`;
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
    )}ms/音動機\n\n`;

    // パフォーマンス指標
    const itemsPerSecond =
      statistics.processingTime > 0
        ? (statistics.total * 1000) / statistics.processingTime
        : 0;

    report += `## パフォーマンス指標\n`;
    report += `- 処理速度: ${itemsPerSecond.toFixed(2)} 音動機/秒\n`;
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
      )} 音動機/秒\n`;

      if (progressInfo.memoryUsage) {
        report += `- 最大メモリ使用量: ${Math.round(
          progressInfo.memoryUsage.heapUsed / 1024 / 1024
        )}MB\n`;
      }
    }
    report += `\n`;

    // エラー分析
    if (failedWeapons.length > 0) {
      report += `## エラー分析\n`;

      // エラーを段階別に分類
      const errorsByStage = failedWeapons.reduce((acc, failed) => {
        acc[failed.stage] = (acc[failed.stage] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      report += `### エラー段階別統計\n`;
      Object.entries(errorsByStage).forEach(([stage, count]) => {
        report += `- ${stage}: ${count}件\n`;
      });
      report += `\n`;

      // エラーメッセージの分析
      const errorMessages = failedWeapons.map((f) => f.error);
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

      // 失敗した音動機の詳細
      report += `### 失敗した音動機詳細\n`;
      failedWeapons.forEach((failed, index) => {
        report += `${index + 1}. **${failed.weaponName}** (ID: ${
          failed.weaponId
        })\n`;
        report += `   - エラー: ${failed.error}\n`;
        report += `   - 処理段階: ${failed.stage}\n\n`;
      });
    }

    // 成功した音動機の分析
    if (weapons.length > 0) {
      report += `## 成功した音動機分析\n`;

      // レア度別統計
      const rarityStats = weapons.reduce((acc, weapon) => {
        acc[weapon.rarity] = (acc[weapon.rarity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      report += `### レア度別統計\n`;
      Object.entries(rarityStats).forEach(([rarity, count]) => {
        report += `- ${rarity}級: ${count}件\n`;
      });
      report += `\n`;

      // 特性別統計
      const specialtyStats = weapons.reduce((acc, weapon) => {
        acc[weapon.specialty] = (acc[weapon.specialty] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      report += `### 特性別統計\n`;
      Object.entries(specialtyStats).forEach(([specialty, count]) => {
        report += `- ${specialty}: ${count}件\n`;
      });
      report += `\n`;

      // エージェント関連統計
      const weaponsWithAgent = weapons.filter(
        (w) => w.agentId && w.agentId.trim() !== ""
      );
      report += `### エージェント関連統計\n`;
      report += `- エージェント情報あり: ${weaponsWithAgent.length}件\n`;
      report += `- エージェント情報なし: ${
        weapons.length - weaponsWithAgent.length
      }件\n\n`;

      // 生成された音動機一覧（最初の20件）
      report += `### 生成された音動機一覧\n`;
      weapons.slice(0, 20).forEach((weapon, index) => {
        report += `${index + 1}. **${weapon.name.ja}** (ID: ${weapon.id})\n`;
        report += `   - レア度: ${weapon.rarity}\n`;
        report += `   - 特性: ${weapon.specialty}\n`;
        report += `   - 属性: ${weapon.stats.join(", ")}\n`;
        report += `   - エージェントID: ${weapon.agentId || "なし"}\n`;
        report += `   - スキル: ${weapon.equipmentSkillName.ja || "なし"}\n\n`;
      });

      if (weapons.length > 20) {
        report += `... その他 ${weapons.length - 20} 件の音動機\n\n`;
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

    if (failedWeapons.length > 0) {
      const commonErrors = failedWeapons.map((f) => f.error);
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
    report += `レポート生成: 音動機データ処理パイプライン v1.0\n`;

    return report;
  }

  /**
   * エラーレポートを生成
   * 要件: 4.2, 4.3
   */
  generateErrorReport(
    error: unknown,
    context: {
      weaponEntries?: WeaponEntry[];
      processedWeapons?: ProcessedWeaponData[];
      weapons?: Weapon[];
      statistics?: Partial<WeaponProcessingStatistics>;
    }
  ): string {
    let report = `# 音動機データ処理エラーレポート\n\n`;
    report += `生成日時: ${new Date().toLocaleString()}\n`;
    report += `エラー発生時刻: ${new Date().toISOString()}\n\n`;

    // エラー詳細
    report += `## エラー詳細\n`;
    if (error instanceof Error) {
      report += `- エラータイプ: ${error.constructor.name}\n`;
      report += `- エラーメッセージ: ${error.message}\n`;
      if (error.stack) {
        report += `- スタックトレース:\n\`\`\`\n${error.stack}\n\`\`\`\n`;
      }
    } else {
      report += `- エラー内容: ${String(error)}\n`;
    }
    report += `\n`;

    // 実行コンテキスト
    report += `## 実行コンテキスト\n`;
    report += `- 設定ファイル: ${this.config.weaponListPath}\n`;
    report += `- 出力パス: ${this.config.outputPath}\n`;
    report += `- バッチサイズ: ${this.config.batchSize}\n`;
    report += `- 遅延時間: ${this.config.delayMs}ms\n`;
    report += `- 最大リトライ回数: ${this.config.maxRetries}\n\n`;

    // 処理状況
    report += `## 処理状況\n`;
    if (context.weaponEntries) {
      report += `- 解析された音動機数: ${context.weaponEntries.length}\n`;
    }
    if (context.processedWeapons) {
      report += `- 処理された音動機数: ${context.processedWeapons.length}\n`;
    }
    if (context.weapons) {
      report += `- 生成された音動機数: ${context.weapons.length}\n`;
    }
    if (context.statistics) {
      report += `- 成功: ${context.statistics.successful || 0}\n`;
      report += `- 失敗: ${context.statistics.failed || 0}\n`;
      report += `- リトライ: ${context.statistics.retries || 0}\n`;
    }
    report += `\n`;

    // システム情報
    report += `## システム情報\n`;
    report += `- Node.js バージョン: ${process.version}\n`;
    report += `- プラットフォーム: ${process.platform}\n`;
    report += `- アーキテクチャ: ${process.arch}\n`;

    const memUsage = process.memoryUsage();
    report += `- メモリ使用量: ヒープ ${Math.round(
      memUsage.heapUsed / 1024 / 1024
    )}MB / 総計 ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB\n`;
    report += `\n`;

    // 復旧手順
    report += `## 復旧手順\n`;
    report += `1. エラーメッセージを確認し、根本原因を特定してください\n`;
    report += `2. 設定ファイルの内容を確認してください\n`;
    report += `3. ネットワーク接続とAPI制限を確認してください\n`;
    report += `4. 必要に応じてバッチサイズや遅延時間を調整してください\n`;
    report += `5. 部分的な結果ファイルが生成されている場合は、そちらを確認してください\n\n`;

    return report;
  }

  /**
   * 進捗監視の詳細サマリーを表示
   * 要件: 4.1
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
        `平均処理時間: ${Math.round(progressInfo.averageItemTime)}ms/音動機`
      );
      console.log(
        `処理速度: ${progressInfo.itemsPerSecond.toFixed(2)} 音動機/秒`
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

    // 進捗統計をログに記録
    logger.info("進捗監視完了", {
      totalProcessingTime: progressInfo.elapsedTime,
      averageItemTime: progressInfo.averageItemTime,
      itemsPerSecond: progressInfo.itemsPerSecond,
      successCount: progressInfo.successCount,
      failureCount: progressInfo.failureCount,
      retryCount: progressInfo.retryCount,
      memoryUsage: progressInfo.memoryUsage,
    });
  }

  /**
   * リアルタイム進捗監視の状態をチェック
   * 要件: 4.1
   */
  private checkProgressHealth(): void {
    if (!this.progressTracker) {
      return;
    }

    const progressInfo = this.progressTracker.getProgressInfo();

    // パフォーマンス警告のチェック
    const warnings: string[] = [];

    // 処理速度の警告
    if (progressInfo.itemsPerSecond < 0.05 && progressInfo.current > 3) {
      warnings.push("処理速度が非常に遅くなっています");
    }

    // メモリ使用量の警告
    if (progressInfo.memoryUsage) {
      const memoryUsageMB = progressInfo.memoryUsage.heapUsed / 1024 / 1024;
      if (memoryUsageMB > 1000) {
        // 1GB
        warnings.push("メモリ使用量が1GBを超えています");
      }
    }

    // 失敗率の警告
    const failureRate =
      progressInfo.current > 0
        ? (progressInfo.failureCount / progressInfo.current) * 100
        : 0;
    if (failureRate > 20) {
      warnings.push(`失敗率が${Math.round(failureRate)}%と高くなっています`);
    }

    // 警告がある場合はログに記録
    if (warnings.length > 0) {
      logger.warn("進捗監視で問題を検出", {
        warnings,
        currentProgress: progressInfo.current,
        totalProgress: progressInfo.total,
        itemsPerSecond: progressInfo.itemsPerSecond,
        memoryUsageMB: progressInfo.memoryUsage
          ? Math.round(progressInfo.memoryUsage.heapUsed / 1024 / 1024)
          : undefined,
        failureRate: Math.round(failureRate),
      });
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

/**
 * メイン実行関数
 * 音動機データ処理の全体的なオーケストレーション機能を実装
 * 進捗監視とレポート生成機能を実装
 * 要件: 4.1, 4.2, 4.3, 4.4
 */
async function main(configPath?: string): Promise<void> {
  const startTime = new Date();

  try {
    console.log("🚀 === 音動機データ生成開始 ===");
    console.log(`開始時刻: ${startTime.toLocaleString()}`);
    console.log("================================\n");

    // 設定を読み込み
    // 明示的に指定された設定ファイルがない場合は、デフォルト設定にフォールバックせず中断する
    if (configPath && !fs.existsSync(configPath)) {
      throw new Error(`設定ファイルが見つかりません: ${configPath}`);
    }
    const configManager = ConfigManager.getInstance(configPath);
    const config = configManager.getWeaponProcessingConfig();

    // 設定概要を表示
    console.log("⚙️  音動機処理設定:");
    console.log(`  - 音動機リスト: ${config.weaponListPath}`);
    console.log(`  - 出力ファイル: ${config.outputPath}`);
    console.log(`  - 処理対象レア度: ${config.includeRarities.join(", ")}`);
    console.log(`  - バッチサイズ: ${config.batchSize}`);
    console.log(`  - 遅延時間: ${config.delayMs}ms`);
    console.log(`  - 最大リトライ回数: ${config.maxRetries}`);
    console.log(`  - データ検証: ${config.enableValidation ? "有効" : "無効"}`);
    console.log(`  - ログレベル: ${config.logLevel}\n`);

    // パイプラインを実行
    const pipeline = new WeaponDataPipeline(config);
    const result = await pipeline.execute();

    const endTime = new Date();
    const processingTime = endTime.getTime() - startTime.getTime();

    // 最終結果を表示
    console.log("\n🎉 === 音動機データ生成完了 ===");
    console.log(`終了時刻: ${endTime.toLocaleString()}`);
    console.log(`総処理時間: ${formatDuration(processingTime)}`);
    console.log(`成功: ${result.statistics.successful}`);
    console.log(`失敗: ${result.statistics.failed}`);
    console.log(`成功率: ${Math.round(result.statistics.successRate)}%`);
    console.log(`出力ファイル: ${result.outputPath}`);
    console.log("================================\n");

    // 処理レポートを生成
    const reportPath = "weapon-processing-report.md";
    const report = pipeline.generateProcessingReport(result);
    fs.writeFileSync(reportPath, report, "utf-8");
    console.log(`📄 処理レポートを生成: ${reportPath}`);

    // 進捗統計レポートも生成
    if (pipeline.progressTracker) {
      const progressReportPath = "weapon-progress-report.md";
      const progressReport =
        pipeline.progressTracker.generateStatisticsReport();
      fs.writeFileSync(progressReportPath, progressReport, "utf-8");
      console.log(`📊 進捗統計レポートを生成: ${progressReportPath}`);
    }

    // 失敗がある場合は警告を表示
    if (result.failedWeapons.length > 0) {
      console.warn(
        `\n⚠️  ${result.failedWeapons.length}個の音動機の処理に失敗しました。`
      );
      console.log("\n失敗した音動機:");
      result.failedWeapons.forEach((failed, index) => {
        console.log(
          `  ${index + 1}. ${failed.weaponName} (ID: ${failed.weaponId}): ${
            failed.error
          }`
        );
      });
    }

    // 成功時の終了コード
    process.exit(0);
  } catch (error) {
    const endTime = new Date();
    const processingTime = endTime.getTime() - startTime.getTime();

    console.error("\n❌ === 音動機データ生成失敗 ===");
    console.error(`終了時刻: ${endTime.toLocaleString()}`);
    console.error(`処理時間: ${formatDuration(processingTime)}`);
    console.error(
      `エラー: ${error instanceof Error ? error.message : String(error)}`
    );
    console.error("================================\n");

    logger.error("音動機データ生成中に致命的なエラーが発生", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // エラーレポートを生成
    try {
      const configManager = ConfigManager.getInstance();
      const weaponConfig = configManager.getWeaponProcessingConfig();
      const pipeline = new WeaponDataPipeline(weaponConfig);
      const errorReportPath = "weapon-error-report.md";
      const errorReport = pipeline.generateErrorReport(error, {
        statistics: {
          total: 0,
          successful: 0,
          failed: 0,
          skipped: 0,
          retries: 0,
          processingTime,
          averageItemTime: 0,
          successRate: 0,
        },
      });
      fs.writeFileSync(errorReportPath, errorReport, "utf-8");
      console.error(`📄 エラーレポートを生成: ${errorReportPath}`);
    } catch (reportError) {
      console.error(
        `❌ エラーレポートの生成に失敗: ${
          reportError instanceof Error
            ? reportError.message
            : String(reportError)
        }`
      );
    }

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
音動機データ生成スクリプト

使用方法:
  npm run generate:weapons [オプション]
  node dist/main-weapon-generation.js [オプション]

オプション:
  --config, -c <path>   設定ファイルのパス (デフォルト: processing-config.json)
  --help, -h           このヘルプメッセージを表示

設定ファイル例:
{
  "weaponProcessing": {
    "weaponListPath": "json/data/weapon-list.json",
    "outputPath": "data/weapons.ts",
    "includeRarities": ["A", "S"],
    "batchSize": 10,
    "delayMs": 1000,
    "maxRetries": 3,
    "skipAgentValidation": false,
    "enableSkillExtraction": true,
    "enableValidation": true,
    "logLevel": "info"
  }
}

例:
  npm run generate:weapons
  npm run generate:weapons -- --config custom-config.json
  npm run generate:weapons -- --help
`);
}

// スクリプトが直接実行された場合のみメイン関数を実行
if (require.main === module) {
  const args = parseCommandLineArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  main(args.configPath).catch((error) => {
    console.error("予期しないエラーが発生しました:", error);
    process.exit(1);
  });
}

export { WeaponDataPipeline, main };
export type { WeaponProcessingResult, WeaponProcessingStatistics };
