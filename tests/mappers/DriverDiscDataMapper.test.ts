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

    test("モジュールデータが存在しない場合に空のセット効果を返すこと", () => {
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

      const result = mapper.extractSetEffects(mockApiResponse);

      expect(result.fourSetEffect).toBe("");
      expect(result.twoSetEffect).toBe("");
    });
  });

  describe("特性の抽出", () => {
    test("[撃破]キーワードから撃破特性を抽出できること", () => {
      const fourSetEffect = "[撃破]キャラクターが敵をブレイクした時、効果が発動する";
      expect(mapper.extractSpecialty(fourSetEffect)).toBe("stun");
    });

    test("[強攻]キーワードから強攻特性を抽出できること", () => {
      const fourSetEffect = "[強攻]キャラクターのダメージが上昇する";
      expect(mapper.extractSpecialty(fourSetEffect)).toBe("attack");
    });

    test("[異常]キーワードから異常特性を抽出できること", () => {
      const fourSetEffect = "[異常]キャラクターのダメージが上昇する";
      expect(mapper.extractSpecialty(fourSetEffect)).toBe("anomaly");
    });

    test("[支援]キーワードから支援特性を抽出できること", () => {
      const fourSetEffect = "[支援]キャラクターがスキルを使用した時、効果が発動する";
      expect(mapper.extractSpecialty(fourSetEffect)).toBe("support");
    });

    test("[防護]キーワードから防護特性を抽出できること", () => {
      const fourSetEffect = "[防護]キャラクターがスキルを使用した時、効果が発動する";
      expect(mapper.extractSpecialty(fourSetEffect)).toBe("defense");
    });

    test("[命破]キーワードから命破特性を抽出できること", () => {
      const fourSetEffect = "[命破]キャラクターの追加ダメージが発生する";
      expect(mapper.extractSpecialty(fourSetEffect)).toBe("rupture");
    });

    test("括弧なしのキーワードはマッチしないこと", () => {
      const fourSetEffect = "敵を撃破した時、効果が発動する";
      expect(mapper.extractSpecialties(fourSetEffect, "")).toEqual([]);
      expect(mapper.extractSpecialty(fourSetEffect)).toBe("attack");
    });

    test("HTMLタグが含まれるテキストから特性を抽出できること", () => {
      const fourSetEffect =
        "<p><strong>[撃破]</strong>キャラクターが敵をブレイクした時、効果が発動する</p>";
      expect(mapper.extractSpecialty(fourSetEffect)).toBe("stun");
    });

    test("効果テキストマッピングが適用され、結果がソートされること", () => {
      const fourSetEffect = "敵を撃破した時、チーム全体の攻撃力が上昇する";
      expect(mapper.extractSpecialties(fourSetEffect, "")).toEqual([
        "anomaly",
        "attack",
        "support",
      ]);
      expect(mapper.extractSpecialty(fourSetEffect)).toBe("anomaly");
    });

    test("4セットと2セット効果の特性を重複なく統合すること", () => {
      const result = mapper.extractSpecialties(
        "[撃破]キャラクターが敵をブレイクした時、効果が発動する",
        "防御力+16%"
      );
      expect(result).toEqual(["defense", "stun"]);
    });

    test("特性パターンがマッチしない場合にデフォルト値を返すこと", () => {
      const fourSetEffect = "特殊な効果が発動する";
      expect(mapper.extractSpecialties(fourSetEffect, "")).toEqual([]);
      expect(mapper.extractSpecialty(fourSetEffect)).toBe("attack");
    });

    test("空のテキストでデフォルト値を返すこと", () => {
      expect(mapper.extractSpecialties("", "")).toEqual([]);
      expect(mapper.extractSpecialty("")).toBe("attack");
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
