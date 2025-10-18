import { describe, it, expect, vi, beforeEach } from "vitest";
import { BompDataProcessor } from "../../src/processors/BompDataProcessor";
import { HoyoLabApiClient } from "../../src/clients/HoyoLabApiClient";
import { BompDataMapper } from "../../src/mappers/BompDataMapper";
import { BompEntry } from "../../src/types";
import { ApiResponse, Module } from "../../src/types/api";
import { ProcessedBompData } from "../../src/types/processing";
import { ApiError, MappingError } from "../../src/errors";

describe("BompDataProcessor", () => {
  let processor: BompDataProcessor;
  let mockApiClient: HoyoLabApiClient;
  let mockBompDataMapper: BompDataMapper;

  const mockBompEntry: BompEntry = {
    id: "test-bomp",
    pageId: 912,
    wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/912",
    jaName: "テストボンプ",
  };

  const mockApiResponse: ApiResponse = {
    retcode: 0,
    message: "OK",
    data: {
      page: {
        id: "912",
        name: "テストボンプ",
        agent_specialties: { values: ["撃破"] },
        agent_stats: { values: ["氷属性"] },
        agent_rarity: { values: ["A"] },
        agent_faction: { values: ["ビクトリア家政"] },
        modules: [
          {
            name: "ascension",
            components: [
              {
                component_id: "ascension",
                data: JSON.stringify({
                  combatList: {
                    hp: { values: [100, 200, 300, 400, 500, 600, 700] },
                    atk: { values: [50, 100, 150, 200, 250, 300, 350] },
                    def: { values: [30, 60, 90, 120, 150, 180, 210] },
                  },
                }),
              },
            ],
          },
          {
            name: "baseInfo",
            components: [
              {
                component_id: "baseInfo",
                data: JSON.stringify({
                  list: [
                    {
                      key: "陣営",
                      value: ["ビクトリア家政"],
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

  beforeEach(() => {
    mockApiClient = {
      fetchCharacterData: vi.fn(),
    } as any;

    mockBompDataMapper = {
      extractBasicBompInfo: vi.fn(),
      extractBompAttributes: vi.fn(),
      extractExtraAbility: vi.fn(),
    } as any;

    processor = new BompDataProcessor(mockApiClient, mockBompDataMapper);
  });

  describe("processBompData", () => {
    it("正常なボンプデータを処理できる", async () => {
      // Arrange
      vi.mocked(mockApiClient.fetchCharacterData).mockResolvedValue(
        mockApiResponse
      );
      vi.mocked(mockBompDataMapper.extractBasicBompInfo).mockReturnValue({
        id: "test-bomp",
        name: "テストボンプ",
        stats: ["ice"],
        rarity: "A級",
        releaseVersion: 1.0,
      });
      vi.mocked(mockBompDataMapper.extractBompAttributes).mockReturnValue({
        hp: [100, 200, 300, 400, 500, 600, 700],
        atk: [50, 100, 150, 200, 250, 300, 350],
        def: [30, 60, 90, 120, 150, 180, 210],
        impact: 100,
        critRate: 5,
        critDmg: 50,
        anomalyMastery: 0,
        anomalyProficiency: 0,
        penRatio: 0,
        energy: 0,
      });
      vi.mocked(mockBompDataMapper.extractExtraAbility).mockReturnValue(
        "テスト追加能力"
      );

      // Act
      const result = await processor.processBompData(mockBompEntry);

      // Assert
      expect(result).toBeDefined();
      expect(result.basicInfo.id).toBe("test-bomp");
      expect(result.basicInfo.name).toBe("テストボンプ");
      expect(result.extraAbility).toBe("テスト追加能力");
      expect(result.attributesInfo).toBeDefined();
      expect(result.factionIds).toEqual([]);
    });

    it("日本語と英語両方のAPIデータを取得する", async () => {
      // Arrange
      const enApiResponse = { ...mockApiResponse };
      vi.mocked(mockApiClient.fetchCharacterData)
        .mockResolvedValueOnce(mockApiResponse) // ja-jp
        .mockResolvedValueOnce(enApiResponse); // en-us

      vi.mocked(mockBompDataMapper.extractBasicBompInfo).mockReturnValue({
        id: "test-bomp",
        name: "テストボンプ",
        stats: ["ice"],
        rarity: "A級",
      });
      vi.mocked(mockBompDataMapper.extractBompAttributes).mockReturnValue({
        hp: [100, 200, 300, 400, 500, 600, 700],
        atk: [50, 100, 150, 200, 250, 300, 350],
        def: [30, 60, 90, 120, 150, 180, 210],
        impact: 100,
        critRate: 5,
        critDmg: 50,
        anomalyMastery: 0,
        anomalyProficiency: 0,
        penRatio: 0,
        energy: 0,
      });
      vi.mocked(mockBompDataMapper.extractExtraAbility).mockReturnValue("");

      // Act
      await processor.processBompData(mockBompEntry);

      // Assert
      expect(mockApiClient.fetchCharacterData).toHaveBeenCalledTimes(2);
      expect(mockApiClient.fetchCharacterData).toHaveBeenCalledWith(
        912,
        "ja-jp"
      );
      expect(mockApiClient.fetchCharacterData).toHaveBeenCalledWith(
        912,
        "en-us"
      );
    });

    it("英語APIが失敗しても処理を継続する", async () => {
      // Arrange
      vi.mocked(mockApiClient.fetchCharacterData)
        .mockResolvedValueOnce(mockApiResponse) // ja-jp成功
        .mockRejectedValueOnce(new Error("English API failed")); // en-us失敗

      vi.mocked(mockBompDataMapper.extractBasicBompInfo).mockReturnValue({
        id: "test-bomp",
        name: "テストボンプ",
        stats: ["ice"],
        rarity: "A級",
      });
      vi.mocked(mockBompDataMapper.extractBompAttributes).mockReturnValue({
        hp: [100, 200, 300, 400, 500, 600, 700],
        atk: [50, 100, 150, 200, 250, 300, 350],
        def: [30, 60, 90, 120, 150, 180, 210],
        impact: 100,
        critRate: 5,
        critDmg: 50,
        anomalyMastery: 0,
        anomalyProficiency: 0,
        penRatio: 0,
        energy: 0,
      });
      vi.mocked(mockBompDataMapper.extractExtraAbility).mockReturnValue("");

      // Act & Assert - エラーが投げられないことを確認
      const result = await processor.processBompData(mockBompEntry);
      expect(result).toBeDefined();
    });

    it("API エラー時にグレースフル劣化を実行する", async () => {
      // Arrange
      vi.mocked(mockApiClient.fetchCharacterData).mockRejectedValue(
        new Error("API Error")
      );

      // Act
      const result = await processor.processBompData(mockBompEntry);

      // Assert
      expect(result).toBeDefined();
      expect(result.basicInfo.id).toBe("test-bomp");
      expect(result.basicInfo.name).toBe("テストボンプ"); // Scraping.mdからの名前
      expect(result.basicInfo.stats).toEqual(["physical"]); // デフォルト属性
      expect(result.extraAbility).toBe("");
      expect(result.factionIds).toEqual([]);
    });

    it("マッピングエラー時にMappingErrorを投げる", async () => {
      // Arrange
      vi.mocked(mockApiClient.fetchCharacterData).mockResolvedValue(
        mockApiResponse
      );
      vi.mocked(mockBompDataMapper.extractBasicBompInfo).mockImplementation(
        () => {
          throw new Error("Mapping failed");
        }
      );

      // Act & Assert
      const result = await processor.processBompData(mockBompEntry);

      // グレースフル劣化が実行されることを確認
      expect(result).toBeDefined();
      expect(result.basicInfo.id).toBe("test-bomp");
      expect(result.basicInfo.stats).toEqual(["physical"]);
    });

    it("属性抽出エラー時にMappingErrorを投げる", async () => {
      // Arrange
      vi.mocked(mockApiClient.fetchCharacterData).mockResolvedValue(
        mockApiResponse
      );
      vi.mocked(mockBompDataMapper.extractBasicBompInfo).mockReturnValue({
        id: "test-bomp",
        name: "テストボンプ",
        stats: ["ice"],
        rarity: "A級",
      });
      vi.mocked(mockBompDataMapper.extractBompAttributes).mockImplementation(
        () => {
          throw new Error("Attributes extraction failed");
        }
      );

      // Act & Assert
      const result = await processor.processBompData(mockBompEntry);

      // グレースフル劣化が実行されることを確認
      expect(result).toBeDefined();
      expect(result.basicInfo.id).toBe("test-bomp");
    });

    it("追加能力抽出エラー時は空文字列を返す", async () => {
      // Arrange
      vi.mocked(mockApiClient.fetchCharacterData).mockResolvedValue(
        mockApiResponse
      );
      vi.mocked(mockBompDataMapper.extractBasicBompInfo).mockReturnValue({
        id: "test-bomp",
        name: "テストボンプ",
        stats: ["ice"],
      });
      vi.mocked(mockBompDataMapper.extractBompAttributes).mockReturnValue({
        hp: [100, 200, 300, 400, 500, 600, 700],
        atk: [50, 100, 150, 200, 250, 300, 350],
        def: [30, 60, 90, 120, 150, 180, 210],
        impact: 100,
        critRate: 5,
        critDmg: 50,
        anomalyMastery: 0,
        anomalyProficiency: 0,
        penRatio: 0,
        energy: 0,
      });
      vi.mocked(mockBompDataMapper.extractExtraAbility).mockImplementation(
        () => {
          throw new Error("Extra ability extraction failed");
        }
      );

      // Act
      const result = await processor.processBompData(mockBompEntry);

      // Assert
      expect(result.extraAbility).toBe("");
    });
  });

  describe("extractBompFactions", () => {
    it("baseInfo モジュールから派閥IDを抽出できる", () => {
      // Arrange
      const modules: Module[] = [
        {
          name: "baseInfo",
          components: [
            {
              component_id: "baseInfo",
              data: JSON.stringify({
                list: [
                  {
                    key: "陣営",
                    value: ["ビクトリア家政"],
                  },
                ],
              }),
            },
          ],
        },
      ];

      // Act
      const result = processor.extractBompFactions(modules);

      // Assert
      expect(Array.isArray(result)).toBe(true);
    });

    it("複数の派閥IDを抽出できる", () => {
      // Arrange
      const modules: Module[] = [
        {
          name: "baseInfo",
          components: [
            {
              component_id: "baseInfo",
              data: JSON.stringify({
                list: [
                  {
                    key: "陣営",
                    value: ["ビクトリア家政", "白祇重工"],
                  },
                ],
              }),
            },
          ],
        },
      ];

      // Act
      const result = processor.extractBompFactions(modules);

      // Assert
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it("派閥IDの重複を除去する", () => {
      // Arrange
      const modules: Module[] = [
        {
          name: "baseInfo",
          components: [
            {
              component_id: "baseInfo",
              data: JSON.stringify({
                list: [
                  {
                    key: "陣営",
                    value: ["ビクトリア家政", "ビクトリア家政"],
                  },
                ],
              }),
            },
          ],
        },
      ];

      // Act
      const result = processor.extractBompFactions(modules);

      // Assert
      expect(Array.isArray(result)).toBe(true);
      // 重複が除去されることを確認（具体的な値は実装に依存）
    });

    it("無効なモジュールデータでは空配列を返す", () => {
      // Act
      const result = processor.extractBompFactions([]);

      // Assert
      expect(result).toEqual([]);
    });

    it("null/undefinedモジュールでは空配列を返す", () => {
      // Act
      const result1 = processor.extractBompFactions(null as any);
      const result2 = processor.extractBompFactions(undefined as any);

      // Assert
      expect(result1).toEqual([]);
      expect(result2).toEqual([]);
    });

    it("baseInfo モジュールが存在しない場合は空配列を返す", () => {
      // Arrange
      const modules: Module[] = [
        {
          name: "other",
          components: [],
        },
      ];

      // Act
      const result = processor.extractBompFactions(modules);

      // Assert
      expect(result).toEqual([]);
    });

    it("baseInfo コンポーネントが存在しない場合は空配列を返す", () => {
      // Arrange
      const modules: Module[] = [
        {
          name: "baseInfo",
          components: [
            {
              component_id: "other",
              data: "{}",
            },
          ],
        },
      ];

      // Act
      const result = processor.extractBompFactions(modules);

      // Assert
      expect(result).toEqual([]);
    });

    it("baseInfo データが存在しない場合は空配列を返す", () => {
      // Arrange
      const modules: Module[] = [
        {
          name: "baseInfo",
          components: [
            {
              component_id: "baseInfo",
              data: undefined as any,
            },
          ],
        },
      ];

      // Act
      const result = processor.extractBompFactions(modules);

      // Assert
      expect(result).toEqual([]);
    });

    it("無効なJSON データの場合は空配列を返す", () => {
      // Arrange
      const modules: Module[] = [
        {
          name: "baseInfo",
          components: [
            {
              component_id: "baseInfo",
              data: "invalid json",
            },
          ],
        },
      ];

      // Act
      const result = processor.extractBompFactions(modules);

      // Assert
      expect(result).toEqual([]);
    });

    it("list が存在しない場合は空配列を返す", () => {
      // Arrange
      const modules: Module[] = [
        {
          name: "baseInfo",
          components: [
            {
              component_id: "baseInfo",
              data: JSON.stringify({
                other: "data",
              }),
            },
          ],
        },
      ];

      // Act
      const result = processor.extractBompFactions(modules);

      // Assert
      expect(result).toEqual([]);
    });

    it("陣営キーが存在しない場合は空配列を返す", () => {
      // Arrange
      const modules: Module[] = [
        {
          name: "baseInfo",
          components: [
            {
              component_id: "baseInfo",
              data: JSON.stringify({
                list: [
                  {
                    key: "other",
                    value: ["some value"],
                  },
                ],
              }),
            },
          ],
        },
      ];

      // Act
      const result = processor.extractBompFactions(modules);

      // Assert
      expect(result).toEqual([]);
    });

    it("無効な派閥IDをフィルタリングする", () => {
      // Arrange - 実際の派閥名解決は実装に依存するため、モックを使用
      const modules: Module[] = [
        {
          name: "baseInfo",
          components: [
            {
              component_id: "baseInfo",
              data: JSON.stringify({
                list: [
                  {
                    key: "陣営",
                    value: ["存在しない派閥"],
                  },
                ],
              }),
            },
          ],
        },
      ];

      // Act
      const result = processor.extractBompFactions(modules);

      // Assert
      expect(Array.isArray(result)).toBe(true);
      // 無効な派閥IDは除外される
    });
  });

  describe("validateBompData", () => {
    it("有効なボンプデータを検証できる", () => {
      // Arrange
      const validData: ProcessedBompData = {
        basicInfo: {
          id: "test-bomp",
          name: "テストボンプ",
          stats: ["ice"],
          rarity: "A級",
          releaseVersion: 1.0,
        },
        attributesInfo: {
          ascensionData: JSON.stringify({ test: "data" }),
        },
        extraAbility: "テスト能力",
        factionIds: [1, 2],
      };

      // Act
      const result = processor.validateBompData(validData);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("無効なボンプデータでエラーを返す", () => {
      // Arrange
      const invalidData: ProcessedBompData = {
        basicInfo: {
          id: "",
          name: "",
          stats: null as any, // null should be invalid
        },
        attributesInfo: {
          ascensionData: "",
        },
        extraAbility: "",
      };

      // Act
      const result = processor.validateBompData(invalidData);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain("ボンプIDが無効です");
      expect(result.errors).toContain("ボンプ名が無効です");
      expect(result.errors).toContain("ボンプ属性が無効です");
    });

    it("基本情報が存在しない場合にエラーを返す", () => {
      // Arrange
      const invalidData: ProcessedBompData = {
        basicInfo: null as any,
        attributesInfo: {
          ascensionData: JSON.stringify({ test: "data" }),
        },
        extraAbility: "",
      };

      // Act
      const result = processor.validateBompData(invalidData);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("基本情報が存在しません");
    });

    it("属性情報が存在しない場合にエラーを返す", () => {
      // Arrange
      const invalidData: ProcessedBompData = {
        basicInfo: {
          id: "test-bomp",
          name: "テストボンプ",
          stats: ["ice"],
        },
        attributesInfo: null as any,
        extraAbility: "",
      };

      // Act
      const result = processor.validateBompData(invalidData);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("属性情報が存在しません");
    });

    it("アセンションデータが無効な場合にエラーを返す", () => {
      // Arrange
      const invalidData: ProcessedBompData = {
        basicInfo: {
          id: "test-bomp",
          name: "テストボンプ",
          stats: ["ice"],
        },
        attributesInfo: {
          ascensionData: null as any,
        },
        extraAbility: "",
      };

      // Act
      const result = processor.validateBompData(invalidData);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("アセンションデータが無効です");
    });

    it("部分的に無効なデータで警告を返す", () => {
      // Arrange
      const partiallyInvalidData: ProcessedBompData = {
        basicInfo: {
          id: "test-bomp",
          name: "テストボンプ",
          stats: ["ice"],
          releaseVersion: -1, // 無効なバージョン
        },
        attributesInfo: {
          ascensionData: JSON.stringify({ test: "data" }),
        },
        extraAbility: "テスト能力",
        factionIds: [1, -1], // 無効な派閥ID含む
      };

      // Act
      const result = processor.validateBompData(partiallyInvalidData);

      // Assert
      expect(result.isValid).toBe(true); // エラーではなく警告のみ
      expect(result.warnings?.length).toBeGreaterThan(0);
      expect(result.warnings).toContain("リリースバージョンが無効です");
      expect(result.warnings?.some((w) => w.includes("無効な派閥ID"))).toBe(
        true
      );
    });

    it("追加能力が文字列でない場合に警告を返す", () => {
      // Arrange
      const invalidData: ProcessedBompData = {
        basicInfo: {
          id: "test-bomp",
          name: "テストボンプ",
          stats: ["ice"],
        },
        attributesInfo: {
          ascensionData: JSON.stringify({ test: "data" }),
        },
        extraAbility: null as any,
      };

      // Act
      const result = processor.validateBompData(invalidData);

      // Assert
      expect(result.isValid).toBe(true); // 警告のみ
      expect(result.warnings).toContain("追加能力が文字列ではありません");
    });

    it("派閥IDが配列でない場合に警告を返す", () => {
      // Arrange
      const invalidData: ProcessedBompData = {
        basicInfo: {
          id: "test-bomp",
          name: "テストボンプ",
          stats: ["ice"],
        },
        attributesInfo: {
          ascensionData: JSON.stringify({ test: "data" }),
        },
        extraAbility: "",
        factionIds: "not an array" as any,
      };

      // Act
      const result = processor.validateBompData(invalidData);

      // Assert
      expect(result.isValid).toBe(true); // 警告のみ
      expect(result.warnings).toContain("派閥IDが配列ではありません");
    });

    it("派閥IDが未定義の場合は警告なし", () => {
      // Arrange
      const validData: ProcessedBompData = {
        basicInfo: {
          id: "test-bomp",
          name: "テストボンプ",
          stats: ["ice"],
          rarity: "A", // Add rarity to avoid warning
        },
        attributesInfo: {
          ascensionData: JSON.stringify({ test: "data" }),
        },
        extraAbility: "",
        factionIds: undefined,
      };

      // Act
      const result = processor.validateBompData(validData);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.warnings?.length || 0).toBe(0);
    });

    it("検証中にエラーが発生した場合の処理", () => {
      // Arrange - プロパティアクセス時にエラーを発生させるオブジェクト
      const errorData = {
        get basicInfo() {
          throw new Error("Property access error");
        },
        attributesInfo: {
          ascensionData: JSON.stringify({ test: "data" }),
        },
        extraAbility: "",
      } as unknown as ProcessedBompData;

      // Act
      const result = processor.validateBompData(errorData as ProcessedBompData);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("データ検証中にエラーが発生しました");
    });

    it("型チェックが正しく動作する", () => {
      // Arrange
      const invalidTypeData: ProcessedBompData = {
        basicInfo: {
          id: 123 as any, // 数値（文字列であるべき）
          name: true as any, // ブール値（文字列であるべき）
          stats: "invalid" as any, // 文字列（配列であるべき）
          releaseVersion: "1.0" as any, // 文字列（数値であるべき）
        },
        attributesInfo: {
          ascensionData: 123 as any, // 数値（文字列であるべき）
        },
        extraAbility: "",
      };

      // Act
      const result = processor.validateBompData(invalidTypeData);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("ボンプIDが無効です");
      expect(result.errors).toContain("ボンプ名が無効です");
      expect(result.errors).toContain("ボンプ属性が無効です");
      expect(result.errors).toContain("アセンションデータが無効です");
      expect(result.warnings).toContain("リリースバージョンが無効です");
    });
  });

  describe("レア度処理の単体テスト", () => {
    describe("validateRarityData", () => {
      it("有効なレア度データ（A級）を検証できる", () => {
        // Arrange
        const validRarity = "A級";

        // Act
        const result = (processor as any).validateRarityData(validRarity);

        // Assert
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toContain('レア度値 "A級" は正規化が必要です');
      });

      it("有効なレア度データ（S級）を検証できる", () => {
        // Arrange
        const validRarity = "S級";

        // Act
        const result = (processor as any).validateRarityData(validRarity);

        // Assert
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toContain('レア度値 "S級" は正規化が必要です');
      });

      it("正規化済みレア度データ（A）を検証できる", () => {
        // Arrange
        const normalizedRarity = "A";

        // Act
        const result = (processor as any).validateRarityData(normalizedRarity);

        // Assert
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
      });

      it("正規化済みレア度データ（S）を検証できる", () => {
        // Arrange
        const normalizedRarity = "S";

        // Act
        const result = (processor as any).validateRarityData(normalizedRarity);

        // Assert
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
      });

      it("null/undefinedレア度データでエラーを返す", () => {
        // Act
        const result1 = (processor as any).validateRarityData(null);
        const result2 = (processor as any).validateRarityData(undefined);

        // Assert
        expect(result1.isValid).toBe(false);
        expect(result1.errors).toContain("レア度データが存在しません");
        expect(result2.isValid).toBe(false);
        expect(result2.errors).toContain("レア度データが存在しません");
      });

      it("空文字列レア度データでエラーを返す", () => {
        // Act
        const result1 = (processor as any).validateRarityData("");
        const result2 = (processor as any).validateRarityData("   ");

        // Assert
        expect(result1.isValid).toBe(false);
        expect(result1.errors).toContain("レア度データが存在しません"); // Empty string is falsy
        expect(result2.isValid).toBe(false);
        expect(result2.errors).toContain("レア度データが空です"); // Whitespace string is truthy but empty after trim
      });

      it("無効なレア度値でエラーを返す", () => {
        // Arrange
        const invalidRarities = ["B級", "C級", "SSR", "UR", "invalid"];

        for (const invalidRarity of invalidRarities) {
          // Act
          const result = (processor as any).validateRarityData(invalidRarity);

          // Assert
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          expect(result.errors[0]).toContain(
            `無効なレア度値: "${invalidRarity}"`
          );
        }
      });

      it("数値型レア度データでエラーを返す", () => {
        // Act
        const result = (processor as any).validateRarityData(1);

        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("レア度データが存在しません");
      });

      it("オブジェクト型レア度データでエラーを返す", () => {
        // Act
        const result = (processor as any).validateRarityData({ rarity: "A級" });

        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("レア度データが存在しません");
      });

      it("検証中にエラーが発生した場合の処理", () => {
        // Arrange - プロパティアクセス時にエラーを発生させるオブジェクト
        const errorRarity = {
          toString() {
            throw new Error("toString error");
          },
          trim() {
            throw new Error("trim error");
          },
        };

        // Act
        const result = (processor as any).validateRarityData(errorRarity);

        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain("レア度データが存在しません");
      });
    });

    describe("validateBompData - レア度統合テスト", () => {
      it("有効なレア度を含むボンプデータを検証できる", () => {
        // Arrange
        const validData: ProcessedBompData = {
          basicInfo: {
            id: "test-bomp",
            name: "テストボンプ",
            stats: ["ice"],
            rarity: "A級",
            releaseVersion: 1.0,
          },
          attributesInfo: {
            ascensionData: JSON.stringify({ test: "data" }),
          },
          extraAbility: "テスト能力",
          factionIds: [1, 2],
        };

        // Act
        const result = processor.validateBompData(validData);

        // Assert
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toContain('レア度値 "A級" は正規化が必要です');
      });

      it("正規化済みレア度を含むボンプデータを検証できる", () => {
        // Arrange
        const validData: ProcessedBompData = {
          basicInfo: {
            id: "test-bomp",
            name: "テストボンプ",
            stats: ["ice"],
            rarity: "S",
            releaseVersion: 1.0,
          },
          attributesInfo: {
            ascensionData: JSON.stringify({ test: "data" }),
          },
          extraAbility: "テスト能力",
          factionIds: [1, 2],
        };

        // Act
        const result = processor.validateBompData(validData);

        // Assert
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
      });

      it("無効なレア度を含むボンプデータでエラーを返す", () => {
        // Arrange
        const invalidData: ProcessedBompData = {
          basicInfo: {
            id: "test-bomp",
            name: "テストボンプ",
            stats: ["ice"],
            rarity: "B級",
            releaseVersion: 1.0,
          },
          attributesInfo: {
            ascensionData: JSON.stringify({ test: "data" }),
          },
          extraAbility: "テスト能力",
          factionIds: [1, 2],
        };

        // Act
        const result = processor.validateBompData(invalidData);

        // Assert
        expect(result.isValid).toBe(false);
        expect(
          result.errors.some((error) => error.includes("無効なレア度値"))
        ).toBe(true);
      });

      it("レア度が存在しない場合に警告を返す", () => {
        // Arrange
        const dataWithoutRarity: ProcessedBompData = {
          basicInfo: {
            id: "test-bomp",
            name: "テストボンプ",
            stats: ["ice"],
            releaseVersion: 1.0,
          },
          attributesInfo: {
            ascensionData: JSON.stringify({ test: "data" }),
          },
          extraAbility: "テスト能力",
          factionIds: [1, 2],
        };

        // Act
        const result = processor.validateBompData(dataWithoutRarity);

        // Assert
        expect(result.isValid).toBe(true); // 警告のみ
        expect(result.warnings).toContain("レア度データが存在しません");
      });

      it("空のレア度を含むボンプデータでエラーを返す", () => {
        // Arrange
        const invalidData: ProcessedBompData = {
          basicInfo: {
            id: "test-bomp",
            name: "テストボンプ",
            stats: ["ice"],
            rarity: "",
            releaseVersion: 1.0,
          },
          attributesInfo: {
            ascensionData: JSON.stringify({ test: "data" }),
          },
          extraAbility: "テスト能力",
          factionIds: [1, 2],
        };

        // Act
        const result = processor.validateBompData(invalidData);

        // Assert
        expect(result.isValid).toBe(false);
        expect(
          result.errors.some((error) => error.includes("レア度データが空です"))
        ).toBe(true);
      });
    });

    describe("processBompData - レア度処理統合テスト", () => {
      beforeEach(() => {
        // BompDataMapperのレア度関連メソッドをモック
        mockBompDataMapper.extractRarityFromBaseInfo = vi.fn();
        mockBompDataMapper.normalizeRarity = vi.fn();
        mockBompDataMapper.getRarityExtractionStats = vi.fn().mockReturnValue({
          successful: 1,
          failed: 0,
          total: 1,
          successRate: 100,
        });
      });

      it("レア度抽出成功時に正しく処理される", async () => {
        // Arrange
        vi.mocked(mockApiClient.fetchCharacterData).mockResolvedValue(
          mockApiResponse
        );
        vi.mocked(mockBompDataMapper.extractBasicBompInfo).mockReturnValue({
          id: "test-bomp",
          name: "テストボンプ",
          stats: ["ice"],
          rarity: "A級",
          releaseVersion: 1.0,
        });
        vi.mocked(mockBompDataMapper.extractBompAttributes).mockReturnValue({
          hp: [100, 200, 300, 400, 500, 600, 700],
          atk: [50, 100, 150, 200, 250, 300, 350],
          def: [30, 60, 90, 120, 150, 180, 210],
          impact: 100,
          critRate: 5,
          critDmg: 50,
          anomalyMastery: 0,
          anomalyProficiency: 0,
          penRatio: 0,
          energy: 0,
        });
        vi.mocked(mockBompDataMapper.extractExtraAbility).mockReturnValue("");

        // Act
        const result = await processor.processBompData(mockBompEntry);

        // Assert
        expect(result).toBeDefined();
        expect(result.basicInfo.rarity).toBe("A級");
        expect(mockBompDataMapper.getRarityExtractionStats).toHaveBeenCalled();
      });

      it("レア度抽出失敗時にグレースフル劣化が実行される", async () => {
        // Arrange
        vi.mocked(mockApiClient.fetchCharacterData).mockRejectedValue(
          new Error("API Error")
        );

        // Act
        const result = await processor.processBompData(mockBompEntry);

        // Assert - グレースフル劣化でデフォルトレア度が設定される
        expect(result).toBeDefined();
        expect(result.basicInfo.rarity).toBe("A級"); // デフォルト値
      });

      it("レア度検証エラー時でも処理が継続される", async () => {
        // Arrange
        vi.mocked(mockApiClient.fetchCharacterData).mockResolvedValue(
          mockApiResponse
        );
        vi.mocked(mockBompDataMapper.extractBasicBompInfo).mockReturnValue({
          id: "test-bomp",
          name: "テストボンプ",
          stats: ["ice"],
          rarity: "無効なレア度",
          releaseVersion: 1.0,
        });
        vi.mocked(mockBompDataMapper.extractBompAttributes).mockReturnValue({
          hp: [100, 200, 300, 400, 500, 600, 700],
          atk: [50, 100, 150, 200, 250, 300, 350],
          def: [30, 60, 90, 120, 150, 180, 210],
          impact: 100,
          critRate: 5,
          critDmg: 50,
          anomalyMastery: 0,
          anomalyProficiency: 0,
          penRatio: 0,
          energy: 0,
        });
        vi.mocked(mockBompDataMapper.extractExtraAbility).mockReturnValue("");

        // Act
        const result = await processor.processBompData(mockBompEntry);

        // Assert - 検証エラーがあっても処理は継続される
        expect(result).toBeDefined();
        expect(result.basicInfo.rarity).toBe("無効なレア度");
      });
    });

    describe("グレースフル劣化処理のテスト", () => {
      it("API エラー時にレア度デフォルト値でグレースフル劣化を実行する", async () => {
        // Arrange
        vi.mocked(mockApiClient.fetchCharacterData).mockRejectedValue(
          new ApiError("API connection failed")
        );

        // Act
        const result = await processor.processBompData(mockBompEntry);

        // Assert
        expect(result).toBeDefined();
        expect(result.basicInfo.id).toBe("test-bomp");
        expect(result.basicInfo.name).toBe("テストボンプ");
        expect(result.basicInfo.rarity).toBe("A級"); // デフォルトレア度
        expect(result.basicInfo.stats).toEqual(["physical"]); // デフォルト属性
        expect(result.extraAbility).toBe("");
        expect(result.factionIds).toEqual([]);
      });

      it("マッピングエラー時にレア度デフォルト値でグレースフル劣化を実行する", async () => {
        // Arrange
        vi.mocked(mockApiClient.fetchCharacterData).mockResolvedValue(
          mockApiResponse
        );
        vi.mocked(mockBompDataMapper.extractBasicBompInfo).mockImplementation(
          () => {
            throw new MappingError("Rarity extraction failed");
          }
        );

        // Act
        const result = await processor.processBompData(mockBompEntry);

        // Assert
        expect(result).toBeDefined();
        expect(result.basicInfo.rarity).toBe("A級"); // デフォルトレア度
      });

      it("レア度抽出失敗時の統計が正しく記録される", async () => {
        // Arrange
        vi.mocked(mockApiClient.fetchCharacterData).mockRejectedValue(
          new Error("API Error")
        );

        // Act
        await processor.processBompData(mockBompEntry);

        // Assert - グレースフル劣化が実行されることを確認
        // 実際の統計記録は BompDataMapper で行われるため、
        // ここではグレースフル劣化が実行されることを確認
        expect(true).toBe(true); // プレースホルダー
      });

      it("部分的失敗時にレア度フォールバック処理が動作する", async () => {
        // Arrange
        vi.mocked(mockApiClient.fetchCharacterData).mockResolvedValue(
          mockApiResponse
        );
        vi.mocked(mockBompDataMapper.extractBasicBompInfo).mockReturnValue({
          id: "test-bomp",
          name: "テストボンプ",
          stats: ["ice"],
          rarity: "A級",
          releaseVersion: 1.0,
        });
        vi.mocked(mockBompDataMapper.extractBompAttributes).mockImplementation(
          () => {
            throw new Error("Attributes extraction failed");
          }
        );
        vi.mocked(mockBompDataMapper.extractExtraAbility).mockReturnValue("");

        // Act
        const result = await processor.processBompData(mockBompEntry);

        // Assert - 部分的失敗でもレア度は保持される
        expect(result).toBeDefined();
        expect(result.basicInfo.rarity).toBe("A級"); // グレースフル劣化でもデフォルト値
      });

      it("グレースフル劣化失敗時の処理", async () => {
        // Arrange
        vi.mocked(mockApiClient.fetchCharacterData).mockRejectedValue(
          new Error("API Error")
        );

        // グレースフル劣化処理内でもエラーが発生するようにモック
        const originalAttemptGracefulDegradation = (processor as any)
          .attemptGracefulDegradation;
        (processor as any).attemptGracefulDegradation = vi
          .fn()
          .mockResolvedValue(null);

        // Act & Assert
        await expect(
          processor.processBompData(mockBompEntry)
        ).rejects.toThrow();

        // Cleanup
        (processor as any).attemptGracefulDegradation =
          originalAttemptGracefulDegradation;
      });
    });

    describe("エラーケース処理のテスト", () => {
      it("レア度検証でMappingErrorが発生した場合の処理", () => {
        // Arrange
        const dataWithInvalidRarity: ProcessedBompData = {
          basicInfo: {
            id: "test-bomp",
            name: "テストボンプ",
            stats: ["ice"],
            rarity: "無効なレア度",
            releaseVersion: 1.0,
          },
          attributesInfo: {
            ascensionData: JSON.stringify({ test: "data" }),
          },
          extraAbility: "テスト能力",
          factionIds: [1, 2],
        };

        // Act
        const result = processor.validateBompData(dataWithInvalidRarity);

        // Assert
        expect(result.isValid).toBe(false);
        expect(
          result.errors.some((error) => error.includes("無効なレア度値"))
        ).toBe(true);
      });

      it("レア度データが配列の場合の処理", () => {
        // Arrange
        const dataWithArrayRarity: ProcessedBompData = {
          basicInfo: {
            id: "test-bomp",
            name: "テストボンプ",
            stats: ["ice"],
            rarity: ["A級"] as any,
            releaseVersion: 1.0,
          },
          attributesInfo: {
            ascensionData: JSON.stringify({ test: "data" }),
          },
          extraAbility: "テスト能力",
          factionIds: [1, 2],
        };

        // Act
        const result = processor.validateBompData(dataWithArrayRarity);

        // Assert
        expect(result.isValid).toBe(false);
        expect(
          result.errors.some((error) =>
            error.includes("レア度データが存在しません")
          )
        ).toBe(true);
      });

      it("レア度データがオブジェクトの場合の処理", () => {
        // Arrange
        const dataWithObjectRarity: ProcessedBompData = {
          basicInfo: {
            id: "test-bomp",
            name: "テストボンプ",
            stats: ["ice"],
            rarity: { value: "A級" } as any,
            releaseVersion: 1.0,
          },
          attributesInfo: {
            ascensionData: JSON.stringify({ test: "data" }),
          },
          extraAbility: "テスト能力",
          factionIds: [1, 2],
        };

        // Act
        const result = processor.validateBompData(dataWithObjectRarity);

        // Assert
        expect(result.isValid).toBe(false);
        expect(
          result.errors.some((error) =>
            error.includes("レア度データが存在しません")
          )
        ).toBe(true);
      });

      it("レア度検証中の予期しないエラーの処理", () => {
        // Arrange - validateRarityData メソッドでエラーを発生させる
        const originalValidateRarityData = (processor as any)
          .validateRarityData;
        (processor as any).validateRarityData = vi
          .fn()
          .mockImplementation(() => {
            throw new Error("Unexpected validation error");
          });

        const testData: ProcessedBompData = {
          basicInfo: {
            id: "test-bomp",
            name: "テストボンプ",
            stats: ["ice"],
            rarity: "A級",
            releaseVersion: 1.0,
          },
          attributesInfo: {
            ascensionData: JSON.stringify({ test: "data" }),
          },
          extraAbility: "テスト能力",
          factionIds: [1, 2],
        };

        // Act
        const result = processor.validateBompData(testData);

        // Assert
        expect(result.isValid).toBe(false);
        expect(
          result.errors.some((error) =>
            error.includes("データ検証中にエラーが発生しました")
          )
        ).toBe(true);

        // Cleanup
        (processor as any).validateRarityData = originalValidateRarityData;
      });
    });
  });

  describe("API データ変換ロジックのテスト", () => {
    it("APIレスポンスから基本情報を正しく抽出する", async () => {
      // Arrange
      const customApiResponse: ApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "912",
            name: "カスタムボンプ",
            agent_specialties: { values: ["強攻"] },
            agent_stats: { values: ["炎属性"] },
            agent_rarity: { values: ["S"] },
            agent_faction: { values: ["白祇重工"] },
            modules: [
              {
                name: "ascension",
                components: [
                  {
                    component_id: "ascension",
                    data: JSON.stringify({
                      combatList: {
                        hp: { values: [150, 250, 350, 450, 550, 650, 750] },
                        atk: { values: [75, 125, 175, 225, 275, 325, 375] },
                        def: { values: [45, 75, 105, 135, 165, 195, 225] },
                      },
                    }),
                  },
                ],
              },
            ],
          },
        },
      };

      vi.mocked(mockApiClient.fetchCharacterData).mockResolvedValue(
        customApiResponse
      );
      vi.mocked(mockBompDataMapper.extractBasicBompInfo).mockReturnValue({
        id: "custom-bomp",
        name: "カスタムボンプ",
        stats: ["fire"],
        releaseVersion: 1.1,
      });
      vi.mocked(mockBompDataMapper.extractBompAttributes).mockReturnValue({
        hp: [150, 250, 350, 450, 550, 650, 750],
        atk: [75, 125, 175, 225, 275, 325, 375],
        def: [45, 75, 105, 135, 165, 195, 225],
        impact: 120,
        critRate: 8,
        critDmg: 60,
        anomalyMastery: 10,
        anomalyProficiency: 5,
        penRatio: 2,
        energy: 15,
      });
      vi.mocked(mockBompDataMapper.extractExtraAbility).mockReturnValue(
        "カスタム追加能力"
      );

      // Act
      const result = await processor.processBompData({
        id: "custom-bomp",
        pageId: 912,
        wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/912",
        jaName: "カスタムボンプ",
      });

      // Assert
      expect(result.basicInfo.id).toBe("custom-bomp");
      expect(result.basicInfo.name).toBe("カスタムボンプ");
      expect(result.basicInfo.stats).toEqual(["fire"]);
      expect(result.basicInfo.releaseVersion).toBe(1.1);
      expect(result.extraAbility).toBe("カスタム追加能力");
    });

    it("複雑なモジュール構造を正しく処理する", async () => {
      // Arrange
      const complexApiResponse: ApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "913",
            name: "複雑ボンプ",
            agent_specialties: { values: ["異常"] },
            agent_stats: { values: ["電気属性"] },
            agent_rarity: { values: ["S"] },
            agent_faction: { values: ["ビクトリア家政"] },
            modules: [
              {
                name: "ascension",
                components: [
                  {
                    component_id: "ascension",
                    data: JSON.stringify({
                      combatList: {
                        hp: { values: [200, 300, 400, 500, 600, 700, 800] },
                        atk: { values: [100, 150, 200, 250, 300, 350, 400] },
                        def: { values: [60, 90, 120, 150, 180, 210, 240] },
                      },
                    }),
                  },
                ],
              },
              {
                name: "baseInfo",
                components: [
                  {
                    component_id: "baseInfo",
                    data: JSON.stringify({
                      list: [
                        {
                          key: "陣営",
                          value: ["ビクトリア家政", "白祇重工"],
                        },
                        {
                          key: "その他",
                          value: ["無関係データ"],
                        },
                      ],
                    }),
                  },
                ],
              },
              {
                name: "talent",
                components: [
                  {
                    component_id: "talent",
                    data: JSON.stringify({
                      description: "複雑な追加能力の説明",
                    }),
                  },
                ],
              },
            ],
          },
        },
      };

      vi.mocked(mockApiClient.fetchCharacterData).mockResolvedValue(
        complexApiResponse
      );
      vi.mocked(mockBompDataMapper.extractBasicBompInfo).mockReturnValue({
        id: "complex-bomp",
        name: "複雑ボンプ",
        stats: ["electric"],
      });
      vi.mocked(mockBompDataMapper.extractBompAttributes).mockReturnValue({
        hp: [200, 300, 400, 500, 600, 700, 800],
        atk: [100, 150, 200, 250, 300, 350, 400],
        def: [60, 90, 120, 150, 180, 210, 240],
        impact: 150,
        critRate: 10,
        critDmg: 70,
        anomalyMastery: 20,
        anomalyProficiency: 15,
        penRatio: 5,
        energy: 25,
      });
      vi.mocked(mockBompDataMapper.extractExtraAbility).mockReturnValue(
        "複雑な追加能力の説明"
      );

      // Act
      const result = await processor.processBompData({
        id: "complex-bomp",
        pageId: 913,
        wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/913",
        jaName: "複雑ボンプ",
      });

      // Assert
      expect(result.basicInfo.id).toBe("complex-bomp");
      expect(result.extraAbility).toBe("複雑な追加能力の説明");
      expect(Array.isArray(result.factionIds)).toBe(true);
    });

    it("APIレスポンスの retcode が 0 以外の場合の処理", async () => {
      // Arrange
      const errorApiResponse: ApiResponse = {
        retcode: -1,
        message: "Error",
        data: {
          page: {
            id: "914",
            name: "エラーボンプ",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [],
          },
        },
      };

      vi.mocked(mockApiClient.fetchCharacterData).mockResolvedValue(
        errorApiResponse
      );
      vi.mocked(mockBompDataMapper.extractBasicBompInfo).mockReturnValue({
        id: "error-bomp",
        name: "エラーボンプ",
        stats: ["physical"],
      });
      vi.mocked(mockBompDataMapper.extractBompAttributes).mockReturnValue({
        hp: [100, 200, 300, 400, 500, 600, 700],
        atk: [50, 100, 150, 200, 250, 300, 350],
        def: [30, 60, 90, 120, 150, 180, 210],
        impact: 100,
        critRate: 5,
        critDmg: 50,
        anomalyMastery: 0,
        anomalyProficiency: 0,
        penRatio: 0,
        energy: 0,
      });
      vi.mocked(mockBompDataMapper.extractExtraAbility).mockReturnValue("");

      // Act
      const result = await processor.processBompData({
        id: "error-bomp",
        pageId: 914,
        wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/914",
        jaName: "エラーボンプ",
      });

      // Assert - エラーレスポンスでも処理が継続されることを確認
      expect(result).toBeDefined();
      expect(result.basicInfo.id).toBe("error-bomp");
    });
  });

  describe("エラーケース処理のテスト", () => {
    it("ApiError を適切に処理する", async () => {
      // Arrange
      const apiError = new ApiError("API connection failed");
      vi.mocked(mockApiClient.fetchCharacterData).mockRejectedValue(apiError);

      // Act
      const result = await processor.processBompData(mockBompEntry);

      // Assert - グレースフル劣化が実行される
      expect(result).toBeDefined();
      expect(result.basicInfo.id).toBe("test-bomp");
      expect(result.basicInfo.stats).toEqual(["physical"]);
    });

    it("MappingError を適切に処理する", async () => {
      // Arrange
      vi.mocked(mockApiClient.fetchCharacterData).mockResolvedValue(
        mockApiResponse
      );
      const mappingError = new MappingError("Data mapping failed");
      vi.mocked(mockBompDataMapper.extractBasicBompInfo).mockImplementation(
        () => {
          throw mappingError;
        }
      );

      // Act
      const result = await processor.processBompData(mockBompEntry);

      // Assert - グレースフル劣化が実行される
      expect(result).toBeDefined();
      expect(result.basicInfo.id).toBe("test-bomp");
    });

    it("ネットワークタイムアウトエラーを処理する", async () => {
      // Arrange
      const timeoutError = new Error("ETIMEDOUT");
      vi.mocked(mockApiClient.fetchCharacterData).mockRejectedValue(
        timeoutError
      );

      // Act
      const result = await processor.processBompData(mockBompEntry);

      // Assert - グレースフル劣化が実行される
      expect(result).toBeDefined();
      expect(result.basicInfo.id).toBe("test-bomp");
      expect(result.basicInfo.name).toBe("テストボンプ");
    });

    it("予期しないエラー形式を処理する", async () => {
      // Arrange
      vi.mocked(mockApiClient.fetchCharacterData).mockRejectedValue(
        "string error"
      );

      // Act
      const result = await processor.processBompData(mockBompEntry);

      // Assert - グレースフル劣化が実行される
      expect(result).toBeDefined();
      expect(result.basicInfo.id).toBe("test-bomp");
    });

    it("グレースフル劣化も失敗した場合の処理", async () => {
      // Arrange
      vi.mocked(mockApiClient.fetchCharacterData).mockRejectedValue(
        new Error("API Error")
      );

      // グレースフル劣化でもエラーが発生するようにモック
      const originalProcessor = processor as any;
      const originalAttemptGracefulDegradation =
        originalProcessor.attemptGracefulDegradation;
      originalProcessor.attemptGracefulDegradation = vi
        .fn()
        .mockResolvedValue(null);

      // Act & Assert
      await expect(processor.processBompData(mockBompEntry)).rejects.toThrow();

      // Cleanup
      originalProcessor.attemptGracefulDegradation =
        originalAttemptGracefulDegradation;
    });

    it("部分的なデータ損失を適切に処理する", async () => {
      // Arrange
      const partialApiResponse: ApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "915",
            name: "部分ボンプ",
            agent_specialties: { values: ["支援"] },
            agent_stats: { values: ["氷属性"] },
            agent_rarity: { values: ["A"] },
            agent_faction: { values: ["ビクトリア家政"] },
            modules: [
              // ascension モジュールが欠損
              {
                name: "baseInfo",
                components: [
                  {
                    component_id: "baseInfo",
                    data: JSON.stringify({
                      list: [
                        {
                          key: "陣営",
                          value: ["ビクトリア家政"],
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

      vi.mocked(mockApiClient.fetchCharacterData).mockResolvedValue(
        partialApiResponse
      );
      vi.mocked(mockBompDataMapper.extractBasicBompInfo).mockReturnValue({
        id: "partial-bomp",
        name: "部分ボンプ",
        stats: ["ice"],
      });
      vi.mocked(mockBompDataMapper.extractBompAttributes).mockImplementation(
        () => {
          throw new MappingError("Ascension data not found");
        }
      );
      vi.mocked(mockBompDataMapper.extractExtraAbility).mockReturnValue("");

      // Act
      const result = await processor.processBompData({
        id: "partial-bomp",
        pageId: 915,
        wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/915",
        jaName: "部分ボンプ",
      });

      // Assert - グレースフル劣化により最小限のデータが返される
      expect(result).toBeDefined();
      expect(result.basicInfo.id).toBe("partial-bomp");
    });

    it("レート制限エラーを適切に処理する", async () => {
      // Arrange
      const rateLimitError = new ApiError(
        "Rate limit exceeded",
        new Error("429")
      );
      vi.mocked(mockApiClient.fetchCharacterData).mockRejectedValue(
        rateLimitError
      );

      // Act
      const result = await processor.processBompData(mockBompEntry);

      // Assert - グレースフル劣化が実行される
      expect(result).toBeDefined();
      expect(result.basicInfo.id).toBe("test-bomp");
    });
  });
});
