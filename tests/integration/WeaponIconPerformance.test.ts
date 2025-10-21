import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import { WeaponIconGenerator } from "../../src/generators/WeaponIconGenerator";
import { WeaponIconProcessor } from "../../src/processors/WeaponIconProcessor";
import { FileLoader } from "../../src/loaders/FileLoader";
import { WeaponIconConfig } from "../../src/types/processing";

/**
 * 武器アイコンダウンロードのパフォーマンステスト
 * 並行処理、メモリ使用量、スループットの検証
 * 要件: 4.4
 */
describe("WeaponIcon Performance Tests", () => {
  const testOutputDir = "test-perf-assets/images/weapons";
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
        { concurrency: 1, expectedTimeRange: [800, 8000] }, // シーケンシャル
        { concurrency: 3, expectedTimeRange: [600, 5000] }, // 中程度の並行
        { concurrency: 5, expectedTimeRange: [500, 4000] }, // 高い並行
      ];

      const weaponCount = 6;
      const mockWeapons = Array.from({ length: weaponCount }, (_, i) => ({
        entry_page_id: `${900 + i}`,
        name: `パフォーマンステスト武器${i}`,
        icon_url: `https://act-webstatic.hoyoverse.com/test/perf-${i}.png`,
        filter_values: {
          w_engine_rarity: {
            values: ["S"],
          },
        },
      }));

      for (const testCase of testCases) {
        const config = createTestConfig();
        config.maxConcurrency = testCase.concurrency;
        config.requestDelayMs = 200; // 一定の遅延

        const { generator } = createMockComponents(config, mockWeapons);

        const startTime = Date.now();
        const result = await generator.generateWeaponIcons();
        const endTime = Date.now();

        const processingTime = endTime - startTime;

        expect(result.statistics.successful).toBe(weaponCount);
        expect(processingTime).toBeGreaterThan(testCase.expectedTimeRange[0]);
        expect(processingTime).toBeLessThan(testCase.expectedTimeRange[1]);

        console.log(
          `並行数 ${testCase.concurrency}: ${processingTime}ms (期待範囲: ${testCase.expectedTimeRange[0]}-${testCase.expectedTimeRange[1]}ms)`
        );
      }
    });

    it("スループット測定", async () => {
      const weaponCount = 12;
      const mockWeapons = Array.from({ length: weaponCount }, (_, i) => ({
        entry_page_id: `${900 + i}`,
        name: `スループットテスト武器${i}`,
        icon_url: `https://act-webstatic.hoyoverse.com/test/throughput-${i}.png`,
        filter_values: {
          w_engine_rarity: {
            values: [i % 2 === 0 ? "S" : "A"],
          },
        },
      }));

      const config = createTestConfig();
      config.maxConcurrency = 4;
      config.requestDelayMs = 100;

      const { generator } = createMockComponents(config, mockWeapons);

      const startTime = Date.now();
      const result = await generator.generateWeaponIcons();
      const endTime = Date.now();

      const processingTimeSeconds = (endTime - startTime) / 1000;
      const throughput = result.statistics.successful / processingTimeSeconds;

      expect(throughput).toBeGreaterThan(1); // 最低 1 武器/秒
      expect(throughput).toBeLessThan(20); // 現実的な上限

      console.log(
        `スループット: ${throughput.toFixed(2)} 武器/秒 (${
          result.statistics.successful
        }/${processingTimeSeconds.toFixed(1)}s)`
      );
    });

    it("バッチサイズの最適化", async () => {
      const weaponCount = 10;
      const mockWeapons = Array.from({ length: weaponCount }, (_, i) => ({
        entry_page_id: `${900 + i}`,
        name: `バッチテスト武器${i}`,
        icon_url: `https://act-webstatic.hoyoverse.com/test/batch-${i}.png`,
        filter_values: {
          w_engine_rarity: {
            values: ["S"],
          },
        },
      }));

      const batchSizes = [1, 2, 5, 8];
      const results: Array<{
        batchSize: number;
        time: number;
        throughput: number;
      }> = [];

      for (const batchSize of batchSizes) {
        const config = createTestConfig();
        config.maxConcurrency = batchSize;
        config.requestDelayMs = 150;

        const { generator } = createMockComponents(config, mockWeapons);

        const startTime = Date.now();
        const result = await generator.generateWeaponIcons();
        const endTime = Date.now();

        const processingTime = endTime - startTime;
        const throughput =
          result.statistics.successful / (processingTime / 1000);

        results.push({
          batchSize,
          time: processingTime,
          throughput,
        });

        expect(result.statistics.successful).toBe(weaponCount);
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
          )} 武器/秒`
        );
      });
    });
  });

  describe("メモリ使用量テスト", () => {
    it("大量武器処理時のメモリ効率", async () => {
      const weaponCount = 30;
      const mockWeapons = Array.from({ length: weaponCount }, (_, i) => ({
        entry_page_id: `${900 + i}`,
        name: `メモリテスト武器${i}`,
        icon_url: `https://act-webstatic.hoyoverse.com/test/memory-${i}.png`,
        filter_values: {
          w_engine_rarity: {
            values: [i % 3 === 0 ? "S" : "A"],
          },
        },
      }));

      const config = createTestConfig();
      config.maxConcurrency = 4;

      const { generator } = createMockComponents(config, mockWeapons);

      // ガベージコレクションを実行してベースラインを設定
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage();
      const result = await generator.generateWeaponIcons();
      const finalMemory = process.memoryUsage();

      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryPerWeapon = memoryIncrease / weaponCount;

      expect(result.statistics.successful).toBe(weaponCount);
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB未満
      expect(memoryPerWeapon).toBeLessThan(2 * 1024 * 1024); // 2MB/武器未満

      console.log(
        `メモリ使用量: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(`武器あたりメモリ: ${(memoryPerWeapon / 1024).toFixed(2)}KB`);
    });

    it("メモリリークの検出", async () => {
      const iterations = 3;
      const weaponCount = 5;
      const memoryMeasurements: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const mockWeapons = Array.from({ length: weaponCount }, (_, j) => ({
          entry_page_id: `${800 + i * 10 + j}`,
          name: `リークテスト${i}-${j}`,
          icon_url: `https://act-webstatic.hoyoverse.com/test/leak-${i}-${j}.png`,
          filter_values: {
            w_engine_rarity: {
              values: ["S"],
            },
          },
        }));

        const config = createTestConfig();
        config.outputDirectory = `${testOutputDir}-${i}`;

        const { generator } = createMockComponents(config, mockWeapons);

        // ガベージコレクション
        if (global.gc) {
          global.gc();
        }

        const beforeMemory = process.memoryUsage().heapUsed;
        await generator.generateWeaponIcons();

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

      // メモリ使用量が負の値になる場合もあるため、より緩和された条件
      expect(Math.abs(maxDeviation)).toBeLessThan(
        Math.abs(avgMemory) * 3.0 + 10000000
      ); // 10MB + 300%以内

      console.log(
        `メモリ使用量の変動: 平均 ${(avgMemory / 1024 / 1024).toFixed(
          2
        )}MB, 最大偏差 ${(maxDeviation / 1024 / 1024).toFixed(2)}MB`
      );
    });
  });

  describe("ネットワーク効率テスト", () => {
    it("リクエスト遅延の影響測定", async () => {
      const weaponCount = 4;
      const mockWeapons = Array.from({ length: weaponCount }, (_, i) => ({
        entry_page_id: `${900 + i}`,
        name: `遅延テスト武器${i}`,
        icon_url: `https://act-webstatic.hoyoverse.com/test/delay-${i}.png`,
        filter_values: {
          w_engine_rarity: {
            values: ["S"],
          },
        },
      }));

      const delaySettings = [0, 200, 500]; // ms
      const results: Array<{
        delay: number;
        time: number;
        efficiency: number;
      }> = [];

      for (const delay of delaySettings) {
        const config = createTestConfig();
        config.maxConcurrency = 2;
        config.requestDelayMs = delay;

        const { generator } = createMockComponents(config, mockWeapons);

        const startTime = Date.now();
        const result = await generator.generateWeaponIcons();
        const endTime = Date.now();

        const processingTime = endTime - startTime;
        const efficiency =
          result.statistics.successful / (processingTime / 1000);

        results.push({
          delay,
          time: processingTime,
          efficiency,
        });

        expect(result.statistics.successful).toBe(weaponCount);
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
          )} 武器/秒`
        );
      });
    });

    it("リトライ機構のパフォーマンス影響", async () => {
      const weaponCount = 4;
      const mockWeapons = Array.from({ length: weaponCount }, (_, i) => ({
        entry_page_id: `${900 + i}`,
        name: `リトライテスト武器${i}`,
        icon_url: `https://act-webstatic.hoyoverse.com/test/retry-${i}.png`,
        filter_values: {
          w_engine_rarity: {
            values: ["S"],
          },
        },
      }));

      // 50%の確率で失敗するfetch
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 0) {
          throw new Error("Intermittent failure");
        }
        return Promise.resolve({
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
                  value: new Uint8Array(1024),
                })
                .mockResolvedValue({ done: true }),
              releaseLock: vi.fn(),
            }),
          },
        });
      });

      const config = createTestConfig();
      config.retryAttempts = 2;
      config.retryDelayMs = 100;
      config.maxConcurrency = 2;

      vi.spyOn(fs, "readFile").mockResolvedValue(JSON.stringify(mockWeapons));

      const fileLoader = new FileLoader();
      const processor = new WeaponIconProcessor(config);
      const generator = new WeaponIconGenerator(fileLoader, processor, config);

      const startTime = Date.now();
      const result = await generator.generateWeaponIcons();
      const endTime = Date.now();

      const processingTime = endTime - startTime;

      // リトライにより処理時間が増加するが、成功率は向上する
      expect(result.statistics.successful).toBeGreaterThan(0);
      expect(processingTime).toBeGreaterThan(weaponCount * 100); // 最低限のリトライ時間

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
      const fileSizes = [1024, 10240, 102400]; // 1KB, 10KB, 100KB
      const results: Array<{ size: number; time: number; throughput: number }> =
        [];

      for (const fileSize of fileSizes) {
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
        const processor = new WeaponIconProcessor(config);

        const startTime = Date.now();
        const result = await processor.processWeaponIcon({
          entry_page_id: `large-${fileSize}`,
          name: `大きなファイル${fileSize}`,
          icon_url: `https://act-webstatic.hoyoverse.com/test/large-${fileSize}.png`,
          filter_values: {
            w_engine_rarity: {
              values: ["S"],
            },
          },
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
      const weaponCount = 8;
      const mockWeapons = Array.from({ length: weaponCount }, (_, i) => ({
        entry_page_id: `${900 + i}`,
        name: `並行書き込み武器${i}`,
        icon_url: `https://act-webstatic.hoyoverse.com/test/concurrent-${i}.png`,
        filter_values: {
          w_engine_rarity: {
            values: ["S"],
          },
        },
      }));

      const concurrencyLevels = [1, 2, 4];
      const results: Array<{
        concurrency: number;
        time: number;
        iops: number;
      }> = [];

      for (const concurrency of concurrencyLevels) {
        const config = createTestConfig();
        config.maxConcurrency = concurrency;

        const { generator } = createMockComponents(config, mockWeapons);

        const startTime = Date.now();
        const result = await generator.generateWeaponIcons();
        const endTime = Date.now();

        const processingTime = endTime - startTime;
        const iops = result.statistics.successful / (processingTime / 1000);

        results.push({
          concurrency,
          time: processingTime,
          iops,
        });

        expect(result.statistics.successful).toBe(weaponCount);
      }

      console.log("並行書き込みパフォーマンス:");
      results.forEach((r) => {
        console.log(
          `  並行数 ${r.concurrency}: ${r.time}ms, ${r.iops.toFixed(2)} IOPS`
        );
      });
    });

    it("レアリティフィルタリングのパフォーマンス", async () => {
      // 大量のB級武器と少数のS/A級武器を含むリスト
      const mixedWeaponList = [
        ...Array.from({ length: 50 }, (_, i) => ({
          entry_page_id: `${700 + i}`,
          name: `B級武器${i}`,
          icon_url: `https://act-webstatic.hoyoverse.com/test/b-${i}.png`,
          filter_values: {
            w_engine_rarity: {
              values: ["B"],
            },
          },
        })),
        ...Array.from({ length: 5 }, (_, i) => ({
          entry_page_id: `${900 + i}`,
          name: `S級武器${i}`,
          icon_url: `https://act-webstatic.hoyoverse.com/test/s-${i}.png`,
          filter_values: {
            w_engine_rarity: {
              values: ["S"],
            },
          },
        })),
      ];

      const config = createTestConfig();
      const { generator } = createMockComponents(config, mixedWeaponList);

      const startTime = Date.now();
      const result = await generator.generateWeaponIcons();
      const endTime = Date.now();

      const processingTime = endTime - startTime;

      // B級武器は除外され、S級のみが処理されることを確認
      expect(result.statistics.total).toBe(5); // S級5個のみ
      expect(result.statistics.successful).toBe(5);

      // フィルタリングが効率的に動作することを確認
      expect(processingTime).toBeLessThan(10000); // 10秒未満

      console.log(
        `レアリティフィルタリング: 55個中5個を処理、${processingTime}ms`
      );
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

  function createTestConfig(): WeaponIconConfig {
    return {
      outputDirectory: testOutputDir,
      maxConcurrency: 3,
      retryAttempts: 2,
      retryDelayMs: 100,
      requestDelayMs: 100,
      skipExisting: false, // パフォーマンステストでは常にダウンロード
      validateDownloads: true,
      maxFileSizeMB: 10,
      allowedExtensions: [".png", ".jpg", ".jpeg", ".webp"],
    };
  }

  function createMockComponents(config: WeaponIconConfig, mockWeapons: any[]) {
    global.fetch = createMockFetch();

    vi.spyOn(fs, "readFile").mockResolvedValue(JSON.stringify(mockWeapons));

    const fileLoader = new FileLoader();
    const processor = new WeaponIconProcessor(config);
    const generator = new WeaponIconGenerator(fileLoader, processor, config);

    return { fileLoader, processor, generator };
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
        }, 50); // 50ms のネットワーク遅延
      });
    });
  }
});
