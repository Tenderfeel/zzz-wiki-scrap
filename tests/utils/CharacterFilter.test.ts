import { describe, it, expect } from "vitest";
import { CharacterFilterUtil } from "../../src/utils/CharacterFilter";
import { CharacterEntry } from "../../src/types";
import { CharacterFilter } from "../../src/config/ProcessingConfig";

describe("CharacterFilter", () => {
  const sampleEntries: CharacterEntry[] = [
    {
      id: "lycaon",
      pageId: 28,
      wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/28",
    },
    {
      id: "anby",
      pageId: 2,
      wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/2",
    },
    {
      id: "billy",
      pageId: 19,
      wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/19",
    },
    {
      id: "nicole",
      pageId: 3,
      wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/3",
    },
    {
      id: "corin",
      pageId: 4,
      wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/4",
    },
    {
      id: "soldier11",
      pageId: 100,
      wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/100",
    },
  ];

  describe("filterCharacters", () => {
    it("should return all characters when no filter is applied", () => {
      const filter: CharacterFilter = {};
      const result = CharacterFilterUtil.filterCharacters(
        sampleEntries,
        filter
      );

      expect(result.filtered).toHaveLength(sampleEntries.length);
      expect(result.excluded).toHaveLength(0);
      expect(result.statistics.filteringRate).toBe(1);
      expect(result.statistics.appliedFilters).toHaveLength(0);
    });

    it("should filter by included character IDs", () => {
      const filter: CharacterFilter = {
        includeCharacterIds: ["lycaon", "anby", "billy"],
      };
      const result = CharacterFilterUtil.filterCharacters(
        sampleEntries,
        filter
      );

      expect(result.filtered).toHaveLength(3);
      expect(result.excluded).toHaveLength(3);
      expect(result.filtered.map((e) => e.id)).toEqual([
        "lycaon",
        "anby",
        "billy",
      ]);
      expect(result.statistics.appliedFilters).toContain(
        "包含フィルター: 3件指定"
      );
    });

    it("should filter by excluded character IDs", () => {
      const filter: CharacterFilter = {
        excludeCharacterIds: ["soldier11", "corin"],
      };
      const result = CharacterFilterUtil.filterCharacters(
        sampleEntries,
        filter
      );

      expect(result.filtered).toHaveLength(4);
      expect(result.excluded).toHaveLength(2);
      expect(result.filtered.map((e) => e.id)).not.toContain("soldier11");
      expect(result.filtered.map((e) => e.id)).not.toContain("corin");
      expect(result.statistics.appliedFilters).toContain(
        "除外フィルター: 2件指定"
      );
    });

    it("should filter by page ID range", () => {
      const filter: CharacterFilter = {
        pageIdRange: {
          min: 1,
          max: 20,
        },
      };
      const result = CharacterFilterUtil.filterCharacters(
        sampleEntries,
        filter
      );

      expect(result.filtered).toHaveLength(4); // pageId 28 と 100 は除外される
      expect(result.excluded).toHaveLength(2);
      expect(result.excluded.map((e) => e.id)).toEqual(
        expect.arrayContaining(["lycaon", "soldier11"])
      );
      expect(result.statistics.appliedFilters).toContain(
        "ページID範囲フィルター: 1-20"
      );
    });

    it("should limit maximum characters", () => {
      const filter: CharacterFilter = {
        maxCharacters: 3,
      };
      const result = CharacterFilterUtil.filterCharacters(
        sampleEntries,
        filter
      );

      expect(result.filtered).toHaveLength(3);
      expect(result.excluded).toHaveLength(3);
      expect(result.statistics.appliedFilters).toContain("最大処理数制限: 3件");
    });

    it("should apply random sampling", () => {
      const filter: CharacterFilter = {
        randomSample: {
          enabled: true,
          count: 3,
          seed: 12345, // 決定的な結果のためのシード
        },
      };
      const result = CharacterFilterUtil.filterCharacters(
        sampleEntries,
        filter
      );

      expect(result.filtered).toHaveLength(3);
      expect(result.excluded).toHaveLength(3);
      expect(result.statistics.appliedFilters).toContain(
        "ランダムサンプリング: 3件"
      );

      // 同じシードで再実行すると同じ結果になることを確認
      const result2 = CharacterFilterUtil.filterCharacters(
        sampleEntries,
        filter
      );
      expect(result2.filtered.map((e) => e.id)).toEqual(
        result.filtered.map((e) => e.id)
      );
    });

    it("should apply multiple filters in sequence", () => {
      const filter: CharacterFilter = {
        excludeCharacterIds: ["soldier11"],
        pageIdRange: {
          min: 1,
          max: 50,
        },
        maxCharacters: 3,
      };
      const result = CharacterFilterUtil.filterCharacters(
        sampleEntries,
        filter
      );

      expect(result.filtered).toHaveLength(3);
      expect(result.statistics.appliedFilters).toHaveLength(3);
      expect(result.statistics.appliedFilters).toContain(
        "除外フィルター: 1件指定"
      );
      expect(result.statistics.appliedFilters).toContain(
        "ページID範囲フィルター: 1-50"
      );
      expect(result.statistics.appliedFilters).toContain("最大処理数制限: 3件");
    });
  });

  describe("validateFilterConfig", () => {
    it("should validate valid filter config", () => {
      const filter: CharacterFilter = {
        includeCharacterIds: ["lycaon", "anby"],
        pageIdRange: {
          min: 1,
          max: 100,
        },
        maxCharacters: 10,
      };

      const validation = CharacterFilterUtil.validateFilterConfig(filter);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should detect invalid page ID range", () => {
      const filter: CharacterFilter = {
        pageIdRange: {
          min: 100,
          max: 50, // min > max
        },
      };

      const validation = CharacterFilterUtil.validateFilterConfig(filter);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        "ページID範囲の最小値が最大値以上です"
      );
    });

    it("should detect conflicts between include and exclude", () => {
      const filter: CharacterFilter = {
        includeCharacterIds: ["lycaon", "anby"],
        excludeCharacterIds: ["lycaon"], // 競合
      };

      const validation = CharacterFilterUtil.validateFilterConfig(filter);

      expect(validation.warnings).toContain(
        "包含と除外で競合するキャラクターID: lycaon"
      );
    });

    it("should detect invalid random sample count", () => {
      const filter: CharacterFilter = {
        randomSample: {
          enabled: true,
          count: 0, // 無効
        },
      };

      const validation = CharacterFilterUtil.validateFilterConfig(filter);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        "ランダムサンプリングの件数は1以上である必要があります"
      );
    });
  });

  describe("previewFiltering", () => {
    it("should preview filtering results", () => {
      const filter: CharacterFilter = {
        includeCharacterIds: ["lycaon", "anby", "billy"],
        maxCharacters: 2,
      };

      const preview = CharacterFilterUtil.previewFiltering(
        sampleEntries,
        filter
      );

      expect(preview.estimatedCount).toBe(2); // maxCharacters で制限される
      expect(preview.affectedCharacters).toEqual(["lycaon", "anby", "billy"]);
      expect(preview.filterDescription).toContain("包含フィルター");
      expect(preview.filterDescription).toContain("最大処理数");
    });

    it("should handle empty filters", () => {
      const filter: CharacterFilter = {};

      const preview = CharacterFilterUtil.previewFiltering(
        sampleEntries,
        filter
      );

      expect(preview.estimatedCount).toBe(sampleEntries.length);
      expect(preview.affectedCharacters).toHaveLength(0);
      expect(preview.filterDescription).toBe("");
    });
  });

  describe("generateFilteringReport", () => {
    it("should generate comprehensive filtering report", () => {
      const filter: CharacterFilter = {
        includeCharacterIds: ["lycaon", "anby"],
        maxCharacters: 1,
      };

      const result = CharacterFilterUtil.filterCharacters(
        sampleEntries,
        filter
      );
      const report = CharacterFilterUtil.generateFilteringReport(result);

      expect(report).toContain("# キャラクターフィルタリングレポート");
      expect(report).toContain("## フィルタリング統計");
      expect(report).toContain("## 適用されたフィルター");
      expect(report).toContain("## 処理対象キャラクター");
      expect(report).toContain("## 除外されたキャラクター");
      expect(report).toContain(`元のキャラクター数: ${sampleEntries.length}`);
    });
  });
});
