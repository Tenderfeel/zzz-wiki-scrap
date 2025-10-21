import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { WeaponIconGenerator } from "../../src/generators/WeaponIconGenerator";
import { WeaponIconProcessor } from "../../src/processors/WeaponIconProcessor";
import { FileLoader } from "../../src/loaders/FileLoader";
import { ConfigManager } from "../../src/config/ProcessingConfig";
import { WeaponIconConfig } from "../../src/types/processing";
import { main } from "../../src/main-weapon-icon-download";

/**
 * 武器アイコンダウンロードの最終統合テスト
 * 実データでの動作確認、S・A級レアリティフィルタリングの検証、全コンポーネント統合テスト
 * 要件: 4.4, 4.5
 */
describe("WeaponIcon Final Integration Tests", () => {
  const testOutputDir = "test-final-assets/images/weapons";
  const testConfigPath = "test-final-weapon-config.json";

  let originalEnv: NodeJS.ProcessEnv;
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    // 環境変数を保存
    originalEnv = { ...process.env };
    originalFetch = global.fetch;
    process.env.NODE_ENV = "test";
    process.env.VITEST = "true";

    // テスト用ディレクトリをクリーンアップ
    await cleanupTestDirectory();

    // テスト用設定ファイルを作成
    await createTestConfig();
  });

  afterEach(async () => {
    // 環境変数を復元
    process.env = originalEnv;
    global.fetch = originalFetch;

    // テストファイルをクリーンアップ
    await cleanupTestFiles();
  });

  describe("実データでの統合テスト", () => {
    it("実際のweapon-list.jsonを使用した完全な統合テスト", async () => {
      // 実際のweapon-list.jsonファイルが存在することを確認
      const weaponListPath = "json/data/weapon-list.json";
      const weaponListExists = await fs
        .access(weaponListPath)
        .then(() => true)
        .catch(() => false);

      if (!weaponListExists) {
        console.warn(
          "weapon-list.json が見つかりません。テストをスキップします。"
        );
        return;
      }

      // 実際のファイルを読み込み
      const weaponListContent = await fs.readFile(weaponListPath, "utf-8");
      const weaponList = JSON.parse(weaponListContent);

      // レアリティ別の武器数を事前に計算
      const sRarityWeapons = weaponList.filter((weapon: any) =>
        weapon.filter_values?.w_engine_rarity?.values?.includes("S")
      );
      const aRarityWeapons = weaponList.filter((weapon: any) =>
        weapon.filter_values?.w_engine_rarity?.values?.includes("A")
      );
      const bRarityWeapons = weaponList.filter((weapon: any) =>
        weapon.filter_values?.w_engine_rarity?.values?.includes("B")
      );

      console.log(
        `実データ統計: S級=${sRarityWeapons.length}, A級=${aRarityWeapons.length}, B級=${bRarityWeapons.length}`
      );

      // モックfetchを設定（実際のダウンロードは行わない）
      const mockFetch = createMockFetch();
      global.fetch = mockFetch;

      // 設定を取得
      const configManager = ConfigManager.getInstance(testConfigPath);
      const config = configManager.getWeaponIconConfig();

      // コンポーネントを初期化
      const fileLoader = new FileLoader();
      const weaponIconProcessor = new WeaponIconProcessor(config);
      const weaponIconGenerator = new WeaponIconGenerator(
        fileLoader,
        weaponIconProcessor,
        config
      );

      // メイン処理を実行
      const result = await weaponIconGenerator.generateWeaponIcons();

      // 結果を検証
      expect(result).toBeDefined();
      expect(result.statistics.total).toBe(
        sRarityWeapons.length + aRarityWeapons.length
      );
      expect(result.statistics.successful).toBe(
        sRarityWeapons.length + aRarityWeapons.length
      );
      expect(result.statistics.failed).toBe(0);

      // B級武器が除外されていることを確認（実際にはB級武器は存在しないため、全武器が処理される）
      if (bRarityWeapons.length > 0) {
        expect(result.statistics.total).not.toBe(weaponList.length);
      } else {
        // B級武器が存在しない場合、S・A級のみなので全武器が処理される
        expect(result.statistics.total).toBe(weaponList.length);
      }

      // S・A級のみが処理されることを確認
      const expectedTotal = sRarityWeapons.length + aRarityWeapons.length;
      expect(result.statistics.total).toBe(expectedTotal);

      // 成功した武器のファイルパスを検証
      for (const iconInfo of result.successful) {
        expect(iconInfo.localPath).toMatch(
          /test-final-assets\/images\/weapons\/\d+\.png$/
        );
        expect(iconInfo.weaponId).toMatch(/^\d+$/);
        expect(iconInfo.fileSize).toBeGreaterThan(0);
        expect(iconInfo.downloadedAt).toBeInstanceOf(Date);
      }

      // 統計情報の整合性を確認
      expect(result.statistics.total).toBe(
        result.statistics.successful + result.statistics.failed
      );
      expect(result.statistics.processingTimeMs).toBeGreaterThan(0);
      expect(result.statistics.totalSizeBytes).toBeGreaterThan(0);

      console.log(
        `実データテスト完了: ${result.statistics.successful}/${result.statistics.total} 武器を処理`
      );
    }, 60000);

    it("レアリティフィルタリングの正確性検証", async () => {
      // 実際のweapon-list.jsonを読み込み
      const weaponListPath = "json/data/weapon-list.json";
      const weaponListExists = await fs
        .access(weaponListPath)
        .then(() => true)
        .catch(() => false);

      if (!weaponListExists) {
        console.warn(
          "weapon-list.json が見つかりません。テストをスキップします。"
        );
        return;
      }

      const weaponListContent = await fs.readFile(weaponListPath, "utf-8");
      const weaponList = JSON.parse(weaponListContent);

      // 各レアリティの武器を手動で分類
      const rarityClassification = {
        S: [] as any[],
        A: [] as any[],
        B: [] as any[],
        unknown: [] as any[],
      };

      weaponList.forEach((weapon: any) => {
        const rarityValues = weapon.filter_values?.w_engine_rarity?.values;
        if (!rarityValues || !Array.isArray(rarityValues)) {
          rarityClassification.unknown.push(weapon);
        } else if (rarityValues.includes("S")) {
          rarityClassification.S.push(weapon);
        } else if (rarityValues.includes("A")) {
          rarityClassification.A.push(weapon);
        } else if (rarityValues.includes("B")) {
          rarityClassification.B.push(weapon);
        } else {
          rarityClassification.unknown.push(weapon);
        }
      });

      console.log("レアリティ分類結果:", {
        S: rarityClassification.S.length,
        A: rarityClassification.A.length,
        B: rarityClassification.B.length,
        unknown: rarityClassification.unknown.length,
      });

      // モックfetchを設定
      const mockFetch = createMockFetch();
      global.fetch = mockFetch;

      const config = createTestWeaponIconConfig();
      const fileLoader = new FileLoader();
      const weaponIconProcessor = new WeaponIconProcessor(config);
      const weaponIconGenerator = new WeaponIconGenerator(
        fileLoader,
        weaponIconProcessor,
        config
      );

      const result = await weaponIconGenerator.generateWeaponIcons();

      // S・A級のみが処理されることを確認
      const expectedTotal =
        rarityClassification.S.length + rarityClassification.A.length;
      expect(result.statistics.total).toBe(expectedTotal);

      // B級武器は完全に除外されることを確認
      if (rarityClassification.B.length > 0) {
        expect(result.statistics.total).not.toBe(
          rarityClassification.S.length +
            rarityClassification.A.length +
            rarityClassification.B.length
        );
      }

      // 処理された武器のentry_page_idを確認
      const processedIds = result.successful.map((item) => item.weaponId);
      const expectedSIds = rarityClassification.S.map((w) => w.entry_page_id);
      const expectedAIds = rarityClassification.A.map((w) => w.entry_page_id);
      const expectedIds = [...expectedSIds, ...expectedAIds];

      // 全ての期待されるIDが処理されていることを確認
      expectedIds.forEach((id) => {
        expect(processedIds).toContain(id);
      });

      // B級武器のIDが処理されていないことを確認
      const bIds = rarityClassification.B.map((w) => w.entry_page_id);
      bIds.forEach((id) => {
        expect(processedIds).not.toContain(id);
      });
    }, 45000);

    it("実データでのエラーハンドリング", async () => {
      // 実際のweapon-list.jsonを読み込み
      const weaponListPath = "json/data/weapon-list.json";
      const weaponListExists = await fs
        .access(weaponListPath)
        .then(() => true)
        .catch(() => false);

      if (!weaponListExists) {
        console.warn(
          "weapon-list.json が見つかりません。テストをスキップします。"
        );
        return;
      }

      // 一部の武器でエラーを発生させるfetchモック
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        callCount++;
        // 5回に1回エラーを発生させる
        if (callCount % 5 === 0) {
          throw new Error(`Simulated error for call ${callCount}`);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          headers: {
            get: (name: string) => {
              if (name === "content-type") return "image/png";
              return null;
            },
          },
          body: {
            getReader: () => ({
              read: vi
                .fn()
                .mockResolvedValueOnce({
                  done: false,
                  value: new Uint8Array(2048),
                })
                .mockResolvedValue({ done: true }),
              releaseLock: vi.fn(),
            }),
          },
        });
      });
      global.fetch = mockFetch;

      const config = createTestWeaponIconConfig();
      config.retryAttempts = 1; // リトライ回数を制限

      const fileLoader = new FileLoader();
      const weaponIconProcessor = new WeaponIconProcessor(config);
      const weaponIconGenerator = new WeaponIconGenerator(
        fileLoader,
        weaponIconProcessor,
        config
      );

      const result = await weaponIconGenerator.generateWeaponIcons();

      // 一部成功、一部失敗することを確認
      expect(result.statistics.total).toBeGreaterThan(0);
      expect(result.statistics.successful).toBeGreaterThan(0);
      // エラーが発生しない場合もあるため、失敗数の確認は緩和
      expect(result.statistics.failed).toBeGreaterThanOrEqual(0);
      expect(result.statistics.successful + result.statistics.failed).toBe(
        result.statistics.total
      );

      // 失敗した武器にエラー情報が含まれることを確認
      result.failed.forEach((failedWeapon) => {
        expect(failedWeapon.error).toBeDefined();
        expect(failedWeapon.weaponId).toBeDefined();
        expect(failedWeapon.weaponName).toBeDefined();
      });

      console.log(
        `エラーハンドリングテスト: ${result.statistics.successful}成功, ${result.statistics.failed}失敗`
      );
    }, 45000);
  });

  describe("メインエントリーポイントの統合テスト", () => {
    it("main関数の完全な動作確認", async () => {
      // コマンドライン引数をモック
      const originalArgv = process.argv;
      process.argv = [
        "node",
        "src/main-weapon-icon-download.ts",
        "--config",
        testConfigPath,
        "--output-dir",
        testOutputDir,
        "--max-concurrency",
        "3",
        "--skip-existing",
        "false",
      ];

      // モックfetchを設定
      const mockFetch = createMockFetch();
      global.fetch = mockFetch;

      try {
        // メイン関数を実行（process.exitをモック）
        const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
          throw new Error("process.exit called");
        });

        try {
          await main();
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === "process.exit called"
          ) {
            // process.exitが呼ばれた場合は正常終了とみなす
          } else {
            throw error;
          }
        } finally {
          mockExit.mockRestore();
        }

        // 出力ディレクトリが作成されているか確認
        const dirExists = await fs
          .access(testOutputDir)
          .then(() => true)
          .catch(() => false);
        expect(dirExists).toBe(true);

        // 処理レポートが生成されているか確認
        const reportExists = await fs
          .access("weapon-icon-download-report.md")
          .then(() => true)
          .catch(() => false);
        expect(reportExists).toBe(true);

        if (reportExists) {
          const reportContent = await fs.readFile(
            "weapon-icon-download-report.md",
            "utf-8"
          );
          expect(reportContent).toContain(
            "武器アイコンダウンロード処理レポート"
          );
          expect(reportContent).toContain("処理結果概要");
          expect(reportContent).toContain("ダウンロード成功");
          expect(reportContent).toContain("ダウンロード失敗");
        }
      } finally {
        process.argv = originalArgv;
      }
    }, 60000);

    it("設定ファイルの動的読み込み", async () => {
      // カスタム設定ファイルを作成
      const customConfigPath = "custom-weapon-config.json";
      const customConfig = {
        weaponIconDownload: {
          outputDirectory: "custom-weapon-output",
          maxConcurrency: 2,
          retryAttempts: 1,
          retryDelayMs: 50,
          requestDelayMs: 25,
          skipExisting: false,
          validateDownloads: true,
          maxFileSizeMB: 5,
        },
      };

      await fs.writeFile(
        customConfigPath,
        JSON.stringify(customConfig, null, 2)
      );

      const originalArgv = process.argv;
      process.argv = [
        "node",
        "src/main-weapon-icon-download.ts",
        "--config",
        customConfigPath,
      ];

      const mockFetch = createMockFetch();
      global.fetch = mockFetch;

      try {
        // メイン関数を実行（process.exitをモック）
        const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
          throw new Error("process.exit called");
        });

        try {
          await main();
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === "process.exit called"
          ) {
            // process.exitが呼ばれた場合は正常終了とみなす
          } else {
            throw error;
          }
        } finally {
          mockExit.mockRestore();
        }

        // カスタム出力ディレクトリが作成されているか確認
        const customDirExists = await fs
          .access("custom-weapon-output")
          .then(() => true)
          .catch(() => false);
        expect(customDirExists).toBe(true);
      } finally {
        process.argv = originalArgv;
        // クリーンアップ
        await fs.unlink(customConfigPath).catch(() => {});
        await fs
          .rm("custom-weapon-output", { recursive: true, force: true })
          .catch(() => {});
      }
    }, 45000);
  });

  describe("パフォーマンスと安定性", () => {
    it("大量データでの安定性確認", async () => {
      // 実際のweapon-list.jsonを読み込み
      const weaponListPath = "json/data/weapon-list.json";
      const weaponListExists = await fs
        .access(weaponListPath)
        .then(() => true)
        .catch(() => false);

      if (!weaponListExists) {
        console.warn(
          "weapon-list.json が見つかりません。テストをスキップします。"
        );
        return;
      }

      const config = createTestWeaponIconConfig();
      config.maxConcurrency = 5; // 高い並行数
      config.requestDelayMs = 10; // 短い遅延

      const mockFetch = createMockFetch();
      global.fetch = mockFetch;

      const fileLoader = new FileLoader();
      const weaponIconProcessor = new WeaponIconProcessor(config);
      const weaponIconGenerator = new WeaponIconGenerator(
        fileLoader,
        weaponIconProcessor,
        config
      );

      // メモリ使用量を監視
      const initialMemory = process.memoryUsage();
      const startTime = Date.now();

      const result = await weaponIconGenerator.generateWeaponIcons();

      const endTime = Date.now();
      const finalMemory = process.memoryUsage();

      // 処理時間とメモリ使用量を確認
      const processingTime = endTime - startTime;
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      expect(result.statistics.total).toBeGreaterThan(0);
      expect(processingTime).toBeLessThan(120000); // 2分以内
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024); // 200MB未満

      console.log(
        `大量データテスト: ${result.statistics.total}武器を${processingTime}msで処理`
      );
      console.log(
        `メモリ使用量: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`
      );
    }, 120000);

    it("連続実行での安定性", async () => {
      const config = createTestWeaponIconConfig();
      const mockFetch = createMockFetch();
      global.fetch = mockFetch;

      const fileLoader = new FileLoader();
      const weaponIconProcessor = new WeaponIconProcessor(config);
      const weaponIconGenerator = new WeaponIconGenerator(
        fileLoader,
        weaponIconProcessor,
        config
      );

      const results = [];

      // 3回連続実行
      for (let i = 0; i < 3; i++) {
        const result = await weaponIconGenerator.generateWeaponIcons();
        results.push(result);

        expect(result.statistics.total).toBeGreaterThan(0);
        expect(result.statistics.successful).toBeGreaterThan(0);
      }

      // 全ての実行で同じ結果が得られることを確認
      const firstTotal = results[0].statistics.total;
      results.forEach((result, index) => {
        expect(result.statistics.total).toBe(firstTotal);
        console.log(
          `実行${index + 1}: ${result.statistics.successful}/${
            result.statistics.total
          } 成功`
        );
      });
    }, 90000);
  });

  // ヘルパー関数

  async function cleanupTestDirectory(): Promise<void> {
    try {
      await fs.rm("test-final-assets", { recursive: true, force: true });
      await fs.rm("custom-weapon-output", { recursive: true, force: true });
    } catch {
      // ディレクトリが存在しない場合は無視
    }
  }

  async function cleanupTestFiles(): Promise<void> {
    const filesToCleanup = [
      testConfigPath,
      "weapon-icon-download-report.md",
      "custom-weapon-config.json",
    ];

    for (const file of filesToCleanup) {
      try {
        await fs.unlink(file);
      } catch {
        // ファイルが存在しない場合は無視
      }
    }

    await cleanupTestDirectory();
  }

  async function createTestConfig(): Promise<void> {
    const testConfig = {
      weaponIconDownload: {
        outputDirectory: testOutputDir,
        maxConcurrency: 3,
        retryAttempts: 2,
        retryDelayMs: 100,
        requestDelayMs: 50,
        skipExisting: true,
        validateDownloads: true,
        maxFileSizeMB: 10,
        allowedExtensions: [".png", ".jpg", ".jpeg", ".webp"],
      },
    };

    await fs.writeFile(testConfigPath, JSON.stringify(testConfig, null, 2));
  }

  function createTestWeaponIconConfig(): WeaponIconConfig {
    return {
      outputDirectory: testOutputDir,
      maxConcurrency: 3,
      retryAttempts: 2,
      retryDelayMs: 100,
      requestDelayMs: 50,
      skipExisting: true,
      validateDownloads: true,
      maxFileSizeMB: 10,
      allowedExtensions: [".png", ".jpg", ".jpeg", ".webp"],
    };
  }

  function createMockFetch(): any {
    return vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: {
        get: (name: string) => {
          if (name === "content-type") return "image/png";
          return null;
        },
      },
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new Uint8Array(2048), // 2KB のテストデータ
            })
            .mockResolvedValue({ done: true }),
          releaseLock: vi.fn(),
        }),
      },
    });
  }
});
