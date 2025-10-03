import { describe, it, expect, beforeEach } from "vitest";
import { AttributesProcessor } from "../../src/processors/AttributesProcessor";
import { ParsingError } from "../../src/errors";

describe("AttributesProcessor", () => {
  let processor: AttributesProcessor;

  beforeEach(() => {
    processor = new AttributesProcessor();
  });

  describe("processAscensionData", () => {
    const mockAscensionData = JSON.stringify({
      list: [
        {
          key: "1",
          combatList: [
            { key: "HP", values: ["677", "677"] },
            { key: "攻撃力", values: ["105", "105"] },
            { key: "防御力", values: ["49", "49"] },
            { key: "衝撃力", values: ["119", "119"] },
            { key: "会心率", values: ["5%", "5%"] },
            { key: "会心ダメージ", values: ["50%", "50%"] },
            { key: "異常マスタリー", values: ["91", "91"] },
            { key: "異常掌握", values: ["90", "90"] },
            { key: "貫通率", values: ["0%", "0%"] },
            { key: "エネルギー自動回復", values: ["1.2", "1.2"] },
          ],
        },
        {
          key: "10",
          combatList: [
            { key: "HP", values: ["1967", "1967"] },
            { key: "攻撃力", values: ["197", "197"] },
            { key: "防御力", values: ["141", "141"] },
          ],
        },
        {
          key: "20",
          combatList: [
            { key: "HP", values: ["3350", "3350"] },
            { key: "攻撃力", values: ["296", "296"] },
            { key: "防御力", values: ["241", "241"] },
          ],
        },
        {
          key: "30",
          combatList: [
            { key: "HP", values: ["4732", "4732"] },
            { key: "攻撃力", values: ["394", "394"] },
            { key: "防御力", values: ["340", "340"] },
          ],
        },
        {
          key: "40",
          combatList: [
            { key: "HP", values: ["6114", "6114"] },
            { key: "攻撃力", values: ["494", "494"] },
            { key: "防御力", values: ["441", "441"] },
          ],
        },
        {
          key: "50",
          combatList: [
            { key: "HP", values: ["7498", "7498"] },
            { key: "攻撃力", values: ["592", "592"] },
            { key: "防御力", values: ["540", "540"] },
          ],
        },
        {
          key: "60",
          combatList: [
            { key: "HP", values: ["8416", "8416"] },
            { key: "攻撃力", values: ["653", "653"] },
            { key: "防御力", values: ["606", "606"] },
          ],
        },
      ],
    });

    it("正常な昇格データを処理できる", () => {
      const result = processor.processAscensionData(mockAscensionData);

      expect(result).toEqual({
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
      });
    });

    it("空のデータの場合はParsingErrorを投げる", () => {
      expect(() => processor.processAscensionData("")).toThrow(ParsingError);
      expect(() => processor.processAscensionData("")).toThrow(
        "昇格データが空または存在しません"
      );
    });

    it("不正なJSONの場合はParsingErrorを投げる", () => {
      expect(() => processor.processAscensionData("{ invalid json }")).toThrow(
        ParsingError
      );
      expect(() => processor.processAscensionData("{ invalid json }")).toThrow(
        "昇格データのJSON解析に失敗しました"
      );
    });

    it("listが存在しない場合はParsingErrorを投げる", () => {
      const invalidData = JSON.stringify({ invalid: "structure" });

      expect(() => processor.processAscensionData(invalidData)).toThrow(
        ParsingError
      );
      expect(() => processor.processAscensionData(invalidData)).toThrow(
        "昇格データにlistが存在しないか、配列ではありません"
      );
    });
  });

  describe("extractLevelBasedStats", () => {
    const mockLevelDataList = [
      {
        key: "1",
        combatList: [
          { key: "HP", values: ["677", "677"] },
          { key: "攻撃力", values: ["105", "105"] },
          { key: "防御力", values: ["49", "49"] },
        ],
      },
      {
        key: "10",
        combatList: [
          { key: "HP", values: ["1967", "1967"] },
          { key: "攻撃力", values: ["197", "197"] },
          { key: "防御力", values: ["141", "141"] },
        ],
      },
    ];

    it("レベル別ステータスを正常に抽出できる", () => {
      // 全レベルのモックデータを作成
      const fullMockData = [
        {
          key: "1",
          combatList: [
            { key: "HP", values: ["677", "677"] },
            { key: "攻撃力", values: ["105", "105"] },
            { key: "防御力", values: ["49", "49"] },
          ],
        },
        {
          key: "10",
          combatList: [
            { key: "HP", values: ["1967", "1967"] },
            { key: "攻撃力", values: ["197", "197"] },
            { key: "防御力", values: ["141", "141"] },
          ],
        },
        {
          key: "20",
          combatList: [
            { key: "HP", values: ["3350", "3350"] },
            { key: "攻撃力", values: ["296", "296"] },
            { key: "防御力", values: ["241", "241"] },
          ],
        },
        {
          key: "30",
          combatList: [
            { key: "HP", values: ["4732", "4732"] },
            { key: "攻撃力", values: ["394", "394"] },
            { key: "防御力", values: ["340", "340"] },
          ],
        },
        {
          key: "40",
          combatList: [
            { key: "HP", values: ["6114", "6114"] },
            { key: "攻撃力", values: ["494", "494"] },
            { key: "防御力", values: ["441", "441"] },
          ],
        },
        {
          key: "50",
          combatList: [
            { key: "HP", values: ["7498", "7498"] },
            { key: "攻撃力", values: ["592", "592"] },
            { key: "防御力", values: ["540", "540"] },
          ],
        },
        {
          key: "60",
          combatList: [
            { key: "HP", values: ["8416", "8416"] },
            { key: "攻撃力", values: ["653", "653"] },
            { key: "防御力", values: ["606", "606"] },
          ],
        },
      ];

      const result = processor.extractLevelBasedStats(fullMockData);

      expect(result).toEqual({
        hp: [677, 1967, 3350, 4732, 6114, 7498, 8416],
        atk: [105, 197, 296, 394, 494, 592, 653],
        def: [49, 141, 241, 340, 441, 540, 606],
      });
    });

    it('"-"値を0に変換する', () => {
      const mockDataWithDash = [
        {
          key: "1",
          combatList: [
            { key: "HP", values: ["-", "677"] },
            { key: "攻撃力", values: ["-", "105"] },
            { key: "防御力", values: ["-", "49"] },
          ],
        },
        {
          key: "10",
          combatList: [
            { key: "HP", values: ["-", "1967"] },
            { key: "攻撃力", values: ["-", "197"] },
            { key: "防御力", values: ["-", "141"] },
          ],
        },
        {
          key: "20",
          combatList: [
            { key: "HP", values: ["-", "3350"] },
            { key: "攻撃力", values: ["-", "296"] },
            { key: "防御力", values: ["-", "241"] },
          ],
        },
        {
          key: "30",
          combatList: [
            { key: "HP", values: ["-", "4732"] },
            { key: "攻撃力", values: ["-", "394"] },
            { key: "防御力", values: ["-", "340"] },
          ],
        },
        {
          key: "40",
          combatList: [
            { key: "HP", values: ["-", "6114"] },
            { key: "攻撃力", values: ["-", "494"] },
            { key: "防御力", values: ["-", "441"] },
          ],
        },
        {
          key: "50",
          combatList: [
            { key: "HP", values: ["-", "7498"] },
            { key: "攻撃力", values: ["-", "592"] },
            { key: "防御力", values: ["-", "540"] },
          ],
        },
        {
          key: "60",
          combatList: [
            { key: "HP", values: ["-", "-"] },
            { key: "攻撃力", values: ["-", "-"] },
            { key: "防御力", values: ["-", "-"] },
          ],
        },
      ];

      const result = processor.extractLevelBasedStats(mockDataWithDash);

      expect(result.hp[6]).toBe(0); // レベル60のHPが"-"の場合
      expect(result.atk[6]).toBe(0); // レベル60の攻撃力が"-"の場合
      expect(result.def[6]).toBe(0); // レベル60の防御力が"-"の場合
    });

    it("レベルデータが見つからない場合はParsingErrorを投げる", () => {
      const incompleteData = [
        { key: "1", combatList: [{ key: "HP", values: ["677", "677"] }] },
        // レベル10以降のデータが不足
      ];

      expect(() => processor.extractLevelBasedStats(incompleteData)).toThrow(
        ParsingError
      );
      expect(() => processor.extractLevelBasedStats(incompleteData)).toThrow(
        "攻撃力データが見つかりません"
      );
    });
  });

  describe("extractFixedStats", () => {
    const mockLevelDataList = [
      {
        key: "1",
        combatList: [
          { key: "衝撃力", values: ["119", "119"] },
          { key: "会心率", values: ["5%", "5%"] },
          { key: "会心ダメージ", values: ["50%", "50%"] },
          { key: "異常マスタリー", values: ["91", "91"] },
          { key: "異常掌握", values: ["90", "90"] },
          { key: "貫通率", values: ["0%", "0%"] },
          { key: "エネルギー自動回復", values: ["1.2", "1.2"] },
        ],
      },
    ];

    it("固定ステータスを正常に抽出できる", () => {
      const result = processor.extractFixedStats(mockLevelDataList);

      expect(result).toEqual({
        impact: 119,
        critRate: 5,
        critDmg: 50,
        anomalyMastery: 91,
        anomalyProficiency: 90,
        penRatio: 0,
        energy: 1.2,
      });
    });

    it("パーセンテージ値から%記号を除去する", () => {
      const mockDataWithPercent = [
        {
          key: "1",
          combatList: [
            { key: "会心率", values: ["15%", "15%"] },
            { key: "会心ダメージ", values: ["75%", "75%"] },
            { key: "貫通率", values: ["10%", "10%"] },
          ],
        },
      ];

      const result = processor.extractFixedStats(mockDataWithPercent);

      expect(result.critRate).toBe(15);
      expect(result.critDmg).toBe(75);
      expect(result.penRatio).toBe(10);
    });

    it('"-"値を0に変換する', () => {
      const mockDataWithDash = [
        {
          key: "1",
          combatList: [
            { key: "衝撃力", values: ["-", "-"] },
            { key: "会心率", values: ["-", "-"] },
            { key: "異常マスタリー", values: ["-", "-"] },
          ],
        },
      ];

      const result = processor.extractFixedStats(mockDataWithDash);

      expect(result.impact).toBe(0);
      expect(result.critRate).toBe(0);
      expect(result.anomalyMastery).toBe(0);
    });

    it("レベル1データが見つからない場合はParsingErrorを投げる", () => {
      const noLevel1Data = [{ key: "10", combatList: [] }];

      expect(() => processor.extractFixedStats(noLevel1Data)).toThrow(
        ParsingError
      );
      expect(() => processor.extractFixedStats(noLevel1Data)).toThrow(
        "レベル 1 のデータが見つかりません"
      );
    });
  });
});
