import { describe, test, expect, beforeEach } from "vitest";
import { WeaponAttributeProcessor } from "../../src/processors/WeaponAttributeProcessor";
import { WeaponAttributeExtractor } from "../../src/extractors/WeaponAttributeExtractor";
import { Weapon, EnhancedWeapon, Stats } from "../../src/types";

describe("WeaponAttributeProcessor", () => {
  let processor: WeaponAttributeProcessor;
  let mockWeapon: Weapon;

  beforeEach(() => {
    processor = new WeaponAttributeProcessor();

    mockWeapon = {
      id: 936,
      name: { ja: "燔火の朧夜", en: "燔火の朧夜" },
      equipmentSkillName: { ja: "籠中の炎", en: "籠中の炎" },
      equipmentSkillDesc: {
        ja: "装備者が与える炎属性ダメージ+15%。装備者のHPがダウンした時、会心率+15%、継続時間5秒。",
        en: "Fire damage +15%. When HP is down, crit rate +15% for 5 seconds.",
      },
      rarity: "A",
      attr: {
        hp: [10, 13, 16, 19, 22, 25, 25],
        atk: [42, 145, 248, 352, 455, 558, 624],
        def: [0, 0, 0, 0, 0, 0, 0],
        impact: [0, 0, 0, 0, 0, 0, 0],
        critRate: [0, 0, 0, 0, 0, 0, 0],
        critDmg: [0, 0, 0, 0, 0, 0, 0],
        anomalyMastery: [0, 0, 0, 0, 0, 0, 0],
        anomalyProficiency: [0, 0, 0, 0, 0, 0, 0],
        penRatio: [0, 0, 0, 0, 0, 0, 0],
        energy: [0, 0, 0, 0, 0, 0, 0],
      },
      specialty: "rupture",
      stats: ["fire"],
      agentId: "manato",
      baseAttr: "atk",
      advancedAttr: "critRate",
    };
  });

  describe("processWeapon", () => {
    test("炎属性を含む武器データを正しく処理できること", () => {
      const result = processor.processWeapon(mockWeapon);

      expect(result).toHaveProperty("extractedAttributes");
      expect(result.extractedAttributes).toContain("fire");
      expect(result.id).toBe(mockWeapon.id);
      expect(result.name).toEqual(mockWeapon.name);
    });

    test("複数属性を含む武器データを正しく処理できること", () => {
      const multiAttributeWeapon: Weapon = {
        ...mockWeapon,
        equipmentSkillDesc: {
          ja: "炎属性ダメージと氷属性ダメージの会心ダメージ+1.5%",
          en: "Fire and ice damage crit damage +1.5%",
        },
        stats: ["fire", "ice"],
      };

      const result = processor.processWeapon(multiAttributeWeapon);

      expect(result.extractedAttributes).toContain("fire");
      expect(result.extractedAttributes).toContain("ice");
      expect(result.extractedAttributes).toHaveLength(2);
    });

    test("属性情報がない武器データでは空配列を返すこと", () => {
      const noAttributeWeapon: Weapon = {
        ...mockWeapon,
        equipmentSkillDesc: {
          ja: "装備者の攻撃力+10%",
          en: "Attack +10%",
        },
        stats: [],
      };

      const result = processor.processWeapon(noAttributeWeapon);

      expect(result.extractedAttributes).toEqual([]);
    });

    test("スキル説明が空の武器データでは空配列を返すこと", () => {
      const emptySkillWeapon: Weapon = {
        ...mockWeapon,
        equipmentSkillDesc: {
          ja: "",
          en: "",
        },
      };

      const result = processor.processWeapon(emptySkillWeapon);

      expect(result.extractedAttributes).toEqual([]);
    });

    test("既存の武器データ構造を保持すること", () => {
      const result = processor.processWeapon(mockWeapon);

      // 既存のプロパティが保持されていることを確認
      expect(result.id).toBe(mockWeapon.id);
      expect(result.name).toEqual(mockWeapon.name);
      expect(result.equipmentSkillName).toEqual(mockWeapon.equipmentSkillName);
      expect(result.equipmentSkillDesc).toEqual(mockWeapon.equipmentSkillDesc);
      expect(result.rarity).toBe(mockWeapon.rarity);
      expect(result.attr).toEqual(mockWeapon.attr);
      expect(result.specialty).toBe(mockWeapon.specialty);
      expect(result.stats).toEqual(mockWeapon.stats);
      expect(result.agentId).toBe(mockWeapon.agentId);
      expect(result.baseAttr).toBe(mockWeapon.baseAttr);
      expect(result.advancedAttr).toBe(mockWeapon.advancedAttr);

      // 新しいプロパティが追加されていることを確認
      expect(result).toHaveProperty("extractedAttributes");
    });

    test("無効な武器データではエラーをスローすること", () => {
      expect(() => processor.processWeapon(null as any)).toThrow();
      expect(() => processor.processWeapon(undefined as any)).toThrow();
      expect(() => processor.processWeapon({} as any)).toThrow();
    });
  });

  describe("processWeapons", () => {
    test("複数の武器データを一括処理できること", () => {
      const weapons: Weapon[] = [
        mockWeapon,
        {
          ...mockWeapon,
          id: 937,
          name: { ja: "氷の武器", en: "Ice Weapon" },
          equipmentSkillDesc: {
            ja: "装備者が与える氷属性ダメージ+20%",
            en: "Ice damage +20%",
          },
          stats: ["ice"],
        },
      ];

      const result = processor.processWeapons(weapons);

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.statistics.totalProcessed).toBe(2);
      expect(result.statistics.successful).toBe(2);
      expect(result.statistics.failed).toBe(0);
      expect(result.statistics.successRate).toBe(100);
    });

    test("一部の武器処理が失敗しても他の武器の処理を継続すること", () => {
      const weapons: Weapon[] = [
        mockWeapon,
        null as any, // 無効な武器データ
        {
          ...mockWeapon,
          id: 938,
          name: { ja: "電気の武器", en: "Electric Weapon" },
          equipmentSkillDesc: {
            ja: "装備者が与える電気属性ダメージ+25%",
            en: "Electric damage +25%",
          },
          stats: ["electric"],
        },
      ];

      const result = processor.processWeapons(weapons, true);

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.statistics.totalProcessed).toBe(3);
      expect(result.statistics.successful).toBe(2);
      expect(result.statistics.failed).toBe(1);
      expect(result.statistics.successRate).toBeCloseTo(66.67, 1);
    });

    test("空の武器配列では適切な結果を返すこと", () => {
      const result = processor.processWeapons([]);

      expect(result.successful).toEqual([]);
      expect(result.failed).toEqual([]);
      expect(result.statistics.totalProcessed).toBe(0);
      expect(result.statistics.successful).toBe(0);
      expect(result.statistics.failed).toBe(0);
      expect(result.statistics.successRate).toBe(0);
    });

    test("無効な武器配列ではエラーをスローすること", () => {
      expect(() => processor.processWeapons(null as any)).toThrow();
      expect(() => processor.processWeapons(undefined as any)).toThrow();
      expect(() => processor.processWeapons("invalid" as any)).toThrow();
    });

    test("continueOnError=falseの場合、エラー時に処理を中断すること", () => {
      const weapons: Weapon[] = [
        mockWeapon,
        null as any, // 無効な武器データ
        {
          ...mockWeapon,
          id: 938,
          name: { ja: "電気の武器", en: "Electric Weapon" },
        },
      ];

      expect(() => processor.processWeapons(weapons, false)).toThrow();
    });
  });

  describe("validateExtraction", () => {
    test("有効な抽出結果でバリデーションが成功すること", () => {
      const extractedAttributes: Stats[] = ["fire"];
      const result = processor.validateExtraction(
        mockWeapon,
        extractedAttributes
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("既存の属性と一致しない場合に警告を出すこと", () => {
      const extractedAttributes: Stats[] = ["ice"]; // 既存は["fire"]
      const result = processor.validateExtraction(
        mockWeapon,
        extractedAttributes
      );

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes("一致しません"))).toBe(
        true
      );
    });

    test("無効な属性が含まれる場合にエラーを出すこと", () => {
      const extractedAttributes: Stats[] = ["invalid" as Stats];
      const result = processor.validateExtraction(
        mockWeapon,
        extractedAttributes
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes("無効な属性"))).toBe(true);
    });

    test("重複した属性が含まれる場合にエラーを出すこと", () => {
      const extractedAttributes: Stats[] = ["fire", "fire"];
      const result = processor.validateExtraction(
        mockWeapon,
        extractedAttributes
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("重複"))).toBe(true);
    });

    test("空のスキル説明の場合に適切な警告を出すこと", () => {
      const emptySkillWeapon: Weapon = {
        ...mockWeapon,
        equipmentSkillDesc: { ja: "", en: "" },
      };
      const result = processor.validateExtraction(emptySkillWeapon, []);

      expect(result.warnings.some((w) => w.includes("スキル説明が空"))).toBe(
        true
      );
    });
  });

  describe("generateComparisonReport", () => {
    test("比較レポートを生成できること", () => {
      const weapons: Weapon[] = [mockWeapon];
      const report = processor.generateComparisonReport(weapons);

      expect(report).toContain("属性抽出比較レポート");
      expect(report).toContain("対象武器数: 1");
      expect(report).toContain(`武器ID: ${mockWeapon.id}`);
      expect(report).toContain("統計情報");
    });

    test("複数武器の比較レポートを生成できること", () => {
      const weapons: Weapon[] = [
        mockWeapon,
        {
          ...mockWeapon,
          id: 937,
          name: { ja: "氷の武器", en: "Ice Weapon" },
          equipmentSkillDesc: {
            ja: "装備者が与える氷属性ダメージ+20%",
            en: "Ice damage +20%",
          },
          stats: ["ice"],
        },
      ];

      const report = processor.generateComparisonReport(weapons);

      expect(report).toContain("対象武器数: 2");
      expect(report).toContain("武器ID: 936");
      expect(report).toContain("武器ID: 937");
    });

    test("空の武器配列でも適切なレポートを生成できること", () => {
      const report = processor.generateComparisonReport([]);

      expect(report).toContain("属性抽出比較レポート");
      expect(report).toContain("対象武器数: 0");
      expect(report).toContain("統計情報");
    });
  });
});
