import { CharacterEntry } from "../types";
import { BilingualApiData } from "../types/processing";

/**
 * ワーカータスク
 */
export interface WorkerTask<T, R> {
  id: string;
  data: T;
  priority: number;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: R;
  error?: Error;
}

/**
 * ワーカー統計
 */
export interface WorkerStatistics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  activeTasks: number;
  queuedTasks: number;
  averageProcessingTime: number;
  throughput: number; // tasks per second
}

/**
 * 並行処理ワーカープール
 * 効率的なタスク管理と負荷分散を提供
 */
export class WorkerPool<T, R> {
  private readonly maxConcurrency: number;
  private readonly taskQueue: WorkerTask<T, R>[] = [];
  private readonly activeTasks: Map<string, WorkerTask<T, R>> = new Map();
  private readonly completedTasks: WorkerTask<T, R>[] = [];
  private readonly failedTasks: WorkerTask<T, R>[] = [];

  private isRunning = false;
  private taskIdCounter = 0;
  private startTime?: Date;

  // パフォーマンス監視
  private processingTimes: number[] = [];
  private lastThroughputCheck = Date.now();
  private tasksCompletedSinceLastCheck = 0;

  constructor(
    private readonly processor: (data: T) => Promise<R>,
    maxConcurrency: number = 5,
    private readonly delayMs: number = 200
  ) {
    this.maxConcurrency = Math.max(1, maxConcurrency);
  }

  /**
   * タスクをキューに追加
   */
  addTask(data: T, priority: number = 0, maxRetries: number = 3): string {
    const taskId = `task-${++this.taskIdCounter}`;
    const task: WorkerTask<T, R> = {
      id: taskId,
      data,
      priority,
      retryCount: 0,
      maxRetries,
      createdAt: new Date(),
    };

    // 優先度順でキューに挿入
    const insertIndex = this.taskQueue.findIndex((t) => t.priority < priority);
    if (insertIndex === -1) {
      this.taskQueue.push(task);
    } else {
      this.taskQueue.splice(insertIndex, 0, task);
    }

    // 自動的に処理を開始
    if (!this.isRunning) {
      this.start();
    }

    return taskId;
  }

  /**
   * 複数のタスクを一括追加
   */
  addTasks(
    dataArray: T[],
    priority: number = 0,
    maxRetries: number = 3
  ): string[] {
    return dataArray.map((data) => this.addTask(data, priority, maxRetries));
  }

  /**
   * ワーカープールを開始
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.startTime = new Date();

    console.log(`🚀 ワーカープール開始 (並行度: ${this.maxConcurrency})`);

    // 並行ワーカーを起動
    const workers = Array.from({ length: this.maxConcurrency }, (_, index) =>
      this.runWorker(`worker-${index + 1}`)
    );

    // 全ワーカーの完了を待機
    await Promise.all(workers);

    this.isRunning = false;
    console.log(`✅ ワーカープール完了`);
  }

  /**
   * ワーカープールを停止
   */
  stop(): void {
    this.isRunning = false;
    console.log(`⏹️  ワーカープール停止要求`);
  }

  /**
   * 全タスクの完了を待機
   */
  async waitForCompletion(): Promise<void> {
    while (
      this.isRunning &&
      (this.taskQueue.length > 0 || this.activeTasks.size > 0)
    ) {
      await this.delay(100);
    }
  }

  /**
   * 個別ワーカーの実行
   */
  private async runWorker(workerId: string): Promise<void> {
    console.log(`👷 ${workerId} 開始`);

    while (this.isRunning) {
      // キューからタスクを取得
      const task = this.getNextTask();
      if (!task) {
        // タスクがない場合は少し待機
        await this.delay(50);
        continue;
      }

      // タスクを実行
      await this.executeTask(task, workerId);

      // 遅延を適用（レート制限対応）
      if (this.delayMs > 0) {
        await this.delay(this.delayMs);
      }
    }

    console.log(`👷 ${workerId} 終了`);
  }

  /**
   * 次のタスクを取得
   */
  private getNextTask(): WorkerTask<T, R> | null {
    if (this.taskQueue.length === 0) {
      return null;
    }

    // 優先度が最も高いタスクを取得
    const task = this.taskQueue.shift()!;
    task.startedAt = new Date();
    this.activeTasks.set(task.id, task);

    return task;
  }

  /**
   * タスクを実行
   */
  private async executeTask(
    task: WorkerTask<T, R>,
    workerId: string
  ): Promise<void> {
    const startTime = Date.now();

    try {
      console.log(`🔄 ${workerId}: ${task.id} 実行開始`);

      // タスクを実行
      const result = await this.processor(task.data);

      // 成功時の処理
      task.result = result;
      task.completedAt = new Date();

      this.activeTasks.delete(task.id);
      this.completedTasks.push(task);

      // パフォーマンス統計を更新
      const processingTime = Date.now() - startTime;
      this.processingTimes.push(processingTime);
      this.tasksCompletedSinceLastCheck++;

      // 統計データのサイズ制限
      if (this.processingTimes.length > 100) {
        this.processingTimes = this.processingTimes.slice(-100);
      }

      console.log(`✅ ${workerId}: ${task.id} 完了 (${processingTime}ms)`);
    } catch (error) {
      // エラー時の処理
      task.error = error instanceof Error ? error : new Error(String(error));
      task.retryCount++;

      console.log(
        `❌ ${workerId}: ${task.id} 失敗 (試行 ${task.retryCount}/${task.maxRetries})`
      );

      // リトライ判定
      if (task.retryCount < task.maxRetries) {
        // リトライする場合はキューに戻す（優先度を下げる）
        task.priority = Math.max(0, task.priority - 1);
        this.activeTasks.delete(task.id);
        this.taskQueue.push(task);

        console.log(`🔄 ${workerId}: ${task.id} リトライ予定`);
      } else {
        // 最大リトライ回数に達した場合は失敗として記録
        task.completedAt = new Date();
        this.activeTasks.delete(task.id);
        this.failedTasks.push(task);

        console.log(`💀 ${workerId}: ${task.id} 最終失敗`);
      }
    }
  }

  /**
   * 統計情報を取得
   */
  getStatistics(): WorkerStatistics {
    const totalTasks =
      this.completedTasks.length +
      this.failedTasks.length +
      this.activeTasks.size +
      this.taskQueue.length;

    const averageProcessingTime =
      this.processingTimes.length > 0
        ? this.processingTimes.reduce((sum, time) => sum + time, 0) /
          this.processingTimes.length
        : 0;

    // スループット計算（1秒あたりのタスク数）
    const now = Date.now();
    const timeSinceLastCheck = now - this.lastThroughputCheck;
    let throughput = 0;

    if (timeSinceLastCheck >= 1000) {
      // 1秒以上経過している場合
      throughput =
        (this.tasksCompletedSinceLastCheck * 1000) / timeSinceLastCheck;
      this.lastThroughputCheck = now;
      this.tasksCompletedSinceLastCheck = 0;
    }

    return {
      totalTasks,
      completedTasks: this.completedTasks.length,
      failedTasks: this.failedTasks.length,
      activeTasks: this.activeTasks.size,
      queuedTasks: this.taskQueue.length,
      averageProcessingTime,
      throughput,
    };
  }

  /**
   * 詳細な統計レポートを生成
   */
  generateStatisticsReport(): string {
    const stats = this.getStatistics();
    const successRate =
      stats.totalTasks > 0
        ? (stats.completedTasks / (stats.completedTasks + stats.failedTasks)) *
          100
        : 0;

    let report = `# ワーカープール統計レポート\n\n`;
    report += `## 基本統計\n`;
    report += `- 総タスク数: ${stats.totalTasks}\n`;
    report += `- 完了タスク: ${stats.completedTasks}\n`;
    report += `- 失敗タスク: ${stats.failedTasks}\n`;
    report += `- 実行中タスク: ${stats.activeTasks}\n`;
    report += `- 待機中タスク: ${stats.queuedTasks}\n`;
    report += `- 成功率: ${Math.round(successRate)}%\n\n`;

    report += `## パフォーマンス\n`;
    report += `- 平均処理時間: ${Math.round(stats.averageProcessingTime)}ms\n`;
    report += `- スループット: ${stats.throughput.toFixed(2)} tasks/sec\n`;
    report += `- 並行度: ${this.maxConcurrency}\n`;
    report += `- 遅延時間: ${this.delayMs}ms\n\n`;

    if (this.startTime) {
      const totalTime = Date.now() - this.startTime.getTime();
      report += `## 実行時間\n`;
      report += `- 開始時刻: ${this.startTime.toLocaleString()}\n`;
      report += `- 総実行時間: ${this.formatDuration(totalTime)}\n\n`;
    }

    // 失敗したタスクの詳細
    if (this.failedTasks.length > 0) {
      report += `## 失敗したタスク\n`;
      this.failedTasks.slice(0, 10).forEach((task, index) => {
        report += `${index + 1}. ${task.id}: ${
          task.error?.message || "不明なエラー"
        }\n`;
      });
      if (this.failedTasks.length > 10) {
        report += `... その他 ${this.failedTasks.length - 10}件\n`;
      }
    }

    return report;
  }

  /**
   * 完了したタスクの結果を取得
   */
  getResults(): R[] {
    return this.completedTasks
      .filter((task) => task.result !== undefined)
      .map((task) => task.result!);
  }

  /**
   * 失敗したタスクの情報を取得
   */
  getFailedTasks(): Array<{ id: string; data: T; error: Error }> {
    return this.failedTasks.map((task) => ({
      id: task.id,
      data: task.data,
      error: task.error!,
    }));
  }

  /**
   * キューをクリア
   */
  clearQueue(): void {
    this.taskQueue.length = 0;
    console.log(`🧹 タスクキューをクリアしました`);
  }

  /**
   * 統計をリセット
   */
  resetStatistics(): void {
    this.completedTasks.length = 0;
    this.failedTasks.length = 0;
    this.processingTimes.length = 0;
    this.tasksCompletedSinceLastCheck = 0;
    this.lastThroughputCheck = Date.now();
    this.startTime = undefined;
    console.log(`📊 統計をリセットしました`);
  }

  /**
   * 時間を人間が読みやすい形式にフォーマット
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
   * 指定された時間だけ待機
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
