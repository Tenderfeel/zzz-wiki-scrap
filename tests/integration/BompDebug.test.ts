import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { BompBatchProcessor } from "../../src/processors/BompBatchProcessor";
import { HoyoLabApiClient } from "../../src/clients/HoyoLabApiClient";
import { ApiResponse } from "../../src/types/api";

describe("Bomp Debug Tests", () => {
  const testOutputDir = "debug-test-output";
  const testScrapingPath = path.join(testOutputDir, "debug-scraping.md");

  beforeEach(() => {
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  it("should debug bomp processing step by step", async () => {
    // Arrange - Create test scraping file
    const testScrapingContent = `
# Debug Scraping.md

## ボンプページリスト

- [debug-bomp](https://wiki.hoyolab.com/pc/zzz/entry/912) - デバッグボンプ
`;
    fs.writeFileSync(testScrapingPath, testScrapingContent);

    // Create proper mock API response
    const mockApiResponse: ApiResponse = {
      retcode: 0,
      message: "OK",
      data: {
        page: {
          id: "912",
          name: "デバッグボンプ",
          agent_specialties: { values: [] },
          agent_stats: { values: ["氷属性"] },
          agent_rarity: { values: [] },
          agent_faction: { values: [] },
          modules: [
            {
              name: "ascension",
              components: [
                {
                  component_id: "ascension",
                  data: JSON.stringify({
                    combatList: [
                      {
                        hp: {
                          values: [
                            "-",
                            "1000",
                            "1200",
                            "1400",
                            "1600",
                            "1800",
                            "2000",
                          ],
                        },
                        atk: {
                          values: [
                            "-",
                            "100",
                            "120",
                            "140",
                            "160",
                            "180",
                            "200",
                          ],
                        },
                        def: {
                          values: ["-", "50", "60", "70", "80", "90", "100"],
                        },
                        impact: { values: ["10"] },
                        critRate: { values: ["5%"] },
                        critDmg: { values: ["50%"] },
                        anomalyMastery: { values: ["0"] },
                        anomalyProficiency: { values: ["0"] },
                        penRatio: { values: ["0%"] },
                        energy: { values: ["100"] },
                      },
                    ],
                  }),
                },
              ],
            },
            {
              name: "baseInfo",
              components: [
                {
                  component_id: "baseInfo",
                  data: JSON.stringify({
                    faction: [1],
                  }),
                },
              ],
            },
          ],
        },
      },
    };

    // Mock the API client
    const mockFetchCharacterData = vi.fn().mockResolvedValue(mockApiResponse);
    vi.spyOn(
      HoyoLabApiClient.prototype,
      "fetchCharacterData"
    ).mockImplementation(mockFetchCharacterData);

    const batchProcessor = new BompBatchProcessor();

    // Act
    let result;
    let error;
    try {
      result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 1,
        delayMs: 10,
        maxRetries: 1,
      });
    } catch (e) {
      error = e;
    }

    // Debug assertions
    if (error) {
      throw new Error(`Processing failed with error: ${error.message}`);
    }

    expect(result).toBeDefined();
    expect(mockFetchCharacterData).toHaveBeenCalled();

    // Check if API was called with correct parameters
    expect(mockFetchCharacterData).toHaveBeenCalledWith(912, "ja-jp");

    // Check result structure
    expect(result.statistics).toBeDefined();
    expect(result.statistics.total).toBe(1);

    // If there are failures, show them with better error handling
    if (result.failed && result.failed.length > 0) {
      const failureMessages = result.failed
        .map((f) => {
          const entryId = f.entry?.id || f.bompId || "unknown";
          return `${entryId}: ${f.error}`;
        })
        .join(", ");
      throw new Error(`Processing failed for bomps: ${failureMessages}`);
    }

    expect(result.successful.length).toBe(1);
    expect(result.successful[0].id).toBe("debug-bomp");
  });

  it("should test BompListParser separately", async () => {
    // Test the parser in isolation
    const { BompListParser } = await import("../../src/parsers/BompListParser");

    const testScrapingContent = `
# Debug Scraping.md

## ボンプページリスト

- [parser-test-bomp](https://wiki.hoyolab.com/pc/zzz/entry/913) - パーサーテストボンプ
`;
    fs.writeFileSync(testScrapingPath, testScrapingContent);

    const parser = new BompListParser();
    const entries = await parser.parseScrapingFile(testScrapingPath);

    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe("parser-test-bomp");
    expect(entries[0].pageId).toBe(913);
    expect(entries[0].jaName).toBe("パーサーテストボンプ");
  });

  it("should test BompGenerator separately", async () => {
    // Test the generator in isolation
    const { BompGenerator } = await import(
      "../../src/generators/BompGenerator"
    );
    const { ProcessedBompData } = await import("../../src/types/processing");

    const processedData: ProcessedBompData = {
      basicInfo: {
        id: "generator-test-bomp",
        name: "ジェネレーターテストボンプ",
        stats: "ice", // Already mapped value from BompDataMapper
        releaseVersion: undefined,
      },
      attributesInfo: {
        ascensionData: JSON.stringify({
          list: [
            {
              key: "1",
              combatList: [
                { key: "HP", values: ["1500", "1500"] },
                { key: "攻撃力", values: ["150", "150"] },
                { key: "防御力", values: ["75", "75"] },
                { key: "衝撃力", values: ["15", "15"] },
                { key: "会心率", values: ["8%", "8%"] },
                { key: "会心ダメージ", values: ["60%", "60%"] },
                { key: "異常マスタリー", values: ["5", "5"] },
                { key: "異常掌握", values: ["10", "10"] },
                { key: "貫通率", values: ["2%", "2%"] },
                { key: "エネルギー自動回復", values: ["120", "120"] },
              ],
            },
            {
              key: "10",
              combatList: [
                { key: "HP", values: ["1800", "1800"] },
                { key: "攻撃力", values: ["180", "180"] },
                { key: "防御力", values: ["90", "90"] },
              ],
            },
            {
              key: "20",
              combatList: [
                { key: "HP", values: ["2100", "2100"] },
                { key: "攻撃力", values: ["210", "210"] },
                { key: "防御力", values: ["105", "105"] },
              ],
            },
            {
              key: "30",
              combatList: [
                { key: "HP", values: ["2400", "2400"] },
                { key: "攻撃力", values: ["240", "240"] },
                { key: "防御力", values: ["120", "120"] },
              ],
            },
            {
              key: "40",
              combatList: [
                { key: "HP", values: ["2700", "2700"] },
                { key: "攻撃力", values: ["270", "270"] },
                { key: "防御力", values: ["135", "135"] },
              ],
            },
            {
              key: "50",
              combatList: [
                { key: "HP", values: ["3000", "3000"] },
                { key: "攻撃力", values: ["300", "300"] },
                { key: "防御力", values: ["150", "150"] },
              ],
            },
            {
              key: "60",
              combatList: [
                { key: "HP", values: ["3300", "3300"] },
                { key: "攻撃力", values: ["330", "330"] },
                { key: "防御力", values: ["165", "165"] },
              ],
            },
          ],
        }),
      },
      extraAbility: "テスト追加能力",
      factionIds: [1],
    };

    const generator = new BompGenerator();
    const result = generator.generateBomp(
      processedData,
      null,
      "generator-test-bomp"
    );

    expect(result).toBeDefined();
    expect(result.id).toBe("generator-test-bomp");
    expect(result.name.ja).toBe("ジェネレーターテストボンプ");
    expect(result.stats).toEqual(["ice"]); // Should be mapped to English and in array format
  });

  it("should test BompDataProcessor separately", async () => {
    // Test the data processor in isolation
    const { BompDataProcessor } = await import(
      "../../src/processors/BompDataProcessor"
    );
    const { BompEntry } = await import("../../src/types");

    const mockApiResponse: ApiResponse = {
      retcode: 0,
      message: "OK",
      data: {
        page: {
          id: "914",
          name: "プロセッサーテストボンプ",
          agent_specialties: { values: [] },
          agent_stats: { values: ["炎属性"] },
          agent_rarity: { values: [] },
          agent_faction: { values: [] },
          modules: [
            {
              name: "ascension",
              components: [
                {
                  component_id: "ascension",
                  data: JSON.stringify({
                    combatList: [
                      {
                        hp: {
                          values: [
                            "-",
                            "1500",
                            "1800",
                            "2100",
                            "2400",
                            "2700",
                            "3000",
                          ],
                        },
                        atk: {
                          values: [
                            "-",
                            "150",
                            "180",
                            "210",
                            "240",
                            "270",
                            "300",
                          ],
                        },
                        def: {
                          values: ["-", "75", "90", "105", "120", "135", "150"],
                        },
                        impact: { values: ["15"] },
                        critRate: { values: ["8%"] },
                        critDmg: { values: ["60%"] },
                        anomalyMastery: { values: ["5"] },
                        anomalyProficiency: { values: ["10"] },
                        penRatio: { values: ["2%"] },
                        energy: { values: ["120"] },
                      },
                    ],
                  }),
                },
              ],
            },
          ],
        },
      },
    };

    const mockFetchCharacterData = vi.fn().mockResolvedValue(mockApiResponse);
    vi.spyOn(
      HoyoLabApiClient.prototype,
      "fetchCharacterData"
    ).mockImplementation(mockFetchCharacterData);

    const processor = new BompDataProcessor();
    const bompEntry: BompEntry = {
      id: "processor-test-bomp",
      pageId: 914,
      wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/914",
      jaName: "プロセッサーテストボンプ",
    };

    const result = await processor.processBompData(bompEntry);

    expect(result).toBeDefined();
    expect(result.basicInfo).toBeDefined();
    expect(result.basicInfo.id).toBe("processor-test-bomp");
    expect(result.basicInfo.name).toBe("プロセッサーテストボンプ");
  });
});
