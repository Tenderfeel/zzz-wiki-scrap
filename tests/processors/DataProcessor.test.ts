import { describe, it, expect, beforeEach, vi } from "vitest";
import { DataProcessor } from "../../src/processors/DataProcessor";
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

  beforeEach(() => {
    processor = new DataProcessor();
  });

  describe("extractBasicInfo", () => {
    const mockApiResponse: ApiResponse = {
      retcode: 0,
      message: "OK",
      data: {
        page: {
          id: "28",
          name: "フォン・ライカン",
          filter_values: {
            agent_specialties: { values: ["撃破"] },
            agent_stats: { values: ["氷属性"] },
            agent_attack_type: { values: ["打撃"] },
            agent_rarity: { values: ["S"] },
          },
          modules: [],
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
        attackType: "打撃",
        rarity: "S",
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

    it("必須フィールドが不足している場合はParsingErrorを投げる", () => {
      const incompleteResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "28",
            name: "フォン・ライカン",
            filter_values: {
              agent_specialties: { values: ["撃破"] },
              // 他のフィールドが不足
            },
            modules: [],
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
          filter_values: {
            agent_faction: { values: ["ヴィクトリア家政"] },
          },
          modules: [],
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
            filter_values: {},
            modules: [],
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
          modules: [
            {
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
            modules: [
              {
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
});
