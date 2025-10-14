import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import { BompIconGenerator } from "../../src/generators/BompIconGenerator";
import { BompIconProcessor } from "../../src/processors/BompIconProcessor";
import { BompListParser } from "../../src/parsers/BompListParser";
import { BompIconConfig } from "../../src/types/processing";

/**
 * ボンプアイコンダウンロードのパフォーマンステスト
 * 並行処理、メモリ使用量、スループットの検証
 * 要件: 4.4
 */
describe("BompIcon Performance Tests", () => {
  const testOutputDir = "test-perf-assets/images/bomps";
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    process.env.VITEST = "true";
    originalFetch = global.fetch;
    await cleanupTestDirectory();
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    await cleanupTestDirectory();
  });

  describe("並行処理パフォーマンス", () => {
    it("並行数が処理時間に与える影響を測定", async () => {
      const testCases = [
        { concurrency: 1, expectedTimeRange: [8000, 15000] }, // シーケンシャル
        { concurrency: 3, expectedTimeRange: [3000, 8000] }, // 中程度の並行
        { concurrency: 5, expectedTimeRange: [2000, 6000] }, // 高い並行
      ];

      const bompCount = 10;
      const mockBomps = Array.from({ length: bompCount }, (_, i) => ({
        id: `perf-bomp-${i}`,
        pageId: 900 + i,
      }));

      for (const testCase of testCases) {
        const config = createTestConfig();
        config.maxConcurrency = testCase.concurrency;
        config.requestDelayMs = 100; // 一定の遅延

        const { generator } = createMockComponents(config, mockBomps);

        const startTime = Date.now();
        const result = await generator.generateBompIcons();
        const endTime = Date.now();

        const processingTime = endTime - startTime;

        expect(result.statistics.successful).toBe(bompCount);
        expect(processingTime).toBeGreaterThan(testCase.expectedTimeRange[0]);
        expect(processingTime).toBeLessThan(testCase.expectedTimeRange[1]);

        console.log(
          `並行数 ${testCase.concurrency}: ${processingTime}ms (期待範囲: ${testCase.expectedTimeRange[0]}-${testCase.expectedTimeRange[1]}ms)`
        );
      }
    });

    it("スループット測定", async () => {
      const bompCount = 20;
      const mockBomps = Array.from({ length: bompCount }, (_, i) => ({
        id: `throughput-bomp-${i}`,
        pageId: 900 + i,
      }));

      const config = createTestConfig();
      config.maxConcurrency = 5;
      config.requestDelayMs = 50;

      const { generator } = createMockComponents(config, mockBomps);

      const startTime = Date.now();
      const result = await generator.generateBompIcons();
      const endTime = Date.now();

      const processingTimeSeconds = (endTime - startTime) / 1000;
      const throughput = result.statistics.successful / processingTimeSeconds;

      expect(throughput).toBeGreaterThan(2); // 最低 2 ボンプ/秒
      expect(throughput).toBeLessThan(50); // 現実的な上限

      console.log(
        `スループット: ${throughput.toFixed(2)} ボンプ/秒 (${
          result.statistics.successful
        }/${processingTimeSeconds.toFixed(1)}s)`
      );
    });

    it("バッチサイズの最適化", async () => {
      const bompCount = 15;
      const mockBomps = Array.from({ length: bompCount }, (_, i) => ({
        id: `batch-bomp-${i}`,
        pageId: 900 + i,
      }));

      const batchSizes = [1, 3, 5, 10];
      const results: Array<{
        batchSize: number;
        time: number;
        throughput: number;
      }> = [];

      for (const batchSize of batchSizes) {
        const config = createTestConfig();
        config.maxConcurrency = batchSize;
        config.requestDelayMs = 100;

        const { generator } = createMockComponents(config, mockBomps);

        const startTime = Date.now();
        const result = await generator.generateBompIcons();
        const endTime = Date.now();

        const processingTime = endTime - startTime;
        const throughput =
          result.statistics.successful / (processingTime / 1000);

        results.push({
          batchSize,
          time: processingTime,
          throughput,
        });

        expect(result.statistics.successful).toBe(bompCount);
      }

      // バッチサイズが大きいほど効率的であることを確認（ある程度まで）
      const sortedByThroughput = [...results].sort(
        (a, b) => b.throughput - a.throughput
      );
      expect(sortedByThroughput[0].batchSize).toBeGreaterThan(1);

      console.log("バッチサイズ最適化結果:");
      results.forEach((r) => {
        console.log(
          `  バッチサイズ ${r.batchSize}: ${r.time}ms, ${r.throughput.toFixed(
            2
          )} ボンプ/秒`
        );
      });
    });
  });

  describe("メモリ使用量テスト", () => {
    it("大量ボンプ処理時のメモリ効率", async () => {
      const bompCount = 50;
      const mockBomps = Array.from({ length: bompCount }, (_, i) => ({
        id: `memory-bomp-${i}`,
        pageId: 900 + i,
      }));

      const config = createTestConfig();
      config.maxConcurrency = 5;

      const { generator } = createMockComponents(config, mockBomps);

      // ガベージコレクションを実行してベースラインを設定
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage();
      const result = await generator.generateBompIcons();
      const finalMemory = process.memoryUsage();

      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryPerBomp = memoryIncrease / bompCount;

      expect(result.statistics.successful).toBe(bompCount);
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB未満
      expect(memoryPerBomp).toBeLessThan(2 * 1024 * 1024); // 2MB/ボンプ未満

      console.log(
        `メモリ使用量: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(`ボンプあたりメモリ: ${(memoryPerBomp / 1024).toFixed(2)}KB`);
    });

    it("メモリリークの検出", async () => {
      const iterations = 5;
      const bompCount = 10;
      const memoryMeasurements: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const mockBomps = Array.from({ length: bompCount }, (_, j) => ({
          id: `leak-test-${i}-${j}`,
          pageId: 900 + j,
        }));

        const config = createTestConfig();
        config.outputDirectory = `${testOutputDir}-${i}`;

        const { generator } = createMockComponents(config, mockBomps);

        // ガベージコレクション
        if (global.gc) {
          global.gc();
        }

        const beforeMemory = process.memoryUsage().heapUsed;
        await generator.generateBompIcons();

        // ガベージコレクション
        if (global.gc) {
          global.gc();
        }

        const afterMemory = process.memoryUsage().heapUsed;
        memoryMeasurements.push(afterMemory - beforeMemory);

        // テストディレクトリをクリーンアップ
        await fs
          .rm(`${testOutputDir}-${i}`, { recursive: true, force: true })
          .catch(() => {});
      }

      // メモリ使用量が一定範囲内であることを確認（メモリリークがない）
      const avgMemory =
        memoryMeasurements.reduce((a, b) => a + b, 0) /
        memoryMeasurements.length;
      const maxDeviation = Math.max(
        ...memoryMeasurements.map((m) => Math.abs(m - avgMemory))
      );

      expect(maxDeviation).toBeLessThan(avgMemory * 0.5); // 平均の50%以内の変動

      console.log(
        `メモリ使用量の変動: 平均 ${(avgMemory / 1024 / 1024).toFixed(
          2
        )}MB, 最大偏差 ${(maxDeviation / 1024 / 1024).toFixed(2)}MB`
      );
    });
  });

  describe("ネットワーク効率テスト", () => {
    it("リクエスト遅延の影響測定", async () => {
      const bompCount = 8;
      const mockBomps = Array.from({ length: bompCount }, (_, i) => ({
        id: `delay-bomp-${i}`,
        pageId: 900 + i,
      }));

      const delaySettings = [0, 100, 500, 1000]; // ms
      const results: Array<{
        delay: number;
        time: number;
        efficiency: number;
      }> = [];

      for (const delay of delaySettings) {
        const config = createTestConfig();
        config.maxConcurrency = 3;
        config.requestDelayMs = delay;

        const { generator } = createMockComponents(config, mockBomps);

        const startTime = Date.now();
        const result = await generator.generateBompIcons();
        const endTime = Date.now();

        const processingTime = endTime - startTime;
        const efficiency =
          result.statistics.successful / (processingTime / 1000);

        results.push({
          delay,
          time: processingTime,
          efficiency,
        });

        expect(result.statistics.successful).toBe(bompCount);
      }

      // 遅延が増加すると処理時間も増加することを確認
      for (let i = 1; i < results.length; i++) {
        expect(results[i].time).toBeGreaterThan(results[i - 1].time);
      }

      console.log("リクエスト遅延の影響:");
      results.forEach((r) => {
        console.log(
          `  遅延 ${r.delay}ms: ${r.time}ms, 効率 ${r.efficiency.toFixed(
            2
          )} ボンプ/秒`
        );
      });
    });

    it("リトライ機構のパフォーマンス影響", async () => {
      const bompCount = 6;
      const mockBomps = Array.from({ length: bompCount }, (_, i) => ({
        id: `retry-perf-bomp-${i}`,
        pageId: 900 + i,
      }));

      // 50%の確率で失敗するAPIクライアント
      let callCount = 0;
      const mockApiClient = {
        fetchCharacterData: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount % 2 === 0) {
            throw new Error("Intermittent failure");
          }
          return Promise.resolve(
            createMockApiResponse(`retry-bomp-${callCount}`)
          );
        }),
      } as any;

      global.fetch = createMockFetch();

      const config = createTestConfig();
      config.retryAttempts = 2;
      config.retryDelayMs = 100;
      config.maxConcurrency = 2;

      const bompListParser = new BompListParser();
      const processor = new BompIconProcessor(mockApiClient, config);
      const generator = new BompIconGenerator(
        bompListParser,
        processor,
        config
      );

      vi.spyOn(bompListParser, "parseScrapingFile").mockResolvedValue(
        mockBomps
      );

      const startTime = Date.now();
      const result = await generator.generateBompIcons();
      const endTime = Date.now();

      const processingTime = endTime - startTime;

      // リトライにより処理時間が増加するが、成功率は向上する
      expect(result.statistics.successful).toBeGreaterThan(0);
      expect(processingTime).toBeGreaterThan(bompCount * 100); // 最低限のリトライ時間

      console.log(
        `リトライあり: ${processingTime}ms, 成功率 ${(
          (result.statistics.successful / result.statistics.total) *
          100
        ).toFixed(1)}%`
      );
    });
  });

  describe("ファイルI/Oパフォーマンス", () => {
    it("大きなファイルのダウンロード効率", async () => {
      const fileSizes = [1024, 10240, 102400, 1048576]; // 1KB, 10KB, 100KB, 1MB
      const results: Array<{ size: number; time: number; throughput: number }> =
        [];

      for (const fileSize of fileSizes) {
        const mockApiClient = createMockApiClient();

        // 指定サイズのファイルを返すfetchモック
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          headers: {
            get: () => "image/png",
          },
          body: {
            getReader: () => ({
              read: vi
                .fn()
                .mockResolvedValueOnce({
                  done: false,
                  value: new Uint8Array(fileSize),
                })
                .mockResolvedValue({ done: true }),
              releaseLock: vi.fn(),
            }),
          },
        });

        const config = createTestConfig();
        const processor = new BompIconProcessor(mockApiClient, config);

        const startTime = Date.now();
        const result = await processor.processBompIcon({
          id: `large-file-${fileSize}`,
          pageId: 123,
        });
        const endTime = Date.now();

        const processingTime = endTime - startTime;
        const throughputMBps = fileSize / 1024 / 1024 / (processingTime / 1000);

        results.push({
          size: fileSize,
          time: processingTime,
          throughput: throughputMBps,
        });

        expect(result.success).toBe(true);
        expect(result.iconInfo?.fileSize).toBe(fileSize);
      }

      console.log("ファイルサイズ別パフォーマンス:");
      results.forEach((r) => {
        console.log(
          `  ${(r.size / 1024).toFixed(0)}KB: ${
            r.time
          }ms, ${r.throughput.toFixed(2)} MB/s`
        );
      });
    });

    it("並行ファイル書き込みの効率", async () => {
      const bompCount = 12;
      const mockBomps = Array.from({ length: bompCount }, (_, i) => ({
        id: `concurrent-write-${i}`,
        pageId: 900 + i,
      }));

      const concurrencyLevels = [1, 3, 6];
      const results: Array<{
        concurrency: number;
        time: number;
        iops: number;
      }> = [];

      for (const concurrency of concurrencyLevels) {
        const config = createTestConfig();
        config.maxConcurrency = concurrency;

        const { generator } = createMockComponents(config, mockBomps);

        const startTime = Date.now();
        const result = await generator.generateBompIcons();
        const endTime = Date.now();

        const processingTime = endTime - startTime;
        const iops = result.statistics.successful / (processingTime / 1000);

        results.push({
          concurrency,
          time: processingTime,
          iops,
        });

        expect(result.statistics.successful).toBe(bompCount);
      }

      console.log("並行書き込みパフォーマンス:");
      results.forEach((r) => {
        console.log(
          `  並行数 ${r.concurrency}: ${r.time}ms, ${r.iops.toFixed(2)} IOPS`
        );
      });
    });
  });

  // ヘルパー関数

  async function cleanupTestDirectory(): Promise<void> {
    try {
      await fs.rm("test-perf-assets", { recursive: true, force: true });
    } catch {
      // ディレクトリが存在しない場合は無視
    }
  }

  function createTestConfig(): BompIconConfig {
    return {
      outputDirectory: testOutputDir,
      maxConcurrency: 3,
      retryAttempts: 2,
      retryDelayMs: 100,
      requestDelayMs: 100,
      skipExisting: false, // パフォーマンステストでは常にダウンロード
      validateDownloads: true,
      maxFileSizeMB: 10,
    };
  }

  function createMockComponents(config: BompIconConfig, mockBomps: any[]) {
    const mockApiClient = createMockApiClient();
    global.fetch = createMockFetch();

    const bompListParser = new BompListParser();
    const processor = new BompIconProcessor(mockApiClient, config);
    const generator = new BompIconGenerator(bompListParser, processor, config);

    // parseScrapingFileをモック
    vi.spyOn(bompListParser, "parseScrapingFile").mockResolvedValue(mockBomps);

    return { mockApiClient, bompListParser, processor, generator };
  }

  function createMockApiClient(): any {
    return {
      fetchCharacterData: vi.fn().mockImplementation((pageId: number) => {
        // 実際のAPI呼び出しをシミュレートする遅延
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(createMockApiResponse(`bomp-${pageId}`));
          }, 50); // 50ms の遅延
        });
      }),
    };
  }

  function createMockApiResponse(bompId: string): any {
    return {
      retcode: 0,
      message: "OK",
      data: {
        page: {
          id: bompId,
          name: `Test ${bompId}`,
          icon_url: `https://act-upload.hoyoverse.com/event-ugc-hoyowiki/2025/09/07/test/${bompId}.png`,
        },
      },
    };
  }

  function createMockFetch(): any {
    return vi.fn().mockImplementation(() => {
      // ネットワーク遅延をシミュレート
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            status: 200,
            statusText: "OK",
            headers: {
              get: (name: string) => {
                if (name === "content-type") return "image/png";
                return null;
              },
            },
            body: {
              getReader: () => ({
                read: vi
                  .fn()
                  .mockResolvedValueOnce({
                    done: false,
                    value: new Uint8Array(2048), // 2KB のテストデータ
                  })
                  .mockResolvedValue({ done: true }),
                releaseLock: vi.fn(),
              }),
            },
          });
        }, 30); // 30ms のネットワーク遅延
      });
    });
  }
});
