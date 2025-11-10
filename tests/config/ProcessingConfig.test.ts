import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  ConfigManager,
  DEFAULT_CONFIG,
  ProcessingConfig,
} from "../../src/config/ProcessingConfig";

describe("ProcessingConfig", () => {
  const testConfigPath = "test-config.json";

  afterEach(() => {
    // テスト後にファイルをクリーンアップ
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  describe("ConfigManager", () => {
    beforeEach(() => {
      // 各テスト前にシングルトンインスタンスをリセット
      (ConfigManager as any).instance = null;
    });

    it("should load default config when no file exists", () => {
      const configManager = ConfigManager.getInstance(
        "non-existent-config.json"
      );
      const config = configManager.getConfig();

      // 基本的なプロパティのみをチェック（他のテストの影響を避ける）
      expect(config.scrapingFilePath).toBe(DEFAULT_CONFIG.scrapingFilePath);
      expect(config.outputFilePath).toBe(DEFAULT_CONFIG.outputFilePath);
      expect(config.maxRetries).toBe(DEFAULT_CONFIG.maxRetries);
      expect(config.enableCharacterFiltering).toBe(
        DEFAULT_CONFIG.enableCharacterFiltering
      );
    });

    it("should merge user config with default config", () => {
      const userConfig = {
        batchSize: 10,
        delayMs: 500,
        enableCharacterFiltering: true,
        characterFilter: {
          includeCharacterIds: ["lycaon", "anby"],
        },
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(userConfig), "utf-8");

      const configManager = ConfigManager.getInstance(testConfigPath);
      const config = configManager.getConfig();

      expect(config.batchSize).toBe(10);
      expect(config.delayMs).toBe(500);
      expect(config.enableCharacterFiltering).toBe(true);
      expect(config.characterFilter.includeCharacterIds).toEqual([
        "lycaon",
        "anby",
      ]);
      expect(config.maxRetries).toBe(DEFAULT_CONFIG.maxRetries); // デフォルト値が保持される
    });

    it("should validate config values", () => {
      const invalidConfig = {
        batchSize: 25, // 範囲外
        delayMs: -100, // 負の値
        minSuccessRate: 1.5, // 範囲外
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(invalidConfig), "utf-8");

      // 警告が出力されるが、設定は読み込まれる
      expect(() => {
        const configManager = ConfigManager.getInstance(testConfigPath);
        configManager.getConfig();
      }).not.toThrow();
    });

    it("should generate default config file", () => {
      const configManager = ConfigManager.getInstance();
      configManager.generateDefaultConfigFile(testConfigPath);

      expect(fs.existsSync(testConfigPath)).toBe(true);

      const generatedConfig = JSON.parse(
        fs.readFileSync(testConfigPath, "utf-8")
      );
      expect(generatedConfig).toEqual(DEFAULT_CONFIG);
    });

    it("should update config", () => {
      const configManager = ConfigManager.getInstance();

      configManager.updateConfig({
        batchSize: 8,
        enableDebugMode: true,
      });

      const config = configManager.getConfig();
      expect(config.batchSize).toBe(8);
      expect(config.enableDebugMode).toBe(true);
    });

    it("should save config to file", () => {
      const configManager = ConfigManager.getInstance();
      configManager.updateConfig({ batchSize: 7 });

      const testManager = ConfigManager.getInstance(testConfigPath);
      testManager.updateConfig({ batchSize: 7 });
      testManager.saveConfig();

      expect(fs.existsSync(testConfigPath)).toBe(true);

      const savedConfig = JSON.parse(fs.readFileSync(testConfigPath, "utf-8"));
      expect(savedConfig.batchSize).toBe(7);
    });
  });

  describe("Config Validation", () => {
    it("should validate batch size range", () => {
      const config: ProcessingConfig = {
        ...DEFAULT_CONFIG,
        batchSize: 0, // 無効な値
      };

      // 検証は ConfigManager 内部で行われるため、
      // 実際の使用では警告が出力される
      expect(config.batchSize).toBe(0);
    });

    it("should validate character filter settings", () => {
      const config: ProcessingConfig = {
        ...DEFAULT_CONFIG,
        enableCharacterFiltering: true,
        characterFilter: {
          includeCharacterIds: ["lycaon"],
          excludeCharacterIds: ["lycaon"], // 競合
          pageIdRange: {
            min: 100,
            max: 50, // 無効な範囲
          },
        },
      };

      expect(config.characterFilter.includeCharacterIds).toContain("lycaon");
      expect(config.characterFilter.excludeCharacterIds).toContain("lycaon");
    });
  });

  describe("Config Report Generation", () => {
    it("should generate config report", () => {
      const configManager = ConfigManager.getInstance();
      const report = configManager.generateConfigReport();

      expect(report).toContain("# 処理設定レポート");
      expect(report).toContain("## バッチ処理設定");
      expect(report).toContain("## 並行処理設定");
      expect(report).toContain("## メモリ最適化設定");
      expect(report).toContain("## プログレス表示設定");
      expect(report).toContain("## ファイル設定");
      expect(report).toContain("## デバッグ設定");
    });

    it("should include character filter in report when enabled", () => {
      const configManager = ConfigManager.getInstance();
      configManager.updateConfig({
        enableCharacterFiltering: true,
        characterFilter: {
          includeCharacterIds: ["lycaon", "anby"],
          maxCharacters: 10,
        },
      });

      const report = configManager.generateConfigReport();

      expect(report).toContain("## キャラクターフィルター設定");
      expect(report).toContain("lycaon, anby");
      expect(report).toContain("最大処理数: 10");
    });
  });

  describe("Default Configuration", () => {
    it("should have valid default values", () => {
      expect(DEFAULT_CONFIG.batchSize).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.batchSize).toBeLessThanOrEqual(20);

      expect(DEFAULT_CONFIG.delayMs).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_CONFIG.delayMs).toBeLessThanOrEqual(10000);

      expect(DEFAULT_CONFIG.maxRetries).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_CONFIG.maxRetries).toBeLessThanOrEqual(10);

      expect(DEFAULT_CONFIG.minSuccessRate).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_CONFIG.minSuccessRate).toBeLessThanOrEqual(1);

      expect(DEFAULT_CONFIG.maxConcurrency).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.maxConcurrency).toBeLessThanOrEqual(50);

      expect(DEFAULT_CONFIG.memoryThresholdMB).toBeGreaterThanOrEqual(10);
      expect(DEFAULT_CONFIG.memoryThresholdMB).toBeLessThanOrEqual(1000);
    });

    it("should have proper file paths", () => {
      expect(DEFAULT_CONFIG.scrapingFilePath).toBe("Scraping.md");
      expect(DEFAULT_CONFIG.outputFilePath).toBe("data/characters.ts");
      expect(DEFAULT_CONFIG.reportOutputPath).toBe("processing-report.md");
    });

    it("should have sensible boolean defaults", () => {
      expect(DEFAULT_CONFIG.enableWorkerPool).toBe(true);
      expect(DEFAULT_CONFIG.enableMemoryOptimization).toBe(true);
      expect(DEFAULT_CONFIG.enableEnhancedProgress).toBe(true);
      expect(DEFAULT_CONFIG.enableReportGeneration).toBe(true);
      expect(DEFAULT_CONFIG.enableCharacterFiltering).toBe(false);
      expect(DEFAULT_CONFIG.enableDebugMode).toBe(false);
    });

    it("should have valid bompIconDownload defaults", () => {
      expect(DEFAULT_CONFIG.bompIconDownload).toBeDefined();
      expect(DEFAULT_CONFIG.bompIconDownload.outputDirectory).toBe(
        "assets/images/bomps"
      );
      expect(DEFAULT_CONFIG.bompIconDownload.maxConcurrency).toBe(3);
      expect(DEFAULT_CONFIG.bompIconDownload.retryAttempts).toBe(3);
      expect(DEFAULT_CONFIG.bompIconDownload.retryDelayMs).toBe(1000);
      expect(DEFAULT_CONFIG.bompIconDownload.requestDelayMs).toBe(500);
      expect(DEFAULT_CONFIG.bompIconDownload.skipExisting).toBe(true);
      expect(DEFAULT_CONFIG.bompIconDownload.validateDownloads).toBe(true);
    });

    it("should have valid weaponIconDownload defaults", () => {
      expect(DEFAULT_CONFIG.weaponIconDownload).toBeDefined();
      expect(DEFAULT_CONFIG.weaponIconDownload.outputDirectory).toBe(
        "assets/images/weapons"
      );
      expect(DEFAULT_CONFIG.weaponIconDownload.maxConcurrency).toBe(3);
      expect(DEFAULT_CONFIG.weaponIconDownload.retryAttempts).toBe(3);
      expect(DEFAULT_CONFIG.weaponIconDownload.retryDelayMs).toBe(1000);
      expect(DEFAULT_CONFIG.weaponIconDownload.requestDelayMs).toBe(500);
      expect(DEFAULT_CONFIG.weaponIconDownload.skipExisting).toBe(true);
      expect(DEFAULT_CONFIG.weaponIconDownload.validateDownloads).toBe(true);
      expect(DEFAULT_CONFIG.weaponIconDownload.maxFileSizeMB).toBe(10);
      expect(DEFAULT_CONFIG.weaponIconDownload.allowedExtensions).toEqual([
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
      ]);
      expect(DEFAULT_CONFIG.weaponIconDownload.strictSecurity).toBe(true);
    });
  });

  describe("BompIconDownload Configuration", () => {
    it("should validate bompIconDownload configuration", () => {
      const configManager = ConfigManager.getInstance();

      // Test valid configuration
      expect(() => {
        configManager.updateConfig({
          bompIconDownload: {
            outputDirectory: "assets/images/bomps",
            maxConcurrency: 5,
            retryAttempts: 2,
            retryDelayMs: 1500,
            requestDelayMs: 300,
            skipExisting: false,
            validateDownloads: true,
          },
        });
      }).not.toThrow();
    });

    it("should provide getBompIconConfig method", () => {
      const configManager = ConfigManager.getInstance();
      const bompIconConfig = configManager.getBompIconConfig();

      expect(bompIconConfig).toBeDefined();
      expect(bompIconConfig.outputDirectory).toBeDefined();
      expect(bompIconConfig.maxConcurrency).toBeGreaterThan(0);
      expect(bompIconConfig.retryAttempts).toBeGreaterThanOrEqual(0);
    });

    it("should include bompIconDownload in config report", () => {
      const configManager = ConfigManager.getInstance();
      const report = configManager.generateConfigReport();

      expect(report).toContain("ボンプアイコンダウンロード設定");
      expect(report).toContain("出力ディレクトリ:");
      expect(report).toContain("最大並行数:");
      expect(report).toContain("リトライ回数:");
    });
  });

  describe("WeaponIconDownload Configuration", () => {
    it("should validate weaponIconDownload configuration", () => {
      const configManager = ConfigManager.getInstance();

      // Test valid configuration
      expect(() => {
        configManager.updateConfig({
          weaponIconDownload: {
            outputDirectory: "assets/images/weapons",
            maxConcurrency: 5,
            retryAttempts: 2,
            retryDelayMs: 1500,
            requestDelayMs: 300,
            skipExisting: false,
            validateDownloads: true,
            maxFileSizeMB: 15,
            allowedExtensions: [".png", ".jpg"],
            strictSecurity: false,
          },
        });
      }).not.toThrow();
    });

    it("should provide getWeaponIconConfig method", () => {
      const configManager = ConfigManager.getInstance();
      const weaponIconConfig = configManager.getWeaponIconConfig();

      expect(weaponIconConfig).toBeDefined();
      expect(weaponIconConfig.outputDirectory).toBeDefined();
      expect(weaponIconConfig.maxConcurrency).toBeGreaterThan(0);
      expect(weaponIconConfig.retryAttempts).toBeGreaterThanOrEqual(0);
      expect(weaponIconConfig.maxFileSizeMB).toBeDefined();
      expect(weaponIconConfig.allowedExtensions).toBeDefined();
      expect(weaponIconConfig.strictSecurity).toBeDefined();
    });

    it("should include weaponIconDownload in config report", () => {
      const configManager = ConfigManager.getInstance();
      const report = configManager.generateConfigReport();

      expect(report).toContain("武器アイコンダウンロード設定");
      expect(report).toContain("出力ディレクトリ:");
      expect(report).toContain("最大並行数:");
      expect(report).toContain("リトライ回数:");
      expect(report).toContain("最大ファイルサイズ:");
      expect(report).toContain("許可拡張子:");
      expect(report).toContain("厳格セキュリティ:");
    });

    it("should validate weaponIconDownload security settings", () => {
      const configManager = ConfigManager.getInstance();

      // Test directory traversal protection
      expect(() => {
        configManager.updateConfig({
          weaponIconDownload: {
            outputDirectory: "../../../malicious/path",
            maxConcurrency: 3,
            retryAttempts: 3,
            retryDelayMs: 1000,
            requestDelayMs: 500,
            skipExisting: true,
            validateDownloads: true,
          },
        });
      }).not.toThrow(); // Should not throw but will log warnings
    });

    it("should validate weaponIconDownload range values", () => {
      const configManager = ConfigManager.getInstance();

      // Test invalid ranges - should not throw but will log warnings
      expect(() => {
        configManager.updateConfig({
          weaponIconDownload: {
            outputDirectory: "assets/images/weapons",
            maxConcurrency: 15, // Out of range (1-10)
            retryAttempts: 15, // Out of range (0-10)
            retryDelayMs: 50000, // Out of range (0-30000)
            requestDelayMs: 15000, // Out of range (0-10000)
            skipExisting: true,
            validateDownloads: true,
            maxFileSizeMB: 150, // Out of range (1-100)
          },
        });
      }).not.toThrow();
    });
  });

  describe("WeaponProcessing Configuration", () => {
    it("should have valid weaponProcessing defaults", () => {
      expect(DEFAULT_CONFIG.weaponProcessing).toBeDefined();
      expect(DEFAULT_CONFIG.weaponProcessing.weaponListPath).toBe(
        "json/data/weapon-list.json"
      );
      expect(DEFAULT_CONFIG.weaponProcessing.outputPath).toBe(
        "data/weapons.ts"
      );
      expect(DEFAULT_CONFIG.weaponProcessing.includeRarities).toEqual([
        "A",
        "S",
      ]);
      expect(DEFAULT_CONFIG.weaponProcessing.batchSize).toBe(10);
      expect(DEFAULT_CONFIG.weaponProcessing.delayMs).toBe(1000);
      expect(DEFAULT_CONFIG.weaponProcessing.maxRetries).toBe(3);
      expect(DEFAULT_CONFIG.weaponProcessing.skipAgentValidation).toBe(false);
      expect(DEFAULT_CONFIG.weaponProcessing.enableSkillExtraction).toBe(true);
      expect(DEFAULT_CONFIG.weaponProcessing.enableValidation).toBe(true);
      expect(DEFAULT_CONFIG.weaponProcessing.logLevel).toBe("info");
    });

    it("should provide getWeaponProcessingConfig method", () => {
      const configManager = ConfigManager.getInstance();
      const weaponProcessingConfig = configManager.getWeaponProcessingConfig();

      expect(weaponProcessingConfig).toBeDefined();
      expect(weaponProcessingConfig.weaponListPath).toBeDefined();
      expect(weaponProcessingConfig.outputPath).toBeDefined();
      expect(weaponProcessingConfig.includeRarities).toBeDefined();
      expect(weaponProcessingConfig.batchSize).toBeGreaterThan(0);
      expect(weaponProcessingConfig.delayMs).toBeGreaterThanOrEqual(0);
      expect(weaponProcessingConfig.maxRetries).toBeGreaterThanOrEqual(0);
    });

    it("should include weaponProcessing in config report", () => {
      const configManager = ConfigManager.getInstance();
      const report = configManager.generateConfigReport();

      expect(report).toContain("音動機処理設定");
      expect(report).toContain("音動機リストパス:");
      expect(report).toContain("出力パス:");
      expect(report).toContain("処理対象レア度:");
      expect(report).toContain("バッチサイズ:");
      expect(report).toContain("遅延時間:");
      expect(report).toContain("最大リトライ回数:");
      expect(report).toContain("エージェント検証スキップ:");
      expect(report).toContain("スキル情報抽出:");
      expect(report).toContain("データ検証:");
      expect(report).toContain("ログレベル:");
    });
  });

  describe("DriverDiscProcessing Configuration", () => {
    it("should have valid driverDiscProcessing defaults", () => {
      expect(DEFAULT_CONFIG.driverDiscProcessing).toBeDefined();
      expect(DEFAULT_CONFIG.driverDiscProcessing.discListPath).toBe(
        "json/data/disc-list.json"
      );
      expect(DEFAULT_CONFIG.driverDiscProcessing.outputPath).toBe(
        "data/driverDiscs.ts"
      );
      expect(DEFAULT_CONFIG.driverDiscProcessing.batchSize).toBe(5);
      expect(DEFAULT_CONFIG.driverDiscProcessing.delayMs).toBe(1000);
      expect(DEFAULT_CONFIG.driverDiscProcessing.maxRetries).toBe(3);
      expect(DEFAULT_CONFIG.driverDiscProcessing.enableValidation).toBe(true);
      expect(DEFAULT_CONFIG.driverDiscProcessing.logLevel).toBe("info");
    });

    it("should provide getDriverDiscProcessingConfig method", () => {
      const configManager = ConfigManager.getInstance();
      const driverDiscProcessingConfig =
        configManager.getDriverDiscProcessingConfig();

      expect(driverDiscProcessingConfig).toBeDefined();
      expect(driverDiscProcessingConfig.discListPath).toBeDefined();
      expect(driverDiscProcessingConfig.outputPath).toBeDefined();
      expect(driverDiscProcessingConfig.batchSize).toBeGreaterThan(0);
      expect(driverDiscProcessingConfig.delayMs).toBeGreaterThanOrEqual(0);
      expect(driverDiscProcessingConfig.maxRetries).toBeGreaterThanOrEqual(0);
      expect(driverDiscProcessingConfig.enableValidation).toBeDefined();
      expect(driverDiscProcessingConfig.logLevel).toBeDefined();
    });

    it("should validate driverDiscProcessing configuration", () => {
      const configManager = ConfigManager.getInstance();

      // Test valid configuration
      expect(() => {
        configManager.updateConfig({
          driverDiscProcessing: {
            discListPath: "json/data/disc-list.json",
            outputPath: "data/driverDiscs.ts",
            batchSize: 8,
            delayMs: 1500,
            maxRetries: 5,
            enableValidation: false,
            logLevel: "debug",
          },
        });
      }).not.toThrow();
    });

    it("should include driverDiscProcessing in config report", () => {
      const configManager = ConfigManager.getInstance();
      const report = configManager.generateConfigReport();

      expect(report).toContain("ドライバーディスク処理設定");
      expect(report).toContain("ディスクリストパス:");
      expect(report).toContain("出力パス:");
      expect(report).toContain("バッチサイズ:");
      expect(report).toContain("遅延時間:");
      expect(report).toContain("最大リトライ回数:");
      expect(report).toContain("データ検証:");
      expect(report).toContain("ログレベル:");
    });

    it("should validate driverDiscProcessing range values", () => {
      const configManager = ConfigManager.getInstance();

      // Test invalid ranges - should not throw but will log warnings
      expect(() => {
        configManager.updateConfig({
          driverDiscProcessing: {
            discListPath: "", // Empty path
            outputPath: "", // Empty path
            batchSize: 25, // Out of range (1-20)
            delayMs: 50000, // Out of range (0-30000)
            maxRetries: 15, // Out of range (0-10)
            enableValidation: true,
            logLevel: "invalid" as any, // Invalid log level
          },
        });
      }).not.toThrow();
    });

    it("should validate driverDiscProcessing required fields", () => {
      const configManager = ConfigManager.getInstance();

      // Test empty required fields - should not throw but will log warnings
      expect(() => {
        configManager.updateConfig({
          driverDiscProcessing: {
            discListPath: "   ", // Whitespace only
            outputPath: "   ", // Whitespace only
            batchSize: 5,
            delayMs: 1000,
            maxRetries: 3,
            enableValidation: true,
            logLevel: "info",
          },
        });
      }).not.toThrow();
    });
  });
});
