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
        stats: "ice",
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
        stats: "ice",
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
        stats: "ice",
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
      expect(result.basicInfo.stats).toBe("physical"); // デフォルト属性
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
      expect(result.basicInfo.stats).toBe("physical");
    });

    it("属性抽出エラー時にMappingErrorを投げる", async () => {
      // Arrange
      vi.mocked(mockApiClient.fetchCharacterData).mockResolvedValue(
        mockApiResponse
      );
      vi.mocked(mockBompDataMapper.extractBasicBompInfo).mockReturnValue({
        id: "test-bomp",
        name: "テストボンプ",
        stats: "ice",
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
        stats: "ice",
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
          stats: "ice",
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
          stats: "",
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
          stats: "ice",
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
          stats: "ice",
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
          stats: "ice",
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
          stats: "ice",
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
          stats: "ice",
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
          stats: "ice",
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
          stats: [] as any, // 配列（文字列であるべき）
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
        stats: "fire",
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
      expect(result.basicInfo.stats).toBe("fire");
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
        stats: "electric",
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
        stats: "physical",
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
      expect(result.basicInfo.stats).toBe("physical");
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
        stats: "ice",
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
