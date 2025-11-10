import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  DriverDisc,
  DriverDiscEntry,
  ProcessedDriverDiscData,
} from "../../src/types";
import { DriverDiscDataPipeline } from "../../src/main-driver-disc-generation";
import { DriverDiscListParser } from "../../src/parsers/DriverDiscListParser";
import { DriverDiscDataProcessor } from "../../src/processors/DriverDiscDataProcessor";
import { DriverDiscGenerator } from "../../src/generators/DriverDiscGenerator";
import { HoyoLabApiClient } from "../../src/clients/HoyoLabApiClient";
import { DriverDiscDataMapper } from "../../src/mappers/DriverDiscDataMapper";
import { DriverDiscErrorHandler } from "../../src/utils/DriverDiscErrorHandler";
import { DriverDiscGracefulDegradation } from "../../src/utils/DriverDiscGracefulDegradation";
import { ApiError, ParsingError, ValidationError } from "../../src/errors";
import * as fs from "fs";
import * as path from "path";

/**
 * ドライバーディスクデータ統合テスト
 * エンドツーエンドのデータ処理フロー、実際のAPIデータを使用した統合テスト、
 * エラーシナリオとリカバリー機能のテスト
 * 要件: 4.1, 4.2, 4.3
 */
describe("DriverDisc Data Integration Tests", () => {
  let pipeline: DriverDiscDataPipeline;
  let parser: DriverDiscListParser;
  let processor: DriverDiscDataProcessor;
  let generator: DriverDiscGenerator;
  let apiClient: HoyoLabApiClient;
  let mapper: DriverDiscDataMapper;
  let errorHandler: DriverDiscErrorHandler;
  let gracefulDegradation: DriverDiscGracefulDegradation;

  const testOutputDir = "driver-disc-integration-test-output";
  const testDriverDiscsFile = path.join(testOutputDir, "test-driverDiscs.ts");
  const testDiscListFile = path.join(testOutputDir, "test-disc-list.json");
  const testConfigFile = path.join(testOutputDir, "test-config.json");
  const testReportFile = path.join(testOutputDir, "test-report.md");

  beforeEach(() => {
    // テスト用ディレクトリを作成
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }

    // コンポーネントを初期化
    parser = new DriverDiscListParser();
    apiClient = new HoyoLabApiClient();
    mapper = new DriverDiscDataMapper();
    processor = new DriverDiscDataProcessor(apiClient, mapper);
    generator = new DriverDiscGenerator();
    errorHandler = new DriverDiscErrorHandler();
    gracefulDegradation = new DriverDiscGracefulDegradation();

    // テスト用設定ファイルを作成
    const testConfig = {
      discListPath: testDiscListFile,
      outputPath: testDriverDiscsFile,
      batchSize: 2,
      delayMs: 100,
      maxRetries: 2,
      enableValidation: true,
      logLevel: "info",
    };
    fs.writeFileSync(
      testConfigFile,
      JSON.stringify(testConfig, null, 2),
      "utf-8"
    );

    // パイプラインを初期化
    pipeline = new DriverDiscDataPipeline(testConfig);

    // テスト用ファイルをクリーンアップ
    [testDriverDiscsFile, testDiscListFile, testReportFile].forEach((file) => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  });

  afterEach(() => {
    // テスト後のクリーンアップ
    [
      testDriverDiscsFile,
      testDiscListFile,
      testConfigFile,
      testReportFile,
    ].forEach((file) => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });

    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }

    vi.clearAllMocks();
  });

  describe("エンドツーエンドデータ処理フローテスト", () => {
    it("完全なドライバーディスクデータ処理パイプラインが正常に動作すること", async () => {
      // テスト用disc-list.jsonを作成（HoyoLab API形式）
      const testDiscList = {
        retcode: 0,
        message: "OK",
        data: {
          list: [
            {
              entry_page_id: "1001",
              name: "テストディスク1",
              icon_url: "https://example.com/icon1.png",
            },
            {
              entry_page_id: "1002",
              name: "テストディスク2",
              icon_url: "https://example.com/icon2.png",
            },
          ],
        },
      };
      fs.writeFileSync(
        testDiscListFile,
        JSON.stringify(testDiscList, null, 2),
        "utf-8"
      );

      // APIクライアントをモック
      const mockApiResponse1 = createMockDriverDiscApiResponse(
        "1001",
        "テストディスク1",
        "Test Disc 1"
      );
      const mockApiResponse2 = createMockDriverDiscApiResponse(
        "1002",
        "テストディスク2",
        "Test Disc 2"
      );

      vi.spyOn(apiClient, "fetchCharacterData").mockImplementation(
        async (pageId: number, lang: "ja-jp" | "en-us") => {
          if (pageId === 1001) {
            return mockApiResponse1;
          } else if (pageId === 1002) {
            return mockApiResponse2;
          }
          throw new Error("Unknown page ID");
        }
      );

      // パイプラインを実行
      const result = await pipeline.execute();

      // 結果の検証
      expect(result.success).toBe(true);
      expect(result.driverDiscs).toHaveLength(2);
      expect(result.statistics.successful).toBe(2);
      expect(result.statistics.failed).toBe(0);

      // 生成されたドライバーディスクの検証
      const driverDisc1 = result.driverDiscs.find((d) => d.id === 1001);
      const driverDisc2 = result.driverDiscs.find((d) => d.id === 1002);

      expect(driverDisc1).toBeDefined();
      expect(driverDisc1!.name.ja).toBe("テストディスク1");
      expect(driverDisc1!.name.en).toBe("Test Disc 1");
      expect(driverDisc1!.specialty).toBe("attack");

      expect(driverDisc2).toBeDefined();
      expect(driverDisc2!.name.ja).toBe("テストディスク2");
      expect(driverDisc2!.name.en).toBe("Test Disc 2");

      // 出力ファイルが生成されることを確認
      expect(fs.existsSync(testDriverDiscsFile)).toBe(true);

      // ファイル内容の検証
      const fileContent = fs.readFileSync(testDriverDiscsFile, "utf-8");
      expect(fileContent).toContain(
        'import { DriverDisc } from "../src/types"'
      );
      expect(fileContent).toContain("export default [");
      expect(fileContent).toContain("] as DriverDisc[]");
      expect(fileContent).toContain("テストディスク1");
      expect(fileContent).toContain("テストディスク2");
    }, 30000);

    it("バッチ処理が正常に動作すること", async () => {
      // 大量のテストデータを作成（HoyoLab API形式）
      const testDiscListItems = [];
      for (let i = 1; i <= 5; i++) {
        testDiscListItems.push({
          entry_page_id: `100${i}`,
          name: `テストディスク${i}`,
          icon_url: `https://example.com/icon${i}.png`,
        });
      }
      const testDiscList = {
        retcode: 0,
        message: "OK",
        data: {
          list: testDiscListItems,
        },
      };
      fs.writeFileSync(
        testDiscListFile,
        JSON.stringify(testDiscList, null, 2),
        "utf-8"
      );

      // APIクライアントをモック（バッチサイズ2で処理される）
      vi.spyOn(apiClient, "fetchCharacterData").mockImplementation(
        async (pageId: number, lang: "ja-jp" | "en-us") => {
          const id = pageId.toString().replace("100", "");
          return createMockDriverDiscApiResponse(
            pageId.toString(),
            `テストディスク${id}`,
            `Test Disc ${id}`
          );
        }
      );

      const result = await pipeline.execute();

      // バッチ処理の結果を検証
      expect(result.success).toBe(true);
      expect(result.driverDiscs).toHaveLength(5);
      expect(result.statistics.successful).toBe(5);
      expect(result.statistics.failed).toBe(0);

      // 処理時間が適切であることを確認（バッチ間の遅延を考慮）
      expect(result.statistics.processingTime).toBeGreaterThan(200); // 最低限の処理時間
      expect(result.statistics.processingTime).toBeLessThan(10000); // 10秒以内
    }, 30000);
  });

  describe("実際のAPIデータを使用した統合テスト", () => {
    it("実際のAPIレスポンス形式でデータ処理が正常に動作すること", async () => {
      const testDiscList = [
        {
          entry_page_id: "2001",
          name: "リアルAPIテストディスク",
          icon_url: "https://example.com/real-icon.png",
        },
      ];
      fs.writeFileSync(
        testDiscListFile,
        JSON.stringify(testDiscList, null, 2),
        "utf-8"
      );

      // 実際のAPIレスポンス形式に近いモックデータ
      const realApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "2001",
            name: "リアルAPIテストディスク",
            modules: [
              {
                components: [
                  {
                    component_id: "display_field",
                    data: JSON.stringify({
                      four_set_effect:
                        "<p>攻撃力が<span style='color: #ff6b00'>15%</span>アップする。</p>",
                      two_set_effect:
                        "<p>攻撃力が<span style='color: #ff6b00'>10%</span>アップする。</p>",
                    }),
                  },
                ],
              },
            ],
          },
        },
      };

      vi.spyOn(apiClient, "fetchCharacterData").mockResolvedValue(
        realApiResponse
      );

      const result = await pipeline.execute();

      expect(result.success).toBe(true);
      expect(result.driverDiscs).toHaveLength(1);

      const driverDisc = result.driverDiscs[0];
      expect(driverDisc.id).toBe(2001);
      expect(driverDisc.name.ja).toBe("リアルAPIテストディスク");
      expect(driverDisc.fourSetEffect.ja).toBe("攻撃力が15%アップする。"); // HTMLタグが除去されている
      expect(driverDisc.twoSetEffect.ja).toBe("攻撃力が10%アップする。");
      expect(driverDisc.specialty).toBe("attack"); // 4セット効果から推定
    }, 30000);
  });

  describe("エラーシナリオとリカバリー機能のテスト", () => {
    it("APIエラー時のリトライ機能が正常に動作すること", async () => {
      const testDiscList = [
        {
          entry_page_id: "5001",
          name: "リトライテストディスク",
          icon_url: "https://example.com/retry-icon.png",
        },
      ];
      fs.writeFileSync(
        testDiscListFile,
        JSON.stringify(testDiscList, null, 2),
        "utf-8"
      );

      let callCount = 0;
      vi.spyOn(apiClient, "fetchCharacterData").mockImplementation(
        async (pageId: number, lang: "ja-jp" | "en-us") => {
          callCount++;
          if (callCount <= 2) {
            // 最初の2回は失敗
            throw new ApiError("Network timeout", 500);
          }
          // 3回目で成功
          return createMockDriverDiscApiResponse(
            "5001",
            "リトライテストディスク",
            "Retry Test Disc"
          );
        }
      );

      const result = await pipeline.execute();

      // リトライ後に成功することを確認
      expect(result.success).toBe(true);
      expect(result.driverDiscs).toHaveLength(1);
      expect(result.statistics.successful).toBe(1);
      expect(result.statistics.failed).toBe(0);
      expect(callCount).toBe(3); // 2回失敗 + 1回成功
    }, 30000);

    it("部分的失敗時のグレースフル劣化が正常に動作すること", async () => {
      const testDiscList = [
        {
          entry_page_id: "6001",
          name: "成功ディスク",
          icon_url: "https://example.com/success-icon.png",
        },
        {
          entry_page_id: "6002",
          name: "失敗ディスク",
          icon_url: "https://example.com/fail-icon.png",
        },
      ];
      fs.writeFileSync(
        testDiscListFile,
        JSON.stringify(testDiscList, null, 2),
        "utf-8"
      );

      vi.spyOn(apiClient, "fetchCharacterData").mockImplementation(
        async (pageId: number, lang: "ja-jp" | "en-us") => {
          if (pageId === 6001) {
            return createMockDriverDiscApiResponse(
              "6001",
              "成功ディスク",
              "Success Disc"
            );
          } else if (pageId === 6002) {
            throw new ApiError("Disc not found", 404);
          }
          throw new Error("Unknown page ID");
        }
      );

      const result = await pipeline.execute();

      // 部分的成功を確認
      expect(result.success).toBe(true);
      expect(result.statistics.successful).toBeGreaterThan(0);
      expect(result.statistics.failed).toBeGreaterThan(0);
      expect(result.failedDriverDiscs).toHaveLength(1);
      expect(result.failedDriverDiscs[0].discId).toBe("6002");
    }, 30000);
  });

  describe("既存システムとの統合テスト", () => {
    it("data/index.tsエクスポートとの統合が正常に動作すること", () => {
      // data/index.tsファイルの存在確認
      const dataIndexPath = "data/index.ts";
      if (fs.existsSync(dataIndexPath)) {
        const fileContent = fs.readFileSync(dataIndexPath, "utf-8");

        // driverDiscsのエクスポートが含まれることを確認
        expect(fileContent).toContain(
          'export { default as driverDiscs } from "./driverDiscs"'
        );

        // 型定義のエクスポートも含まれることを確認
        expect(fileContent).toContain('export * from "../src/types"');
      }
    });

    it("ProcessingConfig型との統合が正常に動作すること", () => {
      // src/types/index.tsファイルの内容を確認
      const typesPath = "src/types/index.ts";
      if (fs.existsSync(typesPath)) {
        const fileContent = fs.readFileSync(typesPath, "utf-8");

        // DriverDiscProcessingConfig型が定義されていることを確認
        expect(fileContent).toContain("DriverDiscProcessingConfig");
        expect(fileContent).toContain("discListPath");
        expect(fileContent).toContain("outputPath");
        expect(fileContent).toContain("batchSize");
        expect(fileContent).toContain("delayMs");
        expect(fileContent).toContain("maxRetries");
      }
    });

    it("他のデータ処理システムとの共存が正常に動作すること", async () => {
      // ドライバーディスク処理が他のシステムに影響を与えないことを確認
      const testDiscList = [
        {
          entry_page_id: "14001",
          name: "共存テストディスク",
          icon_url: "https://example.com/coexist-icon.png",
        },
      ];
      fs.writeFileSync(
        testDiscListFile,
        JSON.stringify(testDiscList, null, 2),
        "utf-8"
      );

      vi.spyOn(apiClient, "fetchCharacterData").mockResolvedValue(
        createMockDriverDiscApiResponse(
          "14001",
          "共存テストディスク",
          "Coexist Test Disc"
        )
      );

      const result = await pipeline.execute();

      expect(result.success).toBe(true);
      expect(result.driverDiscs).toHaveLength(1);

      // 生成されたファイルが正しい形式であることを確認
      expect(fs.existsSync(testDriverDiscsFile)).toBe(true);
      const fileContent = fs.readFileSync(testDriverDiscsFile, "utf-8");

      // 既存のCharacter型やWeapon型と同様の構造であることを確認
      expect(fileContent).toContain(
        'import { DriverDisc } from "../src/types"'
      );
      expect(fileContent).toContain("export default [");
      expect(fileContent).toContain("] as DriverDisc[]");
    }, 30000);
  });
});

/**
 * テスト用のモックDriverDiscAPIレスポンスを作成
 */
function createMockDriverDiscApiResponse(
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
        modules: [
          {
            components: [
              {
                component_id: "display_field",
                data: JSON.stringify({
                  four_set_effect: `<p>攻撃力が<span style='color: #ff6b00'>15%</span>アップする。</p>`,
                  two_set_effect: `<p>攻撃力が<span style='color: #ff6b00'>10%</span>アップする。</p>`,
                }),
              },
            ],
          },
        ],
      },
    },
  };
}
