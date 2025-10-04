import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EnhancedMainPipeline } from "../../src/main-pipeline-enhanced";
import { CharacterListParser } from "../../src/parsers/CharacterListParser";
import * as fs from "fs";
import * as path from "path";

/**
 * パフォーマンステスト: 全38キャラクターでの処理性能検証
 * 実際のScraping.mdファイルを使用した大規模データ処理テスト
 * 要件: 7.1, 7.2, 7.4 - パフォーマンス最適化と統計情報表示
 */
describe("Full Character Set Performance Tests", () => {
  let pipeline: EnhancedMainPipeline;
  let parser: CharacterListParser;

  const testOutputDir = "performance-test-output";
  const testOutputFile = path.join(
    testOutputDir,
    "all-characters-performance.ts"
  );
  const performanceReportFile = "performance-report.md";

  beforeEach(() => {
    pipeline = new EnhancedMainPipeline();
    parser = new CharacterListParser();

    // テスト用ディレクトリを作成
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }

    // テスト用ファイルをクリーンアップ
    [testOutputFile, performanceReportFile].forEach((file) => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  });

  afterEach(() => {
    // テスト後のクリーンアップ
    [
      testOutputFile,
      performanceReportFile,
      "processing-report.md",
      "error-report.md",
    ].forEach((file) => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });

    // テスト用ディレクトリを削除
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  describe("全38キャラクターパフォーマンステスト", () => {
    it("実際のScraping.mdファイルから全キャラクターを処理できる", async () => {
      // 実際のScraping.mdファイルが存在することを確認
      const scrapingFilePath = "Scraping.md";
      if (!fs.existsSync(scrapingFilePath)) {
        console.warn(
          "Scraping.mdファイルが存在しないため、テストをスキップします"
        );
        return;
      }

      // キャラクター数を事前に確認
      const entries = await parser.parseScrapingFile(scrapingFilePath);
      console.log(`検出されたキャラクター数: ${entries.length}`);

      // 最低30キャラクター以上であることを確認
      expect(entries.length).toBeGreaterThanOrEqual(30);

      const startTime = Date.now();
      const initialMemory = process.memoryUsage();

      // 全キャラクター処理を実行
      const result = await pipeline.execute({
        scrapingFilePath: scrapingFilePath,
        outputFilePath: testOutputFile,
        batchSize: 5, // 適度なバッチサイズ
        delayMs: 200, // API制限を考慮した遅延
        maxRetries: 3, // 十分なリトライ回数
        minSuccessRate: 0.8, // 80%以上の成功率を要求
      });

      const endTime = Date.now();
      const finalMemory = process.memoryUsage();
      const executionTime = endTime - startTime;
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // 基本的な成功確認
      expect(result.success).toBe(true);
      expect(result.characters.length).toBeGreaterThanOrEqual(
        Math.floor(entries.length * 0.8)
      );

      // パフォーマンス指標の検証
      const avgTimePerCharacter = executionTime / result.characters.length;
      const successRate =
        (result.processingResult.statistics.successful /
          result.processingResult.statistics.total) *
        100;

      // パフォーマンス要件の検証
      expect(executionTime).toBeLessThan(300000); // 5分以内
      expect(avgTimePerCharacter).toBeLessThan(10000); // 1キャラクターあたり10秒以内
      expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024); // 500MB以内のメモリ増加
      expect(successRate).toBeGreaterThanOrEqual(80); // 80%以上の成功率

      // 出力ファイルの検証
      expect(fs.existsSync(testOutputFile)).toBe(true);
      const outputContent = fs.readFileSync(testOutputFile, "utf-8");
      expect(outputContent).toContain("export default [");
      expect(outputContent).toContain("] as Character[];");

      // パフォーマンスレポートを生成
      await generatePerformanceReport({
        totalCharacters: entries.length,
        processedCharacters: result.characters.length,
        successfulCharacters: result.processingResult.statistics.successful,
        failedCharacters: result.processingResult.statistics.failed,
        executionTime,
        avgTimePerCharacter,
        memoryIncrease,
        successRate,
        batchSize: 5,
        delayMs: 200,
        maxRetries: 3,
      });

      // 詳細な統計情報をコンソールに出力
      console.log(`\n=== 全キャラクターパフォーマンステスト結果 ===`);
      console.log(`総キャラクター数: ${entries.length}`);
      console.log(`処理成功: ${result.processingResult.statistics.successful}`);
      console.log(`処理失敗: ${result.processingResult.statistics.failed}`);
      console.log(`成功率: ${Math.round(successRate)}%`);
      console.log(`総実行時間: ${Math.round(executionTime / 1000)}秒`);
      console.log(
        `1キャラクターあたり平均時間: ${Math.round(
          avgTimePerCharacter / 1000
        )}秒`
      );
      console.log(`メモリ増加: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
      console.log(
        `出力ファイルサイズ: ${Math.round(
          fs.statSync(testOutputFile).size / 1024
        )}KB`
      );
      console.log(`===============================================\n`);

      // 失敗したキャラクターがある場合は詳細を表示
      if (result.processingResult.failed.length > 0) {
        console.log(`失敗したキャラクター:`);
        result.processingResult.failed.forEach((f) => {
          console.log(`  - ${f.entry.id}: ${f.error}`);
        });
      }
    }, 600000); // 10分のタイムアウト

    it("異なるバッチサイズでの性能比較", async () => {
      const scrapingFilePath = "Scraping.md";
      if (!fs.existsSync(scrapingFilePath)) {
        console.warn(
          "Scraping.mdファイルが存在しないため、テストをスキップします"
        );
        return;
      }

      // 小規模テスト用に最初の10キャラクターのみを使用
      const entries = await parser.parseScrapingFile(scrapingFilePath);
      const testEntries = entries.slice(0, 10);

      // テスト用Scraping.mdファイルを作成
      const testScrapingContent = `# ZZZ Characters

## Characters List

${testEntries
  .map((entry) => `- [${entry.id}](${entry.wikiUrl}) - pageId: ${entry.pageId}`)
  .join("\n")}
`;
      const testScrapingFile = "test-scraping-batch.md";
      fs.writeFileSync(testScrapingFile, testScrapingContent, "utf-8");

      const batchSizes = [1, 2, 5];
      const results: Array<{
        batchSize: number;
        executionTime: number;
        successRate: number;
        avgTimePerCharacter: number;
      }> = [];

      for (const batchSize of batchSizes) {
        console.log(`バッチサイズ ${batchSize} でテスト実行中...`);

        const startTime = Date.now();
        const result = await pipeline.execute({
          scrapingFilePath: testScrapingFile,
          outputFilePath: testOutputFile.replace(
            ".ts",
            `-batch${batchSize}.ts`
          ),
          batchSize,
          delayMs: 100,
          maxRetries: 2,
          minSuccessRate: 0.7,
        });
        const endTime = Date.now();

        const executionTime = endTime - startTime;
        const successRate =
          (result.processingResult.statistics.successful /
            result.processingResult.statistics.total) *
          100;
        const avgTimePerCharacter = executionTime / result.characters.length;

        results.push({
          batchSize,
          executionTime,
          successRate,
          avgTimePerCharacter,
        });

        expect(result.success).toBe(true);
        expect(result.characters.length).toBeGreaterThanOrEqual(7); // 最低70%成功
      }

      // 結果の比較と検証
      console.log(`\n=== バッチサイズ性能比較 ===`);
      results.forEach((r) => {
        console.log(
          `バッチサイズ ${r.batchSize}: ${Math.round(
            r.executionTime / 1000
          )}秒, 成功率 ${Math.round(r.successRate)}%, 平均 ${Math.round(
            r.avgTimePerCharacter / 1000
          )}秒/キャラクター`
        );
      });

      // バッチサイズが大きいほど効率的であることを確認
      const batch1Time =
        results.find((r) => r.batchSize === 1)?.executionTime || 0;
      const batch5Time =
        results.find((r) => r.batchSize === 5)?.executionTime || 0;

      if (batch1Time > 0 && batch5Time > 0) {
        expect(batch5Time).toBeLessThan(batch1Time * 0.8); // バッチ処理で20%以上の改善
      }

      // クリーンアップ
      [
        testScrapingFile,
        ...batchSizes.map((b) =>
          testOutputFile.replace(".ts", `-batch${b}.ts`)
        ),
      ].forEach((file) => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });
    }, 300000); // 5分のタイムアウト

    it("メモリ効率性とガベージコレクション", async () => {
      const scrapingFilePath = "Scraping.md";
      if (!fs.existsSync(scrapingFilePath)) {
        console.warn(
          "Scraping.mdファイルが存在しないため、テストをスキップします"
        );
        return;
      }

      // 最初の20キャラクターでテスト
      const entries = await parser.parseScrapingFile(scrapingFilePath);
      const testEntries = entries.slice(0, 20);

      const testScrapingContent = `# ZZZ Characters

## Characters List

${testEntries
  .map((entry) => `- [${entry.id}](${entry.wikiUrl}) - pageId: ${entry.pageId}`)
  .join("\n")}
`;
      const testScrapingFile = "test-scraping-memory.md";
      fs.writeFileSync(testScrapingFile, testScrapingContent, "utf-8");

      const memorySnapshots: Array<{
        stage: string;
        heapUsed: number;
        heapTotal: number;
        external: number;
      }> = [];

      // 初期メモリ状態
      global.gc && global.gc(); // ガベージコレクションを強制実行（可能な場合）
      memorySnapshots.push({
        stage: "初期状態",
        ...process.memoryUsage(),
      });

      // パイプライン実行
      const result = await pipeline.execute({
        scrapingFilePath: testScrapingFile,
        outputFilePath: testOutputFile,
        batchSize: 4,
        delayMs: 100,
        maxRetries: 2,
        minSuccessRate: 0.7,
      });

      // 処理後メモリ状態
      memorySnapshots.push({
        stage: "処理完了後",
        ...process.memoryUsage(),
      });

      // ガベージコレクション後
      global.gc && global.gc();
      await new Promise((resolve) => setTimeout(resolve, 1000)); // GC完了を待機
      memorySnapshots.push({
        stage: "GC後",
        ...process.memoryUsage(),
      });

      // 結果検証
      expect(result.success).toBe(true);
      expect(result.characters.length).toBeGreaterThanOrEqual(14); // 最低70%成功

      // メモリ使用量の分析
      const initialMemory = memorySnapshots[0].heapUsed;
      const peakMemory = memorySnapshots[1].heapUsed;
      const finalMemory = memorySnapshots[2].heapUsed;

      const peakIncrease = peakMemory - initialMemory;
      const finalIncrease = finalMemory - initialMemory;
      const memoryRecovered = peakMemory - finalMemory;

      console.log(`\n=== メモリ効率性テスト結果 ===`);
      memorySnapshots.forEach((snapshot) => {
        console.log(
          `${snapshot.stage}: Heap ${Math.round(
            snapshot.heapUsed / 1024 / 1024
          )}MB, Total ${Math.round(snapshot.heapTotal / 1024 / 1024)}MB`
        );
      });
      console.log(`ピーク時増加: ${Math.round(peakIncrease / 1024 / 1024)}MB`);
      console.log(`最終増加: ${Math.round(finalIncrease / 1024 / 1024)}MB`);
      console.log(
        `回収されたメモリ: ${Math.round(memoryRecovered / 1024 / 1024)}MB`
      );

      // メモリ効率性の検証
      expect(peakIncrease).toBeLessThan(200 * 1024 * 1024); // ピーク時200MB以内
      expect(finalIncrease).toBeLessThan(100 * 1024 * 1024); // 最終100MB以内
      expect(memoryRecovered).toBeGreaterThan(peakIncrease * 0.3); // 30%以上のメモリ回収

      // クリーンアップ
      if (fs.existsSync(testScrapingFile)) {
        fs.unlinkSync(testScrapingFile);
      }
    }, 300000); // 5分のタイムアウト

    it("エラー回復性能とレジリエンス", async () => {
      // 一部無効なエントリーを含むテストデータを作成
      const testScrapingContent = `# ZZZ Characters

## Characters List

- [anby](https://wiki.hoyolab.com/pc/zzz/entry/2) - pageId: 2
- [billy](https://wiki.hoyolab.com/pc/zzz/entry/19) - pageId: 19
- [invalid1](https://wiki.hoyolab.com/pc/zzz/entry/9999) - pageId: 9999
- [nicole](https://wiki.hoyolab.com/pc/zzz/entry/20) - pageId: 20
- [invalid2](https://wiki.hoyolab.com/pc/zzz/entry/9998) - pageId: 9998
- [corin](https://wiki.hoyolab.com/pc/zzz/entry/21) - pageId: 21
- [invalid3](https://wiki.hoyolab.com/pc/zzz/entry/9997) - pageId: 9997
- [nekomata](https://wiki.hoyolab.com/pc/zzz/entry/22) - pageId: 22
`;
      const testScrapingFile = "test-scraping-error.md";
      fs.writeFileSync(testScrapingFile, testScrapingContent, "utf-8");

      const startTime = Date.now();

      // エラー耐性テストを実行
      const result = await pipeline.execute({
        scrapingFilePath: testScrapingFile,
        outputFilePath: testOutputFile,
        batchSize: 3,
        delayMs: 100,
        maxRetries: 2,
        minSuccessRate: 0.5, // 50%成功率で継続
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // 結果検証
      expect(result.success).toBe(true);
      expect(result.characters.length).toBeGreaterThanOrEqual(4); // 有効な5キャラクターのうち最低4つ成功
      expect(result.processingResult.statistics.failed).toBeGreaterThan(0); // 失敗があることを確認

      // エラー処理性能の確認
      const avgTimePerCharacter =
        executionTime / result.processingResult.statistics.total;
      expect(avgTimePerCharacter).toBeLessThan(15000); // エラー処理込みで15秒/キャラクター以内

      // 部分的結果ファイルの確認
      const partialFile = testOutputFile.replace(".ts", "-partial.ts");
      if (fs.existsSync(partialFile)) {
        const partialContent = fs.readFileSync(partialFile, "utf-8");
        expect(partialContent).toContain("export default [");
      }

      console.log(`\n=== エラー回復性能テスト結果 ===`);
      console.log(
        `総キャラクター数: ${result.processingResult.statistics.total}`
      );
      console.log(`成功: ${result.processingResult.statistics.successful}`);
      console.log(`失敗: ${result.processingResult.statistics.failed}`);
      console.log(`実行時間: ${Math.round(executionTime / 1000)}秒`);
      console.log(
        `平均処理時間: ${Math.round(avgTimePerCharacter / 1000)}秒/キャラクター`
      );

      // クリーンアップ
      [testScrapingFile, partialFile].forEach((file) => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });
    }, 180000); // 3分のタイムアウト
  });

  describe("スケーラビリティテスト", () => {
    it("段階的負荷増加テスト", async () => {
      const scrapingFilePath = "Scraping.md";
      if (!fs.existsSync(scrapingFilePath)) {
        console.warn(
          "Scraping.mdファイルが存在しないため、テストをスキップします"
        );
        return;
      }

      const entries = await parser.parseScrapingFile(scrapingFilePath);
      const testSizes = [5, 10, 15, 20]; // 段階的にサイズを増加
      const results: Array<{
        size: number;
        executionTime: number;
        avgTimePerCharacter: number;
        successRate: number;
      }> = [];

      for (const size of testSizes) {
        if (size > entries.length) continue;

        console.log(`${size}キャラクターでスケーラビリティテスト実行中...`);

        const testEntries = entries.slice(0, size);
        const testScrapingContent = `# ZZZ Characters

## Characters List

${testEntries
  .map((entry) => `- [${entry.id}](${entry.wikiUrl}) - pageId: ${entry.pageId}`)
  .join("\n")}
`;
        const testScrapingFile = `test-scraping-scale-${size}.md`;
        fs.writeFileSync(testScrapingFile, testScrapingContent, "utf-8");

        const startTime = Date.now();
        const result = await pipeline.execute({
          scrapingFilePath: testScrapingFile,
          outputFilePath: testOutputFile.replace(".ts", `-scale${size}.ts`),
          batchSize: Math.min(5, size),
          delayMs: 100,
          maxRetries: 2,
          minSuccessRate: 0.7,
        });
        const endTime = Date.now();

        const executionTime = endTime - startTime;
        const avgTimePerCharacter = executionTime / result.characters.length;
        const successRate =
          (result.processingResult.statistics.successful /
            result.processingResult.statistics.total) *
          100;

        results.push({
          size,
          executionTime,
          avgTimePerCharacter,
          successRate,
        });

        expect(result.success).toBe(true);
        expect(result.characters.length).toBeGreaterThanOrEqual(
          Math.floor(size * 0.7)
        );

        // クリーンアップ
        [
          testScrapingFile,
          testOutputFile.replace(".ts", `-scale${size}.ts`),
        ].forEach((file) => {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
        });
      }

      // スケーラビリティ分析
      console.log(`\n=== スケーラビリティテスト結果 ===`);
      results.forEach((r) => {
        console.log(
          `${r.size}キャラクター: ${Math.round(
            r.executionTime / 1000
          )}秒, 平均 ${Math.round(
            r.avgTimePerCharacter / 1000
          )}秒/キャラクター, 成功率 ${Math.round(r.successRate)}%`
        );
      });

      // 線形スケーラビリティの確認（1キャラクターあたりの時間が大幅に増加しないこと）
      if (results.length >= 2) {
        const firstResult = results[0];
        const lastResult = results[results.length - 1];
        const timeIncreaseRatio =
          lastResult.avgTimePerCharacter / firstResult.avgTimePerCharacter;

        expect(timeIncreaseRatio).toBeLessThan(2.0); // 2倍以内の増加
        console.log(
          `スケーラビリティ比率: ${Math.round(timeIncreaseRatio * 100)}%`
        );
      }
    }, 600000); // 10分のタイムアウト
  });
});

/**
 * パフォーマンスレポートを生成
 * @param stats パフォーマンス統計情報
 */
async function generatePerformanceReport(stats: {
  totalCharacters: number;
  processedCharacters: number;
  successfulCharacters: number;
  failedCharacters: number;
  executionTime: number;
  avgTimePerCharacter: number;
  memoryIncrease: number;
  successRate: number;
  batchSize: number;
  delayMs: number;
  maxRetries: number;
}): Promise<void> {
  const reportPath = "performance-report.md";

  const report = `# 全キャラクターパフォーマンステストレポート

## 実行概要
- 実行日時: ${new Date().toLocaleString()}
- 総キャラクター数: ${stats.totalCharacters}
- 処理されたキャラクター数: ${stats.processedCharacters}
- 成功: ${stats.successfulCharacters}
- 失敗: ${stats.failedCharacters}
- 成功率: ${Math.round(stats.successRate)}%

## パフォーマンス指標
- 総実行時間: ${Math.round(stats.executionTime / 1000)}秒 (${Math.round(
    stats.executionTime / 60000
  )}分)
- 1キャラクターあたり平均時間: ${Math.round(stats.avgTimePerCharacter / 1000)}秒
- メモリ増加: ${Math.round(stats.memoryIncrease / 1024 / 1024)}MB
- スループット: ${Math.round(
    (stats.processedCharacters / stats.executionTime) * 1000 * 60
  )}キャラクター/分

## 設定パラメータ
- バッチサイズ: ${stats.batchSize}
- API遅延: ${stats.delayMs}ms
- 最大リトライ回数: ${stats.maxRetries}

## パフォーマンス評価
- 実行時間: ${
    stats.executionTime < 300000 ? "✅ 良好 (5分以内)" : "⚠️ 要改善 (5分超過)"
  }
- 1キャラクター処理時間: ${
    stats.avgTimePerCharacter < 10000
      ? "✅ 良好 (10秒以内)"
      : "⚠️ 要改善 (10秒超過)"
  }
- メモリ効率: ${
    stats.memoryIncrease < 500 * 1024 * 1024
      ? "✅ 良好 (500MB以内)"
      : "⚠️ 要改善 (500MB超過)"
  }
- 成功率: ${
    stats.successRate >= 80 ? "✅ 良好 (80%以上)" : "⚠️ 要改善 (80%未満)"
  }

## 推奨事項
${
  stats.avgTimePerCharacter > 10000
    ? "- 1キャラクターあたりの処理時間を短縮する必要があります\n"
    : ""
}${
    stats.memoryIncrease > 500 * 1024 * 1024
      ? "- メモリ使用量の最適化が必要です\n"
      : ""
  }${stats.successRate < 80 ? "- API呼び出しの安定性向上が必要です\n" : ""}${
    stats.executionTime > 300000 ? "- 全体的な処理速度の向上が必要です\n" : ""
  }
`;

  fs.writeFileSync(reportPath, report, "utf-8");
  console.log(`パフォーマンスレポートを生成しました: ${reportPath}`);
}
