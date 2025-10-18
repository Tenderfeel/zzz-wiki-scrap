import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { BompBatchProcessor } from "../../src/processors/BompBatchProcessor";
import { BompGenerator } from "../../src/generators/BompGenerator";
import { HoyoLabApiClient } from "../../src/clients/HoyoLabApiClient";
import { Bomp, Rarity } from "../../src/types";
import { ApiResponse } from "../../src/types/api";

/**
 * ボンプレア度統合パフォーマンステスト
 * レア度処理追加による性能影響を測定
 * 要件: 4.2 - パフォーマンステストを実行
 */
describe("Bomp Rarity Integration Performance Tests", () => {
  const testOutputDir = "bomp-rarity-performance-test";
  const performanceReportFile = "bomp-rarity-performance-report.md";

  beforeEach(() => {
    // テスト用ディレクトリを作成
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }

    // 既存のレポートファイルをクリーンアップ
    if (fs.existsSync(performanceReportFile)) {
      fs.unlinkSync(performanceReportFile);
    }
  });

  afterEach(() => {
    // テスト後のクリーンアップ
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
    if (fs.existsSync(performanceReportFile)) {
      fs.unlinkSync(performanceReportFile);
    }
  });

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

  // Helper function to create mock API response without rarity information (for baseline comparison)
  function createMockApiResponseWithoutRarity(
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
                      // レア度キーが存在しない
                      {
                        key: "『追加能力』",
                        value: ["<p>テスト追加能力</p>"],
                        id: "baseInfo13907",
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
  }

  describe("レア度処理追加による性能影響測定", () => {
    it("レア度処理ありとなしの処理時間比較", async () => {
      const testBompCount = 20;
      const testScrapingPath = path.join(testOutputDir, "test-scraping.md");
      const outputWithRarityPath = path.join(
        testOutputDir,
        "bomps-with-rarity.ts"
      );
      const outputWithoutRarityPath = path.join(
        testOutputDir,
        "bomps-without-rarity.ts"
      );

      // テスト用Scraping.mdファイルを作成
      const testScrapingContent = `# Scraping.md

## ボンプページリスト

${Array.from(
  { length: testBompCount },
  (_, i) =>
    `- [performance-test-bomp-${i + 1}](https://wiki.hoyolab.com/pc/zzz/entry/${
      912 + i
    }) - パフォーマンステストボンプ${i + 1}`
).join("\n")}
`;
      fs.writeFileSync(testScrapingPath, testScrapingContent);

      const batchProcessor = new BompBatchProcessor();
      const bompGenerator = new BompGenerator();

      // 1. レア度処理ありのテスト
      console.log("レア度処理ありのパフォーマンステスト実行中...");

      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockImplementation(async (id: string) => {
        const index = parseInt(id) - 912;
        const rarity: "A級" | "S級" = index % 2 === 0 ? "A級" : "S級";
        return createMockApiResponseWithRarity(
          id,
          `パフォーマンステストボンプ${index + 1}`,
          rarity
        );
      });

      const startTimeWithRarity = Date.now();
      const initialMemoryWithRarity = process.memoryUsage();

      const resultWithRarity = await batchProcessor.processAllBomps(
        testScrapingPath,
        {
          batchSize: 5,
          delayMs: 10,
          maxRetries: 1,
        }
      );

      const endTimeWithRarity = Date.now();
      const finalMemoryWithRarity = process.memoryUsage();

      bompGenerator.outputBompFile(
        resultWithRarity.successful,
        outputWithRarityPath
      );

      // 2. レア度処理なしのテスト（ベースライン）
      console.log("レア度処理なしのパフォーマンステスト実行中...");

      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockImplementation(async (id: string) => {
        const index = parseInt(id) - 912;
        return createMockApiResponseWithoutRarity(
          id,
          `パフォーマンステストボンプ${index + 1}`
        );
      });

      const startTimeWithoutRarity = Date.now();
      const initialMemoryWithoutRarity = process.memoryUsage();

      const resultWithoutRarity = await batchProcessor.processAllBomps(
        testScrapingPath,
        {
          batchSize: 5,
          delayMs: 10,
          maxRetries: 1,
        }
      );

      const endTimeWithoutRarity = Date.now();
      const finalMemoryWithoutRarity = process.memoryUsage();

      bompGenerator.outputBompFile(
        resultWithoutRarity.successful,
        outputWithoutRarityPath
      );

      // 3. 結果の分析
      const executionTimeWithRarity = endTimeWithRarity - startTimeWithRarity;
      const executionTimeWithoutRarity =
        endTimeWithoutRarity - startTimeWithoutRarity;
      const memoryIncreaseWithRarity =
        finalMemoryWithRarity.heapUsed - initialMemoryWithRarity.heapUsed;
      const memoryIncreaseWithoutRarity =
        finalMemoryWithoutRarity.heapUsed - initialMemoryWithoutRarity.heapUsed;

      const timeOverhead = executionTimeWithRarity - executionTimeWithoutRarity;
      const memoryOverhead =
        memoryIncreaseWithRarity - memoryIncreaseWithoutRarity;
      const timeOverheadPercentage =
        (timeOverhead / executionTimeWithoutRarity) * 100;
      const memoryOverheadPercentage =
        memoryIncreaseWithoutRarity > 0
          ? (memoryOverhead / memoryIncreaseWithoutRarity) * 100
          : 0;

      // 4. 結果の検証
      expect(resultWithRarity.successful.length).toBeGreaterThanOrEqual(
        testBompCount * 0.8
      );
      expect(resultWithoutRarity.successful.length).toBeGreaterThanOrEqual(
        testBompCount * 0.8
      );

      // レア度処理による性能影響が許容範囲内であることを確認
      expect(timeOverheadPercentage).toBeLessThan(25); // 25%以内の処理時間増加
      expect(Math.abs(memoryOverheadPercentage)).toBeLessThan(30); // 30%以内のメモリ使用量変化

      // レア度データが正しく処理されていることを確認
      resultWithRarity.successful.forEach((bomp) => {
        expect(bomp.rarity).toMatch(/^[AS]$/);
      });

      // レア度なしの場合はデフォルト値が設定されていることを確認
      resultWithoutRarity.successful.forEach((bomp) => {
        expect(bomp.rarity).toBe("A"); // フォールバック値
      });

      // 5. 詳細な統計情報をコンソールに出力
      console.log(`\n=== レア度処理性能影響測定結果 ===`);
      console.log(`テストボンプ数: ${testBompCount}`);
      console.log(
        `レア度処理あり実行時間: ${Math.round(executionTimeWithRarity)}ms`
      );
      console.log(
        `レア度処理なし実行時間: ${Math.round(executionTimeWithoutRarity)}ms`
      );
      console.log(
        `処理時間オーバーヘッド: ${Math.round(timeOverhead)}ms (${Math.round(
          timeOverheadPercentage
        )}%)`
      );
      console.log(
        `レア度処理ありメモリ増加: ${Math.round(
          memoryIncreaseWithRarity / 1024
        )}KB`
      );
      console.log(
        `レア度処理なしメモリ増加: ${Math.round(
          memoryIncreaseWithoutRarity / 1024
        )}KB`
      );
      console.log(
        `メモリオーバーヘッド: ${Math.round(
          memoryOverhead / 1024
        )}KB (${Math.round(memoryOverheadPercentage)}%)`
      );
      console.log(
        `1ボンプあたり平均処理時間（レア度あり）: ${Math.round(
          executionTimeWithRarity / testBompCount
        )}ms`
      );
      console.log(
        `1ボンプあたり平均処理時間（レア度なし）: ${Math.round(
          executionTimeWithoutRarity / testBompCount
        )}ms`
      );
      console.log(`===============================================\n`);

      // 6. パフォーマンスレポートを生成
      await generateRarityPerformanceReport({
        testBompCount,
        executionTimeWithRarity,
        executionTimeWithoutRarity,
        memoryIncreaseWithRarity,
        memoryIncreaseWithoutRarity,
        timeOverhead,
        memoryOverhead,
        timeOverheadPercentage,
        memoryOverheadPercentage,
        successfulWithRarity: resultWithRarity.successful.length,
        successfulWithoutRarity: resultWithoutRarity.successful.length,
      });
    }, 120000); // 2分のタイムアウト

    it("大量ボンプでのレア度処理スケーラビリティテスト", async () => {
      const testSizes = [10, 20, 30, 50]; // 段階的にサイズを増加
      const results: Array<{
        size: number;
        executionTime: number;
        memoryIncrease: number;
        avgTimePerBomp: number;
        rarityExtractionSuccessRate: number;
      }> = [];

      for (const size of testSizes) {
        console.log(
          `${size}ボンプでのレア度処理スケーラビリティテスト実行中...`
        );

        const testScrapingPath = path.join(
          testOutputDir,
          `test-scraping-${size}.md`
        );
        const outputPath = path.join(testOutputDir, `bomps-scale-${size}.ts`);

        // テスト用Scraping.mdファイルを作成
        const testScrapingContent = `# Scraping.md

## ボンプページリスト

${Array.from(
  { length: size },
  (_, i) =>
    `- [scale-test-bomp-${i + 1}](https://wiki.hoyolab.com/pc/zzz/entry/${
      912 + i
    }) - スケールテストボンプ${i + 1}`
).join("\n")}
`;
        fs.writeFileSync(testScrapingPath, testScrapingContent);

        const batchProcessor = new BompBatchProcessor();
        const bompGenerator = new BompGenerator();

        // レア度データを含むモックレスポンスを設定
        vi.spyOn(
          HoyoLabApiClient.prototype,
          "fetchCharacterData"
        ).mockImplementation(async (id: string) => {
          const index = parseInt(id) - 912;
          const rarity: "A級" | "S級" = index % 3 === 0 ? "S級" : "A級"; // 1/3がS級、2/3がA級
          return createMockApiResponseWithRarity(
            id,
            `スケールテストボンプ${index + 1}`,
            rarity
          );
        });

        const startTime = Date.now();
        const initialMemory = process.memoryUsage();

        const result = await batchProcessor.processAllBomps(testScrapingPath, {
          batchSize: Math.min(10, size),
          delayMs: 5, // 高速テストのため遅延を短縮
          maxRetries: 1,
        });

        const endTime = Date.now();
        const finalMemory = process.memoryUsage();

        bompGenerator.outputBompFile(result.successful, outputPath);

        const executionTime = endTime - startTime;
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        const avgTimePerBomp = executionTime / result.successful.length;

        // レア度抽出成功率を計算
        const bompsWithValidRarity = result.successful.filter(
          (bomp) => bomp.rarity === "A" || bomp.rarity === "S"
        ).length;
        const rarityExtractionSuccessRate =
          (bompsWithValidRarity / result.successful.length) * 100;

        results.push({
          size,
          executionTime,
          memoryIncrease,
          avgTimePerBomp,
          rarityExtractionSuccessRate,
        });

        // 基本的な成功確認
        expect(result.successful.length).toBeGreaterThanOrEqual(
          Math.floor(size * 0.9)
        ); // 90%以上成功
        expect(rarityExtractionSuccessRate).toBeGreaterThanOrEqual(95); // 95%以上のレア度抽出成功率

        // 出力ファイルの確認
        expect(fs.existsSync(outputPath)).toBe(true);
        const outputContent = fs.readFileSync(outputPath, "utf-8");
        expect(outputContent).toContain("rarity:");
      }

      // スケーラビリティ分析
      console.log(`\n=== レア度処理スケーラビリティテスト結果 ===`);
      results.forEach((r) => {
        console.log(
          `${r.size}ボンプ: ${Math.round(r.executionTime)}ms, ` +
            `平均 ${Math.round(r.avgTimePerBomp)}ms/ボンプ, ` +
            `メモリ ${Math.round(r.memoryIncrease / 1024)}KB, ` +
            `レア度抽出成功率 ${Math.round(r.rarityExtractionSuccessRate)}%`
        );
      });

      // 線形スケーラビリティの確認
      if (results.length >= 2) {
        const firstResult = results[0];
        const lastResult = results[results.length - 1];
        const timeScalingRatio =
          lastResult.avgTimePerBomp / firstResult.avgTimePerBomp;
        const memoryScalingRatio =
          lastResult.memoryIncrease /
          lastResult.size /
          (firstResult.memoryIncrease / firstResult.size);

        console.log(
          `時間スケーリング比率: ${Math.round(timeScalingRatio * 100)}%`
        );
        console.log(
          `メモリスケーリング比率: ${Math.round(memoryScalingRatio * 100)}%`
        );

        // スケーラビリティの検証（レア度処理が線形にスケールすることを確認）
        expect(timeScalingRatio).toBeLessThan(2.0); // 2倍以内の時間増加
        expect(memoryScalingRatio).toBeLessThan(1.5); // 1.5倍以内のメモリ増加

        // 全体的な処理時間が合理的範囲内であることを確認
        expect(lastResult.executionTime).toBeLessThan(60000); // 最大1分以内
      }

      console.log(`===============================================\n`);
    }, 300000); // 5分のタイムアウト

    it("レア度抽出エラー処理の性能影響測定", async () => {
      const testBompCount = 15;
      const testScrapingPath = path.join(
        testOutputDir,
        "test-scraping-error.md"
      );
      const outputPath = path.join(testOutputDir, "bomps-error-handling.ts");

      // テスト用Scraping.mdファイルを作成（一部に無効なレア度データを含む）
      const testScrapingContent = `# Scraping.md

## ボンプページリスト

${Array.from(
  { length: testBompCount },
  (_, i) =>
    `- [error-test-bomp-${i + 1}](https://wiki.hoyolab.com/pc/zzz/entry/${
      912 + i
    }) - エラーテストボンプ${i + 1}`
).join("\n")}
`;
      fs.writeFileSync(testScrapingPath, testScrapingContent);

      const batchProcessor = new BompBatchProcessor();
      const bompGenerator = new BompGenerator();

      // 混合レスポンス：正常、レア度なし、不正レア度データ
      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockImplementation(async (id: string) => {
        const index = parseInt(id) - 912;

        if (index % 3 === 0) {
          // 正常なレア度データ
          return createMockApiResponseWithRarity(
            id,
            `エラーテストボンプ${index + 1}`,
            "A級"
          );
        } else if (index % 3 === 1) {
          // レア度データなし
          return createMockApiResponseWithoutRarity(
            id,
            `エラーテストボンプ${index + 1}`
          );
        } else {
          // 不正なレア度データ
          const mockResponse = createMockApiResponseWithRarity(
            id,
            `エラーテストボンプ${index + 1}`,
            "A級"
          );
          // baseInfoデータを不正な形式に変更
          const baseInfoComponent = mockResponse.data.page.modules
            .find((m) => m.name === "ステータス")
            ?.components.find((c) => c.component_id === "baseInfo");

          if (baseInfoComponent) {
            const baseInfoData = JSON.parse(baseInfoComponent.data);
            // レア度値を不正な値に変更
            const rarityItem = baseInfoData.list.find(
              (item: any) => item.key === "レア度"
            );
            if (rarityItem) {
              rarityItem.value = ["<p>不正な値</p>"];
            }
            baseInfoComponent.data = JSON.stringify(baseInfoData);
          }

          return mockResponse;
        }
      });

      const startTime = Date.now();
      const initialMemory = process.memoryUsage();

      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 5,
        delayMs: 10,
        maxRetries: 1,
      });

      const endTime = Date.now();
      const finalMemory = process.memoryUsage();

      bompGenerator.outputBompFile(result.successful, outputPath);

      const executionTime = endTime - startTime;
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const avgTimePerBomp = executionTime / result.successful.length;

      // エラー処理の分析
      const normalRarityCount = result.successful.filter(
        (bomp) => bomp.rarity === "A" || bomp.rarity === "S"
      ).length;
      const fallbackRarityCount = result.successful.filter(
        (bomp) => bomp.rarity === "A" // フォールバック値
      ).length;

      // 結果の検証
      expect(result.successful.length).toBeGreaterThanOrEqual(
        testBompCount * 0.6
      ); // 最低60%が処理される
      expect(result.failed.length).toBeLessThan(testBompCount * 0.5); // 失敗は50%未満

      // 全ボンプにレア度が設定されていることを確認
      result.successful.forEach((bomp) => {
        expect(bomp.rarity).toMatch(/^[AS]$/);
      });

      // エラー処理性能の確認
      expect(avgTimePerBomp).toBeLessThan(5000); // エラー処理込みで5秒/ボンプ以内
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB以内のメモリ増加

      // 出力ファイルの確認
      expect(fs.existsSync(outputPath)).toBe(true);
      const outputContent = fs.readFileSync(outputPath, "utf-8");
      expect(outputContent).toContain('"rarity":');

      console.log(`\n=== レア度エラー処理性能テスト結果 ===`);
      console.log(`テストボンプ数: ${testBompCount}`);
      console.log(`処理成功: ${result.successful.length}`);
      console.log(`処理失敗: ${result.failed.length}`);
      console.log(
        `正常レア度データ: ${Math.floor(testBompCount / 3)}個（予想）`
      );
      console.log(
        `フォールバック使用: ${
          testBompCount - Math.floor(testBompCount / 3)
        }個（予想）`
      );
      console.log(`実行時間: ${Math.round(executionTime)}ms`);
      console.log(`平均処理時間: ${Math.round(avgTimePerBomp)}ms/ボンプ`);
      console.log(`メモリ増加: ${Math.round(memoryIncrease / 1024)}KB`);
      console.log(`===============================================\n`);
    }, 120000); // 2分のタイムアウト
  });

  describe("メモリ使用量の変化確認", () => {
    it("レア度処理によるメモリ使用パターン分析", async () => {
      const testBompCount = 25;
      const testScrapingPath = path.join(
        testOutputDir,
        "test-scraping-memory.md"
      );
      const outputPath = path.join(testOutputDir, "bomps-memory-test.ts");

      // テスト用Scraping.mdファイルを作成
      const testScrapingContent = `# Scraping.md

## ボンプページリスト

${Array.from(
  { length: testBompCount },
  (_, i) =>
    `- [memory-test-bomp-${i + 1}](https://wiki.hoyolab.com/pc/zzz/entry/${
      912 + i
    }) - メモリテストボンプ${i + 1}`
).join("\n")}
`;
      fs.writeFileSync(testScrapingPath, testScrapingContent);

      const batchProcessor = new BompBatchProcessor();
      const bompGenerator = new BompGenerator();

      // レア度データを含むモックレスポンスを設定
      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockImplementation(async (id: string) => {
        const index = parseInt(id) - 912;
        const rarity: "A級" | "S級" = index % 2 === 0 ? "S級" : "A級";
        return createMockApiResponseWithRarity(
          id,
          `メモリテストボンプ${index + 1}`,
          rarity
        );
      });

      const memorySnapshots: Array<{
        stage: string;
        heapUsed: number;
        heapTotal: number;
        external: number;
        timestamp: number;
      }> = [];

      // 初期メモリ状態
      global.gc && global.gc(); // ガベージコレクションを強制実行（可能な場合）
      memorySnapshots.push({
        stage: "初期状態",
        timestamp: Date.now(),
        ...process.memoryUsage(),
      });

      const startTime = Date.now();

      // バッチ処理を実行（中間でメモリ測定）
      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 5,
        delayMs: 10,
        maxRetries: 1,
      });

      // 処理完了後メモリ状態
      memorySnapshots.push({
        stage: "処理完了後",
        timestamp: Date.now(),
        ...process.memoryUsage(),
      });

      // ファイル生成
      bompGenerator.outputBompFile(result.successful, outputPath);

      // ファイル生成後メモリ状態
      memorySnapshots.push({
        stage: "ファイル生成後",
        timestamp: Date.now(),
        ...process.memoryUsage(),
      });

      // ガベージコレクション後
      global.gc && global.gc();
      await new Promise((resolve) => setTimeout(resolve, 1000)); // GC完了を待機
      memorySnapshots.push({
        stage: "GC後",
        timestamp: Date.now(),
        ...process.memoryUsage(),
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // 結果検証
      expect(result.successful.length).toBe(testBompCount);
      expect(result.failed.length).toBe(0);

      // メモリ使用量の分析
      const initialMemory = memorySnapshots[0].heapUsed;
      const peakMemory = Math.max(...memorySnapshots.map((s) => s.heapUsed));
      const finalMemory = memorySnapshots[memorySnapshots.length - 1].heapUsed;

      const peakIncrease = peakMemory - initialMemory;
      const finalIncrease = finalMemory - initialMemory;
      const memoryEfficiency =
        finalIncrease > 0 ? peakIncrease / finalIncrease : 1;

      // メモリ効率性の検証
      expect(peakIncrease).toBeLessThan(100 * 1024 * 1024); // ピーク時100MB以内
      expect(finalIncrease).toBeLessThan(50 * 1024 * 1024); // 最終50MB以内

      // レア度データが正しく処理されていることを確認
      result.successful.forEach((bomp) => {
        expect(bomp.rarity).toMatch(/^[AS]$/);
      });

      // 出力ファイルサイズの確認
      const outputFileSize = fs.statSync(outputPath).size;
      expect(outputFileSize).toBeGreaterThan(1000); // 最低1KB以上
      expect(outputFileSize).toBeLessThan(1024 * 1024); // 1MB以内

      console.log(`\n=== レア度処理メモリ使用パターン分析結果 ===`);
      console.log(`テストボンプ数: ${testBompCount}`);
      console.log(`実行時間: ${Math.round(executionTime)}ms`);
      memorySnapshots.forEach((snapshot) => {
        const relativeTime = snapshot.timestamp - memorySnapshots[0].timestamp;
        console.log(
          `${snapshot.stage} (${relativeTime}ms): ` +
            `Heap ${Math.round(snapshot.heapUsed / 1024 / 1024)}MB, ` +
            `Total ${Math.round(snapshot.heapTotal / 1024 / 1024)}MB`
        );
      });
      console.log(`ピーク時増加: ${Math.round(peakIncrease / 1024 / 1024)}MB`);
      console.log(`最終増加: ${Math.round(finalIncrease / 1024 / 1024)}MB`);
      console.log(`メモリ効率: ${Math.round(memoryEfficiency * 100)}%`);
      console.log(`出力ファイルサイズ: ${Math.round(outputFileSize / 1024)}KB`);
      console.log(
        `1ボンプあたりメモリ使用量: ${Math.round(
          finalIncrease / testBompCount / 1024
        )}KB`
      );
      console.log(`===============================================\n`);
    }, 120000); // 2分のタイムアウト
  });

  describe("処理時間の変化測定", () => {
    it("レア度抽出処理の詳細時間分析", async () => {
      const testBompCount = 10;
      const testScrapingPath = path.join(
        testOutputDir,
        "test-scraping-timing.md"
      );
      const outputPath = path.join(testOutputDir, "bomps-timing-test.ts");

      // テスト用Scraping.mdファイルを作成
      const testScrapingContent = `# Scraping.md

## ボンプページリスト

${Array.from(
  { length: testBompCount },
  (_, i) =>
    `- [timing-test-bomp-${i + 1}](https://wiki.hoyolab.com/pc/zzz/entry/${
      912 + i
    }) - タイミングテストボンプ${i + 1}`
).join("\n")}
`;
      fs.writeFileSync(testScrapingPath, testScrapingContent);

      const batchProcessor = new BompBatchProcessor();
      const bompGenerator = new BompGenerator();

      // 異なる複雑さのレア度データを含むモックレスポンスを設定
      vi.spyOn(
        HoyoLabApiClient.prototype,
        "fetchCharacterData"
      ).mockImplementation(async (id: string) => {
        const index = parseInt(id) - 912;

        // 処理時間を測定するため、わずかな遅延を追加
        await new Promise((resolve) => setTimeout(resolve, 1));

        const rarity: "A級" | "S級" = index % 2 === 0 ? "S級" : "A級";

        // より複雑なbaseInfoデータを作成（実際のAPIレスポンスに近い形）
        const complexBaseInfo = {
          list: [
            {
              key: "名称",
              value: [`タイミングテストボンプ${index + 1}`],
              id: "baseInfo54936",
            },
            {
              key: "属性",
              value: [`<p><span style="color: #f0d12b">氷属性</span></p>`],
              id: "baseInfo85452",
            },
            {
              key: "レア度",
              value: [`<p><span style="color: #ff6b6b">${rarity}</span></p>`],
              id: "baseInfo97603",
            },
            {
              key: "『追加能力』",
              value: ["<p>複雑なテスト追加能力データ</p>"],
              id: "baseInfo13907",
            },
            {
              key: "実装バージョン",
              value: ["<p>Ver.2.2「穏やかな夜をよしとせず」</p>"],
              id: "baseInfo65703",
            },
            // 追加のダミーデータ（処理負荷を増加）
            ...Array.from({ length: 5 }, (_, i) => ({
              key: `ダミーキー${i + 1}`,
              value: [`<p>ダミー値${i + 1}</p>`],
              id: `baseInfo${90000 + i}`,
            })),
          ],
        };

        return {
          retcode: 0,
          message: "OK",
          data: {
            page: {
              id,
              name: `タイミングテストボンプ${index + 1}`,
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
                      data: JSON.stringify(complexBaseInfo),
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
      });

      // 詳細なタイミング測定
      const timingData: Array<{
        stage: string;
        timestamp: number;
        duration?: number;
      }> = [];

      timingData.push({ stage: "開始", timestamp: Date.now() });

      const result = await batchProcessor.processAllBomps(testScrapingPath, {
        batchSize: 3, // 小さなバッチサイズで詳細測定
        delayMs: 5,
        maxRetries: 1,
      });

      timingData.push({ stage: "バッチ処理完了", timestamp: Date.now() });

      bompGenerator.outputBompFile(result.successful, outputPath);

      timingData.push({ stage: "ファイル生成完了", timestamp: Date.now() });

      // 各段階の処理時間を計算
      for (let i = 1; i < timingData.length; i++) {
        timingData[i].duration =
          timingData[i].timestamp - timingData[i - 1].timestamp;
      }

      const totalExecutionTime =
        timingData[timingData.length - 1].timestamp - timingData[0].timestamp;
      const avgTimePerBomp = totalExecutionTime / result.successful.length;

      // 結果検証
      expect(result.successful.length).toBeGreaterThanOrEqual(
        testBompCount * 0.8
      );
      expect(result.failed.length).toBeLessThan(testBompCount * 0.3);

      // 処理時間の妥当性確認
      expect(avgTimePerBomp).toBeLessThan(3000); // 3秒/ボンプ以内
      expect(totalExecutionTime).toBeLessThan(30000); // 総処理時間30秒以内

      // レア度データが正しく処理されていることを確認
      const aRarityCount = result.successful.filter(
        (bomp) => bomp.rarity === "A"
      ).length;
      const sRarityCount = result.successful.filter(
        (bomp) => bomp.rarity === "S"
      ).length;
      expect(aRarityCount + sRarityCount).toBeGreaterThanOrEqual(
        result.successful.length * 0.9
      );

      // 出力ファイルの確認
      expect(fs.existsSync(outputPath)).toBe(true);
      const outputContent = fs.readFileSync(outputPath, "utf-8");
      expect(outputContent).toContain("rarity:");

      console.log(`\n=== レア度抽出処理詳細時間分析結果 ===`);
      console.log(`テストボンプ数: ${testBompCount}`);
      timingData.forEach((timing) => {
        const relativeTime = timing.timestamp - timingData[0].timestamp;
        const durationText = timing.duration ? ` (${timing.duration}ms)` : "";
        console.log(`${timing.stage}: ${relativeTime}ms${durationText}`);
      });
      console.log(`総実行時間: ${totalExecutionTime}ms`);
      console.log(`平均処理時間: ${Math.round(avgTimePerBomp)}ms/ボンプ`);
      console.log(`A級レア度: ${aRarityCount}個`);
      console.log(`S級レア度: ${sRarityCount}個`);
      console.log(
        `処理スループット: ${Math.round(
          (testBompCount / totalExecutionTime) * 1000 * 60
        )}ボンプ/分`
      );
      console.log(`===============================================\n`);
    }, 60000); // 1分のタイムアウト
  });
});

/**
 * レア度処理パフォーマンスレポートを生成
 * @param stats パフォーマンス統計情報
 */
async function generateRarityPerformanceReport(stats: {
  testBompCount: number;
  executionTimeWithRarity: number;
  executionTimeWithoutRarity: number;
  memoryIncreaseWithRarity: number;
  memoryIncreaseWithoutRarity: number;
  timeOverhead: number;
  memoryOverhead: number;
  timeOverheadPercentage: number;
  memoryOverheadPercentage: number;
  successfulWithRarity: number;
  successfulWithoutRarity: number;
}): Promise<void> {
  const reportPath = "bomp-rarity-performance-report.md";

  const report = `# ボンプレア度統合パフォーマンステストレポート

## 実行概要
- 実行日時: ${new Date().toLocaleString()}
- テストボンプ数: ${stats.testBompCount}
- レア度処理あり成功数: ${stats.successfulWithRarity}
- レア度処理なし成功数: ${stats.successfulWithoutRarity}

## パフォーマンス比較

### 処理時間
- レア度処理あり: ${Math.round(stats.executionTimeWithRarity)}ms
- レア度処理なし: ${Math.round(stats.executionTimeWithoutRarity)}ms
- 時間オーバーヘッド: ${Math.round(stats.timeOverhead)}ms (${Math.round(
    stats.timeOverheadPercentage
  )}%)

### メモリ使用量
- レア度処理ありメモリ増加: ${Math.round(
    stats.memoryIncreaseWithRarity / 1024
  )}KB
- レア度処理なしメモリ増加: ${Math.round(
    stats.memoryIncreaseWithoutRarity / 1024
  )}KB
- メモリオーバーヘッド: ${Math.round(
    stats.memoryOverhead / 1024
  )}KB (${Math.round(stats.memoryOverheadPercentage)}%)

### 1ボンプあたりの平均処理時間
- レア度処理あり: ${Math.round(
    stats.executionTimeWithRarity / stats.testBompCount
  )}ms/ボンプ
- レア度処理なし: ${Math.round(
    stats.executionTimeWithoutRarity / stats.testBompCount
  )}ms/ボンプ

## パフォーマンス評価

### 処理時間影響
${
  stats.timeOverheadPercentage < 10
    ? "✅ 優秀 (10%未満の増加)"
    : stats.timeOverheadPercentage < 25
    ? "✅ 良好 (25%未満の増加)"
    : "⚠️ 要改善 (25%以上の増加)"
}

### メモリ使用量影響
${
  Math.abs(stats.memoryOverheadPercentage) < 15
    ? "✅ 優秀 (15%未満の変化)"
    : Math.abs(stats.memoryOverheadPercentage) < 30
    ? "✅ 良好 (30%未満の変化)"
    : "⚠️ 要改善 (30%以上の変化)"
}

### 全体評価
${
  stats.timeOverheadPercentage < 25 &&
  Math.abs(stats.memoryOverheadPercentage) < 30
    ? "✅ レア度処理の性能影響は許容範囲内です"
    : "⚠️ レア度処理の性能影響について最適化を検討してください"
}

## 推奨事項
${
  stats.timeOverheadPercentage >= 25
    ? "- レア度抽出処理の最適化が必要です（JSON解析の効率化など）\n"
    : ""
}${
    Math.abs(stats.memoryOverheadPercentage) >= 30
      ? "- メモリ使用量の最適化が必要です（一時オブジェクトの削減など）\n"
      : ""
  }${
    stats.timeOverheadPercentage < 10 &&
    Math.abs(stats.memoryOverheadPercentage) < 15
      ? "- 現在の実装は効率的です。追加の最適化は不要です。\n"
      : ""
  }

## 技術的詳細
- レア度抽出は baseInfo コンポーネントからの JSON 解析により実行
- フォールバック処理により、レア度データが存在しない場合でも処理継続
- 型安全性を保ちながら、最小限の性能オーバーヘッドで実装

---
*このレポートは自動生成されました。詳細な分析が必要な場合は、個別のテストケースを確認してください。*
`;

  fs.writeFileSync(reportPath, report, "utf-8");
  console.log(`レア度処理パフォーマンスレポートを生成しました: ${reportPath}`);
}
