import { describe, it, expect, beforeEach, vi } from "vitest";
import { DataProcessor } from "../../src/processors/DataProcessor";
import { AssistTypeStatistics } from "../../src/utils/AssistTypeStatistics";
import { ParsingError, MappingError } from "../../src/errors";
import { ApiResponse } from "../../src/types/api";

// data/factionsをモック
vi.mock("../../../data/factions", () => ({
  default: [
    { id: 1, name: { ja: "邪兎屋", en: "Cunning Hares" } },
    {
      id: 2,
      name: { ja: "ヴィクトリア家政", en: "Victoria Housekeeping Co." },
    },
    {
      id: 3,
      name: { ja: "白祇重工", en: "Belobog Heavy Industries" },
    },
  ],
}));

describe("DataProcessor", () => {
  let processor: DataProcessor;
  let statistics: AssistTypeStatistics;

  beforeEach(() => {
    statistics = new AssistTypeStatistics();
    processor = new DataProcessor(undefined, statistics);
  });

  describe("extractBasicInfo", () => {
    const mockApiResponse: ApiResponse = {
      retcode: 0,
      message: "OK",
      data: {
        page: {
          id: "28",
          name: "フォン・ライカン",
          agent_specialties: { values: [] },
          agent_stats: { values: [] },
          agent_rarity: { values: [] },
          agent_faction: { values: [] },
          modules: [],
          filter_values: {
            agent_specialties: { values: ["撃破"] },
            agent_stats: { values: ["氷属性"] },
            agent_rarity: { values: ["S"] },
            agent_faction: { values: ["ヴィクトリア家政"] },
          },
        },
      },
    };

    it("基本キャラクター情報を正常に抽出できる", () => {
      const result = processor.extractBasicInfo(mockApiResponse);

      expect(result).toEqual({
        id: "28",
        name: "フォン・ライカン",
        specialty: "撃破",
        stats: "氷属性",
        rarity: "S",
        releaseVersion: 0,
      });
    });

    it("pageデータが存在しない場合はParsingErrorを投げる", () => {
      const invalidResponse = {
        retcode: 0,
        message: "OK",
        data: {},
      } as any;

      expect(() => processor.extractBasicInfo(invalidResponse)).toThrow(
        ParsingError
      );
      expect(() => processor.extractBasicInfo(invalidResponse)).toThrow(
        "APIレスポンスにpageデータが存在しません"
      );
    });

    it("filter_valuesが存在しない場合はParsingErrorを投げる", () => {
      const invalidResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "28",
            name: "フォン・ライカン",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [],
          },
        },
      } as any;

      expect(() => processor.extractBasicInfo(invalidResponse)).toThrow(
        ParsingError
      );
      expect(() => processor.extractBasicInfo(invalidResponse)).toThrow(
        "APIレスポンスにfilter_valuesが存在しません"
      );
    });

    it("属性データが不足している場合はParsingErrorを投げる", () => {
      const incompleteResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "28",
            name: "フォン・ライカン",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [],
            filter_values: {
              agent_specialties: { values: ["撃破"] },
              agent_faction: { values: ["ヴィクトリア家政"] },
              // agent_statsとagent_rarityが不足
            },
          },
        },
      } as any;

      expect(() => processor.extractBasicInfo(incompleteResponse)).toThrow(
        ParsingError
      );
      expect(() => processor.extractBasicInfo(incompleteResponse)).toThrow(
        "属性データ(agent_stats)が見つかりません"
      );
    });
  });

  describe("extractFactionInfo", () => {
    const mockApiResponse: ApiResponse = {
      retcode: 0,
      message: "OK",
      data: {
        page: {
          id: "28",
          name: "フォン・ライカン",
          agent_specialties: { values: [] },
          agent_stats: { values: [] },
          agent_rarity: { values: [] },
          agent_faction: { values: [] },
          modules: [],
          filter_values: {
            agent_faction: { values: ["ヴィクトリア家政"] },
          },
        },
      },
    };

    it("陣営情報を正常に抽出できる", () => {
      const result = processor.extractFactionInfo(mockApiResponse);

      expect(result).toEqual({
        id: 2, // ヴィクトリア家政のID
        name: "ヴィクトリア家政",
      });
    });

    it("陣営情報が存在しない場合はParsingErrorを投げる", () => {
      const invalidResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "28",
            name: "フォン・ライカン",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [],
            filter_values: {
              agent_specialties: { values: ["撃破"] },
              agent_stats: { values: ["氷属性"] },
              agent_rarity: { values: ["S"] },
              // agent_factionが不足
            },
          },
        },
      } as any;

      expect(() => processor.extractFactionInfo(invalidResponse)).toThrow(
        ParsingError
      );
      expect(() => processor.extractFactionInfo(invalidResponse)).toThrow(
        "陣営情報(agent_faction)が見つかりません"
      );
    });
  });

  describe("extractAttributes", () => {
    const mockApiResponse: ApiResponse = {
      retcode: 0,
      message: "OK",
      data: {
        page: {
          id: "28",
          name: "フォン・ライカン",
          agent_specialties: { values: [] },
          agent_stats: { values: [] },
          agent_rarity: { values: [] },
          agent_faction: { values: [] },
          modules: [
            {
              name: "ステータス",
              components: [
                {
                  component_id: "ascension",
                  data: '{"list":[{"key":"1","combatList":[]}]}',
                },
              ],
            },
          ],
        },
      },
    };

    it("属性データを正常に抽出できる", () => {
      const result = processor.extractAttributes(mockApiResponse);

      expect(result).toEqual({
        ascensionData: '{"list":[{"key":"1","combatList":[]}]}',
      });
    });

    it("modulesが存在しない場合はParsingErrorを投げる", () => {
      const invalidResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "28",
            name: "フォン・ライカン",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
          },
        },
      } as any;

      expect(() => processor.extractAttributes(invalidResponse)).toThrow(
        ParsingError
      );
      expect(() => processor.extractAttributes(invalidResponse)).toThrow(
        "APIレスポンスにmodulesが存在しないか、配列ではありません"
      );
    });

    it("ascensionコンポーネントが見つからない場合はParsingErrorを投げる", () => {
      const invalidResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "28",
            name: "フォン・ライカン",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [
              {
                name: "その他",
                components: [
                  {
                    component_id: "other",
                    data: "some data",
                  },
                ],
              },
            ],
          },
        },
      } as any;

      expect(() => processor.extractAttributes(invalidResponse)).toThrow(
        ParsingError
      );
      expect(() => processor.extractAttributes(invalidResponse)).toThrow(
        "ascensionコンポーネントが見つかりません"
      );
    });
  });

  describe("extractAssistType", () => {
    it("支援タイプ情報を正常に抽出できる（パリィ支援）", () => {
      const mockApiResponse: ApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "28",
            name: "フォン・ライカン",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [
              {
                name: "エージェントスキル",
                components: [
                  {
                    component_id: "agent_talent",
                    data: '{"list":[{"title":"支援スキル","children":[{"title":"パリィ支援：狩りへの介入","desc":"パリィ支援スキル"}],"attributes":[{"key":"パリィ支援：狩りへの介入","values":[""]}]}]}',
                  },
                ],
              },
            ],
          },
        },
      };

      const result = processor.extractAssistType(mockApiResponse);
      expect(result).toBe("defensive");
    });

    it("支援タイプ情報を正常に抽出できる（回避支援）", () => {
      const mockApiResponse: ApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "29",
            name: "テストキャラクター",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [
              {
                name: "エージェントスキル",
                components: [
                  {
                    component_id: "agent_talent",
                    data: '{"list":[{"title":"支援スキル","children":[{"title":"回避支援：ダッジステップ","desc":"回避支援スキル"}],"attributes":[{"key":"回避支援：ダッジステップ","values":[""]}]}]}',
                  },
                ],
              },
            ],
          },
        },
      };

      const result = processor.extractAssistType(mockApiResponse);
      expect(result).toBe("evasive");
    });

    it("支援タイプ情報が存在しない場合はundefinedを返す", () => {
      const mockApiResponse: ApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "30",
            name: "テストキャラクター",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [
              {
                name: "エージェントスキル",
                components: [
                  {
                    component_id: "agent_talent",
                    data: '{"list":[{"title":"通常攻撃"},{"title":"回避"}]}',
                  },
                ],
              },
            ],
          },
        },
      };

      const result = processor.extractAssistType(mockApiResponse);
      expect(result).toBeUndefined();
    });

    it("pageデータが存在しない場合はundefinedを返す", () => {
      const invalidResponse = {
        retcode: 0,
        message: "OK",
        data: {},
      } as any;

      const result = processor.extractAssistType(invalidResponse);
      expect(result).toBeUndefined();
    });

    it("modulesが存在しない場合はundefinedを返す", () => {
      const invalidResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "31",
            name: "テストキャラクター",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
          },
        },
      } as any;

      const result = processor.extractAssistType(invalidResponse);
      expect(result).toBeUndefined();
    });

    it("無効な支援タイプ値の場合はundefinedを返す", () => {
      const mockApiResponse: ApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "32",
            name: "テストキャラクター",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [
              {
                name: "エージェントスキル",
                components: [
                  {
                    component_id: "agent_talent",
                    data: '{"list":[{"title":"支援スキル","children":[{"title":"無効な支援：テスト","desc":"無効な支援スキル"}]}]}',
                  },
                ],
              },
            ],
          },
        },
      };

      const result = processor.extractAssistType(mockApiResponse);
      expect(result).toBeUndefined();
    });

    it("空文字列の支援タイプ値の場合はundefinedを返す", () => {
      const mockApiResponse: ApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "33",
            name: "テストキャラクター",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [
              {
                name: "エージェントスキル",
                components: [
                  {
                    component_id: "agent_talent",
                    data: '{"list":[{"title":"支援スキル","children":[{"title":"","desc":""}]}]}',
                  },
                ],
              },
            ],
          },
        },
      };

      const result = processor.extractAssistType(mockApiResponse);
      expect(result).toBeUndefined();
    });

    it("支援スキルが存在しない場合はundefinedを返す", () => {
      const mockApiResponse: ApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "34",
            name: "テストキャラクター",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [
              {
                name: "エージェントスキル",
                components: [
                  {
                    component_id: "agent_talent",
                    data: '{"list":[{"title":"通常攻撃"},{"title":"回避"}]}',
                  },
                ],
              },
            ],
          },
        },
      };

      const result = processor.extractAssistType(mockApiResponse);
      expect(result).toBeUndefined();
    });

    it("英語の支援タイプ値も正常に処理できる（Defensive Assist）", () => {
      const mockApiResponse: ApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "35",
            name: "Test Character",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [
              {
                name: "Agent Skills",
                components: [
                  {
                    component_id: "agent_talent",
                    data: '{"list":[{"title":"Support Skills","children":[{"title":"Defensive Assist: Shield","desc":"Defensive assist skill"}],"attributes":[{"key":"Defensive Assist: Shield","values":[""]}]}]}',
                  },
                ],
              },
            ],
          },
        },
      };

      const result = processor.extractAssistType(mockApiResponse);
      expect(result).toBe("defensive");
    });

    it("英語の支援タイプ値も正常に処理できる（Evasive Assist）", () => {
      const mockApiResponse: ApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "36",
            name: "Test Character",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [
              {
                name: "Agent Skills",
                components: [
                  {
                    component_id: "agent_talent",
                    data: '{"list":[{"title":"Support Skills","children":[{"title":"Evasive Assist: Dodge","desc":"Evasive assist skill"}],"attributes":[{"key":"Evasive Assist: Dodge","values":[""]}]}]}',
                  },
                ],
              },
            ],
          },
        },
      };

      const result = processor.extractAssistType(mockApiResponse);
      expect(result).toBe("evasive");
    });

    it("JSONパースエラーが発生した場合はundefinedを返す", () => {
      const mockApiResponse: ApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "37",
            name: "エラーテストキャラクター",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [
              {
                name: "エージェントスキル",
                components: [
                  {
                    component_id: "agent_talent",
                    data: '{"invalid json"',
                  },
                ],
              },
            ],
          },
        },
      };

      const result = processor.extractAssistType(mockApiResponse);
      expect(result).toBeUndefined();
    });

    it("ネットワークエラーのシミュレーション - 不正なAPIレスポンス構造", () => {
      const corruptedResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: null, // 破損したデータ
        },
      } as any;

      const result = processor.extractAssistType(corruptedResponse);
      expect(result).toBeUndefined();
    });

    it("部分的なAPIレスポンス - エージェントスキルモジュールが欠損", () => {
      const partialResponse: ApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "38",
            name: "部分データキャラクター",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [
              {
                name: "ステータス",
                components: [
                  {
                    component_id: "baseInfo",
                    data: "{}",
                  },
                ],
              },
            ],
          },
        },
      };

      const result = processor.extractAssistType(partialResponse);
      expect(result).toBeUndefined();
    });
  });

  describe("processCharacterData", () => {
    const mockApiResponse: ApiResponse = {
      retcode: 0,
      message: "OK",
      data: {
        page: {
          id: "28",
          name: "フォン・ライカン",
          agent_specialties: { values: [] },
          agent_stats: { values: [] },
          agent_rarity: { values: [] },
          agent_faction: { values: [] },
          modules: [
            {
              name: "ステータス",
              components: [
                {
                  component_id: "ascension",
                  data: '{"list":[{"key":"1","combatList":[]}]}',
                },
              ],
            },
            {
              name: "エージェントスキル",
              components: [
                {
                  component_id: "agent_talent",
                  data: '{"list":[{"title":"支援スキル","children":[{"title":"パリィ支援：狩りへの介入","desc":"パリィ支援スキル"}]}]}',
                },
              ],
            },
          ],
          filter_values: {
            agent_specialties: { values: ["撃破"] },
            agent_stats: { values: ["氷属性"] },
            agent_rarity: { values: ["S"] },
            agent_faction: { values: ["ヴィクトリア家政"] },
          },
        },
      },
    };

    it("支援タイプを含む完全なキャラクターデータを処理できる", () => {
      const result = processor.processCharacterData(mockApiResponse);

      expect(result.basicInfo).toEqual({
        id: "28",
        name: "フォン・ライカン",
        specialty: "撃破",
        stats: "氷属性",
        rarity: "S",
        releaseVersion: 0,
      });
      expect(result.factionInfo).toEqual({
        id: 2,
        name: "ヴィクトリア家政",
      });
      expect(result.attributesInfo).toEqual({
        ascensionData: '{"list":[{"key":"1","combatList":[]}]}',
      });
      expect(result.assistType).toBe("defensive");
    });

    it("支援タイプ情報がない場合でも正常に処理できる", () => {
      const responseWithoutAssistType: ApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "29",
            name: "テストキャラクター",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [
              {
                name: "ステータス",
                components: [
                  {
                    component_id: "ascension",
                    data: '{"list":[{"key":"1","combatList":[]}]}',
                  },
                ],
              },
              {
                name: "エージェントスキル",
                components: [
                  {
                    component_id: "agent_talent",
                    data: '{"list":[{"title":"通常攻撃"},{"title":"回避"}]}',
                  },
                ],
              },
            ],
            filter_values: {
              agent_specialties: { values: ["撃破"] },
              agent_stats: { values: ["氷属性"] },
              agent_rarity: { values: ["S"] },
              agent_faction: { values: ["ヴィクトリア家政"] },
            },
          },
        },
      };

      const result = processor.processCharacterData(responseWithoutAssistType);

      expect(result.basicInfo).toBeDefined();
      expect(result.factionInfo).toBeDefined();
      expect(result.attributesInfo).toBeDefined();
      expect(result.assistType).toBeUndefined();
    });

    it("基本情報の抽出でエラーが発生した場合は例外を再スローする", () => {
      const invalidResponse = {
        retcode: 0,
        message: "OK",
        data: {},
      } as any;

      expect(() => processor.processCharacterData(invalidResponse)).toThrow(
        ParsingError
      );
    });
  });

  describe("resolveFactionId", () => {
    it("既知の陣営名からIDを解決できる", () => {
      expect(processor.resolveFactionId("ヴィクトリア家政")).toBe(2);
      expect(processor.resolveFactionId("邪兎屋")).toBe(1);
      expect(processor.resolveFactionId("白祇重工")).toBe(3);
    });

    it("未知の陣営名の場合はMappingErrorを投げる", () => {
      expect(() => processor.resolveFactionId("未知の陣営")).toThrow(
        MappingError
      );
      expect(() => processor.resolveFactionId("未知の陣営")).toThrow(
        '未知の陣営名: "未知の陣営"'
      );
    });
  });

  describe("支援タイプ統計機能", () => {
    it("支援タイプ統計情報を取得できる", () => {
      const stats = processor.getAssistTypeStatistics();
      expect(stats).toBe(statistics);
    });

    it("processCharacterDataで統計情報が記録される", () => {
      const mockApiResponse: ApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "28",
            name: "フォン・ライカン",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [
              {
                name: "ステータス",
                components: [
                  {
                    component_id: "ascension",
                    data: '{"list":[{"key":"1","combatList":[]}]}',
                  },
                ],
              },
              {
                name: "エージェントスキル",
                components: [
                  {
                    component_id: "agent_talent",
                    data: '{"list":[{"title":"支援スキル","children":[{"title":"パリィ支援：狩りへの介入","desc":"パリィ支援スキル"}]}]}',
                  },
                ],
              },
            ],
            filter_values: {
              agent_specialties: { values: ["撃破"] },
              agent_stats: { values: ["氷属性"] },
              agent_rarity: { values: ["S"] },
              agent_faction: { values: ["ヴィクトリア家政"] },
            },
          },
        },
      };

      processor.processCharacterData(mockApiResponse);

      const stats = statistics.getStatistics();
      expect(stats.total).toBe(1);
      expect(stats.defensive).toBe(1);
      expect(stats.evasive).toBe(0);
      expect(stats.unknown).toBe(0);
      expect(stats.errors).toBe(0);
    });

    it("支援タイプ不明キャラクターの統計が記録される", () => {
      const mockApiResponse: ApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "29",
            name: "テストキャラクター",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [
              {
                name: "ステータス",
                components: [
                  {
                    component_id: "ascension",
                    data: '{"list":[{"key":"1","combatList":[]}]}',
                  },
                ],
              },
            ],
            filter_values: {
              agent_specialties: { values: ["撃破"] },
              agent_stats: { values: ["氷属性"] },
              agent_rarity: { values: ["S"] },
              agent_faction: { values: ["ヴィクトリア家政"] },
            },
          },
        },
      };

      processor.processCharacterData(mockApiResponse);

      const stats = statistics.getStatistics();
      expect(stats.total).toBe(1);
      expect(stats.unknown).toBe(1);
      expect(stats.defensive).toBe(0);
      expect(stats.evasive).toBe(0);
      expect(stats.errors).toBe(0);
    });

    it("JSONパースエラー時にエラー統計が記録される", () => {
      const mockApiResponse: ApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "30",
            name: "エラーテストキャラクター",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [
              {
                name: "ステータス",
                components: [
                  {
                    component_id: "ascension",
                    data: '{"list":[{"key":"1","combatList":[]}]}',
                  },
                ],
              },
              {
                name: "エージェントスキル",
                components: [
                  {
                    component_id: "agent_talent",
                    data: '{"invalid json"',
                  },
                ],
              },
            ],
            filter_values: {
              agent_specialties: { values: ["撃破"] },
              agent_stats: { values: ["氷属性"] },
              agent_rarity: { values: ["S"] },
              agent_faction: { values: ["ヴィクトリア家政"] },
            },
          },
        },
      };

      processor.processCharacterData(mockApiResponse);

      const stats = statistics.getStatistics();
      expect(stats.total).toBe(1);
      expect(stats.unknown).toBe(1);
      expect(stats.errors).toBe(1);

      const details = statistics.getDetails();
      expect(details.errors).toHaveLength(1);
      expect(details.errors[0].characterId).toBe("30");
      expect(details.errors[0].error).toContain("JSONパースエラー");
    });

    it("統計情報をリセットできる", () => {
      // データを追加
      const mockApiResponse: ApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "31",
            name: "テストキャラクター",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [
              {
                name: "ステータス",
                components: [
                  {
                    component_id: "ascension",
                    data: '{"list":[{"key":"1","combatList":[]}]}',
                  },
                ],
              },
            ],
            filter_values: {
              agent_specialties: { values: ["撃破"] },
              agent_stats: { values: ["氷属性"] },
              agent_rarity: { values: ["S"] },
              agent_faction: { values: ["ヴィクトリア家政"] },
            },
          },
        },
      };

      processor.processCharacterData(mockApiResponse);

      // リセット前の確認
      let stats = statistics.getStatistics();
      expect(stats.total).toBe(1);

      // リセット
      processor.resetStatistics();

      // リセット後の確認
      stats = statistics.getStatistics();
      expect(stats.total).toBe(0);
      expect(stats.evasive).toBe(0);
      expect(stats.defensive).toBe(0);
      expect(stats.unknown).toBe(0);
      expect(stats.errors).toBe(0);
    });

    it("統計情報をログに出力できる", () => {
      // テスト環境では実際のログ出力は抑制されるため、
      // logAssistTypeStatisticsメソッドが正常に実行されることのみを確認
      expect(() => processor.logAssistTypeStatistics()).not.toThrow();
    });
  });
});
