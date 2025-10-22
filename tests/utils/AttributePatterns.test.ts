import { describe, test, expect } from "vitest";
import { AttributePatterns } from "../../src/utils/AttributePatterns";

describe("AttributePatterns", () => {
  describe("findAttributePatterns", () => {
    test("炎属性パターンを正しく検出できること", () => {
      const text = "装備者が与える炎属性ダメージ+15%";
      const result = AttributePatterns.findAttributePatterns(text);
      expect(result).toContain("炎属性");
    });

    test("氷属性パターンを正しく検出できること", () => {
      const text = "装備者が与える氷属性ダメージ+20%";
      const result = AttributePatterns.findAttributePatterns(text);
      expect(result).toContain("氷属性");
    });

    test("電気属性パターンを正しく検出できること", () => {
      const text = "装備者が与える電気属性ダメージ+25%";
      const result = AttributePatterns.findAttributePatterns(text);
      expect(result).toContain("電気属性");
    });

    test("物理属性パターンを正しく検出できること", () => {
      const text = "装備者が与える物理属性ダメージ+30%";
      const result = AttributePatterns.findAttributePatterns(text);
      expect(result).toContain("物理属性");
    });

    test("エーテル属性パターンを正しく検出できること", () => {
      const text = "装備者が与えるエーテル属性ダメージ+35%";
      const result = AttributePatterns.findAttributePatterns(text);
      expect(result).toContain("エーテル属性");
    });

    test("エーテル透徹ダメージパターンを正しく検出できること", () => {
      const text = "装備者が与えるエーテル透徹ダメージ+40%";
      const result = AttributePatterns.findAttributePatterns(text);
      expect(result).toContain("エーテル属性");
    });

    test("複数の属性パターンを正しく検出できること", () => {
      const text = "炎属性ダメージと氷属性ダメージの会心ダメージ+1.5%";
      const result = AttributePatterns.findAttributePatterns(text);
      expect(result).toContain("炎属性");
      expect(result).toContain("氷属性");
      expect(result).toHaveLength(2);
    });

    test("同じ属性が複数回出現しても重複なく検出できること", () => {
      const text = "炎属性ダメージ+10%。炎属性を与えた時、追加効果発動";
      const result = AttributePatterns.findAttributePatterns(text);
      expect(result).toEqual(["炎属性"]);
    });

    test("属性パターンがないテキストでは空配列を返すこと", () => {
      const text = "装備者の攻撃力+10%";
      const result = AttributePatterns.findAttributePatterns(text);
      expect(result).toEqual([]);
    });

    test("空文字列では空配列を返すこと", () => {
      const result = AttributePatterns.findAttributePatterns("");
      expect(result).toEqual([]);
    });

    test("様々な属性表現パターンを検出できること", () => {
      const testCases = [
        { text: "炎属性の会心ダメージ+10%", expected: "炎属性" },
        { text: "氷属性を与えた時", expected: "氷属性" },
        { text: "電気属性で攻撃", expected: "電気属性" },
        { text: "物理属性による追加ダメージ", expected: "物理属性" },
        { text: "エーテル属性による特殊効果", expected: "エーテル属性" },
      ];

      testCases.forEach(({ text, expected }) => {
        const result = AttributePatterns.findAttributePatterns(text);
        expect(result).toContain(expected);
      });
    });
  });

  describe("hasAttributePattern", () => {
    test("指定した属性パターンが存在する場合trueを返すこと", () => {
      const text = "装備者が与える炎属性ダメージ+15%";
      const result = AttributePatterns.hasAttributePattern(text, "炎属性");
      expect(result).toBe(true);
    });

    test("指定した属性パターンが存在しない場合falseを返すこと", () => {
      const text = "装備者が与える炎属性ダメージ+15%";
      const result = AttributePatterns.hasAttributePattern(text, "氷属性");
      expect(result).toBe(false);
    });

    test("存在しない属性名を指定した場合falseを返すこと", () => {
      const text = "装備者が与える炎属性ダメージ+15%";
      const result = AttributePatterns.hasAttributePattern(text, "未知属性");
      expect(result).toBe(false);
    });

    test("空文字列では常にfalseを返すこと", () => {
      const result = AttributePatterns.hasAttributePattern("", "炎属性");
      expect(result).toBe(false);
    });

    test("全ての属性タイプで正しく動作すること", () => {
      const testCases = [
        { text: "炎属性ダメージ+10%", attribute: "炎属性", expected: true },
        { text: "氷属性ダメージ+10%", attribute: "氷属性", expected: true },
        { text: "電気属性ダメージ+10%", attribute: "電気属性", expected: true },
        { text: "物理属性ダメージ+10%", attribute: "物理属性", expected: true },
        {
          text: "エーテル属性ダメージ+10%",
          attribute: "エーテル属性",
          expected: true,
        },
      ];

      testCases.forEach(({ text, attribute, expected }) => {
        const result = AttributePatterns.hasAttributePattern(text, attribute);
        expect(result).toBe(expected);
      });
    });
  });

  describe("getAvailableAttributes", () => {
    test("利用可能な属性の一覧を取得できること", () => {
      const attributes = AttributePatterns.getAvailableAttributes();
      expect(attributes).toContain("炎属性");
      expect(attributes).toContain("氷属性");
      expect(attributes).toContain("電気属性");
      expect(attributes).toContain("物理属性");
      expect(attributes).toContain("エーテル属性");
      expect(attributes).toHaveLength(5);
    });
  });

  describe("getPatterns", () => {
    test("指定した属性のパターンを取得できること", () => {
      const patterns = AttributePatterns.getPatterns("炎属性");
      expect(patterns).toHaveLength(5); // 5つのパターンが定義されている
      expect(patterns.every((pattern) => pattern instanceof RegExp)).toBe(true);
    });

    test("存在しない属性では空配列を返すこと", () => {
      const patterns = AttributePatterns.getPatterns("未知属性");
      expect(patterns).toEqual([]);
    });

    test("返されるパターンが元のパターンのコピーであること", () => {
      const patterns1 = AttributePatterns.getPatterns("炎属性");
      const patterns2 = AttributePatterns.getPatterns("炎属性");
      expect(patterns1).not.toBe(patterns2); // 異なる配列参照
      expect(patterns1).toEqual(patterns2); // 同じ内容
    });
  });

  describe("getAllPatterns", () => {
    test("全ての属性パターンを取得できること", () => {
      const allPatterns = AttributePatterns.getAllPatterns();
      expect(allPatterns).toHaveLength(5); // 5つの属性

      const attributeNames = allPatterns.map((p) => p.attribute);
      expect(attributeNames).toContain("炎属性");
      expect(attributeNames).toContain("氷属性");
      expect(attributeNames).toContain("電気属性");
      expect(attributeNames).toContain("物理属性");
      expect(attributeNames).toContain("エーテル属性");
    });

    test("返されるパターンが元のパターンのコピーであること", () => {
      const patterns1 = AttributePatterns.getAllPatterns();
      const patterns2 = AttributePatterns.getAllPatterns();
      expect(patterns1).not.toBe(patterns2); // 異なる配列参照
      expect(patterns1).toEqual(patterns2); // 同じ内容
    });
  });

  describe("getMatchDetails", () => {
    test("マッチした詳細情報を取得できること", () => {
      const text = "炎属性ダメージ+10%。炎属性を与えた時、追加効果発動";
      const details = AttributePatterns.getMatchDetails(text, "炎属性");

      expect(details.matchCount).toBeGreaterThan(0);
      expect(details.positions).toHaveLength(details.matchCount);
      expect(details.matchedPatterns.length).toBeGreaterThan(0);
      expect(details.positions.every((pos) => typeof pos === "number")).toBe(
        true
      );
    });

    test("マッチしない場合は空の詳細情報を返すこと", () => {
      const text = "装備者の攻撃力+10%";
      const details = AttributePatterns.getMatchDetails(text, "炎属性");

      expect(details.matchCount).toBe(0);
      expect(details.positions).toEqual([]);
      expect(details.matchedPatterns).toEqual([]);
    });

    test("存在しない属性では空の詳細情報を返すこと", () => {
      const text = "炎属性ダメージ+10%";
      const details = AttributePatterns.getMatchDetails(text, "未知属性");

      expect(details.matchCount).toBe(0);
      expect(details.positions).toEqual([]);
      expect(details.matchedPatterns).toEqual([]);
    });

    test("複数のパターンがマッチした場合の詳細情報を取得できること", () => {
      const text = "炎属性ダメージ+10%。炎属性の会心率+5%。炎属性を与えた時";
      const details = AttributePatterns.getMatchDetails(text, "炎属性");

      expect(details.matchCount).toBeGreaterThanOrEqual(3);
      expect(details.positions).toHaveLength(details.matchCount);
      expect(details.positions).toEqual(
        details.positions.sort((a, b) => a - b)
      ); // ソートされている
    });
  });
});
