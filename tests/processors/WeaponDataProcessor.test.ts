import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { WeaponDataProcessor } from "../../src/processors/WeaponDataProcessor";
import { HoyoLabApiClient } from "../../src/clients/HoyoLabApiClient";
import { WeaponDataMapper } from "../../src/mappers/WeaponDataMapper";
import { ErrorRecoveryHandler } from "../../src/utils/ErrorRecoveryHandler";
import { PartialDataHandler } from "../../src/utils/PartialDataHandler";
import { ParsingError, MappingError } from "../../src/errors";
import { ApiResponse } from "../../src/types/api";
import {
  WeaponEntry,
  ProcessedWeaponData,
  BasicWeaponInfo,
  WeaponSkillInfo,
  WeaponAttributesInfo,
  WeaponAgentInfo,
} from "../../src/types/index";

// モック設定
vi.mock("../../src/utils/Logger", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("WeaponDataProcessor", () => {
  let processor: WeaponDataProcessor;
  let mockApiClient: HoyoLabApiClient;
  let mockWeaponDataMapper: WeaponDataMapper;
  let mockErrorRecoveryHandler: ErrorRecoveryHandler;
  let mockPartialDataHandler: PartialDataHandler;

  const mockWeaponEntry: WeaponEntry = {
    id: "901",
    name: "テスト音動機",
    rarity: "S",
    specialty: "attack",
  };

  const mockBasicWeaponInfo: BasicWeaponInfo = {
    id: "901",
    name: "テスト音動機",
    rarity: "S",
    specialty: "attack",
  };

  const mockWeaponSkillInfo: WeaponSkillInfo = {
    equipmentSkillName: "テストスキル",
    equipmentSkillDesc: "テストスキルの説明",
  };

  const mockWeaponAttributesInfo: WeaponAttributesInfo = {
    hp: [100, 110, 120, 130, 140, 150, 160],
    atk: [50, 55, 60, 65, 70, 75, 80],
    def: [30, 33, 36, 39, 42, 45, 48],
    impact: [10, 11, 12, 13, 14, 15, 16],
    critRate: [5, 5.5, 6, 6.5, 7, 7.5, 8],
    critDmg: [20, 22, 24, 26, 28, 30, 32],
    anomalyMastery: [0, 0, 0, 0, 0, 0, 0],
    anomalyProficiency: [0, 0, 0, 0, 0, 0, 0],
    penRatio: [0, 0, 0, 0, 0, 0, 0],
    energy: [0, 0, 0, 0, 0, 0, 0],
  };

  const mockWeaponAgentInfo: WeaponAgentInfo = {
    agentId: "lycaon",
  };

  const mockProcessedWeaponData: ProcessedWeaponData = {
    basicInfo: mockBasicWeaponInfo,
    skillInfo: mockWeaponSkillInfo,
    attributesInfo: mockWeaponAttributesInfo,
    agentInfo: mockWeaponAgentInfo,
  };

  const mockApiResponse: ApiResponse = {
    retcode: 0,
    message: "OK",
    data: {
      page: {
        id: "901",
        name: "テスト音動機",
        agent_specialties: { values: [] },
        agent_stats: { values: [] },
        agent_rarity: { values: [] },
        agent_faction: { values: [] },
        modules: [],
      },
    },
  };

  beforeEach(() => {
    // モックインスタンスを作成
    mockApiClient = {
      fetchCharacterData: vi.fn(),
    } as any;

    mockWeaponDataMapper = {
      extractBasicWeaponInfo: vi.fn(),
      extractWeaponSkillInfo: vi.fn(),
      extractWeaponAttributes: vi.fn(),
      extractAgentInfo: vi.fn(),
    } as any;

    mockErrorRecoveryHandler = {
      retryApiRequest: vi.fn(),
    } as any;

    mockPartialDataHandler = {} as any;

    // プロセッサーを初期化
    processor = new WeaponDataProcessor(
      mockApiClient,
      mockWeaponDataMapper,
      mockErrorRecoveryHandler,
      mockPartialDataHandler
    );
  });

  describe("processWeaponData", () => {
    it("正常な音動機データを処理できる", async () => {
      // モックの設定
      (mockApiClient.fetchCharacterData as Mock)
        .mockResolvedValueOnce(mockApiResponse) // 日本語データ
        .mockResolvedValueOnce(mockApiResponse); // 英語データ

      (mockWeaponDataMapper.extractBasicWeaponInfo as Mock).mockReturnValue(
        mockBasicWeaponInfo
      );
      (mockWeaponDataMapper.extractWeaponSkillInfo as Mock).mockReturnValue(
        mockWeaponSkillInfo
      );
      (mockWeaponDataMapper.extractWeaponAttributes as Mock).mockReturnValue(
        mockWeaponAttributesInfo
      );
      (mockWeaponDataMapper.extractAgentInfo as Mock).mockReturnValue(
        mockWeaponAgentInfo
      );

      // テスト実行
      const result = await processor.processWeaponData(mockWeaponEntry);

      // 検証
      expect(result).toEqual(mockProcessedWeaponData);
      expect(mockApiClient.fetchCharacterData).toHaveBeenCalledWith(
        901,
        "ja-jp"
      );
      expect(mockApiClient.fetchCharacterData).toHaveBeenCalledWith(
        901,
        "en-us"
      );
      expect(mockWeaponDataMapper.extractBasicWeaponInfo).toHaveBeenCalledWith(
        mockApiResponse,
        "901"
      );
      expect(mockWeaponDataMapper.extractWeaponSkillInfo).toHaveBeenCalledWith(
        mockApiResponse.data.page.modules
      );
      expect(mockWeaponDataMapper.extractWeaponAttributes).toHaveBeenCalledWith(
        mockApiResponse.data.page.modules
      );
      expect(mockWeaponDataMapper.extractAgentInfo).toHaveBeenCalledWith(
        mockApiResponse.data.page.modules
      );
    });

    it("英語APIデータ取得に失敗しても日本語データで処理を継続する", async () => {
      // モックの設定
      (mockApiClient.fetchCharacterData as Mock)
        .mockResolvedValueOnce(mockApiResponse) // 日本語データ成功
        .mockRejectedValueOnce(new Error("英語データ取得失敗")); // 英語データ失敗

      (mockWeaponDataMapper.extractBasicWeaponInfo as Mock).mockReturnValue(
        mockBasicWeaponInfo
      );
      (mockWeaponDataMapper.extractWeaponSkillInfo as Mock).mockReturnValue(
        mockWeaponSkillInfo
      );
      (mockWeaponDataMapper.extractWeaponAttributes as Mock).mockReturnValue(
        mockWeaponAttributesInfo
      );
      (mockWeaponDataMapper.extractAgentInfo as Mock).mockReturnValue(
        mockWeaponAgentInfo
      );

      // テスト実行
      const result = await processor.processWeaponData(mockWeaponEntry);

      // 検証
      expect(result).toEqual(mockProcessedWeaponData);
      expect(mockApiClient.fetchCharacterData).toHaveBeenCalledTimes(2);
    });

    it("無効な音動機IDの場合はグレースフル劣化を試行する", async () => {
      const invalidWeaponEntry: WeaponEntry = {
        id: "invalid",
        name: "無効な音動機",
        rarity: "S",
      };

      // グレースフル劣化のスパイを設定
      const gracefulDegradationSpy = vi
        .spyOn(processor as any, "attemptGracefulDegradation")
        .mockResolvedValue(mockProcessedWeaponData);

      // テスト実行
      const result = await processor.processWeaponData(invalidWeaponEntry);

      // 検証
      expect(result).toEqual(mockProcessedWeaponData);
      expect(gracefulDegradationSpy).toHaveBeenCalledWith(
        invalidWeaponEntry,
        expect.any(ParsingError)
      );
    });

    it("APIデータ取得に失敗した場合はグレースフル劣化を試行する", async () => {
      // モックの設定
      (mockApiClient.fetchCharacterData as Mock).mockRejectedValue(
        new Error("API取得失敗")
      );

      // グレースフル劣化のスパイを設定
      const gracefulDegradationSpy = vi
        .spyOn(processor as any, "attemptGracefulDegradation")
        .mockResolvedValue(mockProcessedWeaponData);

      // テスト実行
      const result = await processor.processWeaponData(mockWeaponEntry);

      // 検証
      expect(result).toEqual(mockProcessedWeaponData);
      expect(gracefulDegradationSpy).toHaveBeenCalledWith(
        mockWeaponEntry,
        expect.any(ParsingError)
      );
    });

    it("グレースフル劣化も失敗した場合はParsingErrorを投げる", async () => {
      // モックの設定
      (mockApiClient.fetchCharacterData as Mock).mockRejectedValue(
        new Error("API取得失敗")
      );

      // グレースフル劣化も失敗させる
      const gracefulDegradationSpy = vi
        .spyOn(processor as any, "attemptGracefulDegradation")
        .mockResolvedValue(null);

      // テスト実行と検証
      await expect(
        processor.processWeaponData(mockWeaponEntry)
      ).rejects.toThrow(ParsingError);
      await expect(
        processor.processWeaponData(mockWeaponEntry)
      ).rejects.toThrow("音動機データの処理に失敗しました");

      expect(gracefulDegradationSpy).toHaveBeenCalled();
    });
  });

  describe("validateWeaponData", () => {
    it("有効な音動機データの検証に成功する", () => {
      const result = processor.validateWeaponData(mockProcessedWeaponData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("基本情報が存在しない場合は検証に失敗する", () => {
      const invalidData = {
        ...mockProcessedWeaponData,
        basicInfo: null as any,
      };

      const result = processor.validateWeaponData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("基本情報が存在しません");
    });

    it("音動機IDが無効な場合は検証に失敗する", () => {
      const invalidData = {
        ...mockProcessedWeaponData,
        basicInfo: {
          ...mockBasicWeaponInfo,
          id: "",
        },
      };

      const result = processor.validateWeaponData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("音動機IDが無効です");
    });

    it("音動機名が無効な場合は検証に失敗する", () => {
      const invalidData = {
        ...mockProcessedWeaponData,
        basicInfo: {
          ...mockBasicWeaponInfo,
          name: "",
        },
      };

      const result = processor.validateWeaponData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("音動機名が無効です");
    });

    it("レア度が無効な場合は検証に失敗する", () => {
      const invalidData = {
        ...mockProcessedWeaponData,
        basicInfo: {
          ...mockBasicWeaponInfo,
          rarity: "B" as any,
        },
      };

      const result = processor.validateWeaponData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("レア度が無効です: B");
    });

    it("スキル情報が存在しない場合は検証に失敗する", () => {
      const invalidData = {
        ...mockProcessedWeaponData,
        skillInfo: null as any,
      };

      const result = processor.validateWeaponData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("スキル情報が存在しません");
    });

    it("スキル名の型が無効な場合は検証に失敗する", () => {
      const invalidData = {
        ...mockProcessedWeaponData,
        skillInfo: {
          ...mockWeaponSkillInfo,
          equipmentSkillName: 123 as any,
        },
      };

      const result = processor.validateWeaponData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("スキル名の型が無効です");
    });

    it("属性情報が存在しない場合は検証に失敗する", () => {
      const invalidData = {
        ...mockProcessedWeaponData,
        attributesInfo: null as any,
      };

      const result = processor.validateWeaponData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("属性情報が存在しません");
    });

    it("属性が配列ではない場合は検証に失敗する", () => {
      const invalidData = {
        ...mockProcessedWeaponData,
        attributesInfo: {
          ...mockWeaponAttributesInfo,
          hp: "invalid" as any,
        },
      };

      const result = processor.validateWeaponData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("属性 hp が配列ではありません");
    });

    it("属性配列の長さが7ではない場合は検証に失敗する", () => {
      const invalidData = {
        ...mockProcessedWeaponData,
        attributesInfo: {
          ...mockWeaponAttributesInfo,
          hp: [100, 110, 120], // 長さが3
        },
      };

      const result = processor.validateWeaponData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("属性 hp の配列長が7ではありません: 3");
    });

    it("属性値が数値ではない場合は検証に失敗する", () => {
      const invalidData = {
        ...mockProcessedWeaponData,
        attributesInfo: {
          ...mockWeaponAttributesInfo,
          hp: [100, "invalid", 120, 130, 140, 150, 160] as any,
        },
      };

      const result = processor.validateWeaponData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "属性 hp[1] が有効な数値ではありません: invalid"
      );
    });

    it("エージェント情報が存在しない場合は検証に失敗する", () => {
      const invalidData = {
        ...mockProcessedWeaponData,
        agentInfo: null as any,
      };

      const result = processor.validateWeaponData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("エージェント情報が存在しません");
    });

    it("エージェントIDが無効な場合は検証に失敗する", () => {
      const invalidData = {
        ...mockProcessedWeaponData,
        agentInfo: {
          agentId: "",
        },
      };

      const result = processor.validateWeaponData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("エージェントIDが無効です");
    });

    it("エージェントIDがundefinedの場合は検証に成功する", () => {
      const validData = {
        ...mockProcessedWeaponData,
        agentInfo: {
          agentId: undefined,
        },
      };

      const result = processor.validateWeaponData(validData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("検証処理中にエラーが発生した場合は適切に処理する", () => {
      // 無効なデータ構造を渡してエラーを発生させる
      // attributesInfoの配列アクセス時にエラーが発生するように設定
      const corruptedData = {
        basicInfo: mockBasicWeaponInfo,
        skillInfo: mockWeaponSkillInfo,
        attributesInfo: {
          get hp() {
            throw new Error("プロパティアクセスエラー");
          },
          atk: [50, 55, 60, 65, 70, 75, 80],
          def: [30, 33, 36, 39, 42, 45, 48],
          impact: [10, 11, 12, 13, 14, 15, 16],
          critRate: [5, 5.5, 6, 6.5, 7, 7.5, 8],
          critDmg: [20, 22, 24, 26, 28, 30, 32],
          anomalyMastery: [0, 0, 0, 0, 0, 0, 0],
          anomalyProficiency: [0, 0, 0, 0, 0, 0, 0],
          penRatio: [0, 0, 0, 0, 0, 0, 0],
          energy: [0, 0, 0, 0, 0, 0, 0],
        },
        agentInfo: mockWeaponAgentInfo,
      } as any;

      const result = processor.validateWeaponData(corruptedData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "検証処理中にエラーが発生: プロパティアクセスエラー"
      );
    });
  });

  describe("attemptGracefulDegradation", () => {
    it("部分的APIデータ取得に成功した場合は部分的データを返す", async () => {
      const mockPartialApiData = { ...mockApiResponse };

      // 部分的APIデータ取得を成功させる
      const tryPartialApiDataRetrievalSpy = vi
        .spyOn(processor as any, "tryPartialApiDataRetrieval")
        .mockResolvedValue(mockPartialApiData);

      // 部分的データ処理を成功させる
      const processPartialApiDataSpy = vi
        .spyOn(processor as any, "processPartialApiData")
        .mockResolvedValue(mockProcessedWeaponData);

      // テスト実行
      const result = await processor["attemptGracefulDegradation"](
        mockWeaponEntry,
        new Error("テストエラー")
      );

      // 検証
      expect(result).toEqual(mockProcessedWeaponData);
      expect(tryPartialApiDataRetrievalSpy).toHaveBeenCalledWith("901");
      expect(processPartialApiDataSpy).toHaveBeenCalledWith(
        mockPartialApiData,
        mockWeaponEntry
      );
    });

    it("部分的APIデータ取得に失敗した場合は最小限データを生成する", async () => {
      // 部分的APIデータ取得を失敗させる
      const tryPartialApiDataRetrievalSpy = vi
        .spyOn(processor as any, "tryPartialApiDataRetrieval")
        .mockResolvedValue(null);

      // 最小限データ生成をモック
      const createMinimalWeaponDataSpy = vi
        .spyOn(processor as any, "createMinimalWeaponData")
        .mockReturnValue(mockProcessedWeaponData);

      // テスト実行
      const result = await processor["attemptGracefulDegradation"](
        mockWeaponEntry,
        new Error("テストエラー")
      );

      // 検証
      expect(result).toEqual(mockProcessedWeaponData);
      expect(tryPartialApiDataRetrievalSpy).toHaveBeenCalledWith("901");
      expect(createMinimalWeaponDataSpy).toHaveBeenCalledWith(mockWeaponEntry);
    });

    it("最小限データの検証に失敗した場合はnullを返す", async () => {
      // 部分的APIデータ取得を失敗させる
      vi.spyOn(
        processor as any,
        "tryPartialApiDataRetrieval"
      ).mockResolvedValue(null);

      // 最小限データ生成をモック
      const invalidMinimalData = {
        ...mockProcessedWeaponData,
        basicInfo: { ...mockBasicWeaponInfo, id: "" }, // 無効なID
      };
      vi.spyOn(processor as any, "createMinimalWeaponData").mockReturnValue(
        invalidMinimalData
      );

      // テスト実行
      const result = await processor["attemptGracefulDegradation"](
        mockWeaponEntry,
        new Error("テストエラー")
      );

      // 検証
      expect(result).toBeNull();
    });

    it("グレースフル劣化処理中にエラーが発生した場合はnullを返す", async () => {
      // 部分的APIデータ取得でエラーを発生させる
      vi.spyOn(
        processor as any,
        "tryPartialApiDataRetrieval"
      ).mockRejectedValue(new Error("劣化処理エラー"));

      // テスト実行
      const result = await processor["attemptGracefulDegradation"](
        mockWeaponEntry,
        new Error("テストエラー")
      );

      // 検証
      expect(result).toBeNull();
    });
  });

  describe("private methods", () => {
    describe("fetchWeaponApiData", () => {
      it("日本語と英語の両方のAPIデータを取得する", async () => {
        // モックの設定
        (mockApiClient.fetchCharacterData as Mock)
          .mockResolvedValueOnce(mockApiResponse) // 日本語データ
          .mockResolvedValueOnce(mockApiResponse); // 英語データ

        // テスト実行
        const result = await processor["fetchWeaponApiData"]("901");

        // 検証
        expect(result.ja).toEqual(mockApiResponse);
        expect(result.en).toEqual(mockApiResponse);
        expect(mockApiClient.fetchCharacterData).toHaveBeenCalledWith(
          901,
          "ja-jp"
        );
        expect(mockApiClient.fetchCharacterData).toHaveBeenCalledWith(
          901,
          "en-us"
        );
      });

      it("英語データ取得に失敗しても日本語データは返す", async () => {
        // モックの設定
        (mockApiClient.fetchCharacterData as Mock)
          .mockResolvedValueOnce(mockApiResponse) // 日本語データ成功
          .mockRejectedValueOnce(new Error("英語データ取得失敗")); // 英語データ失敗

        // テスト実行
        const result = await processor["fetchWeaponApiData"]("901");

        // 検証
        expect(result.ja).toEqual(mockApiResponse);
        expect(result.en).toBeUndefined();
      });

      it("日本語データ取得に失敗した場合はParsingErrorを投げる", async () => {
        // モックの設定
        (mockApiClient.fetchCharacterData as Mock).mockRejectedValue(
          new Error("日本語データ取得失敗")
        );

        // テスト実行と検証
        await expect(processor["fetchWeaponApiData"]("901")).rejects.toThrow(
          ParsingError
        );
        await expect(processor["fetchWeaponApiData"]("901")).rejects.toThrow(
          "音動機APIデータの取得に失敗しました"
        );
      });
    });

    describe("tryPartialApiDataRetrieval", () => {
      it("エラー回復ハンドラーを使用してAPIデータを取得する", async () => {
        // モックの設定
        (mockErrorRecoveryHandler.retryApiRequest as Mock).mockResolvedValue(
          mockApiResponse
        );

        // テスト実行
        const result = await processor["tryPartialApiDataRetrieval"]("901");

        // 検証
        expect(result).toEqual(mockApiResponse);
        expect(mockErrorRecoveryHandler.retryApiRequest).toHaveBeenCalledWith(
          expect.any(Function),
          "901",
          "weapon_api_data_retrieval"
        );
      });

      it("無効な音動機IDの場合はnullを返す", async () => {
        // テスト実行
        const result = await processor["tryPartialApiDataRetrieval"]("invalid");

        // 検証
        expect(result).toBeNull();
        expect(mockErrorRecoveryHandler.retryApiRequest).not.toHaveBeenCalled();
      });

      it("エラー回復に失敗した場合はnullを返す", async () => {
        // モックの設定
        (mockErrorRecoveryHandler.retryApiRequest as Mock).mockRejectedValue(
          new Error("回復失敗")
        );

        // テスト実行
        const result = await processor["tryPartialApiDataRetrieval"]("901");

        // 検証
        expect(result).toBeNull();
      });
    });

    describe("createMinimalWeaponData", () => {
      it("最小限の音動機データを作成する", () => {
        // テスト実行
        const result = processor["createMinimalWeaponData"](mockWeaponEntry);

        // 検証
        expect(result.basicInfo).toEqual({
          id: "901",
          name: "テスト音動機",
          rarity: "S",
          specialty: "attack",
        });
        expect(result.skillInfo).toEqual({
          equipmentSkillName: "",
          equipmentSkillDesc: "",
        });
        expect(result.attributesInfo.hp).toEqual(new Array(7).fill(0));
        expect(result.agentInfo.agentId).toBeUndefined();
      });

      it("特性が未定義の場合は空文字列を設定する", () => {
        const weaponEntryWithoutSpecialty = {
          ...mockWeaponEntry,
          specialty: undefined,
        };

        // テスト実行
        const result = processor["createMinimalWeaponData"](
          weaponEntryWithoutSpecialty
        );

        // 検証
        expect(result.basicInfo.specialty).toBe("");
      });
    });
  });
});
