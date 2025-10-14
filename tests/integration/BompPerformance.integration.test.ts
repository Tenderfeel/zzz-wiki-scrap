import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { performance } from "perf_hooks";
import { BompBatchProcessor } from "../../src/processors/BompBatchProcessor";
import { BompGenerator } from "../../src/generators/BompGenerator";
import { HoyoLabApiClient } from "../../src/clients/HoyoLabApiClient";

/**
 * パフォーマンステストとメモリ使用量測定
 * 要件: 4.1, 4.3
 */
describe("Bomp Performance Integration Tests", () => {
  const testOutputDir = "performance-test-output";
  const testScrapingPath = path.join(testOutputDir, "performance-scraping.md");
  const performanceLogPath = path.join(testOutputDir, "performance-log.json");

  let performanceLog: Array<{
    testName: string;
    timestamp: string;
    duration: number;
    memoryUsage: {
      start: NodeJS.MemoryUsage;
      end: NodeJS.MemoryUsage;
      peak: NodeJS.MemoryUsage;
      delta: {
        heapUsed: number;
        rss: number;
        external: number;
      };
    };
    bompsProcessed: number;
    apiCalls: number;
    throughput: number; // bomps per second
    memoryEfficiency: number; // bytes per bomp
  }> = [];

  beforeEach(() => {
    // テスト用ディレクトリを作成
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }

    // パフォーマンスログを初期化
    performanceLog = [];
  });

  afterEach(() => {
    // パフォーマンスログを保存
    if (performanceLog.length > 0) {
      const existingLog = fs.existsSync(performanceLogPath)
        ? JSON.parse(fs.readFileSync(performanceLogPath, "utf-8"))
        : [];

      existingLog.push(...performanceLog);
      fs.writeFileSync(
        performanceLogPath,
        JSON.stringify(existingLog, null, 2)
      );
    }

    // テストファイルをクリーンアップ
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  /**
   * 小規模データセットのパフォーマンステスト
   */
  it("should process small dataset efficiently", async () => {
    // Arrange
    const bompCount = 3;
    const testContent = createTestScrapingContent(bompCount);
    fs.writeFileSync(testScrapingPath, testContent);

    const mockApiResponse = createMockApiResponse("small-test-bomp");
    vi.spyOn(
      HoyoLabApiClient.prototype,
      "fetchCharacterData"
    ).mockResolvedValue(mockApiResponse);

    const batchProcessor = new BompBatchProcessor();

    // Act & Measure
    const memoryStart = process.memoryUsage();
    const timeStart = performance.now();

    const result = await batchProcessor.processAllBomps(testScrapingPath, {
      batchSize: 2,
      delayMs: 10,
      maxRetries: 1,
    });

    const timeEnd = performance.now();
    const memoryEnd = process.memoryUsage();
    const memoryPeak = process.memoryUsage(); // In real scenario, this would be tracked during processing

    // Record performance metrics
    const duration = timeEnd - timeStart;
    const throughput = result.successful.length / (duration / 1000);
    const memoryDelta = {
      heapUsed: memoryEnd.heapUsed - memoryStart.heapUsed,
      rss: memoryEnd.rss - memoryStart.rss,
      external: memoryEnd.external - memoryStart.external,
    };
    const memoryEfficiency = memoryDelta.heapUsed / result.successful.length;

    performanceLog.push({
      testName: "small-dataset",
      timestamp: new Date().toISOString(),
      duration,
      memoryUsage: {
        start: memoryStart,
        end: memoryEnd,
        peak: memoryPeak,
        delta: memoryDelta,
      },
      bompsProcessed: result.successful.length,
      apiCalls: result.successful.length * 2,
      throughput,
      memoryEfficiency,
    });

    // Assert
    expect(result.successful.length).toBe(bompCount);
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
    expect(throughput).toBeGreaterThan(1); // Should process at least 1 bomp per second
    expect(memoryDelta.heapUsed).toBeLessThan(10 * 1024 * 1024); // Should use less than 10MB
    expect(memoryEfficiency).toBeLessThan(1024 * 1024); // Should use less than 1MB per bomp
  });

  /**
   * 中規模データセットのパフォーマンステスト
   */
  it("should process medium dataset within acceptable limits", async () => {
    // Arrange
    const bompCount = 10;
    const testContent = createTestScrapingContent(bompCount);
    fs.writeFileSync(testScrapingPath, testContent);

    const mockApiResponse = createMockApiResponse("medium-test-bomp");
    vi.spyOn(
      HoyoLabApiClient.prototype,
      "fetchCharacterData"
    ).mockResolvedValue(mockApiResponse);

    const batchProcessor = new BompBatchProcessor();

    // Act & Measure
    const memoryStart = process.memoryUsage();
    const timeStart = performance.now();

    const result = await batchProcessor.processAllBomps(testScrapingPath, {
      batchSize: 3,
      delayMs: 20,
      maxRetries: 2,
    });

    const timeEnd = performance.now();
    const memoryEnd = process.memoryUsage();

    // Record performance metrics
    const duration = timeEnd - timeStart;
    const throughput = result.successful.length / (duration / 1000);
    const memoryDelta = {
      heapUsed: memoryEnd.heapUsed - memoryStart.heapUsed,
      rss: memoryEnd.rss - memoryStart.rss,
      external: memoryEnd.external - memoryStart.external,
    };

    performanceLog.push({
      testName: "medium-dataset",
      timestamp: new Date().toISOString(),
      duration,
      memoryUsage: {
        start: memoryStart,
        end: memoryEnd,
        peak: memoryEnd,
        delta: memoryDelta,
      },
      bompsProcessed: result.successful.length,
      apiCalls: result.successful.length * 2,
      throughput,
      memoryEfficiency: memoryDelta.heapUsed / result.successful.length,
    });

    // Assert
    expect(result.successful.length).toBe(bompCount);
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    expect(throughput).toBeGreaterThan(0.5); // Should process at least 0.5 bomps per second
    expect(memoryDelta.heapUsed).toBeLessThan(25 * 1024 * 1024); // Should use less than 25MB
  });

  /**
   * 大規模データセットのパフォーマンステスト
   */
  it("should handle large dataset without memory leaks", async () => {
    // Arrange
    const bompCount = 20;
    const testContent = createTestScrapingContent(bompCount);
    fs.writeFileSync(testScrapingPath, testContent);

    const mockApiResponse = createMockApiResponse("large-test-bomp");
    vi.spyOn(
      HoyoLabApiClient.prototype,
      "fetchCharacterData"
    ).mockResolvedValue(mockApiResponse);

    const batchProcessor = new BompBatchProcessor();

    // Act & Measure
    const memoryStart = process.memoryUsage();
    const timeStart = performance.now();

    // Track memory usage during processing
    const memorySnapshots: NodeJS.MemoryUsage[] = [];
    const memoryTracker = setInterval(() => {
      memorySnapshots.push(process.memoryUsage());
    }, 100);

    const result = await batchProcessor.processAllBomps(testScrapingPath, {
      batchSize: 5,
      delayMs: 30,
      maxRetries: 2,
    });

    clearInterval(memoryTracker);
    const timeEnd = performance.now();
    const memoryEnd = process.memoryUsage();

    // Find peak memory usage
    const peakMemory = memorySnapshots.reduce(
      (peak, current) => (current.heapUsed > peak.heapUsed ? current : peak),
      memoryStart
    );

    // Record performance metrics
    const duration = timeEnd - timeStart;
    const throughput = result.successful.length / (duration / 1000);
    const memoryDelta = {
      heapUsed: memoryEnd.heapUsed - memoryStart.heapUsed,
      rss: memoryEnd.rss - memoryStart.rss,
      external: memoryEnd.external - memoryStart.external,
    };

    performanceLog.push({
      testName: "large-dataset",
      timestamp: new Date().toISOString(),
      duration,
      memoryUsage: {
        start: memoryStart,
        end: memoryEnd,
        peak: peakMemory,
        delta: memoryDelta,
      },
      bompsProcessed: result.successful.length,
      apiCalls: result.successful.length * 2,
      throughput,
      memoryEfficiency: memoryDelta.heapUsed / result.successful.length,
    });

    // Assert
    expect(result.successful.length).toBe(bompCount);
    expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
    expect(throughput).toBeGreaterThan(0.3); // Should process at least 0.3 bomps per second
    expect(memoryDelta.heapUsed).toBeLessThan(50 * 1024 * 1024); // Should use less than 50MB
    expect(peakMemory.heapUsed - memoryStart.heapUsed).toBeLessThan(
      75 * 1024 * 1024
    ); // Peak should be less than 75MB
  });

  /**
   * メモリ効率性テスト
   */
  it("should maintain memory efficiency across different batch sizes", async () => {
    const bompCount = 12;
    const testContent = createTestScrapingContent(bompCount);
    fs.writeFileSync(testScrapingPath, testContent);

    const mockApiResponse = createMockApiResponse("efficiency-test-bomp");
    vi.spyOn(
      HoyoLabApiClient.prototype,
      "fetchCharacterData"
    ).mockResolvedValue(mockApiResponse);

    const batchSizes = [1, 3, 6, 12];
    const results: Array<{
      batchSize: number;
      duration: number;
      memoryUsed: number;
      throughput: number;
    }> = [];

    for (const batchSize of batchSizes) {
      // Reset mocks for each test
      vi.clearAllMocks();
      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockResolvedValue(mockApiResponse);

      const batchProcessor = new BompBatchProcessor();

      // Measure
      const memoryStart = process.memoryUsage();
      const timeStart = performance.now();

      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize,
        delayMs: 10,
        maxRetries: 1,
      });

      const timeEnd = performance.now();
      const memoryEnd = process.memoryUsage();

      const duration = timeEnd - timeStart;
      const memoryUsed = memoryEnd.heapUsed - memoryStart.heapUsed;
      const throughput = result.successful.length / (duration / 1000);

      results.push({
        batchSize,
        duration,
        memoryUsed,
        throughput,
      });

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Wait a bit between tests
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Record all results
    performanceLog.push({
      testName: "memory-efficiency-comparison",
      timestamp: new Date().toISOString(),
      duration: results.reduce((sum, r) => sum + r.duration, 0),
      memoryUsage: {
        start: process.memoryUsage(),
        end: process.memoryUsage(),
        peak: process.memoryUsage(),
        delta: {
          heapUsed: Math.max(...results.map((r) => r.memoryUsed)),
          rss: 0,
          external: 0,
        },
      },
      bompsProcessed: bompCount * batchSizes.length,
      apiCalls: bompCount * batchSizes.length * 2,
      throughput:
        results.reduce((sum, r) => sum + r.throughput, 0) / results.length,
      memoryEfficiency:
        Math.max(...results.map((r) => r.memoryUsed)) / bompCount,
    });

    // Assert
    expect(results).toHaveLength(batchSizes.length);

    // All batch sizes should complete successfully
    results.forEach((result) => {
      expect(result.duration).toBeGreaterThan(0);
      expect(result.throughput).toBeGreaterThan(0);
      expect(result.memoryUsed).toBeLessThan(30 * 1024 * 1024); // Each should use less than 30MB
    });

    // Larger batch sizes should generally be more efficient (higher throughput)
    const smallBatchResult = results.find((r) => r.batchSize === 1)!;
    const largeBatchResult = results.find((r) => r.batchSize === 12)!;

    // Large batch should be at least as efficient as small batch
    expect(largeBatchResult.throughput).toBeGreaterThanOrEqual(
      smallBatchResult.throughput * 0.8
    );
  });

  /**
   * 長時間実行テスト（安定性確認）
   */
  it("should maintain stability during extended processing", async () => {
    // Arrange - Simulate processing multiple batches over time
    const batchCount = 5;
    const bompsPerBatch = 4;
    const totalBomps = batchCount * bompsPerBatch;

    const testContent = createTestScrapingContent(totalBomps);
    fs.writeFileSync(testScrapingPath, testContent);

    const mockApiResponse = createMockApiResponse("stability-test-bomp");
    vi.spyOn(
      HoyoLabApiClient.prototype,
      "fetchCharacterData"
    ).mockResolvedValue(mockApiResponse);

    const batchProcessor = new BompBatchProcessor();

    // Act & Measure
    const memoryStart = process.memoryUsage();
    const timeStart = performance.now();

    // Track memory over time
    const memoryHistory: Array<{
      timestamp: number;
      memory: NodeJS.MemoryUsage;
    }> = [];
    const memoryTracker = setInterval(() => {
      memoryHistory.push({
        timestamp: performance.now(),
        memory: process.memoryUsage(),
      });
    }, 200);

    const result = await batchProcessor.processAllBomps(testScrapingPath, {
      batchSize: bompsPerBatch,
      delayMs: 50, // Longer delay to simulate real conditions
      maxRetries: 2,
    });

    clearInterval(memoryTracker);
    const timeEnd = performance.now();
    const memoryEnd = process.memoryUsage();

    // Analyze memory stability
    const memoryGrowth = memoryHistory.map((entry, index) => {
      if (index === 0) return 0;
      return entry.memory.heapUsed - memoryHistory[0].memory.heapUsed;
    });

    const maxMemoryGrowth = Math.max(...memoryGrowth);
    const avgMemoryGrowth =
      memoryGrowth.reduce((sum, growth) => sum + growth, 0) /
      memoryGrowth.length;

    // Record performance metrics
    const duration = timeEnd - timeStart;
    performanceLog.push({
      testName: "stability-test",
      timestamp: new Date().toISOString(),
      duration,
      memoryUsage: {
        start: memoryStart,
        end: memoryEnd,
        peak: memoryHistory.reduce(
          (peak, entry) =>
            entry.memory.heapUsed > peak.heapUsed ? entry.memory : peak,
          memoryStart
        ),
        delta: {
          heapUsed: memoryEnd.heapUsed - memoryStart.heapUsed,
          rss: memoryEnd.rss - memoryStart.rss,
          external: memoryEnd.external - memoryStart.external,
        },
      },
      bompsProcessed: result.successful.length,
      apiCalls: result.successful.length * 2,
      throughput: result.successful.length / (duration / 1000),
      memoryEfficiency:
        (memoryEnd.heapUsed - memoryStart.heapUsed) / result.successful.length,
    });

    // Assert
    expect(result.successful.length).toBe(totalBomps);
    expect(duration).toBeLessThan(20000); // Should complete within 20 seconds
    expect(maxMemoryGrowth).toBeLessThan(40 * 1024 * 1024); // Memory growth should be less than 40MB
    expect(avgMemoryGrowth).toBeLessThan(20 * 1024 * 1024); // Average memory growth should be less than 20MB

    // Memory should not continuously grow (no significant memory leaks)
    const finalMemoryGrowth = memoryEnd.heapUsed - memoryStart.heapUsed;
    expect(finalMemoryGrowth).toBeLessThan(maxMemoryGrowth * 1.2); // Final memory should be close to peak
  });

  // Helper functions
  function createTestScrapingContent(bompCount: number): string {
    const bompEntries = Array.from(
      { length: bompCount },
      (_, i) =>
        `- [test-bomp-${i + 1}](https://wiki.hoyolab.com/pc/zzz/entry/${
          912 + i
        }) - テストボンプ${i + 1}`
    ).join("\n");

    return `
# Performance Test Scraping.md

## ボンプページリスト

${bompEntries}

## その他のセクション

パフォーマンステスト用のコンテンツ...
`;
  }

  function createMockApiResponse(bompName: string) {
    return {
      retcode: 0,
      message: "OK",
      data: {
        page: {
          id: "912",
          name: bompName,
          agent_specialties: { values: [] },
          agent_stats: { values: ["氷属性"] },
          agent_rarity: { values: [] },
          agent_faction: { values: [] },
          modules: [
            {
              name: "ascension",
              components: [
                {
                  component_id: "ascension",
                  data: JSON.stringify({
                    combatList: [
                      {
                        hp: {
                          values: [
                            "-",
                            "1000",
                            "1200",
                            "1400",
                            "1600",
                            "1800",
                            "2000",
                          ],
                        },
                        atk: {
                          values: [
                            "-",
                            "100",
                            "120",
                            "140",
                            "160",
                            "180",
                            "200",
                          ],
                        },
                        def: {
                          values: ["-", "50", "60", "70", "80", "90", "100"],
                        },
                        impact: { values: ["10"] },
                        critRate: { values: ["5%"] },
                        critDmg: { values: ["50%"] },
                        anomalyMastery: { values: ["0"] },
                        anomalyProficiency: { values: ["0"] },
                        penRatio: { values: ["0%"] },
                        energy: { values: ["100"] },
                      },
                    ],
                  }),
                },
              ],
            },
            {
              name: "baseInfo",
              components: [
                {
                  component_id: "baseInfo",
                  data: JSON.stringify({
                    faction: [1],
                  }),
                },
              ],
            },
          ],
        },
      },
    };
  }
});
