import { describe, it, expect, beforeEach, vi } from "vitest";
import { NameResolver } from "../../src/mappers/NameResolver";
import { NameMappingError } from "../../src/errors";
import * as fs from "fs";

// Mock fs module
vi.mock("fs");

describe("NameResolver", () => {
  let nameResolver: NameResolver;
  const mockValidMappings = {
    lycaon: { ja: "ライカン", en: "Lycaon" },
    anby: { ja: "アンビー", en: "Anby" },
    billy: { ja: "ビリー", en: "Billy" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    nameResolver = new NameResolver("./test-config.json");
  });

  describe("checkMappingFileAvailability", () => {
    it("should return available: false when file does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = nameResolver.checkMappingFileAvailability();

      expect(result).toEqual({
        available: false,
        error: "ファイルが見つかりません",
        fallbackMode: true,
      });
    });

    it("should return available: true when file exists and is readable", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.accessSync).mockImplementation(() => {});
      vi.mocked(fs.statSync).mockReturnValue({ size: 100 } as any);

      const result = nameResolver.checkMappingFileAvailability();

      expect(result).toEqual({
        available: true,
        fallbackMode: false,
      });
    });

    it("should handle access permission errors", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.accessSync).mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const result = nameResolver.checkMappingFileAvailability();

      expect(result).toEqual({
        available: false,
        error: "読み取り権限がありません",
        fallbackMode: true,
      });
    });
  });

  describe("loadNameMappings - Enhanced Error Handling", () => {
    it("should throw NameMappingError when file does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(() => nameResolver.loadNameMappings()).toThrow(NameMappingError);
      expect(() => nameResolver.loadNameMappings()).toThrow(
        "名前マッピング設定ファイルが見つかりません"
      );
    });

    it("should throw NameMappingError for invalid JSON", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("invalid json");

      expect(() => nameResolver.loadNameMappings()).toThrow(NameMappingError);
      expect(() => nameResolver.loadNameMappings()).toThrow(
        "名前マッピング設定ファイルのJSON形式が無効です"
      );
    });

    it("should throw NameMappingError for invalid mapping format", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          invalidCharacter: { ja: "", en: "Test" }, // Empty ja name
        })
      );

      expect(() => nameResolver.loadNameMappings()).toThrow(NameMappingError);
      expect(() => nameResolver.loadNameMappings()).toThrow(
        "名前マッピング設定ファイルの形式が無効です"
      );
    });

    it("should successfully load valid mappings", () => {
      const validMappings = {
        lycaon: { ja: "ライカン", en: "Lycaon" },
        anby: { ja: "アンビー", en: "Anby" },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validMappings));

      expect(() => nameResolver.loadNameMappings()).not.toThrow();
      expect(nameResolver.isNameMappingsLoaded()).toBe(true);
    });
  });

  describe("resolveNames", () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify(mockValidMappings)
      );
    });

    it("should return correct mapping for valid character ID", () => {
      const result = nameResolver.resolveNames("lycaon");
      expect(result).toEqual({ ja: "ライカン", en: "Lycaon" });
    });

    it("should return null for invalid character ID types", () => {
      const result = nameResolver.resolveNames(null as any);
      expect(result).toBeNull();
    });

    it("should return null for empty character ID", () => {
      const result = nameResolver.resolveNames("");
      expect(result).toBeNull();
    });

    it("should return null for whitespace-only character ID", () => {
      const result = nameResolver.resolveNames("   ");
      expect(result).toBeNull();
    });

    it("should normalize character ID to lowercase", () => {
      const result = nameResolver.resolveNames("LYCAON");
      expect(result).toEqual({ ja: "ライカン", en: "Lycaon" });
    });

    it("should return null for non-existent character ID", () => {
      const result = nameResolver.resolveNames("nonexistent");
      expect(result).toBeNull();
    });

    it("should handle errors gracefully and return null", () => {
      // Create a new resolver that will fail during loading
      const failingResolver = new NameResolver("./non-existent-file.json");
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = failingResolver.resolveNames("lycaon");
      expect(result).toBeNull();
    });

    it("should trim whitespace from character ID", () => {
      const result = nameResolver.resolveNames("  lycaon  ");
      expect(result).toEqual({ ja: "ライカン", en: "Lycaon" });
    });
  });

  describe("hasMapping", () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify(mockValidMappings)
      );
    });

    it("should return true for existing character ID", () => {
      const result = nameResolver.hasMapping("lycaon");
      expect(result).toBe(true);
    });

    it("should return false for non-existing character ID", () => {
      const result = nameResolver.hasMapping("nonexistent");
      expect(result).toBe(false);
    });

    it("should normalize character ID to lowercase", () => {
      const result = nameResolver.hasMapping("LYCAON");
      expect(result).toBe(true);
    });
  });

  describe("getMappingStats", () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify(mockValidMappings)
      );
    });

    it("should return correct mapping statistics", () => {
      const stats = nameResolver.getMappingStats();
      expect(stats.total).toBe(3);
      expect(stats.characterIds).toEqual(["anby", "billy", "lycaon"]);
    });
  });

  describe("isNameMappingsLoaded", () => {
    it("should return false initially", () => {
      expect(nameResolver.isNameMappingsLoaded()).toBe(false);
    });

    it("should return true after successful loading", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify(mockValidMappings)
      );

      nameResolver.loadNameMappings();
      expect(nameResolver.isNameMappingsLoaded()).toBe(true);
    });
  });

  describe("createMultiLangName", () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify(mockValidMappings)
      );
    });

    it("should create multi-language name object for valid character ID", () => {
      const result = nameResolver.createMultiLangName("lycaon");
      expect(result).toEqual({ ja: "ライカン", en: "Lycaon" });
    });

    it("should return null for non-existent character ID", () => {
      const result = nameResolver.createMultiLangName("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("validateMappings", () => {
    it("should return false for non-object input", () => {
      expect(nameResolver.validateMappings(null)).toBe(false);
      expect(nameResolver.validateMappings("string")).toBe(false);
      expect(nameResolver.validateMappings(123)).toBe(false);
    });

    it("should return false for invalid character ID", () => {
      const invalidMappings = {
        "": { ja: "テスト", en: "Test" }, // Empty character ID
      };

      expect(nameResolver.validateMappings(invalidMappings)).toBe(false);
    });

    it("should return false for missing ja name", () => {
      const invalidMappings = {
        test: { en: "Test" }, // Missing ja
      };

      expect(nameResolver.validateMappings(invalidMappings)).toBe(false);
    });

    it("should return false for missing en name", () => {
      const invalidMappings = {
        test: { ja: "テスト" }, // Missing en
      };

      expect(nameResolver.validateMappings(invalidMappings)).toBe(false);
    });

    it("should return false for empty ja name", () => {
      const invalidMappings = {
        test: { ja: "", en: "Test" },
      };

      expect(nameResolver.validateMappings(invalidMappings)).toBe(false);
    });

    it("should return false for empty en name", () => {
      const invalidMappings = {
        test: { ja: "テスト", en: "" },
      };

      expect(nameResolver.validateMappings(invalidMappings)).toBe(false);
    });

    it("should return true for valid mappings", () => {
      expect(nameResolver.validateMappings(mockValidMappings)).toBe(true);
    });

    it("should handle validation errors gracefully", () => {
      const mappingsWithError = {
        lycaon: { ja: "ライカン", en: "Lycaon" },
        // This will cause validation to fail due to empty string
        invalidChar: { ja: "", en: "Test" },
      };

      // Should not throw, but return false
      expect(nameResolver.validateMappings(mappingsWithError)).toBe(false);
    });

    it("should warn about unknown properties", () => {
      const mappingsWithExtraProps = {
        lycaon: { ja: "ライカン", en: "Lycaon", extra: "property" },
      };

      // Should still return true but log warning
      expect(nameResolver.validateMappings(mappingsWithExtraProps)).toBe(true);
    });
  });

  describe("Enhanced Error Handling", () => {
    describe("checkMappingFileAvailability", () => {
      it("should return available: false when file does not exist", () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        const result = nameResolver.checkMappingFileAvailability();

        expect(result).toEqual({
          available: false,
          error: "ファイルが見つかりません",
          fallbackMode: true,
        });
      });

      it("should return available: true when file exists and is readable", () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.accessSync).mockImplementation(() => {});
        vi.mocked(fs.statSync).mockReturnValue({ size: 100 } as any);

        const result = nameResolver.checkMappingFileAvailability();

        expect(result).toEqual({
          available: true,
          fallbackMode: false,
        });
      });

      it("should handle access permission errors", () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.accessSync).mockImplementation(() => {
          throw new Error("Permission denied");
        });

        const result = nameResolver.checkMappingFileAvailability();

        expect(result).toEqual({
          available: false,
          error: "読み取り権限がありません",
          fallbackMode: true,
        });
      });

      it("should handle empty files", () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.accessSync).mockImplementation(() => {});
        vi.mocked(fs.statSync).mockReturnValue({ size: 0 } as any);

        const result = nameResolver.checkMappingFileAvailability();

        expect(result).toEqual({
          available: false,
          error: "ファイルが空です",
          fallbackMode: true,
        });
      });
    });

    describe("attemptErrorRecovery", () => {
      it("should attempt to recover from NameMappingError", () => {
        const error = new NameMappingError("Test error");

        // Mock successful recovery
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.accessSync).mockImplementation(() => {});
        vi.mocked(fs.statSync).mockReturnValue({ size: 100 } as any);
        vi.mocked(fs.readFileSync).mockReturnValue(
          JSON.stringify(mockValidMappings)
        );

        const result = nameResolver.attemptErrorRecovery(error, "lycaon");
        expect(result).toEqual({ ja: "ライカン", en: "Lycaon" });
      });

      it("should return null when recovery fails", () => {
        const error = new NameMappingError("Test error");

        // Mock failed recovery
        vi.mocked(fs.existsSync).mockReturnValue(false);

        const result = nameResolver.attemptErrorRecovery(error, "lycaon");
        expect(result).toBeNull();
      });

      it("should handle non-NameMappingError gracefully", () => {
        const error = new Error("Generic error");

        const result = nameResolver.attemptErrorRecovery(error, "lycaon");
        expect(result).toBeNull();
      });
    });

    describe("gracefulDegradation", () => {
      it("should provide degradation info for missing file", () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        const result = nameResolver.gracefulDegradation("lycaon");

        expect(result.mode).toBe("degraded");
        expect(result.reason).toContain(
          "名前マッピング設定ファイルが存在しません"
        );
        expect(result.suggestion).toContain("設定ファイル");
      });

      it("should provide degradation info for permission errors", () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.accessSync).mockImplementation(() => {
          throw new Error("Permission denied");
        });

        const result = nameResolver.gracefulDegradation("lycaon");

        expect(result.mode).toBe("degraded");
        expect(result.reason).toContain("読み取り権限がありません");
        expect(result.suggestion).toContain("読み取り権限を確認");
      });
    });
  });
});
