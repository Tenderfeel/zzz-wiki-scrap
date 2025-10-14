import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import { BompIconProcessor } from "../../src/processors/BompIconProcessor";
import { BompIconGenerator } from "../../src/generators/BompIconGenerator";
import { BompListParser } from "../../src/parsers/BompListParser";
import { HoyoLabApiClient } from "../../src/clients/HoyoLabApiClient";
import { BompIconConfig } from "../../src/types/processing";
import {
  BompIconDownloadError,
  BompIconValidationError,
  BompIconSecurityError,
  BompIconFileSystemError,
  BompIconBatchError,
} from "../../src/errors";

/**
 * ボンプアイコンダウンロードのエラーシナリオテスト
 * 様々なエラー状況での動作を検証し、システムの堅牢性を確保
 * 要件: 4.5
 */
describe("BompIcon Error Scenarios", () => {
  const testOutputDir = "test-error-assets/images/bomps";
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    // 環境変数を設定
    process.env.NODE_ENV = "test";
    process.env.VITEST = "true";

    // 元のfetchを保存
    originalFetch = global.fetch;

    // テスト用ディレクトリをクリーンアップ
    await cleanupTestDirectory();
  });

  afterEach(async () => {
    // fetchを復元
    global.fetch = originalFetch;

    // テストファイルをクリーンアップ
    await cleanupTestDirectory();
  });

  describe("API エラーシナリオ", () => {
    it("API レスポンスが null の場合", async () => {
      const mockApiClient = {
        fetchCharacterData: vi.fn().mockResolvedValue(null),
      } as any;

      const config = createTestConfig();
      const processor = new BompIconProcessor(mockApiClient, config);

      const result = await processor.processBompIcon({
        id: "test-bomp",
        pageId: 123,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("API レスポンスに icon_url が存在しない場合", async () => {
      const mockApiClient = {
        fetchCharacterData: vi.fn().mockResolvedValue({
          retcode: 0,
          message: "OK",
          data: {
            page: {
              id: "123",
              name: "Test Bomp",
              // icon_url が存在しない
            },
          },
        }),
      } as any;

      const config = createTestConfig();
      const processor = new BompIconProcessor(mockApiClient, config);

      const result = await processor.processBompIcon({
        id: "test-bomp",
        pageId: 123,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("アイコン URL が見つかりません");
    });

    it("API が HTTP エラーを返す場合", async () => {
      const mockApiClient = {
        fetchCharacterData: vi
          .fn()
          .mockRejectedValue(new Error("HTTP 500: Internal Server Error")),
      } as any;

      const config = createTestConfig();
      config.retryAttempts = 1; // リトライ回数を制限

      const processor = new BompIconProcessor(mockApiClient, config);

      const result = await processor.processBompIcon({
        id: "test-bomp",
        pageId: 123,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("HTTP 500");
      expect(result.retryCount).toBe(1);
    });

    it("API タイムアウトエラー", async () => {
      const mockApiClient = {
        fetchCharacterData: vi.fn().mockImplementation(() => {
          return new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Request timeout")), 100);
          });
        }),
      } as any;

      const config = createTestConfig();
      config.retryAttempts = 1;
      config.retryDelayMs = 50;

      const processor = new BompIconProcessor(mockApiClient, config);

      const result = await processor.processBompIcon({
        id: "timeout-bomp",
        pageId: 123,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("timeout");
    });
  });

  describe("ダウンロードエラーシナリオ", () => {
    it("HTTP 404 エラー", async () => {
      const mockApiClient = createMockApiClient();

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const config = createTestConfig();
      const processor = new BompIconProcessor(mockApiClient, config);

      const result = await processor.processBompIcon({
        id: "not-found-bomp",
        pageId: 123,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("HTTP 404");
    });

    it("HTTP 403 Forbidden エラー", async () => {
      const mockApiClient = createMockApiClient();

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      });

      const config = createTestConfig();
      const processor = new BompIconProcessor(mockApiClient, config);

      const result = await processor.processBompIcon({
        id: "forbidden-bomp",
        pageId: 123,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("HTTP 403");
    });

    it("ネットワーク接続エラー", async () => {
      const mockApiClient = createMockApiClient();

      global.fetch = vi
        .fn()
        .mockRejectedValue(new Error("Network connection failed"));

      const config = createTestConfig();
      config.retryAttempts = 2;

      const processor = new BompIconProcessor(mockApiClient, config);

      const result = await processor.processBompIcon({
        id: "network-error-bomp",
        pageId: 123,
      });

      expect(result.success).toBe(false);
      expect(result.retryCount).toBe(2);
    });

    it("レスポンスボディが空の場合", async () => {
      const mockApiClient = createMockApiClient();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => "image/png",
        },
        body: null, // ボディが空
      });

      const config = createTestConfig();
      const processor = new BompIconProcessor(mockApiClient, config);

      const result = await processor.processBompIcon({
        id: "empty-body-bomp",
        pageId: 123,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("レスポンスボディが空");
    });
  });

  describe("セキュリティエラーシナリオ", () => {
    it("無効なドメインの URL", async () => {
      const mockApiClient = {
        fetchCharacterData: vi.fn().mockResolvedValue({
          retcode: 0,
          message: "OK",
          data: {
            page: {
              id: "123",
              name: "Test Bomp",
              icon_url: "https://malicious-site.com/icon.png", // 無効なドメイン
            },
          },
        }),
      } as any;

      const config = createTestConfig();
      const processor = new BompIconProcessor(mockApiClient, config);

      const result = await processor.processBompIcon({
        id: "malicious-bomp",
        pageId: 123,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("セキュリティ検証に失敗");
    });

    it("ディレクトリトラバーサル攻撃", async () => {
      const mockApiClient = createMockApiClient();
      const config = createTestConfig();

      // 危険なボンプIDを使用
      const dangerousBompId = "../../../etc/passwd";

      expect(() => {
        const processor = new BompIconProcessor(mockApiClient, config);
        processor.generateLocalPath(dangerousBompId);
      }).toThrow();
    });

    it("無効なコンテンツタイプ", async () => {
      const mockApiClient = createMockApiClient();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => {
            if (name === "content-type") return "text/html"; // 画像ではない
            return null;
          },
        },
        body: {
          getReader: () => ({
            read: vi.fn().mockResolvedValue({ done: true }),
            releaseLock: vi.fn(),
          }),
        },
      });

      const config = createTestConfig();
      const processor = new BompIconProcessor(mockApiClient, config);

      const result = await processor.processBompIcon({
        id: "invalid-content-bomp",
        pageId: 123,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("無効なコンテンツタイプ");
    });
  });

  describe("ファイルシステムエラーシナリオ", () => {
    it("書き込み権限がないディレクトリ", async () => {
      const config = createTestConfig();
      config.outputDirectory = "/root/readonly-dir"; // 通常は書き込み不可

      const mockApiClient = createMockApiClient();
      const bompListParser = new BompListParser();
      const processor = new BompIconProcessor(mockApiClient, config);
      const generator = new BompIconGenerator(
        bompListParser,
        processor,
        config
      );

      await expect(generator.generateBompIcons()).rejects.toThrow();
    });

    it("ディスク容量不足のシミュレーション", async () => {
      const mockApiClient = createMockApiClient();

      // 巨大なファイルを返すモック
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
                value: new Uint8Array(1024 * 1024), // 1MB
              })
              .mockImplementation(() => {
                throw new Error("ENOSPC: no space left on device");
              }),
            releaseLock: vi.fn(),
          }),
        },
      });

      const config = createTestConfig();
      const processor = new BompIconProcessor(mockApiClient, config);

      const result = await processor.processBompIcon({
        id: "large-file-bomp",
        pageId: 123,
      });

      expect(result.success).toBe(false);
    });
  });

  describe("バッチ処理エラーシナリオ", () => {
    it("一部のボンプが失敗しても処理が継続される", async () => {
      let callCount = 0;
      const mockApiClient = {
        fetchCharacterData: vi.fn().mockImplementation((pageId: number) => {
          callCount++;
          if (pageId === 913) {
            // 2番目のボンプでエラー
            throw new Error("Specific API error for bomp 913");
          }
          return Promise.resolve(createMockApiResponse(`bomp-${pageId}`));
        }),
      } as any;

      global.fetch = createMockFetch();

      // テスト用のScraping.mdを作成
      const scrapingContent = `# Test Scraping
- [bomp1](https://sg-wiki-api-static.hoyolab.com/hoyowiki/zzz/wapi/entry_page?entry_page_id=912&lang=ja-jp)
- [bomp2](https://sg-wiki-api-static.hoyolab.com/hoyowiki/zzz/wapi/entry_page?entry_page_id=913&lang=ja-jp)
- [bomp3](https://sg-wiki-api-static.hoyolab.com/hoyowiki/zzz/wapi/entry_page?entry_page_id=914&lang=ja-jp)
`;
      await fs.writeFile("test-scraping-error.md", scrapingContent);

      const config = createTestConfig();
      const bompListParser = new BompListParser();
      const processor = new BompIconProcessor(mockApiClient, config);
      const generator = new BompIconGenerator(
        bompListParser,
        processor,
        config
      );

      // parseScrapingFileをモック
      vi.spyOn(bompListParser, "parseScrapingFile").mockResolvedValue([
        { id: "bomp1", pageId: 912 },
        { id: "bomp2", pageId: 913 }, // これが失敗する
        { id: "bomp3", pageId: 914 },
      ]);

      const result = await generator.generateBompIcons();

      // 結果を検証
      expect(result.statistics.total).toBe(3);
      expect(result.statistics.successful).toBe(2); // 2つ成功
      expect(result.statistics.failed).toBe(1); // 1つ失敗
      expect(result.failed[0].bompId).toBe("bomp2");
      expect(result.failed[0].error).toContain("Specific API error");

      // クリーンアップ
      await fs.unlink("test-scraping-error.md").catch(() => {});
    });

    it("全てのボンプが失敗した場合", async () => {
      const mockApiClient = {
        fetchCharacterData: vi
          .fn()
          .mockRejectedValue(new Error("Complete API failure")),
      } as any;

      const config = createTestConfig();
      const bompListParser = new BompListParser();
      const processor = new BompIconProcessor(mockApiClient, config);
      const generator = new BompIconGenerator(
        bompListParser,
        processor,
        config
      );

      // parseScrapingFileをモック
      vi.spyOn(bompListParser, "parseScrapingFile").mockResolvedValue([
        { id: "bomp1", pageId: 912 },
        { id: "bomp2", pageId: 913 },
      ]);

      const result = await generator.generateBompIcons();

      expect(result.statistics.successful).toBe(0);
      expect(result.statistics.failed).toBe(2);
      expect(result.failed.length).toBe(2);
    });
  });

  describe("リトライ機構テスト", () => {
    it("指数バックオフによるリトライ遅延", async () => {
      let callCount = 0;
      const callTimes: number[] = [];

      const mockApiClient = {
        fetchCharacterData: vi.fn().mockImplementation(() => {
          callTimes.push(Date.now());
          callCount++;
          if (callCount <= 3) {
            throw new Error("Temporary failure");
          }
          return Promise.resolve(createMockApiResponse("retry-bomp"));
        }),
      } as any;

      global.fetch = createMockFetch();

      const config = createTestConfig();
      config.retryAttempts = 3;
      config.retryDelayMs = 100; // ベース遅延

      const processor = new BompIconProcessor(mockApiClient, config);

      const startTime = Date.now();
      const result = await processor.processBompIcon({
        id: "retry-bomp",
        pageId: 123,
      });
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(3);
      expect(callCount).toBe(4); // 初回 + 3回リトライ

      // 指数バックオフの確認（大まかな時間チェック）
      const totalTime = endTime - startTime;
      expect(totalTime).toBeGreaterThan(100 + 200 + 400); // 100ms + 200ms + 400ms
    });

    it("最大リトライ回数に達した場合", async () => {
      const mockApiClient = {
        fetchCharacterData: vi
          .fn()
          .mockRejectedValue(new Error("Persistent failure")),
      } as any;

      const config = createTestConfig();
      config.retryAttempts = 2;

      const processor = new BompIconProcessor(mockApiClient, config);

      const result = await processor.processBompIcon({
        id: "max-retry-bomp",
        pageId: 123,
      });

      expect(result.success).toBe(false);
      expect(result.retryCount).toBe(2);
      expect(result.error).toContain("Persistent failure");
    });
  });

  describe("メモリ管理エラーシナリオ", () => {
    it("大量のボンプ処理時のメモリ制限", async () => {
      const mockApiClient = createMockApiClient();
      global.fetch = createMockFetch();

      // 大量のボンプエントリを生成
      const largeBompList = Array.from({ length: 100 }, (_, i) => ({
        id: `bomp-${i}`,
        pageId: 900 + i,
      }));

      const config = createTestConfig();
      config.maxConcurrency = 10; // 高い並行数

      const bompListParser = new BompListParser();
      const processor = new BompIconProcessor(mockApiClient, config);
      const generator = new BompIconGenerator(
        bompListParser,
        processor,
        config
      );

      // parseScrapingFileをモック
      vi.spyOn(bompListParser, "parseScrapingFile").mockResolvedValue(
        largeBompList
      );

      const initialMemory = process.memoryUsage();
      const result = await generator.generateBompIcons();
      const finalMemory = process.memoryUsage();

      // メモリ使用量の増加が適切な範囲内であることを確認
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024); // 200MB未満

      expect(result.statistics.total).toBe(100);
    });
  });

  // ヘルパー関数

  async function cleanupTestDirectory(): Promise<void> {
    try {
      await fs.rm("test-error-assets", { recursive: true, force: true });
    } catch {
      // ディレクトリが存在しない場合は無視
    }
  }

  function createTestConfig(): BompIconConfig {
    return {
      outputDirectory: testOutputDir,
      maxConcurrency: 2,
      retryAttempts: 3,
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
