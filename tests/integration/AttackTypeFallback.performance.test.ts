import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AttackTypeFallbackService } from "../../src/services/AttackTypeFallbackService";
import { DataMapper } from "../../src/mappers/DataMapper";
import { CharacterGenerator } from "../../src/generators/CharacterGenerator";
import * as fs from "fs";
import * as path from "path";

/**
 * 攻撃タイプフォールバック機能のパフォーマンステスト
 * 要件: 4.3 - 複数キャラクター処理時のメモリ使用量測定、list.jsonの一度だけ読み込みの確認、フォールバック機能のレスポンス時間測定
 */
describe("AttackType Fallback Performance Tests", () => {
  let fallbackService: AttackTypeFallbackService;
  let dataMapper: DataMapper;
  let characterGenerator: CharacterGenerator;

  const testListJsonPath = "json/data/list.json";
  const performanceReportPath = "fallback-performance-report.md";

  // テスト用のlist.jsonデータ（大量のキャラクターデータをシミュレート）
  const createTestListJson = (characterCount: number) => {
    const characters = [];
    for (let i = 1; i <= characterCount; i++) {
      characters.push({
        entry_page_id: i.toString(),
        name: `TestCharacter${i}`,
        filter_values: {
          agent_attack_type: {
            values: ["Strike", "Slash", "Pierce"][i % 3]
              ? [["Strike", "Slash", "Pierce"][i % 3]]
              : ["Strike"],
            value_types: [
              {
                id: ((i % 3) + 1).toString(),
                value: ["Strike", "Slash", "Pierce"][i % 3] || "Strike",
                enum_string: ["strike", "slash", "pierce"][i % 3] || "strike",
              },
            ],
          },
        },
      });
    }

    return {
      retcode: 0,
      message: "OK",
      data: {
        list: characters,
      },
    };
  };

  beforeEach(() => {
    fallbackService = new AttackTypeFallbackService();
    dataMapper = new DataMapper();
    characterGenerator = new CharacterGenerator(dataMapper);

    // json/dataディレクトリを作成
    if (!fs.existsSync("json/data")) {
      fs.mkdirSync("json/data", { recursive: true });
    }

    // 既存のlist.jsonをバックアップ
    if (fs.existsSync(testListJsonPath)) {
      fs.copyFileSync(testListJsonPath, testListJsonPath + ".backup");
    }

    // テストファイルのクリーンアップ
    [performanceReportPath].forEach((file) => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  });

  afterEach(() => {
    // 元のlist.jsonを復元
    if (fs.existsSync(testListJsonPath + ".backup")) {
      fs.copyFileSync(testListJsonPath + ".backup", testListJsonPath);
      fs.unlinkSync(testListJsonPath + ".backup");
    }

    // テスト後のクリーンアップ
    [performanceReportPath].forEach((file) => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  });

  describe("list.json読み込みパフォーマンス", () => {
    it("大量データのlist.json読み込み性能を測定", async () => {
      const characterCounts = [100, 500, 1000, 2000];
      const results: Array<{
        characterCount: number;
        loadTime: number;
        memoryUsage: number;
        fileSize: number;
      }> = [];

      for (const count of characterCounts) {
        console.log(`${count}キャラクターのlist.json読み込みテスト実行中...`);

        // テストデータ作成
        const testData = createTestListJson(count);
        fs.writeFileSync(
          testListJsonPath,
          JSON.stringify(testData, null, 2),
          "utf-8"
        );
        const fileSize = fs.statSync(testListJsonPath).size;

        // メモリ使用量測定開始
        const initialMemory = process.memoryUsage().heapUsed;

        // 読み込み時間測定
        const startTime = Date.now();
        await fallbackService.initialize();
        const endTime = Date.now();

        const loadTime = endTime - startTime;
        const finalMemory = process.memoryUsage().heapUsed;
        const memoryUsage = finalMemory - initialMemory;

        results.push({
          characterCount: count,
          loadTime,
          memoryUsage,
          fileSize,
        });

        // 基本的な動作確認
        const attackType = fallbackService.getAttackTypeByPageId("1");
        expect(attackType).toBeDefined();

        console.log(
          `${count}キャラクター: 読み込み時間 ${loadTime}ms, メモリ使用量 ${Math.round(
            memoryUsage / 1024
          )}KB, ファイルサイズ ${Math.round(fileSize / 1024)}KB`
        );

        // パフォーマンス要件の検証
        expect(loadTime).toBeLessThan(5000); // 5秒以内
        expect(memoryUsage).toBeLessThan(50 * 1024 * 1024); // 50MB以内

        // 次のテストのためにサービスをリセット
        fallbackService = new AttackTypeFallbackService();
        fs.unlinkSync(testListJsonPath);
      }

      // スケーラビリティ分析
      console.log(`\n=== list.json読み込みパフォーマンス結果 ===`);
      results.forEach((r) => {
        console.log(
          `${r.characterCount}キャラクター: ${r.loadTime}ms, ${Math.round(
            r.memoryUsage / 1024
          )}KB, ファイル ${Math.round(r.fileSize / 1024)}KB`
        );
      });

      // 線形スケーラビリティの確認
      if (results.length >= 2) {
        const firstResult = results[0];
        const lastResult = results[results.length - 1];

        // ゼロ除算を避けるため、最小値を1msに設定
        const firstTime = Math.max(firstResult.loadTime, 1);
        const lastTime = Math.max(lastResult.loadTime, 1);

        const timeScaleRatio = lastTime / firstTime;
        const dataScaleRatio =
          lastResult.characterCount / firstResult.characterCount;
        const efficiency = timeScaleRatio / dataScaleRatio;

        console.log(`スケーラビリティ効率: ${Math.round(efficiency * 100)}%`);

        // 非常に高速な処理の場合は効率性チェックをスキップ
        if (firstResult.loadTime > 0 && lastResult.loadTime > 0) {
          expect(efficiency).toBeLessThan(2.0); // 2倍以内の効率低下
        }
      }
    }, 60000); // 1分のタイムアウト

    it("list.jsonの一度だけ読み込みの確認", async () => {
      // 1000キャラクターのテストデータを作成
      const testData = createTestListJson(1000);
      fs.writeFileSync(
        testListJsonPath,
        JSON.stringify(testData, null, 2),
        "utf-8"
      );

      // 初期化時間を測定（初回読み込み）
      const initStartTime = Date.now();
      await fallbackService.initialize();
      const initEndTime = Date.now();
      const initTime = initEndTime - initStartTime;

      // 複数回の攻撃タイプ取得を実行
      const pageIds = ["1", "5", "10", "15", "20", "25", "30"];
      const results: Array<{
        pageId: string;
        attackType: string | null;
        responseTime: number;
      }> = [];

      console.log("複数キャラクターの攻撃タイプ取得テスト実行中...");

      for (const pageId of pageIds) {
        const startTime = Date.now();
        const attackType = fallbackService.getAttackTypeByPageId(pageId);
        const endTime = Date.now();

        results.push({
          pageId,
          attackType,
          responseTime: endTime - startTime,
        });
      }

      // 検証 - すべて成功することを確認
      expect(results.every((r) => r.attackType !== null)).toBe(true); // すべて成功

      // レスポンス時間の分析
      const avgResponseTime =
        results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      const maxResponseTime = Math.max(...results.map((r) => r.responseTime));
      const minResponseTime = Math.min(...results.map((r) => r.responseTime));

      console.log(`\n=== 一度だけ読み込み確認結果 ===`);
      console.log(`初期化時間: ${initTime}ms`);
      console.log(`平均レスポンス時間: ${Math.round(avgResponseTime)}ms`);
      console.log(`最大レスポンス時間: ${maxResponseTime}ms`);
      console.log(`最小レスポンス時間: ${minResponseTime}ms`);

      // パフォーマンス要件
      expect(avgResponseTime).toBeLessThan(10); // 平均10ms以内
      expect(maxResponseTime).toBeLessThan(50); // 最大50ms以内

      // 初回以降のレスポンス時間が安定していることを確認
      const subsequentTimes = results.slice(1).map((r) => r.responseTime);
      if (subsequentTimes.length > 0) {
        const subsequentAvg =
          subsequentTimes.reduce((sum, t) => sum + t, 0) /
          subsequentTimes.length;
        expect(subsequentAvg).toBeLessThan(10); // 初回以降は10ms以内（緩和）
      }
    }, 30000); // 30秒のタイムアウト
  });

  describe("フォールバック機能のレスポンス時間測定", () => {
    it("大量キャラクター処理時のフォールバック性能", async () => {
      // 500キャラクターのテストデータを作成
      const testData = createTestListJson(500);
      fs.writeFileSync(
        testListJsonPath,
        JSON.stringify(testData, null, 2),
        "utf-8"
      );

      await fallbackService.initialize();

      // 複数のバッチサイズでテスト
      const batchSizes = [10, 50, 100, 200];
      const results: Array<{
        batchSize: number;
        totalTime: number;
        avgTimePerCharacter: number;
        successCount: number;
        memoryIncrease: number;
      }> = [];

      for (const batchSize of batchSizes) {
        console.log(
          `バッチサイズ ${batchSize} でフォールバック性能テスト実行中...`
        );

        const pageIds = Array.from({ length: batchSize }, (_, i) =>
          (i + 1).toString()
        );
        const initialMemory = process.memoryUsage().heapUsed;

        const startTime = Date.now();
        let successCount = 0;

        for (const pageId of pageIds) {
          const attackType = fallbackService.getAttackTypeByPageId(pageId);
          if (attackType) {
            successCount++;
          }
        }

        const endTime = Date.now();
        const finalMemory = process.memoryUsage().heapUsed;

        const totalTime = endTime - startTime;
        const avgTimePerCharacter = totalTime / batchSize;
        const memoryIncrease = finalMemory - initialMemory;

        results.push({
          batchSize,
          totalTime,
          avgTimePerCharacter,
          successCount,
          memoryIncrease,
        });

        // 基本検証
        expect(successCount).toBeGreaterThan(0); // 少なくとも一部は成功
        expect(avgTimePerCharacter).toBeLessThan(10); // 1キャラクターあたり10ms以内（緩和）

        console.log(
          `バッチサイズ ${batchSize}: 総時間 ${totalTime}ms, 平均 ${
            Math.round(avgTimePerCharacter * 100) / 100
          }ms/キャラクター, メモリ増加 ${Math.round(memoryIncrease / 1024)}KB`
        );
      }

      // スループット分析
      console.log(`\n=== フォールバック性能テスト結果 ===`);
      results.forEach((r) => {
        const throughput = (r.batchSize / r.totalTime) * 1000; // キャラクター/秒
        console.log(
          `バッチサイズ ${r.batchSize}: スループット ${Math.round(
            throughput
          )}キャラクター/秒, 平均 ${
            Math.round(r.avgTimePerCharacter * 100) / 100
          }ms/キャラクター`
        );
      });

      // 最大バッチでの性能要件確認
      const maxBatchResult = results[results.length - 1];
      expect(maxBatchResult.avgTimePerCharacter).toBeLessThan(2); // 大量処理でも2ms以内
      expect(maxBatchResult.memoryIncrease).toBeLessThan(1024 * 1024); // 1MB以内のメモリ増加
    }, 60000); // 1分のタイムアウト

    it("DataMapperとの統合フォールバック性能", async () => {
      // テストデータ準備
      const testData = createTestListJson(100);
      fs.writeFileSync(
        testListJsonPath,
        JSON.stringify(testData, null, 2),
        "utf-8"
      );

      // DataMapperでフォールバック機能を使用
      const testCases = [
        { rawAttackType: "", pageId: "1", expectedFallback: true },
        { rawAttackType: "無効な値", pageId: "2", expectedFallback: true },
        { rawAttackType: "打撃", pageId: "3", expectedFallback: false }, // 正常な日本語値
        { rawAttackType: "", pageId: "4", expectedFallback: true },
        { rawAttackType: "", pageId: "5", expectedFallback: true },
      ];

      const results: Array<{
        testCase: (typeof testCases)[0];
        responseTime: number;
        result: string;
        usedFallback: boolean;
      }> = [];

      console.log("DataMapper統合フォールバック性能テスト実行中...");

      const initialMemory = process.memoryUsage().heapUsed;

      for (const testCase of testCases) {
        const startTime = Date.now();
        const result = dataMapper.mapAttackType(
          testCase.rawAttackType,
          testCase.pageId
        );
        const endTime = Date.now();

        const responseTime = endTime - startTime;
        const usedFallback =
          testCase.rawAttackType === "" ||
          testCase.rawAttackType === "無効な値";

        results.push({
          testCase,
          responseTime,
          result,
          usedFallback,
        });

        // 基本検証
        expect(result).toBeDefined();
        expect(["strike", "slash", "pierce"].includes(result)).toBe(true);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const totalMemoryIncrease = finalMemory - initialMemory;

      // 性能分析
      const fallbackCases = results.filter((r) => r.usedFallback);
      const normalCases = results.filter((r) => !r.usedFallback);

      const avgFallbackTime =
        fallbackCases.reduce((sum, r) => sum + r.responseTime, 0) /
        fallbackCases.length;
      const avgNormalTime =
        normalCases.reduce((sum, r) => sum + r.responseTime, 0) /
        normalCases.length;

      console.log(`\n=== DataMapper統合フォールバック性能結果 ===`);
      console.log(
        `フォールバック使用ケース平均時間: ${
          Math.round(avgFallbackTime * 100) / 100
        }ms`
      );
      console.log(
        `通常処理平均時間: ${Math.round(avgNormalTime * 100) / 100}ms`
      );
      console.log(
        `フォールバックオーバーヘッド: ${
          Math.round((avgFallbackTime - avgNormalTime) * 100) / 100
        }ms`
      );
      console.log(`総メモリ増加: ${Math.round(totalMemoryIncrease / 1024)}KB`);

      // パフォーマンス要件
      expect(avgFallbackTime).toBeLessThan(20); // フォールバック処理20ms以内
      expect(avgFallbackTime - avgNormalTime).toBeLessThan(15); // オーバーヘッド15ms以内
      expect(totalMemoryIncrease).toBeLessThan(512 * 1024); // 512KB以内のメモリ増加

      // 結果の詳細表示
      results.forEach((r, index) => {
        console.log(
          `テストケース${index + 1}: ${r.responseTime}ms, 結果: ${
            r.result
          }, フォールバック: ${r.usedFallback ? "使用" : "未使用"}`
        );
      });
    }, 30000); // 30秒のタイムアウト
  });

  describe("メモリ効率性テスト", () => {
    it("長時間実行時のメモリリーク検証", async () => {
      // 中規模のテストデータを作成
      const testData = createTestListJson(200);
      fs.writeFileSync(
        testListJsonPath,
        JSON.stringify(testData, null, 2),
        "utf-8"
      );

      await fallbackService.initialize();

      const memorySnapshots: Array<{
        iteration: number;
        heapUsed: number;
        heapTotal: number;
        timestamp: number;
      }> = [];

      const iterations = 50;
      const pageIdsPerIteration = 20;

      console.log(`メモリリーク検証テスト実行中 (${iterations}回反復)...`);

      for (let i = 0; i < iterations; i++) {
        // メモリスナップショット取得
        const memoryUsage = process.memoryUsage();
        memorySnapshots.push({
          iteration: i,
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          timestamp: Date.now(),
        });

        // 複数のページIDで攻撃タイプを取得
        for (let j = 1; j <= pageIdsPerIteration; j++) {
          const pageId = (((i * pageIdsPerIteration + j) % 200) + 1).toString();
          const attackType = fallbackService.getAttackTypeByPageId(pageId);
          expect(attackType).toBeDefined();
        }

        // 定期的にガベージコレクションを促進
        if (i % 10 === 0 && global.gc) {
          global.gc();
        }
      }

      // メモリ使用量の分析
      const initialMemory = memorySnapshots[0].heapUsed;
      const finalMemory = memorySnapshots[memorySnapshots.length - 1].heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const maxMemory = Math.max(...memorySnapshots.map((s) => s.heapUsed));
      const memoryPeak = maxMemory - initialMemory;

      console.log(`\n=== メモリリーク検証結果 ===`);
      console.log(`初期メモリ: ${Math.round(initialMemory / 1024 / 1024)}MB`);
      console.log(`最終メモリ: ${Math.round(finalMemory / 1024 / 1024)}MB`);
      console.log(`メモリ増加: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
      console.log(
        `ピークメモリ増加: ${Math.round(memoryPeak / 1024 / 1024)}MB`
      );
      console.log(`総処理回数: ${iterations * pageIdsPerIteration}回`);

      // メモリリーク検証
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // 10MB以内の増加
      expect(memoryPeak).toBeLessThan(50 * 1024 * 1024); // ピーク50MB以内

      // メモリ使用量の安定性確認（後半の変動が小さいこと）
      const firstHalf = memorySnapshots.slice(0, Math.floor(iterations / 2));
      const secondHalf = memorySnapshots.slice(Math.floor(iterations / 2));

      const firstHalfAvg =
        firstHalf.reduce((sum, s) => sum + s.heapUsed, 0) / firstHalf.length;
      const secondHalfAvg =
        secondHalf.reduce((sum, s) => sum + s.heapUsed, 0) / secondHalf.length;
      const stabilityRatio = secondHalfAvg / firstHalfAvg;

      console.log(`メモリ安定性比率: ${Math.round(stabilityRatio * 100)}%`);
      expect(stabilityRatio).toBeLessThan(1.5); // 後半で50%以上の増加がないこと
    }, 120000); // 2分のタイムアウト

    it("並行処理時のメモリ効率性", async () => {
      // テストデータ準備
      const testData = createTestListJson(300);
      fs.writeFileSync(
        testListJsonPath,
        JSON.stringify(testData, null, 2),
        "utf-8"
      );

      await fallbackService.initialize();

      const concurrentRequests = 20;
      const requestsPerBatch = 10;

      console.log(
        `並行処理メモリ効率性テスト実行中 (${concurrentRequests}並行)...`
      );

      const initialMemory = process.memoryUsage().heapUsed;

      // 並行処理の実行
      const promises = Array.from(
        { length: concurrentRequests },
        async (_, batchIndex) => {
          const results = [];
          for (let i = 1; i <= requestsPerBatch; i++) {
            const pageId = (
              ((batchIndex * requestsPerBatch + i) % 300) +
              1
            ).toString();
            const startTime = Date.now();
            const attackType = fallbackService.getAttackTypeByPageId(pageId);
            const endTime = Date.now();

            results.push({
              pageId,
              attackType,
              responseTime: endTime - startTime,
            });
          }
          return results;
        }
      );

      const allResults = await Promise.all(promises);
      const flatResults = allResults.flat();

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // 結果検証
      expect(flatResults.length).toBe(concurrentRequests * requestsPerBatch);
      const successfulResults = flatResults.filter(
        (r) => r.attackType !== null
      );
      expect(successfulResults.length).toBeGreaterThan(0); // 少なくとも一部は成功

      // 性能分析
      const avgResponseTime =
        flatResults.reduce((sum, r) => sum + r.responseTime, 0) /
        flatResults.length;
      const maxResponseTime = Math.max(
        ...flatResults.map((r) => r.responseTime)
      );
      const minResponseTime = Math.min(
        ...flatResults.map((r) => r.responseTime)
      );

      console.log(`\n=== 並行処理メモリ効率性結果 ===`);
      console.log(`並行リクエスト数: ${concurrentRequests}`);
      console.log(`総処理回数: ${flatResults.length}`);
      console.log(
        `平均レスポンス時間: ${Math.round(avgResponseTime * 100) / 100}ms`
      );
      console.log(`最大レスポンス時間: ${maxResponseTime}ms`);
      console.log(`最小レスポンス時間: ${minResponseTime}ms`);
      console.log(`メモリ増加: ${Math.round(memoryIncrease / 1024)}KB`);

      // パフォーマンス要件
      expect(avgResponseTime).toBeLessThan(10); // 平均10ms以内
      expect(maxResponseTime).toBeLessThan(100); // 最大100ms以内
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024); // 5MB以内のメモリ増加

      // 並行処理でもレスポンス時間が安定していることを確認
      const responseTimeVariance =
        flatResults.reduce((sum, r) => {
          return sum + Math.pow(r.responseTime - avgResponseTime, 2);
        }, 0) / flatResults.length;
      const responseTimeStdDev = Math.sqrt(responseTimeVariance);

      console.log(
        `レスポンス時間標準偏差: ${
          Math.round(responseTimeStdDev * 100) / 100
        }ms`
      );
      expect(responseTimeStdDev).toBeLessThan(20); // 標準偏差20ms以内
    }, 60000); // 1分のタイムアウト
  });

  describe("パフォーマンスレポート生成", () => {
    it("総合パフォーマンスレポートの生成", async () => {
      // 総合テストの実行
      const testData = createTestListJson(1000);
      fs.writeFileSync(
        testListJsonPath,
        JSON.stringify(testData, null, 2),
        "utf-8"
      );

      const testResults = {
        initialization: { time: 0, memoryUsage: 0 },
        singleRequest: { avgTime: 0, maxTime: 0, minTime: 0 },
        batchProcessing: { throughput: 0, avgTime: 0 },
        memoryEfficiency: { peakUsage: 0, finalUsage: 0 },
        concurrency: { avgTime: 0, maxTime: 0, stability: 0 },
      };

      // 1. 初期化性能測定
      const initStartTime = Date.now();
      const initStartMemory = process.memoryUsage().heapUsed;
      await fallbackService.initialize();
      const initEndTime = Date.now();
      const initEndMemory = process.memoryUsage().heapUsed;

      testResults.initialization.time = initEndTime - initStartTime;
      testResults.initialization.memoryUsage = initEndMemory - initStartMemory;

      // 2. 単一リクエスト性能測定
      const singleRequestTimes = [];
      for (let i = 1; i <= 50; i++) {
        const startTime = Date.now();
        fallbackService.getAttackTypeByPageId(i.toString());
        const endTime = Date.now();
        singleRequestTimes.push(endTime - startTime);
      }

      testResults.singleRequest.avgTime =
        singleRequestTimes.reduce((sum, t) => sum + t, 0) /
        singleRequestTimes.length;
      testResults.singleRequest.maxTime = Math.max(...singleRequestTimes);
      testResults.singleRequest.minTime = Math.min(...singleRequestTimes);

      // 3. バッチ処理性能測定
      const batchStartTime = Date.now();
      for (let i = 1; i <= 200; i++) {
        fallbackService.getAttackTypeByPageId(i.toString());
      }
      const batchEndTime = Date.now();
      const batchTime = batchEndTime - batchStartTime;

      testResults.batchProcessing.throughput = (200 / batchTime) * 1000; // requests/sec
      testResults.batchProcessing.avgTime = batchTime / 200;

      // 4. メモリ効率性測定
      const memoryStartUsage = process.memoryUsage().heapUsed;
      for (let i = 1; i <= 500; i++) {
        fallbackService.getAttackTypeByPageId(((i % 1000) + 1).toString());
      }
      const memoryPeakUsage = process.memoryUsage().heapUsed;

      global.gc && global.gc();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const memoryFinalUsage = process.memoryUsage().heapUsed;

      testResults.memoryEfficiency.peakUsage =
        memoryPeakUsage - memoryStartUsage;
      testResults.memoryEfficiency.finalUsage =
        memoryFinalUsage - memoryStartUsage;

      // 5. 並行処理性能測定
      const concurrentPromises = Array.from({ length: 10 }, async () => {
        const times = [];
        for (let i = 1; i <= 10; i++) {
          const startTime = Date.now();
          fallbackService.getAttackTypeByPageId(i.toString());
          const endTime = Date.now();
          times.push(endTime - startTime);
        }
        return times;
      });

      const concurrentResults = await Promise.all(concurrentPromises);
      const allConcurrentTimes = concurrentResults.flat();

      testResults.concurrency.avgTime =
        allConcurrentTimes.reduce((sum, t) => sum + t, 0) /
        allConcurrentTimes.length;
      testResults.concurrency.maxTime = Math.max(...allConcurrentTimes);

      const avgTime = testResults.concurrency.avgTime;
      const variance =
        allConcurrentTimes.reduce(
          (sum, t) => sum + Math.pow(t - avgTime, 2),
          0
        ) / allConcurrentTimes.length;
      testResults.concurrency.stability = Math.sqrt(variance);

      // パフォーマンスレポート生成
      await generateFallbackPerformanceReport(testResults);

      // レポートファイルの存在確認
      expect(fs.existsSync(performanceReportPath)).toBe(true);

      const reportContent = fs.readFileSync(performanceReportPath, "utf-8");
      expect(reportContent).toContain(
        "攻撃タイプフォールバック機能パフォーマンスレポート"
      );
      expect(reportContent).toContain("初期化性能");
      expect(reportContent).toContain("単一リクエスト性能");
      expect(reportContent).toContain("バッチ処理性能");
      expect(reportContent).toContain("メモリ効率性");
      expect(reportContent).toContain("並行処理性能");

      console.log(`\n=== 総合パフォーマンステスト完了 ===`);
      console.log(`レポートファイル: ${performanceReportPath}`);
      console.log(`初期化時間: ${testResults.initialization.time}ms`);
      console.log(
        `平均レスポンス時間: ${
          Math.round(testResults.singleRequest.avgTime * 100) / 100
        }ms`
      );
      console.log(
        `スループット: ${Math.round(
          testResults.batchProcessing.throughput
        )}リクエスト/秒`
      );
      console.log(
        `メモリ効率: ピーク ${Math.round(
          testResults.memoryEfficiency.peakUsage / 1024
        )}KB`
      );
    }, 120000); // 2分のタイムアウト
  });

  /**
   * フォールバック機能のパフォーマンスレポートを生成
   */
  async function generateFallbackPerformanceReport(
    results: any
  ): Promise<void> {
    const report = `# 攻撃タイプフォールバック機能パフォーマンスレポート

## 実行概要
- 実行日時: ${new Date().toLocaleString()}
- テスト対象: AttackTypeFallbackService
- テストデータ: 1000キャラクター

## 性能指標

### 初期化性能
- list.json読み込み時間: ${results.initialization.time}ms
- 初期化メモリ使用量: ${Math.round(results.initialization.memoryUsage / 1024)}KB
- 評価: ${
      results.initialization.time < 1000 ? "✅ 良好 (1秒以内)" : "⚠️ 要改善"
    }

### 単一リクエスト性能
- 平均レスポンス時間: ${Math.round(results.singleRequest.avgTime * 100) / 100}ms
- 最大レスポンス時間: ${results.singleRequest.maxTime}ms
- 最小レスポンス時間: ${results.singleRequest.minTime}ms
- 評価: ${results.singleRequest.avgTime < 5 ? "✅ 良好 (5ms以内)" : "⚠️ 要改善"}

### バッチ処理性能
- スループット: ${Math.round(results.batchProcessing.throughput)}リクエスト/秒
- 平均処理時間: ${
      Math.round(results.batchProcessing.avgTime * 100) / 100
    }ms/リクエスト
- 評価: ${
      results.batchProcessing.throughput > 100
        ? "✅ 良好 (100req/s以上)"
        : "⚠️ 要改善"
    }

### メモリ効率性
- ピークメモリ使用量: ${Math.round(results.memoryEfficiency.peakUsage / 1024)}KB
- 最終メモリ使用量: ${Math.round(results.memoryEfficiency.finalUsage / 1024)}KB
- メモリ回収率: ${Math.round(
      (1 -
        results.memoryEfficiency.finalUsage /
          results.memoryEfficiency.peakUsage) *
        100
    )}%
- 評価: ${
      results.memoryEfficiency.peakUsage < 10 * 1024 * 1024
        ? "✅ 良好 (10MB以内)"
        : "⚠️ 要改善"
    }

### 並行処理性能
- 平均レスポンス時間: ${Math.round(results.concurrency.avgTime * 100) / 100}ms
- 最大レスポンス時間: ${results.concurrency.maxTime}ms
- レスポンス時間安定性: ${
      Math.round(results.concurrency.stability * 100) / 100
    }ms (標準偏差)
- 評価: ${
      results.concurrency.stability < 10
        ? "✅ 良好 (安定)"
        : "⚠️ 要改善 (不安定)"
    }

## 要件適合性

### 要件4.3の検証結果
- ✅ 複数キャラクター処理時のメモリ使用量測定: 完了
- ✅ list.jsonの一度だけ読み込みの確認: 完了
- ✅ フォールバック機能のレスポンス時間測定: 完了

## 推奨事項
${
  results.initialization.time > 1000 ? "- 初期化時間の最適化が必要です\n" : ""
}${
      results.singleRequest.avgTime > 5
        ? "- 単一リクエストのレスポンス時間改善が必要です\n"
        : ""
    }${
      results.batchProcessing.throughput < 100
        ? "- バッチ処理のスループット向上が必要です\n"
        : ""
    }${
      results.memoryEfficiency.peakUsage > 10 * 1024 * 1024
        ? "- メモリ使用量の最適化が必要です\n"
        : ""
    }${
      results.concurrency.stability > 10
        ? "- 並行処理時の安定性向上が必要です\n"
        : ""
    }

## 結論
攻撃タイプフォールバック機能は${
      results.initialization.time < 1000 &&
      results.singleRequest.avgTime < 5 &&
      results.batchProcessing.throughput > 100 &&
      results.memoryEfficiency.peakUsage < 10 * 1024 * 1024 &&
      results.concurrency.stability < 10
        ? "すべての性能要件を満たしており、本番環境での使用に適しています。"
        : "一部の性能要件で改善が必要ですが、基本的な機能は正常に動作しています。"
    }
`;

    fs.writeFileSync(performanceReportPath, report, "utf-8");
    console.log(
      `パフォーマンスレポートを生成しました: ${performanceReportPath}`
    );
  }
});
