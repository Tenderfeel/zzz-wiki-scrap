import { describe, it, expect, vi, beforeEach } from "vitest";
import { BompBatchProcessor } from "../../src/processors/BompBatchProcessor";
import { BompDataProcessor } from "../../src/processors/BompDataProcessor";
import { BompGenerator } from "../../src/generators/BompGenerator";
import { BompListParser } from "../../src/parsers/BompListParser";
import { BompEntry } from "../../src/types";

describe("BompBatchProcessor", () => {
  let batchProcessor: BompBatchProcessor;
  let mockBompDataProcessor: BompDataProcessor;
  let mockBompGenerator: BompGenerator;
  let mockBompListParser: BompListParser;

  beforeEach(() => {
    mockBompDataProcessor = {
      processBompData: vi.fn(),
    } as any;

    mockBompGenerator = {
      generateBomp: vi.fn(),
      validateBomp: vi.fn(),
    } as any;

    mockBompListParser = {
      parseScrapingFile: vi.fn(),
    } as any;

    batchProcessor = new BompBatchProcessor(
      mockBompDataProcessor,
      mockBompGenerator,
      mockBompListParser
    );
  });

  describe("processAllBomps", () => {
    it("should process bomps successfully", async () => {
      // Arrange
      const mockBompEntries: BompEntry[] = [
        {
          id: "test-bomp-1",
          pageId: 912,
          wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/912",
          jaName: "テストボンプ1",
        },
        {
          id: "test-bomp-2",
          pageId: 913,
          wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/913",
          jaName: "テストボンプ2",
        },
      ];

      const mockProcessedData = {
        basicInfo: {
          id: "test-bomp-1",
          name: "テストボンプ1",
          stats: "ice",
        },
        attributesInfo: {
          ascensionData: JSON.stringify({ test: "data" }),
        },
        extraAbility: "テスト能力",
        factionIds: [1],
      };

      const mockBomp = {
        id: "test-bomp-1",
        name: { ja: "テストボンプ1", en: "Test Bomp 1" },
        stats: "ice" as const,
        attr: {
          hp: [100, 200, 300, 400, 500, 600, 700],
          atk: [50, 100, 150, 200, 250, 300, 350],
          def: [30, 60, 90, 120, 150, 180, 210],
          impact: 10,
          critRate: 5,
          critDmg: 50,
          anomalyMastery: 0,
          anomalyProficiency: 0,
          penRatio: 0,
          energy: 100,
        },
        extraAbility: "テスト能力",
        faction: [1],
      };

      vi.mocked(mockBompListParser.parseScrapingFile).mockResolvedValue(
        mockBompEntries
      );
      vi.mocked(mockBompDataProcessor.processBompData).mockResolvedValue(
        mockProcessedData as any
      );
      vi.mocked(mockBompGenerator.generateBomp).mockReturnValue(
        mockBomp as any
      );
      vi.mocked(mockBompGenerator.validateBomp).mockReturnValue({
        isValid: true,
        errors: [],
      });

      // Act
      const result = await batchProcessor.processAllBomps("test-scraping.md", {
        batchSize: 2,
        delayMs: 10,
        maxRetries: 1,
      });

      // Assert
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.statistics.total).toBe(2);
      expect(result.statistics.successful).toBe(2);
      expect(result.statistics.failed).toBe(0);

      expect(mockBompListParser.parseScrapingFile).toHaveBeenCalledWith(
        "test-scraping.md"
      );
      expect(mockBompDataProcessor.processBompData).toHaveBeenCalledTimes(2);
      expect(mockBompGenerator.generateBomp).toHaveBeenCalledTimes(2);
    });

    it("should handle processing failures gracefully", async () => {
      // Arrange
      const mockBompEntries: BompEntry[] = [
        {
          id: "failing-bomp",
          pageId: 914,
          wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/914",
          jaName: "失敗ボンプ",
        },
      ];

      vi.mocked(mockBompListParser.parseScrapingFile).mockResolvedValue(
        mockBompEntries
      );
      vi.mocked(mockBompDataProcessor.processBompData).mockRejectedValue(
        new Error("API取得エラー")
      );

      // Act
      const result = await batchProcessor.processAllBomps("test-scraping.md", {
        batchSize: 1,
        delayMs: 10,
        maxRetries: 1,
      });

      // Assert
      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].bompId).toBe("failing-bomp");
      expect(result.failed[0].error).toContain("API取得エラー");
      expect(result.statistics.total).toBe(1);
      expect(result.statistics.successful).toBe(0);
      expect(result.statistics.failed).toBe(1);
    });

    it("should retry failed operations", async () => {
      // Arrange
      const mockBompEntries: BompEntry[] = [
        {
          id: "retry-bomp",
          pageId: 915,
          wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/915",
          jaName: "リトライボンプ",
        },
      ];

      const mockProcessedData = {
        basicInfo: {
          id: "retry-bomp",
          name: "リトライボンプ",
          stats: "fire",
        },
        attributesInfo: {
          ascensionData: JSON.stringify({ test: "data" }),
        },
        extraAbility: "リトライ能力",
        factionIds: [2],
      };

      const mockBomp = {
        id: "retry-bomp",
        name: { ja: "リトライボンプ", en: "Retry Bomp" },
        stats: "fire" as const,
        attr: {
          hp: [100, 200, 300, 400, 500, 600, 700],
          atk: [50, 100, 150, 200, 250, 300, 350],
          def: [30, 60, 90, 120, 150, 180, 210],
          impact: 10,
          critRate: 5,
          critDmg: 50,
          anomalyMastery: 0,
          anomalyProficiency: 0,
          penRatio: 0,
          energy: 100,
        },
        extraAbility: "リトライ能力",
        faction: [2],
      };

      vi.mocked(mockBompListParser.parseScrapingFile).mockResolvedValue(
        mockBompEntries
      );

      // 最初の呼び出しは失敗、2回目は成功
      vi.mocked(mockBompDataProcessor.processBompData)
        .mockRejectedValueOnce(new Error("一時的なエラー"))
        .mockResolvedValueOnce(mockProcessedData as any);

      vi.mocked(mockBompGenerator.generateBomp).mockReturnValue(
        mockBomp as any
      );
      vi.mocked(mockBompGenerator.validateBomp).mockReturnValue({
        isValid: true,
        errors: [],
      });

      // Act
      const result = await batchProcessor.processAllBomps("test-scraping.md", {
        batchSize: 1,
        delayMs: 10,
        maxRetries: 2,
      });

      // Assert
      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(0);
      expect(mockBompDataProcessor.processBompData).toHaveBeenCalledTimes(2);
    });
  });

  describe("validateProcessingResult", () => {
    it("should pass validation for good success rate", () => {
      // Arrange
      const result = {
        successful: [{ id: "test" } as any],
        failed: [],
        statistics: {
          total: 1,
          successful: 1,
          failed: 0,
          processingTime: 1000,
          startTime: new Date(),
          endTime: new Date(),
        },
      };

      // Act & Assert
      expect(() => {
        batchProcessor.validateProcessingResult(result, 0.8);
      }).not.toThrow();
    });

    it("should throw error for poor success rate", () => {
      // Arrange
      const result = {
        successful: [],
        failed: [{ bompId: "failed-bomp", error: "test error" }],
        statistics: {
          total: 1,
          successful: 0,
          failed: 1,
          processingTime: 1000,
          startTime: new Date(),
          endTime: new Date(),
        },
      };

      // Act & Assert
      expect(() => {
        batchProcessor.validateProcessingResult(result, 0.8);
      }).toThrow("ボンプ処理成功率が基準を下回りました");
    });
  });

  describe("generateProcessingReport", () => {
    it("should generate a comprehensive report", () => {
      // Arrange
      const result = {
        successful: [
          {
            id: "success-bomp",
            name: { ja: "成功ボンプ", en: "Success Bomp" },
          } as any,
        ],
        failed: [{ bompId: "failed-bomp", error: "test error" }],
        statistics: {
          total: 2,
          successful: 1,
          failed: 1,
          processingTime: 5000,
          startTime: new Date("2024-01-01T10:00:00Z"),
          endTime: new Date("2024-01-01T10:00:05Z"),
        },
      };

      // Act
      const report = batchProcessor.generateProcessingReport(result);

      // Assert
      expect(report).toContain("# 全ボンプ処理レポート");
      expect(report).toContain("総ボンプ数: 2");
      expect(report).toContain("成功: 1");
      expect(report).toContain("失敗: 1");
      expect(report).toContain("成功率: 50%");
      expect(report).toContain("success-bomp");
      expect(report).toContain("failed-bomp");
    });
  });
});
