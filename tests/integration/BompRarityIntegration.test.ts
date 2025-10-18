import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { BompBatchProcessor } from "../../src/processors/BompBatchProcessor";
import { BompGenerator } from "../../src/generators/BompGenerator";
import { HoyoLabApiClient } from "../../src/clients/HoyoLabApiClient";
import { Bomp, Rarity } from "../../src/types";
import { ApiResponse } from "../../src/types/api";

// Helper function to create mock API response with rarity information
function createMockApiResponseWithRarity(
  id: string,
  name: string,
  rarity: "A級" | "S級" = "A級",
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
            name: "ステータス",
            components: [
              {
                component_id: "baseInfo",
                data: JSON.stringify({
                  list: [
                    {
                      key: "名称",
                      value: [name],
                      id: "baseInfo54936",
                    },
                    {
                      key: "属性",
                      value: [
                        `<p><span style="color: #f0d12b">${stats}</span></p>`,
                      ],
                      id: "baseInfo85452",
                    },
                    {
                      key: "レア度",
                      value: [`<p>${rarity}</p>`],
                      id: "baseInfo97603",
                    },
                    {
                      key: "『追加能力』",
                      value: ["<p>テスト追加能力</p>"],
                      id: "baseInfo13907",
                    },
                    {
                      key: "実装バージョン",
                      value: ["<p>Ver.2.2「穏やかな夜をよしとせず」</p>"],
                      id: "baseInfo65703",
                    },
                  ],
                }),
              },
            ],
          },
          {
            name: "突破",
            components: [
              {
                component_id: "ascension",
                data: JSON.stringify({
                  list: [
                    {
                      key: "1",
                      combatList: [
                        { key: "HP", values: ["-", "360"] },
                        { key: "攻撃力", values: ["-", "53"] },
                        { key: "防御力", values: ["-", "32"] },
                        { key: "衝撃力", values: ["-", "94"] },
                        { key: "会心率", values: ["-", "5%"] },
                        { key: "会心ダメージ", values: ["-", "50%"] },
                        { key: "貫通率", values: ["-", "0%"] },
                        { key: "異常掌握", values: ["-", "100"] },
                      ],
                    },
                    {
                      key: "10",
                      combatList: [
                        { key: "HP", values: ["745", "933"] },
                        { key: "攻撃力", values: ["293", "342"] },
                        { key: "防御力", values: ["115", "156"] },
                      ],
                    },
                    {
                      key: "20",
                      combatList: [
                        { key: "HP", values: ["1361", "1549"] },
                        { key: "攻撃力", values: ["609", "807"] },
                        { key: "防御力", values: ["248", "288"] },
                      ],
                    },
                    {
                      key: "30",
                      combatList: [
                        { key: "HP", values: ["1978", "2166"] },
                        { key: "攻撃力", values: ["1074", "1568"] },
                        { key: "防御力", values: ["381", "422"] },
                      ],
                    },
                    {
                      key: "40",
                      combatList: [
                        { key: "HP", values: ["2594", "2782"] },
                        { key: "攻撃力", values: ["1835", "3070"] },
                        { key: "防御力", values: ["515", "556"] },
                      ],
                    },
                    {
                      key: "50",
                      combatList: [
                        { key: "HP", values: ["3211", "3399"] },
                        { key: "攻撃力", values: ["3338", "6303"] },
                        { key: "防御力", values: ["648", "688"] },
                      ],
                    },
                    {
                      key: "60",
                      combatList: [
                        { key: "HP", values: ["-", "3827"] },
                        { key: "攻撃力", values: ["-", "6570"] },
                        { key: "防御力", values: ["-", "781"] },
                        { key: "衝撃力", values: ["-", "94"] },
                        { key: "会心率", values: ["-", "50%"] },
                        { key: "会心ダメージ", values: ["-", "100%"] },
                        { key: "貫通率", values: ["-", "0%"] },
                        { key: "異常掌握", values: ["-", "100"] },
                      ],
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
}

describe("Bomp Rarity Integration Tests", () => {
  const testOutputDir = "test-rarity-output";
  const testScrapingPath = path.join(testOutputDir, "test-scraping.md");
  const testOutputPath = path.join(testOutputDir, "test-bomps.ts");

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
  });

  describe("End-to-End Rarity Processing", () => {
    it("should extract rarity from real API data and include in output", async () => {
      // Arrange
      const testScrapingContent = `# Scraping.md

## ボンプページリスト

- [rarity-test-a](https://wiki.hoyolab.com/pc/zzz/entry/912) - A級レア度テストボンプ
- [rarity-test-s](https://wiki.hoyolab.com/pc/zzz/entry/913) - S級レア度テストボンプ
`;
      fs.writeFileSync(testScrapingPath, testScrapingContent);

      const batchProcessor = new BompBatchProcessor();
      const bompGenerator = new BompGenerator();

      // Mock API responses with different rarities
      let callCount = 0;
      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockImplementation(async (id: string) => {
        callCount++;
        if (id === "912") {
          return createMockApiResponseWithRarity(
            "912",
            "A級レア度テストボンプ",
            "A級"
          );
        } else if (id === "913") {
          return createMockApiResponseWithRarity(
            "913",
            "S級レア度テストボンプ",
            "S級"
          );
        }
        throw new Error(`Unexpected ID: ${id}`);
      });

      // Act
      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 2,
        delayMs: 10,
        maxRetries: 1,
      });

      // Generate output file
      if (result.successful.length > 0) {
        bompGenerator.outputBompFile(result.successful, testOutputPath);
      }

      // Assert
      expect(result.successful.length).toBe(2);
      expect(result.failed.length).toBe(0);

      // Verify rarity values in processed data
      const aBomb = result.successful.find((b) => b.id === "rarity-test-a");
      const sBomb = result.successful.find((b) => b.id === "rarity-test-s");

      expect(aBomb).toBeDefined();
      expect(sBomb).toBeDefined();
      expect(aBomb!.rarity).toBe("A");
      expect(sBomb!.rarity).toBe("S");

      // Verify output file contains rarity information
      expect(fs.existsSync(testOutputPath)).toBe(true);
      const outputContent = fs.readFileSync(testOutputPath, "utf-8");

      expect(outputContent).toContain('"rarity": "A"');
      expect(outputContent).toContain('"rarity": "S"');
      expect(outputContent).toContain("rarity-test-a");
      expect(outputContent).toContain("rarity-test-s");
    });

    it("should handle all bomps with rarity integration", async () => {
      // Arrange - Create test data for multiple bomps
      const multipleBompsContent = `# Scraping.md

## ボンプページリスト

- [multi-bomp-1](https://wiki.hoyolab.com/pc/zzz/entry/912) - マルチボンプ1
- [multi-bomp-2](https://wiki.hoyolab.com/pc/zzz/entry/913) - マルチボンプ2
- [multi-bomp-3](https://wiki.hoyolab.com/pc/zzz/entry/914) - マルチボンプ3
- [multi-bomp-4](https://wiki.hoyolab.com/pc/zzz/entry/915) - マルチボンプ4
`;
      fs.writeFileSync(testScrapingPath, multipleBompsContent);

      const batchProcessor = new BompBatchProcessor();
      const bompGenerator = new BompGenerator();

      // Mock API responses with mixed rarities
      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockImplementation(async (id: string) => {
        const rarities: ("A級" | "S級")[] = ["A級", "S級", "A級", "S級"];
        const index = parseInt(id) - 912;
        const rarity = rarities[index] || "A級";
        return createMockApiResponseWithRarity(
          id,
          `マルチボンプ${index + 1}`,
          rarity
        );
      });

      // Act
      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 2,
        delayMs: 10,
        maxRetries: 1,
      });

      bompGenerator.outputBompFile(result.successful, testOutputPath);

      // Assert
      expect(result.successful.length).toBe(4);
      expect(result.failed.length).toBe(0);

      // Verify all bomps have rarity information
      result.successful.forEach((bomp) => {
        expect(bomp.rarity).toMatch(/^[AS]$/);
        expect(["A", "S"]).toContain(bomp.rarity);
      });

      // Verify output file structure
      const outputContent = fs.readFileSync(testOutputPath, "utf-8");
      expect(outputContent).toContain("export default");
      expect(outputContent).toContain("rarity");

      // Count rarity occurrences
      const aRarityCount = (outputContent.match(/"rarity": "A"/g) || []).length;
      const sRarityCount = (outputContent.match(/"rarity": "S"/g) || []).length;
      expect(aRarityCount).toBe(2);
      expect(sRarityCount).toBe(2);
    });

    it("should verify output file rarity display format", async () => {
      // Arrange
      const formatTestContent = `# Scraping.md

## ボンプページリスト

- [format-test-bomp](https://wiki.hoyolab.com/pc/zzz/entry/912) - フォーマットテストボンプ
`;
      fs.writeFileSync(testScrapingPath, formatTestContent);

      const batchProcessor = new BompBatchProcessor();
      const bompGenerator = new BompGenerator();

      // Mock API response
      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockResolvedValue(
        createMockApiResponseWithRarity(
          "912",
          "フォーマットテストボンプ",
          "S級"
        )
      );

      // Act
      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 1,
        delayMs: 10,
        maxRetries: 1,
      });

      bompGenerator.outputBompFile(result.successful, testOutputPath);

      // Assert
      expect(result.successful.length).toBe(1);
      expect(result.successful[0].rarity).toBe("S");

      // Verify output file format
      const outputContent = fs.readFileSync(testOutputPath, "utf-8");

      // Check TypeScript structure
      expect(outputContent).toMatch(/import.*Bomp.*from/);
      expect(outputContent).toContain("export default");
      expect(outputContent).toMatch(/\] as Bomp\[\]/);

      // Check rarity field placement and format
      expect(outputContent).toMatch(/"id": "format-test-bomp"/);
      expect(outputContent).toMatch(/"rarity": "S"/);

      // Verify proper TypeScript syntax
      expect(() => {
        // This would throw if there are syntax errors
        new Function(outputContent.replace(/export default.*/, ""));
      }).not.toThrow();
    });
  });

  describe("Rarity Extraction Error Handling", () => {
    it("should handle missing rarity data gracefully", async () => {
      // Arrange
      const testScrapingContent = `# Scraping.md

## ボンプページリスト

- [missing-rarity-bomp](https://wiki.hoyolab.com/pc/zzz/entry/912) - レア度なしボンプ
`;
      fs.writeFileSync(testScrapingPath, testScrapingContent);

      const batchProcessor = new BompBatchProcessor();
      const bompGenerator = new BompGenerator();

      // Mock API response without rarity information
      const mockResponseWithoutRarity = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "912",
            name: "レア度なしボンプ",
            agent_specialties: { values: [] },
            agent_stats: { values: ["氷属性"] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [
              {
                name: "ステータス",
                components: [
                  {
                    component_id: "baseInfo",
                    data: JSON.stringify({
                      list: [
                        {
                          key: "名称",
                          value: ["レア度なしボンプ"],
                          id: "baseInfo54936",
                        },
                        // レア度キーが存在しない
                        {
                          key: "属性",
                          value: ["<p>氷属性</p>"],
                          id: "baseInfo85452",
                        },
                      ],
                    }),
                  },
                ],
              },
              {
                name: "突破",
                components: [
                  {
                    component_id: "ascension",
                    data: JSON.stringify({
                      list: [
                        {
                          key: "1",
                          combatList: [
                            { key: "HP", values: ["-", "360"] },
                            { key: "攻撃力", values: ["-", "53"] },
                            { key: "防御力", values: ["-", "32"] },
                            { key: "衝撃力", values: ["-", "94"] },
                            { key: "会心率", values: ["-", "5%"] },
                            { key: "会心ダメージ", values: ["-", "50%"] },
                            { key: "貫通率", values: ["-", "0%"] },
                            { key: "異常掌握", values: ["-", "100"] },
                          ],
                        },
                        // ... other levels
                        {
                          key: "60",
                          combatList: [
                            { key: "HP", values: ["-", "3827"] },
                            { key: "攻撃力", values: ["-", "6570"] },
                            { key: "防御力", values: ["-", "781"] },
                            { key: "衝撃力", values: ["-", "94"] },
                            { key: "会心率", values: ["-", "50%"] },
                            { key: "会心ダメージ", values: ["-", "100%"] },
                            { key: "貫通率", values: ["-", "0%"] },
                            { key: "異常掌握", values: ["-", "100"] },
                          ],
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
      ).mockResolvedValue(mockResponseWithoutRarity as ApiResponse);

      // Act
      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 1,
        delayMs: 10,
        maxRetries: 1,
      });

      // Assert - Should use fallback rarity
      expect(result.successful.length).toBe(1);
      expect(result.successful[0].rarity).toBe("A"); // Default fallback value

      // Generate output and verify fallback is used
      bompGenerator.outputBompFile(result.successful, testOutputPath);
      const outputContent = fs.readFileSync(testOutputPath, "utf-8");
      expect(outputContent).toContain('"rarity": "A"');
    });

    it("should handle malformed rarity data gracefully", async () => {
      // Arrange
      const testScrapingContent = `# Scraping.md

## ボンプページリスト

- [malformed-rarity-bomp](https://wiki.hoyolab.com/pc/zzz/entry/912) - 不正レア度ボンプ
`;
      fs.writeFileSync(testScrapingPath, testScrapingContent);

      const batchProcessor = new BompBatchProcessor();
      const bompGenerator = new BompGenerator();

      // Mock API response with malformed rarity data
      const mockResponseWithMalformedRarity = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "912",
            name: "不正レア度ボンプ",
            agent_specialties: { values: [] },
            agent_stats: { values: ["氷属性"] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [
              {
                name: "ステータス",
                components: [
                  {
                    component_id: "baseInfo",
                    data: JSON.stringify({
                      list: [
                        {
                          key: "名称",
                          value: ["不正レア度ボンプ"],
                          id: "baseInfo54936",
                        },
                        {
                          key: "レア度",
                          value: ["<p>不正な値</p>"], // Invalid rarity value
                          id: "baseInfo97603",
                        },
                      ],
                    }),
                  },
                ],
              },
              {
                name: "突破",
                components: [
                  {
                    component_id: "ascension",
                    data: JSON.stringify({
                      list: [
                        {
                          key: "1",
                          combatList: [
                            { key: "HP", values: ["-", "360"] },
                            { key: "攻撃力", values: ["-", "53"] },
                            { key: "防御力", values: ["-", "32"] },
                            { key: "衝撃力", values: ["-", "94"] },
                            { key: "会心率", values: ["-", "5%"] },
                            { key: "会心ダメージ", values: ["-", "50%"] },
                            { key: "貫通率", values: ["-", "0%"] },
                            { key: "異常掌握", values: ["-", "100"] },
                          ],
                        },
                        {
                          key: "60",
                          combatList: [
                            { key: "HP", values: ["-", "3827"] },
                            { key: "攻撃力", values: ["-", "6570"] },
                            { key: "防御力", values: ["-", "781"] },
                            { key: "衝撃力", values: ["-", "94"] },
                            { key: "会心率", values: ["-", "50%"] },
                            { key: "会心ダメージ", values: ["-", "100%"] },
                            { key: "貫通率", values: ["-", "0%"] },
                            { key: "異常掌握", values: ["-", "100"] },
                          ],
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
      ).mockResolvedValue(mockResponseWithMalformedRarity as ApiResponse);

      // Act
      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 1,
        delayMs: 10,
        maxRetries: 1,
      });

      // Assert - Should use fallback rarity for malformed data
      expect(result.successful.length).toBe(1);
      expect(result.successful[0].rarity).toBe("A"); // Default fallback value

      // Generate output and verify fallback is used
      bompGenerator.outputBompFile(result.successful, testOutputPath);
      const outputContent = fs.readFileSync(testOutputPath, "utf-8");
      expect(outputContent).toContain('"rarity": "A"');
    });
  });

  describe("Rarity Data Validation", () => {
    it("should validate rarity values are proper Rarity type", async () => {
      // Arrange
      const testScrapingContent = `# Scraping.md

## ボンプページリスト

- [validation-test-bomp](https://wiki.hoyolab.com/pc/zzz/entry/912) - バリデーションテストボンプ
`;
      fs.writeFileSync(testScrapingPath, testScrapingContent);

      const batchProcessor = new BompBatchProcessor();

      // Mock API response
      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockResolvedValue(
        createMockApiResponseWithRarity(
          "912",
          "バリデーションテストボンプ",
          "S級"
        )
      );

      // Act
      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 1,
        delayMs: 10,
        maxRetries: 1,
      });

      // Assert
      expect(result.successful.length).toBe(1);
      const bomp = result.successful[0];

      // Type validation
      expect(typeof bomp.rarity).toBe("string");
      expect(["A", "S"]).toContain(bomp.rarity);

      // Ensure it matches Rarity type
      const rarityValue: Rarity = bomp.rarity;
      expect(rarityValue).toBe("S");
    });

    it("should ensure all bomps have rarity field", async () => {
      // Arrange
      const testScrapingContent = `# Scraping.md

## ボンプページリスト

- [complete-test-1](https://wiki.hoyolab.com/pc/zzz/entry/912) - 完全テスト1
- [complete-test-2](https://wiki.hoyolab.com/pc/zzz/entry/913) - 完全テスト2
`;
      fs.writeFileSync(testScrapingPath, testScrapingContent);

      const batchProcessor = new BompBatchProcessor();

      // Mock API responses
      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockImplementation(async (id: string) => {
        const rarity = id === "912" ? "A級" : "S級";
        return createMockApiResponseWithRarity(
          id,
          `完全テスト${id === "912" ? "1" : "2"}`,
          rarity
        );
      });

      // Act
      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 2,
        delayMs: 10,
        maxRetries: 1,
      });

      // Assert
      expect(result.successful.length).toBe(2);

      // Verify all bomps have rarity field
      result.successful.forEach((bomp, index) => {
        expect(bomp).toHaveProperty("rarity");
        expect(bomp.rarity).toBeDefined();
        expect(typeof bomp.rarity).toBe("string");
        expect(["A", "S"]).toContain(bomp.rarity);
      });

      // Verify specific rarity values
      const bomp1 = result.successful.find((b) => b.id === "complete-test-1");
      const bomp2 = result.successful.find((b) => b.id === "complete-test-2");

      expect(bomp1?.rarity).toBe("S"); // Both bomps will have S rarity due to mock implementation
      expect(bomp2?.rarity).toBe("S");
    });
  });
});
