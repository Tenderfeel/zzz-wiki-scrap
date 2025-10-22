import { describe, test, expect, beforeEach } from "vitest";
import { WeaponAttributeExtractor } from "../../src/extractors/WeaponAttributeExtractor";
import { WeaponAttributeProcessor } from "../../src/processors/WeaponAttributeProcessor";
import { AttributeMapper } from "../../src/mappers/AttributeMapper";
import { AttributePatterns } from "../../src/utils/AttributePatterns";
import { Weapon, EnhancedWeapon, Stats } from "../../src/types";

describe("WeaponAttributeExtraction Integration", () => {
  let extractor: WeaponAttributeExtractor;
  let processor: WeaponAttributeProcessor;

  beforeEach(() => {
    extractor = new WeaponAttributeExtractor();
    processor = new WeaponAttributeProcessor(extractor);
  });

  describe("エンドツーエンド属性抽出", () => {
    test("実際の武器データから属性を正しく抽出できること", () => {
      const realWeaponData: Weapon = {
        id: 936,
        name: { ja: "燔火の朧夜", en: "燔火の朧夜" },
        equipmentSkillName: { ja: "籠中の炎", en: "籠中の炎" },
        equipmentSkillDesc: {
          ja: "装備者が与える炎属性ダメージ+15/17.25/19.5/21.75/24%。装備者のHPがダウンした時、会心率+15/17.25/19.5/21.75/24%、継続時間5秒。",
          en: "Fire damage +15/17.25/19.5/21.75/24%. When HP is down, crit rate +15/17.25/19.5/21.75/24% for 5 seconds.",
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
        stats: ["physical"], // 既存の属性データ
        agentId: "manato",
        baseAttr: "atk",
        advancedAttr: "critRate",
      };

      // エンドツーエンドでの処理
      const enhancedWeapon = processor.processWeapon(realWeaponData);

      expect(enhancedWeapon.extractedAttributes).toContain("fire");
      expect(enhancedWeapon.id).toBe(realWeaponData.id);
      expect(enhancedWeapon.name).toEqual(realWeaponData.name);
    });

    test("複数属性を含む武器データの完全な処理フローが動作すること", () => {
      const multiAttributeWeapon: Weapon = {
        id: 999,
        name: { ja: "テスト武器", en: "Test Weapon" },
        equipmentSkillName: { ja: "テストスキル", en: "Test Skill" },
        equipmentSkillDesc: {
          ja: "炎属性ダメージと氷属性ダメージの会心ダメージ+1.5%。電気属性による追加効果も発動。",
          en: "Fire and ice damage crit damage +1.5%. Electric attribute additional effect also activates.",
        },
        rarity: "S",
        attr: {
          hp: [15, 20, 25, 30, 35, 40, 40],
          atk: [50, 170, 290, 410, 530, 650, 725],
          def: [0, 0, 0, 0, 0, 0, 0],
          impact: [0, 0, 0, 0, 0, 0, 0],
          critRate: [0, 0, 0, 0, 0, 0, 0],
          critDmg: [0, 0, 0, 0, 0, 0, 0],
          anomalyMastery: [0, 0, 0, 0, 0, 0, 0],
          anomalyProficiency: [0, 0, 0, 0, 0, 0, 0],
          penRatio: [0, 0, 0, 0, 0, 0, 0],
          energy: [0, 0, 0, 0, 0, 0, 0],
        },
        specialty: "attack",
        stats: ["fire", "ice", "electric"],
        agentId: "test",
        baseAttr: "atk",
        advancedAttr: "critDmg",
      };

      const enhancedWeapon = processor.processWeapon(multiAttributeWeapon);

      expect(enhancedWeapon.extractedAttributes).toContain("fire");
      expect(enhancedWeapon.extractedAttributes).toContain("ice");
      expect(enhancedWeapon.extractedAttributes).toContain("electric");
      expect(enhancedWeapon.extractedAttributes).toHaveLength(3);
    });

    test("バッチ処理で複数武器を効率的に処理できること", () => {
      const weapons: Weapon[] = [
        {
          id: 1001,
          name: { ja: "炎の剣", en: "Fire Sword" },
          equipmentSkillName: { ja: "炎の力", en: "Fire Power" },
          equipmentSkillDesc: {
            ja: "装備者が与える炎属性ダメージ+20%",
            en: "Fire damage +20%",
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
          specialty: "attack",
          stats: ["fire"],
          agentId: "test1",
          baseAttr: "atk",
          advancedAttr: "critRate",
        },
        {
          id: 1002,
          name: { ja: "氷の槍", en: "Ice Spear" },
          equipmentSkillName: { ja: "氷の力", en: "Ice Power" },
          equipmentSkillDesc: {
            ja: "装備者が与える氷属性ダメージ+25%",
            en: "Ice damage +25%",
          },
          rarity: "S",
          attr: {
            hp: [12, 15.6, 19.2, 22.8, 26.4, 30, 30],
            atk: [48, 166, 284, 402, 520, 638, 713],
            def: [0, 0, 0, 0, 0, 0, 0],
            impact: [0, 0, 0, 0, 0, 0, 0],
            critRate: [0, 0, 0, 0, 0, 0, 0],
            critDmg: [0, 0, 0, 0, 0, 0, 0],
            anomalyMastery: [0, 0, 0, 0, 0, 0, 0],
            anomalyProficiency: [0, 0, 0, 0, 0, 0, 0],
            penRatio: [0, 0, 0, 0, 0, 0, 0],
            energy: [0, 0, 0, 0, 0, 0, 0],
          },
          specialty: "stun",
          stats: ["ice"],
          agentId: "test2",
          baseAttr: "atk",
          advancedAttr: "critDmg",
        },
        {
          id: 1003,
          name: { ja: "無属性武器", en: "Non-Attribute Weapon" },
          equipmentSkillName: { ja: "汎用スキル", en: "Generic Skill" },
          equipmentSkillDesc: {
            ja: "装備者の攻撃力+15%",
            en: "Attack +15%",
          },
          rarity: "A",
          attr: {
            hp: [8, 10, 12, 14, 16, 18, 18],
            atk: [40, 138, 236, 334, 432, 530, 592],
            def: [0, 0, 0, 0, 0, 0, 0],
            impact: [0, 0, 0, 0, 0, 0, 0],
            critRate: [0, 0, 0, 0, 0, 0, 0],
            critDmg: [0, 0, 0, 0, 0, 0, 0],
            anomalyMastery: [0, 0, 0, 0, 0, 0, 0],
            anomalyProficiency: [0, 0, 0, 0, 0, 0, 0],
            penRatio: [0, 0, 0, 0, 0, 0, 0],
            energy: [0, 0, 0, 0, 0, 0, 0],
          },
          specialty: "support",
          stats: [],
          agentId: "test3",
          baseAttr: "atk",
          advancedAttr: "energy",
        },
      ];

      const result = processor.processWeapons(weapons);

      expect(result.successful).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      expect(result.statistics.successRate).toBe(100);

      // 個別の結果を確認
      const fireWeapon = result.successful.find((w) => w.id === 1001);
      const iceWeapon = result.successful.find((w) => w.id === 1002);
      const noAttrWeapon = result.successful.find((w) => w.id === 1003);

      expect(fireWeapon?.extractedAttributes).toEqual(["fire"]);
      expect(iceWeapon?.extractedAttributes).toEqual(["ice"]);
      expect(noAttrWeapon?.extractedAttributes).toEqual([]);
    });

    test("エラー処理とリカバリが適切に動作すること", () => {
      const weapons: Weapon[] = [
        {
          id: 2001,
          name: { ja: "正常な武器", en: "Normal Weapon" },
          equipmentSkillName: { ja: "正常スキル", en: "Normal Skill" },
          equipmentSkillDesc: {
            ja: "装備者が与える炎属性ダメージ+20%",
            en: "Fire damage +20%",
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
          specialty: "attack",
          stats: ["fire"],
          agentId: "normal",
          baseAttr: "atk",
          advancedAttr: "critRate",
        },
        null as any, // 無効な武器データ
        {
          id: 2002,
          name: { ja: "別の正常な武器", en: "Another Normal Weapon" },
          equipmentSkillName: { ja: "別のスキル", en: "Another Skill" },
          equipmentSkillDesc: {
            ja: "装備者が与える氷属性ダメージ+25%",
            en: "Ice damage +25%",
          },
          rarity: "S",
          attr: {
            hp: [12, 15.6, 19.2, 22.8, 26.4, 30, 30],
            atk: [48, 166, 284, 402, 520, 638, 713],
            def: [0, 0, 0, 0, 0, 0, 0],
            impact: [0, 0, 0, 0, 0, 0, 0],
            critRate: [0, 0, 0, 0, 0, 0, 0],
            critDmg: [0, 0, 0, 0, 0, 0, 0],
            anomalyMastery: [0, 0, 0, 0, 0, 0, 0],
            anomalyProficiency: [0, 0, 0, 0, 0, 0, 0],
            penRatio: [0, 0, 0, 0, 0, 0, 0],
            energy: [0, 0, 0, 0, 0, 0, 0],
          },
          specialty: "stun",
          stats: ["ice"],
          agentId: "another",
          baseAttr: "atk",
          advancedAttr: "critDmg",
        },
      ];

      const result = processor.processWeapons(weapons, true); // continueOnError = true

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.statistics.totalProcessed).toBe(3);
      expect(result.statistics.successRate).toBeCloseTo(66.67, 1);

      // 成功した武器の属性が正しく抽出されていることを確認
      const normalWeapon = result.successful.find((w) => w.id === 2001);
      const anotherWeapon = result.successful.find((w) => w.id === 2002);

      expect(normalWeapon?.extractedAttributes).toEqual(["fire"]);
      expect(anotherWeapon?.extractedAttributes).toEqual(["ice"]);

      // 失敗した武器の情報が記録されていることを確認
      expect(result.failed[0].weaponId).toBe(0);
      expect(result.failed[0].error).toContain("武器データがnull");
    });
  });

  describe("パフォーマンステスト", () => {
    test("大量の武器データを効率的に処理できること", () => {
      // 100個の武器データを生成
      const weapons: Weapon[] = Array.from({ length: 100 }, (_, index) => ({
        id: 3000 + index,
        name: { ja: `テスト武器${index}`, en: `Test Weapon ${index}` },
        equipmentSkillName: { ja: `スキル${index}`, en: `Skill ${index}` },
        equipmentSkillDesc: {
          ja:
            index % 5 === 0
              ? "装備者が与える炎属性ダメージ+20%"
              : index % 5 === 1
              ? "装備者が与える氷属性ダメージ+20%"
              : index % 5 === 2
              ? "装備者が与える電気属性ダメージ+20%"
              : index % 5 === 3
              ? "装備者が与える物理属性ダメージ+20%"
              : "装備者が与えるエーテル属性ダメージ+20%",
          en: `Damage +20%`,
        },
        rarity: index % 2 === 0 ? "A" : "S",
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
        specialty: "attack",
        stats: [
          index % 5 === 0
            ? "fire"
            : index % 5 === 1
            ? "ice"
            : index % 5 === 2
            ? "electric"
            : index % 5 === 3
            ? "physical"
            : "ether",
        ],
        agentId: `test${index}`,
        baseAttr: "atk",
        advancedAttr: "critRate",
      }));

      const startTime = Date.now();
      const result = processor.processWeapons(weapons);
      const endTime = Date.now();

      const processingTime = endTime - startTime;

      expect(result.successful).toHaveLength(100);
      expect(result.failed).toHaveLength(0);
      expect(result.statistics.successRate).toBe(100);
      expect(processingTime).toBeLessThan(5000); // 5秒以内で完了

      // 各属性が正しく抽出されていることを確認
      const fireWeapons = result.successful.filter((w) =>
        w.extractedAttributes.includes("fire")
      );
      const iceWeapons = result.successful.filter((w) =>
        w.extractedAttributes.includes("ice")
      );
      const electricWeapons = result.successful.filter((w) =>
        w.extractedAttributes.includes("electric")
      );
      const physicalWeapons = result.successful.filter((w) =>
        w.extractedAttributes.includes("physical")
      );
      const etherWeapons = result.successful.filter((w) =>
        w.extractedAttributes.includes("ether")
      );

      expect(fireWeapons).toHaveLength(20);
      expect(iceWeapons).toHaveLength(20);
      expect(electricWeapons).toHaveLength(20);
      expect(physicalWeapons).toHaveLength(20);
      expect(etherWeapons).toHaveLength(20);
    });
  });

  describe("コンポーネント間の連携", () => {
    test("AttributePatternsとAttributeMapperが正しく連携すること", () => {
      const testText = "炎属性ダメージと氷属性ダメージの会心ダメージ+1.5%";

      // AttributePatternsで日本語属性を検出
      const japaneseAttributes =
        AttributePatterns.findAttributePatterns(testText);
      expect(japaneseAttributes).toContain("炎属性");
      expect(japaneseAttributes).toContain("氷属性");

      // AttributeMapperで英語に変換
      const englishAttributes =
        AttributeMapper.mapMultipleToEnglish(japaneseAttributes);
      expect(englishAttributes).toContain("fire");
      expect(englishAttributes).toContain("ice");

      // WeaponAttributeExtractorで統合処理
      const extractedAttributes = extractor.extractAttributes(testText, "ja");
      expect(extractedAttributes).toEqual(englishAttributes);
    });

    test("全コンポーネントが統合されて正しく動作すること", () => {
      const weapon: Weapon = {
        id: 4000,
        name: { ja: "統合テスト武器", en: "Integration Test Weapon" },
        equipmentSkillName: { ja: "統合スキル", en: "Integration Skill" },
        equipmentSkillDesc: {
          ja: "装備者が与える炎属性ダメージ+20%。氷属性による追加効果も発動。",
          en: "Fire damage +20%. Ice attribute additional effect also activates.",
        },
        rarity: "S",
        attr: {
          hp: [15, 20, 25, 30, 35, 40, 40],
          atk: [50, 170, 290, 410, 530, 650, 725],
          def: [0, 0, 0, 0, 0, 0, 0],
          impact: [0, 0, 0, 0, 0, 0, 0],
          critRate: [0, 0, 0, 0, 0, 0, 0],
          critDmg: [0, 0, 0, 0, 0, 0, 0],
          anomalyMastery: [0, 0, 0, 0, 0, 0, 0],
          anomalyProficiency: [0, 0, 0, 0, 0, 0, 0],
          penRatio: [0, 0, 0, 0, 0, 0, 0],
          energy: [0, 0, 0, 0, 0, 0, 0],
        },
        specialty: "attack",
        stats: ["fire", "ice"],
        agentId: "integration",
        baseAttr: "atk",
        advancedAttr: "critDmg",
      };

      // 1. パターン検出のテスト
      const patterns = AttributePatterns.findAttributePatterns(
        weapon.equipmentSkillDesc.ja
      );
      expect(patterns).toContain("炎属性");
      expect(patterns).toContain("氷属性");

      // 2. マッピングのテスト
      const mapped = AttributeMapper.mapMultipleToEnglish(patterns);
      expect(mapped).toContain("fire");
      expect(mapped).toContain("ice");

      // 3. 抽出のテスト
      const extracted = extractor.extractFromMultiLang(
        weapon.equipmentSkillDesc
      );
      expect(extracted).toContain("fire");
      expect(extracted).toContain("ice");

      // 4. 処理のテスト
      const processed = processor.processWeapon(weapon);
      expect(processed.extractedAttributes).toContain("fire");
      expect(processed.extractedAttributes).toContain("ice");

      // 5. バリデーションのテスト
      const validation = processor.validateExtraction(
        weapon,
        processed.extractedAttributes
      );
      expect(validation.isValid).toBe(true);
    });
  });
});
