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

    log(`\n=== 最適化バッチ処理開始 ===`);
    log(`対象キャラクター数: ${entries.length}`);
    log(`バッチサイズ: ${opts.batchSize}`);
    log(`処理開始時刻: ${this.startTime.toLocaleString()}`);
    log(`メモリ最適化: 有効`);
    log(`並行処理: 有効`);
    log(`===============================\n`);

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
    // テスト環境でも並行処理を使用してバッチ効果を測定
    return await this.processWithBatchOptimization(entries, options);

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
      if (this.workerPool) {
        const stats = this.workerPool.getStatistics();

        // プログレストラッカー更新
        if (this.progressTracker) {
          this.progressTracker.update(
            stats.completedTasks + stats.failedTasks,
            "", // 現在のアイテムはワーカープール内で管理
            "並行処理中",
            undefined,
            false
          );
        }

        // プログレスコールバック呼び出し
        this.updateProgress(
          stats.completedTasks + stats.failedTasks,
          entries.length,
          "並行処理中",
          "処理中"
        );
      }

      // メモリ監視
      this.memoryOptimizer.monitorAndOptimize();
    }, 1000);

    // 全タスクをワーカープールに追加
    log(`🚀 ワーカープールにタスクを追加中...`);
    if (this.workerPool) {
      entries.forEach((entry, index) => {
        const priority = entries.length - index; // 後のキャラクターほど優先度を下げる
        this.workerPool!.addTask(entry, priority, options.maxRetries);
      });
    }

    // 処理開始と完了待機
    log(`⚡ 並行処理開始...`);

    // 初期プログレス更新
    this.updateProgress(0, entries.length, "開始", "初期化");

    try {
      if (this.workerPool) {
        await this.workerPool.start();
        await this.workerPool.waitForCompletion();
      }
    } finally {
      clearInterval(statsInterval);
    }

    // 結果を取得
    const results = this.workerPool?.getResults() || [];
    const failedTasks = this.workerPool?.getFailedTasks() || [];

    const successful = results;
    const failed: FailedCharacter[] = failedTasks.map((task) => {
      // エラーの種類に基づいてステージを判定
      let stage = ProcessingStage.DATA_PROCESSING;
      if (
        task.error.message.includes("API取得エラー") ||
        task.error.message.includes("fetch") ||
        task.error.message.includes("network") ||
        task.error.message.includes("HTTP")
      ) {
        stage = ProcessingStage.API_FETCH;
      }

      return {
        entry: task.data,
        error: task.error.message,
        stage,
        timestamp: new Date(),
      };
    });

    // ワーカープール統計を表示
    if (this.workerPool) {
      log(`\n📊 ワーカープール統計:`);
      log(this.workerPool.generateStatisticsReport());
    }

    return { successful, failed };
  }

  /**
   * バッチ最適化処理（テスト環境対応）
   * @param entries キャラクターエントリーの配列
   * @param options バッチ処理オプション
   * @returns Promise<{successful: CharacterResult[], failed: FailedCharacter[]}>
   */
  private async processWithBatchOptimization(
    entries: CharacterEntry[],
    options: Required<BatchProcessingOptions>
  ): Promise<{ successful: CharacterResult[]; failed: FailedCharacter[] }> {
    const successful: CharacterResult[] = [];
    const failed: FailedCharacter[] = [];

    // 初期プログレス更新
    this.updateProgress(0, entries.length, "開始", "初期化");

    // バッチ単位で並行処理
    for (let i = 0; i < entries.length; i += options.batchSize) {
      const batch = entries.slice(i, i + options.batchSize);
      const batchNumber = Math.floor(i / options.batchSize) + 1;
      const totalBatches = Math.ceil(entries.length / options.batchSize);

      log(
        `\n--- バッチ ${batchNumber}/${totalBatches} (${batch.length}キャラクター) ---`
      );

      // バッチ内で並行処理
      const batchPromises = batch.map(
        async (
          entry,
          index
        ): Promise<{
          success: boolean;
          result?: CharacterResult;
          error?: FailedCharacter;
        }> => {
          const globalIndex = i + index;

          // プログレス更新
          this.updateProgress(
            globalIndex,
            entries.length,
            entry.id,
            "API取得中"
          );

          let lastError: string | null = null;

          // API取得を試行
          let bilingualData: any = null;
          let apiError: string | null = null;

          for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
            try {
              // API取得
              bilingualData = await this.apiClient.fetchBothLanguages(
                entry.pageId
              );
              break; // 成功した場合はループを抜ける
            } catch (error) {
              apiError =
                error instanceof Error ? error.message : "API取得エラー";
              if (attempt < options.maxRetries) {
                // リトライ前の短い遅延
                await new Promise((resolve) =>
                  setTimeout(resolve, options.delayMs * 0.5)
                );
              }
            }
          }

          // API取得に失敗した場合
          if (!bilingualData) {
            return {
              success: false,
              error: {
                entry,
                error: apiError || "API取得失敗",
                stage: ProcessingStage.API_FETCH,
                timestamp: new Date(),
              } as FailedCharacter,
            };
          }

          // データ処理を試行
          try {
            // プログレス更新
            this.updateProgress(
              globalIndex,
              entries.length,
              entry.id,
              "データ処理中"
            );

            // データ処理
            const character = await this.dataProcessor.processCharacterData(
              bilingualData.ja,
              bilingualData.en,
              entry
            );

            // 成功結果を返す
            return {
              success: true,
              result: {
                entry,
                jaData: bilingualData.ja,
                enData: bilingualData.en,
                character,
              } as CharacterResult,
            };
          } catch (error) {
            // データ処理エラー
            return {
              success: false,
              error: {
                entry,
                error:
                  error instanceof Error ? error.message : "データ処理エラー",
                stage: ProcessingStage.DATA_PROCESSING,
                timestamp: new Date(),
              } as FailedCharacter,
            };
          }
        }
      );

      // バッチ内の全ての処理を並行実行
      const batchResults = await Promise.all(batchPromises);

      // 結果を分類
      batchResults.forEach((result) => {
        if (result.success && result.result) {
          successful.push(result.result);
          log(`  ✓ ${result.result.entry.id} 処理完了`);
        } else if (!result.success && result.error) {
          failed.push(result.error);
          log(`  ✗ ${result.error.entry.id} 処理失敗: ${result.error.error}`);
        }
      });

      // プログレス更新
      const processedSoFar = Math.min(i + options.batchSize, entries.length);
      this.updateProgress(
        processedSoFar,
        entries.length,
        "バッチ完了",
        `バッチ ${batchNumber}/${totalBatches} 完了`
      );

      // バッチ間の遅延（最後のバッチでない場合）
      if (i + options.batchSize < entries.length) {
        log(`⏳ バッチ間遅延 ${options.delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      }
    }

    return { successful, failed };
  }

  /**
   * 従来の処理方法（テスト用）
   * @param entries キャラクターエントリーの配列
   * @param options バッチ処理オプション
   * @returns Promise<{successful: CharacterResult[], failed: FailedCharacter[]}>
   */
  private async processWithTraditionalMethod(
    entries: CharacterEntry[],
    options: Required<BatchProcessingOptions>
  ): Promise<{ successful: CharacterResult[]; failed: FailedCharacter[] }> {
    const successful: CharacterResult[] = [];
    const failed: FailedCharacter[] = [];

    // 初期プログレス更新
    this.updateProgress(0, entries.length, "開始", "初期化");

    // 各キャラクターを順次処理（テスト環境では並行処理を避ける）
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      // プログレス更新（API取得開始）
      this.updateProgress(i, entries.length, entry.id, "API取得中");

      let lastError: string | null = null;
      let apiResult: any = null;

      // リトライ機能付きでAPI データ取得
      for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
        try {
          const bilingualData = await this.apiClient.fetchBothLanguages(
            entry.pageId
          );
          apiResult = {
            entry,
            data: bilingualData,
          };
          break; // 成功した場合はリトライループを抜ける
        } catch (error) {
          lastError = error instanceof Error ? error.message : "API取得エラー";
          if (attempt < options.maxRetries) {
            await new Promise((resolve) =>
              setTimeout(resolve, options.delayMs * attempt)
            );
          }
        }
      }

      // データ処理
      if (apiResult?.data) {
        try {
          // プログレス更新（データ処理開始）
          this.updateProgress(i, entries.length, entry.id, "データ処理中");

          const character = await this.dataProcessor.processCharacterData(
            apiResult.data.ja,
            apiResult.data.en,
            apiResult.entry
          );

          successful.push({
            entry: apiResult.entry,
            jaData: apiResult.data.ja,
            enData: apiResult.data.en,
            character,
          });

          // プログレス更新（処理完了）
          this.updateProgress(i + 1, entries.length, entry.id, "処理完了");
        } catch (error) {
          failed.push({
            entry: apiResult.entry,
            error: error instanceof Error ? error.message : "データ処理エラー",
            stage: ProcessingStage.DATA_PROCESSING,
            timestamp: new Date(),
          });

          // プログレス更新（処理失敗）
          this.updateProgress(i + 1, entries.length, entry.id, "処理失敗");
        }
      } else {
        failed.push({
          entry,
          error: lastError || "API取得失敗",
          stage: ProcessingStage.API_FETCH,
          timestamp: new Date(),
        });

        // プログレス更新（API取得失敗）
        this.updateProgress(i + 1, entries.length, entry.id, "API取得失敗");
      }

      // 処理間の遅延（最後のキャラクターでない場合）
      if (i < entries.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      }
    }

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
    log(`📡 API データ取得フェーズ開始`);

    const results: ApiDataResult[] = [];

    // バッチ単位で処理
    for (let i = 0; i < entries.length; i += options.batchSize) {
      const batch = entries.slice(i, i + options.batchSize);
      const batchNumber = Math.floor(i / options.batchSize) + 1;
      const totalBatches = Math.ceil(entries.length / options.batchSize);

      log(`\n--- バッチ ${batchNumber}/${totalBatches} ---`);
      log(`対象キャラクター: ${batch.map((e) => e.id).join(", ")}`);

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

          log(`  ✓ ${entry.id} API取得完了`);
        } catch (error) {
          const failedResult: ApiDataResult = {
            entry,
            data: null,
            error: error instanceof Error ? error.message : "不明なAPIエラー",
          };
          results.push(failedResult);
          this.processedCount++;

          log(`  ✗ ${entry.id} API取得失敗: ${failedResult.error}`);
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
        log(`⏳ ${options.delayMs}ms 待機中...`);
        await this.delay(options.delayMs);
      }
    }

    // API取得統計
    const successful = results.filter((r) => r.data !== null).length;
    const failed = results.filter((r) => r.data === null).length;

    log(`\n📊 API取得フェーズ完了`);
    log(`成功: ${successful}/${results.length}`);
    log(`失敗: ${failed}/${results.length}`);
    log(`成功率: ${Math.round((successful / results.length) * 100)}%`);

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
    log(`\n🔄 データ処理フェーズ開始`);

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
        log(`  🔄 ${apiResult.entry.id} データ処理中...`);

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
        log(`  ✓ ${apiResult.entry.id} データ処理完了`);
      } catch (error) {
        const failedCharacter: FailedCharacter = {
          entry: apiResult.entry,
          error: error instanceof Error ? error.message : "データ処理エラー",
          stage: ProcessingStage.DATA_PROCESSING,
          timestamp: new Date(),
        };

        failed.push(failedCharacter);
        log(
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

    log(`\n📊 データ処理フェーズ完了`);
    log(`成功: ${successful.length}/${successfulApiResults.length}`);
    log(`失敗: ${failed.length}/${apiResults.length}`);
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

      log(
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
    log(`\n🎉 === 全キャラクター処理完了 ===`);
    log(`処理開始時刻: ${statistics.startTime.toLocaleString()}`);
    log(`処理終了時刻: ${statistics.endTime?.toLocaleString()}`);
    log(`総処理時間: ${this.formatDuration(statistics.processingTime)}`);
    log(`================================`);
    log(`📊 処理結果統計:`);
    log(`  総キャラクター数: ${statistics.total}`);
    log(`  成功: ${statistics.successful}`);
    log(`  失敗: ${statistics.failed}`);
    log(
      `  成功率: ${Math.round(
        (statistics.successful / statistics.total) * 100
      )}%`
    );

    if (failed.length > 0) {
      log(`\n❌ 失敗したキャラクター:`);
      failed.forEach((f) => {
        log(`  - ${f.entry.id} (${f.stage}): ${f.error}`);
      });
    }

    if (successful.length > 0) {
      log(`\n✅ 成功したキャラクター:`);
      successful.forEach((s) => {
        if (s && s.character && s.character.id && s.character.name) {
          log(`  - ${s.character.id} (${s.character.name.ja})`);
        } else {
          log(`  - 不明なキャラクター (データ不正)`);
        }
      });
    }

    log(`================================\n`);
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
      log("🎉 再処理が必要なキャラクターはありません。");
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

    log(`\n🔄 === 失敗キャラクターの再処理 ===`);
    log(`対象キャラクター数: ${failedEntries.length}`);
    log(`失敗キャラクター: ${failedEntries.map((e) => e.id).join(", ")}`);
    log(`================================\n`);

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

    if (
      process.env.NODE_ENV !== "test" &&
      process.env.VITEST !== "true" &&
      !process.env.SUPPRESS_LOGS
    ) {
      console.log(
        `✅ 処理結果検証完了: 成功率 ${Math.round(successRate * 100)}%`
      );
    }
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

    if (
      process.env.NODE_ENV !== "test" &&
      process.env.VITEST !== "true" &&
      !process.env.SUPPRESS_LOGS
    ) {
      console.log(`\n🧠 === メモリ使用量統計 ===`);
      console.log(
        `現在の使用量: ${this.formatBytes(memoryStats.current.heapUsed)}`
      );
      console.log(
        `ピーク使用量: ${this.formatBytes(memoryStats.peak.heapUsed)}`
      );
      console.log(`平均使用量: ${this.formatBytes(memoryStats.average)}`);
      console.log(`使用量トレンド: ${memoryStats.trend}`);
      console.log(`============================\n`);
    }

    // メモリレポートをファイルに出力
    try {
      const fs = require("fs");
      const memoryReport = this.memoryOptimizer.generateMemoryReport();
      fs.writeFileSync("memory-usage-report.md", memoryReport, "utf-8");
      if (
        process.env.NODE_ENV !== "test" &&
        process.env.VITEST !== "true" &&
        !process.env.SUPPRESS_LOGS
      ) {
        console.log(`📄 メモリレポートを生成: memory-usage-report.md`);
      }
    } catch (error) {
      if (
        process.env.NODE_ENV !== "test" &&
        process.env.VITEST !== "true" &&
        !process.env.SUPPRESS_LOGS
      ) {
        console.warn(`⚠️  メモリレポートの生成に失敗: ${error}`);
      }
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
    if (
      process.env.NODE_ENV !== "test" &&
      process.env.VITEST !== "true" &&
      !process.env.SUPPRESS_LOGS
    ) {
      console.log(`🧹 クリーンアップ実行中...`);
    }

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

    if (
      process.env.NODE_ENV !== "test" &&
      process.env.VITEST !== "true" &&
      !process.env.SUPPRESS_LOGS
    ) {
      console.log(`✅ クリーンアップ完了`);
    }
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
