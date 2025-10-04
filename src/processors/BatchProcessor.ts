import { CharacterEntry, Character } from "../types";
import {
  BilingualApiData,
  ApiDataResult,
  BatchProcessingOptions,
  ProcessingStatistics,
} from "../types/processing";
import { EnhancedApiClient } from "../clients/EnhancedApiClient";
import { EnhancedDataProcessor } from "./EnhancedDataProcessor";
import {
  BatchProcessingError,
  AllCharactersError,
  ProcessingStage,
} from "../errors";
import { MemoryOptimizer } from "../utils/MemoryOptimizer";
import { WorkerPool } from "../utils/WorkerPool";
import { EnhancedProgressTracker } from "../utils/EnhancedProgressTracker";

/**
 * バッチ処理結果
 */
export interface ProcessingResult {
  successful: CharacterResult[];
  failed: FailedCharacter[];
  statistics: ProcessingStatistics;
}

/**
 * 成功したキャラクターの処理結果
 */
export interface CharacterResult {
  entry: CharacterEntry;
  jaData: import("../types/api").ApiResponse;
  enData: import("../types/api").ApiResponse;
  character: Character;
}

/**
 * 失敗したキャラクターの情報
 */
export interface FailedCharacter {
  entry: CharacterEntry;
  error: string;
  stage: ProcessingStage;
  timestamp: Date;
}

/**
 * プログレス情報
 */
export interface ProgressInfo {
  current: number;
  total: number;
  percentage: number;
  currentCharacter: string;
  stage: string;
  elapsedTime: number;
  estimatedTimeRemaining?: number;
}

/**
 * 最適化されたバッチプロセッサー
 * 複数キャラクターの並行処理とプログレス管理を担当
 * メモリ最適化と効率的な並行処理を実装
 */
export class BatchProcessor {
  private readonly apiClient: EnhancedApiClient;
  private readonly dataProcessor: EnhancedDataProcessor;
  private readonly defaultOptions: Required<BatchProcessingOptions> = {
    batchSize: 5,
    delayMs: 200,
    maxRetries: 3,
  };

  // 最適化コンポーネント
  private readonly memoryOptimizer: MemoryOptimizer;
  private progressTracker?: EnhancedProgressTracker;
  private workerPool?: WorkerPool<CharacterEntry, CharacterResult>;

  // プログレス管理（後方互換性のため保持）
  private progressCallback?: (progress: ProgressInfo) => void;
  private startTime: Date = new Date();
  private processedCount: number = 0;

  constructor(
    apiClient?: EnhancedApiClient,
    dataProcessor?: EnhancedDataProcessor
  ) {
    this.apiClient = apiClient || new EnhancedApiClient();
    this.dataProcessor = dataProcessor || new EnhancedDataProcessor();
    this.memoryOptimizer = new MemoryOptimizer();
  }

  /**
   * プログレスコールバックを設定する
   * @param callback プログレス更新時に呼び出されるコールバック
   */
  setProgressCallback(callback: (progress: ProgressInfo) => void): void {
    this.progressCallback = callback;
  }

  /**
   * 全キャラクターを処理する（最適化版）
   * @param entries キャラクターエントリーの配列
   * @param options バッチ処理オプション
   * @returns Promise<ProcessingResult> 処理結果
   */
  async processAllCharacters(
    entries: CharacterEntry[],
    options: BatchProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const opts = { ...this.defaultOptions, ...options };
    this.startTime = new Date();
    this.processedCount = 0;

    console.log(`\n=== 最適化バッチ処理開始 ===`);
    console.log(`対象キャラクター数: ${entries.length}`);
    console.log(`バッチサイズ: ${opts.batchSize}`);
    console.log(`処理開始時刻: ${this.startTime.toLocaleString()}`);
    console.log(`メモリ最適化: 有効`);
    console.log(`並行処理: 有効`);
    console.log(`===============================\n`);

    // 拡張プログレストラッカーを初期化
    this.progressTracker = new EnhancedProgressTracker(entries.length, {
      showMemoryUsage: true,
      showPerformanceMetrics: true,
      showDetailedTiming: true,
      updateInterval: 1000,
      barWidth: 40,
      useColors: true,
    });

    const successful: CharacterResult[] = [];
    const failed: FailedCharacter[] = [];

    try {
      // 最適化された処理を実行
      const result = await this.processWithOptimization(entries, opts);

      const endTime = new Date();
      const statistics = this.generateStatistics(
        result.successful,
        result.failed,
        this.startTime,
        endTime
      );

      // 最終統計表示
      this.displayFinalStatistics(statistics, result.successful, result.failed);

      // メモリ統計表示
      this.displayMemoryStatistics();

      return {
        successful: result.successful,
        failed: result.failed,
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

      throw new AllCharactersError(
        ProcessingStage.BATCH_PROCESSING,
        null,
        `最適化バッチ処理中にエラーが発生しました: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error : undefined
      );
    } finally {
      // クリーンアップ
      this.cleanup();
    }
  }

  /**
   * 最適化された処理を実行
   * @param entries キャラクターエントリーの配列
   * @param options バッチ処理オプション
   * @returns Promise<{successful: CharacterResult[], failed: FailedCharacter[]}>
   */
  private async processWithOptimization(
    entries: CharacterEntry[],
    options: Required<BatchProcessingOptions>
  ): Promise<{ successful: CharacterResult[]; failed: FailedCharacter[] }> {
    // ワーカープールを初期化
    this.workerPool = new WorkerPool<CharacterEntry, CharacterResult>(
      async (entry: CharacterEntry) => {
        return await this.processSingleCharacter(entry, options);
      },
      options.batchSize,
      options.delayMs
    );

    // 定期的な統計更新とメモリ監視
    const statsInterval = setInterval(() => {
      if (this.workerPool && this.progressTracker) {
        const stats = this.workerPool.getStatistics();
        this.progressTracker.update(
          stats.completedTasks + stats.failedTasks,
          "", // 現在のアイテムはワーカープール内で管理
          "並行処理中",
          undefined,
          false
        );
      }

      // メモリ監視
      this.memoryOptimizer.monitorAndOptimize();
    }, 1000);

    // 全タスクをワーカープールに追加
    console.log(`🚀 ワーカープールにタスクを追加中...`);
    entries.forEach((entry, index) => {
      const priority = entries.length - index; // 後のキャラクターほど優先度を下げる
      this.workerPool!.addTask(entry, priority, options.maxRetries);
    });

    // 処理開始と完了待機
    console.log(`⚡ 並行処理開始...`);
    try {
      await this.workerPool.start();
      await this.workerPool.waitForCompletion();
    } finally {
      clearInterval(statsInterval);
    }

    // 結果を取得
    const results = this.workerPool.getResults();
    const failedTasks = this.workerPool.getFailedTasks();

    const successful = results;
    const failed: FailedCharacter[] = failedTasks.map((task) => ({
      entry: task.data,
      error: task.error.message,
      stage: ProcessingStage.DATA_PROCESSING,
      timestamp: new Date(),
    }));

    // ワーカープール統計を表示
    console.log(`\n📊 ワーカープール統計:`);
    console.log(this.workerPool.generateStatisticsReport());

    return { successful, failed };
  }

  /**
   * 単一キャラクターを処理
   * @param entry キャラクターエントリー
   * @param options バッチ処理オプション
   * @returns Promise<CharacterResult>
   */
  private async processSingleCharacter(
    entry: CharacterEntry,
    options: Required<BatchProcessingOptions>
  ): Promise<CharacterResult> {
    // プログレス更新
    if (this.progressTracker) {
      this.progressTracker.update(this.processedCount, entry.id, "API取得中");
    }

    // API データ取得
    const bilingualData = await this.apiClient.fetchBothLanguages(entry.pageId);

    // プログレス更新
    if (this.progressTracker) {
      this.progressTracker.update(
        this.processedCount,
        entry.id,
        "データ処理中"
      );
    }

    // データ処理
    const character = await this.dataProcessor.processCharacterData(
      bilingualData.ja,
      bilingualData.en,
      entry
    );

    // 成功カウント
    if (this.progressTracker) {
      this.progressTracker.incrementSuccess();
    }

    this.processedCount++;

    return {
      entry,
      jaData: bilingualData.ja,
      enData: bilingualData.en,
      character,
    };
  }

  /**
   * 全キャラクターのAPIデータを取得する
   * @param entries キャラクターエントリーの配列
   * @param options バッチ処理オプション
   * @returns Promise<ApiDataResult[]> API取得結果
   */
  private async fetchAllCharacterData(
    entries: CharacterEntry[],
    options: Required<BatchProcessingOptions>
  ): Promise<ApiDataResult[]> {
    console.log(`📡 API データ取得フェーズ開始`);

    const results: ApiDataResult[] = [];

    // バッチ単位で処理
    for (let i = 0; i < entries.length; i += options.batchSize) {
      const batch = entries.slice(i, i + options.batchSize);
      const batchNumber = Math.floor(i / options.batchSize) + 1;
      const totalBatches = Math.ceil(entries.length / options.batchSize);

      console.log(`\n--- バッチ ${batchNumber}/${totalBatches} ---`);
      console.log(`対象キャラクター: ${batch.map((e) => e.id).join(", ")}`);

      // バッチ内の各キャラクターを処理
      for (const entry of batch) {
        this.updateProgress(
          this.processedCount,
          entries.length,
          entry.id,
          "API データ取得中"
        );

        try {
          // 単一キャラクターのAPIデータを取得
          const bilingualData = await this.apiClient.fetchBothLanguages(
            entry.pageId
          );
          const result: ApiDataResult = {
            entry,
            data: bilingualData,
          };
          results.push(result);
          this.processedCount++;

          console.log(`  ✓ ${entry.id} API取得完了`);
        } catch (error) {
          const failedResult: ApiDataResult = {
            entry,
            data: null,
            error: error instanceof Error ? error.message : "不明なAPIエラー",
          };
          results.push(failedResult);
          this.processedCount++;

          console.log(`  ✗ ${entry.id} API取得失敗: ${failedResult.error}`);
        }

        // プログレス更新
        this.updateProgress(
          this.processedCount,
          entries.length,
          entry.id,
          "API データ取得完了"
        );
      }

      // バッチ間の遅延
      if (i + options.batchSize < entries.length) {
        console.log(`⏳ ${options.delayMs}ms 待機中...`);
        await this.delay(options.delayMs);
      }
    }

    // API取得統計
    const successful = results.filter((r) => r.data !== null).length;
    const failed = results.filter((r) => r.data === null).length;

    console.log(`\n📊 API取得フェーズ完了`);
    console.log(`成功: ${successful}/${results.length}`);
    console.log(`失敗: ${failed}/${results.length}`);
    console.log(`成功率: ${Math.round((successful / results.length) * 100)}%`);

    return results;
  }

  /**
   * キャラクターデータを処理する
   * @param apiResults API取得結果
   * @param successful 成功結果の配列（参照渡し）
   * @param failed 失敗結果の配列（参照渡し）
   */
  private async processCharacterData(
    apiResults: ApiDataResult[],
    successful: CharacterResult[],
    failed: FailedCharacter[]
  ): Promise<void> {
    console.log(`\n🔄 データ処理フェーズ開始`);

    let processedCount = 0;
    const successfulApiResults = apiResults.filter((r) => r.data !== null);

    // API取得に失敗したキャラクターを失敗リストに追加
    apiResults
      .filter((r) => r.data === null)
      .forEach((r) => {
        failed.push({
          entry: r.entry,
          error: r.error || "API取得失敗",
          stage: ProcessingStage.API_FETCH,
          timestamp: new Date(),
        });
      });

    // 成功したAPIデータを処理
    for (const apiResult of successfulApiResults) {
      this.updateProgress(
        processedCount,
        successfulApiResults.length,
        apiResult.entry.id,
        "データ処理中"
      );

      try {
        console.log(`  🔄 ${apiResult.entry.id} データ処理中...`);

        const character = await this.dataProcessor.processCharacterData(
          apiResult.data!.ja,
          apiResult.data!.en,
          apiResult.entry
        );

        const characterResult: CharacterResult = {
          entry: apiResult.entry,
          jaData: apiResult.data!.ja,
          enData: apiResult.data!.en,
          character,
        };

        successful.push(characterResult);
        console.log(`  ✓ ${apiResult.entry.id} データ処理完了`);
      } catch (error) {
        const failedCharacter: FailedCharacter = {
          entry: apiResult.entry,
          error: error instanceof Error ? error.message : "データ処理エラー",
          stage: ProcessingStage.DATA_PROCESSING,
          timestamp: new Date(),
        };

        failed.push(failedCharacter);
        console.log(
          `  ✗ ${apiResult.entry.id} データ処理失敗: ${failedCharacter.error}`
        );
      }

      processedCount++;
      this.updateProgress(
        processedCount,
        successfulApiResults.length,
        apiResult.entry.id,
        "データ処理完了"
      );
    }

    console.log(`\n📊 データ処理フェーズ完了`);
    console.log(`成功: ${successful.length}/${successfulApiResults.length}`);
    console.log(`失敗: ${failed.length}/${apiResults.length}`);
  }

  /**
   * プログレス情報を更新する
   * @param current 現在の処理数
   * @param total 総処理数
   * @param currentCharacter 現在処理中のキャラクター
   * @param stage 現在のステージ
   */
  private updateProgress(
    current: number,
    total: number,
    currentCharacter: string,
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

    const progress: ProgressInfo = {
      current,
      total,
      percentage,
      currentCharacter,
      stage,
      elapsedTime,
      estimatedTimeRemaining,
    };

    // コンソール表示
    if (currentCharacter) {
      const elapsed = this.formatDuration(elapsedTime);
      const remaining = estimatedTimeRemaining
        ? ` (残り約${this.formatDuration(estimatedTimeRemaining)})`
        : "";

      console.log(
        `📊 進捗: ${current}/${total} (${percentage}%) | ${currentCharacter} | ${stage} | 経過時間: ${elapsed}${remaining}`
      );
    }

    // コールバック実行
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }

  /**
   * 最終統計情報を表示する
   * @param statistics 統計情報
   * @param successful 成功結果
   * @param failed 失敗結果
   */
  private displayFinalStatistics(
    statistics: ProcessingStatistics,
    successful: CharacterResult[],
    failed: FailedCharacter[]
  ): void {
    console.log(`\n🎉 === 全キャラクター処理完了 ===`);
    console.log(`処理開始時刻: ${statistics.startTime.toLocaleString()}`);
    console.log(`処理終了時刻: ${statistics.endTime?.toLocaleString()}`);
    console.log(
      `総処理時間: ${this.formatDuration(statistics.processingTime)}`
    );
    console.log(`================================`);
    console.log(`📊 処理結果統計:`);
    console.log(`  総キャラクター数: ${statistics.total}`);
    console.log(`  成功: ${statistics.successful}`);
    console.log(`  失敗: ${statistics.failed}`);
    console.log(
      `  成功率: ${Math.round(
        (statistics.successful / statistics.total) * 100
      )}%`
    );

    if (failed.length > 0) {
      console.log(`\n❌ 失敗したキャラクター:`);
      failed.forEach((f) => {
        console.log(`  - ${f.entry.id} (${f.stage}): ${f.error}`);
      });
    }

    if (successful.length > 0) {
      console.log(`\n✅ 成功したキャラクター:`);
      successful.forEach((s) => {
        console.log(`  - ${s.character.id} (${s.character.name.ja})`);
      });
    }

    console.log(`================================\n`);
  }

  /**
   * 統計情報を生成する
   * @param successful 成功結果
   * @param failed 失敗結果
   * @param startTime 開始時刻
   * @param endTime 終了時刻
   * @returns ProcessingStatistics 統計情報
   */
  private generateStatistics(
    successful: CharacterResult[],
    failed: FailedCharacter[],
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
   * 失敗したキャラクターのみを再処理する
   * @param previousResult 前回の処理結果
   * @param options バッチ処理オプション
   * @returns Promise<ProcessingResult> 再処理結果
   */
  async retryFailedCharacters(
    previousResult: ProcessingResult,
    options: BatchProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const failedEntries = previousResult.failed.map((f) => f.entry);

    if (failedEntries.length === 0) {
      console.log("🎉 再処理が必要なキャラクターはありません。");
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

    console.log(`\n🔄 === 失敗キャラクターの再処理 ===`);
    console.log(`対象キャラクター数: ${failedEntries.length}`);
    console.log(
      `失敗キャラクター: ${failedEntries.map((e) => e.id).join(", ")}`
    );
    console.log(`================================\n`);

    return await this.processAllCharacters(failedEntries, options);
  }

  /**
   * 処理結果を検証する
   * @param result 処理結果
   * @param minSuccessRate 最小成功率（0-1）
   * @throws BatchProcessingError 成功率が基準を下回る場合
   */
  validateProcessingResult(
    result: ProcessingResult,
    minSuccessRate: number = 0.8
  ): void {
    const successRate = result.statistics.successful / result.statistics.total;

    if (successRate < minSuccessRate) {
      const failedCharacterIds = result.failed.map((f) => f.entry.id);

      throw new BatchProcessingError(
        failedCharacterIds,
        result.statistics.total,
        `処理成功率が基準を下回りました: ${Math.round(
          successRate * 100
        )}% < ${Math.round(minSuccessRate * 100)}%`
      );
    }

    console.log(
      `✅ 処理結果検証完了: 成功率 ${Math.round(successRate * 100)}%`
    );
  }

  /**
   * 処理レポートを生成する
   * @param result 処理結果
   * @returns 詳細なレポート文字列
   */
  generateProcessingReport(result: ProcessingResult): string {
    const { statistics, successful, failed } = result;
    const successRate = (statistics.successful / statistics.total) * 100;

    let report = `# 全キャラクター処理レポート\n\n`;
    report += `## 処理概要\n`;
    report += `- 処理開始時刻: ${statistics.startTime.toLocaleString()}\n`;
    report += `- 処理終了時刻: ${statistics.endTime?.toLocaleString()}\n`;
    report += `- 総処理時間: ${this.formatDuration(
      statistics.processingTime
    )}\n`;
    report += `- 総キャラクター数: ${statistics.total}\n`;
    report += `- 成功: ${statistics.successful}\n`;
    report += `- 失敗: ${statistics.failed}\n`;
    report += `- 成功率: ${Math.round(successRate)}%\n\n`;

    if (successful.length > 0) {
      report += `## 成功したキャラクター (${successful.length})\n`;
      successful.forEach((s, index) => {
        report += `${index + 1}. ${s.character.id} (${s.character.name.ja})\n`;
      });
      report += `\n`;
    }

    if (failed.length > 0) {
      report += `## 失敗したキャラクター (${failed.length})\n`;
      failed.forEach((f, index) => {
        report += `${index + 1}. ${f.entry.id} - ${f.stage}: ${f.error}\n`;
      });
      report += `\n`;
    }

    return report;
  }

  /**
   * メモリ統計を表示
   */
  private displayMemoryStatistics(): void {
    const memoryStats = this.memoryOptimizer.getMemoryStatistics();

    console.log(`\n🧠 === メモリ使用量統計 ===`);
    console.log(
      `現在の使用量: ${this.formatBytes(memoryStats.current.heapUsed)}`
    );
    console.log(`ピーク使用量: ${this.formatBytes(memoryStats.peak.heapUsed)}`);
    console.log(`平均使用量: ${this.formatBytes(memoryStats.average)}`);
    console.log(`使用量トレンド: ${memoryStats.trend}`);
    console.log(`============================\n`);

    // メモリレポートをファイルに出力
    try {
      const fs = require("fs");
      const memoryReport = this.memoryOptimizer.generateMemoryReport();
      fs.writeFileSync("memory-usage-report.md", memoryReport, "utf-8");
      console.log(`📄 メモリレポートを生成: memory-usage-report.md`);
    } catch (error) {
      console.warn(`⚠️  メモリレポートの生成に失敗: ${error}`);
    }
  }

  /**
   * バイト数を人間が読みやすい形式にフォーマット
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)} KB`;
    } else if (bytes < 1024 * 1024 * 1024) {
      return `${Math.round(bytes / (1024 * 1024))} MB`;
    } else {
      return `${Math.round(bytes / (1024 * 1024 * 1024))} GB`;
    }
  }

  /**
   * クリーンアップ処理
   */
  private cleanup(): void {
    console.log(`🧹 クリーンアップ実行中...`);

    // プログレストラッカーのクリーンアップ
    if (this.progressTracker) {
      this.progressTracker.displayFinalStatistics();
      this.progressTracker.cleanup();
      this.progressTracker = undefined;
    }

    // ワーカープールのクリーンアップ
    if (this.workerPool) {
      this.workerPool.stop();
      this.workerPool = undefined;
    }

    // メモリオプティマイザーのクリーンアップ
    this.memoryOptimizer.cleanup();

    console.log(`✅ クリーンアップ完了`);
  }

  /**
   * 時間を人間が読みやすい形式にフォーマットする
   * @param ms ミリ秒
   * @returns フォーマットされた時間文字列
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
   * 指定された時間だけ待機する
   * @param ms 待機時間（ミリ秒）
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
