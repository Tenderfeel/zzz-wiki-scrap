import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DataMapper } from "../../src/mappers/DataMapper";
import { NameResolver } from "../../src/mappers/NameResolver";
import { MappingError } from "../../src/errors";

// Mock NameResolver
vi.mock("../../src/mappers/NameResolver");

// Mock Logger
vi.mock("../../src/utils/Logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  LogMessages: {},
}));

describe("DataMapper", () => {
  let dataMapper: DataMapper;
  let mockNameResolver: any;

  beforeEach(async () => {
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

  describe("mapAssistType", () => {
    it("正常な日本語支援タイプマッピング", () => {
      expect(dataMapper.mapAssistType("回避支援")).toBe("evasive");
      expect(dataMapper.mapAssistType("パリィ支援")).toBe("defensive");
    });

    it("正常な英語支援タイプマッピング", () => {
      expect(dataMapper.mapAssistType("Evasive Assist")).toBe("evasive");
      expect(dataMapper.mapAssistType("Defensive Assist")).toBe("defensive");
    });

    it("前後の空白を除去してマッピング", () => {
      expect(dataMapper.mapAssistType("  回避支援  ")).toBe("evasive");
      expect(dataMapper.mapAssistType("  パリィ支援  ")).toBe("defensive");
      expect(dataMapper.mapAssistType("  Evasive Assist  ")).toBe("evasive");
      expect(dataMapper.mapAssistType("  Defensive Assist  ")).toBe(
        "defensive"
      );
    });

    it("空文字列の場合はundefinedを返す", () => {
      expect(dataMapper.mapAssistType("")).toBeUndefined();
      expect(dataMapper.mapAssistType("   ")).toBeUndefined();
    });

    it("null値の場合はundefinedを返す", () => {
      expect(dataMapper.mapAssistType(null as any)).toBeUndefined();
      expect(dataMapper.mapAssistType(undefined as any)).toBeUndefined();
    });

    it("非文字列値の場合はundefinedを返す", () => {
      expect(dataMapper.mapAssistType(123 as any)).toBeUndefined();
      expect(dataMapper.mapAssistType({} as any)).toBeUndefined();
      expect(dataMapper.mapAssistType([] as any)).toBeUndefined();
      expect(dataMapper.mapAssistType(true as any)).toBeUndefined();
    });

    it("未知の支援タイプ値の場合はundefinedを返す", () => {
      const result = dataMapper.mapAssistType("未知の支援タイプ");
      expect(result).toBeUndefined();
    });

    it("大文字小文字が異なる場合はundefinedを返す", () => {
      expect(dataMapper.mapAssistType("回避支援")).toBe("evasive");
      expect(dataMapper.mapAssistType("EVASIVE ASSIST")).toBeUndefined();
      expect(dataMapper.mapAssistType("evasive assist")).toBeUndefined();
    });

    it("部分的な文字列の場合はundefinedを返す", () => {
      expect(dataMapper.mapAssistType("回避")).toBeUndefined();
      expect(dataMapper.mapAssistType("支援")).toBeUndefined();
      expect(dataMapper.mapAssistType("Evasive")).toBeUndefined();
    });
  });

  describe("parseVersionNumber", () => {
    it("正常なバージョン文字列の解析", () => {
      expect(dataMapper.parseVersionNumber("Ver.1.0")).toBe(1.0);
      expect(dataMapper.parseVersionNumber("Ver.1.1")).toBe(1.1);
      expect(dataMapper.parseVersionNumber("Ver.1.2")).toBe(1.2);
      expect(dataMapper.parseVersionNumber("Ver.2.0")).toBe(2.0);
      expect(dataMapper.parseVersionNumber("Ver.10.5")).toBe(10.5);
    });

    it("バージョン名付きの文字列の解析", () => {
      expect(
        dataMapper.parseVersionNumber("Ver.1.0「新エリー都へようこそ」")
      ).toBe(1.0);
      expect(dataMapper.parseVersionNumber("Ver.1.1「バージョン名」")).toBe(
        1.1
      );
      expect(
        dataMapper.parseVersionNumber("Ver.2.0「メジャーアップデート」")
      ).toBe(2.0);
    });

    it("HTMLタグを含む文字列の解析", () => {
      expect(
        dataMapper.parseVersionNumber("<p>Ver.1.0「新エリー都へようこそ」</p>")
      ).toBe(1.0);
      expect(dataMapper.parseVersionNumber("<div>Ver.1.1</div>")).toBe(1.1);
      expect(
        dataMapper.parseVersionNumber("<span>Ver.2.0「テスト」</span>")
      ).toBe(2.0);
      expect(dataMapper.parseVersionNumber("<strong>Ver.1.5</strong>")).toBe(
        1.5
      );
    });

    it("複雑なHTMLタグを含む文字列の解析", () => {
      expect(
        dataMapper.parseVersionNumber(
          '<p class="version">Ver.1.0「新エリー都へようこそ」</p>'
        )
      ).toBe(1.0);
      expect(
        dataMapper.parseVersionNumber(
          '<div id="version"><span>Ver.1.1</span></div>'
        )
      ).toBe(1.1);
      expect(dataMapper.parseVersionNumber('<a href="#">Ver.2.0</a>')).toBe(
        2.0
      );
    });

    it("前後の空白を含む文字列の解析", () => {
      expect(dataMapper.parseVersionNumber("  Ver.1.0  ")).toBe(1.0);
      expect(dataMapper.parseVersionNumber("\t\nVer.1.1\t\n")).toBe(1.1);
      expect(dataMapper.parseVersionNumber("   <p>Ver.2.0</p>   ")).toBe(2.0);
    });

    it("異常なバージョン文字列の処理", () => {
      expect(dataMapper.parseVersionNumber("")).toBeNull();
      expect(dataMapper.parseVersionNumber("   ")).toBeNull();
      expect(dataMapper.parseVersionNumber("Version 1.0")).toBeNull();
      expect(dataMapper.parseVersionNumber("v1.0")).toBeNull();
      expect(dataMapper.parseVersionNumber("Ver.")).toBeNull();
      expect(dataMapper.parseVersionNumber("Ver.abc")).toBeNull();
      expect(dataMapper.parseVersionNumber("Ver.1")).toBeNull();
      expect(dataMapper.parseVersionNumber("Ver.1.")).toBeNull();
      expect(dataMapper.parseVersionNumber("Ver.1.a")).toBeNull();
      expect(dataMapper.parseVersionNumber("Ver.a.b")).toBeNull();
    });

    it("null/undefined値の処理", () => {
      expect(dataMapper.parseVersionNumber(null as any)).toBeNull();
      expect(dataMapper.parseVersionNumber(undefined as any)).toBeNull();
    });

    it("非文字列値の処理", () => {
      expect(dataMapper.parseVersionNumber(123 as any)).toBeNull();
      expect(dataMapper.parseVersionNumber({} as any)).toBeNull();
      expect(dataMapper.parseVersionNumber([] as any)).toBeNull();
      expect(dataMapper.parseVersionNumber(true as any)).toBeNull();
    });

    it("HTMLタグのみでバージョン情報がない文字列の処理", () => {
      expect(dataMapper.parseVersionNumber("<p></p>")).toBeNull();
      expect(
        dataMapper.parseVersionNumber("<div>テキストのみ</div>")
      ).toBeNull();
      expect(
        dataMapper.parseVersionNumber("<span>Version情報なし</span>")
      ).toBeNull();
    });

    it("複数のバージョンパターンがある場合は最初のものを使用", () => {
      expect(dataMapper.parseVersionNumber("Ver.1.0とVer.2.0")).toBe(1.0);
      expect(dataMapper.parseVersionNumber("古いVer.1.5、新しいVer.2.0")).toBe(
        1.5
      );
    });

    it("小数点以下が複数桁の場合の処理", () => {
      expect(dataMapper.parseVersionNumber("Ver.1.10")).toBe(1.1);
      expect(dataMapper.parseVersionNumber("Ver.2.15")).toBe(2.15);
      expect(dataMapper.parseVersionNumber("Ver.10.25")).toBe(10.25);
    });

    it("特殊文字を含む文字列でも正常なバージョンパターンは抽出される", () => {
      // 正規表現は Ver.X.Y パターンを正しく抽出する
      expect(dataMapper.parseVersionNumber("Ver.1.0[")).toBe(1.0);
      expect(dataMapper.parseVersionNumber("Ver.1.0(")).toBe(1.0);
      expect(dataMapper.parseVersionNumber("Ver.1.0*")).toBe(1.0);
      expect(dataMapper.parseVersionNumber("Ver.2.5#")).toBe(2.5);
    });
  });

  describe("getAvailableMappings", () => {
    it("利用可能なマッピング値を返す", () => {
      const mappings = DataMapper.getAvailableMappings();

      expect(mappings).toHaveProperty("specialty");
      expect(mappings).toHaveProperty("stats");
      expect(mappings).toHaveProperty("rarity");
      expect(mappings).toHaveProperty("assistType");

      expect(mappings.specialty).toContain("撃破");
      expect(mappings.stats).toContain("氷属性");
      expect(mappings.rarity).toContain("S");
      expect(mappings.assistType).toContain("回避支援");
      expect(mappings.assistType).toContain("パリィ支援");
      expect(mappings.assistType).toContain("Evasive Assist");
      expect(mappings.assistType).toContain("Defensive Assist");
    });
  });
});
