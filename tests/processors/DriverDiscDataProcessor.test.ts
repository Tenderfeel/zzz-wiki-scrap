import { describe, test, expect, vi, beforeEach } from "vitest";
import { DriverDiscDataProcessor } from "../../src/processors/DriverDiscDataProcessor";
import { HoyoLabApiClient } from "../../src/clients/HoyoLabApiClient";
import { DriverDiscDataMapper } from "../../src/mappers/DriverDiscDataMapper";
import { ApiResponse } from "../../src/types/api";
import {
  DriverDiscEntry,
  ProcessedDriverDiscData,
  BasicDriverDiscInfo,
  SetEffectInfo,
} from "../../src/types/index";
import { ApiError, ParsingError, MappingError } from "../../src/errors";

// モックデータ
const mockDriverDiscEntry: DriverDiscEntry = {
  id: "123",
  name: "テストドライバーディスク",
  iconUrl: "https://example.com/icon.png",
};

const mockApiResponse: ApiResponse = {
  retcode: 0,
  message: "OK",
  data: {
    page: {
      id: "123",
      name: "テストドライバーディスク",
      modules: [
        {
          name: "ステータス",
          components: [
            {
              component_id: "baseInfo",
              data: JSON.stringify({
                list: [
                  {
                    key: "4セット効果",
                    value: ["<p>攻撃力が上昇する</p>"],
                  },
                  {
                    key: "2セット効果",
                    value: ["<p>HP が上昇する</p>"],
                  },
                  {
                    key: "実装バージョン",
                    value: ["Ver.1.0"],
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

const mockBasicInfo: BasicDriverDiscInfo = {
  id: 123,
  name: "テストドライバーディスク",
  releaseVersion: 1.0,
};

const mockSetEffectInfo: SetEffectInfo = {
  fourSetEffect: "攻撃力が上昇する",
  twoSetEffect: "HP が上昇する",
};

const mockProcessedData: ProcessedDriverDiscData = {
  basicInfo: mockBasicInfo,
  setEffectInfo: mockSetEffectInfo,
  specialty: "attack",
};

describe("DriverDiscDataProcessor", () => {
  let processor: DriverDiscDataProcessor;
  let mockApiClient: HoyoLabApiClient;
  let mockDataMapper: DriverDiscDataMapper;

  beforeEach(() => {
    // モックを作成
    mockApiClient = {
      fetchCharacterData: vi.fn(),
    } as any;

    mockDataMapper = {
      extractBasicDriverDiscInfo: vi.fn(),
      extractSetEffects: vi.fn(),
      extractSpecialty: vi.fn(),
      createMultiLangSetEffect: vi.fn(),
    } as any;

    processor = new DriverDiscDataProcessor(mockApiClient, mockDataMapper);
  });

  describe("processDriverDiscData", () => {
    test("正常なドライバーディスクデータ処理が成功すること", async () => {
      // モックの設定
      vi.mocked(mockApiClient.fetchCharacterData)
        .mockResolvedValueOnce(mockApiResponse) // 日本語データ
        .mockResolvedValueOnce(mockApiResponse); // 英語データ

      vi.mocked(mockDataMapper.extractBasicDriverDiscInfo).mockReturnValue(
        mockBasicInfo
      );
      vi.mocked(mockDataMapper.extractSetEffects).mockReturnValue(
        mockSetEffectInfo
      );
      vi.mocked(mockDataMapper.extractSpecialty).mockReturnValue("attack");

      // テスト実行
      const result = await processor.processDriverDiscData(mockDriverDiscEntry);

      // 検証
      expect(result).toEqual(mockProcessedData);
      expect(mockApiClient.fetchCharacterData).toHaveBeenCalledTimes(2);
      expect(mockApiClient.fetchCharacterData).toHaveBeenCalledWith(
        123,
        "ja-jp"
      );
      expect(mockApiClient.fetchCharacterData).toHaveBeenCalledWith(
        123,
        "en-us"
      );
      expect(mockDataMapper.extractBasicDriverDiscInfo).toHaveBeenCalledWith(
        mockApiResponse,
        "123"
      );
      expect(mockDataMapper.extractSetEffects).toHaveBeenCalledWith(
        mockApiResponse
      );
      expect(mockDataMapper.extractSpecialty).toHaveBeenCalledWith(
        "攻撃力が上昇する"
      );
    });

    test("英語データ取得失敗時でも日本語データで処理が継続されること", async () => {
      // モックの設定
      vi.mocked(mockApiClient.fetchCharacterData)
        .mockResolvedValueOnce(mockApiResponse) // 日本語データ成功
        .mockRejectedValueOnce(new ApiError("英語データ取得失敗")); // 英語データ失敗

      vi.mocked(mockDataMapper.extractBasicDriverDiscInfo).mockReturnValue(
        mockBasicInfo
      );
      vi.mocked(mockDataMapper.extractSetEffects).mockReturnValue(
        mockSetEffectInfo
      );
      vi.mocked(mockDataMapper.extractSpecialty).mockReturnValue("attack");

      // テスト実行
      const result = await processor.processDriverDiscData(mockDriverDiscEntry);

      // 検証
      expect(result).toEqual(mockProcessedData);
      expect(mockApiClient.fetchCharacterData).toHaveBeenCalledTimes(2);
    });

    test("無効なドライバーディスクIDでParsingErrorがスローされること", async () => {
      const invalidEntry: DriverDiscEntry = {
        id: "invalid",
        name: "無効なID",
        iconUrl: "https://example.com/icon.png",
      };

      // テスト実行と検証
      await expect(
        processor.processDriverDiscData(invalidEntry)
      ).rejects.toThrow(ParsingError);
    });

    test("日本語APIデータ取得失敗時にApiErrorがスローされること", async () => {
      // モックの設定
      vi.mocked(mockApiClient.fetchCharacterData).mockRejectedValue(
        new ApiError("日本語データ取得失敗")
      );

      // テスト実行と検証
      await expect(
        processor.processDriverDiscData(mockDriverDiscEntry)
      ).rejects.toThrow(ApiError);
    });

    test("基本情報抽出失敗時にMappingErrorがスローされること", async () => {
      // モックの設定
      vi.mocked(mockApiClient.fetchCharacterData)
        .mockResolvedValueOnce(mockApiResponse)
        .mockResolvedValueOnce(mockApiResponse);

      vi.mocked(mockDataMapper.extractBasicDriverDiscInfo).mockImplementation(
        () => {
          throw new MappingError("基本情報抽出失敗");
        }
      );

      // テスト実行と検証
      await expect(
        processor.processDriverDiscData(mockDriverDiscEntry)
      ).rejects.toThrow("ドライバーディスクデータ処理に失敗しました");
    });
  });

  describe("createMultiLangSetEffect", () => {
    test("多言語セット効果オブジェクトが正しく生成されること", () => {
      const jaSetEffect = "日本語セット効果";
      const enSetEffect = "English set effect";
      const expectedResult = {
        ja: jaSetEffect,
        en: enSetEffect,
      };

      // モックの設定
      vi.mocked(mockDataMapper.createMultiLangSetEffect).mockReturnValue(
        expectedResult
      );

      // テスト実行
      const result = processor.createMultiLangSetEffect(
        jaSetEffect,
        enSetEffect
      );

      // 検証
      expect(result).toEqual(expectedResult);
      expect(mockDataMapper.createMultiLangSetEffect).toHaveBeenCalledWith(
        jaSetEffect,
        enSetEffect
      );
    });

    test("英語セット効果が未提供の場合でも処理が成功すること", () => {
      const jaSetEffect = "日本語セット効果";
      const expectedResult = {
        ja: jaSetEffect,
        en: jaSetEffect, // フォールバック
      };

      // モックの設定
      vi.mocked(mockDataMapper.createMultiLangSetEffect).mockReturnValue(
        expectedResult
      );

      // テスト実行
      const result = processor.createMultiLangSetEffect(jaSetEffect);

      // 検証
      expect(result).toEqual(expectedResult);
      expect(mockDataMapper.createMultiLangSetEffect).toHaveBeenCalledWith(
        jaSetEffect,
        undefined
      );
    });
  });

  describe("processDriverDiscDataWithRecovery", () => {
    test("通常処理成功時に正しいデータが返されること", async () => {
      // モックの設定
      vi.mocked(mockApiClient.fetchCharacterData)
        .mockResolvedValueOnce(mockApiResponse)
        .mockResolvedValueOnce(mockApiResponse);

      vi.mocked(mockDataMapper.extractBasicDriverDiscInfo).mockReturnValue(
        mockBasicInfo
      );
      vi.mocked(mockDataMapper.extractSetEffects).mockReturnValue(
        mockSetEffectInfo
      );
      vi.mocked(mockDataMapper.extractSpecialty).mockReturnValue("attack");

      // テスト実行
      const result = await processor.processDriverDiscDataWithRecovery(
        mockDriverDiscEntry
      );

      // 検証
      expect(result).toEqual(mockProcessedData);
    });

    test("ApiError発生時にnullが返されること", async () => {
      // モックの設定
      vi.mocked(mockApiClient.fetchCharacterData).mockRejectedValue(
        new ApiError("API エラー")
      );

      // テスト実行
      const result = await processor.processDriverDiscDataWithRecovery(
        mockDriverDiscEntry
      );

      // 検証
      expect(result).toBeNull();
    });

    test("ParsingError発生時にnullが返されること", async () => {
      // モックの設定
      vi.mocked(mockApiClient.fetchCharacterData)
        .mockResolvedValueOnce(mockApiResponse)
        .mockResolvedValueOnce(mockApiResponse);

      vi.mocked(mockDataMapper.extractBasicDriverDiscInfo).mockImplementation(
        () => {
          throw new ParsingError("パースエラー");
        }
      );

      // テスト実行
      const result = await processor.processDriverDiscDataWithRecovery(
        mockDriverDiscEntry
      );

      // 検証
      expect(result).toBeNull();
    });

    test("予期しないエラー発生時にnullが返されること", async () => {
      // モックの設定
      vi.mocked(mockApiClient.fetchCharacterData)
        .mockResolvedValueOnce(mockApiResponse)
        .mockResolvedValueOnce(mockApiResponse);

      vi.mocked(mockDataMapper.extractBasicDriverDiscInfo).mockImplementation(
        () => {
          throw new Error("予期しないエラー");
        }
      );

      // テスト実行
      const result = await processor.processDriverDiscDataWithRecovery(
        mockDriverDiscEntry
      );

      // 検証
      expect(result).toBeNull();
    });
  });

  describe("processDriverDiscDataBatch", () => {
    test("バッチ処理が正常に完了すること", async () => {
      const discEntries = [
        mockDriverDiscEntry,
        {
          id: "456",
          name: "テストドライバーディスク2",
          iconUrl: "https://example.com/icon2.png",
        },
      ];

      // モックの設定
      vi.mocked(mockApiClient.fetchCharacterData).mockResolvedValue(
        mockApiResponse
      );

      vi.mocked(mockDataMapper.extractBasicDriverDiscInfo).mockReturnValue(
        mockBasicInfo
      );
      vi.mocked(mockDataMapper.extractSetEffects).mockReturnValue(
        mockSetEffectInfo
      );
      vi.mocked(mockDataMapper.extractSpecialty).mockReturnValue("attack");

      // テスト実行
      const result = await processor.processDriverDiscDataBatch(
        discEntries,
        0 // 遅延なし
      );

      // 検証
      expect(result.summary.total).toBe(2);
      expect(result.summary.successful).toBe(2);
      expect(result.summary.failed).toBe(0);
      expect(result.summary.skipped).toBe(0);
      expect(result.summary.successRate).toBe(100);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(true);
    });

    test("一部失敗を含むバッチ処理が正しく統計を返すこと", async () => {
      const discEntries = [
        mockDriverDiscEntry,
        {
          id: "456",
          name: "失敗するドライバーディスク",
          iconUrl: "https://example.com/icon2.png",
        },
      ];

      // モックの設定
      vi.mocked(mockApiClient.fetchCharacterData)
        .mockResolvedValueOnce(mockApiResponse) // 1回目成功
        .mockResolvedValueOnce(mockApiResponse) // 1回目英語成功
        .mockRejectedValueOnce(new ApiError("API エラー")); // 2回目失敗

      vi.mocked(mockDataMapper.extractBasicDriverDiscInfo).mockReturnValue(
        mockBasicInfo
      );
      vi.mocked(mockDataMapper.extractSetEffects).mockReturnValue(
        mockSetEffectInfo
      );
      vi.mocked(mockDataMapper.extractSpecialty).mockReturnValue("attack");

      // テスト実行
      const result = await processor.processDriverDiscDataBatch(
        discEntries,
        0 // 遅延なし
      );

      // 検証
      expect(result.summary.total).toBe(2);
      expect(result.summary.successful).toBe(1);
      expect(result.summary.failed).toBe(0);
      expect(result.summary.skipped).toBe(1);
      expect(result.summary.successRate).toBe(50);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
    });
  });
});
