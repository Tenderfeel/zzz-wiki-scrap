import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EnhancedMainPipeline } from "../../src/main-pipeline-enhanced";
import { CharacterListParser } from "../../src/parsers/CharacterListParser";
import { BatchProcessor } from "../../src/processors/BatchProcessor";
import { AllCharactersGenerator } from "../../src/generators/AllCharactersGenerator";
import { EnhancedApiClient } from "../../src/clients/EnhancedApiClient";
import { EnhancedDataProcessor } from "../../src/processors/EnhancedDataProcessor";
import * as fs from "fs";
import * as path from "path";

/**
 * 統合テスト: 全キャラクターデータ生成
 * 小規模バッチ、エラーシナリオ、パフォーマンステストを含む包括的な統合検証
 * 要件: 全要件の統合検証
 */
describe("AllCharactersDataGeneration Integration Tests", () => {
  let pipeline: EnhancedMainPipeline;
  let parser: CharacterListParser;
  let generator: AllCharactersGenerator;

  const testOutputDir = "test-output";
  const testScrapingFile = "test-scraping.md";
  const testOutputFile = path.join(testOutputDir, "test-characters.ts");
  const partialOutputFile = path.join(
    testOutputDir,
    "test-characters-partial.ts"
  );

  beforeEach(() => {
    pipeline = new EnhancedMainPipeline();
    parser = new CharacterListParser();
    generator = new AllCharactersGenerator();

    // テスト用ディレクトリを作成
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }

    // テスト用ファイルをクリーンアップ
    [testOutputFile, partialOutputFile, testScrapingFile].forEach((file) => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  });

  afterEach(() => {
    // テスト後のクリーンアップ
    [
      testOutputFile,
      partialOutputFile,
      testScrapingFile,
      "processing-report.md",
      "error-report.md",
      "partial-processing-report.md",
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

  describe("小規模バッチ処理テスト（3-5キャラクター）", () => {
    it("3キャラクターの小規模バッチで完全処理が成功する", async () => {
      // テスト用Scraping.mdファイルを作成（3キャラクター）
      const testScrapingContent = `# ZZZ Characters

## Characters List

- [anby](https://wiki.hoyolab.com/pc/zzz/entry/2) - pageId: 2
- [billy](https://wiki.hoyolab.com/pc/zzz/entry/19) - pageId: 19
- [nicole](https://wiki.hoyolab.com/pc/zzz/entry/20) - pageId: 20
`;
      fs.writeFileSync(testScrapingFile, testScrapingContent, "utf-8");

      // API呼び出しをモック
      const mockApiClient = new EnhancedApiClient();
      vi.spyOn(mockApiClient, "fetchCharacterDataBatch").mockResolvedValue([
        {
          entry: {
            id: "anby",
            pageId: 2,
            wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/2",
          },
          data: {
            ja: createMockApiResponse("anby", "アンビー", "Anby"),
            en: createMockApiResponse("anby", "Anby", "Anby"),
          },
        },
        {
          entry: {
            id: "billy",
            pageId: 19,
            wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/19",
          },
          data: {
            ja: createMockApiResponse("billy", "ビリー", "Billy"),
            en: createMockApiResponse("billy", "Billy", "Billy"),
          },
        },
        {
          entry: {
            id: "nicole",
            pageId: 20,
            wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/20",
          },
          data: {
            ja: createMockApiResponse("nicole", "ニコル", "Nicole"),
            en: createMockApiResponse("nicole", "Nicole", "Nicole"),
          },
        },
      ]);

      // パイプライン実行
      const result = await pipeline.execute({
        scrapingFilePath: testScrapingFile,
        outputFilePath: testOutputFile,
        batchSize: 3,
        delayMs: 100,
        maxRetries: 2,
      });

      // 結果検証
      expect(result.success).toBe(true);
      expect(result.characters).toHaveLength(3);
      expect(result.processingResult.statistics.successful).toBe(3);
      expect(result.processingResult.statistics.failed).toBe(0);

      // 出力ファイルの存在確認
      expect(fs.existsSync(testOutputFile)).toBe(true);

      // 出力ファイルの内容検証
      const outputContent = fs.readFileSync(testOutputFile, "utf-8");
      expect(outputContent).toContain("export default [");
      expect(outputContent).toContain("] as Character[];");
      expect(outputContent).toContain('"anby"');
      expect(outputContent).toContain('"billy"');
      expect(outputContent).toContain('"nicole"');

      // 各キャラクターの基本構造確認
      result.characters.forEach((character) => {
        expect(character).toHaveProperty("id");
        expect(character).toHaveProperty("name");
        expect(character).toHaveProperty("fullName");
        expect(character).toHaveProperty("specialty");
        expect(character).toHaveProperty("stats");
        expect(character).toHaveProperty("attackType");
        expect(character).toHaveProperty("faction");
        expect(character).toHaveProperty("rarity");
        expect(character).toHaveProperty("attr");

        // 多言語プロパティの確認
        expect(character.name).toHaveProperty("ja");
        expect(character.name).toHaveProperty("en");
        expect(character.fullName).toHaveProperty("ja");
        expect(character.fullName).toHaveProperty("en");

        // 属性配列の長さ確認
        expect(character.attr.hp).toHaveLength(7);
        expect(character.attr.atk).toHaveLength(7);
        expect(character.attr.def).toHaveLength(7);
      });
    }, 30000);

    it("5キャラクターの小規模バッチで並行処理が正常動作する", async () => {
      // テスト用Scraping.mdファイルを作成（5キャラクター）
      const testScrapingContent = `# ZZZ Characters

## Characters List

- [anby](https://wiki.hoyolab.com/pc/zzz/entry/2) - pageId: 2
- [billy](https://wiki.hoyolab.com/pc/zzz/entry/19) - pageId: 19
- [nicole](https://wiki.hoyolab.com/pc/zzz/entry/20) - pageId: 20
- [corin](https://wiki.hoyolab.com/pc/zzz/entry/21) - pageId: 21
- [nekomata](https://wiki.hoyolab.com/pc/zzz/entry/22) - pageId: 22
`;
      fs.writeFileSync(testScrapingFile, testScrapingContent, "utf-8");

      const startTime = Date.now();

      // パイプライン実行
      const result = await pipeline.execute({
        scrapingFilePath: testScrapingFile,
        outputFilePath: testOutputFile,
        batchSize: 5,
        delayMs: 50, // 短い遅延でテスト
        maxRetries: 1,
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // 結果検証
      expect(result.success).toBe(true);
      expect(result.characters).toHaveLength(5);
      expect(result.processingResult.statistics.total).toBe(5);

      // 並行処理の効率性確認（シーケンシャル処理より速いはず）
      // 5キャラクター × 50ms遅延 = 250ms + API時間 < 10秒
      expect(executionTime).toBeLessThan(10000);

      // バッチ処理統計の確認
      expect(result.processingResult.statistics.processingTime).toBeGreaterThan(
        0
      );
      expect(result.processingResult.statistics.startTime).toBeInstanceOf(Date);
      expect(result.processingResult.statistics.endTime).toBeInstanceOf(Date);
    }, 30000);

    it("バッチサイズ2での複数バッチ処理が正常動作する", async () => {
      // テスト用Scraping.mdファイルを作成（4キャラクター）
      const testScrapingContent = `# ZZZ Characters

## Characters List

- [anby](https://wiki.hoyolab.com/pc/zzz/entry/2) - pageId: 2
- [billy](https://wiki.hoyolab.com/pc/zzz/entry/19) - pageId: 19
- [nicole](https://wiki.hoyolab.com/pc/zzz/entry/20) - pageId: 20
- [corin](https://wiki.hoyolab.com/pc/zzz/entry/21) - pageId: 21
`;
      fs.writeFileSync(testScrapingFile, testScrapingContent, "utf-8");

      // パイプライン実行（バッチサイズ2で2回のバッチ処理）
      const result = await pipeline.execute({
        scrapingFilePath: testScrapingFile,
        outputFilePath: testOutputFile,
        batchSize: 2,
        delayMs: 100,
        maxRetries: 1,
      });

      // 結果検証
      expect(result.success).toBe(true);
      expect(result.characters).toHaveLength(4);
      expect(result.processingResult.statistics.successful).toBe(4);
      expect(result.processingResult.statistics.failed).toBe(0);

      // 全キャラクターが正しく処理されていることを確認
      const characterIds = result.characters.map((c) => c.id);
      expect(characterIds).toContain("anby");
      expect(characterIds).toContain("billy");
      expect(characterIds).toContain("nicole");
      expect(characterIds).toContain("corin");
    }, 30000);
  });

  describe("エラーシナリオテスト", () => {
    it("存在しないScraping.mdファイルに対して適切なエラーを発生させる", async () => {
      await expect(
        pipeline.execute({
          scrapingFilePath: "non-existent-scraping.md",
          outputFilePath: testOutputFile,
        })
      ).rejects.toThrow();
    });

    it("無効なScraping.mdファイル形式に対して適切なエラーを発生させる", async () => {
      // 無効な形式のScraping.mdファイルを作成
      const invalidScrapingContent = `# Invalid Format
This is not a valid scraping file format.
No character entries here.
`;
      fs.writeFileSync(testScrapingFile, invalidScrapingContent, "utf-8");

      await expect(
        pipeline.execute({
          scrapingFilePath: testScrapingFile,
          outputFilePath: testOutputFile,
        })
      ).rejects.toThrow("キャラクター情報を抽出できませんでした");
    });

    it("API失敗時に部分的な結果を保存する", async () => {
      // テスト用Scraping.mdファイルを作成
      const testScrapingContent = `# ZZZ Characters

## Characters List

- [anby](https://wiki.hoyolab.com/pc/zzz/entry/2) - pageId: 2
- [billy](https://wiki.hoyolab.com/pc/zzz/entry/19) - pageId: 19
- [invalid](https://wiki.hoyolab.com/pc/zzz/entry/999) - pageId: 999
`;
      fs.writeFileSync(testScrapingFile, testScrapingContent, "utf-8");

      // API呼び出しをモック（一部失敗）
      const mockApiClient = new EnhancedApiClient();
      vi.spyOn(mockApiClient, "fetchCharacterDataBatch").mockResolvedValue([
        {
          entry: {
            id: "anby",
            pageId: 2,
            wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/2",
          },
          data: {
            ja: createMockApiResponse("anby", "アンビー", "Anby"),
            en: createMockApiResponse("anby", "Anby", "Anby"),
          },
        },
        {
          entry: {
            id: "billy",
            pageId: 19,
            wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/19",
          },
          data: {
            ja: createMockApiResponse("billy", "ビリー", "Billy"),
            en: createMockApiResponse("billy", "Billy", "Billy"),
          },
        },
        {
          entry: {
            id: "invalid",
            pageId: 999,
            wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/999",
          },
          data: null,
          error: "API request failed: 404 Not Found",
        },
      ]);

      try {
        await pipeline.execute({
          scrapingFilePath: testScrapingFile,
          outputFilePath: testOutputFile,
          batchSize: 3,
          delayMs: 50,
          maxRetries: 1,
          minSuccessRate: 1.0, // 100%成功を要求してエラーを発生させる
        });
      } catch (error) {
        // エラーが発生することを期待
        expect(error).toBeDefined();
      }

      // 部分的な結果ファイルが生成されることを確認
      const partialFile = testOutputFile.replace(".ts", "-partial.ts");
      expect(fs.existsSync(partialFile)).toBe(true);

      // エラーレポートが生成されることを確認
      expect(fs.existsSync("error-report.md")).toBe(true);
    }, 30000);

    it("無効な出力パスに対して適切なエラーを発生させる", async () => {
      // テスト用Scraping.mdファイルを作成
      const testScrapingContent = `# ZZZ Characters

## Characters List

- [anby](https://wiki.hoyolab.com/pc/zzz/entry/2) - pageId: 2
`;
      fs.writeFileSync(testScrapingFile, testScrapingContent, "utf-8");

      await expect(
        pipeline.execute({
          scrapingFilePath: testScrapingFile,
          outputFilePath: "", // 無効な出力パス
        })
      ).rejects.toThrow();
    });

    it("最小成功率を下回る場合にエラーを発生させる", async () => {
      // テスト用Scraping.mdファイルを作成（3キャラクター）
      const testScrapingContent = `# ZZZ Characters

## Characters List

- [anby](https://wiki.hoyolab.com/pc/zzz/entry/2) - pageId: 2
- [invalid1](https://wiki.hoyolab.com/pc/zzz/entry/998) - pageId: 998
- [invalid2](https://wiki.hoyolab.com/pc/zzz/entry/999) - pageId: 999
`;
      fs.writeFileSync(testScrapingFile, testScrapingContent, "utf-8");

      // API呼び出しをモック（1成功、2失敗）
      const mockApiClient = new EnhancedApiClient();
      vi.spyOn(mockApiClient, "fetchCharacterDataBatch").mockResolvedValue([
        {
          entry: {
            id: "anby",
            pageId: 2,
            wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/2",
          },
          data: {
            ja: createMockApiResponse("anby", "アンビー", "Anby"),
            en: createMockApiResponse("anby", "Anby", "Anby"),
          },
        },
        {
          entry: {
            id: "invalid1",
            pageId: 998,
            wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/998",
          },
          data: null,
          error: "API request failed",
        },
        {
          entry: {
            id: "invalid2",
            pageId: 999,
            wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/999",
          },
          data: null,
          error: "API request failed",
        },
      ]);

      await expect(
        pipeline.execute({
          scrapingFilePath: testScrapingFile,
          outputFilePath: testOutputFile,
          batchSize: 3,
          delayMs: 50,
          maxRetries: 1,
          minSuccessRate: 0.8, // 80%成功率を要求（実際は33%なのでエラー）
        })
      ).rejects.toThrow();
    }, 30000);
  });

  describe("パフォーマンステスト", () => {
    it("10キャラクターの処理が合理的な時間内に完了する", async () => {
      // テスト用Scraping.mdファイルを作成（10キャラクター）
      const characters = Array.from(
        { length: 10 },
        (_, i) =>
          `- [char${i}](https://wiki.hoyolab.com/pc/zzz/entry/${
            i + 2
          }) - pageId: ${i + 2}`
      ).join("\n");

      const testScrapingContent = `# ZZZ Characters

## Characters List

${characters}
`;
      fs.writeFileSync(testScrapingFile, testScrapingContent, "utf-8");

      const startTime = Date.now();

      const result = await pipeline.execute({
        scrapingFilePath: testScrapingFile,
        outputFilePath: testOutputFile,
        batchSize: 5,
        delayMs: 100,
        maxRetries: 1,
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // 結果検証
      expect(result.success).toBe(true);
      expect(result.characters).toHaveLength(10);

      // パフォーマンス検証（30秒以内）
      expect(executionTime).toBeLessThan(30000);

      // 処理効率の確認
      const avgTimePerCharacter = executionTime / 10;
      expect(avgTimePerCharacter).toBeLessThan(3000); // 1キャラクターあたり3秒以内

      console.log(`パフォーマンステスト結果:`);
      console.log(`  総実行時間: ${executionTime}ms`);
      console.log(`  1キャラクターあたり平均時間: ${avgTimePerCharacter}ms`);
      console.log(`  処理されたキャラクター数: ${result.characters.length}`);
    }, 60000);

    it("大量データ処理時のメモリ使用量が適切である", async () => {
      // テスト用Scraping.mdファイルを作成（15キャラクター）
      const characters = Array.from(
        { length: 15 },
        (_, i) =>
          `- [char${i}](https://wiki.hoyolab.com/pc/zzz/entry/${
            i + 2
          }) - pageId: ${i + 2}`
      ).join("\n");

      const testScrapingContent = `# ZZZ Characters

## Characters List

${characters}
`;
      fs.writeFileSync(testScrapingFile, testScrapingContent, "utf-8");

      const initialMemory = process.memoryUsage();

      const result = await pipeline.execute({
        scrapingFilePath: testScrapingFile,
        outputFilePath: testOutputFile,
        batchSize: 3,
        delayMs: 50,
        maxRetries: 1,
      });

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // 結果検証
      expect(result.success).toBe(true);
      expect(result.characters).toHaveLength(15);

      // メモリ使用量の確認（100MB以内の増加）
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);

      console.log(`メモリ使用量テスト結果:`);
      console.log(
        `  初期メモリ: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`
      );
      console.log(
        `  最終メモリ: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`
      );
      console.log(
        `  メモリ増加: ${Math.round(memoryIncrease / 1024 / 1024)}MB`
      );
    }, 60000);

    it("並行処理の効率性が適切である", async () => {
      // テスト用Scraping.mdファイルを作成（8キャラクター）
      const characters = Array.from(
        { length: 8 },
        (_, i) =>
          `- [char${i}](https://wiki.hoyolab.com/pc/zzz/entry/${
            i + 2
          }) - pageId: ${i + 2}`
      ).join("\n");

      const testScrapingContent = `# ZZZ Characters

## Characters List

${characters}
`;
      fs.writeFileSync(testScrapingFile, testScrapingContent, "utf-8");

      // バッチサイズ1（シーケンシャル）での実行時間
      const sequentialStart = Date.now();
      const sequentialResult = await pipeline.execute({
        scrapingFilePath: testScrapingFile,
        outputFilePath: testOutputFile.replace(".ts", "-sequential.ts"),
        batchSize: 1,
        delayMs: 100,
        maxRetries: 1,
      });
      const sequentialTime = Date.now() - sequentialStart;

      // バッチサイズ4（並行）での実行時間
      const parallelStart = Date.now();
      const parallelResult = await pipeline.execute({
        scrapingFilePath: testScrapingFile,
        outputFilePath: testOutputFile.replace(".ts", "-parallel.ts"),
        batchSize: 4,
        delayMs: 100,
        maxRetries: 1,
      });
      const parallelTime = Date.now() - parallelStart;

      // 結果検証
      expect(sequentialResult.success).toBe(true);
      expect(parallelResult.success).toBe(true);
      expect(sequentialResult.characters).toHaveLength(8);
      expect(parallelResult.characters).toHaveLength(8);

      // 並行処理の効率性確認（並行処理の方が速いはず）
      expect(parallelTime).toBeLessThan(sequentialTime);

      const efficiency =
        ((sequentialTime - parallelTime) / sequentialTime) * 100;
      expect(efficiency).toBeGreaterThan(10); // 少なくとも10%の改善

      console.log(`並行処理効率性テスト結果:`);
      console.log(`  シーケンシャル処理時間: ${sequentialTime}ms`);
      console.log(`  並行処理時間: ${parallelTime}ms`);
      console.log(`  効率改善: ${Math.round(efficiency)}%`);

      // クリーンアップ
      [
        testOutputFile.replace(".ts", "-sequential.ts"),
        testOutputFile.replace(".ts", "-parallel.ts"),
      ].forEach((file) => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });
    }, 90000);
  });

  describe("データ整合性統合テスト", () => {
    it("生成されたデータが全要件を満たす", async () => {
      // テスト用Scraping.mdファイルを作成
      const testScrapingContent = `# ZZZ Characters

## Characters List

- [anby](https://wiki.hoyolab.com/pc/zzz/entry/2) - pageId: 2
- [billy](https://wiki.hoyolab.com/pc/zzz/entry/19) - pageId: 19
`;
      fs.writeFileSync(testScrapingFile, testScrapingContent, "utf-8");

      const result = await pipeline.execute({
        scrapingFilePath: testScrapingFile,
        outputFilePath: testOutputFile,
        batchSize: 2,
        delayMs: 100,
        maxRetries: 1,
      });

      // 結果検証
      expect(result.success).toBe(true);
      expect(result.characters).toHaveLength(2);

      result.characters.forEach((character) => {
        // 要件1: API データの正常取得と解析
        expect(character.id).toBeTruthy();
        expect(character.name.ja).toBeTruthy();
        expect(character.name.en).toBeTruthy();

        // 要件2: 基本キャラクター情報の抽出
        expect([
          "attack",
          "stun",
          "anomaly",
          "support",
          "defense",
          "rupture",
        ]).toContain(character.specialty);
        expect([
          "ether",
          "fire",
          "ice",
          "physical",
          "electric",
          "frostAttribute",
          "auricInk",
        ]).toContain(character.stats);
        expect(["slash", "pierce", "strike"]).toContain(character.attackType);
        expect(["A", "S"]).toContain(character.rarity);

        // 要件3: 陣営情報の抽出
        expect(typeof character.faction).toBe("number");
        expect(character.faction).toBeGreaterThan(0);
        expect(character.faction).toBeLessThanOrEqual(12);

        // 要件4: 属性データの抽出
        const attr = character.attr;
        expect(attr.hp.length).toBe(7);
        expect(attr.atk.length).toBe(7);
        expect(attr.def.length).toBe(7);
        expect(typeof attr.impact).toBe("number");
        expect(typeof attr.critRate).toBe("number");
        expect(typeof attr.critDmg).toBe("number");
        expect(typeof attr.anomalyMastery).toBe("number");
        expect(typeof attr.anomalyProficiency).toBe("number");
        expect(typeof attr.penRatio).toBe("number");
        expect(typeof attr.energy).toBe("number");

        // 要件5: TypeScript型準拠のCharacterオブジェクト生成
        expect(character.name).toHaveProperty("ja");
        expect(character.name).toHaveProperty("en");
        expect(character.fullName).toHaveProperty("ja");
        expect(character.fullName).toHaveProperty("en");

        // 要件6: データ検証
        expect(character.id).not.toBeNull();
        expect(character.name.ja).not.toBe("");
        expect(character.name.en).not.toBe("");
        expect(character.fullName.ja).not.toBe("");
        expect(character.fullName.en).not.toBe("");

        // 数値配列の検証
        attr.hp.forEach((value) => expect(typeof value).toBe("number"));
        attr.atk.forEach((value) => expect(typeof value).toBe("number"));
        attr.def.forEach((value) => expect(typeof value).toBe("number"));
      });
    }, 30000);

    it("重複IDが存在しない", async () => {
      // テスト用Scraping.mdファイルを作成
      const testScrapingContent = `# ZZZ Characters

## Characters List

- [anby](https://wiki.hoyolab.com/pc/zzz/entry/2) - pageId: 2
- [billy](https://wiki.hoyolab.com/pc/zzz/entry/19) - pageId: 19
- [nicole](https://wiki.hoyolab.com/pc/zzz/entry/20) - pageId: 20
- [corin](https://wiki.hoyolab.com/pc/zzz/entry/21) - pageId: 21
`;
      fs.writeFileSync(testScrapingFile, testScrapingContent, "utf-8");

      const result = await pipeline.execute({
        scrapingFilePath: testScrapingFile,
        outputFilePath: testOutputFile,
        batchSize: 4,
        delayMs: 50,
        maxRetries: 1,
      });

      // 結果検証
      expect(result.success).toBe(true);
      expect(result.characters).toHaveLength(4);

      // 重複IDチェック
      const ids = result.characters.map((c) => c.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids.length).toBe(uniqueIds.length);

      // 各IDが一意であることを確認
      expect(uniqueIds).toContain("anby");
      expect(uniqueIds).toContain("billy");
      expect(uniqueIds).toContain("nicole");
      expect(uniqueIds).toContain("corin");
    }, 30000);
  });

  describe("ファイル操作統合テスト", () => {
    it("異なる出力パスでファイルを生成できる", async () => {
      // テスト用Scraping.mdファイルを作成
      const testScrapingContent = `# ZZZ Characters

## Characters List

- [anby](https://wiki.hoyolab.com/pc/zzz/entry/2) - pageId: 2
`;
      fs.writeFileSync(testScrapingFile, testScrapingContent, "utf-8");

      const customOutputPath = path.join(testOutputDir, "custom-characters.ts");

      const result = await pipeline.execute({
        scrapingFilePath: testScrapingFile,
        outputFilePath: customOutputPath,
        batchSize: 1,
        delayMs: 50,
        maxRetries: 1,
      });

      // 結果検証
      expect(result.success).toBe(true);
      expect(fs.existsSync(customOutputPath)).toBe(true);

      const content = fs.readFileSync(customOutputPath, "utf-8");
      expect(content).toContain("export default [");
      expect(content).toContain("] as Character[];");

      // クリーンアップ
      if (fs.existsSync(customOutputPath)) {
        fs.unlinkSync(customOutputPath);
      }
    }, 30000);

    it("処理レポートが正しく生成される", async () => {
      // テスト用Scraping.mdファイルを作成
      const testScrapingContent = `# ZZZ Characters

## Characters List

- [anby](https://wiki.hoyolab.com/pc/zzz/entry/2) - pageId: 2
- [billy](https://wiki.hoyolab.com/pc/zzz/entry/19) - pageId: 19
`;
      fs.writeFileSync(testScrapingFile, testScrapingContent, "utf-8");

      const result = await pipeline.execute({
        scrapingFilePath: testScrapingFile,
        outputFilePath: testOutputFile,
        batchSize: 2,
        delayMs: 50,
        maxRetries: 1,
      });

      // レポート生成
      const reportPath = "test-processing-report.md";
      await pipeline.generateReport(result, reportPath);

      // レポートファイルの存在確認
      expect(fs.existsSync(reportPath)).toBe(true);

      // レポート内容の確認
      const reportContent = fs.readFileSync(reportPath, "utf-8");
      expect(reportContent).toContain("# 全キャラクター処理レポート");
      expect(reportContent).toContain("## 処理概要");
      expect(reportContent).toContain("## パイプライン実行情報");
      expect(reportContent).toContain("## 生成されたキャラクター一覧");
      expect(reportContent).toContain("anby");
      expect(reportContent).toContain("billy");

      // クリーンアップ
      if (fs.existsSync(reportPath)) {
        fs.unlinkSync(reportPath);
      }
    }, 30000);
  });
});

/**
 * テスト用のモックAPIレスポンスを作成
 * @param id キャラクターID
 * @param jaName 日本語名
 * @param enName 英語名
 * @returns モックAPIレスポンス
 */
function createMockApiResponse(
  id: string,
  jaName: string,
  enName: string
): any {
  return {
    data: {
      page: {
        id: id,
        name: jaName,
        agent_specialties: { values: ["撃破"] },
        agent_stats: { values: ["電気属性"] },
        agent_attack_type: { values: ["斬撃"] },
        agent_rarity: { values: ["A"] },
        agent_faction: { values: ["邪兎屋"] },
        modules: [
          {
            components: [
              {
                component_id: "baseInfo",
                data: JSON.stringify({
                  baseInfo: {
                    faction: { ep_id: 1 },
                  },
                }),
              },
              {
                component_id: "ascension",
                data: JSON.stringify({
                  list: [
                    {
                      key: "1",
                      combatList: [
                        { key: "HP", values: ["600", "677"] },
                        { key: "攻撃力", values: ["95", "105"] },
                        { key: "防御力", values: ["44", "49"] },
                        { key: "衝撃力", values: ["110", "119"] },
                        { key: "会心率", values: ["5%", "5%"] },
                        { key: "会心ダメージ", values: ["50%", "50%"] },
                        { key: "異常マスタリー", values: ["85", "91"] },
                        { key: "異常掌握", values: ["84", "90"] },
                        { key: "貫通率", values: ["0%", "0%"] },
                        { key: "エネルギー自動回復", values: ["1.0", "1.2"] },
                      ],
                    },
                    {
                      key: "10",
                      combatList: [
                        { key: "HP", values: ["1800", "1967"] },
                        { key: "攻撃力", values: ["180", "197"] },
                        { key: "防御力", values: ["130", "141"] },
                      ],
                    },
                    {
                      key: "20",
                      combatList: [
                        { key: "HP", values: ["3100", "3350"] },
                        { key: "攻撃力", values: ["270", "296"] },
                        { key: "防御力", values: ["220", "241"] },
                      ],
                    },
                    {
                      key: "30",
                      combatList: [
                        { key: "HP", values: ["4400", "4732"] },
                        { key: "攻撃力", values: ["360", "394"] },
                        { key: "防御力", values: ["310", "340"] },
                      ],
                    },
                    {
                      key: "40",
                      combatList: [
                        { key: "HP", values: ["5700", "6114"] },
                        { key: "攻撃力", values: ["450", "494"] },
                        { key: "防御力", values: ["400", "441"] },
                      ],
                    },
                    {
                      key: "50",
                      combatList: [
                        { key: "HP", values: ["7000", "7498"] },
                        { key: "攻撃力", values: ["540", "592"] },
                        { key: "��御力", values: ["490", "540"] },
                      ],
                    },
                    {
                      key: "60",
                      combatList: [
                        { key: "HP", values: ["7800", "8416"] },
                        { key: "攻撃力", values: ["600", "653"] },
                        { key: "防御力", values: ["550", "606"] },
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
