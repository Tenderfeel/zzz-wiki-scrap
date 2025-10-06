import { describe, it, expect, vi, beforeEach } from "vitest";
import { EnhancedDataProcessor } from "../../src/processors/EnhancedDataProcessor";
import { CharacterEntry, Character } from "../../src/types";
import { ApiResponse } from "../../src/types/api";
import {
  ValidationError,
  AllCharactersError,
  ProcessingStage,
  MappingError,
} from "../../src/errors";

// モックデータ
const mockCharacterEntry: CharacterEntry = {
  id: "lycaon",
  pageId: 28,
  wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/28",
};

const mockJaApiResponse: ApiResponse = {
  retcode: 0,
  message: "success",
  data: {
    page: {
      id: "28",
      name: "フォン・ライカン",
      agent_specialties: { values: ["撃破"] },
      agent_stats: { values: ["氷属性"] },
      agent_rarity: { values: ["S"] },
      agent_faction: { values: ["ヴィクトリア家政"] },
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
                  {
                    key: "10",
                    combatList: [
                      { key: "HP", values: ["1800", "1967"] },
                      { key: "攻撃力", values: ["180", "197"] },
                      { key: "防御力", values: ["128", "141"] },
                    ],
                  },
                  {
                    key: "20",
                    combatList: [
                      { key: "HP", values: ["3050", "3350"] },
                      { key: "攻撃力", values: ["270", "296"] },
                      { key: "防御力", values: ["219", "241"] },
                    ],
                  },
                  {
                    key: "30",
                    combatList: [
                      { key: "HP", values: ["4300", "4732"] },
                      { key: "攻撃力", values: ["359", "394"] },
                      { key: "防御力", values: ["309", "340"] },
                    ],
                  },
                  {
                    key: "40",
                    combatList: [
                      { key: "HP", values: ["5550", "6114"] },
                      { key: "攻撃力", values: ["449", "494"] },
                      { key: "防御力", values: ["400", "441"] },
                    ],
                  },
                  {
                    key: "50",
                    combatList: [
                      { key: "HP", values: ["6800", "7498"] },
                      { key: "攻撃力", values: ["538", "592"] },
                      { key: "防御力", values: ["491", "540"] },
                    ],
                  },
                  {
                    key: "60",
                    combatList: [
                      { key: "HP", values: ["7650", "8416"] },
                      { key: "攻撃力", values: ["594", "653"] },
                      { key: "防御力", values: ["550", "606"] },
                    ],
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

const mockEnApiResponse: ApiResponse = {
  retcode: 0,
  message: "success",
  data: {
    page: {
      id: "28",
      name: "Von Lycaon",
      agent_specialties: { values: ["Stun"] },
      agent_stats: { values: ["Ice"] },
      agent_rarity: { values: ["S"] },
      agent_faction: { values: ["Victoria Housekeeping Co."] },
      modules: [],
    },
  },
};

// filter_valuesを追加
(mockJaApiResponse.data.page as any).filter_values = {
  agent_specialties: { values: ["撃破"] },
  agent_stats: { values: ["氷属性"] },
  agent_rarity: { values: ["S"] },
  agent_faction: { values: ["ヴィクトリア家政"] },
};

(mockEnApiResponse.data.page as any).filter_values = {
  agent_specialties: { values: ["Stun"] },
  agent_stats: { values: ["Ice"] },
  agent_rarity: { values: ["S"] },
  agent_faction: { values: ["Victoria Housekeeping Co."] },
};

describe("EnhancedDataProcessor", () => {
  let processor: EnhancedDataProcessor;

  beforeEach(() => {
    processor = new EnhancedDataProcessor();
  });

  describe("processEnhancedCharacterData", () => {
    it("正常なAPIレスポンスからCharacterオブジェクトを生成する", async () => {
      // Act
      const result = await processor.processEnhancedCharacterData(
        mockJaApiResponse,
        mockEnApiResponse,
        mockCharacterEntry
      );

      // Assert
      expect(result).toMatchObject({
        id: "lycaon",
        name: {
          ja: "ライカン", // mapped name from name-mappings.json
          en: "Lycaon",
        },
        fullName: {
          ja: "フォン・ライカン", // API name
          en: "Von Lycaon",
        },
        specialty: "stun",
        stats: "ice",
        faction: 2, // ヴィクトリア家政のID
        rarity: "S",
      });

      expect(result.attr).toHaveProperty("hp");
      expect(result.attr).toHaveProperty("atk");
      expect(result.attr).toHaveProperty("def");
      expect(result.attr).toHaveProperty("impact");
      expect(result.attr).toHaveProperty("critRate");
      expect(result.attr).toHaveProperty("critDmg");
      expect(result.attr).toHaveProperty("anomalyMastery");
      expect(result.attr).toHaveProperty("anomalyProficiency");
      expect(result.attr).toHaveProperty("penRatio");
      expect(result.attr).toHaveProperty("energy");

      // 配列の長さを確認
      expect(result.attr.hp).toHaveLength(7);
      expect(result.attr.atk).toHaveLength(7);
      expect(result.attr.def).toHaveLength(7);
    });

    it("無効なAPIレスポンスでエラーを投げる", async () => {
      // Arrange
      const invalidApiResponse = {
        ...mockJaApiResponse,
        data: {
          page: {
            ...mockJaApiResponse.data.page,
            modules: [], // ascensionコンポーネントがない
          },
        },
      };

      // Act & Assert
      await expect(
        processor.processEnhancedCharacterData(
          invalidApiResponse,
          mockEnApiResponse,
          mockCharacterEntry
        )
      ).rejects.toThrow(AllCharactersError);
    });

    it("データ処理エラーでAllCharactersErrorを投げる", async () => {
      // Arrange
      const invalidApiResponse = {
        ...mockJaApiResponse,
        data: {
          page: {
            ...mockJaApiResponse.data.page,
            filter_values: null, // 無効なfilter_values
          },
        },
      };

      // Act & Assert
      await expect(
        processor.processEnhancedCharacterData(
          invalidApiResponse,
          mockEnApiResponse,
          mockCharacterEntry
        )
      ).rejects.toThrow(AllCharactersError);

      try {
        await processor.processEnhancedCharacterData(
          invalidApiResponse,
          mockEnApiResponse,
          mockCharacterEntry
        );
      } catch (error) {
        expect(error).toBeInstanceOf(AllCharactersError);
        expect((error as AllCharactersError).stage).toBe(
          ProcessingStage.DATA_PROCESSING
        );
        expect((error as AllCharactersError).characterId).toBe("lycaon");
      }
    });
  });

  describe("resolveFactionFromData", () => {
    it("APIレスポンスから陣営IDを解決する", async () => {
      // Act
      const factionId = await processor.resolveFactionFromData(
        mockJaApiResponse
      );

      // Assert
      expect(factionId).toBe(2); // ヴィクトリア家政のID
    });

    it("無効な陣営名でエラーを投げる", async () => {
      // Arrange
      const invalidApiResponse = {
        ...mockJaApiResponse,
        data: {
          page: {
            ...mockJaApiResponse.data.page,
            filter_values: {
              agent_faction: { values: ["存在しない陣営"] },
            },
          },
        },
      };

      // Act & Assert
      try {
        await processor.resolveFactionFromData(invalidApiResponse);
        expect.fail("エラーが投げられませんでした");
      } catch (error) {
        expect(error).toBeInstanceOf(MappingError);
        expect((error as Error).message).toContain("未知の陣営名");
        expect((error as Error).message).toContain("存在しない陣営");
      }
    });
  });

  describe("validateProcessedData", () => {
    const validCharacter: Character = {
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

    it("有効なキャラクターデータで検証が成功する", () => {
      // Act
      const result = processor.validateProcessedData(validCharacter);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("IDが空の場合にエラーを返す", () => {
      // Arrange
      const invalidCharacter = { ...validCharacter, id: "" };

      // Act
      const result = processor.validateProcessedData(invalidCharacter);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("IDが空です");
    });

    it("日本語名が空の場合にエラーを返す", () => {
      // Arrange
      const invalidCharacter = {
        ...validCharacter,
        name: { ja: "", en: "Test Character" },
      };

      // Act
      const result = processor.validateProcessedData(invalidCharacter);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("日本語名が空です");
    });

    it("無効な特性でエラーを返す", () => {
      // Arrange
      const invalidCharacter = {
        ...validCharacter,
        specialty: "invalid" as any,
      };

      // Act
      const result = processor.validateProcessedData(invalidCharacter);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("無効な特性: invalid");
    });

    it("HP配列の長さが不正な場合にエラーを返す", () => {
      // Arrange
      const invalidCharacter = {
        ...validCharacter,
        attr: {
          ...validCharacter.attr,
          hp: [677, 1967, 3350], // 長さが3（正しくは7）
        },
      };

      // Act
      const result = processor.validateProcessedData(invalidCharacter);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("HP配列の長さが不正です: 3");
    });

    it("数値フィールドが非数値の場合にエラーを返す", () => {
      // Arrange
      const invalidCharacter = {
        ...validCharacter,
        attr: {
          ...validCharacter.attr,
          impact: "invalid" as any,
        },
      };

      // Act
      const result = processor.validateProcessedData(invalidCharacter);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("impactが数値ではありません: invalid");
    });

    it("配列内の非数値でエラーを返す", () => {
      // Arrange
      const invalidCharacter = {
        ...validCharacter,
        attr: {
          ...validCharacter.attr,
          hp: [677, "invalid" as any, 3350, 4732, 6114, 7498, 8416],
        },
      };

      // Act
      const result = processor.validateProcessedData(invalidCharacter);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("hp[1]が数値ではありません: invalid");
    });

    it("範囲外の会心率で警告を返す", () => {
      // Arrange
      const characterWithWarning = {
        ...validCharacter,
        attr: {
          ...validCharacter.attr,
          critRate: 150, // 100%を超える
        },
      };

      // Act
      const result = processor.validateProcessedData(characterWithWarning);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain("会心率が範囲外です: 150%");
    });

    it("負の値で警告を返す", () => {
      // Arrange
      const characterWithWarning = {
        ...validCharacter,
        attr: {
          ...validCharacter.attr,
          hp: [677, -100, 3350, 4732, 6114, 7498, 8416], // 負の値
        },
      };

      // Act
      const result = processor.validateProcessedData(characterWithWarning);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain("hp[1]が負の値です: -100");
    });
  });

  describe("列挙値マッピング", () => {
    it("特性の日本語名を正しくマッピングする", async () => {
      // 各特性をテスト
      const testCases = [
        { ja: "撃破", expected: "stun" },
        { ja: "強攻", expected: "attack" },
        { ja: "異常", expected: "anomaly" },
        { ja: "支援", expected: "support" },
        { ja: "防護", expected: "defense" },
        { ja: "命破", expected: "rupture" },
      ];

      for (const testCase of testCases) {
        const apiResponse = {
          ...mockJaApiResponse,
          data: {
            page: {
              ...mockJaApiResponse.data.page,
              filter_values: {
                ...(mockJaApiResponse.data.page as any).filter_values,
                agent_specialties: { values: [testCase.ja] },
              },
            },
          },
        };

        const result = await processor.processEnhancedCharacterData(
          apiResponse,
          mockEnApiResponse,
          mockCharacterEntry
        );

        expect(result.specialty).toBe(testCase.expected);
      }
    });

    it("属性の日本語名を正しくマッピングする", async () => {
      // 各属性をテスト
      const testCases = [
        { ja: "氷属性", expected: "ice" },
        { ja: "炎属性", expected: "fire" },
        { ja: "電気属性", expected: "electric" },
        { ja: "物理属性", expected: "physical" },
        { ja: "エーテル属性", expected: "ether" },
      ];

      for (const testCase of testCases) {
        const apiResponse = {
          ...mockJaApiResponse,
          data: {
            page: {
              ...mockJaApiResponse.data.page,
              filter_values: {
                ...(mockJaApiResponse.data.page as any).filter_values,
                agent_stats: { values: [testCase.ja] },
              },
            },
          },
        };

        const result = await processor.processEnhancedCharacterData(
          apiResponse,
          mockEnApiResponse,
          mockCharacterEntry
        );

        expect(result.stats).toBe(testCase.expected);
      }
    });

    it("未知の列挙値でエラーを投げる", async () => {
      // Arrange
      const invalidApiResponse = {
        ...mockJaApiResponse,
        data: {
          page: {
            ...mockJaApiResponse.data.page,
            filter_values: {
              ...(mockJaApiResponse.data.page as any).filter_values,
              agent_specialties: { values: ["未知の特性"] },
            },
          },
        },
      };

      // Act & Assert
      await expect(
        processor.processEnhancedCharacterData(
          invalidApiResponse,
          mockEnApiResponse,
          mockCharacterEntry
        )
      ).rejects.toThrow("未知の特性");
    });
  });
});
