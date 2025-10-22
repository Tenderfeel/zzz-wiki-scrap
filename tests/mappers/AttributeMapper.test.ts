import { describe, test, expect } from "vitest";
import { AttributeMapper } from "../../src/mappers/AttributeMapper";
import { Stats } from "../../src/types";

describe("AttributeMapper", () => {
  describe("mapToEnglish", () => {
    test("炎属性を正しく英語にマッピングできること", () => {
      const result = AttributeMapper.mapToEnglish("炎属性");
      expect(result).toBe("fire");
    });

    test("氷属性を正しく英語にマッピングできること", () => {
      const result = AttributeMapper.mapToEnglish("氷属性");
      expect(result).toBe("ice");
    });

    test("電気属性を正しく英語にマッピングできること", () => {
      const result = AttributeMapper.mapToEnglish("電気属性");
      expect(result).toBe("electric");
    });

    test("物理属性を正しく英語にマッピングできること", () => {
      const result = AttributeMapper.mapToEnglish("物理属性");
      expect(result).toBe("physical");
    });

    test("エーテル属性を正しく英語にマッピングできること", () => {
      const result = AttributeMapper.mapToEnglish("エーテル属性");
      expect(result).toBe("ether");
    });

    test("未知の属性名ではnullを返すこと", () => {
      const result = AttributeMapper.mapToEnglish("未知属性");
      expect(result).toBeNull();
    });

    test("空文字列ではnullを返すこと", () => {
      const result = AttributeMapper.mapToEnglish("");
      expect(result).toBeNull();
    });

    test("空白のみの文字列ではnullを返すこと", () => {
      const result = AttributeMapper.mapToEnglish("   ");
      expect(result).toBeNull();
    });

    test("nullまたはundefinedではnullを返すこと", () => {
      const result1 = AttributeMapper.mapToEnglish(null as any);
      const result2 = AttributeMapper.mapToEnglish(undefined as any);
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    test("前後の空白を除去してマッピングできること", () => {
      const result = AttributeMapper.mapToEnglish("  炎属性  ");
      expect(result).toBe("fire");
    });

    test("文字列以外の型では適切に処理されること", () => {
      const result1 = AttributeMapper.mapToEnglish(123 as any);
      const result2 = AttributeMapper.mapToEnglish({} as any);
      const result3 = AttributeMapper.mapToEnglish([] as any);
      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    });
  });

  describe("mapMultipleToEnglish", () => {
    test("複数の日本語属性を正しく英語にマッピングできること", () => {
      const japaneseAttributes = ["炎属性", "氷属性", "電気属性"];
      const result = AttributeMapper.mapMultipleToEnglish(japaneseAttributes);
      expect(result).toEqual(["fire", "ice", "electric"]);
    });

    test("全ての属性タイプを正しくマッピングできること", () => {
      const japaneseAttributes = [
        "炎属性",
        "氷属性",
        "電気属性",
        "物理属性",
        "エーテル属性",
      ];
      const result = AttributeMapper.mapMultipleToEnglish(japaneseAttributes);
      expect(result).toEqual(["fire", "ice", "electric", "physical", "ether"]);
    });

    test("未知の属性が含まれる場合、有効な属性のみを返すこと", () => {
      const japaneseAttributes = ["炎属性", "未知属性", "氷属性"];
      const result = AttributeMapper.mapMultipleToEnglish(japaneseAttributes);
      expect(result).toEqual(["fire", "ice"]);
    });

    test("空の配列では空配列を返すこと", () => {
      const result = AttributeMapper.mapMultipleToEnglish([]);
      expect(result).toEqual([]);
    });

    test("nullまたはundefinedでは空配列を返すこと", () => {
      const result1 = AttributeMapper.mapMultipleToEnglish(null as any);
      const result2 = AttributeMapper.mapMultipleToEnglish(undefined as any);
      expect(result1).toEqual([]);
      expect(result2).toEqual([]);
    });

    test("配列以外の型では空配列を返すこと", () => {
      const result1 = AttributeMapper.mapMultipleToEnglish("炎属性" as any);
      const result2 = AttributeMapper.mapMultipleToEnglish(123 as any);
      const result3 = AttributeMapper.mapMultipleToEnglish({} as any);
      expect(result1).toEqual([]);
      expect(result2).toEqual([]);
      expect(result3).toEqual([]);
    });

    test("空文字列や無効な要素が含まれる場合、有効な要素のみを処理すること", () => {
      const japaneseAttributes = [
        "炎属性",
        "",
        "氷属性",
        null as any,
        "電気属性",
      ];
      const result = AttributeMapper.mapMultipleToEnglish(japaneseAttributes);
      expect(result).toEqual(["fire", "ice", "electric"]);
    });
  });

  describe("isValidAttribute", () => {
    test("有効な英語属性名でtrueを返すこと", () => {
      expect(AttributeMapper.isValidAttribute("fire")).toBe(true);
      expect(AttributeMapper.isValidAttribute("ice")).toBe(true);
      expect(AttributeMapper.isValidAttribute("electric")).toBe(true);
      expect(AttributeMapper.isValidAttribute("physical")).toBe(true);
      expect(AttributeMapper.isValidAttribute("ether")).toBe(true);
    });

    test("無効な属性名でfalseを返すこと", () => {
      expect(AttributeMapper.isValidAttribute("invalid")).toBe(false);
      expect(AttributeMapper.isValidAttribute("炎属性")).toBe(false);
      expect(AttributeMapper.isValidAttribute("")).toBe(false);
    });
  });

  describe("getAttributeMapping", () => {
    test("属性マッピングオブジェクトを取得できること", () => {
      const mapping = AttributeMapper.getAttributeMapping();
      expect(mapping).toHaveProperty("炎属性", "fire");
      expect(mapping).toHaveProperty("氷属性", "ice");
      expect(mapping).toHaveProperty("電気属性", "electric");
      expect(mapping).toHaveProperty("物理属性", "physical");
      expect(mapping).toHaveProperty("エーテル属性", "ether");
    });

    test("返されるオブジェクトが元のマッピングのコピーであること", () => {
      const mapping1 = AttributeMapper.getAttributeMapping();
      const mapping2 = AttributeMapper.getAttributeMapping();
      expect(mapping1).not.toBe(mapping2); // 異なるオブジェクト参照
      expect(mapping1).toEqual(mapping2); // 同じ内容
    });
  });

  describe("getSupportedJapaneseAttributes", () => {
    test("サポートされている日本語属性名の配列を取得できること", () => {
      const attributes = AttributeMapper.getSupportedJapaneseAttributes();
      expect(attributes).toContain("炎属性");
      expect(attributes).toContain("氷属性");
      expect(attributes).toContain("電気属性");
      expect(attributes).toContain("物理属性");
      expect(attributes).toContain("エーテル属性");
      expect(attributes).toHaveLength(5);
    });
  });

  describe("getSupportedEnglishAttributes", () => {
    test("サポートされている英語属性名の配列を取得できること", () => {
      const attributes = AttributeMapper.getSupportedEnglishAttributes();
      expect(attributes).toContain("fire");
      expect(attributes).toContain("ice");
      expect(attributes).toContain("electric");
      expect(attributes).toContain("physical");
      expect(attributes).toContain("ether");
      expect(attributes).toHaveLength(5);
    });
  });
});
