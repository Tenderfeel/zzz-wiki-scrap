/**
 * メモリスナップショット
 */
export interface MemorySnapshot {
  timestamp: Date;
  used: number;
  total: number;
  external: number;
  heapUsed: number;
  heapTotal: number;
  processCount: number;
}

/**
 * メモリ最適化ユーティリティ
 * メモリ使用量の監視と最適化機能を提供
 */
export class MemoryOptimizer {
  private static readonly MB = 1024 * 1024;
  private static readonly MEMORY_THRESHOLD = 100 * MemoryOptimizer.MB; // 100MB
  private static readonly GC_INTERVAL = 10; // 10回の処理ごとにGCを促す

  private processCount = 0;
  private memorySnapshots: MemorySnapshot[] = [];

  /**
   * 現在のメモリ使用量を取得
   */
  getCurrentMemoryUsage(): MemorySnapshot {
    const memUsage = process.memoryUsage();
    return {
      timestamp: new Date(),
      used: memUsage.rss,
      total: memUsage.rss + memUsage.external,
      external: memUsage.external,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      processCount: this.processCount,
    };
  }

  /**
   * メモリ使用量を監視し、必要に応じて最適化を実行
   */
  monitorAndOptimize(): void {
    this.processCount++;
    const currentUsage = this.getCurrentMemoryUsage();
    this.memorySnapshots.push(currentUsage);

    // メモリ使用量が閾値を超えた場合の警告
    if (currentUsage.heapUsed > MemoryOptimizer.MEMORY_THRESHOLD) {
      console.warn(
        `⚠️  メモリ使用量が閾値を超過: ${this.formatBytes(
          currentUsage.heapUsed
        )} / ${this.formatBytes(MemoryOptimizer.MEMORY_THRESHOLD)}`
      );
      this.forceGarbageCollection();
    }

    // 定期的なガベージコレクション
    if (this.processCount % MemoryOptimizer.GC_INTERVAL === 0) {
      this.forceGarbageCollection();
    }

    // 古いスナップショットを削除（最新の50個のみ保持）
    if (this.memorySnapshots.length > 50) {
      this.memorySnapshots = this.memorySnapshots.slice(-50);
    }
  }

  /**
   * ガベージコレクションを強制実行
   */
  private forceGarbageCollection(): void {
    if (global.gc) {
      const beforeGC = this.getCurrentMemoryUsage();
      global.gc();
      const afterGC = this.getCurrentMemoryUsage();

      const memoryFreed = beforeGC.heapUsed - afterGC.heapUsed;
      if (memoryFreed > 0) {
        console.log(
          `🧹 ガベージコレクション実行: ${this.formatBytes(memoryFreed)} 解放`
        );
      }
    }
  }

  /**
   * メモリ使用量の統計を取得
   */
  getMemoryStatistics(): {
    current: MemorySnapshot;
    peak: MemorySnapshot;
    average: number;
    trend: "increasing" | "decreasing" | "stable";
  } {
    if (this.memorySnapshots.length === 0) {
      const current = this.getCurrentMemoryUsage();
      return {
        current,
        peak: current,
        average: current.heapUsed,
        trend: "stable",
      };
    }

    const current = this.memorySnapshots[this.memorySnapshots.length - 1];
    const peak = this.memorySnapshots.reduce((max, snapshot) =>
      snapshot.heapUsed > max.heapUsed ? snapshot : max
    );

    const average =
      this.memorySnapshots.reduce(
        (sum, snapshot) => sum + snapshot.heapUsed,
        0
      ) / this.memorySnapshots.length;

    // トレンド分析（最新10個のスナップショットを使用）
    const recentSnapshots = this.memorySnapshots.slice(-10);
    let trend: "increasing" | "decreasing" | "stable" = "stable";

    if (recentSnapshots.length >= 3) {
      const firstHalf = recentSnapshots.slice(
        0,
        Math.floor(recentSnapshots.length / 2)
      );
      const secondHalf = recentSnapshots.slice(
        Math.floor(recentSnapshots.length / 2)
      );

      const firstAvg =
        firstHalf.reduce((sum, s) => sum + s.heapUsed, 0) / firstHalf.length;
      const secondAvg =
        secondHalf.reduce((sum, s) => sum + s.heapUsed, 0) / secondHalf.length;

      const difference = secondAvg - firstAvg;
      const threshold = average * 0.1; // 10%の変化を閾値とする

      if (difference > threshold) {
        trend = "increasing";
      } else if (difference < -threshold) {
        trend = "decreasing";
      }
    }

    return { current, peak, average, trend };
  }

  /**
   * メモリ使用量レポートを生成
   */
  generateMemoryReport(): string {
    const stats = this.getMemoryStatistics();

    let report = `# メモリ使用量レポート\n\n`;
    report += `## 現在の状況\n`;
    report += `- 現在のヒープ使用量: ${this.formatBytes(
      stats.current.heapUsed
    )}\n`;
    report += `- 現在の総メモリ使用量: ${this.formatBytes(
      stats.current.used
    )}\n`;
    report += `- ピーク使用量: ${this.formatBytes(stats.peak.heapUsed)}\n`;
    report += `- 平均使用量: ${this.formatBytes(stats.average)}\n`;
    report += `- 使用量トレンド: ${this.getTrendEmoji(stats.trend)} ${
      stats.trend
    }\n`;
    report += `- 処理回数: ${this.processCount}\n\n`;

    report += `## 最適化の推奨事項\n`;
    if (stats.trend === "increasing") {
      report += `- ⚠️  メモリ使用量が増加傾向にあります\n`;
      report += `- バッチサイズの削減を検討してください\n`;
      report += `- より頻繁なガベージコレクションが必要かもしれません\n`;
    } else if (stats.current.heapUsed > MemoryOptimizer.MEMORY_THRESHOLD) {
      report += `- ⚠️  メモリ使用量が閾値を超過しています\n`;
      report += `- 処理の一時停止とメモリ解放を検討してください\n`;
    } else {
      report += `- ✅ メモリ使用量は正常範囲内です\n`;
    }

    return report;
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
   * トレンドに対応する絵文字を取得
   */
  private getTrendEmoji(trend: "increasing" | "decreasing" | "stable"): string {
    switch (trend) {
      case "increasing":
        return "📈";
      case "decreasing":
        return "📉";
      case "stable":
        return "📊";
    }
  }

  /**
   * メモリ最適化のクリーンアップ
   */
  cleanup(): void {
    this.memorySnapshots = [];
    this.processCount = 0;
    this.forceGarbageCollection();
  }
}
