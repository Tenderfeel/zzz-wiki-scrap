import { describe, it, expect, beforeEach, vi } from "vitest";
import { CharacterGenerator } from "../../src/generators/CharacterGenerator";
import { ProcessedData } from "../../src/types/processing";
import { ValidationError, ParsingError } from "../../src/errors";
import { DataMapper } from "../../src/mappers/DataMapper";
import * as fs from "fs";

// fsモジュールをモック
vi.mock("fs");

// DataMapperをモック
vi.mock("../../src/mappers/DataMapper");

describe("CharacterGenerator", () => {
  let generator: CharacterGenerator;
  let mockDataMapper: any;

  beforeEach(() => {
    // DataMapperのモックを作成
    mockDataMapper = {
      mapSpecialty: vi.fn(),
      mapStats: vi.fn(),
      mapRarity: vi.fn(),
      createMultiLangName: vi.fn(),
    };

    // DataMapperのコンストラクタをモック
    vi.mocked(DataMapper).mockImplementation(() => mockDataMapper);

    generator = new CharacterGenerator();
    vi.clearAllMocks();
  });

  const mockJaData: ProcessedData = {
    basicInfo: {
      id: "28",
      name: "フォン・ライカン",
      specialty: "撃破",
      stats: "氷属性",
      rarity: "S",
    },
    factionInfo: {
      id: 2,
      name: "ヴィクトリア家政",
    },
    attributesInfo: {
      ascensionData: JSON.stringify({
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
      }),
    },
  };

  const mockEnData: ProcessedData = {
    basicInfo: {
      id: "28",
      name: "Von Lycaon",
      specialty: "stun",
      stats: "ice",
      rarity: "S",
    },
    factionInfo: {
      id: 2,
      name: "Victoria Housekeeping Co.",
    },
    attributesInfo: {
      ascensionData: "", // 英語データでは使用しない
    },
  };

  describe("generateCharacter", () => {
    beforeEach(() => {
      // デフォルトのモック戻り値を設定
      mockDataMapper.mapSpecialty.mockReturnValue("stun");
      mockDataMapper.mapStats.mockReturnValue("ice");
      mockDataMapper.mapRarity.mockReturnValue("S");
      mockDataMapper.createMultiLangName.mockReturnValue({
        ja: "フォン・ライカン",
        en: "Von Lycaon",
      });
    });

    it("正常なCharacterオブジェクトを生成できる", () => {
      const result = generator.generateCharacter(mockJaData, mockEnData);

      expect(result).toEqual({
        id: "lycaon",
        name: { ja: "フォン・ライカン", en: "Von Lycaon" },
        fullName: { ja: "フォン・ライカン", en: "Von Lycaon" },
        specialty: "stun",
        stats: "ice",
        faction: 2,
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
      });
    });

    it("pageIdパラメータを含むCharacterオブジェクトを生成できる", () => {
      const pageId = "28";
      const result = generator.generateCharacter(
        mockJaData,
        mockEnData,
        pageId
      );

      expect(result).toEqual({
        id: "lycaon",
        name: { ja: "フォン・ライカン", en: "Von Lycaon" },
        fullName: { ja: "フォン・ライカン", en: "Von Lycaon" },
        specialty: "stun",
        stats: "ice",
        faction: 2,
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
      });
    });

    it("日本語データが存在しない場合はValidationErrorを投げる", () => {
      expect(() =>
        generator.generateCharacter(null as any, mockEnData)
      ).toThrow(ValidationError);
      expect(() =>
        generator.generateCharacter(null as any, mockEnData)
      ).toThrow("日本語データが存在しません");
    });

    it("英語データが存在しない場合はValidationErrorを投げる", () => {
      expect(() =>
        generator.generateCharacter(mockJaData, null as any)
      ).toThrow(ValidationError);
      expect(() =>
        generator.generateCharacter(mockJaData, null as any)
      ).toThrow("英語データが存在しません");
    });

    it("基本情報が不足している場合はValidationErrorを投げる", () => {
      const incompleteJaData = { ...mockJaData, basicInfo: null as any };

      expect(() =>
        generator.generateCharacter(incompleteJaData, mockEnData)
      ).toThrow(ValidationError);
      expect(() =>
        generator.generateCharacter(incompleteJaData, mockEnData)
      ).toThrow("日本語の基本情報が存在しません");
    });

    it("英語の基本情報が不足している場合はValidationErrorを投げる", () => {
      const incompleteEnData = { ...mockEnData, basicInfo: null as any };

      expect(() =>
        generator.generateCharacter(mockJaData, incompleteEnData)
      ).toThrow(ValidationError);
      expect(() =>
        generator.generateCharacter(mockJaData, incompleteEnData)
      ).toThrow("英語の基本情報が存在しません");
    });

    it("陣営情報が不足している場合はValidationErrorを投げる", () => {
      const incompleteJaData = { ...mockJaData, factionInfo: null as any };

      expect(() =>
        generator.generateCharacter(incompleteJaData, mockEnData)
      ).toThrow(ValidationError);
      expect(() =>
        generator.generateCharacter(incompleteJaData, mockEnData)
      ).toThrow("陣営情報が存在しません");
    });

    it("属性情報が不足している場合はValidationErrorを投げる", () => {
      const incompleteJaData = { ...mockJaData, attributesInfo: null as any };

      expect(() =>
        generator.generateCharacter(incompleteJaData, mockEnData)
      ).toThrow(ValidationError);
      expect(() =>
        generator.generateCharacter(incompleteJaData, mockEnData)
      ).toThrow("属性情報が存在しません");
    });

    it("DataMapperでエラーが発生した場合はValidationErrorを投げる", () => {
      // mapSpecialtyがエラーを投げるようにモック
      mockDataMapper.mapSpecialty.mockImplementation(() => {
        throw new Error("Specialty mapping error");
      });

      expect(() => generator.generateCharacter(mockJaData, mockEnData)).toThrow(
        ValidationError
      );
      expect(() => generator.generateCharacter(mockJaData, mockEnData)).toThrow(
        "Characterオブジェクトの生成に失敗しました"
      );
    });
  });

  describe("validateCharacter", () => {
    const validCharacter = {
      id: "lycaon",
      name: { ja: "フォン・ライカン", en: "Von Lycaon" },
      fullName: { ja: "フォン・ライカン", en: "Von Lycaon" },
      specialty: "stun" as const,
      stats: "ice" as const,
      faction: 2,
      rarity: "S" as const,
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

    it("有効なCharacterオブジェクトの検証が成功する", () => {
      const result = generator.validateCharacter(validCharacter);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("必須フィールドが不足している場合は検証エラーを返す", () => {
      const invalidCharacter = { ...validCharacter, id: "" };

      const result = generator.validateCharacter(invalidCharacter);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("id フィールドが空または存在しません");
    });

    it("多言語オブジェクトが不完全な場合は検証エラーを返す", () => {
      const invalidCharacter = {
        ...validCharacter,
        name: { ja: "フォン・ライカン", en: "" },
      };

      const result = generator.validateCharacter(invalidCharacter);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("name.en が空または存在しません");
    });

    it("数値配列の長さが不正な場合は検証エラーを返す", () => {
      const invalidCharacter = {
        ...validCharacter,
        attr: {
          ...validCharacter.attr,
          hp: [677, 1967, 3350], // 7要素ではなく3要素
        },
      };

      const result = generator.validateCharacter(invalidCharacter);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "attr.hp 配列は正確に 7 つの値を含む必要があります"
      );
    });

    it("無効な列挙値の場合は検証エラーを返す", () => {
      const invalidCharacter = {
        ...validCharacter,
        specialty: "invalid" as any,
      };

      const result = generator.validateCharacter(invalidCharacter);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'specialty "invalid" は有効な値ではありません'
      );
    });

    it("検証失敗時は警告ログを出力する", () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const invalidCharacter = {
        ...validCharacter,
        id: "", // 無効なID
      };

      const result = generator.validateCharacter(invalidCharacter);

      expect(result.isValid).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Character検証エラー:",
        expect.arrayContaining(["id フィールドが空または存在しません"])
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe("outputCharacterFile", () => {
    const mockCharacter = {
      id: "lycaon",
      name: { ja: "フォン・ライカン", en: "Von Lycaon" },
      fullName: { ja: "フォン・ライカン", en: "Von Lycaon" },
      specialty: "stun" as const,
      stats: "ice" as const,
      faction: 2,
      rarity: "S" as const,
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

    it("正常にファイルを出力できる", () => {
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => "");

      generator.outputCharacterFile(mockCharacter, "data/test-characters.ts");

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        "data/test-characters.ts",
        expect.stringContaining("export default ["),
        "utf-8"
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        "data/test-characters.ts",
        expect.stringContaining('id: "lycaon"'),
        "utf-8"
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        "data/test-characters.ts",
        expect.stringContaining("] as Character[];"),
        "utf-8"
      );
    });

    it("Characterオブジェクトが存在しない場合はValidationErrorを投げる", () => {
      expect(() => generator.outputCharacterFile(null as any)).toThrow(
        ValidationError
      );
      expect(() => generator.outputCharacterFile(null as any)).toThrow(
        "出力するCharacterオブジェクトが存在しません"
      );
    });

    it("出力パスが無効な場合はValidationErrorを投げる", () => {
      expect(() => generator.outputCharacterFile(mockCharacter, "")).toThrow(
        ValidationError
      );
      expect(() => generator.outputCharacterFile(mockCharacter, "")).toThrow(
        "出力ファイルパスが無効です"
      );
    });

    it("ファイル書き込みに失敗した場合はParsingErrorを投げる", () => {
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error("Permission denied");
      });

      expect(() =>
        generator.outputCharacterFile(mockCharacter, "test.ts")
      ).toThrow(ParsingError);
      expect(() =>
        generator.outputCharacterFile(mockCharacter, "test.ts")
      ).toThrow('ファイル "test.ts" の書き込みに失敗しました');
    });

    it("ディレクトリ作成に失敗した場合はParsingErrorを投げる", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => {
        throw new Error("Permission denied");
      });

      expect(() =>
        generator.outputCharacterFile(mockCharacter, "data/test.ts")
      ).toThrow(ParsingError);
      expect(() =>
        generator.outputCharacterFile(mockCharacter, "data/test.ts")
      ).toThrow("ファイル出力に失敗しました");
    });
  });
});
