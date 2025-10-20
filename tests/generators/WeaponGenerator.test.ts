import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { WeaponGenerator } from "../../src/generators/WeaponGenerator";
import { DataMapper } from "../../src/mappers/DataMapper";
import { ValidationError, ParsingError } from "../../src/errors";
import {
  Weapon,
  ProcessedWeaponData,
  BasicWeaponInfo,
  WeaponSkillInfo,
  WeaponAttributesInfo,
  WeaponAgentInfo,
  Stats,
} from "../../src/types";
import * as fs from "fs";

// モック設定
vi.mock("../../src/utils/Logger", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("fs", () => ({
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

describe("WeaponGenerator", () => {
  let generator: WeaponGenerator;
  let mockDataMapper: DataMapper;

  const mockBasicWeaponInfo: BasicWeaponInfo = {
    id: "901",
    name: "テスト音動機",
    rarity: "S",
    specialty: "attack",
  };

  const mockWeaponSkillInfo: WeaponSkillInfo = {
    equipmentSkillName: "テストスキル",
    equipmentSkillDesc: "テストスキルの説明",
  };

  const mockWeaponAttributesInfo: WeaponAttributesInfo = {
    hp: [100, 110, 120, 130, 140, 150, 160],
    atk: [50, 55, 60, 65, 70, 75, 80],
    def: [30, 33, 36, 39, 42, 45, 48],
    impact: [10, 11, 12, 13, 14, 15, 16],
    critRate: [5, 5.5, 6, 6.5, 7, 7.5, 8],
    critDmg: [20, 22, 24, 26, 28, 30, 32],
    anomalyMastery: [0, 0, 0, 0, 0, 0, 0],
    anomalyProficiency: [0, 0, 0, 0, 0, 0, 0],
    penRatio: [0, 0, 0, 0, 0, 0, 0],
    energy: [0, 0, 0, 0, 0, 0, 0],
  };

  const mockWeaponAgentInfo: WeaponAgentInfo = {
    agentId: "lycaon",
  };

  const mockProcessedWeaponData: ProcessedWeaponData = {
    basicInfo: mockBasicWeaponInfo,
    skillInfo: mockWeaponSkillInfo,
    attributesInfo: mockWeaponAttributesInfo,
    agentInfo: mockWeaponAgentInfo,
  };

  const mockEnProcessedWeaponData: ProcessedWeaponData = {
    basicInfo: {
      id: "901",
      name: "Test Weapon",
      rarity: "S",
      specialty: "attack",
    },
    skillInfo: {
      equipmentSkillName: "Test Skill",
      equipmentSkillDesc: "Test skill description",
    },
    attributesInfo: mockWeaponAttributesInfo,
    agentInfo: mockWeaponAgentInfo,
  };

  const expectedWeapon: Weapon = {
    id: 901,
    name: { ja: "テスト音動機", en: "Test Weapon" },
    equipmentSkillName: { ja: "テストスキル", en: "Test Skill" },
    equipmentSkillDesc: {
      ja: "テストスキルの説明",
      en: "Test skill description",
    },
    rarity: "S",
    attr: {
      hp: [100, 110, 120, 130, 140, 150, 160],
      atk: [50, 55, 60, 65, 70, 75, 80],
      def: [30, 33, 36, 39, 42, 45, 48],
      impact: [10, 11, 12, 13, 14, 15, 16],
      critRate: [5, 5.5, 6, 6.5, 7, 7.5, 8],
      critDmg: [20, 22, 24, 26, 28, 30, 32],
      anomalyMastery: [0, 0, 0, 0, 0, 0, 0],
      anomalyProficiency: [0, 0, 0, 0, 0, 0, 0],
      penRatio: [0, 0, 0, 0, 0, 0, 0],
      energy: [0, 0, 0, 0, 0, 0, 0],
    },
    specialty: "attack",
    stats: ["physical"],
    agentId: "lycaon",
    baseAttr: "atk",
    advancedAttr: "critRate",
  };

  beforeEach(() => {
    // モックインスタンスを作成
    mockDataMapper = {
      createMultiLangName: vi.fn(),
      mapRarity: vi.fn(),
      mapSpecialty: vi.fn(),
    } as any;

    // ジェネレーターを初期化
    generator = new WeaponGenerator();
    (generator as any).dataMapper = mockDataMapper;
  });

  describe("generateWeapon", () => {
    it("正常な音動機オブジェクトを生成できる", () => {
      // モックの設定
      (mockDataMapper.createMultiLangName as Mock)
        .mockReturnValueOnce({ ja: "テスト音動機", en: "Test Weapon" })
        .mockReturnValueOnce({ ja: "テストスキル", en: "Test Skill" })
        .mockReturnValueOnce({
          ja: "テストスキルの説明",
          en: "Test skill description",
        });

      (mockDataMapper.mapRarity as Mock).mockReturnValue("S");
      (mockDataMapper.mapSpecialty as Mock).mockReturnValue("attack");

      // テスト実行
      const result = generator.generateWeapon(
        mockProcessedWeaponData,
        mockEnProcessedWeaponData,
        "901"
      );

      // 検証
      expect(result).toEqual(expectedWeapon);
      expect(mockDataMapper.createMultiLangName).toHaveBeenCalledWith(
        "テスト音動機",
        "Test Weapon"
      );
      expect(mockDataMapper.createMultiLangName).toHaveBeenCalledWith(
        "テストスキル",
        "Test Skill"
      );
      expect(mockDataMapper.createMultiLangName).toHaveBeenCalledWith(
        "テストスキルの説明",
        "Test skill description"
      );
      expect(mockDataMapper.mapRarity).toHaveBeenCalledWith("S");
      expect(mockDataMapper.mapSpecialty).toHaveBeenCalledWith("attack");
    });

    it("英語データがない場合は日本語データをフォールバックとして使用する", () => {
      // モックの設定
      (mockDataMapper.createMultiLangName as Mock)
        .mockReturnValueOnce({ ja: "テスト音動機", en: "テスト音動機" })
        .mockReturnValueOnce({ ja: "テストスキル", en: "テストスキル" })
        .mockReturnValueOnce({
          ja: "テストスキルの説明",
          en: "テストスキルの説明",
        });

      (mockDataMapper.mapRarity as Mock).mockReturnValue("S");
      (mockDataMapper.mapSpecialty as Mock).mockReturnValue("attack");

      // テスト実行
      const result = generator.generateWeapon(
        mockProcessedWeaponData,
        null,
        "901"
      );

      // 検証
      expect(result.name).toEqual({ ja: "テスト音動機", en: "テスト音動機" });
      expect(result.equipmentSkillName).toEqual({
        ja: "テストスキル",
        en: "テストスキル",
      });
      expect(result.equipmentSkillDesc).toEqual({
        ja: "テストスキルの説明",
        en: "テストスキルの説明",
      });
      expect(mockDataMapper.createMultiLangName).toHaveBeenCalledWith(
        "テスト音動機",
        "テスト音動機"
      );
    });

    it("レア度マッピングに失敗した場合はデフォルト値を使用する", () => {
      // モックの設定
      (mockDataMapper.createMultiLangName as Mock).mockReturnValue({
        ja: "テスト音動機",
        en: "Test Weapon",
      });

      (mockDataMapper.mapRarity as Mock).mockImplementation(() => {
        throw new Error("レア度マッピング失敗");
      });
      (mockDataMapper.mapSpecialty as Mock).mockReturnValue("attack");

      // テスト実行
      const result = generator.generateWeapon(
        mockProcessedWeaponData,
        mockEnProcessedWeaponData,
        "901"
      );

      // 検証
      expect(result.rarity).toBe("A"); // デフォルト値
    });

    it("特性マッピングに失敗した場合はデフォルト値を使用する", () => {
      // モックの設定
      (mockDataMapper.createMultiLangName as Mock).mockReturnValue({
        ja: "テスト音動機",
        en: "Test Weapon",
      });

      (mockDataMapper.mapRarity as Mock).mockReturnValue("S");
      (mockDataMapper.mapSpecialty as Mock).mockImplementation(() => {
        throw new Error("特性マッピング失敗");
      });

      // テスト実行
      const result = generator.generateWeapon(
        mockProcessedWeaponData,
        mockEnProcessedWeaponData,
        "901"
      );

      // 検証
      expect(result.specialty).toBe("attack"); // デフォルト値
    });

    it("特性が空文字列の場合はデフォルト値を使用する", () => {
      const dataWithEmptySpecialty = {
        ...mockProcessedWeaponData,
        basicInfo: {
          ...mockBasicWeaponInfo,
          specialty: "",
        },
      };

      // モックの設定
      (mockDataMapper.createMultiLangName as Mock).mockReturnValue({
        ja: "テスト音動機",
        en: "Test Weapon",
      });

      (mockDataMapper.mapRarity as Mock).mockReturnValue("S");

      // テスト実行
      const result = generator.generateWeapon(
        dataWithEmptySpecialty,
        mockEnProcessedWeaponData,
        "901"
      );

      // 検証
      expect(result.specialty).toBe("attack"); // デフォルト値
      expect(mockDataMapper.mapSpecialty).not.toHaveBeenCalled();
    });

    it("日本語データが存在しない場合はValidationErrorを投げる", () => {
      // テスト実行と検証
      expect(() => {
        generator.generateWeapon(null as any, mockEnProcessedWeaponData, "901");
      }).toThrow(ValidationError);
      expect(() => {
        generator.generateWeapon(null as any, mockEnProcessedWeaponData, "901");
      }).toThrow("日本語データが存在しません");
    });

    it("基本情報が存在しない場合はValidationErrorを投げる", () => {
      const dataWithoutBasicInfo = {
        ...mockProcessedWeaponData,
        basicInfo: null as any,
      };

      // テスト実行と検証
      expect(() => {
        generator.generateWeapon(
          dataWithoutBasicInfo,
          mockEnProcessedWeaponData,
          "901"
        );
      }).toThrow(ValidationError);
      expect(() => {
        generator.generateWeapon(
          dataWithoutBasicInfo,
          mockEnProcessedWeaponData,
          "901"
        );
      }).toThrow("日本語の基本情報が存在しません");
    });

    it("属性情報が存在しない場合はValidationErrorを投げる", () => {
      const dataWithoutAttributesInfo = {
        ...mockProcessedWeaponData,
        attributesInfo: null as any,
      };

      // テスト実行と検証
      expect(() => {
        generator.generateWeapon(
          dataWithoutAttributesInfo,
          mockEnProcessedWeaponData,
          "901"
        );
      }).toThrow(ValidationError);
      expect(() => {
        generator.generateWeapon(
          dataWithoutAttributesInfo,
          mockEnProcessedWeaponData,
          "901"
        );
      }).toThrow("属性情報が存在しません");
    });

    it("音動機IDが無効な場合はValidationErrorを投げる", () => {
      // モックの設定
      (mockDataMapper.createMultiLangName as Mock).mockReturnValue({
        ja: "テスト音動機",
        en: "Test Weapon",
      });

      // テスト実行と検証
      expect(() => {
        generator.generateWeapon(
          mockProcessedWeaponData,
          mockEnProcessedWeaponData,
          ""
        );
      }).toThrow(ValidationError);
      expect(() => {
        generator.generateWeapon(
          mockProcessedWeaponData,
          mockEnProcessedWeaponData,
          ""
        );
      }).toThrow("音動機IDが指定されていません");
    });

    it("エージェントIDが未定義の場合は空文字列を設定する", () => {
      const dataWithoutAgentId = {
        ...mockProcessedWeaponData,
        agentInfo: {
          agentId: undefined,
        },
      };

      // モックの設定
      (mockDataMapper.createMultiLangName as Mock).mockReturnValue({
        ja: "テスト音動機",
        en: "Test Weapon",
      });

      (mockDataMapper.mapRarity as Mock).mockReturnValue("S");
      (mockDataMapper.mapSpecialty as Mock).mockReturnValue("attack");

      // テスト実行
      const result = generator.generateWeapon(
        dataWithoutAgentId,
        mockEnProcessedWeaponData,
        "901"
      );

      // 検証
      expect(result.agentId).toBe("");
    });

    it("処理中にエラーが発生した場合はValidationErrorを投げる", () => {
      // モックの設定（エラーを発生させる）
      (mockDataMapper.createMultiLangName as Mock).mockImplementation(() => {
        throw new Error("予期しないエラー");
      });

      // テスト実行と検証
      expect(() => {
        generator.generateWeapon(
          mockProcessedWeaponData,
          mockEnProcessedWeaponData,
          "901"
        );
      }).toThrow(ValidationError);
      expect(() => {
        generator.generateWeapon(
          mockProcessedWeaponData,
          mockEnProcessedWeaponData,
          "901"
        );
      }).toThrow("Weaponオブジェクトの生成に失敗しました");
    });
  });

  describe("validateWeapon", () => {
    it("有効な音動機オブジェクトの検証に成功する", () => {
      const result = generator.validateWeapon(expectedWeapon);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("IDが無効な場合は検証に失敗する", () => {
      const invalidWeapon = {
        ...expectedWeapon,
        id: NaN,
      };

      const result = generator.validateWeapon(invalidWeapon);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("id フィールドが無効な数値です");
    });

    it("IDが0以下の場合は検証に失敗する", () => {
      const invalidWeapon = {
        ...expectedWeapon,
        id: 0,
      };

      const result = generator.validateWeapon(invalidWeapon);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("id フィールドが無効な数値です");
    });

    it("nameフィールドが存在しない場合は検証に失敗する", () => {
      const invalidWeapon = {
        ...expectedWeapon,
        name: null as any,
      };

      const result = generator.validateWeapon(invalidWeapon);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("name フィールドが存在しません");
    });

    it("name.jaが空の場合は検証に失敗する", () => {
      const invalidWeapon = {
        ...expectedWeapon,
        name: { ja: "", en: "Test Weapon" },
      };

      const result = generator.validateWeapon(invalidWeapon);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("name.ja が空または存在しません");
    });

    it("name.enが空の場合は検証に失敗する", () => {
      const invalidWeapon = {
        ...expectedWeapon,
        name: { ja: "テスト音動機", en: "" },
      };

      const result = generator.validateWeapon(invalidWeapon);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("name.en が空または存在しません");
    });

    it("equipmentSkillNameの型が無効な場合は検証に失敗する", () => {
      const invalidWeapon = {
        ...expectedWeapon,
        equipmentSkillName: { ja: 123, en: "Test Skill" } as any,
      };

      const result = generator.validateWeapon(invalidWeapon);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "equipmentSkillName.ja は文字列である必要があります"
      );
    });

    it("equipmentSkillDescの型が無効な場合は検証に失敗する", () => {
      const invalidWeapon = {
        ...expectedWeapon,
        equipmentSkillDesc: { ja: "テストスキルの説明", en: 456 } as any,
      };

      const result = generator.validateWeapon(invalidWeapon);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "equipmentSkillDesc.en は文字列である必要があります"
      );
    });

    it("rarityが無効な値の場合は検証に失敗する", () => {
      const invalidWeapon = {
        ...expectedWeapon,
        rarity: "B" as any,
      };

      const result = generator.validateWeapon(invalidWeapon);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'rarity "B" は有効な値ではありません（"A"または"S"である必要があります）'
      );
    });

    it("specialtyが無効な値の場合は検証に失敗する", () => {
      const invalidWeapon = {
        ...expectedWeapon,
        specialty: "invalid" as any,
      };

      const result = generator.validateWeapon(invalidWeapon);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'specialty "invalid" は有効な値ではありません'
      );
    });

    it("statsが配列ではない場合は検証に失敗する", () => {
      const invalidWeapon = {
        ...expectedWeapon,
        stats: "physical" as any,
      };

      const result = generator.validateWeapon(invalidWeapon);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "stats は空でない配列である必要があります"
      );
    });

    it("statsが空配列の場合は検証に失敗する", () => {
      const invalidWeapon = {
        ...expectedWeapon,
        stats: [],
      };

      const result = generator.validateWeapon(invalidWeapon);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "stats は空でない配列である必要があります"
      );
    });

    it("statsに無効な値が含まれる場合は検証に失敗する", () => {
      const invalidWeapon = {
        ...expectedWeapon,
        stats: ["physical", "invalid"] as any,
      };

      const result = generator.validateWeapon(invalidWeapon);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'stats "invalid" は有効な値ではありません'
      );
    });

    it("agentIdが文字列ではない場合は検証に失敗する", () => {
      const invalidWeapon = {
        ...expectedWeapon,
        agentId: 123 as any,
      };

      const result = generator.validateWeapon(invalidWeapon);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "agentId フィールドは文字列である必要があります"
      );
    });

    it("baseAttrが無効な値の場合は検証に失敗する", () => {
      const invalidWeapon = {
        ...expectedWeapon,
        baseAttr: "invalid" as any,
      };

      const result = generator.validateWeapon(invalidWeapon);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'baseAttr "invalid" は有効な値ではありません'
      );
    });

    it("advancedAttrが無効な値の場合は検証に失敗する", () => {
      const invalidWeapon = {
        ...expectedWeapon,
        advancedAttr: "invalid" as any,
      };

      const result = generator.validateWeapon(invalidWeapon);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'advancedAttr "invalid" は有効な値ではありません'
      );
    });

    it("属性配列が配列ではない場合は検証に失敗する", () => {
      const invalidWeapon = {
        ...expectedWeapon,
        attr: {
          ...expectedWeapon.attr,
          hp: "invalid" as any,
        },
      };

      const result = generator.validateWeapon(invalidWeapon);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("attr.hp は配列である必要があります");
    });

    it("属性配列の長さが7ではない場合は検証に失敗する", () => {
      const invalidWeapon = {
        ...expectedWeapon,
        attr: {
          ...expectedWeapon.attr,
          hp: [100, 110, 120], // 長さが3
        },
      };

      const result = generator.validateWeapon(invalidWeapon);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "attr.hp 配列は正確に7つの値を含む必要があります（現在: 3）"
      );
    });

    it("属性配列に無効な数値が含まれる場合は検証に失敗する", () => {
      const invalidWeapon = {
        ...expectedWeapon,
        attr: {
          ...expectedWeapon.attr,
          hp: [100, NaN, 120, 130, 140, 150, 160],
        },
      };

      const result = generator.validateWeapon(invalidWeapon);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "attr.hp[1] は有効な数値である必要があります: NaN"
      );
    });

    it("検証処理中にエラーが発生した場合は適切に処理する", () => {
      // 無効なデータ構造を渡してエラーを発生させる
      const corruptedWeapon = {
        get id() {
          throw new Error("プロパティアクセスエラー");
        },
      } as any;

      const result = generator.validateWeapon(corruptedWeapon);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "データ検証中にエラーが発生しました: プロパティアクセスエラー"
      );
    });
  });

  describe("outputWeaponFile", () => {
    beforeEach(() => {
      // fsモックをリセット
      vi.clearAllMocks();
    });

    it("正常にTypeScriptファイルを出力できる", () => {
      const weapons = [expectedWeapon];
      const outputPath = "data/weapons.ts";

      // モックの設定
      (fs.existsSync as Mock).mockReturnValue(true);

      // テスト実行
      generator.outputWeaponFile(weapons, outputPath);

      // 検証
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        outputPath,
        expect.stringContaining('import { Weapon } from "../src/types";'),
        "utf-8"
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        outputPath,
        expect.stringContaining("export default ["),
        "utf-8"
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        outputPath,
        expect.stringContaining("] as Weapon[];"),
        "utf-8"
      );
    });

    it("出力ディレクトリが存在しない場合は作成する", () => {
      const weapons = [expectedWeapon];
      const outputPath = "data/weapons.ts";

      // モックの設定
      (fs.existsSync as Mock).mockReturnValue(false);

      // テスト実行
      generator.outputWeaponFile(weapons, outputPath);

      // 検証
      expect(fs.mkdirSync).toHaveBeenCalledWith("data", { recursive: true });
    });

    it("デフォルトの出力パスを使用できる", () => {
      const weapons = [expectedWeapon];

      // モックの設定
      (fs.existsSync as Mock).mockReturnValue(true);

      // テスト実行
      generator.outputWeaponFile(weapons);

      // 検証
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        "data/weapons.ts",
        expect.any(String),
        "utf-8"
      );
    });

    it("空の配列でも正常に処理できる", () => {
      const weapons: Weapon[] = [];
      const outputPath = "data/weapons.ts";

      // モックの設定
      (fs.existsSync as Mock).mockReturnValue(true);

      // テスト実行
      generator.outputWeaponFile(weapons, outputPath);

      // 検証
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        outputPath,
        expect.stringContaining("export default [\n\n] as Weapon[];"),
        "utf-8"
      );
    });

    it("音動機配列が存在しない場合はValidationErrorを投げる", () => {
      // テスト実行と検証
      expect(() => {
        generator.outputWeaponFile(null as any);
      }).toThrow(ValidationError);
      expect(() => {
        generator.outputWeaponFile(null as any);
      }).toThrow("出力するWeaponオブジェクト配列が存在しません");
    });

    it("出力パスが無効な場合はValidationErrorを投げる", () => {
      const weapons = [expectedWeapon];

      // テスト実行と検証
      expect(() => {
        generator.outputWeaponFile(weapons, "");
      }).toThrow(ValidationError);
      expect(() => {
        generator.outputWeaponFile(weapons, "");
      }).toThrow("出力ファイルパスが無効です");
    });

    it("ファイル書き込みに失敗した場合はParsingErrorを投げる", () => {
      const weapons = [expectedWeapon];
      const outputPath = "data/weapons.ts";

      // モックの設定
      (fs.existsSync as Mock).mockReturnValue(true);
      (fs.writeFileSync as Mock).mockImplementation(() => {
        throw new Error("書き込み失敗");
      });

      // テスト実行と検証
      expect(() => {
        generator.outputWeaponFile(weapons, outputPath);
      }).toThrow(ParsingError);
      expect(() => {
        generator.outputWeaponFile(weapons, outputPath);
      }).toThrow('ファイル "data/weapons.ts" の書き込みに失敗しました');
    });

    it("文字列エスケープが正しく動作する", () => {
      const weaponWithSpecialChars = {
        ...expectedWeapon,
        name: { ja: 'テスト"音動機', en: 'Test\n"Weapon' },
        equipmentSkillName: { ja: "テスト\rスキル", en: "Test Skill" },
      };
      const weapons = [weaponWithSpecialChars];

      // モックの設定
      (fs.existsSync as Mock).mockReturnValue(true);
      (fs.writeFileSync as Mock).mockImplementation(() => {}); // 成功をシミュレート

      // テスト実行
      generator.outputWeaponFile(weapons);

      // 検証
      const writeCall = (fs.writeFileSync as Mock).mock.calls[0];
      const fileContent = writeCall[1];

      expect(fileContent).toContain('テスト\\"音動機');
      expect(fileContent).toContain('Test\\n\\"Weapon');
      expect(fileContent).toContain("テスト\\rスキル");
    });

    it("複数の音動機を正しくフォーマットする", () => {
      const weapon2 = {
        ...expectedWeapon,
        id: 902,
        name: { ja: "テスト音動機2", en: "Test Weapon 2" },
      };
      const weapons = [expectedWeapon, weapon2];

      // モックの設定
      (fs.existsSync as Mock).mockReturnValue(true);
      (fs.writeFileSync as Mock).mockImplementation(() => {}); // 成功をシミュレート

      // テスト実行
      generator.outputWeaponFile(weapons);

      // 検証
      const writeCall = (fs.writeFileSync as Mock).mock.calls[0];
      const fileContent = writeCall[1];

      expect(fileContent).toContain("id: 901");
      expect(fileContent).toContain("id: 902");
      expect(fileContent).toContain("テスト音動機");
      expect(fileContent).toContain("テスト音動機2");
    });

    it("importパスが出力ファイルの位置に応じて調整される", () => {
      const weapons = [expectedWeapon];
      const outputPath = "output/weapons.ts";

      // モックの設定
      (fs.existsSync as Mock).mockReturnValue(true);
      (fs.writeFileSync as Mock).mockImplementation(() => {}); // 成功をシミュレート

      // テスト実行
      generator.outputWeaponFile(weapons, outputPath);

      // 検証
      const writeCall = (fs.writeFileSync as Mock).mock.calls[0];
      const fileContent = writeCall[1];

      expect(fileContent).toContain('import { Weapon } from "./src/types";');
    });
  });

  describe("private methods", () => {
    describe("formatWeaponArray", () => {
      it("空配列の場合は空文字列を返す", () => {
        const result = (generator as any).formatWeaponArray([]);
        expect(result).toBe("");
      });

      it("nullまたはundefinedの場合は空文字列を返す", () => {
        expect((generator as any).formatWeaponArray(null)).toBe("");
        expect((generator as any).formatWeaponArray(undefined)).toBe("");
      });
    });

    describe("formatWeaponObject", () => {
      it("音動機オブジェクトを正しくフォーマットする", () => {
        const result = (generator as any).formatWeaponObject(expectedWeapon);

        expect(result).toContain("id: 901");
        expect(result).toContain(
          'name: { ja: "テスト音動機", en: "Test Weapon" }'
        );
        expect(result).toContain('rarity: "S"');
        expect(result).toContain('specialty: "attack"');
        expect(result).toContain('stats: ["physical"]');
        expect(result).toContain('agentId: "lycaon"');
        expect(result).toContain('baseAttr: "atk"');
        expect(result).toContain('advancedAttr: "critRate"');
      });

      it("stats配列を正しくフォーマットする", () => {
        const weaponWithMultipleStats = {
          ...expectedWeapon,
          stats: ["physical", "fire"] as Stats[],
        };

        const result = (generator as any).formatWeaponObject(
          weaponWithMultipleStats
        );

        expect(result).toContain('stats: ["physical", "fire"]');
      });

      it("stats が配列でない場合も処理できる（後方互換性）", () => {
        const weaponWithSingleStat = {
          ...expectedWeapon,
          stats: "physical" as any,
        };

        const result = (generator as any).formatWeaponObject(
          weaponWithSingleStat
        );

        expect(result).toContain('stats: ["physical"]');
      });
    });

    describe("escapeString", () => {
      it("ダブルクォートを正しくエスケープする", () => {
        const result = (generator as any).escapeString('テスト"文字列');
        expect(result).toBe('テスト\\"文字列');
      });

      it("改行文字を正しくエスケープする", () => {
        const result = (generator as any).escapeString("テスト\n文字列");
        expect(result).toBe("テスト\\n文字列");
      });

      it("キャリッジリターンを正しくエスケープする", () => {
        const result = (generator as any).escapeString("テスト\r文字列");
        expect(result).toBe("テスト\\r文字列");
      });

      it("文字列でない場合は空文字列を返す", () => {
        expect((generator as any).escapeString(null)).toBe("");
        expect((generator as any).escapeString(undefined)).toBe("");
        expect((generator as any).escapeString(123)).toBe("");
      });

      it("複数の特殊文字を同時にエスケープする", () => {
        const result = (generator as any).escapeString(
          'テスト"文字列\n改行\r復帰'
        );
        expect(result).toBe('テスト\\"文字列\\n改行\\r復帰');
      });
    });
  });
});
