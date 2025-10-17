import { describe, it, expect, beforeEach } from "vitest";
import { BompDataMapper } from "../../src/mappers/BompDataMapper";
import { ApiResponse } from "../../src/types/api";
import { MappingError } from "../../src/errors";

describe("BompDataMapper", () => {
  let mapper: BompDataMapper;

  beforeEach(() => {
    mapper = new BompDataMapper();
  });

  describe("extractBasicBompInfo", () => {
    it("should extract basic bomp info from API response", () => {
      const mockApiResponse: ApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "912",
            name: "セイケンボンプ",
            agent_specialties: { values: [] },
            agent_stats: { values: ["氷属性"] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [],
          },
        },
      };

      const result = mapper.extractBasicBompInfo(mockApiResponse, "excaliboo");

      expect(result).toEqual({
        id: "excaliboo",
        name: "セイケンボンプ",
        stats: ["ice"],
        releaseVersion: undefined,
      });
    });

    it("should throw MappingError for invalid API response", () => {
      const invalidResponse = {} as ApiResponse;

      expect(() => {
        mapper.extractBasicBompInfo(invalidResponse, "test");
      }).toThrow(MappingError);
    });
  });

  describe("createBompMultiLangName", () => {
    it("should create multi-language name object", () => {
      const result = mapper.createBompMultiLangName(
        "セイケンボンプ",
        "Excaliboo"
      );

      expect(result).toEqual({
        ja: "セイケンボンプ",
        en: "Excaliboo",
      });
    });

    it("should use Japanese name as fallback for English", () => {
      const result = mapper.createBompMultiLangName("セイケンボンプ");

      expect(result).toEqual({
        ja: "セイケンボンプ",
        en: "セイケンボンプ",
      });
    });

    it("should throw MappingError for empty Japanese name", () => {
      expect(() => {
        mapper.createBompMultiLangName("");
      }).toThrow(MappingError);
    });
  });

  describe("extractBompAttributes", () => {
    it("should extract attributes from ascension module", () => {
      const mockModules = [
        {
          name: "ascension",
          components: [
            {
              component_id: "ascension",
              data: JSON.stringify({
                list: [
                  {
                    key: "1",
                    combatList: [
                      { key: "HP", values: ["100", "120"] },
                      { key: "攻撃力", values: ["50", "60"] },
                      { key: "防御力", values: ["30", "36"] },
                      { key: "衝撃力", values: ["10", "12"] },
                      { key: "会心率", values: ["5%", "6%"] },
                      { key: "会心ダメージ", values: ["50%", "60%"] },
                      { key: "異常マスタリー", values: ["0", "0"] },
                      { key: "異常掌握", values: ["0", "0"] },
                      { key: "貫通率", values: ["0%", "0%"] },
                      { key: "エネルギー自動回復", values: ["1.0", "1.2"] },
                    ],
                  },
                  // Add other levels with similar structure
                  ...Array.from({ length: 6 }, (_, i) => ({
                    key: String([10, 20, 30, 40, 50, 60][i]),
                    combatList: [
                      { key: "HP", values: ["100", String(120 + i * 10)] },
                      { key: "攻撃力", values: ["50", String(60 + i * 5)] },
                      { key: "防御力", values: ["30", String(36 + i * 3)] },
                    ],
                  })),
                ],
              }),
            },
          ],
        },
      ];

      const result = mapper.extractBompAttributes(mockModules);

      expect(result.hp).toHaveLength(7);
      expect(result.atk).toHaveLength(7);
      expect(result.def).toHaveLength(7);
      expect(result.impact).toBe(12);
      expect(result.critRate).toBe(6);
      expect(result.critDmg).toBe(60);
    });

    it("should throw MappingError when ascension module is missing", () => {
      const mockModules = [
        {
          name: "other",
          components: [],
        },
      ];

      expect(() => {
        mapper.extractBompAttributes(mockModules);
      }).toThrow(MappingError);
    });
  });

  describe("extractExtraAbility", () => {
    it("should extract extra ability from talent module", () => {
      const mockModules = [
        {
          name: "talent",
          components: [
            {
              component_id: "talent",
              data: JSON.stringify({
                list: [
                  {
                    children: [
                      {
                        desc: "<p>特殊能力の説明文</p>",
                      },
                    ],
                  },
                ],
              }),
            },
          ],
        },
      ];

      const result = mapper.extractExtraAbility(mockModules);

      expect(result).toBe("特殊能力の説明文");
    });

    it("should return empty string when talent module is missing", () => {
      const mockModules = [
        {
          name: "other",
          components: [],
        },
      ];

      const result = mapper.extractExtraAbility(mockModules);

      expect(result).toBe("");
    });

    it("should clean HTML tags from ability text", () => {
      const mockModules = [
        {
          name: "skill",
          components: [
            {
              component_id: "skill",
              data: JSON.stringify({
                list: [
                  {
                    desc: "<strong>強力な</strong>攻撃を<em>実行</em>する",
                  },
                ],
              }),
            },
          ],
        },
      ];

      const result = mapper.extractExtraAbility(mockModules);

      expect(result).toBe("強力な攻撃を実行する");
    });
  });
});
