import { describe, test, expect, beforeEach } from "vitest";
import { WeaponAttributeExtractor } from "../../src/extractors/WeaponAttributeExtractor";
import { WeaponAttributeProcessor } from "../../src/processors/WeaponAttributeProcessor";
import { Weapon, Stats, ValidationResult } from "../../src/types";

describe("WeaponAttributeValidation", () => {
  let extractor: WeaponAttributeExtractor;
  let processor: WeaponAttributeProcessor;

  beforeEach(() => {
    extractor = new WeaponAttributeExtractor();
    processor = new WeaponAttributeProcessor(extractor);
  });

  describe("抽出精度テスト", () => {
    test("明確な属性表現から正確に属性を抽出できること", () => {
      const testCases = [
        {
          description: "装備者が与える炎属性ダメージ+15%",
          expected: ["fire"],
          name: "炎属性ダメージ表現",
        },
        {
          description: "装備者が与える氷属性ダメージ+20%",
          expected: ["ice"],
          name: "氷属性ダメージ表現",
        },
        {
          description: "装備者が与える電気属性ダメージ+25%",
          expected: ["electric"],
          name: "電気属性ダメージ表現",
        },
        {
          description: "装備者が与える物理属性ダメージ+30%",
          expected: ["physical"],
          name: "物理属性ダメージ表現",
        },
        {
          description: "装備者が与えるエーテル属性ダメージ+35%",
          expected: ["ether"],
          name: "エーテル属性ダメージ表現",
        },
        {
          description: "装備者が与えるエーテル透徹ダメージ+40%",
          expected: ["ether"],
          name: "エーテル透徹ダメージ表現",
        },
      ];

      testCases.forEach(({ description, expected, name }) => {
        const result = extractor.extractAttributes(description, "ja");
        expect(result, `${name}の抽出に失敗`).toEqual(expected);
      });
    });

    test("複雑な属性表現から正確に属性を抽出できること", () => {
      const testCases = [
        {
          description: "炎属性の会心ダメージ+10%",
          expected: ["fire"],
          name: "属性の会心ダメージ表現",
        },
        {
          description: "氷属性を与えた時、追加効果発動",
          expected: ["ice"],
          name: "属性を与えた時表現",
        },
        {
          description: "電気属性で攻撃した際の特殊効果",
          expected: ["electric"],
          name: "属性で攻撃表現",
        },
        {
          description: "物理属性による継続ダメージ+5%",
          expected: ["physical"],
          name: "属性による継続ダメージ表現",
        },
        {
          description: "エーテル属性による特殊状態異常",
          expected: ["ether"],
          name: "属性による状態異常表現",
        },
      ];

      testCases.forEach(({ description, expected, name }) => {
        const result = extractor.extractAttributes(description, "ja");
        expect(result, `${name}の抽出に失敗`).toEqual(expected);
      });
    });

    test("複数属性を含む複雑な表現から正確に抽出できること", () => {
      const testCases = [
        {
          description: "炎属性ダメージと氷属性ダメージの会心ダメージ+1.5%",
          expected: ["fire", "ice"],
          name: "2属性の会心ダメージ表現",
        },
        {
          description:
            "電気属性ダメージ、物理属性ダメージ、エーテル属性ダメージのいずれかを与えた時",
          expected: ["electric", "physical", "ether"],
          name: "3属性の選択表現",
        },
        {
          description:
            "炎属性ダメージ+10%。氷属性による追加効果も発動。電気属性の会心率+5%",
          expected: ["fire", "ice", "electric"],
          name: "複数文での3属性表現",
        },
      ];

      testCases.forEach(({ description, expected, name }) => {
        const result = extractor.extractAttributes(description, "ja");
        expect(result, `${name}の抽出に失敗`).toContain(expected[0]);
        expect(result, `${name}の抽出に失敗`).toContain(expected[1]);
        if (expected[2]) {
          expect(result, `${name}の抽出に失敗`).toContain(expected[2]);
        }
        expect(result.length, `${name}の属性数が不正`).toBe(expected.length);
      });
    });

    test("属性以外のダメージ表現を誤検出しないこと", () => {
      const testCases = [
        {
          description: "装備者の攻撃力+10%",
          expected: [],
          name: "攻撃力上昇表現",
        },
        {
          description: "会心ダメージ+15%",
          expected: [],
          name: "会心ダメージ表現",
        },
        {
          description: "スキルダメージ+20%",
          expected: [],
          name: "スキルダメージ表現",
        },
        {
          description: "追加ダメージ+100",
          expected: [],
          name: "追加ダメージ表現",
        },
        {
          description: "継続ダメージ+50",
          expected: [],
          name: "継続ダメージ表現",
        },
      ];

      testCases.forEach(({ description, expected, name }) => {
        const result = extractor.extractAttributes(description, "ja");
        expect(result, `${name}で誤検出が発生`).toEqual(expected);
      });
    });
  });

  describe("エッジケーステスト", () => {
    test("同じ属性が複数回言及されても重複なく抽出できること", () => {
      const testCases = [
        {
          description:
            "炎属性ダメージ+10%。炎属性ダメージを与えた時、炎属性の会心率+5%",
          expected: ["fire"],
          name: "炎属性3回言及",
        },
        {
          description: "氷属性による攻撃。氷属性ダメージ+15%。氷属性で凍結効果",
          expected: ["ice"],
          name: "氷属性3回言及",
        },
      ];

      testCases.forEach(({ description, expected, name }) => {
        const result = extractor.extractAttributes(description, "ja");
        expect(result, `${name}で重複が発生`).toEqual(expected);
      });
    });

    test("空文字列や無効な入力を適切に処理できること", () => {
      const testCases = [
        { input: "", expected: [], name: "空文字列" },
        { input: "   ", expected: [], name: "空白のみ" },
        { input: null as any, expected: [], name: "null" },
        { input: undefined as any, expected: [], name: "undefined" },
        { input: 123 as any, expected: [], name: "数値" },
        { input: {} as any, expected: [], name: "オブジェクト" },
        { input: [] as any, expected: [], name: "配列" },
      ];

      testCases.forEach(({ input, expected, name }) => {
        const result = extractor.extractAttributes(input, "ja");
        expect(result, `${name}の処理に失敗`).toEqual(expected);
      });
    });

    test("異常に長いテキストを適切に処理できること", () => {
      const longText = "装備者が与える炎属性ダメージ+15%。".repeat(1000);
      const result = extractor.extractAttributes(longText, "ja");

      expect(result).toEqual(["fire"]);
      expect(result).toHaveLength(1); // 重複なし
    });

    test("特殊文字や記号を含むテキストを適切に処理できること", () => {
      const testCases = [
        {
          description: "装備者が与える炎属性ダメージ+15%！！！",
          expected: ["fire"],
          name: "感嘆符付き",
        },
        {
          description: "【炎属性ダメージ】+20%",
          expected: ["fire"],
          name: "括弧付き",
        },
        {
          description: "炎属性ダメージ★+25%★",
          expected: ["fire"],
          name: "星印付き",
        },
        {
          description: "炎属性ダメージ（火力強化）+30%",
          expected: ["fire"],
          name: "説明付き",
        },
      ];

      testCases.forEach(({ description, expected, name }) => {
        const result = extractor.extractAttributes(description, "ja");
        expect(result, `${name}の処理に失敗`).toEqual(expected);
      });
    });
  });

  describe("バリデーション機能テスト", () => {
    test("有効な抽出結果のバリデーションが成功すること", () => {
      const weapon: Weapon = {
        id: 5001,
        name: { ja: "テスト武器", en: "Test Weapon" },
        equipmentSkillName: { ja: "テストスキル", en: "Test Skill" },
        equipmentSkillDesc: {
          ja: "装備者が与える炎属性ダメージ+15%",
          en: "Fire damage +15%",
        },
        rarity: "A",
        attr: {
          hp: [10, 13, 16, 19, 22, 25, 25],
          atk: [42, 145, 248, 352, 455, 558, 624],
          def: [],
          impact: [],
          critRate: [],
          critDmg: [],
          anomalyMastery: [],
          anomalyProficiency: [],
          penRatio: [],
          energy: [],
        },
        specialty: "attack",
        stats: ["fire"], // 既存の属性と一致
        agentId: "test",
        baseAttr: "atk",
        advancedAttr: "critRate",
      };

      const extractedAttributes: Stats[] = ["fire"];
      const validation = processor.validateExtraction(
        weapon,
        extractedAttributes
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test("既存属性と不一致の場合に警告を出すこと", () => {
      const weapon: Weapon = {
        id: 5002,
        name: { ja: "不一致武器", en: "Mismatch Weapon" },
        equipmentSkillName: { ja: "不一致スキル", en: "Mismatch Skill" },
        equipmentSkillDesc: {
          ja: "装備者が与える炎属性ダメージ+15%",
          en: "Fire damage +15%",
        },
        rarity: "A",
        attr: {
          hp: [10, 13, 16, 19, 22, 25, 25],
          atk: [42, 145, 248, 352, 455, 558, 624],
          def: [],
          impact: [],
          critRate: [],
          critDmg: [],
          anomalyMastery: [],
          anomalyProficiency: [],
          penRatio: [],
          energy: [],
        },
        specialty: "attack",
        stats: ["ice"], // 抽出結果と不一致
        agentId: "test",
        baseAttr: "atk",
        advancedAttr: "critRate",
      };

      const extractedAttributes: Stats[] = ["fire"];
      const validation = processor.validateExtraction(
        weapon,
        extractedAttributes
      );

      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings.some((w) => w.includes("一致しません"))).toBe(
        true
      );
    });

    test("無効な属性が含まれる場合にエラーを出すこと", () => {
      const weapon: Weapon = {
        id: 5003,
        name: { ja: "無効属性武器", en: "Invalid Attribute Weapon" },
        equipmentSkillName: { ja: "無効スキル", en: "Invalid Skill" },
        equipmentSkillDesc: {
          ja: "装備者が与える炎属性ダメージ+15%",
          en: "Fire damage +15%",
        },
        rarity: "A",
        attr: {
          hp: [10, 13, 16, 19, 22, 25, 25],
          atk: [42, 145, 248, 352, 455, 558, 624],
          def: [],
          impact: [],
          critRate: [],
          critDmg: [],
          anomalyMastery: [],
          anomalyProficiency: [],
          penRatio: [],
          energy: [],
        },
        specialty: "attack",
        stats: ["fire"],
        agentId: "test",
        baseAttr: "atk",
        advancedAttr: "critRate",
      };

      const extractedAttributes: Stats[] = ["invalid" as Stats];
      const validation = processor.validateExtraction(
        weapon,
        extractedAttributes
      );

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((e) => e.includes("無効な属性"))).toBe(
        true
      );
    });

    test("重複した属性が含まれる場合にエラーを出すこと", () => {
      const weapon: Weapon = {
        id: 5004,
        name: { ja: "重複武器", en: "Duplicate Weapon" },
        equipmentSkillName: { ja: "重複スキル", en: "Duplicate Skill" },
        equipmentSkillDesc: {
          ja: "装備者が与える炎属性ダメージ+15%",
          en: "Fire damage +15%",
        },
        rarity: "A",
        attr: {
          hp: [10, 13, 16, 19, 22, 25, 25],
          atk: [42, 145, 248, 352, 455, 558, 624],
          def: [],
          impact: [],
          critRate: [],
          critDmg: [],
          anomalyMastery: [],
          anomalyProficiency: [],
          penRatio: [],
          energy: [],
        },
        specialty: "attack",
        stats: ["fire"],
        agentId: "test",
        baseAttr: "atk",
        advancedAttr: "critRate",
      };

      const extractedAttributes: Stats[] = ["fire", "fire"]; // 重複
      const validation = processor.validateExtraction(
        weapon,
        extractedAttributes
      );

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((e) => e.includes("重複"))).toBe(true);
    });
  });

  describe("詳細抽出結果のバリデーション", () => {
    test("詳細抽出結果の信頼度が適切に計算されること", () => {
      const testCases = [
        {
          description: "装備者が与える炎属性ダメージ+15%",
          expectedMinConfidence: 0.7,
          name: "単一属性明確表現",
        },
        {
          description:
            "炎属性ダメージ+10%。炎属性を与えた時、炎属性の会心率+5%",
          expectedMinConfidence: 0.8,
          name: "複数回言及",
        },
        {
          description: "炎属性ダメージと氷属性ダメージの会心ダメージ+1.5%",
          expectedMinConfidence: 0.8,
          name: "複数属性",
        },
      ];

      testCases.forEach(({ description, expectedMinConfidence, name }) => {
        const result = extractor.extractWithDetails(description, "ja");
        expect(
          result.confidence,
          `${name}の信頼度が低すぎる`
        ).toBeGreaterThanOrEqual(expectedMinConfidence);
      });
    });

    test("マッチしたパターンの詳細情報が正確であること", () => {
      const description = "炎属性ダメージ+10%。炎属性を与えた時、追加効果発動";
      const result = extractor.extractWithDetails(description, "ja");

      expect(result.attributes).toEqual(["fire"]);
      expect(result.matchedPatterns).toHaveLength(1);
      expect(result.matchedPatterns[0].attribute).toBe("fire");
      expect(result.matchedPatterns[0].matchCount).toBeGreaterThan(1);
      expect(result.matchedPatterns[0].positions).toHaveLength(
        result.matchedPatterns[0].matchCount
      );
    });

    test("警告メッセージが適切に生成されること", () => {
      const testCases = [
        {
          input: "",
          expectedWarning: "スキル説明が空です",
          name: "空文字列",
        },
        {
          input: "装備者が与える炎属性ダメージ+15%",
          language: "zh" as any,
          expectedWarning: "言語 'zh' はサポートされていません",
          name: "未サポート言語",
        },
      ];

      testCases.forEach(({ input, language = "ja", expectedWarning, name }) => {
        const result = extractor.extractWithDetails(input, language);
        expect(
          result.warnings,
          `${name}で期待される警告が出力されない`
        ).toContain(expectedWarning);
      });
    });
  });

  describe("実データでの精度テスト", () => {
    test("実際の武器データサンプルで高い精度を維持できること", () => {
      const realWeaponSamples = [
        {
          weapon: {
            id: 936,
            name: { ja: "燔火の朧夜", en: "燔火の朧夜" },
            equipmentSkillDesc: {
              ja: "装備者が与える炎属性ダメージ+15/17.25/19.5/21.75/24%。装備者のHPがダウンした時、会心率+15/17.25/19.5/21.75/24%、継続時間5秒。",
              en: "Fire damage +15/17.25/19.5/21.75/24%. When HP is down, crit rate +15/17.25/19.5/21.75/24% for 5 seconds.",
            },
            stats: ["physical"], // 既存データ
          },
          expectedExtracted: ["fire"],
          shouldMatch: false, // 既存データと抽出結果が異なる
        },
        {
          weapon: {
            id: 935,
            name: { ja: "炉で歌い上げられる夢", en: "炉で歌い上げられる夢" },
            equipmentSkillDesc: {
              ja: "装備者のエネルギー自動回復+0.4/0.46/0.52/0.58/0.64Pt/秒。装備者が「エーテルベール」を発動、または「エーテルベール」の継続時間を延長した時、メンバー全員の与ダメージ+25/28.8/32.5/36.3/40%、HP上限+15/17.3/19.5/21.8/24%、継続時間45秒。重複して発動すると継続時間が更新される、該当効果はチーム内でひとつしか有効にならない。",
              en: "Energy recovery +0.4/0.46/0.52/0.58/0.64Pt/s. When Ether Veil is activated or extended, all members damage +25/28.8/32.5/36.3/40%, HP +15/17.3/19.5/21.8/24% for 45s.",
            },
            stats: ["physical"], // 既存データ
          },
          expectedExtracted: [], // エーテルベールは属性ダメージではない
          shouldMatch: false,
        },
      ];

      realWeaponSamples.forEach(
        ({ weapon, expectedExtracted, shouldMatch }, index) => {
          const mockWeapon: Weapon = {
            ...weapon,
            equipmentSkillName: { ja: "テストスキル", en: "Test Skill" },
            rarity: "A",
            attr: {
              hp: [10, 13, 16, 19, 22, 25, 25],
              atk: [42, 145, 248, 352, 455, 558, 624],
              def: [],
              impact: [],
              critRate: [],
              critDmg: [],
              anomalyMastery: [],
              anomalyProficiency: [],
              penRatio: [],
              energy: [],
            },
            specialty: "attack",
            agentId: "test",
            baseAttr: "atk",
            advancedAttr: "critRate",
          };

          const extracted = extractor.extractFromMultiLang(
            mockWeapon.equipmentSkillDesc
          );

          if (expectedExtracted.length === 0) {
            expect(
              extracted,
              `サンプル${index + 1}: 属性が誤検出された`
            ).toEqual([]);
          } else {
            expectedExtracted.forEach((attr) => {
              expect(
                extracted,
                `サンプル${index + 1}: ${attr}属性が抽出されない`
              ).toContain(attr);
            });
          }

          // バリデーションテスト
          const validation = processor.validateExtraction(
            mockWeapon,
            extracted
          );
          if (shouldMatch) {
            expect(
              validation.warnings.length,
              `サンプル${index + 1}: 一致すべきなのに警告が出た`
            ).toBe(0);
          } else {
            // 不一致の場合は警告が出ることを期待（ただし、抽出結果が空の場合は除く）
            if (extracted.length > 0) {
              expect(
                validation.warnings.length,
                `サンプル${index + 1}: 不一致なのに警告が出ない`
              ).toBeGreaterThan(0);
            }
          }
        }
      );
    });
  });
});
