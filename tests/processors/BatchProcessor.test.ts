import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  BatchProcessor,
  ProcessingResult,
  FailedCharacter,
} from "../../src/processors/BatchProcessor";
import { EnhancedApiClient } from "../../src/clients/EnhancedApiClient";
import { EnhancedDataProcessor } from "../../src/processors/EnhancedDataProcessor";
import { CharacterEntry, Character } from "../../src/types";
import { ApiResponse } from "../../src/types/api";
import { ProcessingStage } from "../../src/errors";

// モックデータ
const mockCharacterEntry: CharacterEntry = {
  id: "test-character",
  pageId: 123,
  wikiUrl: "https://example.com/test",
};

const mockApiResponse: ApiResponse = {
  retcode: 0,
  message: "success",
  data: {
    page: {
      id: "123",
      name: "テストキャラクター",
      agent_specialties: { values: ["撃破"] },
      agent_stats: { values: ["氷属性"] },
      agent_rarity: { values: ["S"] },
      agent_faction: { values: ["邪兎屋"] },
      modules: [
        {
          components: [
            {
              component_id: "ascension",
              data: JSON.stringify({
                list: [
                  {
                    key: "1",
                    combatList: [
                      { key: "HP", values: ["600", "677"] },
                      { key: "攻撃力", values: ["95", "105"] },
                      { key: "防御力", values: ["44", "49"] },
                      { key: "衝撃力", values: ["108", "119"] },
                      { key: "会心率", values: ["5%", "5%"] },
                      { key: "会心ダメージ", values: ["50%", "50%"] },
                      { key: "異常マスタリー", values: ["82", "91"] },
                      { key: "異常掌握", values: ["81", "90"] },
                      { key: "貫通率", values: ["0%", "0%"] },
                      { key: "エネルギー自動回復", values: ["1.1", "1.2"] },
                    ],
                  },
                  // 他のレベルのデータ（簡略化）
                  {
                    key: "10",
                    combatList: [{ key: "HP", values: ["1800", "1967"] }],
                  },
                  {
                    key: "20",
                    combatList: [{ key: "HP", values: ["3050", "3350"] }],
                  },
                  {
                    key: "30",
                    combatList: [{ key: "HP", values: ["4300", "4732"] }],
                  },
                  {
                    key: "40",
                    combatList: [{ key: "HP", values: ["5550", "6114"] }],
                  },
                  {
                    key: "50",
                    combatList: [{ key: "HP", values: ["6800", "7498"] }],
                  },
                  {
                    key: "60",
                    combatList: [{ key: "HP", values: ["7650", "8416"] }],
                  },
                ],
              }),
            },
          ],
        },
      ],
    },
  },
};

const mockCharacter: Character = {
  id: "test-character",
  name: { ja: "テストキャラクター", en: "Test Character" },
  fullName: { ja: "テストキャラクター", en: "Test Character" },
  specialty: "stun",
  stats: "ice",
  faction: 1,
  rarity: "S",
  attr: {
    hp: [677, 1967, 3350, 4732, 6114, 7498, 8416],
    atk: [105, 197, 296, 394, 494, 592, 653],
    def: [49, 141, 241, 340, 441, 540, 606],
    impact: 119,
    critRate: 5,
    critDmg: 50,
    anomalyMastery: 91,
    anomalyProficiency: 90,
    penRatio: 0,
    energy: 1.2,
  },
};

describe("BatchProcessor", () => {
  let batchProcessor: BatchProcessor;
  let mockApiClient: vi.Mocked<EnhancedApiClient>;
  let mockDataProcessor: vi.Mocked<EnhancedDataProcessor>;

  beforeEach(() => {
    // APIクライアントのモック
    mockApiClient = {
      fetchCharacterDataBatch: vi.fn(),
      fetchBothLanguages: vi.fn(),
      validateBatchResults: vi.fn(),
      retryFailedCharacters: vi.fn(),
      generateStatistics: vi.fn(),
    } as any;

    // データプロセッサーのモック
    mockDataProcessor = {
      processCharacterData: vi.fn(),
      validateProcessedData: vi.fn(),
    } as any;

    batchProcessor = new BatchProcessor(mockApiClient, mockDataProcessor);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("processAllCharacters", () => {
    it("成功したキャラクターを正しく処理する", async () => {
      // Arrange
      const entries = [mockCharacterEntry];

      mockApiClient.fetchBothLanguages.mockResolvedValue({
        ja: mockApiResponse,
        en: mockApiResponse,
      });
      mockDataProcessor.processCharacterData.mockResolvedValue(mockCharacter);
      mockDataProcessor.validateProcessedData.mockReturnValue({
        isValid: true,
        errors: [],
      });

      // Act
      const result = await batchProcessor.processAllCharacters(entries);

      // Assert
      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(0);
      expect(result.successful[0].character).toEqual(mockCharacter);
      expect(result.statistics.total).toBe(1);
      expect(result.statistics.successful).toBe(1);
      expect(result.statistics.failed).toBe(0);
    });

    it("API取得に失敗したキャラクターを失敗リストに追加する", async () => {
      // Arrange
      const entries = [mockCharacterEntry];

      mockApiClient.fetchBothLanguages.mockRejectedValue(
        new Error("API取得エラー")
      );

      // Act
      const result = await batchProcessor.processAllCharacters(entries);

      // Assert
      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].entry).toEqual(mockCharacterEntry);
      expect(result.failed[0].error).toBe("API取得エラー");
      expect(result.failed[0].stage).toBe(ProcessingStage.API_FETCH);
    });

    it("データ処理に失敗したキャラクターを失敗リストに追加し、処理を継続する", async () => {
      // Arrange
      const entries = [
        mockCharacterEntry,
        { ...mockCharacterEntry, id: "character2", pageId: 124 },
      ];

      mockApiClient.fetchBothLanguages.mockResolvedValue({
        ja: mockApiResponse,
        en: mockApiResponse,
      });
      // 特定のキャラクターでエラーを発生させる
      mockDataProcessor.processCharacterData.mockImplementation(
        (jaData, enData, entry) => {
          if (entry.id === "test-character") {
            throw new Error("データ処理エラー");
          }
          return Promise.resolve(mockCharacter);
        }
      );

      // Act
      const result = await batchProcessor.processAllCharacters(entries);

      // 結果を確認

      // Assert
      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].stage).toBe(ProcessingStage.DATA_PROCESSING);
      expect(result.statistics.total).toBe(2);
      expect(result.statistics.successful).toBe(1);
      expect(result.statistics.failed).toBe(1);
    });

    it("複数のキャラクターを並行処理する", async () => {
      // Arrange
      const entries = [
        mockCharacterEntry,
        { ...mockCharacterEntry, id: "character2", pageId: 124 },
        { ...mockCharacterEntry, id: "character3", pageId: 125 },
      ];

      mockApiClient.fetchBothLanguages.mockResolvedValue({
        ja: mockApiResponse,
        en: mockApiResponse,
      });
      mockDataProcessor.processCharacterData.mockResolvedValue(mockCharacter);
      mockDataProcessor.validateProcessedData.mockReturnValue({
        isValid: true,
        errors: [],
      });

      // Act
      const result = await batchProcessor.processAllCharacters(entries);

      // Assert
      expect(result.successful).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      expect(result.statistics.total).toBe(3);
      expect(result.statistics.successful).toBe(3);
      expect(result.statistics.failed).toBe(0);
    });
  });

  describe("retryFailedCharacters", () => {
    it("失敗したキャラクターのみを再処理する", async () => {
      // Arrange
      const failedCharacter: FailedCharacter = {
        entry: mockCharacterEntry,
        error: "前回の処理で失敗",
        stage: ProcessingStage.API_FETCH,
        timestamp: new Date(),
      };

      const previousResult: ProcessingResult = {
        successful: [],
        failed: [failedCharacter],
        statistics: {
          total: 1,
          successful: 0,
          failed: 1,
          processingTime: 1000,
          startTime: new Date(),
          endTime: new Date(),
        },
      };

      // 再処理では成功するようにモックを設定
      mockApiClient.fetchBothLanguages.mockResolvedValue({
        ja: mockApiResponse,
        en: mockApiResponse,
      });
      mockDataProcessor.processCharacterData.mockResolvedValue(mockCharacter);
      mockDataProcessor.validateProcessedData.mockReturnValue({
        isValid: true,
        errors: [],
      });

      // Act
      const result = await batchProcessor.retryFailedCharacters(previousResult);

      // Assert
      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(0);
      expect(mockApiClient.fetchBothLanguages).toHaveBeenCalledWith(
        mockCharacterEntry.pageId
      );
    });

    it("再処理が必要なキャラクターがない場合は空の結果を返す", async () => {
      // Arrange
      const previousResult: ProcessingResult = {
        successful: [],
        failed: [],
        statistics: {
          total: 0,
          successful: 0,
          failed: 0,
          processingTime: 0,
          startTime: new Date(),
          endTime: new Date(),
        },
      };

      // Act
      const result = await batchProcessor.retryFailedCharacters(previousResult);

      // Assert
      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
      expect(mockApiClient.fetchBothLanguages).not.toHaveBeenCalled();
    });
  });

  describe("validateProcessingResult", () => {
    it("成功率が基準を満たす場合は例外を投げない", () => {
      // Arrange
      const result: ProcessingResult = {
        successful: [
          {
            entry: mockCharacterEntry,
            jaData: mockApiResponse,
            enData: mockApiResponse,
            character: mockCharacter,
          },
        ],
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

    it("成功率が基準を下回る場合は例外を投げる", () => {
      // Arrange
      const result: ProcessingResult = {
        successful: [],
        failed: [
          {
            entry: mockCharacterEntry,
            error: "処理失敗",
            stage: ProcessingStage.DATA_PROCESSING,
            timestamp: new Date(),
          },
        ],
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
      }).toThrow("処理成功率が基準を下回りました");
    });
  });

  describe("generateProcessingReport", () => {
    it("詳細な処理レポートを生成する", () => {
      // Arrange
      const result: ProcessingResult = {
        successful: [
          {
            entry: mockCharacterEntry,
            jaData: mockApiResponse,
            enData: mockApiResponse,
            character: mockCharacter,
          },
        ],
        failed: [
          {
            entry: { ...mockCharacterEntry, id: "failed-character" },
            error: "処理失敗",
            stage: ProcessingStage.DATA_PROCESSING,
            timestamp: new Date(),
          },
        ],
        statistics: {
          total: 2,
          successful: 1,
          failed: 1,
          processingTime: 5000,
          startTime: new Date("2023-01-01T10:00:00Z"),
          endTime: new Date("2023-01-01T10:00:05Z"),
        },
      };

      // Act
      const report = batchProcessor.generateProcessingReport(result);

      // Assert
      expect(report).toContain("# 全キャラクター処理レポート");
      expect(report).toContain("総キャラクター数: 2");
      expect(report).toContain("成功: 1");
      expect(report).toContain("失敗: 1");
      expect(report).toContain("成功率: 50%");
      expect(report).toContain("test-character");
      expect(report).toContain("failed-character");
      expect(report).toContain("DATA_PROCESSING: 処理失敗");
    });
  });

  describe("プログレス管理", () => {
    it("プログレスコールバックが正しく呼び出される", async () => {
      // Arrange
      const progressCallback = vi.fn();
      batchProcessor.setProgressCallback(progressCallback);

      const entries = [mockCharacterEntry];

      mockApiClient.fetchBothLanguages.mockResolvedValue({
        ja: mockApiResponse,
        en: mockApiResponse,
      });
      mockDataProcessor.processCharacterData.mockResolvedValue(mockCharacter);
      mockDataProcessor.validateProcessedData.mockReturnValue({
        isValid: true,
        errors: [],
      });

      // Act
      await batchProcessor.processAllCharacters(entries);

      // Assert
      expect(progressCallback).toHaveBeenCalled();
      const lastCall =
        progressCallback.mock.calls[progressCallback.mock.calls.length - 1][0];
      expect(lastCall).toHaveProperty("current");
      expect(lastCall).toHaveProperty("total");
      expect(lastCall).toHaveProperty("percentage");
      expect(lastCall).toHaveProperty("currentCharacter");
      expect(lastCall).toHaveProperty("stage");
      expect(lastCall).toHaveProperty("elapsedTime");
    });
  });
});
