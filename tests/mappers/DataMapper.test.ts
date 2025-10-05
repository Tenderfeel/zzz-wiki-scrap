import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DataMapper } from "../../src/mappers/DataMapper";
import { NameResolver } from "../../src/mappers/NameResolver";
import { MappingError } from "../../src/errors";

// Mock NameResolver
vi.mock("../../src/mappers/NameResolver");

describe("DataMapper", () => {
  let dataMapper: DataMapper;
  let mockNameResolver: any;
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

    // NameResolverのモックを作成
    mockNameResolver = {
      resolveNames: vi.fn(),
      getMappingStats: vi.fn().mockReturnValue({
        total: 3,
        characterIds: ["lycaon", "anby", "billy"],
      }),
      checkMappingFileAvailability: vi
        .fn()
        .mockReturnValue({ available: true, fallbackMode: false }),
      attemptErrorRecovery: vi.fn(),
      gracefulDegradation: vi.fn(),
    };

    vi.mocked(NameResolver).mockImplementation(() => mockNameResolver);

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

  describe("createNamesFromMapping", () => {
    it("should return mapped names for valid character ID", () => {
      mockNameResolver.resolveNames.mockReturnValue({
        ja: "ライカン",
        en: "Lycaon",
      });

      const result = dataMapper.createNamesFromMapping("lycaon");

      expect(result).toEqual({ ja: "ライカン", en: "Lycaon" });
      expect(mockNameResolver.resolveNames).toHaveBeenCalledWith("lycaon");
    });

    it("should return null for non-existent character ID", () => {
      mockNameResolver.resolveNames.mockReturnValue(null);

      const result = dataMapper.createNamesFromMapping("nonexistent");

      expect(result).toBeNull();
      expect(mockNameResolver.resolveNames).toHaveBeenCalledWith("nonexistent");
    });

    it("should return null for empty character ID", () => {
      const result = dataMapper.createNamesFromMapping("");

      expect(result).toBeNull();
    });

    it("should normalize character ID to lowercase", () => {
      mockNameResolver.resolveNames.mockReturnValue({
        ja: "ライカン",
        en: "Lycaon",
      });

      const result = dataMapper.createNamesFromMapping("LYCAON");

      expect(result).toEqual({ ja: "ライカン", en: "Lycaon" });
      expect(mockNameResolver.resolveNames).toHaveBeenCalledWith("lycaon");
    });

    it("should handle errors gracefully and return null", () => {
      mockNameResolver.resolveNames.mockImplementation(() => {
        throw new Error("Test error");
      });

      const result = dataMapper.createNamesFromMapping("lycaon");

      expect(result).toBeNull();
    });
  });

  describe("createNamesWithFallback", () => {
    it("should use predefined mapping when available", () => {
      mockNameResolver.resolveNames.mockReturnValue({
        ja: "ライカン",
        en: "Lycaon",
      });

      const result = dataMapper.createNamesWithFallback(
        "lycaon",
        "フォン・ライカン",
        "Von Lycaon"
      );

      expect(result).toEqual({ ja: "ライカン", en: "Lycaon" });
    });

    it("should fallback to API names when mapping not found", () => {
      mockNameResolver.resolveNames.mockReturnValue(null);

      const result = dataMapper.createNamesWithFallback(
        "unknown",
        "フォン・ライカン",
        "Von Lycaon"
      );

      expect(result).toEqual({ ja: "フォン・ライカン", en: "Von Lycaon" });
    });

    it("should trim fallback names", () => {
      mockNameResolver.resolveNames.mockReturnValue(null);

      const result = dataMapper.createNamesWithFallback(
        "unknown",
        "  フォン・ライカン  ",
        "  Von Lycaon  "
      );

      expect(result).toEqual({ ja: "フォン・ライカン", en: "Von Lycaon" });
    });

    it("should throw MappingError for empty character ID", () => {
      expect(() =>
        dataMapper.createNamesWithFallback("", "Test", "Test")
      ).toThrow(MappingError);
      expect(() =>
        dataMapper.createNamesWithFallback("", "Test", "Test")
      ).toThrow("キャラクターIDが空または無効です");
    });

    it("should throw MappingError for invalid fallback names", () => {
      mockNameResolver.resolveNames.mockReturnValue(null);

      expect(() =>
        dataMapper.createNamesWithFallback("test", "", "Valid Name")
      ).toThrow(MappingError);

      expect(() =>
        dataMapper.createNamesWithFallback("test", "Valid Name", "")
      ).toThrow(MappingError);
    });

    it("should handle non-string fallback names", () => {
      mockNameResolver.resolveNames.mockReturnValue(null);

      expect(() =>
        dataMapper.createNamesWithFallback("test", null as any, "Valid Name")
      ).toThrow(MappingError);

      expect(() =>
        dataMapper.createNamesWithFallback(
          "test",
          "Valid Name",
          undefined as any
        )
      ).toThrow(MappingError);
    });

    it("should warn about long fallback names", () => {
      mockNameResolver.resolveNames.mockReturnValue(null);
      const longName = "a".repeat(150);

      const result = dataMapper.createNamesWithFallback(
        "test",
        longName,
        "Valid Name"
      );

      expect(result).toEqual({ ja: longName, en: "Valid Name" });
    });
  });

  describe("createNamesWithExtendedFallback", () => {
    it("should use standard fallback when successful", () => {
      mockNameResolver.resolveNames.mockReturnValue({
        ja: "ライカン",
        en: "Lycaon",
      });

      const result = dataMapper.createNamesWithExtendedFallback(
        "lycaon",
        "フォン・ライカン",
        "Von Lycaon"
      );

      expect(result).toEqual({ ja: "ライカン", en: "Lycaon" });
    });

    it("should attempt error recovery on failure", () => {
      // First call fails, second call succeeds after recovery
      mockNameResolver.resolveNames
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({ ja: "ライカン", en: "Lycaon" });

      mockNameResolver.attemptErrorRecovery.mockReturnValue({
        ja: "ライカン",
        en: "Lycaon",
      });

      // Mock createNamesWithFallback to throw error first time
      const originalMethod = dataMapper.createNamesWithFallback;
      vi.spyOn(dataMapper, "createNamesWithFallback")
        .mockImplementationOnce(() => {
          throw new MappingError("Test error");
        })
        .mockImplementation(originalMethod);

      const result = dataMapper.createNamesWithExtendedFallback(
        "lycaon",
        "フォン・ライカン",
        "Von Lycaon"
      );

      expect(result).toEqual({ ja: "ライカン", en: "Lycaon" });
    });

    it("should use graceful degradation when all recovery attempts fail", () => {
      mockNameResolver.resolveNames.mockReturnValue(null);
      mockNameResolver.attemptErrorRecovery.mockReturnValue(null);
      mockNameResolver.gracefulDegradation.mockReturnValue({
        mode: "degraded",
        reason: "Test reason",
        suggestion: "Test suggestion",
      });

      // Mock createNamesWithFallback to always throw error
      vi.spyOn(dataMapper, "createNamesWithFallback").mockImplementation(() => {
        throw new MappingError("Test error");
      });

      const result = dataMapper.createNamesWithExtendedFallback(
        "lycaon",
        "フォン・ライカン",
        "Von Lycaon",
        0 // No retries
      );

      expect(result).toEqual({ ja: "フォン・ライカン", en: "Von Lycaon" });
    });

    it("should return default names when all fallbacks fail", () => {
      mockNameResolver.resolveNames.mockReturnValue(null);
      mockNameResolver.attemptErrorRecovery.mockReturnValue(null);
      mockNameResolver.gracefulDegradation.mockReturnValue({
        mode: "degraded",
        reason: "Test reason",
        suggestion: "Test suggestion",
      });

      // Mock createNamesWithFallback to always throw error
      vi.spyOn(dataMapper, "createNamesWithFallback").mockImplementation(() => {
        throw new MappingError("Test error");
      });

      const result = dataMapper.createNamesWithExtendedFallback(
        "lycaon",
        "", // Empty fallback names
        "",
        0 // No retries
      );

      expect(result).toEqual({
        ja: "不明なキャラクター",
        en: "Unknown Character",
      });
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
