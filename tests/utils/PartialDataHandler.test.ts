import { describe, it, expect, vi, beforeEach } from "vitest";
import { PartialDataHandler } from "../../src/utils/PartialDataHandler";
import { ApiResponse } from "../../src/types/api";
import { ProcessedData } from "../../src/types/processing";
import { Character } from "../../src/types/index";

// Logger のモック
vi.mock("../../src/utils/Logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("PartialDataHandler", () => {
  let partialDataHandler: PartialDataHandler;

  beforeEach(() => {
    partialDataHandler = new PartialDataHandler();
    vi.clearAllMocks();
  });

  describe("detectMissingFields", () => {
    it("should detect missing page data", () => {
      const apiDataWithoutPage: ApiResponse = {
        retcode: 0,
        message: "success",
        data: {
          page: null as any,
        },
      };

      const missingFields =
        partialDataHandler.detectMissingFields(apiDataWithoutPage);

      expect(missingFields).toContain("page");
    });

    it("should handle errors gracefully", () => {
      const invalidApiData = {
        invalid: "data",
      } as any;

      const missingFields =
        partialDataHandler.detectMissingFields(invalidApiData);

      expect(missingFields).toContain("page");
      expect(missingFields.length).toBeGreaterThan(0);
    });
  });

  describe("getEmptyValues", () => {
    it("should return appropriate empty values", () => {
      const emptyValues = partialDataHandler.getEmptyValues("test-character");

      expect(emptyValues.specialty).toBeUndefined();
      expect(emptyValues.stats).toEqual([]);
      expect(emptyValues.faction).toBe(0);
      expect(emptyValues.releaseVersion).toBe(2.4);
      expect(emptyValues.attr?.hp).toEqual([]);
    });
  });

  describe("validatePartialData", () => {
    it("should return false when basicInfo is missing", () => {
      const partialData: Partial<ProcessedData> = {
        factionInfo: { id: 0, name: "不明" },
      };

      const isValid = partialDataHandler.validatePartialData(
        partialData,
        "test-character"
      );

      expect(isValid).toBe(false);
    });

    it("should return true for valid partial data", () => {
      const partialData: Partial<ProcessedData> = {
        basicInfo: {
          id: "test-character",
          name: "Test Character",
          specialty: "支援",
          stats: "エーテル属性",
          rarity: "S",
          releaseVersion: 2.4,
        },
      };

      const isValid = partialDataHandler.validatePartialData(
        partialData,
        "test-character"
      );

      expect(isValid).toBe(true);
    });
  });

  describe("fillMissingFieldsWithEmpty", () => {
    it("should fill missing fields with empty values", () => {
      const partialCharacter: Partial<Character> = {
        id: "test-character",
        name: { ja: "テスト", en: "Test" },
      };

      const filledCharacter =
        partialDataHandler.fillMissingFieldsWithEmpty(partialCharacter);

      expect(filledCharacter.id).toBe("test-character");
      expect(filledCharacter.specialty).toBeUndefined();
      expect(filledCharacter.stats).toEqual([]);
      expect(filledCharacter.faction).toBe(0);
      expect(filledCharacter.releaseVersion).toBe(2.4);
    });
  });

  describe("createPartialCharacter", () => {
    it("should return null when basicInfo is missing", () => {
      const partialData: Partial<ProcessedData> = {
        factionInfo: { id: 0, name: "不明" },
      };

      const character = partialDataHandler.createPartialCharacter(partialData);

      expect(character).toBeNull();
    });

    it("should create character with available data", () => {
      const partialData: Partial<ProcessedData> = {
        basicInfo: {
          id: "yidhari",
          name: "Yidhari",
          specialty: "支援",
          stats: "エーテル属性",
          rarity: "S",
          releaseVersion: 2.4,
        },
        factionInfo: { id: 0, name: "不明" },
      };

      const character = partialDataHandler.createPartialCharacter(partialData);

      expect(character).not.toBeNull();
      expect(character?.id).toBe("yidhari");
      expect(character?.specialty).toBe("support");
      expect(character?.stats).toEqual(["ether"]);
    });
  });

  describe("mapping validation", () => {
    it("should map specialty terms correctly", () => {
      const specialtyMappings = [
        { ja: "撃破", en: "stun" },
        { ja: "強攻", en: "attack" },
        { ja: "支援", en: "support" },
      ];

      specialtyMappings.forEach(({ ja, en }) => {
        const partialData: Partial<ProcessedData> = {
          basicInfo: {
            id: "test",
            name: "Test",
            specialty: ja,
            stats: "炎属性",
            rarity: "S",
            releaseVersion: 2.4,
          },
        };

        const character =
          partialDataHandler.createPartialCharacter(partialData);
        expect(character?.specialty).toBe(en);
      });
    });

    it("should map stats terms correctly", () => {
      const statsMappings = [
        { ja: "氷属性", en: "ice" },
        { ja: "炎属性", en: "fire" },
        { ja: "エーテル属性", en: "ether" },
      ];

      statsMappings.forEach(({ ja, en }) => {
        const partialData: Partial<ProcessedData> = {
          basicInfo: {
            id: "test",
            name: "Test",
            specialty: "支援",
            stats: ja,
            rarity: "S",
            releaseVersion: 2.4,
          },
        };

        const character =
          partialDataHandler.createPartialCharacter(partialData);
        expect(character?.stats).toEqual([en]);
      });
    });

    it("should handle invalid rarity values", () => {
      const invalidRarities = ["B", "C", ""];

      invalidRarities.forEach((rarity) => {
        const partialData: Partial<ProcessedData> = {
          basicInfo: {
            id: "test",
            name: "Test",
            specialty: "支援",
            stats: "炎属性",
            rarity: rarity,
            releaseVersion: 2.4,
          },
        };

        const character =
          partialDataHandler.createPartialCharacter(partialData);
        expect(character?.rarity).toBeUndefined();
      });
    });
  });
});
