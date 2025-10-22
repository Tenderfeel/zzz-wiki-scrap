import { describe, test, expect, beforeEach } from "vitest";
import { WeaponAttributeExtractor } from "../../src/extractors/WeaponAttributeExtractor";
import { Stats, Lang } from "../../src/types";

describe("WeaponAttributeExtractor", () => {
  let extractor: WeaponAttributeExtractor;

  beforeEach(() => {
    extractor = new WeaponAttributeExtractor();
  });

  describe("extractAttributes", () => {
    test("炎属性ダメージを含むスキル説明から炎属性を抽出できること", () => {
      const skillDesc = "装備者が与える炎属性ダメージ+15%";
      const result = extractor.extractAttributes(skillDesc, "ja");
      expect(result).toEqual(["fire"]);
    });

    test("氷属性ダメージを含むスキル説明から氷属性を抽出できること", () => {
      const skillDesc = "装備者が与える氷属性ダメージ+20%";
      const result = extractor.extractAttributes(skillDesc, "ja");
      expect(result).toEqual(["ice"]);
    });

    test("電気属性ダメージを含むスキル説明から電気属性を抽出できること", () => {
      const skillDesc = "装備者が与える電気属性ダメージ+25%";
      const result = extractor.extractAttributes(skillDesc, "ja");
      expect(result).toEqual(["electric"]);
    });

    test("物理属性ダメージを含むスキル説明から物理属性を抽出できること", () => {
      const skillDesc = "装備者が与える物理属性ダメージ+30%";
      const result = extractor.extractAttributes(skillDesc, "ja");
      expect(result).toEqual(["physical"]);
    });

    test("エーテル属性ダメージを含むスキル説明からエーテル属性を抽出できること", () => {
      const skillDesc = "装備者が与えるエーテル属性ダメージ+35%";
      const result = extractor.extractAttributes(skillDesc, "ja");
      expect(result).toEqual(["ether"]);
    });

    test("複数の属性を含むスキル説明から全ての属性を抽出できること", () => {
      const skillDesc = "氷属性ダメージと炎属性ダメージの会心ダメージ+1.5%";
      const result = extractor.extractAttributes(skillDesc, "ja");
      expect(result).toContain("ice");
      expect(result).toContain("fire");
      expect(result).toHaveLength(2);
    });

    test("同じ属性が複数回言及されても重複なく抽出できること", () => {
      const skillDesc =
        "炎属性ダメージ+10%。炎属性ダメージを与えた時、追加効果発動";
      const result = extractor.extractAttributes(skillDesc, "ja");
      expect(result).toEqual(["fire"]);
    });

    test("属性情報がないスキル説明では空配列を返すこと", () => {
      const skillDesc = "装備者の攻撃力+10%";
      const result = extractor.extractAttributes(skillDesc, "ja");
      expect(result).toEqual([]);
    });

    test("空のスキル説明では空配列を返すこと", () => {
      const result = extractor.extractAttributes("", "ja");
      expect(result).toEqual([]);
    });

    test("nullまたはundefinedのスキル説明では空配列を返すこと", () => {
      const result1 = extractor.extractAttributes(null as any, "ja");
      const result2 = extractor.extractAttributes(undefined as any, "ja");
      expect(result1).toEqual([]);
      expect(result2).toEqual([]);
    });

    test("英語言語指定では空配列を返すこと（現在未サポート）", () => {
      const skillDesc = "Fire damage +15%";
      const result = extractor.extractAttributes(skillDesc, "en");
      expect(result).toEqual([]);
    });

    test("不正な言語指定では空配列を返すこと", () => {
      const skillDesc = "装備者が与える炎属性ダメージ+15%";
      const result = extractor.extractAttributes(skillDesc, "zh" as Lang);
      expect(result).toEqual([]);
    });
  });

  describe("extractFromMultiLang", () => {
    test("日本語スキル説明から属性を抽出できること", () => {
      const skillDesc = {
        ja: "装備者が与える炎属性ダメージ+15%",
        en: "Fire damage +15%",
      };
      const result = extractor.extractFromMultiLang(skillDesc);
      expect(result).toEqual(["fire"]);
    });

    test("複数言語で同じ属性が含まれても重複なく抽出できること", () => {
      const skillDesc = {
        ja: "装備者が与える炎属性ダメージ+15%",
        en: "装備者が与える炎属性ダメージ+15%", // 日本語のまま
      };
      const result = extractor.extractFromMultiLang(skillDesc);
      expect(result).toEqual(["fire"]);
    });

    test("異なる言語で異なる属性が含まれる場合、日本語のみから抽出できること", () => {
      const skillDesc = {
        ja: "装備者が与える炎属性ダメージ+15%",
        en: "Ice damage +15%", // 英語は現在未サポート
      };
      const result = extractor.extractFromMultiLang(skillDesc);
      expect(result).toContain("fire");
      expect(result).toHaveLength(1); // 日本語のみから抽出
    });

    test("空のスキル説明オブジェクトでは空配列を返すこと", () => {
      const skillDesc = { ja: "", en: "" };
      const result = extractor.extractFromMultiLang(skillDesc);
      expect(result).toEqual([]);
    });

    test("nullまたはundefinedのスキル説明オブジェクトでは空配列を返すこと", () => {
      const result1 = extractor.extractFromMultiLang(null as any);
      const result2 = extractor.extractFromMultiLang(undefined as any);
      expect(result1).toEqual([]);
      expect(result2).toEqual([]);
    });
  });

  describe("extractWithDetails", () => {
    test("属性抽出の詳細情報を取得できること", () => {
      const skillDesc = "装備者が与える炎属性ダメージ+15%";
      const result = extractor.extractWithDetails(skillDesc, "ja");

      expect(result.attributes).toEqual(["fire"]);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.matchedPatterns).toHaveLength(1);
      expect(result.matchedPatterns[0].attribute).toBe("fire");
      expect(result.matchedPatterns[0].matchCount).toBeGreaterThan(0);
      expect(result.warnings).toEqual([]);
    });

    test("複数属性の詳細情報を取得できること", () => {
      const skillDesc = "氷属性ダメージと炎属性ダメージの会心ダメージ+1.5%";
      const result = extractor.extractWithDetails(skillDesc, "ja");

      expect(result.attributes).toContain("ice");
      expect(result.attributes).toContain("fire");
      expect(result.matchedPatterns).toHaveLength(2);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test("属性が見つからない場合の詳細情報を取得できること", () => {
      const skillDesc = "装備者の攻撃力+10%";
      const result = extractor.extractWithDetails(skillDesc, "ja");

      expect(result.attributes).toEqual([]);
      expect(result.confidence).toBe(0);
      expect(result.matchedPatterns).toEqual([]);
    });

    test("空のスキル説明の場合、適切な警告を含むこと", () => {
      const result = extractor.extractWithDetails("", "ja");

      expect(result.attributes).toEqual([]);
      expect(result.confidence).toBe(0);
      expect(result.warnings).toContain("スキル説明が空です");
    });

    test("サポートされていない言語の場合、適切な警告を含むこと", () => {
      const skillDesc = "装備者が与える炎属性ダメージ+15%";
      const result = extractor.extractWithDetails(skillDesc, "zh" as Lang);

      expect(result.attributes).toEqual([]);
      expect(result.confidence).toBe(0);
      expect(result.warnings).toContain("言語 'zh' はサポートされていません");
    });
  });
});
