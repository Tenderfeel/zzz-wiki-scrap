import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { WeaponIconGenerator } from "../../src/generators/WeaponIconGenerator";
import { WeaponIconProcessor } from "../../src/processors/WeaponIconProcessor";
import { FileLoader } from "../../src/loaders/FileLoader";
import { ConfigManager } from "../../src/config/ProcessingConfig";
import { WeaponIconConfig } from "../../src/types/processing";
import { main } from "../../src/main-weapon-icon-download";

/**
 * 武器アイコンダウンロードの統合テスト
 * 全コンポーネントの統合テスト、エンドツーエンドの動作確認、エラーシナリオの検証
 * 要件: 4.4, 4.5
 */
describe("WeaponIconDownload Integration Tests", () => {
  const testOutputDir = "test-assets/images/weapons";
  const testConfigPath = "test-weapon-processing-config.json";
  const testWeaponListPath = "test-weapon-list.json";

  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    // 環境変数を保存
    originalEnv = { ...process.env };
    process.env.NODE_ENV = "test";
    process.env.VITEST = "true";

    // テスト用ディレクトリをクリーンアップ
    await cleanupTestDirectory();

    // テスト用設定ファイルを作成
    await createTestConfig();

    // テスト用weapon-list.jsonファイルを作成
    await createTestWeaponListFile();
  });

  afterEach(async () => {
    // 環境変数を復元
    process.env = originalEnv;

    // テストファイルをクリーンアップ
    await cleanupTestFiles();
  });

  describe("エンドツーエンド統合テスト", () => {
    it("完全な武器アイコンダウンロードフローが正常に動作する", async () => {
      // モックfetchを設定
      const mockFetch = createMockFetch();
      global.fetch = mockFetch;

      // 設定を取得
      const configManager = ConfigManager.getInstance(testConfigPath);
      const config = configManager.getWeaponIconConfig();

      // コンポーネントを初期化
      const fileLoader = new FileLoader();
      const weaponIconProcessor = new WeaponIconProcessor(config);
      const weaponIconGenerator = new WeaponIconGenerator(
        fileLoader,
        weaponIconProcessor,
        config
      );

      // weapon-list.jsonの読み込みをモック
      vi.spyOn(fs, "readFile").mockResolvedValue(
        JSON.stringify(createMockWeaponList())
      );

      // メイン処理を実行
      const result = await weaponIconGenerator.generateWeaponIcons();

      // 結果を検証
      expect(result).toBeDefined();
      expect(result.statistics.total).toBeGreaterThan(0);
      expect(result.statistics.successful).toBeGreaterThan(0);
      expect(result.successful.length).toBe(result.statistics.successful);
      expect(result.failed.length).toBe(result.statistics.failed);

      // SとAレアリティのみが処理されることを確認
      expect(result.statistics.total).toBe(3); // S級2個 + A級1個
      expect(result.statistics.successful).toBe(3);

      // ファイルが実際に作成されているか確認
      for (const iconInfo of result.successful) {
        const fileExists = await fs
          .access(iconInfo.localPath)
          .then(() => true)
          .catch(() => false);
        expect(fileExists).toBe(true);

        const stats = await fs.stat(iconInfo.localPath);
        expect(stats.size).toBeGreaterThan(0);
        expect(stats.size).toBe(iconInfo.fileSize);
      }

      // 統計情報の整合性を確認
      expect(result.statistics.total).toBe(
        result.statistics.successful + result.statistics.failed
      );
      expect(result.statistics.processingTimeMs).toBeGreaterThan(0);
      expect(result.statistics.totalSizeBytes).toBeGreaterThan(0);
    }, 30000);

    it("メインエントリーポイントが正常に動作する", async () => {
      // コマンドライン引数をモック
      const originalArgv = process.argv;
      process.argv = [
        "node",
        "src/main-weapon-icon-download.ts",
        "--config",
        testConfigPath,
        "--output-dir",
        testOutputDir,
        "--max-concurrency",
        "2",
      ];

      // モックfetchを設定
      const mockFetch = createMockFetch();
      global.fetch = mockFetch;

      // weapon-list.jsonの読み込みをモック
      vi.spyOn(fs, "readFile").mockResolvedValue(
        JSON.stringify(createMockWeaponList())
      );

      try {
        // メイン関数を実行（process.exitをモック）
        const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
          throw new Error("process.exit called");
        });

        try {
          await main();
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === "process.exit called"
          ) {
            // process.exitが呼ばれた場合は正常終了とみなす
          } else {
            throw error;
          }
        } finally {
          mockExit.mockRestore();
        }

        // 出力ディレクトリが作成されているか確認
        const dirExists = await fs
          .access(testOutputDir)
          .then(() => true)
          .catch(() => false);
        expect(dirExists).toBe(true);

        // 処理レポートが生成されているか確認
        const reportExists = await fs
          .access("weapon-icon-download-report.md")
          .then(() => true)
          .catch(() => false);
        expect(reportExists).toBe(true);
      } finally {
        process.argv = originalArgv;
      }
    }, 30000);
  });

  describe("エラーシナリオテスト", () => {
    it("weapon-list.json読み込みエラー時のグレースフル劣化", async () => {
      // ファイル読み込みエラーを発生させるモック
      vi.spyOn(fs, "readFile").mockRejectedValue(
        new Error("ENOENT: no such file or directory")
      );

      const config = createTestWeaponIconConfig();
      const fileLoader = new FileLoader();
      const weaponIconProcessor = new WeaponIconProcessor(config);
      const weaponIconGenerator = new WeaponIconGenerator(
        fileLoader,
        weaponIconProcessor,
        config
      );

      await expect(weaponIconGenerator.generateWeaponIcons()).rejects.toThrow(
        "ENOENT"
      );
    });

    it("無効なJSONファイル時の処理", async () => {
      // 無効なJSONを返すモック
      vi.spyOn(fs, "readFile").mockResolvedValue("invalid json content");

      const config = createTestWeaponIconConfig();
      const fileLoader = new FileLoader();
      const weaponIconProcessor = new WeaponIconProcessor(config);
      const weaponIconGenerator = new WeaponIconGenerator(
        fileLoader,
        weaponIconProcessor,
        config
      );

      await expect(weaponIconGenerator.generateWeaponIcons()).rejects.toThrow();
    });

    it("ネットワークエラー時のリトライ機構", async () => {
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          throw new Error("Network timeout");
        }
        return Promise.resolve({
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
                  value: new Uint8Array(1024),
                })
                .mockResolvedValue({ done: true }),
              releaseLock: vi.fn(),
            }),
          },
        });
      });
      global.fetch = mockFetch;

      // リトライ回数を設定
      const config = createTestWeaponIconConfig();
      config.retryAttempts = 3;
      config.retryDelayMs = 100;

      const weaponIconProcessor = new WeaponIconProcessor(config);

      // 単一の武器エントリでテスト
      const testEntry = createMockWeaponList()[0];
      const result = await weaponIconProcessor.processWeaponIcon(testEntry);

      // リトライ後に成功することを確認
      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(2);
      expect(callCount).toBe(3);
    });

    it("ファイルシステムエラー時の処理", async () => {
      // 書き込み権限のないディレクトリを指定
      const config = createTestWeaponIconConfig();
      config.outputDirectory = "/root/readonly";

      const mockFetch = createMockFetch();
      global.fetch = mockFetch;

      // weapon-list.jsonの読み込みをモック
      vi.spyOn(fs, "readFile").mockResolvedValue(
        JSON.stringify(createMockWeaponList())
      );

      const fileLoader = new FileLoader();
      const weaponIconProcessor = new WeaponIconProcessor(config);
      const weaponIconGenerator = new WeaponIconGenerator(
        fileLoader,
        weaponIconProcessor,
        config
      );

      // ディレクトリ検証でエラーが発生することを期待
      await expect(weaponIconGenerator.generateWeaponIcons()).rejects.toThrow();
    });

    it("無効なアイコンURL時の処理", async () => {
      // 無効なURLを含む武器リストを作成
      const invalidWeaponList = [
        {
          entry_page_id: "999",
          name: "Invalid Weapon",
          icon_url: "invalid-url",
          filter_values: {
            w_engine_rarity: {
              values: ["S"],
            },
          },
        },
      ];

      vi.spyOn(fs, "readFile").mockResolvedValue(
        JSON.stringify(invalidWeaponList)
      );

      const config = createTestWeaponIconConfig();
      const fileLoader = new FileLoader();
      const weaponIconProcessor = new WeaponIconProcessor(config);
      const weaponIconGenerator = new WeaponIconGenerator(
        fileLoader,
        weaponIconProcessor,
        config
      );

      const result = await weaponIconGenerator.generateWeaponIcons();

      expect(result.statistics.failed).toBe(1);
      expect(result.failed[0].error).toContain("アイコン URL が見つかりません");
    });
  });

  describe("パフォーマンステスト", () => {
    it("並行処理が適切に動作する", async () => {
      const config = createTestWeaponIconConfig();
      config.maxConcurrency = 3;
      config.requestDelayMs = 100;

      const mockFetch = createMockFetch();
      global.fetch = mockFetch;

      // weapon-list.jsonの読み込みをモック
      vi.spyOn(fs, "readFile").mockResolvedValue(
        JSON.stringify(createMockWeaponList())
      );

      const fileLoader = new FileLoader();
      const weaponIconProcessor = new WeaponIconProcessor(config);
      const weaponIconGenerator = new WeaponIconGenerator(
        fileLoader,
        weaponIconProcessor,
        config
      );

      const startTime = Date.now();
      const result = await weaponIconGenerator.generateWeaponIcons();
      const endTime = Date.now();

      // 並行処理により、シーケンシャル処理より高速であることを確認
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(result.statistics.total * 1000);

      // 成功率が適切であることを確認
      const successRate =
        result.statistics.successful / result.statistics.total;
      expect(successRate).toBeGreaterThan(0.8);
    });

    it("メモリ使用量が適切に管理される", async () => {
      const config = createTestWeaponIconConfig();
      const mockFetch = createMockFetch();
      global.fetch = mockFetch;

      // 大量の武器エントリを生成
      const largeWeaponList = Array.from({ length: 20 }, (_, i) => ({
        entry_page_id: `${900 + i}`,
        name: `Test Weapon ${i}`,
        icon_url: `https://act-webstatic.hoyoverse.com/test/weapon-${i}.png`,
        filter_values: {
          w_engine_rarity: {
            values: [i % 2 === 0 ? "S" : "A"],
          },
        },
      }));

      vi.spyOn(fs, "readFile").mockResolvedValue(
        JSON.stringify(largeWeaponList)
      );

      const fileLoader = new FileLoader();
      const weaponIconProcessor = new WeaponIconProcessor(config);
      const weaponIconGenerator = new WeaponIconGenerator(
        fileLoader,
        weaponIconProcessor,
        config
      );

      // メモリ使用量を監視
      const initialMemory = process.memoryUsage();

      await weaponIconGenerator.generateWeaponIcons();

      const finalMemory = process.memoryUsage();

      // メモリリークがないことを確認
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB未満
    });

    it("レアリティフィルタリングのパフォーマンス", async () => {
      // B級武器を多く含むリストを作成
      const mixedRarityList = [
        ...Array.from({ length: 10 }, (_, i) => ({
          entry_page_id: `${800 + i}`,
          name: `B Weapon ${i}`,
          icon_url: `https://act-webstatic.hoyoverse.com/test/b-weapon-${i}.png`,
          filter_values: {
            w_engine_rarity: {
              values: ["B"],
            },
          },
        })),
        ...createMockWeaponList(), // S, A級武器
      ];

      vi.spyOn(fs, "readFile").mockResolvedValue(
        JSON.stringify(mixedRarityList)
      );

      const config = createTestWeaponIconConfig();
      const mockFetch = createMockFetch();
      global.fetch = mockFetch;

      const fileLoader = new FileLoader();
      const weaponIconProcessor = new WeaponIconProcessor(config);
      const weaponIconGenerator = new WeaponIconGenerator(
        fileLoader,
        weaponIconProcessor,
        config
      );

      const result = await weaponIconGenerator.generateWeaponIcons();

      // B級武器は除外され、S・A級のみが処理されることを確認
      expect(result.statistics.total).toBe(3); // S級2個 + A級1個のみ
      expect(result.statistics.successful).toBe(3);
    });
  });
  describe("設定管理テスト", () => {
    it("カスタム設定が正しく適用される", async () => {
      // カスタム設定でテスト
      const customConfig = {
        weaponIconDownload: {
          outputDirectory: "custom-weapon-output",
          maxConcurrency: 5,
          retryAttempts: 5,
          retryDelayMs: 2000,
          requestDelayMs: 1000,
          skipExisting: false,
          validateDownloads: false,
          maxFileSizeMB: 20,
        },
      };

      await fs.writeFile(
        "custom-test-weapon-config.json",
        JSON.stringify(customConfig, null, 2)
      );

      const configManager = ConfigManager.getInstance(
        "custom-test-weapon-config.json"
      );
      const config = configManager.getWeaponIconConfig();

      expect(config.outputDirectory).toBe("custom-weapon-output");
      expect(config.maxConcurrency).toBe(5);
      expect(config.retryAttempts).toBe(5);
      expect(config.retryDelayMs).toBe(2000);
      expect(config.requestDelayMs).toBe(1000);
      expect(config.skipExisting).toBe(false);
      expect(config.validateDownloads).toBe(false);
      expect(config.maxFileSizeMB).toBe(20);

      // クリーンアップ
      await fs.unlink("custom-test-weapon-config.json").catch(() => {});
    });

    it("デフォルト設定の検証", async () => {
      const configManager = ConfigManager.getInstance(testConfigPath);
      const config = configManager.getWeaponIconConfig();

      expect(config.outputDirectory).toBe(testOutputDir);
      expect(config.maxConcurrency).toBe(2);
      expect(config.retryAttempts).toBe(2);
      expect(config.retryDelayMs).toBe(100);
      expect(config.requestDelayMs).toBe(50);
      expect(config.skipExisting).toBe(true);
      expect(config.validateDownloads).toBe(true);
      expect(config.maxFileSizeMB).toBe(10);
    });
  });

  describe("レアリティフィルタリングテスト", () => {
    it("S級武器のみが処理される", async () => {
      const sOnlyWeaponList = [
        {
          entry_page_id: "936",
          name: "S級武器1",
          icon_url: "https://act-webstatic.hoyoverse.com/test/s1.png",
          filter_values: {
            w_engine_rarity: {
              values: ["S"],
            },
          },
        },
        {
          entry_page_id: "937",
          name: "S級武器2",
          icon_url: "https://act-webstatic.hoyoverse.com/test/s2.png",
          filter_values: {
            w_engine_rarity: {
              values: ["S"],
            },
          },
        },
      ];

      vi.spyOn(fs, "readFile").mockResolvedValue(
        JSON.stringify(sOnlyWeaponList)
      );

      const config = createTestWeaponIconConfig();
      const mockFetch = createMockFetch();
      global.fetch = mockFetch;

      const fileLoader = new FileLoader();
      const weaponIconProcessor = new WeaponIconProcessor(config);
      const weaponIconGenerator = new WeaponIconGenerator(
        fileLoader,
        weaponIconProcessor,
        config
      );

      const result = await weaponIconGenerator.generateWeaponIcons();

      expect(result.statistics.total).toBe(2);
      expect(result.statistics.successful).toBe(2);
      expect(
        result.successful.every((item) => item.weaponName.includes("S級"))
      ).toBe(true);
    });

    it("A級武器のみが処理される", async () => {
      const aOnlyWeaponList = [
        {
          entry_page_id: "935",
          name: "A級武器1",
          icon_url: "https://act-webstatic.hoyoverse.com/test/a1.png",
          filter_values: {
            w_engine_rarity: {
              values: ["A"],
            },
          },
        },
      ];

      vi.spyOn(fs, "readFile").mockResolvedValue(
        JSON.stringify(aOnlyWeaponList)
      );

      const config = createTestWeaponIconConfig();
      const mockFetch = createMockFetch();
      global.fetch = mockFetch;

      const fileLoader = new FileLoader();
      const weaponIconProcessor = new WeaponIconProcessor(config);
      const weaponIconGenerator = new WeaponIconGenerator(
        fileLoader,
        weaponIconProcessor,
        config
      );

      const result = await weaponIconGenerator.generateWeaponIcons();

      expect(result.statistics.total).toBe(1);
      expect(result.statistics.successful).toBe(1);
      expect(result.successful[0].weaponName).toBe("A級武器1");
    });

    it("B級武器は完全に除外される", async () => {
      const bOnlyWeaponList = [
        {
          entry_page_id: "934",
          name: "B級武器1",
          icon_url: "https://act-webstatic.hoyoverse.com/test/b1.png",
          filter_values: {
            w_engine_rarity: {
              values: ["B"],
            },
          },
        },
        {
          entry_page_id: "933",
          name: "B級武器2",
          icon_url: "https://act-webstatic.hoyoverse.com/test/b2.png",
          filter_values: {
            w_engine_rarity: {
              values: ["B"],
            },
          },
        },
      ];

      vi.spyOn(fs, "readFile").mockResolvedValue(
        JSON.stringify(bOnlyWeaponList)
      );

      const config = createTestWeaponIconConfig();
      const mockFetch = createMockFetch();
      global.fetch = mockFetch;

      const fileLoader = new FileLoader();
      const weaponIconProcessor = new WeaponIconProcessor(config);
      const weaponIconGenerator = new WeaponIconGenerator(
        fileLoader,
        weaponIconProcessor,
        config
      );

      const result = await weaponIconGenerator.generateWeaponIcons();

      // B級武器は処理対象から除外されるため、総数は0
      expect(result.statistics.total).toBe(0);
      expect(result.statistics.successful).toBe(0);
      expect(result.statistics.failed).toBe(0);
    });
  });

  // ヘルパー関数

  async function cleanupTestDirectory(): Promise<void> {
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
      await fs.rm("test-assets", { recursive: true, force: true });
      await fs.rm("custom-weapon-output", { recursive: true, force: true });
    } catch {
      // ディレクトリが存在しない場合は無視
    }
  }

  async function cleanupTestFiles(): Promise<void> {
    const filesToCleanup = [
      testConfigPath,
      testWeaponListPath,
      "weapon-icon-download-report.md",
      "custom-test-weapon-config.json",
    ];

    for (const file of filesToCleanup) {
      try {
        await fs.unlink(file);
      } catch {
        // ファイルが存在しない場合は無視
      }
    }

    await cleanupTestDirectory();
  }

  async function createTestConfig(): Promise<void> {
    const testConfig = {
      weaponIconDownload: {
        outputDirectory: testOutputDir,
        maxConcurrency: 2,
        retryAttempts: 2,
        retryDelayMs: 100,
        requestDelayMs: 50,
        skipExisting: true,
        validateDownloads: true,
        maxFileSizeMB: 10,
        allowedExtensions: [".png", ".jpg", ".jpeg", ".webp"],
      },
    };

    await fs.writeFile(testConfigPath, JSON.stringify(testConfig, null, 2));
  }

  async function createTestWeaponListFile(): Promise<void> {
    const weaponList = createMockWeaponList();
    await fs.writeFile(testWeaponListPath, JSON.stringify(weaponList, null, 2));
  }

  function createTestWeaponIconConfig(): WeaponIconConfig {
    return {
      outputDirectory: testOutputDir,
      maxConcurrency: 2,
      retryAttempts: 2,
      retryDelayMs: 100,
      requestDelayMs: 50,
      skipExisting: true,
      validateDownloads: true,
      maxFileSizeMB: 10,
      allowedExtensions: [".png", ".jpg", ".jpeg", ".webp"],
    };
  }

  function createMockWeaponList(): any[] {
    return [
      {
        entry_page_id: "936",
        name: "燔火の朧夜",
        icon_url:
          "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2025/10/14/test1.png",
        filter_values: {
          w_engine_rarity: {
            values: ["S"],
          },
        },
        desc: "S級武器",
      },
      {
        entry_page_id: "935",
        name: "炉で歌い上げられる夢",
        icon_url:
          "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2025/10/14/test2.png",
        filter_values: {
          w_engine_rarity: {
            values: ["A"],
          },
        },
        desc: "A級武器",
      },
      {
        entry_page_id: "937",
        name: "テスト武器S",
        icon_url:
          "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2025/10/14/test3.png",
        filter_values: {
          w_engine_rarity: {
            values: ["S"],
          },
        },
        desc: "S級武器2",
      },
      // B級武器（処理対象外）
      {
        entry_page_id: "934",
        name: "B級武器",
        icon_url:
          "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2025/10/14/test-b.png",
        filter_values: {
          w_engine_rarity: {
            values: ["B"],
          },
        },
        desc: "B級武器（除外対象）",
      },
    ];
  }

  function createMockFetch(): any {
    return vi.fn().mockResolvedValue({
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
  }
});
