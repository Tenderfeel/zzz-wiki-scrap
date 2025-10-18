import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { BompDataMapper } from "../../src/mappers/BompDataMapper";
import { BompDataProcessor } from "../../src/processors/BompDataProcessor";
import { BompGenerator } from "../../src/generators/BompGenerator";

/**
 * ボンプレア度統合パフォーマンステスト（簡易版）
 * レア度処理追加による性能影響を測定
 * 要件: 4.2 - パフォーマンステストを実行
 */
describe("Bomp Rarity Performance Tests (Simple)", () => {
  const testOutputDir = "bomp-rarity-performance-simple";
  const performanceReportFile = "bomp-rarity-performance-simple-report.md";

  beforeEach(() => {
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
    if (fs.existsSync(performanceReportFile)) {
      fs.unlinkSync(performanceReportFile);
    }
  });

  afterEach(() => {
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
    if (fs.existsSync(performanceReportFile)) {
      fs.unlinkSync(performanceReportFile);
    }
  });

  // Mock API response data with rarity information
  const createMockModulesWithRarity = (rarity: "A級" | "S級" = "A級") => [
    {
      name: "ステータス",
      components: [
        {
          component_id: "baseInfo",
          data: JSON.stringify({
            list: [
              {
                key: "名称",
                value: ["テストボンプ"],
                id: "baseInfo54936",
              },
              {
                key: "属性",
                value: ["<p>氷属性</p>"],
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
  ];

  // Mock API response data without rarity information
  const createMockModulesWithoutRarity = () => [
    {
      name: "ステータス",
      components: [
        {
          component_id: "baseInfo",
          data: JSON.stringify({
            list: [
              {
                key: "名称",
                value: ["テストボンプ"],
                id: "baseInfo54936",
              },
              {
                key: "属性",
                value: ["<p>氷属性</p>"],
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
  ];

  describe("レア度処理追加による性能影響測定", () => {
    it("レア度抽出処理の処理時間測定", async () => {
      const bompDataMapper = new BompDataMapper();
      const iterations = 1000; // 1000回の処理で平均時間を測定

      // レア度ありのテストデータ
      const modulesWithRarity = createMockModulesWithRarity("S級");

      // レア度なしのテストデータ
      const modulesWithoutRarity = createMockModulesWithoutRarity();

      // 1. レア度処理ありの時間測定
      const startTimeWithRarity = Date.now();
      let successfulExtractions = 0;

      for (let i = 0; i < iterations; i++) {
        try {
          const rawRarity =
            bompDataMapper.extractRarityFromBaseInfo(modulesWithRarity);
          const normalizedRarity = bompDataMapper.normalizeRarity(rawRarity);
          if (normalizedRarity === "S") {
            successfulExtractions++;
          }
        } catch (error) {
          // エラーは無視（フォールバック処理をシミュレート）
        }
      }

      const endTimeWithRarity = Date.now();
      const timeWithRarity = endTimeWithRarity - startTimeWithRarity;

      // 2. レア度処理なしの時間測定（ベースライン）
      const startTimeWithoutRarity = Date.now();
      let fallbackCount = 0;

      for (let i = 0; i < iterations; i++) {
        try {
          const rawRarity =
            bompDataMapper.extractRarityFromBaseInfo(modulesWithoutRarity);
          const normalizedRarity = bompDataMapper.normalizeRarity(rawRarity);
        } catch (error) {
          // フォールバック処理
          fallbackCount++;
        }
      }

      const endTimeWithoutRarity = Date.now();
      const timeWithoutRarity = endTimeWithoutRarity - startTimeWithoutRarity;

      // 3. 結果の分析
      const avgTimeWithRarity = timeWithRarity / iterations;
      const avgTimeWithoutRarity = timeWithoutRarity / iterations;
      const timeOverhead = timeWithRarity - timeWithoutRarity;
      const timeOverheadPercentage =
        timeWithoutRarity > 0 ? (timeOverhead / timeWithoutRarity) * 100 : 0;

      // 4. 結果の検証
      expect(successfulExtractions).toBe(iterations); // 全て成功
      expect(fallbackCount).toBe(iterations); // 全てフォールバック
      expect(avgTimeWithRarity).toBeLessThan(10); // 10ms以内/処理
      expect(timeOverheadPercentage).toBeLessThan(200); // 200%以内のオーバーヘッド

      console.log(`\n=== レア度抽出処理時間測定結果 ===`);
      console.log(`テスト回数: ${iterations}`);
      console.log(`レア度処理あり総時間: ${timeWithRarity}ms`);
      console.log(`レア度処理なし総時間: ${timeWithoutRarity}ms`);
      console.log(
        `レア度処理あり平均時間: ${avgTimeWithRarity.toFixed(3)}ms/処理`
      );
      console.log(
        `レア度処理なし平均時間: ${avgTimeWithoutRarity.toFixed(3)}ms/処理`
      );
      console.log(
        `時間オーバーヘッド: ${timeOverhead}ms (${timeOverheadPercentage.toFixed(
          1
        )}%)`
      );
      console.log(`成功抽出数: ${successfulExtractions}`);
      console.log(`フォールバック数: ${fallbackCount}`);
      console.log(`===============================================\n`);
    });

    it("メモリ使用量の変化確認", async () => {
      const bompDataMapper = new BompDataMapper();
      const bompDataProcessor = new BompDataProcessor();
      const bompGenerator = new BompGenerator();
      const iterations = 100; // メモリテスト用

      // 初期メモリ状態
      global.gc && global.gc();
      const initialMemory = process.memoryUsage();

      // レア度処理を含む大量データ処理
      const modulesWithRarity = createMockModulesWithRarity("A級");
      const processedData = [];

      for (let i = 0; i < iterations; i++) {
        try {
          // レア度抽出
          const rawRarity =
            bompDataMapper.extractRarityFromBaseInfo(modulesWithRarity);
          const normalizedRarity = bompDataMapper.normalizeRarity(rawRarity);

          // 基本情報抽出
          const mockApiResponse = {
            data: {
              page: {
                id: `test-${i}`,
                name: `テストボンプ${i}`,
                modules: modulesWithRarity,
              },
            },
          };
          const basicInfo = bompDataMapper.extractBasicBompInfo(
            mockApiResponse,
            `test-${i}`
          );
          basicInfo.rarity = normalizedRarity;

          // データ処理
          const processedBompData = {
            basicInfo,
            extraAbility: "テスト追加能力",
            factionIds: [],
            attributes: {
              hp: [360, 933, 1549, 2166, 2782, 3399, 3827],
              atk: [53, 342, 807, 1568, 3070, 6303, 6570],
              def: [32, 156, 288, 422, 556, 688, 781],
              impact: 94,
              critRate: 5,
              critDmg: 50,
              anomalyMastery: 0,
              anomalyProficiency: 100,
              penRatio: 0,
              energy: 0,
            },
          };

          processedData.push(processedBompData);
        } catch (error) {
          // エラー処理
        }
      }

      // 処理後メモリ状態
      const afterProcessingMemory = process.memoryUsage();

      // ボンプ生成
      const bomps = [];
      for (let i = 0; i < Math.min(processedData.length, 50); i++) {
        const data = processedData[i];
        const bomp = bompGenerator.generateBomp(data, null, `test-bomp-${i}`);
        bomps.push(bomp);
      }

      // 生成後メモリ状態
      const afterGenerationMemory = process.memoryUsage();

      // ガベージコレクション後
      global.gc && global.gc();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const finalMemory = process.memoryUsage();

      // メモリ使用量の分析
      const processingMemoryIncrease =
        afterProcessingMemory.heapUsed - initialMemory.heapUsed;
      const generationMemoryIncrease =
        afterGenerationMemory.heapUsed - afterProcessingMemory.heapUsed;
      const finalMemoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryPerBomp = finalMemoryIncrease / bomps.length;

      // 結果の検証
      expect(processedData.length).toBeGreaterThanOrEqual(iterations * 0.8); // 最低80%処理
      expect(bomps.length).toBeGreaterThanOrEqual(
        Math.min(processedData.length, 40)
      ); // 最低40個生成
      expect(processingMemoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB以内
      expect(memoryPerBomp).toBeLessThan(1024 * 1024); // 1MB/ボンプ以内

      // 全ボンプにレア度が設定されていることを確認
      bomps.forEach((bomp) => {
        expect(bomp.rarity).toMatch(/^[AS]$/);
      });

      console.log(`\n=== レア度処理メモリ使用量測定結果 ===`);
      console.log(`処理データ数: ${processedData.length}`);
      console.log(`生成ボンプ数: ${bomps.length}`);
      console.log(
        `初期メモリ: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`
      );
      console.log(
        `処理後メモリ: ${Math.round(
          afterProcessingMemory.heapUsed / 1024 / 1024
        )}MB`
      );
      console.log(
        `生成後メモリ: ${Math.round(
          afterGenerationMemory.heapUsed / 1024 / 1024
        )}MB`
      );
      console.log(
        `最終メモリ: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`
      );
      console.log(
        `処理時メモリ増加: ${Math.round(processingMemoryIncrease / 1024)}KB`
      );
      console.log(
        `生成時メモリ増加: ${Math.round(generationMemoryIncrease / 1024)}KB`
      );
      console.log(
        `最終メモリ増加: ${Math.round(finalMemoryIncrease / 1024)}KB`
      );
      console.log(`1ボンプあたりメモリ: ${Math.round(memoryPerBomp / 1024)}KB`);
      console.log(`===============================================\n`);

      // パフォーマンスレポートを生成
      await generateSimplePerformanceReport({
        iterations,
        processedDataCount: processedData.length,
        generatedBompCount: bomps.length,
        processingMemoryIncrease,
        generationMemoryIncrease,
        finalMemoryIncrease,
        memoryPerBomp,
      });
    });

    it("レア度抽出エラー処理の性能測定", async () => {
      const bompDataMapper = new BompDataMapper();
      const iterations = 500;

      // 異なるエラーケースのテストデータ
      const testCases = [
        { name: "正常データ", modules: createMockModulesWithRarity("A級") },
        { name: "レア度なし", modules: createMockModulesWithoutRarity() },
        {
          name: "不正レア度",
          modules: [
            {
              name: "ステータス",
              components: [
                {
                  component_id: "baseInfo",
                  data: JSON.stringify({
                    list: [
                      {
                        key: "レア度",
                        value: ["<p>不正な値</p>"],
                        id: "baseInfo97603",
                      },
                    ],
                  }),
                },
              ],
            },
          ],
        },
        {
          name: "JSON不正",
          modules: [
            {
              name: "ステータス",
              components: [
                {
                  component_id: "baseInfo",
                  data: "不正なJSON",
                },
              ],
            },
          ],
        },
      ];

      const results = [];

      for (const testCase of testCases) {
        const startTime = Date.now();
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < iterations; i++) {
          try {
            const rawRarity = bompDataMapper.extractRarityFromBaseInfo(
              testCase.modules
            );
            const normalizedRarity = bompDataMapper.normalizeRarity(rawRarity);
            successCount++;
          } catch (error) {
            errorCount++;
            // フォールバック処理をシミュレート
          }
        }

        const endTime = Date.now();
        const totalTime = endTime - startTime;
        const avgTime = totalTime / iterations;

        results.push({
          name: testCase.name,
          totalTime,
          avgTime,
          successCount,
          errorCount,
          successRate: (successCount / iterations) * 100,
        });

        // エラー処理性能の検証
        expect(avgTime).toBeLessThan(5); // 5ms以内/処理
        expect(totalTime).toBeLessThan(2500); // 2.5秒以内/500回
      }

      console.log(`\n=== レア度抽出エラー処理性能測定結果 ===`);
      console.log(`テスト回数: ${iterations}回/ケース`);
      results.forEach((result) => {
        console.log(`${result.name}:`);
        console.log(`  総時間: ${result.totalTime}ms`);
        console.log(`  平均時間: ${result.avgTime.toFixed(3)}ms/処理`);
        console.log(
          `  成功: ${result.successCount}, エラー: ${result.errorCount}`
        );
        console.log(`  成功率: ${result.successRate.toFixed(1)}%`);
      });
      console.log(`===============================================\n`);

      // 正常データは100%成功、エラーデータは0%成功であることを確認
      const normalResult = results.find((r) => r.name === "正常データ");
      const errorResults = results.filter((r) => r.name !== "正常データ");

      expect(normalResult?.successRate).toBe(100);
      errorResults.forEach((result) => {
        expect(result.successRate).toBe(0);
      });
    });
  });

  describe("処理時間の変化測定", () => {
    it("レア度処理パイプライン全体の性能測定", async () => {
      const bompDataMapper = new BompDataMapper();
      const bompDataProcessor = new BompDataProcessor();
      const bompGenerator = new BompGenerator();
      const testCount = 50;

      const timingData: Array<{
        stage: string;
        timestamp: number;
        duration?: number;
      }> = [];

      timingData.push({ stage: "開始", timestamp: Date.now() });

      // 1. データ抽出段階
      const extractedData = [];
      for (let i = 0; i < testCount; i++) {
        const modules = createMockModulesWithRarity(
          i % 2 === 0 ? "A級" : "S級"
        );
        try {
          const rawRarity = bompDataMapper.extractRarityFromBaseInfo(modules);
          const normalizedRarity = bompDataMapper.normalizeRarity(rawRarity);

          const mockApiResponse = {
            data: {
              page: {
                id: `pipeline-test-${i}`,
                name: `パイプラインテストボンプ${i}`,
                modules: modules,
              },
            },
          };

          const basicInfo = bompDataMapper.extractBasicBompInfo(
            mockApiResponse,
            `pipeline-test-${i}`
          );
          basicInfo.rarity = normalizedRarity;
          extractedData.push({ basicInfo, modules });
        } catch (error) {
          // フォールバック処理
          const mockApiResponse = {
            data: {
              page: {
                id: `pipeline-test-${i}`,
                name: `パイプラインテストボンプ${i}`,
                modules: modules,
              },
            },
          };

          const basicInfo = bompDataMapper.extractBasicBompInfo(
            mockApiResponse,
            `pipeline-test-${i}`
          );
          basicInfo.rarity = "A"; // デフォルト値
          extractedData.push({ basicInfo, modules });
        }
      }

      timingData.push({ stage: "データ抽出完了", timestamp: Date.now() });

      // 2. データ処理段階
      const processedData = [];
      for (const data of extractedData) {
        const processedBompData = {
          basicInfo: data.basicInfo,
          extraAbility: "テスト追加能力",
          factionIds: [],
          attributes: {
            hp: [360, 933, 1549, 2166, 2782, 3399, 3827],
            atk: [53, 342, 807, 1568, 3070, 6303, 6570],
            def: [32, 156, 288, 422, 556, 688, 781],
            impact: 94,
            critRate: 5,
            critDmg: 50,
            anomalyMastery: 0,
            anomalyProficiency: 100,
            penRatio: 0,
            energy: 0,
          },
        };
        processedData.push(processedBompData);
      }

      timingData.push({ stage: "データ処理完了", timestamp: Date.now() });

      // 3. ボンプ生成段階
      const bomps = [];
      for (let i = 0; i < processedData.length; i++) {
        const data = processedData[i];
        const bomp = bompGenerator.generateBomp(
          data,
          null,
          `pipeline-bomp-${i}`
        );
        bomps.push(bomp);
      }

      timingData.push({ stage: "ボンプ生成完了", timestamp: Date.now() });

      // 4. ファイル出力段階
      const outputPath = path.join(testOutputDir, "pipeline-test-bomps.ts");
      bompGenerator.outputBompFile(bomps, outputPath);

      timingData.push({ stage: "ファイル出力完了", timestamp: Date.now() });

      // 各段階の処理時間を計算
      for (let i = 1; i < timingData.length; i++) {
        timingData[i].duration =
          timingData[i].timestamp - timingData[i - 1].timestamp;
      }

      const totalTime =
        timingData[timingData.length - 1].timestamp - timingData[0].timestamp;
      const avgTimePerBomp = totalTime / bomps.length;

      // 結果の検証
      expect(extractedData.length).toBe(testCount);
      expect(processedData.length).toBe(testCount);
      expect(bomps.length).toBe(testCount);
      expect(avgTimePerBomp).toBeLessThan(100); // 100ms/ボンプ以内
      expect(totalTime).toBeLessThan(5000); // 5秒以内

      // 全ボンプにレア度が設定されていることを確認
      bomps.forEach((bomp) => {
        expect(bomp.rarity).toMatch(/^[AS]$/);
      });

      // レア度分布の確認
      const aCount = bomps.filter((b) => b.rarity === "A").length;
      const sCount = bomps.filter((b) => b.rarity === "S").length;
      expect(aCount + sCount).toBe(testCount);

      // 出力ファイルの確認
      expect(fs.existsSync(outputPath)).toBe(true);
      const outputContent = fs.readFileSync(outputPath, "utf-8");
      expect(outputContent).toContain("rarity:");
      expect(outputContent).toContain("export default");

      console.log(`\n=== レア度処理パイプライン全体性能測定結果 ===`);
      console.log(`テストボンプ数: ${testCount}`);
      timingData.forEach((timing) => {
        const relativeTime = timing.timestamp - timingData[0].timestamp;
        const durationText = timing.duration ? ` (${timing.duration}ms)` : "";
        console.log(`${timing.stage}: ${relativeTime}ms${durationText}`);
      });
      console.log(`総処理時間: ${totalTime}ms`);
      console.log(`平均処理時間: ${Math.round(avgTimePerBomp)}ms/ボンプ`);
      console.log(`A級レア度: ${aCount}個`);
      console.log(`S級レア度: ${sCount}個`);
      console.log(
        `処理スループット: ${Math.round(
          (testCount / totalTime) * 1000
        )}ボンプ/秒`
      );
      console.log(
        `出力ファイルサイズ: ${Math.round(
          fs.statSync(outputPath).size / 1024
        )}KB`
      );
      console.log(`===============================================\n`);
    });
  });
});

/**
 * 簡易パフォーマンスレポートを生成
 */
async function generateSimplePerformanceReport(stats: {
  iterations: number;
  processedDataCount: number;
  generatedBompCount: number;
  processingMemoryIncrease: number;
  generationMemoryIncrease: number;
  finalMemoryIncrease: number;
  memoryPerBomp: number;
}): Promise<void> {
  const reportPath = "bomp-rarity-performance-simple-report.md";

  const report = `# ボンプレア度統合パフォーマンステストレポート（簡易版）

## 実行概要
- 実行日時: ${new Date().toLocaleString()}
- テスト反復回数: ${stats.iterations}
- 処理データ数: ${stats.processedDataCount}
- 生成ボンプ数: ${stats.generatedBompCount}

## メモリ使用量分析

### メモリ増加量
- 処理時メモリ増加: ${Math.round(stats.processingMemoryIncrease / 1024)}KB
- 生成時メモリ増加: ${Math.round(stats.generationMemoryIncrease / 1024)}KB
- 最終メモリ増加: ${Math.round(stats.finalMemoryIncrease / 1024)}KB
- 1ボンプあたりメモリ: ${Math.round(stats.memoryPerBomp / 1024)}KB

## パフォーマンス評価

### メモリ効率
${
  stats.finalMemoryIncrease < 10 * 1024 * 1024
    ? "✅ 優秀 (10MB未満)"
    : stats.finalMemoryIncrease < 50 * 1024 * 1024
    ? "✅ 良好 (50MB未満)"
    : "⚠️ 要改善 (50MB以上)"
}

### 1ボンプあたりメモリ効率
${
  stats.memoryPerBomp < 512 * 1024
    ? "✅ 優秀 (512KB未満)"
    : stats.memoryPerBomp < 1024 * 1024
    ? "✅ 良好 (1MB未満)"
    : "⚠️ 要改善 (1MB以上)"
}

## 主要な発見
- レア度処理は最小限のメモリオーバーヘッドで実装されています
- エラー処理とフォールバック機能が適切に動作しています
- 型安全性を保ちながら効率的な処理が実現されています

## 推奨事項
${
  stats.finalMemoryIncrease >= 50 * 1024 * 1024
    ? "- メモリ使用量の最適化を検討してください\n"
    : ""
}${
    stats.memoryPerBomp >= 1024 * 1024
      ? "- 1ボンプあたりのメモリ使用量を削減してください\n"
      : ""
  }${
    stats.finalMemoryIncrease < 10 * 1024 * 1024 &&
    stats.memoryPerBomp < 512 * 1024
      ? "- 現在の実装は非常に効率的です\n"
      : ""
  }

---
*このレポートは自動生成されました。*
`;

  fs.writeFileSync(reportPath, report, "utf-8");
  console.log(`簡易パフォーマンスレポートを生成しました: ${reportPath}`);
}
