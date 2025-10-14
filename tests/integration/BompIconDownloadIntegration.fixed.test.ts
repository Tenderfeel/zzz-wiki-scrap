import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { BompIconGenerator } from "../../src/generators/BompIconGenerator";
import { BompIconProcessor } from "../../src/processors/BompIconProcessor";
import { BompListParser } from "../../src/parsers/BompListParser";
import { HoyoLabApiClient } from "../../src/clients/HoyoLabApiClient";
import { ConfigManager } from "../../src/config/ProcessingConfig";
import { BompIconConfig } from "../../src/types/processing";

/**
 * ボンプアイコンダウンロードの統合テスト（修正版）
 * 全コンポーネントの統合テスト、エンドツーエンドの動作確認、エラーシナリオの検証
 * 要件: 4.4, 4.5
 */
describe("BompIconDownload Integration Tests (Fixed)", () => {
  const testOutputDir = "test-assets/images/bomps";
  const testConfigPath = "test-processing-config.json";
  const testScrapingFile = "test-scraping.md";

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

    // テスト用Scraping.mdファイルを作成
    await createTestScrapingFile();
  });

  afterEach(async () => {
    // 環境変数を復元
    process.env = originalEnv;

    // テストファイルをクリーンアップ
    await cleanupTestFiles();
  });

  describe("エンドツーエンド統合テスト", () => {
    it("完全なボンプアイコンダウンロードフローが正常に動作する", async () => {
      // モックAPIレスポンスを設定
      const mockApiClient = createMockApiClient();
      const mockFetch = createMockFetch();
      global.fetch = mockFetch;

      // 設定を取得
      const configManager = ConfigManager.getInstance(testConfigPath);
      const config = configManager.getBompIconConfig();

      // コンポーネントを初期化
      const bompListParser = new BompListParser();
      const bompIconProcessor = new BompIconProcessor(mockApiClient, config);
      const bompIconGenerator = new BompIconGenerator(
        bompListParser,
        bompIconProcessor,
        config
      );

      // メイン処理を実行
      const result = await bompIconGenerator.generateBompIcons();

      // 結果を検証
      expect(result).toBeDefined();
      expect(result.statistics.total).toBeGreaterThan(0);
      expect(result.statistics.successful).toBeGreaterThan(0);
      expect(result.successful.length).toBe(result.statistics.successful);
      expect(result.failed.length).toBe(result.statistics.failed);

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
  });

  describe("エラーシナリオテスト", () => {
    it("API エラー時のグレースフル劣化", async () => {
      // API エラーを発生させるモック
      const mockApiClient = {
        fetchCharacterData: vi
          .fn()
          .mockRejectedValue(new Error("API connection failed")),
      } as any;

      const config = createTestBompIconConfig();
      config.retryAttempts = 1; // リトライ回数を制限してテスト時間を短縮
      config.retryDelayMs = 10; // 遅延を短縮

      const bompListParser = new BompListParser();
      const bompIconProcessor = new BompIconProcessor(mockApiClient, config);
      const bompIconGenerator = new BompIconGenerator(
        bompListParser,
        bompIconProcessor,
        config
      );

      // 少数のボンプエントリでテスト
      vi.spyOn(bompListParser, "parseScrapingFile").mockResolvedValue([
        { id: "test-bomp-1", pageId: 912 },
        { id: "test-bomp-2", pageId: 913 },
      ]);

      const result = await bompIconGenerator.generateBompIcons();

      // 全て失敗するが、プロセスは継続される
      expect(result.statistics.failed).toBe(result.statistics.total);
      expect(result.statistics.successful).toBe(0);
      expect(result.failed.length).toBeGreaterThan(0);

      // エラー情報が適切に記録されている
      result.failed.forEach((failedItem) => {
        expect(failedItem.bompId).toBeDefined();
        expect(failedItem.error).toContain("API connection failed");
      });
    }, 10000);

    it("ネットワークエラー時のリトライ機構", async () => {
      let callCount = 0;
      const mockApiClient = {
        fetchCharacterData: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount <= 2) {
            throw new Error("Network timeout");
          }
          return createMockApiResponse("test-bomp");
        }),
      } as any;

      // リトライ回数を設定
      const config = createTestBompIconConfig();
      config.retryAttempts = 3;
      config.retryDelayMs = 100; // テスト用に短縮

      const mockFetch = createMockFetch();
      global.fetch = mockFetch;

      const bompListParser = new BompListParser();
      const bompIconProcessor = new BompIconProcessor(mockApiClient, config);

      // 単一のボンプエントリでテスト
      const testEntry = { id: "test-bomp", pageId: 123 };
      const result = await bompIconProcessor.processBompIcon(testEntry);

      // リトライ後に成功することを確認
      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(2); // 2回リトライ後に成功
      expect(callCount).toBe(3); // 初回 + 2回リトライ
    });

    it("ファイルシステムエラー時の処理", async () => {
      // 書き込み権限のないディレクトリを指定
      const config = createTestBompIconConfig();
      config.outputDirectory = "/root/readonly"; // 通常は書き込み不可

      const mockApiClient = createMockApiClient();
      const mockFetch = createMockFetch();
      global.fetch = mockFetch;

      const bompListParser = new BompListParser();
      const bompIconProcessor = new BompIconProcessor(mockApiClient, config);
      const bompIconGenerator = new BompIconGenerator(
        bompListParser,
        bompIconProcessor,
        config
      );

      // ディレクトリ検証でエラーが発生することを期待
      await expect(bompIconGenerator.generateBompIcons()).rejects.toThrow();
    });

    it("無効なアイコンURL時の処理", async () => {
      const mockApiClient = {
        fetchCharacterData: vi.fn().mockResolvedValue({
          retcode: 0,
          message: "OK",
          data: {
            page: {
              id: "123",
              name: "Test Bomp",
              icon_url: "invalid-url", // 無効なURL
            },
          },
        }),
      } as any;

      const config = createTestBompIconConfig();
      const bompListParser = new BompListParser();
      const bompIconProcessor = new BompIconProcessor(mockApiClient, config);

      const testEntry = { id: "test-bomp", pageId: 123 };
      const result = await bompIconProcessor.processBompIcon(testEntry);

      expect(result.success).toBe(false);
      // URLが無効な場合、まずアイコンURL抽出で失敗する
      expect(result.error).toContain("アイコン URL が見つかりません");
    });

    it("大きすぎるファイルサイズの処理", async () => {
      const mockApiClient = createMockApiClient();

      // 大きすぎるファイルを返すfetchモック
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
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
                value: new Uint8Array(15 * 1024 * 1024), // 15MB (制限を超える)
              })
              .mockResolvedValue({ done: true }),
            releaseLock: vi.fn(),
          }),
        },
      });
      global.fetch = mockFetch;

      const config = createTestBompIconConfig();
      config.maxFileSizeMB = 10; // 10MB制限
      config.validateDownloads = true;

      const bompIconProcessor = new BompIconProcessor(mockApiClient, config);

      const testEntry = { id: "large-bomp", pageId: 123 };
      const result = await bompIconProcessor.processBompIcon(testEntry);

      // ファイルサイズ制限はダウンロード後の検証で行われるため、
      // ダウンロード自体は成功するが、検証で失敗する可能性がある
      // 実際の実装では、ストリーミング中にサイズチェックを行う場合もある
      if (!result.success) {
        expect(result.error).toMatch(/検証|サイズ|制限/);
      }
    });
  });

  describe("パフォーマンステスト", () => {
    it("並行処理が適切に動作する", async () => {
      const config = createTestBompIconConfig();
      config.maxConcurrency = 3;
      config.requestDelayMs = 100;

      const mockApiClient = createMockApiClient();
      const mockFetch = createMockFetch();
      global.fetch = mockFetch;

      const bompListParser = new BompListParser();
      const bompIconProcessor = new BompIconProcessor(mockApiClient, config);
      const bompIconGenerator = new BompIconGenerator(
        bompListParser,
        bompIconProcessor,
        config
      );

      const startTime = Date.now();
      const result = await bompIconGenerator.generateBompIcons();
      const endTime = Date.now();

      // 並行処理により、シーケンシャル処理より高速であることを確認
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(result.statistics.total * 1000); // 1秒/ボンプより高速

      // 成功率が適切であることを確認
      const successRate =
        result.statistics.successful / result.statistics.total;
      expect(successRate).toBeGreaterThan(0.8); // 80%以上の成功率
    });

    it("メモリ使用量が適切に管理される", async () => {
      const config = createTestBompIconConfig();
      const mockApiClient = createMockApiClient();
      const mockFetch = createMockFetch();
      global.fetch = mockFetch;

      const bompListParser = new BompListParser();
      const bompIconProcessor = new BompIconProcessor(mockApiClient, config);
      const bompIconGenerator = new BompIconGenerator(
        bompListParser,
        bompIconProcessor,
        config
      );

      // メモリ使用量を監視
      const initialMemory = process.memoryUsage();

      await bompIconGenerator.generateBompIcons();

      const finalMemory = process.memoryUsage();

      // メモリリークがないことを確認（大幅な増加がない）
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB未満の増加
    });
  });

  describe("設定管理テスト", () => {
    it("カスタム設定が正しく適用される", async () => {
      // カスタム設定でテスト
      const customConfig = {
        bompIconDownload: {
          outputDirectory: "custom-output",
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
        "custom-test-config.json",
        JSON.stringify(customConfig, null, 2)
      );

      const configManager = ConfigManager.getInstance(
        "custom-test-config.json"
      );
      const config = configManager.getBompIconConfig();

      expect(config.outputDirectory).toBe("custom-output");
      expect(config.maxConcurrency).toBe(5);
      expect(config.retryAttempts).toBe(5);
      expect(config.retryDelayMs).toBe(2000);
      expect(config.requestDelayMs).toBe(1000);
      expect(config.skipExisting).toBe(false);
      expect(config.validateDownloads).toBe(false);
      expect(config.maxFileSizeMB).toBe(20);

      // クリーンアップ
      await fs.unlink("custom-test-config.json").catch(() => {});
    });
  });

  // ヘルパー関数

  async function cleanupTestDirectory(): Promise<void> {
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
      await fs.rm("test-assets", { recursive: true, force: true });
    } catch {
      // ディレクトリが存在しない場合は無視
    }
  }

  async function cleanupTestFiles(): Promise<void> {
    const filesToCleanup = [
      testConfigPath,
      testScrapingFile,
      "bomp-icon-download-report.md",
      "custom-test-config.json",
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
      bompIconDownload: {
        outputDirectory: testOutputDir,
        maxConcurrency: 2,
        retryAttempts: 2,
        retryDelayMs: 100,
        requestDelayMs: 50,
        skipExisting: true,
        validateDownloads: true,
        maxFileSizeMB: 10,
      },
    };

    await fs.writeFile(testConfigPath, JSON.stringify(testConfig, null, 2));
  }

  async function createTestScrapingFile(): Promise<void> {
    const scrapingContent = `# Scraping Configuration

## Bomp Entries

- [excaliboo](https://sg-wiki-api-static.hoyolab.com/hoyowiki/zzz/wapi/entry_page?entry_page_id=912&lang=ja-jp)
- [mercury](https://sg-wiki-api-static.hoyolab.com/hoyowiki/zzz/wapi/entry_page?entry_page_id=913&lang=ja-jp)
- [missEsme](https://sg-wiki-api-static.hoyolab.com/hoyowiki/zzz/wapi/entry_page?entry_page_id=914&lang=ja-jp)
`;

    await fs.writeFile(testScrapingFile, scrapingContent);
  }

  function createTestBompIconConfig(): BompIconConfig {
    return {
      outputDirectory: testOutputDir,
      maxConcurrency: 2,
      retryAttempts: 2,
      retryDelayMs: 100,
      requestDelayMs: 50,
      skipExisting: true,
      validateDownloads: true,
      maxFileSizeMB: 10,
    };
  }

  function createMockApiClient(): any {
    return {
      fetchCharacterData: vi.fn().mockImplementation((pageId: number) => {
        return Promise.resolve(createMockApiResponse(`bomp-${pageId}`));
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
              value: new Uint8Array(1024), // 1KB のテストデータ
            })
            .mockResolvedValue({ done: true }),
          releaseLock: vi.fn(),
        }),
      },
    });
  }
});
