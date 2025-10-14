import { describe, it, expect } from "vitest";
import { BompListParser } from "../../src/parsers/BompListParser";
import { BompEntry } from "../../src/types";

describe("BompListParser", () => {
  const parser = new BompListParser();

  describe("extractBompEntries", () => {
    it("should extract bomp entries from valid markdown content", () => {
      const mockContent = `
# Some header

## ボンプページリスト

- [excaliboo](https://wiki.hoyolab.com/pc/zzz/entry/912) - セイケンボンプ
- [mercury](https://wiki.hoyolab.com/pc/zzz/entry/911) - 「マーキュリー」
- [missEsme](https://wiki.hoyolab.com/pc/zzz/entry/878) - ミス・エスメ

## Other section
`;

      const entries = parser.extractBompEntries(mockContent);

      expect(entries).toHaveLength(3);
      expect(entries[0]).toEqual({
        id: "excaliboo",
        pageId: 912,
        wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/912",
        jaName: "セイケンボンプ",
      });
      expect(entries[1]).toEqual({
        id: "mercury",
        pageId: 911,
        wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/911",
        jaName: "「マーキュリー」",
      });
      expect(entries[2]).toEqual({
        id: "missEsme",
        pageId: 878,
        wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/878",
        jaName: "ミス・エスメ",
      });
    });

    it("should throw error when bomp section is not found", () => {
      const mockContent = `
# Some header

## キャラクターページリスト

- [anby](https://wiki.hoyolab.com/pc/zzz/entry/2) - pageId: 2
`;

      expect(() => parser.extractBompEntries(mockContent)).toThrow(
        "Scraping.mdからボンプページリストセクションが見つかりませんでした"
      );
    });

    it("should throw error when no valid entries are found", () => {
      const mockContent = `
## ボンプページリスト

Invalid content without proper format
`;

      expect(() => parser.extractBompEntries(mockContent)).toThrow(
        "Scraping.mdからボンプ情報を抽出できませんでした"
      );
    });

    it("should skip invalid entries and continue processing", () => {
      const mockContent = `
## ボンプページリスト

- [excaliboo](https://wiki.hoyolab.com/pc/zzz/entry/912) - セイケンボンプ
- [invalid](invalid-url) - Invalid Entry
- [mercury](https://wiki.hoyolab.com/pc/zzz/entry/911) - 「マーキュリー」
`;

      const entries = parser.extractBompEntries(mockContent);

      expect(entries).toHaveLength(2);
      expect(entries[0].id).toBe("excaliboo");
      expect(entries[1].id).toBe("mercury");
    });
  });

  describe("validateBompEntry", () => {
    it("should validate correct bomp entry", () => {
      const validEntry: BompEntry = {
        id: "excaliboo",
        pageId: 912,
        wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/912",
        jaName: "セイケンボンプ",
      };

      expect(parser.validateBompEntry(validEntry)).toBe(true);
    });

    it("should reject entry with empty id", () => {
      const invalidEntry = {
        id: "",
        pageId: 912,
        wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/912",
        jaName: "セイケンボンプ",
      };

      expect(parser.validateBompEntry(invalidEntry)).toBe(false);
    });

    it("should reject entry with invalid pageId", () => {
      const invalidEntry = {
        id: "excaliboo",
        pageId: 0,
        wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/912",
        jaName: "セイケンボンプ",
      };

      expect(parser.validateBompEntry(invalidEntry)).toBe(false);
    });

    it("should reject entry with invalid URL format", () => {
      const invalidEntry = {
        id: "excaliboo",
        pageId: 912,
        wikiUrl: "https://invalid-url.com/entry/912",
        jaName: "セイケンボンプ",
      };

      expect(parser.validateBompEntry(invalidEntry)).toBe(false);
    });

    it("should reject entry with empty jaName", () => {
      const invalidEntry = {
        id: "excaliboo",
        pageId: 912,
        wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/912",
        jaName: "",
      };

      expect(parser.validateBompEntry(invalidEntry)).toBe(false);
    });

    it("should reject entry with invalid id characters", () => {
      const invalidEntry = {
        id: "invalid@id",
        pageId: 912,
        wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/912",
        jaName: "セイケンボンプ",
      };

      expect(parser.validateBompEntry(invalidEntry)).toBe(false);
    });

    it("should accept entry with valid id characters (alphanumeric, hyphen, underscore)", () => {
      const validEntries = [
        {
          id: "test-bomp",
          pageId: 912,
          wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/912",
          jaName: "テストボンプ",
        },
        {
          id: "test_bomp",
          pageId: 912,
          wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/912",
          jaName: "テストボンプ",
        },
        {
          id: "testBomp123",
          pageId: 912,
          wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/912",
          jaName: "テストボンプ",
        },
      ];

      validEntries.forEach((entry) => {
        expect(parser.validateBompEntry(entry)).toBe(true);
      });
    });
  });
});
