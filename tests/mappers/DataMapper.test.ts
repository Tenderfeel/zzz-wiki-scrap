import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DataMapper } from "../../src/mappers/DataMapper";
import { MappingError } from "../../src/errors";

describe("DataMapper", () => {
  let dataMapper: DataMapper;
  let consoleDebugSpy: any;
  let consoleInfoSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    // コンソールメソッドをスパイ化
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    dataMapper = new DataMapper();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe("mapSpecialty", () => {
    it("正常な特性マッピング", () => {
      expect(dataMapper.mapSpecialty("撃破")).toBe("stun");
      expect(dataMapper.mapSpecialty("強攻")).toBe("attack");
      expect(dataMapper.mapSpecialty("異常")).toBe("anomaly");
      expect(dataMapper.mapSpecialty("支援")).toBe("support");
      expect(dataMapper.mapSpecialty("防護")).toBe("defense");
      expect(dataMapper.mapSpecialty("命破")).toBe("rupture");
    });

    it("未知の特性値の場合はMappingErrorを投げる", () => {
      expect(() => dataMapper.mapSpecialty("未知の特性")).toThrow(MappingError);
      expect(() => dataMapper.mapSpecialty("未知の特性")).toThrow(
        '未知の特性値です: "未知の特性"'
      );
    });
  });

  describe("mapStats", () => {
    it("正常な属性マッピング", () => {
      expect(dataMapper.mapStats("氷属性")).toBe("ice");
      expect(dataMapper.mapStats("炎属性")).toBe("fire");
      expect(dataMapper.mapStats("電気属性")).toBe("electric");
      expect(dataMapper.mapStats("物理属性")).toBe("physical");
      expect(dataMapper.mapStats("エーテル属性")).toBe("ether");
      expect(dataMapper.mapStats("霜烈属性")).toBe("frostAttribute");
      expect(dataMapper.mapStats("玄墨属性")).toBe("auricInk");
    });

    it("未知の属性値の場合はMappingErrorを投げる", () => {
      expect(() => dataMapper.mapStats("未知の属性")).toThrow(MappingError);
      expect(() => dataMapper.mapStats("未知の属性")).toThrow(
        '未知の属性値です: "未知の属性"'
      );
    });
  });

  describe("mapRarity", () => {
    it("正常なレア度マッピング", () => {
      expect(dataMapper.mapRarity("S")).toBe("S");
      expect(dataMapper.mapRarity("A")).toBe("A");
    });

    it("未知のレア度値の場合はMappingErrorを投げる", () => {
      expect(() => dataMapper.mapRarity("B")).toThrow(MappingError);
      expect(() => dataMapper.mapRarity("B")).toThrow(
        '未知のレア度値です: "B"'
      );
    });
  });

  describe("createMultiLangName", () => {
    it("正常な多言語名オブジェクトを生成", () => {
      const result = dataMapper.createMultiLangName(
        "フォン・ライカン",
        "Von Lycaon"
      );

      expect(result).toEqual({
        ja: "フォン・ライカン",
        en: "Von Lycaon",
      });
    });

    it("前後の空白を除去する", () => {
      const result = dataMapper.createMultiLangName(
        "  フォン・ライカン  ",
        "  Von Lycaon  "
      );

      expect(result).toEqual({
        ja: "フォン・ライカン",
        en: "Von Lycaon",
      });
    });

    it("日本語名が空の場合はMappingErrorを投げる", () => {
      expect(() => dataMapper.createMultiLangName("", "Von Lycaon")).toThrow(
        MappingError
      );
      expect(() => dataMapper.createMultiLangName("", "Von Lycaon")).toThrow(
        "日本語名が空または無効です"
      );
    });

    it("英語名が空の場合はMappingErrorを投げる", () => {
      expect(() =>
        dataMapper.createMultiLangName("フォン・ライカン", "")
      ).toThrow(MappingError);
      expect(() =>
        dataMapper.createMultiLangName("フォン・ライカン", "")
      ).toThrow("英語名が空または無効です");
    });

    it("空白のみの名前の場合はMappingErrorを投げる", () => {
      expect(() => dataMapper.createMultiLangName("   ", "Von Lycaon")).toThrow(
        MappingError
      );
      expect(() =>
        dataMapper.createMultiLangName("フォン・ライカン", "   ")
      ).toThrow(MappingError);
    });
  });

  describe("getAvailableMappings", () => {
    it("利用可能なマッピング値を返す", () => {
      const mappings = DataMapper.getAvailableMappings();

      expect(mappings).toHaveProperty("specialty");
      expect(mappings).toHaveProperty("stats");
      expect(mappings).toHaveProperty("rarity");

      expect(mappings.specialty).toContain("撃破");
      expect(mappings.stats).toContain("氷属性");
      expect(mappings.rarity).toContain("S");
    });
  });
});
