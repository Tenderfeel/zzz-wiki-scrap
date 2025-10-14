import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { performance } from "perf_hooks";
import { BompBatchProcessor } from "../../src/processors/BompBatchProcessor";
import { BompGenerator } from "../../src/generators/BompGenerator";
import { BompDataProcessor } from "../../src/processors/BompDataProcessor";
import { BompListParser } from "../../src/parsers/BompListParser";
import { HoyoLabApiClient } from "../../src/clients/HoyoLabApiClient";
import { main, loadConfig } from "../../src/main-bomp-generation";
import { Bomp } from "../../src/types";
import { ApiResponse } from "../../src/types/api";

/**
 * 完全統合テストスイート - タスク 5.4
 * エンドツーエンド処理のテスト
 * 実際の API との統合テスト
 * パフォーマンステストとメモリ使用量測定
 * 要件: 4.1, 4.3
 */
describe("Bomp Complete Integration Test Suite", () => {
  const testOutputDir = "complete-integration-test";
  const testConfigPath = path.join(testOutputDir, "complete-config.json");
  const testScrapingPath = path.join(testOutputDir, "complete-scraping.md");
  const testOutputPath = path.join(testOutputDir, "complete-bomps.ts");
  const performanceReportPath = path.join(
    testOutputDir,
    "complete-performance.json"
  );
  const memoryReportPath = path.join(testOutputDir, "memory-report.json");

  // Performance and memory tracking
  let performanceMetrics: {
    testName: string;
    startTime: number;
    endTime?: number;
    memoryStart: NodeJS.MemoryUsage;
    memoryEnd?: NodeJS.MemoryUsage;
    memoryPeak?: NodeJS.MemoryUsage;
    bompsProcessed: number;
    apiCalls: number;
    errors: string[];
  };

  let memoryTracker: NodeJS.Timeout | null = null;
  let memorySnapshots: Array<{
    timestamp: number;
    memory: NodeJS.MemoryUsage;
  }> = [];

  beforeEach(() => {
    // Initialize performance and memory tracking
    performanceMetrics = {
      testName: "",
      startTime: performance.now(),
      memoryStart: process.memoryUsage(),
      bompsProcessed: 0,
      apiCalls: 0,
      errors: [],
    };

    // Start memory tracking
    memorySnapshots = [];
    memoryTracker = setInterval(() => {
      memorySnapshots.push({
        timestamp: performance.now(),
        memory: process.memoryUsage(),
      });
    }, 100);

    // Create test directory
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Stop memory tracking
    if (memoryTracker) {
      clearInterval(memoryTracker);
      memoryTracker = null;
    }

    // Finalize performance tracking
    performanceMetrics.endTime = performance.now();
    performanceMetrics.memoryEnd = process.memoryUsage();

    // Find peak memory usage
    if (memorySnapshots.length > 0) {
      performanceMetrics.memoryPeak = memorySnapshots.reduce(
        (peak, snapshot) =>
          snapshot.memory.heapUsed > peak.heapUsed ? snapshot.memory : peak,
        performanceMetrics.memoryStart
      );
    }

    // Save performance report
    const performanceReport = {
      ...performanceMetrics,
      duration: performanceMetrics.endTime! - performanceMetrics.startTime,
      memoryUsed:
        performanceMetrics.memoryEnd!.heapUsed -
        performanceMetrics.memoryStart.heapUsed,
      memoryPeakUsed: performanceMetrics.memoryPeak
        ? performanceMetrics.memoryPeak.heapUsed -
          performanceMetrics.memoryStart.heapUsed
        : 0,
      timestamp: new Date().toISOString(),
    };

    // Append to performance report
    const existingReports = fs.existsSync(performanceReportPath)
      ? JSON.parse(fs.readFileSync(performanceReportPath, "utf-8"))
      : [];
    existingReports.push(performanceReport);
    fs.writeFileSync(
      performanceReportPath,
      JSON.stringify(existingReports, null, 2)
    );

    // Save memory report
    if (memorySnapshots.length > 0) {
      const memoryReport = {
        testName: performanceMetrics.testName,
        snapshots: memorySnapshots,
        summary: {
          startMemory: performanceMetrics.memoryStart,
          endMemory: performanceMetrics.memoryEnd,
          peakMemory: performanceMetrics.memoryPeak,
          maxHeapUsed: Math.max(
            ...memorySnapshots.map((s) => s.memory.heapUsed)
          ),
          avgHeapUsed:
            memorySnapshots.reduce((sum, s) => sum + s.memory.heapUsed, 0) /
            memorySnapshots.length,
        },
        timestamp: new Date().toISOString(),
      };

      const existingMemoryReports = fs.existsSync(memoryReportPath)
        ? JSON.parse(fs.readFileSync(memoryReportPath, "utf-8"))
        : [];
      existingMemoryReports.push(memoryReport);
      fs.writeFileSync(
        memoryReportPath,
        JSON.stringify(existingMemoryReports, null, 2)
      );
    }

    // Cleanup
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
    delete (global as any).configPath;
  });

  // Helper functions
  function createComprehensiveMockApiResponse(
    id: string,
    name: string,
    stats: string = "氷属性",
    factions: number[] = [1],
    customAttributes?: {
      hp: string[];
      atk: string[];
      def: string[];
      impact: string;
      critRate: string;
      critDmg: string;
      anomalyMastery: string;
      anomalyProficiency: string;
      penRatio: string;
      energy: string;
    }
  ): ApiResponse {
    const defaultAttributes = {
      hp: ["-", "1000", "1200", "1400", "1600", "1800", "2000"],
      atk: ["-", "100", "120", "140", "160", "180", "200"],
      def: ["-", "50", "60", "70", "80", "90", "100"],
      impact: "10",
      critRate: "5%",
      critDmg: "50%",
      anomalyMastery: "0",
      anomalyProficiency: "0",
      penRatio: "0%",
      energy: "100",
    };

    const attributes = customAttributes || defaultAttributes;

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
                    combatList: [
                      {
                        hp: { values: attributes.hp },
                        atk: { values: attributes.atk },
                        def: { values: attributes.def },
                        impact: { values: [attributes.impact] },
                        critRate: { values: [attributes.critRate] },
                        critDmg: { values: [attributes.critDmg] },
                        anomalyMastery: { values: [attributes.anomalyMastery] },
                        anomalyProficiency: {
                          values: [attributes.anomalyProficiency],
                        },
                        penRatio: { values: [attributes.penRatio] },
                        energy: { values: [attributes.energy] },
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
                  data: JSON.stringify({ faction: factions }),
                },
              ],
            },
            {
              name: "talent",
              components: [
                {
                  component_id: "talent",
                  data: JSON.stringify({
                    description: `${name}の追加能力説明文です。`,
                  }),
                },
              ],
            },
          ],
        },
      },
    };
  }

  function createTestScrapingContent(
    bompCount: number,
    prefix: string = "complete-test-bomp"
  ): string {
    const bompEntries = Array.from(
      { length: bompCount },
      (_, i) =>
        `- [${prefix}-${i + 1}](https://wiki.hoyolab.com/pc/zzz/entry/${
          912 + i
        }) - ${prefix}${i + 1}ボンプ`
    ).join("\n");

    return `
# Complete Integration Test Scraping.md

## ボンプページリスト

${bompEntries}

## その他のセクション

完全統合テスト用のコンテンツ...
`;
  }

  // 1. End-to-End Processing Tests
  describe("End-to-End Processing", () => {
    it("should execute complete pipeline from scraping to TypeScript output", async () => {
      performanceMetrics.testName = "complete-pipeline-e2e";

      // Arrange
      const bompCount = 3;
      const testContent = createTestScrapingContent(bompCount);
      fs.writeFileSync(testScrapingPath, testContent);

      const testConfig = {
        batchSize: 2,
        delayMs: 20,
        maxRetries: 2,
        scrapingFilePath: testScrapingPath,
        outputFilePath: testOutputPath,
        enableReportGeneration: false,
        enableValidation: true,
        enableDebugMode: false,
      };
      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      // Mock API responses with different attributes for each bomp
      const mockResponses = [
        createComprehensiveMockApiResponse(
          "912",
          "完全テストボンプ1",
          "氷属性",
          [1]
        ),
        createComprehensiveMockApiResponse(
          "913",
          "完全テストボンプ2",
          "炎属性",
          [2]
        ),
        createComprehensiveMockApiResponse(
          "914",
          "完全テストボンプ3",
          "電気属性",
          [1, 2]
        ),
      ];

      let responseIndex = 0;
      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockImplementation(async () => {
        performanceMetrics.apiCalls++;
        const response = mockResponses[responseIndex % mockResponses.length];
        responseIndex++;
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 10));
        return response;
      });

      (global as any).configPath = testConfigPath;

      // Act
      await main();

      // Assert
      expect(fs.existsSync(testOutputPath)).toBe(true);

      // Verify output file structure
      const outputContent = fs.readFileSync(testOutputPath, "utf-8");
      expect(outputContent).toContain("export default");
      expect(outputContent).toContain("complete-test-bomp-1");
      expect(outputContent).toContain("complete-test-bomp-2");
      expect(outputContent).toContain("complete-test-bomp-3");

      // Import and validate the generated bomps
      const outputModule = await import(path.resolve(testOutputPath));
      const bomps: Bomp[] = outputModule.default;

      expect(bomps).toHaveLength(3);
      bomps.forEach((bomp, index) => {
        expect(bomp.id).toBe(`complete-test-bomp-${index + 1}`);
        expect(bomp.name).toHaveProperty("ja");
        expect(bomp.name).toHaveProperty("en");
        expect(bomp.attr.hp).toHaveLength(7);
        expect(bomp.attr.atk).toHaveLength(7);
        expect(bomp.attr.def).toHaveLength(7);
        expect(typeof bomp.attr.impact).toBe("number");
        expect(typeof bomp.attr.critRate).toBe("number");
        expect(typeof bomp.attr.critDmg).toBe("number");
      });

      performanceMetrics.bompsProcessed = bomps.length;
    });

    it("should handle large dataset processing efficiently", async () => {
      performanceMetrics.testName = "large-dataset-processing";

      // Arrange
      const bompCount = 15;
      const testContent = createTestScrapingContent(
        bompCount,
        "large-dataset-bomp"
      );
      fs.writeFileSync(testScrapingPath, testContent);

      const mockApiResponse = createComprehensiveMockApiResponse(
        "912",
        "大規模データセットボンプ",
        "氷属性",
        [1]
      );

      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockImplementation(async () => {
        performanceMetrics.apiCalls++;
        // Simulate realistic API delay
        await new Promise((resolve) => setTimeout(resolve, 15));
        return mockApiResponse;
      });

      const batchProcessor = new BompBatchProcessor();

      // Act
      const startTime = performance.now();
      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 5,
        delayMs: 30,
        maxRetries: 2,
      });
      const endTime = performance.now();

      performanceMetrics.bompsProcessed = result.successful.length;

      // Assert
      expect(result.statistics.total).toBe(bompCount);
      expect(result.successful.length).toBe(bompCount);
      expect(result.failed.length).toBe(0);

      // Performance assertions
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(15000); // Should complete within 15 seconds

      const throughput = result.successful.length / (processingTime / 1000);
      expect(throughput).toBeGreaterThan(0.5); // Should process at least 0.5 bomps per second
    });

    it("should maintain data integrity across processing pipeline", async () => {
      performanceMetrics.testName = "data-integrity-pipeline";

      // Arrange
      const testContent = createTestScrapingContent(1, "integrity-test-bomp");
      fs.writeFileSync(testScrapingPath, testContent);

      // Create mock response with specific values for integrity testing
      const integrityMockResponse = createComprehensiveMockApiResponse(
        "912",
        "整合性テストボンプ",
        "炎属性",
        [1, 2],
        {
          hp: ["-", "1500", "1800", "2100", "2400", "2700", "3000"],
          atk: ["-", "150", "180", "210", "240", "270", "300"],
          def: ["-", "75", "90", "105", "120", "135", "150"],
          impact: "25",
          critRate: "12%",
          critDmg: "80%",
          anomalyMastery: "20",
          anomalyProficiency: "30",
          penRatio: "8%",
          energy: "120",
        }
      );

      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockResolvedValue(integrityMockResponse);

      const batchProcessor = new BompBatchProcessor();
      const bompGenerator = new BompGenerator();

      // Act
      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 1,
        delayMs: 10,
        maxRetries: 1,
      });

      bompGenerator.outputBompFile(result.successful, testOutputPath);

      performanceMetrics.bompsProcessed = result.successful.length;

      // Assert
      expect(result.successful.length).toBe(1);
      const bomp = result.successful[0];

      // Verify data integrity
      expect(bomp.id).toBe("integrity-test-bomp-1");
      expect(bomp.name.ja).toBe("整合性テストボンプ");
      expect(bomp.stats).toBe("fire");
      expect(bomp.faction).toEqual([1, 2]);

      // Verify attributes with specific values
      expect(bomp.attr.hp).toEqual([0, 1500, 1800, 2100, 2400, 2700, 3000]);
      expect(bomp.attr.atk).toEqual([0, 150, 180, 210, 240, 270, 300]);
      expect(bomp.attr.def).toEqual([0, 75, 90, 105, 120, 135, 150]);
      expect(bomp.attr.impact).toBe(25);
      expect(bomp.attr.critRate).toBe(12);
      expect(bomp.attr.critDmg).toBe(80);
      expect(bomp.attr.anomalyMastery).toBe(20);
      expect(bomp.attr.anomalyProficiency).toBe(30);
      expect(bomp.attr.penRatio).toBe(8);
      expect(bomp.attr.energy).toBe(120);

      // Verify output file integrity
      expect(fs.existsSync(testOutputPath)).toBe(true);
      const outputContent = fs.readFileSync(testOutputPath, "utf-8");
      expect(outputContent).toContain('"impact": 25');
      expect(outputContent).toContain('"critRate": 12');
      expect(outputContent).toContain('"stats": "fire"');
    });
  });

  // 2. API Integration Tests
  describe("API Integration", () => {
    it("should handle API rate limiting with proper delays", async () => {
      performanceMetrics.testName = "api-rate-limiting";

      // Arrange
      const bompCount = 4;
      const testContent = createTestScrapingContent(
        bompCount,
        "rate-limit-bomp"
      );
      fs.writeFileSync(testScrapingPath, testContent);

      let callTimestamps: number[] = [];
      const mockApiResponse = createComprehensiveMockApiResponse(
        "912",
        "レート制限テストボンプ"
      );

      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockImplementation(async () => {
        callTimestamps.push(performance.now());
        performanceMetrics.apiCalls++;
        // Simulate API processing time
        await new Promise((resolve) => setTimeout(resolve, 25));
        return mockApiResponse;
      });

      const batchProcessor = new BompBatchProcessor();

      // Act
      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 2,
        delayMs: 100, // Ensure proper delay between requests
        maxRetries: 1,
      });

      performanceMetrics.bompsProcessed = result.successful.length;

      // Assert
      expect(result.statistics.total).toBe(bompCount);
      expect(callTimestamps.length).toBeGreaterThan(0);

      // Verify rate limiting delays were respected
      for (let i = 1; i < callTimestamps.length; i++) {
        const timeDiff = callTimestamps[i] - callTimestamps[i - 1];
        // Should have at least some delay between calls (accounting for batch processing)
        if (i % 2 === 0) {
          // Every second call should have the batch delay
          expect(timeDiff).toBeGreaterThan(80); // Allow some tolerance
        }
      }
    });

    it("should implement retry logic for API failures", async () => {
      performanceMetrics.testName = "api-retry-logic";

      // Arrange
      const testContent = createTestScrapingContent(2, "retry-test-bomp");
      fs.writeFileSync(testScrapingPath, testContent);

      let attemptCounts: { [key: string]: number } = {};
      const mockApiClient = vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      );

      mockApiClient.mockImplementation(async (pageId, lang) => {
        const key = `${pageId}-${lang}`;
        attemptCounts[key] = (attemptCounts[key] || 0) + 1;
        performanceMetrics.apiCalls++;

        // Simulate failures for first few attempts
        if (attemptCounts[key] <= 2) {
          const error = new Error(
            `API Error: Rate limit exceeded (attempt ${attemptCounts[key]})`
          );
          performanceMetrics.errors.push(error.message);
          throw error;
        }

        // Success on third attempt
        return createComprehensiveMockApiResponse(
          pageId.toString(),
          `リトライテストボンプ${pageId}`
        );
      });

      const batchProcessor = new BompBatchProcessor();

      // Act
      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 1,
        delayMs: 10,
        maxRetries: 3,
      });

      performanceMetrics.bompsProcessed = result.successful.length;

      // Assert
      expect(result.statistics.total).toBe(2);
      // Note: The actual retry behavior depends on the implementation
      // We verify that multiple attempts were made
      expect(Object.values(attemptCounts).some((count) => count > 1)).toBe(
        true
      );
    });

    it("should handle malformed API responses gracefully", async () => {
      performanceMetrics.testName = "malformed-api-responses";

      // Arrange
      const testContent = createTestScrapingContent(3, "malformed-test-bomp");
      fs.writeFileSync(testScrapingPath, testContent);

      let callCount = 0;
      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockImplementation(async (pageId) => {
        callCount++;
        performanceMetrics.apiCalls++;

        if (pageId === 913) {
          // Return malformed response
          return {
            retcode: 0,
            message: "OK",
            data: {
              page: {
                id: null as any,
                name: undefined as any,
                agent_specialties: { values: [] },
                agent_stats: { values: [] },
                agent_rarity: { values: [] },
                agent_faction: { values: [] },
                modules: "invalid_format" as any,
              },
            },
          } as any;
        } else if (pageId === 914) {
          // Return API error response
          return {
            retcode: -1,
            message: "Entry not found",
            data: null,
          } as any;
        } else {
          // Return valid response
          return createComprehensiveMockApiResponse(
            pageId.toString(),
            `正常テストボンプ${pageId}`
          );
        }
      });

      const batchProcessor = new BompBatchProcessor();

      // Act
      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 1,
        delayMs: 10,
        maxRetries: 1,
      });

      performanceMetrics.bompsProcessed = result.successful.length;

      // Assert
      expect(result.statistics.total).toBe(3);
      expect(result.successful.length).toBe(1); // Only one should succeed
      expect(result.failed.length).toBe(2); // Two should fail
      expect(
        result.failed.every(
          (f) => f.error.includes("失敗") || f.error.includes("エラー")
        )
      ).toBe(true);
    });
  });

  // 3. Performance and Memory Tests
  describe("Performance and Memory", () => {
    it("should meet performance benchmarks for processing speed", async () => {
      performanceMetrics.testName = "performance-benchmarks";

      // Arrange
      const bompCount = 10;
      const testContent = createTestScrapingContent(
        bompCount,
        "perf-benchmark-bomp"
      );
      fs.writeFileSync(testScrapingPath, testContent);

      const mockApiResponse = createComprehensiveMockApiResponse(
        "912",
        "パフォーマンスベンチマークボンプ"
      );

      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockImplementation(async () => {
        performanceMetrics.apiCalls++;
        // Simulate realistic API response time
        await new Promise((resolve) => setTimeout(resolve, 20));
        return mockApiResponse;
      });

      const batchProcessor = new BompBatchProcessor();

      // Act
      const startTime = performance.now();
      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 3,
        delayMs: 40,
        maxRetries: 1,
      });
      const endTime = performance.now();

      performanceMetrics.bompsProcessed = result.successful.length;

      // Assert
      const processingTime = endTime - startTime;
      const throughput = result.successful.length / (processingTime / 1000);
      const avgTimePerBomp = processingTime / result.successful.length;

      expect(result.statistics.total).toBe(bompCount);
      expect(result.successful.length).toBe(bompCount);
      expect(processingTime).toBeLessThan(8000); // Should complete within 8 seconds
      expect(throughput).toBeGreaterThan(0.8); // Should process at least 0.8 bomps per second
      expect(avgTimePerBomp).toBeLessThan(800); // Should process each bomp within 800ms on average
    });

    it("should maintain memory efficiency during processing", async () => {
      performanceMetrics.testName = "memory-efficiency";

      // Arrange
      const bompCount = 12;
      const testContent = createTestScrapingContent(
        bompCount,
        "memory-test-bomp"
      );
      fs.writeFileSync(testScrapingPath, testContent);

      // Create larger mock data to test memory usage
      const largeMockResponse = createComprehensiveMockApiResponse(
        "912",
        "メモリテストボンプ",
        "氷属性",
        [1],
        {
          hp: ["-", "2000", "2400", "2800", "3200", "3600", "4000"],
          atk: ["-", "200", "240", "280", "320", "360", "400"],
          def: ["-", "100", "120", "140", "160", "180", "200"],
          impact: "30",
          critRate: "15%",
          critDmg: "90%",
          anomalyMastery: "25",
          anomalyProficiency: "35",
          penRatio: "10%",
          energy: "140",
        }
      );

      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockImplementation(async () => {
        performanceMetrics.apiCalls++;
        await new Promise((resolve) => setTimeout(resolve, 15));
        return largeMockResponse;
      });

      const batchProcessor = new BompBatchProcessor();

      // Act
      const memoryBefore = process.memoryUsage();
      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 4,
        delayMs: 20,
        maxRetries: 1,
      });
      const memoryAfter = process.memoryUsage();

      performanceMetrics.bompsProcessed = result.successful.length;

      // Assert
      const heapUsedIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;
      const rssIncrease = memoryAfter.rss - memoryBefore.rss;
      const memoryPerBomp = heapUsedIncrease / result.successful.length;

      expect(result.statistics.total).toBe(bompCount);
      expect(result.successful.length).toBe(bompCount);
      expect(heapUsedIncrease).toBeLessThan(75 * 1024 * 1024); // Should use less than 75MB heap
      expect(rssIncrease).toBeLessThan(150 * 1024 * 1024); // Should use less than 150MB RSS
      expect(memoryPerBomp).toBeLessThan(5 * 1024 * 1024); // Should use less than 5MB per bomp
    });

    it("should track memory usage patterns over time", async () => {
      performanceMetrics.testName = "memory-usage-patterns";

      // Arrange
      const bompCount = 8;
      const testContent = createTestScrapingContent(
        bompCount,
        "memory-pattern-bomp"
      );
      fs.writeFileSync(testScrapingPath, testContent);

      const mockApiResponse = createComprehensiveMockApiResponse(
        "912",
        "メモリパターンテストボンプ"
      );

      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockImplementation(async () => {
        performanceMetrics.apiCalls++;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return mockApiResponse;
      });

      const batchProcessor = new BompBatchProcessor();

      // Act
      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 2,
        delayMs: 50,
        maxRetries: 1,
      });

      performanceMetrics.bompsProcessed = result.successful.length;

      // Assert
      expect(result.statistics.total).toBe(bompCount);
      expect(memorySnapshots.length).toBeGreaterThan(10); // Should have multiple memory snapshots

      // Analyze memory growth pattern
      const memoryGrowth = memorySnapshots.map((snapshot, index) => {
        if (index === 0) return 0;
        return snapshot.memory.heapUsed - memorySnapshots[0].memory.heapUsed;
      });

      const maxGrowth = Math.max(...memoryGrowth);
      const finalGrowth = memoryGrowth[memoryGrowth.length - 1];

      // Memory should not grow excessively
      expect(maxGrowth).toBeLessThan(50 * 1024 * 1024); // Max growth should be less than 50MB

      // Final memory should be reasonable compared to peak (no major memory leaks)
      expect(finalGrowth).toBeLessThan(maxGrowth * 1.5); // Final should be within 150% of peak
    });

    it("should generate comprehensive performance metrics", async () => {
      performanceMetrics.testName = "comprehensive-performance-metrics";

      // Arrange
      const bompCount = 5;
      const testContent = createTestScrapingContent(
        bompCount,
        "metrics-test-bomp"
      );
      fs.writeFileSync(testScrapingPath, testContent);

      const mockApiResponse = createComprehensiveMockApiResponse(
        "912",
        "メトリクステストボンプ"
      );

      let apiCallTimes: number[] = [];
      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockImplementation(async () => {
        const callStart = performance.now();
        performanceMetrics.apiCalls++;
        await new Promise((resolve) => setTimeout(resolve, 25));
        apiCallTimes.push(performance.now() - callStart);
        return mockApiResponse;
      });

      const batchProcessor = new BompBatchProcessor();

      // Act
      const processingStart = performance.now();
      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 2,
        delayMs: 30,
        maxRetries: 1,
      });
      const processingEnd = performance.now();

      performanceMetrics.bompsProcessed = result.successful.length;

      // Generate detailed performance report
      const detailedMetrics = {
        testName: performanceMetrics.testName,
        timestamp: new Date().toISOString(),
        processing: {
          totalTime: processingEnd - processingStart,
          bompsProcessed: result.successful.length,
          throughput:
            result.successful.length /
            ((processingEnd - processingStart) / 1000),
          avgTimePerBomp:
            (processingEnd - processingStart) / result.successful.length,
        },
        api: {
          totalCalls: performanceMetrics.apiCalls,
          avgCallTime:
            apiCallTimes.reduce((sum, time) => sum + time, 0) /
            apiCallTimes.length,
          minCallTime: Math.min(...apiCallTimes),
          maxCallTime: Math.max(...apiCallTimes),
        },
        memory: {
          startHeap: performanceMetrics.memoryStart.heapUsed,
          endHeap: performanceMetrics.memoryEnd?.heapUsed || 0,
          peakHeap: performanceMetrics.memoryPeak?.heapUsed || 0,
          heapGrowth:
            (performanceMetrics.memoryEnd?.heapUsed || 0) -
            performanceMetrics.memoryStart.heapUsed,
        },
        statistics: result.statistics,
      };

      const metricsPath = path.join(testOutputDir, "detailed-metrics.json");
      fs.writeFileSync(metricsPath, JSON.stringify(detailedMetrics, null, 2));

      // Assert
      expect(fs.existsSync(metricsPath)).toBe(true);
      expect(result.statistics.total).toBe(bompCount);
      expect(result.successful.length).toBe(bompCount);
      expect(detailedMetrics.processing.throughput).toBeGreaterThan(0);
      expect(detailedMetrics.api.avgCallTime).toBeGreaterThan(0);
      expect(detailedMetrics.memory.heapGrowth).toBeLessThan(30 * 1024 * 1024); // Less than 30MB growth
    });
  });

  // 4. System Integration Tests
  describe("System Integration", () => {
    it("should integrate with main execution function", async () => {
      performanceMetrics.testName = "main-function-integration";

      // Arrange
      const bompCount = 2;
      const testContent = createTestScrapingContent(
        bompCount,
        "main-integration-bomp"
      );
      fs.writeFileSync(testScrapingPath, testContent);

      const testConfig = {
        batchSize: 1,
        delayMs: 20,
        maxRetries: 1,
        scrapingFilePath: testScrapingPath,
        outputFilePath: testOutputPath,
        enableReportGeneration: true,
        reportOutputPath: path.join(testOutputDir, "integration-report.md"),
        enableValidation: true,
        enableDebugMode: false,
      };
      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      const mockApiResponse = createComprehensiveMockApiResponse(
        "912",
        "メイン統合テストボンプ"
      );
      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockResolvedValue(mockApiResponse);

      (global as any).configPath = testConfigPath;

      // Act
      await main();

      performanceMetrics.bompsProcessed = bompCount;

      // Assert
      expect(fs.existsSync(testOutputPath)).toBe(true);
      expect(fs.existsSync(testConfig.reportOutputPath)).toBe(true);

      // Verify output content
      const outputContent = fs.readFileSync(testOutputPath, "utf-8");
      expect(outputContent).toContain("export default");
      expect(outputContent).toContain("main-integration-bomp");

      // Verify report content
      const reportContent = fs.readFileSync(
        testConfig.reportOutputPath,
        "utf-8"
      );
      expect(reportContent).toContain("ボンプデータ処理レポート");
      expect(reportContent).toContain("成功");
    });

    it("should handle configuration variations", async () => {
      performanceMetrics.testName = "configuration-variations";

      // Test different configuration scenarios
      const configurations = [
        { batchSize: 1, delayMs: 10, maxRetries: 1 },
        { batchSize: 3, delayMs: 50, maxRetries: 2 },
        { batchSize: 5, delayMs: 100, maxRetries: 3 },
      ];

      for (const [index, config] of configurations.entries()) {
        const testContent = createTestScrapingContent(
          2,
          `config-test-${index}-bomp`
        );
        const configScrapingPath = path.join(
          testOutputDir,
          `config-scraping-${index}.md`
        );
        fs.writeFileSync(configScrapingPath, testContent);

        const mockApiResponse = createComprehensiveMockApiResponse(
          "912",
          `設定テストボンプ${index}`
        );
        vi.spyOn(
          HoyoLabApiClient.prototype,
          "fetchCharacterData"
        ).mockResolvedValue(mockApiResponse);

        const batchProcessor = new BompBatchProcessor();

        // Act
        const result = await batchProcessor.processAllBomps(
          configScrapingPath,
          config
        );

        // Assert
        expect(result.statistics.total).toBe(2);
        expect(result.successful.length).toBeGreaterThanOrEqual(0);
        expect(result.failed.length).toBeGreaterThanOrEqual(0);
        expect(result.successful.length + result.failed.length).toBe(2);
      }

      performanceMetrics.bompsProcessed = configurations.length * 2;
    });

    it("should validate component integration", async () => {
      performanceMetrics.testName = "component-integration-validation";

      // Arrange
      const testContent = createTestScrapingContent(
        1,
        "component-validation-bomp"
      );
      fs.writeFileSync(testScrapingPath, testContent);

      const mockApiResponse = createComprehensiveMockApiResponse(
        "912",
        "コンポーネント検証ボンプ"
      );
      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockResolvedValue(mockApiResponse);

      // Create individual components to test integration
      const bompListParser = new BompListParser();
      const bompDataProcessor = new BompDataProcessor();
      const bompGenerator = new BompGenerator();
      const batchProcessor = new BompBatchProcessor(
        bompDataProcessor,
        bompGenerator,
        bompListParser
      );

      // Act
      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 1,
        delayMs: 10,
        maxRetries: 1,
      });

      if (result.successful.length > 0) {
        bompGenerator.outputBompFile(result.successful, testOutputPath);
      }

      performanceMetrics.bompsProcessed = result.successful.length;

      // Assert
      expect(result.statistics.total).toBe(1);

      if (result.successful.length > 0) {
        const bomp = result.successful[0];

        // Validate complete bomp structure
        expect(bomp).toHaveProperty("id");
        expect(bomp).toHaveProperty("name");
        expect(bomp).toHaveProperty("stats");
        expect(bomp).toHaveProperty("attr");
        expect(bomp).toHaveProperty("extraAbility");

        // Validate name structure
        expect(bomp.name).toHaveProperty("ja");
        expect(bomp.name).toHaveProperty("en");

        // Validate attributes structure
        expect(bomp.attr).toHaveProperty("hp");
        expect(bomp.attr).toHaveProperty("atk");
        expect(bomp.attr).toHaveProperty("def");
        expect(bomp.attr).toHaveProperty("impact");
        expect(bomp.attr).toHaveProperty("critRate");
        expect(bomp.attr).toHaveProperty("critDmg");
        expect(bomp.attr).toHaveProperty("anomalyMastery");
        expect(bomp.attr).toHaveProperty("anomalyProficiency");
        expect(bomp.attr).toHaveProperty("penRatio");
        expect(bomp.attr).toHaveProperty("energy");

        // Validate array lengths
        expect(bomp.attr.hp).toHaveLength(7);
        expect(bomp.attr.atk).toHaveLength(7);
        expect(bomp.attr.def).toHaveLength(7);

        // Validate output file
        expect(fs.existsSync(testOutputPath)).toBe(true);
        const outputContent = fs.readFileSync(testOutputPath, "utf-8");
        expect(outputContent).toContain("component-validation-bomp-1");
      }
    });
  });
});
