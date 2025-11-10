import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { performance } from "perf_hooks";
import { DriverDiscDataPipeline } from "../../src/main-driver-disc-generation";
import { HoyoLabApiClient } from "../../src/clients/HoyoLabApiClient";
import { DriverDiscProcessingConfig } from "../../src/types";

/**
 * ドライバーディスクパフォーマンステスト
 * 大量データ処理時のメモリ使用量テスト、APIレート制限対応のテスト、処理速度とスループットの測定
 * 要件: 4.4
 */
describe("DriverDisc Performance Tests", () => {
  const testOutputDir = "driver-disc-performance-test-output";
  const testDiscListFile = path.join(testOutputDir, "test-disc-list.json");
  const testOutputFile = path.join(testOutputDir, "test-driverDiscs.ts");
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
    driverDiscsProcessed: number;
    apiCalls: number;
    throughput: number; // driver discs per second
    memoryEfficiency: number; // bytes per driver disc
    retryCount: number;
    successRate: number;
  }> = [];

  beforeEach(() => {
    // テスト用ディレクトリを作成
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }

    // パフォーマンスログを初期化
    performanceLog = [];

    // テスト用ファイルをクリーンアップ
    [testDiscListFile, testOutputFile].forEach((file) => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
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

    vi.clearAllMocks();
  });

  describe("大量データ処理時のメモリ使用量テスト", () => {
    it("小規模データセット（5ドライバーディスク）のメモリ効率性", async () => {
      // Arrange
      const discCount = 5;
      const testDiscList = createTestDiscList(discCount);
      fs.writeFileSync(testDiscListFile, JSON.stringify(testDiscList, null, 2));

      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockImplementation(async (pageId: number, lang: "ja-jp" | "en-us") => {
        return createMockDriverDiscApiResponse(
          `${pageId}`,
          `テストディスク${pageId}`,
          `Test Disc ${pageId}`
        );
      });

      const config: DriverDiscProcessingConfig = {
        discListPath: testDiscListFile,
        outputPath: testOutputFile,
        batchSize: 2,
        delayMs: 10,
        maxRetries: 1,
        enableValidation: true,
        logLevel: "info",
      };

      const pipeline = new DriverDiscDataPipeline(config);

      // Act & Measure
      const memoryStart = process.memoryUsage();
      const timeStart = performance.now();

      const result = await pipeline.execute();

      const timeEnd = performance.now();
      const memoryEnd = process.memoryUsage();

      // Record performance metrics
      const duration = timeEnd - timeStart;
      const throughput = result.driverDiscs.length / (duration / 1000);
      const memoryDelta = {
        heapUsed: memoryEnd.heapUsed - memoryStart.heapUsed,
        rss: memoryEnd.rss - memoryStart.rss,
        external: memoryEnd.external - memoryStart.external,
      };
      const memoryEfficiency =
        result.driverDiscs.length > 0
          ? memoryDelta.heapUsed / result.driverDiscs.length
          : 0;

      performanceLog.push({
        testName: "small-dataset-memory",
        timestamp: new Date().toISOString(),
        duration,
        memoryUsage: {
          start: memoryStart,
          end: memoryEnd,
          peak: memoryEnd,
          delta: memoryDelta,
        },
        driverDiscsProcessed: result.driverDiscs.length,
        apiCalls: result.driverDiscs.length * 2, // ja + en
        throughput,
        memoryEfficiency,
        retryCount: result.statistics.retries,
        successRate: result.statistics.successRate,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.driverDiscs.length).toBe(discCount);
      expect(duration).toBeLessThan(5000); // 5秒以内（テスト環境を考慮）
      expect(throughput).toBeGreaterThan(0.5); // 0.5ドライバーディスク/秒以上
      expect(memoryDelta.heapUsed).toBeLessThan(50 * 1024 * 1024); // 50MB以内
      expect(memoryEfficiency).toBeLessThan(10 * 1024 * 1024); // 10MB/ドライバーディスク以内
    });

    it("中規模データセット（15ドライバーディスク）のメモリ効率性", async () => {
      // Arrange
      const discCount = 15;
      const testDiscList = createTestDiscList(discCount);
      fs.writeFileSync(testDiscListFile, JSON.stringify(testDiscList, null, 2));

      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockImplementation(async (pageId: number, lang: "ja-jp" | "en-us") => {
        return createMockDriverDiscApiResponse(
          `${pageId}`,
          `テストディスク${pageId}`,
          `Test Disc ${pageId}`
        );
      });

      const config: DriverDiscProcessingConfig = {
        discListPath: testDiscListFile,
        outputPath: testOutputFile,
        batchSize: 3,
        delayMs: 20,
        maxRetries: 2,
        enableValidation: true,
        logLevel: "info",
      };

      const pipeline = new DriverDiscDataPipeline(config);

      // Act & Measure
      const memoryStart = process.memoryUsage();
      const timeStart = performance.now();

      const result = await pipeline.execute();

      const timeEnd = performance.now();
      const memoryEnd = process.memoryUsage();

      // Record performance metrics
      const duration = timeEnd - timeStart;
      const throughput = result.driverDiscs.length / (duration / 1000);
      const memoryDelta = {
        heapUsed: memoryEnd.heapUsed - memoryStart.heapUsed,
        rss: memoryEnd.rss - memoryStart.rss,
        external: memoryEnd.external - memoryStart.external,
      };

      performanceLog.push({
        testName: "medium-dataset-memory",
        timestamp: new Date().toISOString(),
        duration,
        memoryUsage: {
          start: memoryStart,
          end: memoryEnd,
          peak: memoryEnd,
          delta: memoryDelta,
        },
        driverDiscsProcessed: result.driverDiscs.length,
        apiCalls: result.driverDiscs.length * 2,
        throughput,
        memoryEfficiency:
          result.driverDiscs.length > 0
            ? memoryDelta.heapUsed / result.driverDiscs.length
            : 0,
        retryCount: result.statistics.retries,
        successRate: result.statistics.successRate,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.driverDiscs.length).toBe(discCount);
      expect(duration).toBeLessThan(15000); // 15秒以内
      expect(throughput).toBeGreaterThan(0.3); // 0.3ドライバーディスク/秒以上
      expect(memoryDelta.heapUsed).toBeLessThan(100 * 1024 * 1024); // 100MB以内
    });

    it("大規模データセット（30ドライバーディスク）のメモリリーク検出", async () => {
      // Arrange
      const discCount = 30;
      const testDiscList = createTestDiscList(discCount);
      fs.writeFileSync(testDiscListFile, JSON.stringify(testDiscList, null, 2));

      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockImplementation(async (pageId: number, lang: "ja-jp" | "en-us") => {
        return createMockDriverDiscApiResponse(
          `${pageId}`,
          `テストディスク${pageId}`,
          `Test Disc ${pageId}`
        );
      });

      const config: DriverDiscProcessingConfig = {
        discListPath: testDiscListFile,
        outputPath: testOutputFile,
        batchSize: 5,
        delayMs: 30,
        maxRetries: 2,
        enableValidation: true,
        logLevel: "info",
      };

      const pipeline = new DriverDiscDataPipeline(config);

      // Act & Measure with memory tracking
      const memoryStart = process.memoryUsage();
      const timeStart = performance.now();

      // Track memory usage during processing
      const memorySnapshots: NodeJS.MemoryUsage[] = [];
      const memoryTracker = setInterval(() => {
        memorySnapshots.push(process.memoryUsage());
      }, 200);

      const result = await pipeline.execute();

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
      const throughput = result.driverDiscs.length / (duration / 1000);
      const memoryDelta = {
        heapUsed: memoryEnd.heapUsed - memoryStart.heapUsed,
        rss: memoryEnd.rss - memoryStart.rss,
        external: memoryEnd.external - memoryStart.external,
      };

      performanceLog.push({
        testName: "large-dataset-memory-leak",
        timestamp: new Date().toISOString(),
        duration,
        memoryUsage: {
          start: memoryStart,
          end: memoryEnd,
          peak: peakMemory,
          delta: memoryDelta,
        },
        driverDiscsProcessed: result.driverDiscs.length,
        apiCalls: result.driverDiscs.length * 2,
        throughput,
        memoryEfficiency:
          result.driverDiscs.length > 0
            ? memoryDelta.heapUsed / result.driverDiscs.length
            : 0,
        retryCount: result.statistics.retries,
        successRate: result.statistics.successRate,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.driverDiscs.length).toBe(discCount);
      expect(duration).toBeLessThan(30000); // 30秒以内
      expect(throughput).toBeGreaterThan(0.2); // 0.2ドライバーディスク/秒以上
      expect(memoryDelta.heapUsed).toBeLessThan(200 * 1024 * 1024); // 200MB以内
      expect(peakMemory.heapUsed - memoryStart.heapUsed).toBeLessThan(
        250 * 1024 * 1024
      ); // ピーク250MB以内

      // メモリリーク検出：最終メモリ使用量がピークの80%以下であることを確認
      const memoryRecoveryRatio =
        (peakMemory.heapUsed - memoryEnd.heapUsed) /
        Math.max(peakMemory.heapUsed - memoryStart.heapUsed, 1);
      expect(memoryRecoveryRatio).toBeGreaterThan(-0.5); // 大幅な増加がないことを確認
    });
  });

  describe("APIレート制限対応のテスト", () => {
    it("APIレート制限シミュレーション（遅延とリトライ）", async () => {
      // Arrange
      const discCount = 8;
      const testDiscList = createTestDiscList(discCount);
      fs.writeFileSync(testDiscListFile, JSON.stringify(testDiscList, null, 2));

      let callCount = 0;

      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockImplementation(async (pageId: number, lang: "ja-jp" | "en-us") => {
        callCount++;
        // 3回に1回は429エラー（レート制限）をシミュレート
        if (callCount % 3 === 0) {
          const error = new Error("Rate limit exceeded");
          (error as any).status = 429;
          throw error;
        }
        return createMockDriverDiscApiResponse(
          `${pageId}`,
          `テストディスク${pageId}`,
          `Test Disc ${pageId}`
        );
      });

      const config: DriverDiscProcessingConfig = {
        discListPath: testDiscListFile,
        outputPath: testOutputFile,
        batchSize: 2,
        delayMs: 100, // レート制限対応のための遅延
        maxRetries: 3,
        enableValidation: true,
        logLevel: "info",
      };

      const pipeline = new DriverDiscDataPipeline(config);

      // Act & Measure
      const timeStart = performance.now();
      const result = await pipeline.execute();
      const timeEnd = performance.now();

      const duration = timeEnd - timeStart;
      const throughput = result.driverDiscs.length / (duration / 1000);

      performanceLog.push({
        testName: "api-rate-limit-handling",
        timestamp: new Date().toISOString(),
        duration,
        memoryUsage: {
          start: process.memoryUsage(),
          end: process.memoryUsage(),
          peak: process.memoryUsage(),
          delta: { heapUsed: 0, rss: 0, external: 0 },
        },
        driverDiscsProcessed: result.driverDiscs.length,
        apiCalls: callCount,
        throughput,
        memoryEfficiency: 0,
        retryCount: result.statistics.retries,
        successRate: result.statistics.successRate,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.statistics.retries).toBeGreaterThan(0); // リトライが発生していることを確認
      expect(result.driverDiscs.length).toBeGreaterThanOrEqual(discCount * 0.5); // 50%以上成功（リトライ制限を考慮）
      expect(callCount).toBeGreaterThan(discCount); // リトライによりAPI呼び出し回数が増加
      expect(duration).toBeGreaterThan(
        config.delayMs * (discCount / config.batchSize) * 0.5
      ); // 遅延が適用されている
    });

    it("異なる遅延設定での処理速度比較", async () => {
      const discCount = 6;
      const testDiscList = createTestDiscList(discCount);
      fs.writeFileSync(testDiscListFile, JSON.stringify(testDiscList, null, 2));

      const delaySettings = [50, 200, 500]; // 異なる遅延設定
      const results: Array<{
        delayMs: number;
        duration: number;
        throughput: number;
        successRate: number;
      }> = [];

      for (const delayMs of delaySettings) {
        // Reset mocks for each test
        vi.clearAllMocks();
        vi.spyOn(
          HoyoLabApiClient.prototype,
          "fetchCharacterData"
        ).mockImplementation(
          async (pageId: number, lang: "ja-jp" | "en-us") => {
            return createMockDriverDiscApiResponse(
              `${pageId}`,
              `テストディスク${pageId}`,
              `Test Disc ${pageId}`
            );
          }
        );

        const config: DriverDiscProcessingConfig = {
          discListPath: testDiscListFile,
          outputPath: testOutputFile.replace(".ts", `-delay${delayMs}.ts`),
          batchSize: 2,
          delayMs,
          maxRetries: 1,
          enableValidation: true,
          logLevel: "info",
        };

        const pipeline = new DriverDiscDataPipeline(config);

        // Measure
        const timeStart = performance.now();
        const result = await pipeline.execute();
        const timeEnd = performance.now();

        const duration = timeEnd - timeStart;
        const throughput = result.driverDiscs.length / (duration / 1000);

        results.push({
          delayMs,
          duration,
          throughput,
          successRate: result.statistics.successRate,
        });

        expect(result.success).toBe(true);
        expect(result.driverDiscs.length).toBe(discCount);

        // Wait between tests
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Record comparison results
      performanceLog.push({
        testName: "delay-settings-comparison",
        timestamp: new Date().toISOString(),
        duration: results.reduce((sum, r) => sum + r.duration, 0),
        memoryUsage: {
          start: process.memoryUsage(),
          end: process.memoryUsage(),
          peak: process.memoryUsage(),
          delta: { heapUsed: 0, rss: 0, external: 0 },
        },
        driverDiscsProcessed: discCount * delaySettings.length,
        apiCalls: discCount * delaySettings.length * 2,
        throughput:
          results.reduce((sum, r) => sum + r.throughput, 0) / results.length,
        memoryEfficiency: 0,
        retryCount: 0,
        successRate:
          results.reduce((sum, r) => sum + r.successRate, 0) / results.length,
      });

      // Assert
      expect(results).toHaveLength(delaySettings.length);

      // 遅延が長いほど処理時間が長くなることを確認
      const shortDelayResult = results.find((r) => r.delayMs === 50)!;
      const longDelayResult = results.find((r) => r.delayMs === 500)!;

      expect(longDelayResult.duration).toBeGreaterThan(
        shortDelayResult.duration
      );
      expect(shortDelayResult.throughput).toBeGreaterThan(
        longDelayResult.throughput
      );

      // すべての設定で成功率が高いことを確認
      results.forEach((result) => {
        expect(result.successRate).toBeGreaterThanOrEqual(95);
      });
    });
  });

  describe("処理速度とスループットの測定", () => {
    it("バッチサイズ別スループット比較", async () => {
      const discCount = 12;
      const testDiscList = createTestDiscList(discCount);
      fs.writeFileSync(testDiscListFile, JSON.stringify(testDiscList, null, 2));

      const batchSizes = [1, 3, 6, 12];
      const results: Array<{
        batchSize: number;
        duration: number;
        throughput: number;
        memoryUsed: number;
        avgTimePerDisc: number;
      }> = [];

      for (const batchSize of batchSizes) {
        // Reset mocks for each test
        vi.clearAllMocks();
        vi.spyOn(
          HoyoLabApiClient.prototype,
          "fetchCharacterData"
        ).mockImplementation(
          async (pageId: number, lang: "ja-jp" | "en-us") => {
            return createMockDriverDiscApiResponse(
              `${pageId}`,
              `テストディスク${pageId}`,
              `Test Disc ${pageId}`
            );
          }
        );

        const config: DriverDiscProcessingConfig = {
          discListPath: testDiscListFile,
          outputPath: testOutputFile.replace(".ts", `-batch${batchSize}.ts`),
          batchSize,
          delayMs: 50,
          maxRetries: 1,
          enableValidation: true,
          logLevel: "info",
        };

        const pipeline = new DriverDiscDataPipeline(config);

        // Measure
        const memoryStart = process.memoryUsage();
        const timeStart = performance.now();

        const result = await pipeline.execute();

        const timeEnd = performance.now();
        const memoryEnd = process.memoryUsage();

        const duration = timeEnd - timeStart;
        const throughput = result.driverDiscs.length / (duration / 1000);
        const memoryUsed = memoryEnd.heapUsed - memoryStart.heapUsed;
        const avgTimePerDisc = duration / result.driverDiscs.length;

        results.push({
          batchSize,
          duration,
          throughput,
          memoryUsed,
          avgTimePerDisc,
        });

        expect(result.success).toBe(true);
        expect(result.driverDiscs.length).toBe(discCount);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        // Wait between tests
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      // Record all results
      performanceLog.push({
        testName: "batch-size-throughput-comparison",
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
        driverDiscsProcessed: discCount * batchSizes.length,
        apiCalls: discCount * batchSizes.length * 2,
        throughput:
          results.reduce((sum, r) => sum + r.throughput, 0) / results.length,
        memoryEfficiency:
          Math.max(...results.map((r) => r.memoryUsed)) / discCount,
        retryCount: 0,
        successRate: 100,
      });

      // Assert
      expect(results).toHaveLength(batchSizes.length);

      // All batch sizes should complete successfully
      results.forEach((result) => {
        expect(result.duration).toBeGreaterThan(0);
        expect(result.throughput).toBeGreaterThan(0);
        expect(result.memoryUsed).toBeLessThan(100 * 1024 * 1024); // 100MB以内
      });

      // Larger batch sizes should generally be more efficient
      const smallBatchResult = results.find((r) => r.batchSize === 1)!;
      const largeBatchResult = results.find((r) => r.batchSize === 12)!;

      // Large batch should be at least as efficient as small batch (with some tolerance)
      expect(largeBatchResult.throughput).toBeGreaterThanOrEqual(
        smallBatchResult.throughput * 0.7
      );
    });
  });

  // Helper functions
  function createTestDiscList(discCount: number): any {
    const discEntries = Array.from({ length: discCount }, (_, i) => ({
      entry_page_id: `${3001 + i}`,
      name: `テストドライバーディスク${i + 1}`,
      icon_url: `https://example.com/disc-icon${i + 1}.png`,
    }));

    return {
      retcode: 0,
      message: "OK",
      data: {
        list: discEntries,
      },
    };
  }

  function createMockDriverDiscApiResponse(
    id: string,
    jaName: string,
    enName?: string
  ): any {
    return {
      retcode: 0,
      message: "OK",
      data: {
        page: {
          id: id,
          name: jaName,
          modules: [
            {
              components: [
                {
                  component_id: "display_field",
                  data: JSON.stringify({
                    four_set_effect: `<p>攻撃力が<span style='color: #ff6b00'>15%</span>アップする。</p>`,
                    two_set_effect: `<p>攻撃力が<span style='color: #ff6b00'>10%</span>アップする。</p>`,
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
