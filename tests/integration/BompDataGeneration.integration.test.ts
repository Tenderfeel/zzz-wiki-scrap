import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { main, loadConfig } from "../../src/main-bomp-generation";
import { BompBatchProcessor } from "../../src/processors/BompBatchProcessor";
import { BompGenerator } from "../../src/generators/BompGenerator";
import { HoyoLabApiClient } from "../../src/clients/HoyoLabApiClient";
import { Bomp } from "../../src/types";
import { performance } from "perf_hooks";
import { ApiResponse } from "../../src/types/api";

// Helper function to create proper mock API responses
function createMockApiResponse(
  id: string,
  name: string,
  stats: string = "氷属性"
): ApiResponse {
  return {
    retcode: 0,
    message: "OK",
    data: {
      page: {
        id,
        name,
        agent_specialties: { values: [] },
        agent_stats: { values: [stats] },
        agent_rarity: { values: [] },
        agent_faction: { values: [] },
        modules: [
          {
            name: "ascension",
            components: [
              {
                component_id: "ascension",
                data: JSON.stringify({
                  list: [
                    {
                      key: "1",
                      combatList: [
                        { key: "HP", values: ["1000", "1000"] },
                        { key: "攻撃力", values: ["100", "100"] },
                        { key: "防御力", values: ["50", "50"] },
                        { key: "衝撃力", values: ["10", "10"] },
                        { key: "会心率", values: ["5%", "5%"] },
                        { key: "会心ダメージ", values: ["50%", "50%"] },
                        { key: "異常マスタリー", values: ["0", "0"] },
                        { key: "異常掌握", values: ["0", "0"] },
                        { key: "貫通率", values: ["0%", "0%"] },
                        { key: "エネルギー自動回復", values: ["100", "100"] },
                      ],
                    },
                    {
                      key: "10",
                      combatList: [
                        { key: "HP", values: ["1200", "1200"] },
                        { key: "攻撃力", values: ["120", "120"] },
                        { key: "防御力", values: ["60", "60"] },
                      ],
                    },
                    {
                      key: "20",
                      combatList: [
                        { key: "HP", values: ["1400", "1400"] },
                        { key: "攻撃力", values: ["140", "140"] },
                        { key: "防御力", values: ["70", "70"] },
                      ],
                    },
                    {
                      key: "30",
                      combatList: [
                        { key: "HP", values: ["1600", "1600"] },
                        { key: "攻撃力", values: ["160", "160"] },
                        { key: "防御力", values: ["80", "80"] },
                      ],
                    },
                    {
                      key: "40",
                      combatList: [
                        { key: "HP", values: ["1800", "1800"] },
                        { key: "攻撃力", values: ["180", "180"] },
                        { key: "防御力", values: ["90", "90"] },
                      ],
                    },
                    {
                      key: "50",
                      combatList: [
                        { key: "HP", values: ["2000", "2000"] },
                        { key: "攻撃力", values: ["200", "200"] },
                        { key: "防御力", values: ["100", "100"] },
                      ],
                    },
                    {
                      key: "60",
                      combatList: [
                        { key: "HP", values: ["2200", "2200"] },
                        { key: "攻撃力", values: ["220", "220"] },
                        { key: "防御力", values: ["110", "110"] },
                      ],
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
}

describe("Bomp Data Generation Integration", () => {
  const testOutputDir = "test-output";
  const testConfigPath = path.join(testOutputDir, "test-config.json");
  const testScrapingPath = path.join(testOutputDir, "test-scraping.md");
  const testOutputPath = path.join(testOutputDir, "test-bomps.ts");
  const performanceReportPath = path.join(
    testOutputDir,
    "performance-report.json"
  );

  // Performance tracking
  let memoryUsageStart: NodeJS.MemoryUsage;
  let performanceMetrics: {
    startTime: number;
    endTime?: number;
    memoryUsage: {
      start: NodeJS.MemoryUsage;
      end?: NodeJS.MemoryUsage;
      peak?: NodeJS.MemoryUsage;
    };
    apiCallCount: number;
    processedBomps: number;
  };

  beforeEach(() => {
    // Performance tracking initialization
    memoryUsageStart = process.memoryUsage();
    performanceMetrics = {
      startTime: performance.now(),
      memoryUsage: {
        start: memoryUsageStart,
      },
      apiCallCount: 0,
      processedBomps: 0,
    };

    // テスト用ディレクトリを作成
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }

    // テスト用設定ファイルを作成
    const testConfig = {
      batchSize: 1,
      delayMs: 10,
      maxRetries: 1,
      scrapingFilePath: testScrapingPath,
      outputFilePath: testOutputPath,
      enableReportGeneration: false,
      enableValidation: false,
      enableDebugMode: false,
    };
    fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

    // テスト用Scraping.mdファイルを作成
    const testScrapingContent = `
# テストScraping.md

## ボンプページリスト

- [test-bomp-1](https://wiki.hoyolab.com/pc/zzz/entry/912) - テストボンプ1
- [test-bomp-2](https://wiki.hoyolab.com/pc/zzz/entry/913) - テストボンプ2

## その他のセクション

他の内容...
`;
    fs.writeFileSync(testScrapingPath, testScrapingContent);
  });

  afterEach(() => {
    // Performance tracking finalization
    performanceMetrics.endTime = performance.now();
    performanceMetrics.memoryUsage.end = process.memoryUsage();

    // Save performance report
    const performanceReport = {
      testName: expect.getState().currentTestName || "unknown",
      duration: performanceMetrics.endTime - performanceMetrics.startTime,
      memoryUsage: {
        start: performanceMetrics.memoryUsage.start,
        end: performanceMetrics.memoryUsage.end,
        peak: performanceMetrics.memoryUsage.peak,
        heapUsedDelta:
          performanceMetrics.memoryUsage.end!.heapUsed -
          performanceMetrics.memoryUsage.start.heapUsed,
        rssUsedDelta:
          performanceMetrics.memoryUsage.end!.rss -
          performanceMetrics.memoryUsage.start.rss,
      },
      apiCallCount: performanceMetrics.apiCallCount,
      processedBomps: performanceMetrics.processedBomps,
      timestamp: new Date().toISOString(),
    };

    // Append to performance report file
    const existingReports = fs.existsSync(performanceReportPath)
      ? JSON.parse(fs.readFileSync(performanceReportPath, "utf-8"))
      : [];
    existingReports.push(performanceReport);
    fs.writeFileSync(
      performanceReportPath,
      JSON.stringify(existingReports, null, 2)
    );

    // テストファイルをクリーンアップ
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  describe("loadConfig", () => {
    it("should load configuration from file", () => {
      // Act
      const config = loadConfig(testConfigPath);

      // Assert
      expect(config.batchSize).toBe(1);
      expect(config.delayMs).toBe(10);
      expect(config.maxRetries).toBe(1);
      expect(config.scrapingFilePath).toBe(testScrapingPath);
      expect(config.outputFilePath).toBe(testOutputPath);
    });

    it("should handle non-existent config file gracefully", () => {
      // Act - try to load a config file that definitely doesn't exist
      const config = loadConfig("definitely-does-not-exist-12345.json");

      // Assert - should return some valid config (either defaults or fallback)
      expect(config).toBeDefined();
      expect(typeof config.batchSize).toBe("number");
      expect(typeof config.delayMs).toBe("number");
      expect(typeof config.maxRetries).toBe("number");
      expect(typeof config.scrapingFilePath).toBe("string");
      expect(typeof config.outputFilePath).toBe("string");
    });

    it("should handle malformed JSON gracefully", () => {
      // Arrange
      const malformedConfigPath = path.join(testOutputDir, "malformed.json");
      fs.writeFileSync(malformedConfigPath, "{ invalid json }");

      // Act
      const config = loadConfig(malformedConfigPath);

      // Assert
      expect(config.batchSize).toBe(5); // デフォルト値
    });
  });

  describe("main function", () => {
    it("should handle missing scraping file gracefully", async () => {
      // Arrange
      const configWithMissingFile = {
        batchSize: 1,
        delayMs: 10,
        maxRetries: 1,
        scrapingFilePath: "non-existent-scraping.md",
        outputFilePath: testOutputPath,
        enableReportGeneration: false,
        enableValidation: false,
        enableDebugMode: false,
      };
      fs.writeFileSync(
        testConfigPath,
        JSON.stringify(configWithMissingFile, null, 2)
      );

      // グローバル設定パスを設定
      (global as any).configPath = testConfigPath;

      // Act & Assert
      await expect(main()).rejects.toThrow();
    });

    it("should handle empty bomp list gracefully", async () => {
      // Arrange
      const emptyScrapingContent = `
# テストScraping.md

## ボンプページリスト

## その他のセクション

他の内容...
`;
      fs.writeFileSync(testScrapingPath, emptyScrapingContent);

      // グローバル設定パスを設定
      (global as any).configPath = testConfigPath;

      // Act & Assert
      await expect(main()).rejects.toThrow();
    });
  });

  describe("configuration validation", () => {
    it("should handle bomp-specific configuration", () => {
      // Arrange
      const configWithBompSection = {
        general: {
          someOtherSetting: true,
        },
        bomp: {
          batchSize: 3,
          delayMs: 100,
          maxRetries: 2,
          scrapingFilePath: testScrapingPath,
          outputFilePath: testOutputPath,
        },
      };
      fs.writeFileSync(
        testConfigPath,
        JSON.stringify(configWithBompSection, null, 2)
      );

      // Act
      const config = loadConfig(testConfigPath);

      // Assert
      expect(config.batchSize).toBe(3);
      expect(config.delayMs).toBe(100);
      expect(config.maxRetries).toBe(2);
    });

    it("should merge with default configuration", () => {
      // Arrange
      const partialConfig = {
        batchSize: 10,
        // delayMs は指定しない（デフォルト値を使用）
      };
      fs.writeFileSync(testConfigPath, JSON.stringify(partialConfig, null, 2));

      // Act
      const config = loadConfig(testConfigPath);

      // Assert
      expect(config.batchSize).toBe(10); // 指定した値
      expect(config.delayMs).toBe(500); // デフォルト値
      expect(config.maxRetries).toBe(3); // デフォルト値
    });
  });

  // End-to-End Processing Tests
  describe("End-to-End Processing", () => {
    it("should process complete bomp data pipeline from scraping to output", async () => {
      // Arrange
      const realScrapingContent = `
# Scraping.md

## ボンプページリスト

- [test-bomp](https://wiki.hoyolab.com/pc/zzz/entry/912) - テストボンプ
`;
      fs.writeFileSync(testScrapingPath, realScrapingContent);

      const batchProcessor = new BompBatchProcessor();
      const bompGenerator = new BompGenerator();

      // Mock API responses to avoid real API calls
      const mockApiResponse = createMockApiResponse("912", "テストボンプ");

      // Mock HoyoLabApiClient
      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockResolvedValue(mockApiResponse);

      // Act
      const startTime = performance.now();
      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 1,
        delayMs: 10,
        maxRetries: 1,
      });

      performanceMetrics.processedBomps = result.successful.length;
      performanceMetrics.apiCallCount = result.successful.length * 2; // ja + en calls

      // Generate output file
      if (result.successful.length > 0) {
        bompGenerator.outputBompFile(result.successful, testOutputPath);
      }

      const endTime = performance.now();

      // Debug information
      console.log("Test Debug Info:");
      console.log("- Successful bomps:", result.successful.length);
      console.log("- Failed bomps:", result.failed.length);
      console.log("- Total bomps:", result.statistics.total);
      if (result.failed.length > 0) {
        console.log(
          "- Failed bomp errors:",
          result.failed.map((f) => f.error)
        );
      }

      // Assert
      expect(result.successful.length).toBeGreaterThan(0);
      expect(result.statistics.total).toBe(1);
      expect(fs.existsSync(testOutputPath)).toBe(true);

      // Verify output file content
      const outputContent = fs.readFileSync(testOutputPath, "utf-8");
      expect(outputContent).toContain("export default");
      expect(outputContent).toContain("test-bomp");

      // Performance assertions
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it("should handle large bomp dataset processing", async () => {
      // Arrange - Create a larger dataset
      const largeBompList = Array.from(
        { length: 10 },
        (_, i) =>
          `- [test-bomp-${i + 1}](https://wiki.hoyolab.com/pc/zzz/entry/${
            912 + i
          }) - テストボンプ${i + 1}`
      ).join("\n");

      const largeScrapingContent = `
# Scraping.md

## ボンプページリスト

${largeBompList}
`;
      fs.writeFileSync(testScrapingPath, largeScrapingContent);

      const batchProcessor = new BompBatchProcessor();

      // Mock API responses
      const mockApiResponse = createMockApiResponse("912", "テストボンプ");

      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockResolvedValue(mockApiResponse);

      // Act
      const startTime = performance.now();
      const memoryBefore = process.memoryUsage();

      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 3,
        delayMs: 10,
        maxRetries: 1,
      });

      const endTime = performance.now();
      const memoryAfter = process.memoryUsage();

      performanceMetrics.processedBomps = result.successful.length;
      performanceMetrics.memoryUsage.peak = memoryAfter;

      // Assert
      expect(result.successful.length).toBe(10);
      expect(result.statistics.total).toBe(10);

      // Performance assertions
      const processingTime = endTime - startTime;
      const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;

      expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Should not use more than 100MB additional memory
    });

    it("should maintain data integrity throughout the pipeline", async () => {
      // Arrange
      const testScrapingContent = `
# Scraping.md

## ボンプページリスト

- [integrity-test-bomp](https://wiki.hoyolab.com/pc/zzz/entry/912) - 整合性テストボンプ
`;
      fs.writeFileSync(testScrapingPath, testScrapingContent);

      const mockApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "912",
            name: "整合性テストボンプ",
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

      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockResolvedValue(mockApiResponse);

      const batchProcessor = new BompBatchProcessor();
      const bompGenerator = new BompGenerator();

      // Act
      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 1,
        delayMs: 10,
        maxRetries: 1,
      });

      bompGenerator.outputBompFile(result.successful, testOutputPath);

      // Assert - Verify data integrity
      expect(result.successful.length).toBe(1);
      const bomp = result.successful[0];

      // Verify basic structure
      expect(bomp.id).toBe("integrity-test-bomp");
      expect(bomp.name).toHaveProperty("ja");
      expect(bomp.name).toHaveProperty("en");

      // Verify attributes arrays have correct length
      expect(bomp.attr.hp).toHaveLength(7);
      expect(bomp.attr.atk).toHaveLength(7);
      expect(bomp.attr.def).toHaveLength(7);

      // Verify specific values
      expect(bomp.attr.hp[1]).toBe(1000);
      expect(bomp.attr.atk[1]).toBe(100);
      expect(bomp.attr.def[1]).toBe(50);
      expect(bomp.attr.impact).toBe(15);
      expect(bomp.attr.critRate).toBe(8);
      expect(bomp.attr.critDmg).toBe(60);

      // Verify output file contains correct data
      const outputContent = fs.readFileSync(testOutputPath, "utf-8");
      expect(outputContent).toContain('"id": "integrity-test-bomp"');
      expect(outputContent).toContain('"impact": 15');
      expect(outputContent).toContain('"critRate": 8');
    });
  });

  // API Integration Tests
  describe("API Integration", () => {
    it("should handle API rate limiting gracefully", async () => {
      // Arrange
      const testScrapingContent = `
# Scraping.md

## ボンプページリスト

- [rate-limit-test-1](https://wiki.hoyolab.com/pc/zzz/entry/912) - レート制限テスト1
- [rate-limit-test-2](https://wiki.hoyolab.com/pc/zzz/entry/913) - レート制限テスト2
- [rate-limit-test-3](https://wiki.hoyolab.com/pc/zzz/entry/914) - レート制限テスト3
`;
      fs.writeFileSync(testScrapingPath, testScrapingContent);

      let callCount = 0;
      const mockApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "912",
            name: "レート制限テスト",
            agent_specialties: { values: [] },
            agent_stats: { values: ["氷属性"] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [],
          },
        },
      };

      // Mock API with delay simulation
      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockImplementation(async () => {
        callCount++;
        performanceMetrics.apiCallCount = callCount;

        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 50));
        return mockApiResponse;
      });

      const batchProcessor = new BompBatchProcessor();

      // Act
      const startTime = performance.now();
      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 2,
        delayMs: 100, // Ensure proper delay between requests
        maxRetries: 1,
      });
      const endTime = performance.now();

      // Assert
      expect(result.successful.length).toBe(3);
      expect(callCount).toBeGreaterThan(0);

      // Verify that rate limiting delay was respected
      const processingTime = endTime - startTime;
      expect(processingTime).toBeGreaterThan(200); // Should take at least 200ms due to delays
    });

    it("should handle API errors and retry logic", async () => {
      // Arrange
      const testScrapingContent = `
# Scraping.md

## ボンプページリスト

- [error-test-bomp](https://wiki.hoyolab.com/pc/zzz/entry/912) - エラーテストボンプ
`;
      fs.writeFileSync(testScrapingPath, testScrapingContent);

      let attemptCount = 0;
      const mockApiClient = vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      );

      mockApiClient.mockImplementation(async () => {
        attemptCount++;
        performanceMetrics.apiCallCount = attemptCount;

        if (attemptCount <= 2) {
          // First two attempts fail
          throw new Error("API Error: Rate limit exceeded");
        }

        // Third attempt succeeds
        return {
          retcode: 0,
          message: "OK",
          data: {
            page: {
              id: "912",
              name: "エラーテストボンプ",
              agent_specialties: { values: [] },
              agent_stats: { values: ["氷属性"] },
              agent_rarity: { values: [] },
              agent_faction: { values: [] },
              modules: [],
            },
          },
        };
      });

      const batchProcessor = new BompBatchProcessor();

      // Act
      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 1,
        delayMs: 10,
        maxRetries: 3,
      });

      // Assert
      expect(attemptCount).toBe(3); // Should retry twice before succeeding
      expect(result.successful.length).toBe(1);
      expect(result.failed.length).toBe(0);
    });

    it("should handle malformed API responses gracefully", async () => {
      // Arrange
      const testScrapingContent = `
# Scraping.md

## ボンプページリスト

- [malformed-test-bomp](https://wiki.hoyolab.com/pc/zzz/entry/912) - 不正形式テストボンプ
`;
      fs.writeFileSync(testScrapingPath, testScrapingContent);

      // Mock API with malformed response
      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockResolvedValue({
        retcode: 0,
        message: "OK",
        data: {
          page: {
            // Missing required fields
            id: null as any,
            name: undefined as any,
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: "invalid_format" as any,
          },
        },
      } as any);

      const batchProcessor = new BompBatchProcessor();

      // Act
      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 1,
        delayMs: 10,
        maxRetries: 1,
      });

      // Assert
      expect(result.failed.length).toBe(1);
      expect(result.failed[0].error).toContain("処理中にエラーが発生");
      expect(result.successful.length).toBe(0);
    });
  });

  // Performance and Memory Tests
  describe("Performance and Memory", () => {
    it("should complete processing within acceptable time limits", async () => {
      // Arrange
      const performanceTestContent = `
# Scraping.md

## ボンプページリスト

${Array.from(
  { length: 5 },
  (_, i) =>
    `- [perf-test-bomp-${i + 1}](https://wiki.hoyolab.com/pc/zzz/entry/${
      912 + i
    }) - パフォーマンステストボンプ${i + 1}`
).join("\n")}
`;
      fs.writeFileSync(testScrapingPath, performanceTestContent);

      const mockApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "912",
            name: "パフォーマンステストボンプ",
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
            ],
          },
        },
      };

      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockResolvedValue(mockApiResponse);

      const batchProcessor = new BompBatchProcessor();

      // Act
      const startTime = performance.now();
      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 2,
        delayMs: 50,
        maxRetries: 1,
      });
      const endTime = performance.now();

      performanceMetrics.processedBomps = result.successful.length;

      // Assert
      const processingTime = endTime - startTime;
      const timePerBomp = processingTime / result.successful.length;

      expect(result.successful.length).toBe(5);
      expect(processingTime).toBeLessThan(3000); // Should complete within 3 seconds
      expect(timePerBomp).toBeLessThan(600); // Should process each bomp within 600ms
    });

    it("should maintain reasonable memory usage during processing", async () => {
      // Arrange
      const memoryTestContent = `
# Scraping.md

## ボンプページリスト

${Array.from(
  { length: 8 },
  (_, i) =>
    `- [memory-test-bomp-${i + 1}](https://wiki.hoyolab.com/pc/zzz/entry/${
      912 + i
    }) - メモリテストボンプ${i + 1}`
).join("\n")}
`;
      fs.writeFileSync(testScrapingPath, memoryTestContent);

      // Create a larger mock response to test memory usage
      const largeMockData = {
        combatList: Array.from({ length: 10 }, () => ({
          hp: { values: ["-", "1000", "1200", "1400", "1600", "1800", "2000"] },
          atk: { values: ["-", "100", "120", "140", "160", "180", "200"] },
          def: { values: ["-", "50", "60", "70", "80", "90", "100"] },
          impact: { values: ["10"] },
          critRate: { values: ["5%"] },
          critDmg: { values: ["50%"] },
          anomalyMastery: { values: ["0"] },
          anomalyProficiency: { values: ["0"] },
          penRatio: { values: ["0%"] },
          energy: { values: ["100"] },
        })),
      };

      const mockApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "912",
            name: "メモリテストボンプ",
            modules: [
              {
                name: "ascension",
                components: [
                  {
                    component_id: "ascension",
                    data: JSON.stringify(largeMockData),
                  },
                ],
              },
            ],
          },
        },
      };

      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockResolvedValue(mockApiResponse);

      const batchProcessor = new BompBatchProcessor();

      // Act
      const memoryBefore = process.memoryUsage();

      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 3,
        delayMs: 10,
        maxRetries: 1,
      });

      const memoryAfter = process.memoryUsage();
      performanceMetrics.memoryUsage.peak = memoryAfter;

      // Assert
      const heapUsedIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;
      const rssIncrease = memoryAfter.rss - memoryBefore.rss;

      expect(result.successful.length).toBe(8);
      expect(heapUsedIncrease).toBeLessThan(50 * 1024 * 1024); // Should not increase heap by more than 50MB
      expect(rssIncrease).toBeLessThan(100 * 1024 * 1024); // Should not increase RSS by more than 100MB
    });

    it("should generate comprehensive performance report", async () => {
      // Arrange
      const reportTestContent = `
# Scraping.md

## ボンプページリスト

- [report-test-bomp](https://wiki.hoyolab.com/pc/zzz/entry/912) - レポートテストボンプ
`;
      fs.writeFileSync(testScrapingPath, reportTestContent);

      const mockApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "912",
            name: "レポートテストボンプ",
            modules: [],
          },
        },
      };

      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockResolvedValue(mockApiResponse);

      const batchProcessor = new BompBatchProcessor();

      // Act
      const startTime = performance.now();
      const memoryBefore = process.memoryUsage();

      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 1,
        delayMs: 10,
        maxRetries: 1,
      });

      const endTime = performance.now();
      const memoryAfter = process.memoryUsage();

      // Generate performance report
      const performanceReport = {
        testSuite: "Bomp Data Generation Integration",
        timestamp: new Date().toISOString(),
        processingTime: endTime - startTime,
        memoryUsage: {
          before: memoryBefore,
          after: memoryAfter,
          increase: {
            heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
            rss: memoryAfter.rss - memoryBefore.rss,
          },
        },
        bompsProcessed: result.successful.length,
        apiCalls: result.successful.length * 2, // ja + en
        successRate: result.successful.length / result.statistics.total,
        averageTimePerBomp: (endTime - startTime) / result.successful.length,
      };

      const reportPath = path.join(
        testOutputDir,
        "integration-performance-report.json"
      );
      fs.writeFileSync(reportPath, JSON.stringify(performanceReport, null, 2));

      // Assert
      expect(fs.existsSync(reportPath)).toBe(true);
      expect(performanceReport.bompsProcessed).toBe(1);
      expect(performanceReport.successRate).toBe(1);
      expect(performanceReport.processingTime).toBeGreaterThan(0);
      expect(performanceReport.averageTimePerBomp).toBeGreaterThan(0);
    });
  });
});
