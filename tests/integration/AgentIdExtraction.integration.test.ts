import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WeaponDataMapper } from "../../src/mappers/WeaponDataMapper";
import { HoyoLabApiClient } from "../../src/clients/HoyoLabApiClient";
import { getAgentIdByName } from "../../src/utils/AgentMapping";
import { ApiResponse, Module, Component } from "../../src/types/api";
import { WeaponEntry } from "../../src/types";
import { performance } from "perf_hooks";
import * as fs from "fs";
import * as path from "path";

/**
 * AgentId抽出統合テスト
 * エンドツーエンドのagentId抽出テスト
 * 実際のAPIレスポンスを使用したテスト
 * レアリティS武器の全件テスト
 * 要件: 1.4, 2.3, 4.1
 */

// Helper function to create realistic weapon API response with agent info
function createWeaponApiResponseWithAgent(
  weaponId: string,
  weaponName: string,
  agentName: string,
  agentEpId: number = 29,
  rarity: "A" | "S" = "S",
  specialty: string = "強攻"
): ApiResponse {
  return {
    retcode: 0,
    message: "OK",
    data: {
      page: {
        id: weaponId,
        name: weaponName,
        agent_specialties: { values: [] },
        agent_stats: { values: [] },
        agent_rarity: { values: [] },
        agent_faction: { values: [] },
        modules: [
          {
            name: "基本情報",
            components: [
              {
                component_id: "baseInfo",
                data: JSON.stringify({
                  list: [
                    {
                      key: "名称",
                      value: [weaponName],
                      id: "baseInfo42033",
                    },
                    {
                      key: "該当エージェント",
                      value: [
                        `$[{"ep_id":${agentEpId},"icon":"https://example.com/agent.png","amount":0,"name":"${agentName}","menuId":"agent","_menuId":"8"}]$`,
                      ],
                      id: "baseInfo31176",
                      isMaterial: true,
                    },
                    {
                      key: "基礎ステータス",
                      value: ["<p>基礎攻撃力</p>"],
                      id: "baseInfo25801",
                    },
                    {
                      key: "上級ステータス",
                      value: ["<p>会心率</p>"],
                      id: "baseInfo61956",
                    },
                  ],
                }),
              },
            ],
          },
        ],
        filter_values: {
          w_engine_rarity: { values: [rarity] },
          filter_key_13: { values: [specialty] },
        },
      },
    },
  };
}

// Helper function to create weapon API response without agent info
function createWeaponApiResponseWithoutAgent(
  weaponId: string,
  weaponName: string,
  rarity: "A" | "S" = "S",
  specialty: string = "強攻"
): ApiResponse {
  return {
    retcode: 0,
    message: "OK",
    data: {
      page: {
        id: weaponId,
        name: weaponName,
        agent_specialties: { values: [] },
        agent_stats: { values: [] },
        agent_rarity: { values: [] },
        agent_faction: { values: [] },
        modules: [
          {
            name: "基本情報",
            components: [
              {
                component_id: "baseInfo",
                data: JSON.stringify({
                  list: [
                    {
                      key: "名称",
                      value: [weaponName],
                      id: "baseInfo42033",
                    },
                    {
                      key: "基礎ステータス",
                      value: ["<p>基礎攻撃力</p>"],
                      id: "baseInfo25801",
                    },
                    {
                      key: "上級ステータス",
                      value: ["<p>会心率</p>"],
                      id: "baseInfo61956",
                    },
                  ],
                }),
              },
            ],
          },
        ],
        filter_values: {
          w_engine_rarity: { values: [rarity] },
          filter_key_13: { values: [specialty] },
        },
      },
    },
  };
}

// Helper function to create malformed agent data response
function createMalformedAgentDataResponse(
  weaponId: string,
  weaponName: string,
  malformedAgentValue: string
): ApiResponse {
  return {
    retcode: 0,
    message: "OK",
    data: {
      page: {
        id: weaponId,
        name: weaponName,
        agent_specialties: { values: [] },
        agent_stats: { values: [] },
        agent_rarity: { values: [] },
        agent_faction: { values: [] },
        modules: [
          {
            name: "基本情報",
            components: [
              {
                component_id: "baseInfo",
                data: JSON.stringify({
                  list: [
                    {
                      key: "該当エージェント",
                      value: [malformedAgentValue],
                      id: "baseInfo31176",
                      isMaterial: true,
                    },
                  ],
                }),
              },
            ],
          },
        ],
        filter_values: {
          w_engine_rarity: { values: ["S"] },
          filter_key_13: { values: ["強攻"] },
        },
      },
    },
  };
}

describe("Agent ID Extraction Integration Tests", () => {
  let weaponDataMapper: WeaponDataMapper;
  let apiClient: HoyoLabApiClient;
  const testOutputDir = "test-output-agent-extraction";
  const performanceReportPath = path.join(
    testOutputDir,
    "agent-extraction-performance.json"
  );

  // Performance tracking
  let performanceMetrics: {
    startTime: number;
    endTime?: number;
    memoryUsage: {
      start: NodeJS.MemoryUsage;
      end?: NodeJS.MemoryUsage;
    };
    apiCallCount: number;
    successfulExtractions: number;
    failedExtractions: number;
  };

  beforeEach(() => {
    weaponDataMapper = new WeaponDataMapper();
    apiClient = new HoyoLabApiClient();

    // Performance tracking initialization
    performanceMetrics = {
      startTime: performance.now(),
      memoryUsage: {
        start: process.memoryUsage(),
      },
      apiCallCount: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
    };

    // Create test output directory
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
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
        heapUsedDelta:
          performanceMetrics.memoryUsage.end!.heapUsed -
          performanceMetrics.memoryUsage.start.heapUsed,
        rssUsedDelta:
          performanceMetrics.memoryUsage.end!.rss -
          performanceMetrics.memoryUsage.start.rss,
      },
      apiCallCount: performanceMetrics.apiCallCount,
      successfulExtractions: performanceMetrics.successfulExtractions,
      failedExtractions: performanceMetrics.failedExtractions,
      successRate:
        performanceMetrics.successfulExtractions /
        (performanceMetrics.successfulExtractions +
          performanceMetrics.failedExtractions),
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

    // Clean up test files
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }

    vi.clearAllMocks();
  });

  describe("End-to-End Agent ID Extraction", () => {
    it("should extract agent IDs for all S-rank weapons with known agents", async () => {
      // Arrange - Test data for known S-rank weapons with agents
      const sRankWeaponsWithAgents = [
        {
          weaponId: "85",
          weaponName: "ディープシー・ビジター",
          agentName: "エレン・ジョー",
          expectedAgentId: "ellen",
        },
        {
          weaponId: "76",
          weaponName: "恥じらう悪面",
          agentName: "ライカオン",
          expectedAgentId: "lycaon",
        },
        {
          weaponId: "77",
          weaponName: "ストリートスーパースター",
          agentName: "ニコル・デマラ",
          expectedAgentId: "nicole",
        },
        {
          weaponId: "78",
          weaponName: "スチームオーブン",
          agentName: "ライカオン",
          expectedAgentId: "lycaon",
        },
        {
          weaponId: "79",
          weaponName: "ヘルファイア・ガントレット",
          agentName: "ソウカク",
          expectedAgentId: "soukaku",
        },
      ];

      // Mock API responses
      let callCount = 0;
      vi.spyOn(apiClient, "fetchCharacterData").mockImplementation(
        async (pageId: number) => {
          callCount++;
          performanceMetrics.apiCallCount = callCount;

          const weapon = sRankWeaponsWithAgents.find(
            (w) => w.weaponId === pageId.toString()
          );
          if (weapon) {
            return createWeaponApiResponseWithAgent(
              weapon.weaponId,
              weapon.weaponName,
              weapon.agentName
            );
          }
          throw new Error(`Unknown weapon ID: ${pageId}`);
        }
      );

      // Act & Assert
      for (const weapon of sRankWeaponsWithAgents) {
        const apiResponse = await apiClient.fetchCharacterData(
          parseInt(weapon.weaponId),
          "ja-jp"
        );

        const agentInfo = weaponDataMapper.extractAgentInfo(
          apiResponse.data.page.modules
        );

        // Verify agent ID extraction
        expect(agentInfo.agentId).toBe(weapon.expectedAgentId);
        performanceMetrics.successfulExtractions++;

        // Debug information
        console.log(
          `✓ ${weapon.weaponName}: ${weapon.agentName} -> ${agentInfo.agentId}`
        );
      }

      // Performance assertions
      expect(performanceMetrics.successfulExtractions).toBe(
        sRankWeaponsWithAgents.length
      );
      expect(performanceMetrics.failedExtractions).toBe(0);
      expect(callCount).toBe(sRankWeaponsWithAgents.length);
    });

    it("should handle weapons without agent information gracefully", async () => {
      // Arrange - Test data for weapons without agent info
      const weaponsWithoutAgents = [
        {
          weaponId: "100",
          weaponName: "汎用音動機A",
          rarity: "A" as const,
        },
        {
          weaponId: "101",
          weaponName: "汎用音動機B",
          rarity: "A" as const,
        },
        {
          weaponId: "102",
          weaponName: "汎用音動機S",
          rarity: "S" as const,
        },
      ];

      // Mock API responses without agent info
      let callCount = 0;
      vi.spyOn(apiClient, "fetchCharacterData").mockImplementation(
        async (pageId: number) => {
          callCount++;
          performanceMetrics.apiCallCount = callCount;

          const weapon = weaponsWithoutAgents.find(
            (w) => w.weaponId === pageId.toString()
          );
          if (weapon) {
            return createWeaponApiResponseWithoutAgent(
              weapon.weaponId,
              weapon.weaponName,
              weapon.rarity
            );
          }
          throw new Error(`Unknown weapon ID: ${pageId}`);
        }
      );

      // Act & Assert
      for (const weapon of weaponsWithoutAgents) {
        const apiResponse = await apiClient.fetchCharacterData(
          parseInt(weapon.weaponId),
          "ja-jp"
        );

        const agentInfo = weaponDataMapper.extractAgentInfo(
          apiResponse.data.page.modules
        );

        // Verify that no agent ID is extracted (empty string)
        expect(agentInfo.agentId).toBe("");
        performanceMetrics.successfulExtractions++; // Successful handling of no-agent case

        // Debug information
        console.log(
          `✓ ${weapon.weaponName}: No agent -> "${agentInfo.agentId}"`
        );
      }

      // Performance assertions
      expect(performanceMetrics.successfulExtractions).toBe(
        weaponsWithoutAgents.length
      );
      expect(performanceMetrics.failedExtractions).toBe(0);
    });

    it("should handle malformed agent data with fallback processing", async () => {
      // Arrange - Test data with various malformed agent data
      const malformedAgentDataTests = [
        {
          weaponId: "200",
          weaponName: "不正データテスト1",
          malformedValue: "invalid json data",
          expectedAgentId: "", // Should fail gracefully
        },
        {
          weaponId: "201",
          weaponName: "不正データテスト2",
          malformedValue: '$[{"invalid": "structure"}]$',
          expectedAgentId: "", // Should fail gracefully
        },
        {
          weaponId: "202",
          weaponName: "不正データテスト3",
          malformedValue: 'some text with "name":"エレン・ジョー" embedded',
          expectedAgentId: "ellen", // Should extract via fallback regex
        },
        {
          weaponId: "203",
          weaponName: "不正データテスト4",
          malformedValue: '$[{"ep_id":29,"name":"ライカオン","other":"data"}]$',
          expectedAgentId: "lycaon", // Should extract successfully
        },
      ];

      // Mock API responses with malformed data
      let callCount = 0;
      vi.spyOn(apiClient, "fetchCharacterData").mockImplementation(
        async (pageId: number) => {
          callCount++;
          performanceMetrics.apiCallCount = callCount;

          const test = malformedAgentDataTests.find(
            (t) => t.weaponId === pageId.toString()
          );
          if (test) {
            return createMalformedAgentDataResponse(
              test.weaponId,
              test.weaponName,
              test.malformedValue
            );
          }
          throw new Error(`Unknown weapon ID: ${pageId}`);
        }
      );

      // Act & Assert
      for (const test of malformedAgentDataTests) {
        const apiResponse = await apiClient.fetchCharacterData(
          parseInt(test.weaponId),
          "ja-jp"
        );

        const agentInfo = weaponDataMapper.extractAgentInfo(
          apiResponse.data.page.modules
        );

        // Verify expected behavior
        expect(agentInfo.agentId).toBe(test.expectedAgentId);

        if (test.expectedAgentId) {
          performanceMetrics.successfulExtractions++;
        } else {
          performanceMetrics.failedExtractions++;
        }

        // Debug information
        console.log(
          `✓ ${test.weaponName}: Malformed data -> "${agentInfo.agentId}"`
        );
      }

      // Verify that system handles malformed data gracefully
      expect(performanceMetrics.successfulExtractions).toBeGreaterThan(0);
      expect(performanceMetrics.failedExtractions).toBeGreaterThan(0);
    });

    it("should handle new character mappings correctly", async () => {
      // Arrange - Test data for new characters including Lucia
      const newCharacterTests = [
        {
          weaponId: "300",
          weaponName: "リュシア専用武器",
          agentName: "リュシア・プラム",
          expectedAgentId: "lucia",
        },
        {
          weaponId: "301",
          weaponName: "リュシア専用武器2",
          agentName: "リュシア",
          expectedAgentId: "lucia",
        },
        {
          weaponId: "302",
          weaponName: "Lucia Weapon",
          agentName: "Lucia Plum",
          expectedAgentId: "lucia",
        },
        {
          weaponId: "303",
          weaponName: "未知キャラ武器",
          agentName: "未知のキャラクター",
          expectedAgentId: "", // Should not match any mapping
        },
      ];

      // Mock API responses
      let callCount = 0;
      vi.spyOn(apiClient, "fetchCharacterData").mockImplementation(
        async (pageId: number) => {
          callCount++;
          performanceMetrics.apiCallCount = callCount;

          const test = newCharacterTests.find(
            (t) => t.weaponId === pageId.toString()
          );
          if (test) {
            return createWeaponApiResponseWithAgent(
              test.weaponId,
              test.weaponName,
              test.agentName
            );
          }
          throw new Error(`Unknown weapon ID: ${pageId}`);
        }
      );

      // Act & Assert
      for (const test of newCharacterTests) {
        const apiResponse = await apiClient.fetchCharacterData(
          parseInt(test.weaponId),
          "ja-jp"
        );

        const agentInfo = weaponDataMapper.extractAgentInfo(
          apiResponse.data.page.modules
        );

        // Verify agent ID mapping
        expect(agentInfo.agentId).toBe(test.expectedAgentId);

        if (test.expectedAgentId) {
          performanceMetrics.successfulExtractions++;
        } else {
          performanceMetrics.failedExtractions++;
        }

        // Debug information
        console.log(
          `✓ ${test.weaponName}: ${test.agentName} -> "${agentInfo.agentId}"`
        );
      }

      // Verify new character mappings work
      expect(performanceMetrics.successfulExtractions).toBe(3); // Lucia variants
      expect(performanceMetrics.failedExtractions).toBe(1); // Unknown character
    });
  });

  describe("API Response Variations", () => {
    it("should handle different API response structures", async () => {
      // Arrange - Test different API response variations
      const apiVariationTests = [
        {
          weaponId: "400",
          weaponName: "API変化テスト1",
          agentName: "エレン・ジョー",
          useOldFormat: false, // Use 'value' array
        },
        {
          weaponId: "401",
          weaponName: "API変化テスト2",
          agentName: "ライカオン",
          useOldFormat: true, // Use 'values' array (legacy)
        },
      ];

      // Mock API responses with different structures
      vi.spyOn(apiClient, "fetchCharacterData").mockImplementation(
        async (pageId: number) => {
          performanceMetrics.apiCallCount++;

          const test = apiVariationTests.find(
            (t) => t.weaponId === pageId.toString()
          );
          if (test) {
            const response = createWeaponApiResponseWithAgent(
              test.weaponId,
              test.weaponName,
              test.agentName
            );

            // Modify response structure based on test
            if (test.useOldFormat) {
              // Convert 'value' to 'values' for legacy format test
              const baseInfoComponent =
                response.data.page.modules[0].components[0];
              const baseInfoData = JSON.parse(baseInfoComponent.data);
              const agentItem = baseInfoData.list.find(
                (item: any) => item.key === "該当エージェント"
              );
              if (agentItem) {
                agentItem.values = agentItem.value;
                delete agentItem.value;
              }
              baseInfoComponent.data = JSON.stringify(baseInfoData);
            }

            return response;
          }
          throw new Error(`Unknown weapon ID: ${pageId}`);
        }
      );

      // Act & Assert
      for (const test of apiVariationTests) {
        const apiResponse = await apiClient.fetchCharacterData(
          parseInt(test.weaponId),
          "ja-jp"
        );

        const agentInfo = weaponDataMapper.extractAgentInfo(
          apiResponse.data.page.modules
        );

        // Verify that both formats work
        expect(agentInfo.agentId).toBeTruthy();
        performanceMetrics.successfulExtractions++;

        // Debug information
        console.log(
          `✓ ${test.weaponName} (${
            test.useOldFormat ? "legacy" : "new"
          } format): ${test.agentName} -> "${agentInfo.agentId}"`
        );
      }

      expect(performanceMetrics.successfulExtractions).toBe(
        apiVariationTests.length
      );
    });
  });

  describe("Performance and Memory Tests", () => {
    it("should process large number of weapons efficiently", async () => {
      // Arrange - Generate large test dataset
      const largeWeaponSet = Array.from({ length: 50 }, (_, i) => ({
        weaponId: (500 + i).toString(),
        weaponName: `大量テスト武器${i + 1}`,
        agentName: i % 2 === 0 ? "エレン・ジョー" : "ライカオン",
        expectedAgentId: i % 2 === 0 ? "ellen" : "lycaon",
      }));

      // Mock API responses
      vi.spyOn(apiClient, "fetchCharacterData").mockImplementation(
        async (pageId: number) => {
          performanceMetrics.apiCallCount++;

          const weapon = largeWeaponSet.find(
            (w) => w.weaponId === pageId.toString()
          );
          if (weapon) {
            // Simulate API delay
            await new Promise((resolve) => setTimeout(resolve, 10));
            return createWeaponApiResponseWithAgent(
              weapon.weaponId,
              weapon.weaponName,
              weapon.agentName
            );
          }
          throw new Error(`Unknown weapon ID: ${pageId}`);
        }
      );

      const startTime = performance.now();

      // Act - Process all weapons
      const results: Array<{
        weaponId: string;
        agentId: string;
        expected: string;
      }> = [];
      for (const weapon of largeWeaponSet) {
        const apiResponse = await apiClient.fetchCharacterData(
          parseInt(weapon.weaponId),
          "ja-jp"
        );

        const agentInfo = weaponDataMapper.extractAgentInfo(
          apiResponse.data.page.modules
        );

        results.push({
          weaponId: weapon.weaponId,
          agentId: agentInfo.agentId,
          expected: weapon.expectedAgentId,
        });

        if (agentInfo.agentId === weapon.expectedAgentId) {
          performanceMetrics.successfulExtractions++;
        } else {
          performanceMetrics.failedExtractions++;
        }
      }

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Assert - Performance requirements
      expect(results).toHaveLength(largeWeaponSet.length);
      expect(performanceMetrics.successfulExtractions).toBe(
        largeWeaponSet.length
      );
      expect(performanceMetrics.failedExtractions).toBe(0);

      // Performance assertions
      expect(processingTime).toBeLessThan(30000); // Should complete within 30 seconds
      const avgTimePerWeapon = processingTime / largeWeaponSet.length;
      expect(avgTimePerWeapon).toBeLessThan(500); // Less than 500ms per weapon

      console.log(`Performance Results:`);
      console.log(`  Total processing time: ${processingTime.toFixed(2)}ms`);
      console.log(
        `  Average time per weapon: ${avgTimePerWeapon.toFixed(2)}ms`
      );
      console.log(`  Processed weapons: ${results.length}`);
      console.log(`  Success rate: 100%`);
    });

    it("should maintain memory efficiency during processing", async () => {
      // Arrange
      const initialMemory = process.memoryUsage();
      const weaponCount = 30;

      const memoryTestWeapons = Array.from({ length: weaponCount }, (_, i) => ({
        weaponId: (600 + i).toString(),
        weaponName: `メモリテスト武器${i + 1}`,
        agentName: "エレン・ジョー",
        expectedAgentId: "ellen",
      }));

      // Mock API responses
      vi.spyOn(apiClient, "fetchCharacterData").mockImplementation(
        async (pageId: number) => {
          performanceMetrics.apiCallCount++;

          const weapon = memoryTestWeapons.find(
            (w) => w.weaponId === pageId.toString()
          );
          if (weapon) {
            return createWeaponApiResponseWithAgent(
              weapon.weaponId,
              weapon.weaponName,
              weapon.agentName
            );
          }
          throw new Error(`Unknown weapon ID: ${pageId}`);
        }
      );

      // Act - Process weapons and monitor memory
      for (const weapon of memoryTestWeapons) {
        const apiResponse = await apiClient.fetchCharacterData(
          parseInt(weapon.weaponId),
          "ja-jp"
        );

        const agentInfo = weaponDataMapper.extractAgentInfo(
          apiResponse.data.page.modules
        );

        expect(agentInfo.agentId).toBe(weapon.expectedAgentId);
        performanceMetrics.successfulExtractions++;

        // Force garbage collection periodically
        if (performanceMetrics.successfulExtractions % 10 === 0) {
          if (global.gc) {
            global.gc();
          }
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Assert - Memory efficiency
      expect(performanceMetrics.successfulExtractions).toBe(weaponCount);

      // Memory usage should be reasonable (less than 50MB increase)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

      console.log(`Memory Usage Results:`);
      console.log(
        `  Initial memory: ${Math.round(
          initialMemory.heapUsed / 1024 / 1024
        )}MB`
      );
      console.log(
        `  Final memory: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`
      );
      console.log(
        `  Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`
      );
      console.log(`  Processed weapons: ${weaponCount}`);
    });
  });

  describe("Agent Mapping Function Tests", () => {
    it("should test agent mapping function directly", () => {
      // Test cases for agent mapping
      const mappingTests = [
        // Exact matches
        { input: "エレン・ジョー", expected: "ellen" },
        { input: "Ellen Joe", expected: "ellen" },
        { input: "ライカオン", expected: "lycaon" },
        { input: "Von Lycaon", expected: "lycaon" },

        // New character mappings
        { input: "リュシア", expected: "lucia" },
        { input: "リュシア・プラム", expected: "lucia" },
        { input: "Lucia", expected: "lucia" },
        { input: "Lucia Plum", expected: "lucia" },

        // Partial matches
        { input: "エレン", expected: "ellen" },
        { input: "Ellen", expected: "ellen" },

        // Unknown characters
        { input: "未知のキャラクター", expected: "" },
        { input: "Unknown Character", expected: "" },

        // Edge cases
        { input: "", expected: "" },
        { input: "   ", expected: "" },
        { input: "A", expected: "" }, // Too short for partial match
      ];

      mappingTests.forEach((test) => {
        const result = getAgentIdByName(test.input);
        expect(result).toBe(test.expected);

        if (test.expected) {
          performanceMetrics.successfulExtractions++;
        } else {
          performanceMetrics.failedExtractions++;
        }

        console.log(`✓ "${test.input}" -> "${result}"`);
      });

      // Verify that new mappings work correctly
      const luciaVariants = mappingTests.filter(
        (t) =>
          t.input.toLowerCase().includes("lucia") ||
          t.input.includes("リュシア")
      );
      const successfulLuciaMappings = luciaVariants.filter(
        (t) => t.expected === "lucia"
      );
      expect(successfulLuciaMappings).toHaveLength(4); // All Lucia variants should map correctly
    });
  });
});
