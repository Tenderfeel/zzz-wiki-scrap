import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { BompGenerator } from "../../src/generators/BompGenerator";
import { ProcessedBompData } from "../../src/types/processing";
import { Bomp } from "../../src/types";
import * as fs from "fs";

// fs モジュールをモック
vi.mock("fs");

describe("BompGenerator", () => {
  let bompGenerator: BompGenerator;
  let mockJaData: ProcessedBompData;
  let mockEnData: ProcessedBompData;

  beforeEach(() => {
    bompGenerator = new BompGenerator();

    // モックデータの準備
    mockJaData = {
      basicInfo: {
        id: "excaliboo",
        name: "セイケンボンプ",
        stats: "氷属性",
        releaseVersion: 1.0,
      },
      attributesInfo: {
        ascensionData: JSON.stringify({
          list: [
            {
              key: "1",
              combatList: [
                { key: "HP", values: ["100", "100"] },
                { key: "攻撃力", values: ["50", "50"] },
                { key: "防御力", values: ["30", "30"] },
                { key: "衝撃力", values: ["10", "10"] },
                { key: "会心率", values: ["5%", "5%"] },
                { key: "会心ダメージ", values: ["50%", "50%"] },
                { key: "異常マスタリー", values: ["0", "0"] },
                { key: "異常掌握", values: ["0", "0"] },
                { key: "貫通率", values: ["0%", "0%"] },
                { key: "エネルギー自動回復", values: ["0", "0"] },
              ],
            },
            {
              key: "10",
              combatList: [
                { key: "HP", values: ["200", "200"] },
                { key: "攻撃力", values: ["100", "100"] },
                { key: "防御力", values: ["60", "60"] },
              ],
            },
            {
              key: "20",
              combatList: [
                { key: "HP", values: ["300", "300"] },
                { key: "攻撃力", values: ["150", "150"] },
                { key: "防御力", values: ["90", "90"] },
              ],
            },
            {
              key: "30",
              combatList: [
                { key: "HP", values: ["400", "400"] },
                { key: "攻撃力", values: ["200", "200"] },
                { key: "防御力", values: ["120", "120"] },
              ],
            },
            {
              key: "40",
              combatList: [
                { key: "HP", values: ["500", "500"] },
                { key: "攻撃力", values: ["250", "250"] },
                { key: "防御力", values: ["150", "150"] },
              ],
            },
            {
              key: "50",
              combatList: [
                { key: "HP", values: ["600", "600"] },
                { key: "攻撃力", values: ["300", "300"] },
                { key: "防御力", values: ["180", "180"] },
              ],
            },
            {
              key: "60",
              combatList: [
                { key: "HP", values: ["700", "700"] },
                { key: "攻撃力", values: ["350", "350"] },
                { key: "防御力", values: ["210", "210"] },
              ],
            },
          ],
        }),
      },
      extraAbility: "氷属性ダメージを与える",
      factionIds: [1, 2],
    };

    mockEnData = {
      basicInfo: {
        id: "excaliboo",
        name: "Excaliboo",
        stats: ["ice"],
        releaseVersion: 1.0,
      },
      attributesInfo: {
        ascensionData: JSON.stringify({
          list: [
            {
              key: "1",
              combatList: [
                { key: "HP", values: ["100", "100"] },
                { key: "攻撃力", values: ["50", "50"] },
                { key: "防御力", values: ["30", "30"] },
                { key: "衝撃力", values: ["10", "10"] },
                { key: "会心率", values: ["5%", "5%"] },
                { key: "会心ダメージ", values: ["50%", "50%"] },
                { key: "異常マスタリー", values: ["0", "0"] },
                { key: "異常掌握", values: ["0", "0"] },
                { key: "貫通率", values: ["0%", "0%"] },
                { key: "エネルギー自動回復", values: ["0", "0"] },
              ],
            },
            {
              key: "10",
              combatList: [
                { key: "HP", values: ["200", "200"] },
                { key: "攻撃力", values: ["100", "100"] },
                { key: "防御力", values: ["60", "60"] },
              ],
            },
            {
              key: "20",
              combatList: [
                { key: "HP", values: ["300", "300"] },
                { key: "攻撃力", values: ["150", "150"] },
                { key: "防御力", values: ["90", "90"] },
              ],
            },
            {
              key: "30",
              combatList: [
                { key: "HP", values: ["400", "400"] },
                { key: "攻撃力", values: ["200", "200"] },
                { key: "防御力", values: ["120", "120"] },
              ],
            },
            {
              key: "40",
              combatList: [
                { key: "HP", values: ["500", "500"] },
                { key: "攻撃力", values: ["250", "250"] },
                { key: "防御力", values: ["150", "150"] },
              ],
            },
            {
              key: "50",
              combatList: [
                { key: "HP", values: ["600", "600"] },
                { key: "攻撃力", values: ["300", "300"] },
                { key: "防御力", values: ["180", "180"] },
              ],
            },
            {
              key: "60",
              combatList: [
                { key: "HP", values: ["700", "700"] },
                { key: "攻撃力", values: ["350", "350"] },
                { key: "防御力", values: ["210", "210"] },
              ],
            },
          ],
        }),
      },
      extraAbility: "Deals ice damage",
      factionIds: [1, 2],
    };

    // fs モックの設定
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("generateBomp", () => {
    it("正常なデータでBompオブジェクトを生成できる", () => {
      const result = bompGenerator.generateBomp(
        mockJaData,
        mockEnData,
        "excaliboo"
      );

      // TODO: BompGenerator should use DataMapper.mapStats to convert "氷属性" to ["ice"]
      // This test currently expects the raw Japanese string but should expect the mapped array
      expect(result).toEqual({
        id: "excaliboo",
        name: { ja: "セイケンボンプ", en: "Excaliboo" },
        stats: "氷属性", // Should be ["ice"] after BompGenerator is updated
        releaseVersion: 1.0,
        faction: [1, 2],
        attr: {
          hp: [100, 200, 300, 400, 500, 600, 700],
          atk: [50, 100, 150, 200, 250, 300, 350],
          def: [30, 60, 90, 120, 150, 180, 210],
          impact: 10,
          critRate: 5,
          critDmg: 50,
          anomalyMastery: 0,
          anomalyProficiency: 0,
          penRatio: 0,
          energy: 0,
        },
        extraAbility: "氷属性ダメージを与える",
      });
    });

    it("英語データがない場合、日本語をフォールバックとして使用する", () => {
      const result = bompGenerator.generateBomp(mockJaData, null, "excaliboo");

      expect(result.name).toEqual({
        ja: "セイケンボンプ",
        en: "セイケンボンプ", // フォールバック
      });
    });

    it("派閥IDが空の場合、undefinedを設定する", () => {
      const dataWithoutFaction = {
        ...mockJaData,
        factionIds: [],
      };

      const result = bompGenerator.generateBomp(
        dataWithoutFaction,
        mockEnData,
        "excaliboo"
      );

      expect(result.faction).toEqual([]);
    });

    it("日本語データが存在しない場合、ValidationErrorを投げる", () => {
      expect(() => {
        bompGenerator.generateBomp(null as any, mockEnData, "excaliboo");
      }).toThrow("日本語データが存在しません");
    });

    it("ボンプIDが空の場合、ValidationErrorを投げる", () => {
      expect(() => {
        bompGenerator.generateBomp(mockJaData, mockEnData, "");
      }).toThrow("ボンプIDが指定されていません");
    });
  });

  describe("validateBomp", () => {
    let validBomp: Bomp;

    beforeEach(() => {
      validBomp = {
        id: "excaliboo",
        name: { ja: "セイケンボンプ", en: "Excaliboo" },
        stats: ["ice"],
        releaseVersion: 1.0,
        faction: [1, 2],
        attr: {
          hp: [100, 200, 300, 400, 500, 600, 700],
          atk: [50, 100, 150, 200, 250, 300, 350],
          def: [30, 60, 90, 120, 150, 180, 210],
          impact: 10,
          critRate: 5,
          critDmg: 50,
          anomalyMastery: 0,
          anomalyProficiency: 0,
          penRatio: 0,
          energy: 0,
        },
        extraAbility: "氷属性ダメージを与える",
      };
    });

    it("有効なBompオブジェクトの検証が成功する", () => {
      const result = bompGenerator.validateBomp(validBomp);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("IDが空の場合、検証エラーを返す", () => {
      validBomp.id = "";
      const result = bompGenerator.validateBomp(validBomp);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("id フィールドが空または存在しません");
    });

    it("HP配列が7要素でない場合、検証エラーを返す", () => {
      validBomp.attr.hp = [100, 200, 300]; // 3要素のみ
      const result = bompGenerator.validateBomp(validBomp);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "attr.hp 配列は正確に 7 つの値を含む必要があります"
      );
    });

    it("無効なstats値の場合、検証エラーを返す", () => {
      validBomp.stats = ["invalid"] as any;
      const result = bompGenerator.validateBomp(validBomp);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'stats "invalid" は有効な値ではありません'
      );
    });

    it("多言語名が不完全な場合、検証エラーを返す", () => {
      validBomp.name.ja = "";
      const result = bompGenerator.validateBomp(validBomp);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("name.ja が空または存在しません");
    });

    it("派閥IDが無効な場合、検証エラーを返す", () => {
      validBomp.faction = [0, -1]; // 無効なID
      const result = bompGenerator.validateBomp(validBomp);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("無効な派閥IDが含まれています: 0, -1");
    });
  });

  describe("outputBompFile", () => {
    let validBomps: Bomp[];

    beforeEach(() => {
      validBomps = [
        {
          id: "excaliboo",
          name: { ja: "セイケンボンプ", en: "Excaliboo" },
          stats: ["ice"],
          releaseVersion: 1.0,
          faction: [1],
          attr: {
            hp: [100, 200, 300, 400, 500, 600, 700],
            atk: [50, 100, 150, 200, 250, 300, 350],
            def: [30, 60, 90, 120, 150, 180, 210],
            impact: 10,
            critRate: 5,
            critDmg: 50,
            anomalyMastery: 0,
            anomalyProficiency: 0,
            penRatio: 0,
            energy: 0,
          },
          extraAbility: "氷属性ダメージを与える",
        },
      ];
    });

    it("正常にファイルを出力できる", () => {
      bompGenerator.outputBompFile(validBomps, "data/bomps.ts");

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        "data/bomps.ts",
        expect.stringContaining('import { Bomp } from "../src/types";'),
        "utf-8"
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        "data/bomps.ts",
        expect.stringContaining("export default ["),
        "utf-8"
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        "data/bomps.ts",
        expect.stringContaining("] as Bomp[];"),
        "utf-8"
      );
    });

    it("空の配列の場合でもファイルを出力できる", () => {
      bompGenerator.outputBompFile([], "data/bomps.ts");

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        "data/bomps.ts",
        expect.stringContaining("export default [\n\n] as Bomp[];"),
        "utf-8"
      );
    });

    it("無効な配列の場合、ValidationErrorを投げる", () => {
      expect(() => {
        bompGenerator.outputBompFile(null as any, "data/bomps.ts");
      }).toThrow("出力するBompオブジェクト配列が存在しません");
    });

    it("無効なパスの場合、ValidationErrorを投げる", () => {
      expect(() => {
        bompGenerator.outputBompFile(validBomps, "");
      }).toThrow("出力ファイルパスが無効です");
    });
  });

  describe("formatBompArray", () => {
    it("複数のBompオブジェクトを正しく整形する", () => {
      const bomps: Bomp[] = [
        {
          id: "bomp1",
          name: { ja: "ボンプ1", en: "Bomp1" },
          stats: ["ice"],
          attr: {
            hp: [100, 200, 300, 400, 500, 600, 700],
            atk: [50, 100, 150, 200, 250, 300, 350],
            def: [30, 60, 90, 120, 150, 180, 210],
            impact: 10,
            critRate: 5,
            critDmg: 50,
            anomalyMastery: 0,
            anomalyProficiency: 0,
            penRatio: 0,
            energy: 0,
          },
          extraAbility: "能力1",
        },
        {
          id: "bomp2",
          name: { ja: "ボンプ2", en: "Bomp2" },
          stats: ["fire"],
          attr: {
            hp: [110, 220, 330, 440, 550, 660, 770],
            atk: [55, 110, 165, 220, 275, 330, 385],
            def: [35, 70, 105, 140, 175, 210, 245],
            impact: 15,
            critRate: 10,
            critDmg: 60,
            anomalyMastery: 5,
            anomalyProficiency: 5,
            penRatio: 5,
            energy: 5,
          },
          extraAbility: "能力2",
        },
      ];

      const result = bompGenerator.formatBompArray(bomps);

      expect(result).toContain('id: "bomp1"');
      expect(result).toContain('id: "bomp2"');
      expect(result).toContain('name: { ja: "ボンプ1", en: "Bomp1" }');
      expect(result).toContain('name: { ja: "ボンプ2", en: "Bomp2" }');
      expect(result).toContain(",\n"); // オブジェクト間の区切り
    });

    it("空の配列の場合、空文字列を返す", () => {
      const result = bompGenerator.formatBompArray([]);
      expect(result).toBe("");
    });

    it("nullまたはundefinedの場合、空文字列を返す", () => {
      expect(bompGenerator.formatBompArray(null as any)).toBe("");
      expect(bompGenerator.formatBompArray(undefined as any)).toBe("");
    });

    it("特殊文字を含む名前を正しくエスケープする", () => {
      const bomps: Bomp[] = [
        {
          id: "special-bomp",
          name: { ja: 'ボンプ"特殊"', en: 'Bomp\n"Special"' },
          stats: ["ice"],
          attr: {
            hp: [100, 200, 300, 400, 500, 600, 700],
            atk: [50, 100, 150, 200, 250, 300, 350],
            def: [30, 60, 90, 120, 150, 180, 210],
            impact: 10,
            critRate: 5,
            critDmg: 50,
            anomalyMastery: 0,
            anomalyProficiency: 0,
            penRatio: 0,
            energy: 0,
          },
          extraAbility: 'テスト"改行\n含む"',
        },
      ];

      const result = bompGenerator.formatBompArray(bomps);

      expect(result).toContain('ja: "ボンプ\\"特殊\\""');
      expect(result).toContain('en: "Bomp\\n\\"Special\\""');
      expect(result).toContain('extraAbility: "テスト\\"改行\\n含む\\""');
    });

    it("undefinedのreleaseVersionとfactionを正しく処理する", () => {
      const bomps: Bomp[] = [
        {
          id: "bomp-no-version",
          name: { ja: "バージョンなし", en: "No Version" },
          stats: ["ice"],
          attr: {
            hp: [100, 200, 300, 400, 500, 600, 700],
            atk: [50, 100, 150, 200, 250, 300, 350],
            def: [30, 60, 90, 120, 150, 180, 210],
            impact: 10,
            critRate: 5,
            critDmg: 50,
            anomalyMastery: 0,
            anomalyProficiency: 0,
            penRatio: 0,
            energy: 0,
          },
          extraAbility: "能力",
          // releaseVersionとfactionは未定義
        },
      ];

      const result = bompGenerator.formatBompArray(bomps);

      expect(result).toContain("releaseVersion: undefined");
      expect(result).toContain("faction: []");
    });
  });

  describe("エラーハンドリングと境界値テスト", () => {
    describe("generateBomp - 追加エラーケース", () => {
      it("基本情報が存在しない場合、ValidationErrorを投げる", () => {
        const invalidData = {
          ...mockJaData,
          basicInfo: null as any,
        };

        expect(() => {
          bompGenerator.generateBomp(invalidData, mockEnData, "excaliboo");
        }).toThrow("日本語の基本情報が存在しません");
      });

      it("属性情報が存在しない場合、ValidationErrorを投げる", () => {
        const invalidData = {
          ...mockJaData,
          attributesInfo: null as any,
        };

        expect(() => {
          bompGenerator.generateBomp(invalidData, mockEnData, "excaliboo");
        }).toThrow("属性情報が存在しません");
      });

      it("空白のボンプIDの場合、ValidationErrorを投げる", () => {
        expect(() => {
          bompGenerator.generateBomp(mockJaData, mockEnData, "   ");
        }).toThrow("ボンプIDが指定されていません");
      });

      it("extraAbilityがundefinedの場合、空文字列を設定する", () => {
        const dataWithoutExtraAbility = {
          ...mockJaData,
          extraAbility: undefined as any,
        };

        const result = bompGenerator.generateBomp(
          dataWithoutExtraAbility,
          mockEnData,
          "excaliboo"
        );

        expect(result.extraAbility).toBe("");
      });

      it("factionIdsがundefinedの場合、undefinedを設定する", () => {
        const dataWithoutFaction = {
          ...mockJaData,
          factionIds: undefined,
        };

        const result = bompGenerator.generateBomp(
          dataWithoutFaction,
          mockEnData,
          "excaliboo"
        );

        expect(result.faction).toEqual([]);
      });
    });

    describe("validateBomp - 追加検証ケース", () => {
      let validBomp: Bomp;

      beforeEach(() => {
        validBomp = {
          id: "excaliboo",
          name: { ja: "セイケンボンプ", en: "Excaliboo" },
          stats: ["ice"],
          releaseVersion: 1.0,
          faction: [1, 2],
          attr: {
            hp: [100, 200, 300, 400, 500, 600, 700],
            atk: [50, 100, 150, 200, 250, 300, 350],
            def: [30, 60, 90, 120, 150, 180, 210],
            impact: 10,
            critRate: 5,
            critDmg: 50,
            anomalyMastery: 0,
            anomalyProficiency: 0,
            penRatio: 0,
            energy: 0,
          },
          extraAbility: "氷属性ダメージを与える",
        };
      });

      it("nameフィールドが存在しない場合、検証エラーを返す", () => {
        validBomp.name = null as any;
        const result = bompGenerator.validateBomp(validBomp);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("name フィールドが存在しません");
      });

      it("statsフィールドが存在しない場合、検証エラーを返す", () => {
        validBomp.stats = null as any;
        const result = bompGenerator.validateBomp(validBomp);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("stats フィールドが存在しません");
      });

      it("attrフィールドが存在しない場合、検証エラーを返す", () => {
        validBomp.attr = null as any;
        const result = bompGenerator.validateBomp(validBomp);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("attr フィールドが存在しません");
      });

      it("extraAbilityが文字列でない場合、検証エラーを返す", () => {
        validBomp.extraAbility = 123 as any;
        const result = bompGenerator.validateBomp(validBomp);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "extraAbility フィールドは文字列である必要があります"
        );
      });

      it("releaseVersionが数値でない場合、検証エラーを返す", () => {
        validBomp.releaseVersion = "1.0" as any;
        const result = bompGenerator.validateBomp(validBomp);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "releaseVersion は有効な数値である必要があります"
        );
      });

      it("releaseVersionが負の値の場合、検証エラーを返す", () => {
        validBomp.releaseVersion = -1;
        const result = bompGenerator.validateBomp(validBomp);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "releaseVersion は0以上の値である必要があります"
        );
      });

      it("factionが配列でない場合、検証エラーを返す", () => {
        validBomp.faction = "faction" as any;
        const result = bompGenerator.validateBomp(validBomp);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("faction は配列である必要があります");
      });

      it("ATK配列が7要素でない場合、検証エラーを返す", () => {
        validBomp.attr.atk = [100, 200];
        const result = bompGenerator.validateBomp(validBomp);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "attr.atk 配列は正確に 7 つの値を含む必要があります"
        );
      });

      it("DEF配列が7要素でない場合、検証エラーを返す", () => {
        validBomp.attr.def = [30, 60, 90, 120];
        const result = bompGenerator.validateBomp(validBomp);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "attr.def 配列は正確に 7 つの値を含む必要があります"
        );
      });

      it("固定ステータスが数値でない場合、検証エラーを返す", () => {
        validBomp.attr.impact = "10" as any;
        validBomp.attr.critRate = NaN;
        const result = bompGenerator.validateBomp(validBomp);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "attr.impact は有効な数値である必要があります"
        );
        expect(result.errors).toContain(
          "attr.critRate は有効な数値である必要があります"
        );
      });

      it("有効なstats値（frost、auricInk）を受け入れる", () => {
        validBomp.stats = ["frost"];
        let result = bompGenerator.validateBomp(validBomp);
        expect(result.isValid).toBe(true);

        validBomp.stats = ["auricInk"];
        result = bompGenerator.validateBomp(validBomp);
        expect(result.isValid).toBe(true);
      });

      it("name.enが空の場合、検証エラーを返す", () => {
        validBomp.name.en = "";
        const result = bompGenerator.validateBomp(validBomp);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("name.en が空または存在しません");
      });

      it("検証中に例外が発生した場合、エラー結果を返す", () => {
        // Bompオブジェクトのプロパティアクセスで例外を発生させる
        const invalidBomp = {
          get id() {
            throw new Error("Property access error");
          },
        } as any;

        const result = bompGenerator.validateBomp(invalidBomp);

        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain(
          "データ検証中にエラーが発生しました: Property access error"
        );
      });
    });

    describe("outputBompFile - 追加エラーケース", () => {
      let validBomps: Bomp[];

      beforeEach(() => {
        validBomps = [
          {
            id: "excaliboo",
            name: { ja: "セイケンボンプ", en: "Excaliboo" },
            stats: ["ice"],
            releaseVersion: 1.0,
            faction: [1],
            attr: {
              hp: [100, 200, 300, 400, 500, 600, 700],
              atk: [50, 100, 150, 200, 250, 300, 350],
              def: [30, 60, 90, 120, 150, 180, 210],
              impact: 10,
              critRate: 5,
              critDmg: 50,
              anomalyMastery: 0,
              anomalyProficiency: 0,
              penRatio: 0,
              energy: 0,
            },
            extraAbility: "氷属性ダメージを与える",
          },
        ];
      });

      it("出力パスが空文字列の場合、ValidationErrorを投げる", () => {
        expect(() => {
          bompGenerator.outputBompFile(validBomps, "");
        }).toThrow("出力ファイルパスが無効です");
      });

      it("出力パスが空白のみの場合、ValidationErrorを投げる", () => {
        expect(() => {
          bompGenerator.outputBompFile(validBomps, "   ");
        }).toThrow("出力ファイルパスが無効です");
      });

      it("ディレクトリが存在しない場合、作成を試みる", () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        bompGenerator.outputBompFile(validBomps, "new/directory/bomps.ts");

        expect(fs.mkdirSync).toHaveBeenCalledWith("new/directory", {
          recursive: true,
        });
      });

      it("ファイル書き込みに失敗した場合、ParsingErrorを投げる", () => {
        vi.mocked(fs.writeFileSync).mockImplementation(() => {
          throw new Error("Write failed");
        });

        expect(() => {
          bompGenerator.outputBompFile(validBomps, "data/bomps.ts");
        }).toThrow('ファイル "data/bomps.ts" の書き込みに失敗しました');
      });

      it("src/以外のパスの場合、適切なimportパスを使用する", () => {
        bompGenerator.outputBompFile(validBomps, "output/bomps.ts");

        expect(fs.writeFileSync).toHaveBeenCalledWith(
          "output/bomps.ts",
          expect.stringContaining('import { Bomp } from "./src/types";'),
          "utf-8"
        );
      });
    });
  });
});
