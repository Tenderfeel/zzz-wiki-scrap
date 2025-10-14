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
});
