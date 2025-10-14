import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  main,
  loadConfig,
  BompProcessingConfig,
} from "../../src/main-bomp-generation";

import { HoyoLabApiClient } from "../../src/clients/HoyoLabApiClient";
import { Bomp } from "../../src/types";

/**
 * システム統合テスト - エンドツーエンド処理のテスト
 * 要件: 4.1, 4.3
 */
describe("Bomp System Integration Tests", () => {
  const testOutputDir = "system-integration-test";
  const testConfigPath = path.join(testOutputDir, "system-config.json");
  const testScrapingPath = path.join(testOutputDir, "system-scraping.md");
  const testOutputPath = path.join(testOutputDir, "system-bomps.ts");
  const testReportPath = path.join(testOutputDir, "system-report.md");

  beforeEach(() => {
    // テスト用ディレクトリを作成
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterEach(() => {
    // テストファイルをクリーンアップ
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }

    // グローバル設定をクリア
    delete (global as any).configPath;
  });

  /**
   * 完全なシステム統合テスト
   */
  it("should execute complete bomp data generation pipeline", async () => {
    // Arrange - Create comprehensive test setup
    const systemConfig: BompProcessingConfig = {
      batchSize: 2,
      delayMs: 50,
      maxRetries: 2,
      scrapingFilePath: testScrapingPath,
      outputFilePath: testOutputPath,
      enableReportGeneration: true,
      reportOutputPath: testReportPath,
      minSuccessRate: 0.8,
      enableValidation: true,
      logLevel: "info",
      enableDebugMode: false,
    };

    fs.writeFileSync(testConfigPath, JSON.stringify(systemConfig, null, 2));

    // Create realistic scraping content
    const systemScrapingContent = `
# System Integration Test Scraping.md

## ボンプページリスト

- [system-test-bomp-1](https://wiki.hoyolab.com/pc/zzz/entry/912) - システムテストボンプ1
- [system-test-bomp-2](https://wiki.hoyolab.com/pc/zzz/entry/913) - システムテストボンプ2
- [system-test-bomp-3](https://wiki.hoyolab.com/pc/zzz/entry/914) - システムテストボンプ3

## その他のセクション

システム統合テスト用のコンテンツ...
`;
    fs.writeFileSync(testScrapingPath, systemScrapingContent);

    // Mock comprehensive API responses
    const mockApiResponses = [
      createComprehensiveMockResponse("912", "システムテストボンプ1", "ice", [
        1,
      ]),
      createComprehensiveMockResponse("913", "システムテストボンプ2", "fire", [
        2,
      ]),
      createComprehensiveMockResponse(
        "914",
        "システムテストボンプ3",
        "electric",
        [1, 2]
      ),
    ];

    let responseIndex = 0;
    vi.spyOn(
      HoyoLabApiClient.prototype,
      "fetchCharacterData"
    ).mockImplementation(async () => {
      const response =
        mockApiResponses[responseIndex % mockApiResponses.length];
      responseIndex++;
      return response;
    });

    // Set global config path
    (global as any).configPath = testConfigPath;

    // Act - Execute main function
    await main();

    // Assert - Verify complete system execution

    // 1. Verify output file was created
    expect(fs.existsSync(testOutputPath)).toBe(true);

    // 2. Verify output file content
    const outputContent = fs.readFileSync(testOutputPath, "utf-8");
    expect(outputContent).toContain("export default");
    expect(outputContent).toContain("system-test-bomp-1");
    expect(outputContent).toContain("system-test-bomp-2");
    expect(outputContent).toContain("system-test-bomp-3");

    // 3. Verify report was generated
    expect(fs.existsSync(testReportPath)).toBe(true);
    const reportContent = fs.readFileSync(testReportPath, "utf-8");
    expect(reportContent).toContain("ボンプデータ処理レポート");
    expect(reportContent).toContain("成功: 3");

    // 4. Verify output structure by importing and checking
    const outputModule = await import(path.resolve(testOutputPath));
    const bomps: Bomp[] = outputModule.default;

    expect(bomps).toHaveLength(3);
    bomps.forEach((bomp) => {
      expect(bomp).toHaveProperty("id");
      expect(bomp).toHaveProperty("name");
      expect(bomp).toHaveProperty("attr");
      expect(bomp.name).toHaveProperty("ja");
      expect(bomp.name).toHaveProperty("en");
      expect(bomp.attr.hp).toHaveLength(7);
      expect(bomp.attr.atk).toHaveLength(7);
      expect(bomp.attr.def).toHaveLength(7);
    });
  });

  /**
   * 設定ファイル統合テスト
   */
  it("should handle various configuration scenarios", async () => {
    // Test 1: Default configuration
    const defaultConfig = loadConfig("non-existent-config.json");
    expect(defaultConfig.batchSize).toBe(5);
    expect(defaultConfig.delayMs).toBe(500);
    expect(defaultConfig.maxRetries).toBe(3);

    // Test 2: Partial configuration
    const partialConfig = {
      batchSize: 10,
      delayMs: 200,
      // Other values should use defaults
    };
    fs.writeFileSync(testConfigPath, JSON.stringify(partialConfig, null, 2));

    const loadedPartialConfig = loadConfig(testConfigPath);
    expect(loadedPartialConfig.batchSize).toBe(10);
    expect(loadedPartialConfig.delayMs).toBe(200);
    expect(loadedPartialConfig.maxRetries).toBe(3); // Default value

    // Test 3: Nested bomp configuration
    const nestedConfig = {
      general: {
        someOtherSetting: true,
      },
      bomp: {
        batchSize: 7,
        delayMs: 300,
        maxRetries: 5,
        scrapingFilePath: "custom-scraping.md",
        outputFilePath: "custom-output.ts",
      },
    };
    fs.writeFileSync(testConfigPath, JSON.stringify(nestedConfig, null, 2));

    const loadedNestedConfig = loadConfig(testConfigPath);
    expect(loadedNestedConfig.batchSize).toBe(7);
    expect(loadedNestedConfig.delayMs).toBe(300);
    expect(loadedNestedConfig.maxRetries).toBe(5);
    expect(loadedNestedConfig.scrapingFilePath).toBe("custom-scraping.md");
    expect(loadedNestedConfig.outputFilePath).toBe("custom-output.ts");

    // Test 4: Malformed JSON handling
    fs.writeFileSync(testConfigPath, "{ invalid json content }");
    const malformedConfig = loadConfig(testConfigPath);
    expect(malformedConfig.batchSize).toBe(5); // Should fall back to defaults
  });

  /**
   * エラー回復統合テスト
   */
  it("should handle errors gracefully and continue processing", async () => {
    // Arrange
    const errorTestConfig: BompProcessingConfig = {
      batchSize: 1,
      delayMs: 10,
      maxRetries: 2,
      scrapingFilePath: testScrapingPath,
      outputFilePath: testOutputPath,
      enableReportGeneration: true,
      reportOutputPath: testReportPath,
      minSuccessRate: 0.5, // Allow 50% failure rate
      enableValidation: true,
      enableDebugMode: false,
    };

    fs.writeFileSync(testConfigPath, JSON.stringify(errorTestConfig, null, 2));

    const errorScrapingContent = `
# Error Recovery Test Scraping.md

## ボンプページリスト

- [error-test-bomp-1](https://wiki.hoyolab.com/pc/zzz/entry/912) - エラーテストボンプ1
- [error-test-bomp-2](https://wiki.hoyolab.com/pc/zzz/entry/913) - エラーテストボンプ2
- [error-test-bomp-3](https://wiki.hoyolab.com/pc/zzz/entry/914) - エラーテストボンプ3
- [error-test-bomp-4](https://wiki.hoyolab.com/pc/zzz/entry/915) - エラーテストボンプ4
`;
    fs.writeFileSync(testScrapingPath, errorScrapingContent);

    // Mock API with mixed success/failure responses
    let callCount = 0;
    vi.spyOn(
      HoyoLabApiClient.prototype,
      "fetchCharacterData"
    ).mockImplementation(async (pageId) => {
      callCount++;

      // Simulate different error scenarios
      if (pageId === 913) {
        throw new Error("API Error: Rate limit exceeded");
      } else if (pageId === 915) {
        return {
          retcode: -1,
          message: "Entry not found",
          data: null,
        } as any;
      } else {
        return createComprehensiveMockResponse(
          pageId.toString(),
          `テストボンプ${pageId}`,
          "ice",
          [1]
        );
      }
    });

    (global as any).configPath = testConfigPath;

    // Act
    await main();

    // Assert
    expect(fs.existsSync(testOutputPath)).toBe(true);
    expect(fs.existsSync(testReportPath)).toBe(true);

    // Verify that some bomps were processed successfully despite errors
    const outputContent = fs.readFileSync(testOutputPath, "utf-8");
    expect(outputContent).toContain("export default");

    // Verify report contains error information
    const reportContent = fs.readFileSync(testReportPath, "utf-8");
    expect(reportContent).toContain("失敗");
    expect(reportContent).toContain("成功");
  });

  /**
   * データ検証統合テスト
   */
  it("should validate generated data comprehensively", async () => {
    // Arrange
    const validationConfig: BompProcessingConfig = {
      batchSize: 1,
      delayMs: 10,
      maxRetries: 1,
      scrapingFilePath: testScrapingPath,
      outputFilePath: testOutputPath,
      enableReportGeneration: false,
      enableValidation: true,
      minSuccessRate: 1.0, // Require 100% success
      enableDebugMode: false,
    };

    fs.writeFileSync(testConfigPath, JSON.stringify(validationConfig, null, 2));

    const validationScrapingContent = `
# Validation Test Scraping.md

## ボンプページリスト

- [validation-test-bomp](https://wiki.hoyolab.com/pc/zzz/entry/912) - 検証テストボンプ
`;
    fs.writeFileSync(testScrapingPath, validationScrapingContent);

    // Mock API with comprehensive data
    const comprehensiveResponse = createComprehensiveMockResponse(
      "912",
      "検証テストボンプ",
      "fire",
      [1, 2],
      {
        hp: ["-", "1500", "1800", "2100", "2400", "2700", "3000"],
        atk: ["-", "150", "180", "210", "240", "270", "300"],
        def: ["-", "75", "90", "105", "120", "135", "150"],
        impact: "20",
        critRate: "10%",
        critDmg: "75%",
        anomalyMastery: "15",
        anomalyProficiency: "25",
        penRatio: "5%",
        energy: "150",
      }
    );

    vi.spyOn(
      HoyoLabApiClient.prototype,
      "fetchCharacterData"
    ).mockResolvedValue(comprehensiveResponse);

    (global as any).configPath = testConfigPath;

    // Act
    await main();

    // Assert
    expect(fs.existsSync(testOutputPath)).toBe(true);

    // Import and validate the generated data
    const outputModule = await import(path.resolve(testOutputPath));
    const bomps: Bomp[] = outputModule.default;

    expect(bomps).toHaveLength(1);
    const bomp = bomps[0];

    // Comprehensive validation
    expect(bomp.id).toBe("validation-test-bomp");
    expect(bomp.name.ja).toBe("検証テストボンプ");
    expect(bomp.name.en).toBe("検証テストボンプ"); // Fallback to Japanese

    // Validate attributes structure
    expect(bomp.attr.hp).toEqual([0, 1500, 1800, 2100, 2400, 2700, 3000]);
    expect(bomp.attr.atk).toEqual([0, 150, 180, 210, 240, 270, 300]);
    expect(bomp.attr.def).toEqual([0, 75, 90, 105, 120, 135, 150]);
    expect(bomp.attr.impact).toBe(20);
    expect(bomp.attr.critRate).toBe(10);
    expect(bomp.attr.critDmg).toBe(75);
    expect(bomp.attr.anomalyMastery).toBe(15);
    expect(bomp.attr.anomalyProficiency).toBe(25);
    expect(bomp.attr.penRatio).toBe(5);
    expect(bomp.attr.energy).toBe(150);

    // Validate faction data
    expect(bomp.faction).toEqual([1, 2]);
  });

  /**
   * パフォーマンス統合テスト
   */
  it("should meet performance requirements in integrated environment", async () => {
    // Arrange
    const performanceConfig: BompProcessingConfig = {
      batchSize: 3,
      delayMs: 25,
      maxRetries: 1,
      scrapingFilePath: testScrapingPath,
      outputFilePath: testOutputPath,
      enableReportGeneration: true,
      reportOutputPath: testReportPath,
      enableValidation: false, // Disable for performance testing
      enableDebugMode: false,
    };

    fs.writeFileSync(
      testConfigPath,
      JSON.stringify(performanceConfig, null, 2)
    );

    // Create larger dataset for performance testing
    const performanceBomps = Array.from(
      { length: 15 },
      (_, i) =>
        `- [perf-bomp-${i + 1}](https://wiki.hoyolab.com/pc/zzz/entry/${
          912 + i
        }) - パフォーマンステストボンプ${i + 1}`
    ).join("\n");

    const performanceScrapingContent = `
# Performance Integration Test Scraping.md

## ボンプページリスト

${performanceBomps}
`;
    fs.writeFileSync(testScrapingPath, performanceScrapingContent);

    // Mock API responses
    vi.spyOn(
      HoyoLabApiClient.prototype,
      "fetchCharacterData"
    ).mockImplementation(async (pageId) => {
      // Simulate realistic API delay
      await new Promise((resolve) => setTimeout(resolve, 20));
      return createComprehensiveMockResponse(
        pageId.toString(),
        `パフォーマンステストボンプ${pageId}`,
        "electric",
        [1]
      );
    });

    (global as any).configPath = testConfigPath;

    // Act & Measure
    const startTime = Date.now();
    const memoryStart = process.memoryUsage();

    await main();

    const endTime = Date.now();
    const memoryEnd = process.memoryUsage();

    // Assert
    const processingTime = endTime - startTime;
    const memoryUsed = memoryEnd.heapUsed - memoryStart.heapUsed;

    expect(fs.existsSync(testOutputPath)).toBe(true);
    expect(fs.existsSync(testReportPath)).toBe(true);

    // Performance assertions
    expect(processingTime).toBeLessThan(30000); // Should complete within 30 seconds
    expect(memoryUsed).toBeLessThan(100 * 1024 * 1024); // Should use less than 100MB

    // Verify all bomps were processed
    const outputModule = await import(path.resolve(testOutputPath));
    const bomps: Bomp[] = outputModule.default;
    expect(bomps).toHaveLength(15);

    // Calculate and verify throughput
    const throughput = bomps.length / (processingTime / 1000);
    expect(throughput).toBeGreaterThan(0.2); // Should process at least 0.2 bomps per second
  });

  // Helper function to create comprehensive mock API responses
  function createComprehensiveMockResponse(
    id: string,
    name: string,
    stats: string,
    factions: number[],
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
  ) {
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
          agent_stats: { values: [`${stats}属性`] },
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
                  data: JSON.stringify({
                    faction: factions,
                  }),
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
});
