/**
 * 拡張プログレス情報
 */
export interface EnhancedProgressInfo {
  // 基本情報
  current: number;
  total: number;
  percentage: number;

  // 現在の状態
  currentItem: string;
  stage: string;

  // 時間情報
  startTime: Date;
  elapsedTime: number;
  estimatedTimeRemaining?: number;
  estimatedCompletionTime?: Date;

  // パフォーマンス情報
  itemsPerSecond: number;
  averageItemTime: number;

  // 統計情報
  successCount: number;
  failureCount: number;
  retryCount: number;

  // メモリ情報
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}

/**
 * プログレス表示設定
 */
export interface ProgressDisplayOptions {
  showMemoryUsage: boolean;
  showPerformanceMetrics: boolean;
  showDetailedTiming: boolean;
  updateInterval: number; // ms
  barWidth: number;
  useColors: boolean;
}

/**
 * 拡張プログレストラッカー
 * 詳細なプログレス表示と統計情報を提供
 */
export class EnhancedProgressTracker {
  private readonly startTime: Date;
  private readonly itemTimes: number[] = [];
  private readonly displayOptions: Required<ProgressDisplayOptions>;

  private current = 0;
  private total = 0;
  private currentItem = "";
  private stage = "";
  private successCount = 0;
  private failureCount = 0;
  private retryCount = 0;

  private lastUpdateTime = 0;
  private lastDisplayTime = 0;

  // コールバック
  private progressCallback?: (progress: EnhancedProgressInfo) => void;
  private displayCallback?: (display: string) => void;

  constructor(total: number, options: Partial<ProgressDisplayOptions> = {}) {
    this.total = total;
    this.startTime = new Date();

    this.displayOptions = {
      showMemoryUsage: true,
      showPerformanceMetrics: true,
      showDetailedTiming: true,
      updateInterval: 500, // 500ms
      barWidth: 40,
      useColors: true,
      ...options,
    };
  }

  /**
   * プログレスコールバックを設定
   */
  setProgressCallback(
    callback: (progress: EnhancedProgressInfo) => void
  ): void {
    this.progressCallback = callback;
  }

  /**
   * 表示コールバックを設定
   */
  setDisplayCallback(callback: (display: string) => void): void {
    this.displayCallback = callback;
  }

  /**
   * プログレスを更新
   */
  update(
    current: number,
    currentItem: string = "",
    stage: string = "",
    isSuccess?: boolean,
    isRetry?: boolean
  ): void {
    const now = Date.now();
    const itemStartTime = this.lastUpdateTime || now;

    // 統計更新
    if (current > this.current) {
      const itemTime = now - itemStartTime;
      this.itemTimes.push(itemTime);

      // 最新100件のみ保持
      if (this.itemTimes.length > 100) {
        this.itemTimes.shift();
      }
    }

    // 状態更新
    this.current = current;
    this.currentItem = currentItem;
    this.stage = stage;

    if (isSuccess === true) {
      this.successCount++;
    } else if (isSuccess === false) {
      this.failureCount++;
    }

    if (isRetry) {
      this.retryCount++;
    }

    this.lastUpdateTime = now;

    // 表示更新（間隔制御）
    if (now - this.lastDisplayTime >= this.displayOptions.updateInterval) {
      this.updateDisplay();
      this.lastDisplayTime = now;
    }
  }

  /**
   * 成功をカウント
   */
  incrementSuccess(): void {
    this.successCount++;
  }

  /**
   * 失敗をカウント
   */
  incrementFailure(): void {
    this.failureCount++;
  }

  /**
   * リトライをカウント
   */
  incrementRetry(): void {
    this.retryCount++;
  }

  /**
   * 現在のプログレス情報を取得
   */
  getProgressInfo(): EnhancedProgressInfo {
    const now = Date.now();
    const elapsedTime = now - this.startTime.getTime();
    const percentage =
      this.total > 0 ? Math.round((this.current / this.total) * 100) : 0;

    // パフォーマンス計算
    const averageItemTime =
      this.itemTimes.length > 0
        ? this.itemTimes.reduce((sum, time) => sum + time, 0) /
          this.itemTimes.length
        : 0;

    const itemsPerSecond =
      elapsedTime > 0 ? (this.current * 1000) / elapsedTime : 0;

    // 残り時間推定
    let estimatedTimeRemaining: number | undefined;
    let estimatedCompletionTime: Date | undefined;

    if (this.current > 0 && this.current < this.total && averageItemTime > 0) {
      const remainingItems = this.total - this.current;
      estimatedTimeRemaining = remainingItems * averageItemTime;
      estimatedCompletionTime = new Date(now + estimatedTimeRemaining);
    }

    // メモリ使用量
    let memoryUsage: EnhancedProgressInfo["memoryUsage"];
    if (this.displayOptions.showMemoryUsage) {
      const memUsage = process.memoryUsage();
      memoryUsage = {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
      };
    }

    return {
      current: this.current,
      total: this.total,
      percentage,
      currentItem: this.currentItem,
      stage: this.stage,
      startTime: this.startTime,
      elapsedTime,
      estimatedTimeRemaining,
      estimatedCompletionTime,
      itemsPerSecond,
      averageItemTime,
      successCount: this.successCount,
      failureCount: this.failureCount,
      retryCount: this.retryCount,
      memoryUsage,
    };
  }

  /**
   * 表示を更新
   */
  private updateDisplay(): void {
    const progress = this.getProgressInfo();

    // コールバック実行
    if (this.progressCallback) {
      this.progressCallback(progress);
    }

    // 表示文字列生成
    const displayString = this.generateDisplayString(progress);

    if (this.displayCallback) {
      this.displayCallback(displayString);
    } else {
      // デフォルトのコンソール表示
      console.log(displayString);
    }
  }

  /**
   * 表示文字列を生成
   */
  private generateDisplayString(progress: EnhancedProgressInfo): string {
    const { useColors } = this.displayOptions;

    // プログレスバー
    const progressBar = this.generateProgressBar(progress.percentage);

    // 基本情報
    let display = `${progressBar} ${progress.percentage}% (${progress.current}/${progress.total})`;

    // 現在のアイテムとステージ
    if (progress.currentItem) {
      display += ` | ${progress.currentItem}`;
    }
    if (progress.stage) {
      display += ` | ${progress.stage}`;
    }

    // 時間情報
    if (this.displayOptions.showDetailedTiming) {
      const elapsed = this.formatDuration(progress.elapsedTime);
      display += ` | 経過: ${elapsed}`;

      if (progress.estimatedTimeRemaining) {
        const remaining = this.formatDuration(progress.estimatedTimeRemaining);
        display += ` | 残り: ${remaining}`;
      }

      if (progress.estimatedCompletionTime) {
        const completion =
          progress.estimatedCompletionTime.toLocaleTimeString();
        display += ` | 完了予定: ${completion}`;
      }
    }

    // パフォーマンス情報
    if (this.displayOptions.showPerformanceMetrics) {
      display += ` | ${progress.itemsPerSecond.toFixed(1)} items/sec`;

      if (progress.averageItemTime > 0) {
        display += ` | 平均: ${Math.round(progress.averageItemTime)}ms`;
      }
    }

    // 統計情報
    if (progress.successCount > 0 || progress.failureCount > 0) {
      const successColor = useColors ? "\x1b[32m" : "";
      const failureColor = useColors ? "\x1b[31m" : "";
      const resetColor = useColors ? "\x1b[0m" : "";

      display += ` | ${successColor}✓${progress.successCount}${resetColor}`;

      if (progress.failureCount > 0) {
        display += ` ${failureColor}✗${progress.failureCount}${resetColor}`;
      }

      if (progress.retryCount > 0) {
        display += ` 🔄${progress.retryCount}`;
      }
    }

    // メモリ使用量
    if (this.displayOptions.showMemoryUsage && progress.memoryUsage) {
      const memUsage = this.formatBytes(progress.memoryUsage.heapUsed);
      display += ` | Mem: ${memUsage}`;
    }

    return display;
  }

  /**
   * プログレスバーを生成
   */
  private generateProgressBar(percentage: number): string {
    const { barWidth, useColors } = this.displayOptions;
    const filled = Math.round((percentage / 100) * barWidth);
    const empty = barWidth - filled;

    const filledChar = "█";
    const emptyChar = "░";

    let bar = "[";
    bar += filledChar.repeat(filled);
    bar += emptyChar.repeat(empty);
    bar += "]";

    if (useColors) {
      // 進捗に応じて色を変更
      let color = "\x1b[31m"; // 赤
      if (percentage >= 75) {
        color = "\x1b[32m"; // 緑
      } else if (percentage >= 50) {
        color = "\x1b[33m"; // 黄
      } else if (percentage >= 25) {
        color = "\x1b[36m"; // シアン
      }

      bar = `${color}${bar}\x1b[0m`;
    }

    return bar;
  }

  /**
   * 最終統計を表示
   */
  displayFinalStatistics(): void {
    const progress = this.getProgressInfo();
    const successRate =
      progress.total > 0
        ? Math.round((progress.successCount / progress.total) * 100)
        : 0;

    console.log(`\n📊 === 処理完了統計 ===`);
    console.log(`総処理数: ${progress.total}`);
    console.log(`成功: ${progress.successCount}`);
    console.log(`失敗: ${progress.failureCount}`);
    console.log(`リトライ: ${progress.retryCount}`);
    console.log(`成功率: ${successRate}%`);
    console.log(`総実行時間: ${this.formatDuration(progress.elapsedTime)}`);
    console.log(`平均処理時間: ${Math.round(progress.averageItemTime)}ms/item`);
    console.log(
      `スループット: ${progress.itemsPerSecond.toFixed(2)} items/sec`
    );

    if (progress.memoryUsage) {
      console.log(
        `最終メモリ使用量: ${this.formatBytes(progress.memoryUsage.heapUsed)}`
      );
    }

    console.log(`========================\n`);
  }

  /**
   * 統計レポートを生成
   */
  generateStatisticsReport(): string {
    const progress = this.getProgressInfo();
    const successRate =
      progress.total > 0 ? (progress.successCount / progress.total) * 100 : 0;

    let report = `# プログレス統計レポート\n\n`;
    report += `## 基本統計\n`;
    report += `- 総処理数: ${progress.total}\n`;
    report += `- 完了数: ${progress.current}\n`;
    report += `- 成功数: ${progress.successCount}\n`;
    report += `- 失敗数: ${progress.failureCount}\n`;
    report += `- リトライ数: ${progress.retryCount}\n`;
    report += `- 成功率: ${Math.round(successRate)}%\n\n`;

    report += `## パフォーマンス\n`;
    report += `- 総実行時間: ${this.formatDuration(progress.elapsedTime)}\n`;
    report += `- 平均処理時間: ${Math.round(
      progress.averageItemTime
    )}ms/item\n`;
    report += `- スループット: ${progress.itemsPerSecond.toFixed(
      2
    )} items/sec\n\n`;

    if (progress.memoryUsage) {
      report += `## メモリ使用量\n`;
      report += `- ヒープ使用量: ${this.formatBytes(
        progress.memoryUsage.heapUsed
      )}\n`;
      report += `- ヒープ総量: ${this.formatBytes(
        progress.memoryUsage.heapTotal
      )}\n`;
      report += `- 外部メモリ: ${this.formatBytes(
        progress.memoryUsage.external
      )}\n\n`;
    }

    if (this.itemTimes.length > 0) {
      const minTime = Math.min(...this.itemTimes);
      const maxTime = Math.max(...this.itemTimes);
      const medianTime = this.calculateMedian(this.itemTimes);

      report += `## 処理時間分析\n`;
      report += `- 最短時間: ${minTime}ms\n`;
      report += `- 最長時間: ${maxTime}ms\n`;
      report += `- 中央値: ${Math.round(medianTime)}ms\n`;
      report += `- サンプル数: ${this.itemTimes.length}\n\n`;
    }

    return report;
  }

  /**
   * 中央値を計算
   */
  private calculateMedian(numbers: number[]): number {
    const sorted = [...numbers].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    } else {
      return sorted[middle];
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
   * クリーンアップ
   */
  cleanup(): void {
    this.itemTimes.length = 0;
    this.progressCallback = undefined;
    this.displayCallback = undefined;
  }
}
