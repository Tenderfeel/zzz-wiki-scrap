import { describe, test, expect, beforeEach } from "vitest";
import { DriverDiscDataMapper } from "../../src/mappers/DriverDiscDataMapper";
import { ApiResponse } from "../../src/types/api";
import { MappingError } from "../../src/errors";

describe("DriverDiscDataMapperクラス", () => {
  let mapper: DriverDiscDataMapper;

  beforeEach(() => {
    mapper = new DriverDiscDataMapper();
  });

  describe("基本ドライバーディスク情報の抽出", () => {
    test("正常なAPIレスポンスから基本情報を抽出できること", () => {
      const mockApiResponse: ApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "123",
            name: "テストドライバーディスク",
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
                    data: JSON.stringify({
                      list: [
                        {
                          key: "実装バージョン",
                          value: ["Ver.1.0「新世界の序章」"],
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

      const result = mapper.extractBasicDriverDiscInfo(
        mockApiResponse,
        "test-disc"
      );

      expect(result.id).toBe(123);
      expect(result.name).toBe("テストドライバーディスク");
      expect(result.releaseVersion).toBe(1.0);
    });

    test("無効なAPIレスポンスでエラーが発生すること", () => {
      const invalidResponse = {} as ApiResponse;

      expect(() => {
        mapper.extractBasicDriverDiscInfo(invalidResponse, "test-disc");
      }).toThrow(MappingError);
    });

    test("IDが数値に変換できない場合にエラーが発生すること", () => {
      const mockApiResponse: ApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "invalid-id",
            name: "テストドライバーディスク",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [],
          },
        },
      };

      expect(() => {
        mapper.extractBasicDriverDiscInfo(mockApiResponse, "test-disc");
      }).toThrow(MappingError);
    });
  });

  describe("セット効果情報の抽出", () => {
    test("正常なAPIレスポンスからセット効果を抽出できること", () => {
      const mockApiResponse: ApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "123",
            name: "テストドライバーディスク",
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
                    data: JSON.stringify({
                      list: [
                        {
                          key: "4セット効果",
                          value: ["<p>攻撃力が15%アップする</p>"],
                        },
                        {
                          key: "2セット効果",
                          value: ["<p>HP が10%アップする</p>"],
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

      const result = mapper.extractSetEffects(mockApiResponse);

      expect(result.fourSetEffect).toBe("攻撃力が15%アップする");
      expect(result.twoSetEffect).toBe("HP が10%アップする");
    });

    test("モジュールデータが存在しない場合にエラーが発生すること", () => {
      const mockApiResponse: ApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "123",
            name: "テストドライバーディスク",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [],
          },
        },
      };

      expect(() => {
        mapper.extractSetEffects(mockApiResponse);
      }).toThrow(MappingError);
    });
  });

  describe("特性の抽出", () => {
    test("4セット効果テキストから撃破特性を抽出できること", () => {
      const fourSetEffect = "敵を撃破した時、チーム全体の攻撃力が上昇する";
      const result = mapper.extractSpecialty(fourSetEffect);
      expect(result).toBe("stun");
    });

    test("4セット効果テキストから強攻特性を抽出できること", () => {
      const fourSetEffect =
        "強攻ダメージが増加し、敵に与えるダメージが上昇する";
      const result = mapper.extractSpecialty(fourSetEffect);
      expect(result).toBe("attack");
    });

    test("4セット効果テキストから異常特性を抽出できること", () => {
      const fourSetEffect = "異常状態の敵に対してダメージが増加する";
      const result = mapper.extractSpecialty(fourSetEffect);
      expect(result).toBe("anomaly");
    });

    test("4セット効果テキストから支援特性を抽出できること", () => {
      const fourSetEffect =
        "支援スキル使用時にチーム全体のエネルギーが回復する";
      const result = mapper.extractSpecialty(fourSetEffect);
      expect(result).toBe("support");
    });

    test("4セット効果テキストから防護特性を抽出できること", () => {
      const fourSetEffect = "防護スキル使用時にダメージ軽減効果が発動する";
      const result = mapper.extractSpecialty(fourSetEffect);
      expect(result).toBe("defense");
    });

    test("4セット効果テキストから命破特性を抽出できること", () => {
      const fourSetEffect = "命破攻撃時に追加ダメージが発生する";
      const result = mapper.extractSpecialty(fourSetEffect);
      expect(result).toBe("rupture");
    });

    test("HTMLタグが含まれるテキストから特性を抽出できること", () => {
      const fourSetEffect =
        "<p>敵を<strong>撃破</strong>した時、効果が発動する</p>";
      const result = mapper.extractSpecialty(fourSetEffect);
      expect(result).toBe("stun");
    });

    test("特性パターンがマッチしない場合にデフォルト値を返すこと", () => {
      const fourSetEffect = "特殊な効果が発動する";
      const result = mapper.extractSpecialty(fourSetEffect);
      expect(result).toBe("attack");
    });

    test("空のテキストでデフォルト値を返すこと", () => {
      const result = mapper.extractSpecialty("");
      expect(result).toBe("attack");
    });

    test("nullまたはundefinedでデフォルト値を返すこと", () => {
      const result1 = mapper.extractSpecialty(null as any);
      const result2 = mapper.extractSpecialty(undefined as any);
      expect(result1).toBe("attack");
      expect(result2).toBe("attack");
    });
  });

  describe("多言語セット効果オブジェクトの生成", () => {
    test("日本語と英語のセット効果から多言語オブジェクトを生成できること", () => {
      const jaSetEffect = "攻撃力が15%アップする";
      const enSetEffect = "ATK increases by 15%";

      const result = mapper.createMultiLangSetEffect(jaSetEffect, enSetEffect);

      expect(result.ja).toBe("攻撃力が15%アップする");
      expect(result.en).toBe("ATK increases by 15%");
    });

    test("英語セット効果が提供されない場合に日本語をフォールバックとして使用すること", () => {
      const jaSetEffect = "攻撃力が15%アップする";

      const result = mapper.createMultiLangSetEffect(jaSetEffect);

      expect(result.ja).toBe("攻撃力が15%アップする");
      expect(result.en).toBe("攻撃力が15%アップする");
    });

    test("日本語セット効果が空の場合にエラーが発生すること", () => {
      expect(() => {
        mapper.createMultiLangSetEffect("");
      }).toThrow(MappingError);
    });

    test("前後の空白が適切にトリムされること", () => {
      const jaSetEffect = "  攻撃力が15%アップする  ";
      const enSetEffect = "  ATK increases by 15%  ";

      const result = mapper.createMultiLangSetEffect(jaSetEffect, enSetEffect);

      expect(result.ja).toBe("攻撃力が15%アップする");
      expect(result.en).toBe("ATK increases by 15%");
    });
  });
});
