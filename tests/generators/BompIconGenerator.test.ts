import { describe, it, expect, vi, beforeEach } from "vitest";
import { BompIconGenerator } from "../../src/generators/BompIconGenerator";
import { BompListParser } from "../../src/parsers/BompListParser";
import { BompIconProcessor } from "../../src/processors/BompIconProcessor";
import { BompIconConfig } from "../../src/types/processing";

// モック設定
vi.mock("../../src/parsers/BompListParser");
vi.mock("../../src/processors/BompIconProcessor");
vi.mock("../../src/utils/Logger", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  LogMessages: {
    BOMP_ICON_GENERATION_START: "ボンプアイコンダウンロード処理を開始",
    BOMP_ICON_GENERATION_SUCCESS: "ボンプアイコンダウンロード処理完了",
    BOMP_ICON_GENERATION_ERROR: "ボンプアイコンダウンロード処理でエラーが発生",
    BOMP_ICON_BATCH_START: "バッチ処理開始",
    BOMP_ICON_BATCH_PROGRESS: "バッチ処理進捗",
    BOMP_ICON_BATCH_ERROR: "バッチ処理エラー",
    BOMP_ICON_BATCH_INDIVIDUAL_FALLBACK: "個別処理にフォールバック",
    BOMP_ICON_OUTPUT_DIRECTORY_VALIDATION: "出力ディレクトリ検証",
    BOMP_ICON_OUTPUT_DIRECTORY_CREATED: "出力ディレクトリを作成",
    BOMP_ICON_OUTPUT_DIRECTORY_WRITE_TEST: "出力ディレクトリ書き込み権限確認",
    BOMP_ICON_STATISTICS_SUMMARY: "ボンプアイコンダウンロード統計",
    BOMP_ICON_PERFORMANCE_METRICS: "パフォーマンス統計",
  },
}));

describe("BompIconGenerator", () => {
  let bompIconGenerator: BompIconGenerator;
  let mockBompListParser: vi.Mocked<BompListParser>;
  let mockBompIconProcessor: vi.Mocked<BompIconProcessor>;
  let mockConfig: BompIconConfig;

  beforeEach(() => {
    mockConfig = {
      outputDirectory: "test-assets/images/bomps",
      maxConcurrency: 3,
      retryAttempts: 3,
      retryDelayMs: 1000,
      requestDelayMs: 500,
      skipExisting: true,
      validateDownloads: true,
    };

    mockBompListParser = {
      parseScrapingFile: vi.fn(),
      extractBompEntries: vi.fn(),
      validateBompEntry: vi.fn(),
      displayStatistics: vi.fn(),
    } as any;

    mockBompIconProcessor = {
      processBompIcon: vi.fn(),
      extractIconUrl: vi.fn(),
      downloadIcon: vi.fn(),
      validateIconFile: vi.fn(),
      generateLocalPath: vi.fn(),
    } as any;

    bompIconGenerator = new BompIconGenerator(
      mockBompListParser,
      mockBompIconProcessor,
      mockConfig
    );
  });

  describe("constructor", () => {
    it("正しく初期化される", () => {
      expect(bompIconGenerator).toBeInstanceOf(BompIconGenerator);
    });
  });

  describe("generateBompIcons", () => {
    it("成功時に正しい結果を返す", async () => {
      // モックデータの設定
      const mockBompEntries = [
        {
          id: "excaliboo",
          pageId: 912,
          wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/912",
          jaName: "セイケンボンプ",
        },
        {
          id: "mercury",
          pageId: 913,
          wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/913",
          jaName: "マーキュリー",
        },
      ];

      const mockResults = [
        {
          success: true,
          bompId: "excaliboo",
          iconInfo: {
            bompId: "excaliboo",
            iconUrl: "https://example.com/icon1.png",
            localPath: "test-assets/images/bomps/excaliboo.png",
            fileSize: 1024,
            downloadedAt: new Date(),
          },
          retryCount: 0,
        },
        {
          success: true,
          bompId: "mercury",
          iconInfo: {
            bompId: "mercury",
            iconUrl: "https://example.com/icon2.png",
            localPath: "test-assets/images/bomps/mercury.png",
            fileSize: 2048,
            downloadedAt: new Date(),
          },
          retryCount: 0,
        },
      ];

      mockBompListParser.parseScrapingFile.mockResolvedValue(mockBompEntries);
      mockBompIconProcessor.processBompIcon.mockImplementation(
        async (entry) => {
          return mockResults.find((r) => r.bompId === entry.id)!;
        }
      );

      // ファイルシステムのモック
      const fs = await import("fs");
      vi.spyOn(fs.promises, "access").mockResolvedValue(undefined);
      vi.spyOn(fs.promises, "writeFile").mockResolvedValue(undefined);
      vi.spyOn(fs.promises, "unlink").mockResolvedValue(undefined);

      const result = await bompIconGenerator.generateBompIcons();

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.statistics.total).toBe(2);
      expect(result.statistics.successful).toBe(2);
      expect(result.statistics.failed).toBe(0);
      expect(result.statistics.totalSizeBytes).toBe(3072); // 1024 + 2048
    });

    it("部分的失敗時に正しい結果を返す", async () => {
      const mockBompEntries = [
        {
          id: "excaliboo",
          pageId: 912,
          wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/912",
          jaName: "セイケンボンプ",
        },
        {
          id: "mercury",
          pageId: 913,
          wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/913",
          jaName: "マーキュリー",
        },
      ];

      const mockResults = [
        {
          success: true,
          bompId: "excaliboo",
          iconInfo: {
            bompId: "excaliboo",
            iconUrl: "https://example.com/icon1.png",
            localPath: "test-assets/images/bomps/excaliboo.png",
            fileSize: 1024,
            downloadedAt: new Date(),
          },
          retryCount: 0,
        },
        {
          success: false,
          bompId: "mercury",
          error: "ダウンロードに失敗しました",
          retryCount: 3,
        },
      ];

      mockBompListParser.parseScrapingFile.mockResolvedValue(mockBompEntries);
      mockBompIconProcessor.processBompIcon.mockImplementation(
        async (entry) => {
          return mockResults.find((r) => r.bompId === entry.id)!;
        }
      );

      // ファイルシステムのモック
      const fs = await import("fs");
      vi.spyOn(fs.promises, "access").mockResolvedValue(undefined);
      vi.spyOn(fs.promises, "writeFile").mockResolvedValue(undefined);
      vi.spyOn(fs.promises, "unlink").mockResolvedValue(undefined);

      const result = await bompIconGenerator.generateBompIcons();

      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.statistics.total).toBe(2);
      expect(result.statistics.successful).toBe(1);
      expect(result.statistics.failed).toBe(1);
      expect(result.failed[0].bompId).toBe("mercury");
      expect(result.failed[0].error).toBe("ダウンロードに失敗しました");
    });
  });

  describe("processBompsBatch", () => {
    it("バッチ処理が正しく動作する", async () => {
      const mockBompEntries = [
        {
          id: "bomp1",
          pageId: 1,
          wikiUrl: "https://example.com/1",
          jaName: "ボンプ1",
        },
        {
          id: "bomp2",
          pageId: 2,
          wikiUrl: "https://example.com/2",
          jaName: "ボンプ2",
        },
        {
          id: "bomp3",
          pageId: 3,
          wikiUrl: "https://example.com/3",
          jaName: "ボンプ3",
        },
        {
          id: "bomp4",
          pageId: 4,
          wikiUrl: "https://example.com/4",
          jaName: "ボンプ4",
        },
      ];

      mockBompIconProcessor.processBompIcon.mockResolvedValue({
        success: true,
        bompId: "test",
        iconInfo: {
          bompId: "test",
          iconUrl: "https://example.com/icon.png",
          localPath: "test.png",
          fileSize: 1024,
          downloadedAt: new Date(),
        },
        retryCount: 0,
      });

      const results = await bompIconGenerator.processBompsBatch(
        mockBompEntries
      );

      expect(results).toHaveLength(4);
      expect(mockBompIconProcessor.processBompIcon).toHaveBeenCalledTimes(4);
    });
  });

  describe("validateOutputDirectory", () => {
    it("ディレクトリが存在する場合は何もしない", async () => {
      const fs = await import("fs");
      vi.spyOn(fs.promises, "access").mockResolvedValue(undefined);
      vi.spyOn(fs.promises, "writeFile").mockResolvedValue(undefined);
      vi.spyOn(fs.promises, "unlink").mockResolvedValue(undefined);

      await expect(
        bompIconGenerator.validateOutputDirectory()
      ).resolves.not.toThrow();
    });

    it("ディレクトリが存在しない場合は作成する", async () => {
      const fs = await import("fs");
      vi.spyOn(fs.promises, "access").mockRejectedValue(
        new Error("Directory not found")
      );
      vi.spyOn(fs.promises, "mkdir").mockResolvedValue(undefined);
      vi.spyOn(fs.promises, "writeFile").mockResolvedValue(undefined);
      vi.spyOn(fs.promises, "unlink").mockResolvedValue(undefined);

      await expect(
        bompIconGenerator.validateOutputDirectory()
      ).resolves.not.toThrow();
      expect(fs.promises.mkdir).toHaveBeenCalledWith(
        mockConfig.outputDirectory,
        { recursive: true }
      );
    });
  });
});
