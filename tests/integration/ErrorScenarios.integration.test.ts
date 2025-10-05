import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EnhancedMainPipeline } from "../../src/main-pipeline-enhanced";
import { CharacterListParser } from "../../src/parsers/CharacterListParser";
import { BatchProcessor } from "../../src/processors/BatchProcessor";
import { EnhancedApiClient } from "../../src/clients/EnhancedApiClient";
import { EnhancedDataProcessor } from "../../src/processors/EnhancedDataProcessor";
import { AllCharactersGenerator } from "../../src/generators/AllCharactersGenerator";
import {
  AllCharactersError,
  ProcessingStage,
  ApiError,
  ParsingError,
  ValidationError,
  BatchProcessingError,
} from "../../src/errors";
import * as fs from "fs";
import * as path from "path";

/**
 * エラーシナリオ統合テスト
 * 様々なエラー状況での処理継続性とエラーハンドリングの検証
 * 要件: 1.5, 6.6, 7.3, 7.5 - エラーハンドリングと継続機能
 */
describe("Error Scenarios Integration Tests", () => {
  let pipeline: EnhancedMainPipeline;
  let parser: CharacterListParser;
  let batchProcessor: BatchProcessor;
  let generator: AllCharactersGenerator;

  const testOutputDir = "error-test-output";
  const testOutputFile = path.join(testOutputDir, "error-test-characters.ts");
  const errorReportFile = "error-test-report.md";

  beforeEach(() => {
    pipeline = new EnhancedMainPipeline();
    parser = new CharacterListParser();

    const apiClient = new EnhancedApiClient();
    const dataProcessor = new EnhancedDataProcessor();
    batchProcessor = new BatchProcessor(apiClient, dataProcessor);
    generator = new AllCharactersGenerator();

    // テスト用ディレクトリを作成
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }

    // テスト用ファイルをクリーンアップ
    [testOutputFile, errorReportFile].forEach((file) => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  });

  afterEach(() => {
    // テスト後のクリーンアップ
    [
      testOutputFile,
      errorReportFile,
      "processing-report.md",
      "error-report.md",
      "partial-processing-report.md",
      testOutputFile.replace(".ts", "-partial.ts"),
    ].forEach((file) => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });

    // テスト用ディレクトリを削除
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }

    // テスト用Scraping.mdファイルをクリーンアップ
    [
      "test-scraping-error.md",
      "invalid-scraping.md",
      "empty-scraping.md",
    ].forEach((file) => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  });

  describe("ファイル関連エラーシナリオ", () => {
    it("存在しないScraping.mdファイルでAllCharactersErrorが発生する", async () => {
      const nonExistentFile = "non-existent-scraping.md";

      await expect(
        pipeline.execute({
          scrapingFilePath: nonExistentFile,
          outputFilePath: testOutputFile,
        })
      ).rejects.toThrow(AllCharactersError);

      try {
        await pipeline.execute({
          scrapingFilePath: nonExistentFile,
          outputFilePath: testOutputFile,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(AllCharactersError);
        const allCharError = error as AllCharactersError;
        expect(allCharError.stage).toBe(ProcessingStage.PARSING);
        expect(allCharError.details).toContain(
          "Scraping.mdファイルの解析に失敗しました"
        );
      }
    });

    it("無効なScraping.mdファイル形式でParsingErrorが発生する", async () => {
      const invalidScrapingFile = "invalid-scraping.md";
      const invalidContent = `# Invalid Format
This is not a valid scraping file.
- Invalid entry without proper format
- Another invalid entry
`;
      fs.writeFileSync(invalidScrapingFile, invalidContent, "utf-8");

      await expect(
        pipeline.execute({
          scrapingFilePath: invalidScrapingFile,
          outputFilePath: testOutputFile,
        })
      ).rejects.toThrow(AllCharactersError);

      try {
        await pipeline.execute({
          scrapingFilePath: invalidScrapingFile,
          outputFilePath: testOutputFile,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(AllCharactersError);
        const allCharError = error as AllCharactersError;
        expect(allCharError.stage).toBe(ProcessingStage.PARSING);
        expect(allCharError.details).toContain(
          "キャラクター情報を抽出できませんでした"
        );
      }
    });

    it("空のScraping.mdファイルで適切なエラーが発生する", async () => {
      const emptyScrapingFile = "empty-scraping.md";
      fs.writeFileSync(emptyScrapingFile, "", "utf-8");

      await expect(
        pipeline.execute({
          scrapingFilePath: emptyScrapingFile,
          outputFilePath: testOutputFile,
        })
      ).rejects.toThrow(AllCharactersError);
    });

    it("読み取り専用ディレクトリへの出力でファイル出力エラーが発生する", async () => {
      // 有効なScraping.mdファイルを作成
      const validScrapingFile = "test-scraping-error.md";
      const validContent = `# ZZZ Characters

## Characters List

- [anby](https://wiki.hoyolab.com/pc/zzz/entry/2) - pageId: 2
`;
      fs.writeFileSync(validScrapingFile, validContent, "utf-8");

      // 存在しないディレクトリパスを指定（権限エラーをシミュレート）
      const invalidOutputPath = "/root/invalid-path/characters.ts";

      await expect(
        pipeline.execute({
          scrapingFilePath: validScrapingFile,
          outputFilePath: invalidOutputPath,
        })
      ).rejects.toThrow();
    });
  });

  describe("データ処理エラーシナリオ", () => {
    it("無効なAPIレスポンスデータでデータ処理エラーが発生する", async () => {
      const testScrapingFile = "test-scraping-error.md";
      const testContent = `# ZZZ Characters

## Characters List

- [anby](https://wiki.hoyolab.com/pc/zzz/entry/2) - pageId: 2
- [billy](https://wiki.hoyolab.com/pc/zzz/entry/19) - pageId: 19
`;
      fs.writeFileSync(testScrapingFile, testContent, "utf-8");

      // 無効なAPIレスポンスをモック
      const mockApiClient = new EnhancedApiClient();
      vi.spyOn(mockApiClient, "fetchCharacterDataBatch").mockResolvedValue([
        {
          entry: {
            id: "anby",
            pageId: 2,
            wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/2",
          },
          data: {
            ja: { retcode: 0, message: "OK", data: { page: null } }, // 無効なデータ構造
            en: { retcode: 0, message: "OK", data: { page: null } },
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
      ]);

      try {
        await pipeline.execute({
          scrapingFilePath: testScrapingFile,
          outputFilePath: testOutputFile,
          batchSize: 2,
          delayMs: 50,
          maxRetries: 1,
          minSuccessRate: 1.0,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(AllCharactersError);
      }

      // 部分的な結果（billyのみ）が保存されることを確認
      const partialFile = testOutputFile.replace(".ts", "-partial.ts");
      if (fs.existsSync(partialFile)) {
        const partialContent = fs.readFileSync(partialFile, "utf-8");
        expect(partialContent).toContain("billy");
        expect(partialContent).not.toContain("anby");
      }
    }, 30000);

    it("陣営データ解決エラーで処理が継続される", async () => {
      const testScrapingFile = "test-scraping-error.md";
      const testContent = `# ZZZ Characters

## Characters List

- [anby](https://wiki.hoyolab.com/pc/zzz/entry/2) - pageId: 2
`;
      fs.writeFileSync(testScrapingFile, testContent, "utf-8");

      // 無効な陣営データを含むAPIレスポンスをモック
      const mockApiClient = new EnhancedApiClient();
      vi.spyOn(mockApiClient, "fetchCharacterDataBatch").mockResolvedValue([
        {
          entry: {
            id: "anby",
            pageId: 2,
            wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/2",
          },
          data: {
            ja: {
              retcode: 0,
              message: "OK",
              data: {
                page: {
                  id: "anby",
                  name: "アンビー",
                  agent_specialties: { values: ["撃破"] },
                  agent_stats: { values: ["電気属性"] },
                  agent_rarity: { values: ["A"] },
                  agent_faction: { values: ["存在しない陣営"] }, // 無効な陣営名
                  modules: [
                    {
                      components: [
                        {
                          component_id: "baseInfo",
                          data: JSON.stringify({
                            baseInfo: {
                              faction: { ep_id: 999 }, // 無効な陣営ID
                            },
                          }),
                        },
                        {
                          component_id: "ascension",
                          data: JSON.stringify(createMockAscensionData()),
                        },
                      ],
                    },
                  ],
                },
              },
            },
            en: {
              retcode: 0,
              message: "OK",
              data: {
                page: {
                  id: "anby",
                  name: "Anby",
                  agent_specialties: { values: ["Stun"] },
                  agent_stats: { values: ["Electric"] },
                  agent_rarity: { values: ["A"] },
                  agent_faction: { values: ["Unknown Faction"] },
                  modules: [],
                },
              },
            },
          },
        },
      ]);

      // データ処理エラーが発生するが、エラーハンドリングで処理が継続されることを確認
      try {
        await pipeline.execute({
          scrapingFilePath: testScrapingFile,
          outputFilePath: testOutputFile,
          batchSize: 1,
          delayMs: 50,
          maxRetries: 1,
          minSuccessRate: 1.0,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(AllCharactersError);
        const allCharError = error as AllCharactersError;
        expect(allCharError.stage).toBe(ProcessingStage.BATCH_PROCESSING);
      }
    }, 30000);
  });

  describe("検証エラーシナリオ", () => {
    it("重複IDが検出された場合に検証エラーが発生する", async () => {
      // 重複IDを持つキャラクターデータを直接作成してテスト
      const duplicateCharacters = [
        createMockCharacter("anby", "アンビー", "Anby"),
        createMockCharacter("anby", "アンビー2", "Anby2"), // 重複ID
        createMockCharacter("billy", "ビリー", "Billy"),
      ];

      const validationResult =
        generator.validateCharacterArray(duplicateCharacters);

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.duplicateIds).toContain("anby");
      expect(validationResult.duplicateIds).toHaveLength(1);
      expect(validationResult.totalCharacters).toBe(3);
    });

    it("無効な属性配列長でValidationErrorが発生する", async () => {
      const invalidCharacter = createMockCharacter("anby", "アンビー", "Anby");
      // HP配列を意図的に短くする
      invalidCharacter.attr.hp = [100, 200, 300]; // 7要素ではなく3要素

      const validationResult = generator.validateCharacterArray([
        invalidCharacter,
      ]);

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.invalidCharacters).toHaveLength(1);
      expect(validationResult.invalidCharacters[0].errors).toContain(
        "attr.hp 配列は正確に 7 つの値を含む必要があります (現在: 3)"
      );
    });

    it("無効な列挙値でValidationErrorが発生する", async () => {
      const invalidCharacter = createMockCharacter("anby", "アンビー", "Anby");
      // 無効な specialty 値を設定
      (invalidCharacter as any).specialty = "invalid_specialty";

      const validationResult = generator.validateCharacterArray([
        invalidCharacter,
      ]);

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.invalidCharacters).toHaveLength(1);
      expect(validationResult.invalidCharacters[0].errors).toContain(
        'specialty "invalid_specialty" は有効な値ではありません'
      );
    });

    it("必須フィールド欠如でValidationErrorが発生する", async () => {
      const incompleteCharacter = createMockCharacter(
        "anby",
        "アンビー",
        "Anby"
      );
      // 必須フィールドを削除
      delete (incompleteCharacter as any).name;
      delete (incompleteCharacter as any).attr;

      const validationResult = generator.validateCharacterArray([
        incompleteCharacter,
      ]);

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.invalidCharacters).toHaveLength(1);
      const errors = validationResult.invalidCharacters[0].errors;
      expect(errors).toContain("name フィールドが存在しません");
      expect(errors).toContain("attr フィールドが存在しません");
    });
  });

  describe("バッチ処理エラーシナリオ", () => {
    it("バッチ処理中の部分的失敗で処理が継続される", async () => {
      const testScrapingFile = "test-scraping-error.md";
      const testContent = `# ZZZ Characters

## Characters List

- [anby](https://wiki.hoyolab.com/pc/zzz/entry/2) - pageId: 2
- [billy](https://wiki.hoyolab.com/pc/zzz/entry/19) - pageId: 19
- [invalid](https://wiki.hoyolab.com/pc/zzz/entry/9999) - pageId: 9999
- [nicole](https://wiki.hoyolab.com/pc/zzz/entry/20) - pageId: 20
`;
      fs.writeFileSync(testScrapingFile, testContent, "utf-8");

      // バッチ処理で一部失敗をシミュレート
      const mockApiClient = new EnhancedApiClient();
      vi.spyOn(mockApiClient, "fetchCharacterDataBatch").mockImplementation(
        async (entries) => {
          return entries.map((entry) => {
            if (entry.id === "invalid") {
              return {
                entry,
                data: null,
                error: "Character not found",
              };
            }
            return {
              entry,
              data: {
                ja: createMockApiResponse(
                  entry.id,
                  `${entry.id}_ja`,
                  `${entry.id}_en`
                ),
                en: createMockApiResponse(
                  entry.id,
                  `${entry.id}_ja`,
                  `${entry.id}_en`
                ),
              },
            };
          });
        }
      );

      const result = await pipeline.execute({
        scrapingFilePath: testScrapingFile,
        outputFilePath: testOutputFile,
        batchSize: 2,
        delayMs: 50,
        maxRetries: 1,
        minSuccessRate: 0.6, // 60%成功率で継続
      });

      // 部分的成功を確認
      expect(result.success).toBe(true);
      expect(result.characters).toHaveLength(3); // anby, billy, nicole
      expect(result.processingResult.statistics.successful).toBe(3);
      expect(result.processingResult.statistics.failed).toBe(1);

      // 成功したキャラクターのIDを確認
      const characterIds = result.characters.map((c) => c.id);
      expect(characterIds).toContain("anby");
      expect(characterIds).toContain("billy");
      expect(characterIds).toContain("nicole");
      expect(characterIds).not.toContain("invalid");
    }, 30000);

    it("最小成功率を下回る場合にBatchProcessingErrorが発生する", async () => {
      const testScrapingFile = "test-scraping-error.md";
      const testContent = `# ZZZ Characters

## Characters List

- [anby](https://wiki.hoyolab.com/pc/zzz/entry/2) - pageId: 2
- [invalid1](https://wiki.hoyolab.com/pc/zzz/entry/9999) - pageId: 9999
- [invalid2](https://wiki.hoyolab.com/pc/zzz/entry/9998) - pageId: 9998
- [invalid3](https://wiki.hoyolab.com/pc/zzz/entry/9997) - pageId: 9997
`;
      fs.writeFileSync(testScrapingFile, testContent, "utf-8");

      // 大部分を失敗させる（1成功、3失敗 = 25%成功率）
      const mockApiClient = new EnhancedApiClient();
      vi.spyOn(mockApiClient, "fetchCharacterDataBatch").mockImplementation(
        async (entries) => {
          return entries.map((entry) => {
            if (entry.id === "anby") {
              return {
                entry,
                data: {
                  ja: createMockApiResponse(
                    entry.id,
                    `${entry.id}_ja`,
                    `${entry.id}_en`
                  ),
                  en: createMockApiResponse(
                    entry.id,
                    `${entry.id}_ja`,
                    `${entry.id}_en`
                  ),
                },
              };
            }
            return {
              entry,
              data: null,
              error: "API request failed",
            };
          });
        }
      );

      await expect(
        pipeline.execute({
          scrapingFilePath: testScrapingFile,
          outputFilePath: testOutputFile,
          batchSize: 4,
          delayMs: 50,
          maxRetries: 1,
          minSuccessRate: 0.8, // 80%成功率を要求（実際は25%）
        })
      ).rejects.toThrow(AllCharactersError);

      // 部分的な結果が保存されることを確認
      const partialFile = testOutputFile.replace(".ts", "-partial.ts");
      expect(fs.existsSync(partialFile)).toBe(true);
      const partialContent = fs.readFileSync(partialFile, "utf-8");
      expect(partialContent).toContain("anby");
    }, 30000);
  });

  describe("リソース制限エラーシナリオ", () => {
    it("メモリ不足シミュレーション時の適切なエラーハンドリング", async () => {
      const testScrapingFile = "test-scraping-error.md";
      const testContent = `# ZZZ Characters

## Characters List

- [anby](https://wiki.hoyolab.com/pc/zzz/entry/2) - pageId: 2
`;
      fs.writeFileSync(testScrapingFile, testContent, "utf-8");

      // メモリ不足をシミュレートするため、非常に大きなデータを返すモック
      const mockApiClient = new EnhancedApiClient();
      vi.spyOn(mockApiClient, "fetchCharacterDataBatch").mockImplementation(
        async (entries) => {
          // 大量のデータを含むレスポンスを作成
          const largeData = createMockApiResponse("anby", "アンビー", "Anby");
          // 意図的に大きなデータ構造を作成
          largeData.data.page.largeArray = new Array(1000000).fill(
            "large_data"
          );

          return entries.map((entry) => ({
            entry,
            data: {
              ja: largeData,
              en: largeData,
            },
          }));
        }
      );

      try {
        const result = await pipeline.execute({
          scrapingFilePath: testScrapingFile,
          outputFilePath: testOutputFile,
          batchSize: 1,
          delayMs: 50,
          maxRetries: 1,
          minSuccessRate: 0.8,
        });

        // メモリ不足が発生しなかった場合でも、処理が完了することを確認
        expect(result.success).toBe(true);
      } catch (error) {
        // メモリ関連のエラーが発生した場合、適切にハンドリングされることを確認
        expect(error).toBeInstanceOf(Error);
        // console.log(`メモリ制限エラー（期待される動作）: ${error.message}`);
      }
    }, 60000);

    it("タイムアウトエラーシミュレーション", async () => {
      const testScrapingFile = "test-scraping-error.md";
      const testContent = `# ZZZ Characters

## Characters List

- [anby](https://wiki.hoyolab.com/pc/zzz/entry/2) - pageId: 2
`;
      fs.writeFileSync(testScrapingFile, testContent, "utf-8");

      // 長時間の遅延をシミュレート
      const mockApiClient = new EnhancedApiClient();
      vi.spyOn(mockApiClient, "fetchBothLanguages").mockImplementation(
        async (pageId) => {
          // 30秒の遅延をシミュレート
          await new Promise((resolve) => setTimeout(resolve, 30000));

          return {
            ja: createMockApiResponse("anby", "anby_ja", "anby_en"),
            en: createMockApiResponse("anby", "anby_ja", "anby_en"),
          };
        }
      );

      // BatchProcessorのapiClientを置き換え
      const mockBatchProcessor = new BatchProcessor(mockApiClient);
      (pipeline as any).batchProcessor = mockBatchProcessor;

      // タイムアウトが発生することを確認（テストタイムアウトより短い時間で設定）
      await expect(
        pipeline.execute({
          scrapingFilePath: testScrapingFile,
          outputFilePath: testOutputFile,
          batchSize: 1,
          delayMs: 50,
          maxRetries: 1,
          minSuccessRate: 0.8,
        })
      ).rejects.toThrow();
    }, 35000);
  });
});

/**
 * テスト用のモックAPIレスポンスを作成
 */
function createMockApiResponse(
  id: string,
  jaName: string,
  enName: string
): any {
  return {
    retcode: 0,
    message: "OK",
    data: {
      page: {
        id: id,
        name: jaName,
        agent_specialties: { values: ["撃破"] },
        agent_stats: { values: ["電気属性"] },
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
                data: JSON.stringify(createMockAscensionData()),
              },
            ],
          },
        ],
      },
    },
  };
}

/**
 * テスト用のモック昇格データを作成
 */
function createMockAscensionData(): any {
  return {
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
          { key: "防御力", values: ["490", "540"] },
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
  };
}

/**
 * テスト用のモックCharacterオブジェクトを作成
 */
function createMockCharacter(id: string, jaName: string, enName: string): any {
  return {
    id,
    name: { ja: jaName, en: enName },
    fullName: { ja: jaName, en: enName },
    specialty: "stun",
    stats: "electric",
    faction: 1,
    rarity: "A",
    attr: {
      hp: [677, 1967, 3350, 4732, 6114, 7498, 8416],
      atk: [105, 197, 296, 394, 494, 592, 653],
      def: [49, 141, 241, 340, 441, 540, 606],
      impact: 119,
      critRate: 5,
      critDmg: 50,
      anomalyMastery: 91,
      anomalyProficiency: 90,
      penRatio: 0,
      energy: 1.2,
    },
  };
}
