import * as fs from "fs";
import * as path from "path";
import { BompIconConfig, WeaponProcessingConfig } from "../types/processing";

/**
 * 処理設定インターフェース
 */
export interface ProcessingConfig {
  // バッチ処理設定
  batchSize: number;
  delayMs: number;
  maxRetries: number;
  minSuccessRate: number;

  // 並行処理設定
  maxConcurrency: number;
  enableWorkerPool: boolean;

  // メモリ最適化設定
  enableMemoryOptimization: boolean;
  memoryThresholdMB: number;
  gcInterval: number;

  // プログレス表示設定
  enableEnhancedProgress: boolean;
  progressUpdateInterval: number;
  showMemoryUsage: boolean;
  showPerformanceMetrics: boolean;
  showDetailedTiming: boolean;
  progressBarWidth: number;
  useColors: boolean;

  // ファイル設定
  scrapingFilePath: string;
  outputFilePath: string;
  enableReportGeneration: boolean;
  reportOutputPath: string;

  // フィルタリング設定
  enableCharacterFiltering: boolean;
  characterFilter: CharacterFilter;

  // デバッグ設定
  enableDebugMode: boolean;
  logLevel: "error" | "warn" | "info" | "debug";
  enableDetailedLogging: boolean;

  // ボンプアイコンダウンロード設定
  bompIconDownload: BompIconConfig;

  // 音動機処理設定
  weaponProcessing: WeaponProcessingConfig;
}

/**
 * キャラクターフィルター設定
 */
export interface CharacterFilter {
  // 包含フィルター（指定されたキャラクターのみ処理）
  includeCharacterIds?: string[];

  // 除外フィルター（指定されたキャラクターを除外）
  excludeCharacterIds?: string[];

  // ページIDによるフィルター
  includePageIds?: number[];
  excludePageIds?: number[];

  // 範囲フィルター
  pageIdRange?: {
    min: number;
    max: number;
  };

  // 最大処理数制限
  maxCharacters?: number;

  // ランダムサンプリング
  randomSample?: {
    enabled: boolean;
    count: number;
    seed?: number;
  };
}

/**
 * デフォルト設定
 */
export const DEFAULT_CONFIG: ProcessingConfig = {
  // バッチ処理設定
  batchSize: 5,
  delayMs: 200,
  maxRetries: 3,
  minSuccessRate: 0.8,

  // 並行処理設定
  maxConcurrency: 5,
  enableWorkerPool: true,

  // メモリ最適化設定
  enableMemoryOptimization: true,
  memoryThresholdMB: 100,
  gcInterval: 10,

  // プログレス表示設定
  enableEnhancedProgress: true,
  progressUpdateInterval: 1000,
  showMemoryUsage: true,
  showPerformanceMetrics: true,
  showDetailedTiming: true,
  progressBarWidth: 40,
  useColors: true,

  // ファイル設定
  scrapingFilePath: "Scraping.md",
  outputFilePath: "data/characters.ts",
  enableReportGeneration: true,
  reportOutputPath: "processing-report.md",

  // フィルタリング設定
  enableCharacterFiltering: false,
  characterFilter: {},

  // デバッグ設定
  enableDebugMode: false,
  logLevel: "info",
  enableDetailedLogging: false,

  // ボンプアイコンダウンロード設定
  bompIconDownload: {
    outputDirectory: "assets/images/bomps",
    maxConcurrency: 3,
    retryAttempts: 3,
    retryDelayMs: 1000,
    requestDelayMs: 500,
    skipExisting: true,
    validateDownloads: true,
    maxFileSizeMB: 10,
    allowedExtensions: [".png", ".jpg", ".jpeg", ".webp"],
    strictSecurity: true,
  },

  // 音動機処理設定
  weaponProcessing: {
    weaponListPath: "json/data/weapon-list.json",
    outputPath: "data/weapons.ts",
    includeRarities: ["A", "S"],
    batchSize: 10,
    delayMs: 1000,
    maxRetries: 3,
    skipAgentValidation: false,
    enableSkillExtraction: true,
    enableValidation: true,
    logLevel: "info",
  },
};

/**
 * 設定管理クラス
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: ProcessingConfig;
  private configFilePath: string;

  private constructor(configFilePath: string = "processing-config.json") {
    this.configFilePath = configFilePath;
    this.config = this.loadConfig();
  }

  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(configFilePath?: string): ConfigManager {
    if (
      !ConfigManager.instance ||
      (configFilePath &&
        ConfigManager.instance.configFilePath !== configFilePath)
    ) {
      ConfigManager.instance = new ConfigManager(configFilePath);
    }
    return ConfigManager.instance;
  }

  /**
   * 設定を読み込み
   */
  private loadConfig(): ProcessingConfig {
    try {
      if (fs.existsSync(this.configFilePath)) {
        console.log(`📋 設定ファイルを読み込み中: ${this.configFilePath}`);
        const configData = fs.readFileSync(this.configFilePath, "utf-8");
        const userConfig = JSON.parse(configData) as Partial<ProcessingConfig>;

        // デフォルト設定とマージ
        const mergedConfig = this.mergeConfig(DEFAULT_CONFIG, userConfig);

        console.log(`✅ 設定ファイル読み込み完了`);
        this.validateConfig(mergedConfig);

        return mergedConfig;
      } else {
        console.log(`⚠️  設定ファイルが見つかりません: ${this.configFilePath}`);
        console.log(`📋 デフォルト設定を使用します`);
        return { ...DEFAULT_CONFIG };
      }
    } catch (error) {
      console.error(`❌ 設定ファイルの読み込みに失敗: ${error}`);
      console.log(`📋 デフォルト設定を使用します`);
      return { ...DEFAULT_CONFIG };
    }
  }

  /**
   * 設定をマージ
   */
  private mergeConfig(
    defaultConfig: ProcessingConfig,
    userConfig: Partial<ProcessingConfig>
  ): ProcessingConfig {
    const merged = { ...defaultConfig };

    // 基本プロパティをマージ
    Object.keys(userConfig).forEach((key) => {
      const typedKey = key as keyof ProcessingConfig;
      if (userConfig[typedKey] !== undefined) {
        if (
          typeof userConfig[typedKey] === "object" &&
          !Array.isArray(userConfig[typedKey])
        ) {
          // オブジェクトの場合は深いマージ
          (merged[typedKey] as any) = {
            ...(defaultConfig[typedKey] as any),
            ...(userConfig[typedKey] as any),
          };
        } else {
          // プリミティブ値の場合は直接代入
          (merged[typedKey] as any) = userConfig[typedKey];
        }
      }
    });

    return merged;
  }

  /**
   * 設定を検証
   */
  private validateConfig(config: ProcessingConfig): void {
    const errors: string[] = [];

    // 数値の範囲チェック
    if (config.batchSize < 1 || config.batchSize > 20) {
      errors.push("batchSize は 1-20 の範囲内である必要があります");
    }

    if (config.delayMs < 0 || config.delayMs > 10000) {
      errors.push("delayMs は 0-10000 の範囲内である必要があります");
    }

    if (config.maxRetries < 0 || config.maxRetries > 10) {
      errors.push("maxRetries は 0-10 の範囲内である必要があります");
    }

    if (config.minSuccessRate < 0 || config.minSuccessRate > 1) {
      errors.push("minSuccessRate は 0-1 の範囲内である必要があります");
    }

    if (config.maxConcurrency < 1 || config.maxConcurrency > 50) {
      errors.push("maxConcurrency は 1-50 の範囲内である必要があります");
    }

    if (config.memoryThresholdMB < 10 || config.memoryThresholdMB > 1000) {
      errors.push("memoryThresholdMB は 10-1000 の範囲内である必要があります");
    }

    // ファイルパスの存在チェック
    if (config.scrapingFilePath && !fs.existsSync(config.scrapingFilePath)) {
      errors.push(
        `scrapingFilePath で指定されたファイルが存在しません: ${config.scrapingFilePath}`
      );
    }

    // フィルター設定の検証
    if (config.enableCharacterFiltering) {
      this.validateCharacterFilter(config.characterFilter, errors);
    }

    // ボンプアイコンダウンロード設定の検証
    this.validateBompIconConfig(config.bompIconDownload, errors);

    // 音動機処理設定の検証
    this.validateWeaponProcessingConfig(config.weaponProcessing, errors);

    if (errors.length > 0) {
      console.warn(`⚠️  設定に問題があります:`);
      errors.forEach((error) => console.warn(`  - ${error}`));
      console.warn(`設定は修正されずに使用されます。問題を修正してください。`);
    }
  }

  /**
   * キャラクターフィルターを検証
   */
  private validateCharacterFilter(
    filter: CharacterFilter,
    errors: string[]
  ): void {
    if (filter.includeCharacterIds && filter.includeCharacterIds.length === 0) {
      errors.push("includeCharacterIds が空の配列です");
    }

    if (filter.excludeCharacterIds && filter.excludeCharacterIds.length === 0) {
      errors.push("excludeCharacterIds が空の配列です");
    }

    if (filter.pageIdRange) {
      if (filter.pageIdRange.min >= filter.pageIdRange.max) {
        errors.push(
          "pageIdRange.min は pageIdRange.max より小さい必要があります"
        );
      }
      if (filter.pageIdRange.min < 1 || filter.pageIdRange.max > 1000) {
        errors.push("pageIdRange は 1-1000 の範囲内である必要があります");
      }
    }

    if (filter.maxCharacters && filter.maxCharacters < 1) {
      errors.push("maxCharacters は 1 以上である必要があります");
    }

    if (filter.randomSample) {
      if (filter.randomSample.count < 1) {
        errors.push("randomSample.count は 1 以上である必要があります");
      }
    }
  }

  /**
   * 音動機処理設定を検証
   */
  private validateWeaponProcessingConfig(
    config: WeaponProcessingConfig,
    errors: string[]
  ): void {
    // weaponListPath の検証
    if (!config.weaponListPath || config.weaponListPath.trim() === "") {
      errors.push("weaponProcessing.weaponListPath は空にできません");
    }

    // outputPath の検証
    if (!config.outputPath || config.outputPath.trim() === "") {
      errors.push("weaponProcessing.outputPath は空にできません");
    }

    // includeRarities の検証
    if (!config.includeRarities || config.includeRarities.length === 0) {
      errors.push("weaponProcessing.includeRarities は空にできません");
    } else {
      const validRarities = ["A", "S"];
      const invalidRarities = config.includeRarities.filter(
        (rarity) => !validRarities.includes(rarity)
      );
      if (invalidRarities.length > 0) {
        errors.push(
          `weaponProcessing.includeRarities に無効なレア度が含まれています: ${invalidRarities.join(
            ", "
          )}`
        );
      }
    }

    // batchSize の検証
    if (config.batchSize < 1 || config.batchSize > 50) {
      errors.push(
        "weaponProcessing.batchSize は 1-50 の範囲内である必要があります"
      );
    }

    // delayMs の検証
    if (config.delayMs < 0 || config.delayMs > 30000) {
      errors.push(
        "weaponProcessing.delayMs は 0-30000 の範囲内である必要があります"
      );
    }

    // maxRetries の検証
    if (config.maxRetries < 0 || config.maxRetries > 10) {
      errors.push(
        "weaponProcessing.maxRetries は 0-10 の範囲内である必要があります"
      );
    }

    // logLevel の検証
    const validLogLevels = ["error", "warn", "info", "debug"];
    if (!validLogLevels.includes(config.logLevel)) {
      errors.push(
        `weaponProcessing.logLevel は次のいずれかである必要があります: ${validLogLevels.join(
          ", "
        )}`
      );
    }
  }

  /**
   * ボンプアイコンダウンロード設定を検証
   */
  private validateBompIconConfig(
    config: BompIconConfig,
    errors: string[]
  ): void {
    // outputDirectory の検証
    if (!config.outputDirectory || config.outputDirectory.trim() === "") {
      errors.push("bompIconDownload.outputDirectory は空にできません");
    }

    // maxConcurrency の検証
    if (config.maxConcurrency < 1 || config.maxConcurrency > 10) {
      errors.push(
        "bompIconDownload.maxConcurrency は 1-10 の範囲内である必要があります"
      );
    }

    // retryAttempts の検証
    if (config.retryAttempts < 0 || config.retryAttempts > 10) {
      errors.push(
        "bompIconDownload.retryAttempts は 0-10 の範囲内である必要があります"
      );
    }

    // retryDelayMs の検証
    if (config.retryDelayMs < 0 || config.retryDelayMs > 30000) {
      errors.push(
        "bompIconDownload.retryDelayMs は 0-30000 の範囲内である必要があります"
      );
    }

    // requestDelayMs の検証
    if (config.requestDelayMs < 0 || config.requestDelayMs > 10000) {
      errors.push(
        "bompIconDownload.requestDelayMs は 0-10000 の範囲内である必要があります"
      );
    }

    // パス安全性の検証
    if (config.outputDirectory.includes("..")) {
      errors.push(
        "bompIconDownload.outputDirectory にディレクトリトラバーサル文字列が含まれています"
      );
    }

    // maxFileSizeMB の検証
    if (
      config.maxFileSizeMB &&
      (config.maxFileSizeMB < 1 || config.maxFileSizeMB > 100)
    ) {
      errors.push(
        "bompIconDownload.maxFileSizeMB は 1-100 の範囲内である必要があります"
      );
    }

    // allowedExtensions の検証
    if (config.allowedExtensions) {
      const validExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
      const invalidExtensions = config.allowedExtensions.filter(
        (ext) => !validExtensions.includes(ext.toLowerCase())
      );
      if (invalidExtensions.length > 0) {
        errors.push(
          `bompIconDownload.allowedExtensions に無効な拡張子が含まれています: ${invalidExtensions.join(
            ", "
          )}`
        );
      }
    }
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): ProcessingConfig {
    return { ...this.config };
  }

  /**
   * ボンプアイコンダウンロード設定を取得
   */
  getBompIconConfig(): BompIconConfig {
    return { ...this.config.bompIconDownload };
  }

  /**
   * 音動機処理設定を取得
   */
  getWeaponProcessingConfig(): WeaponProcessingConfig {
    return { ...this.config.weaponProcessing };
  }

  /**
   * 設定を更新
   */
  updateConfig(updates: Partial<ProcessingConfig>): void {
    this.config = this.mergeConfig(this.config, updates);
    this.validateConfig(this.config);
  }

  /**
   * 設定をファイルに保存
   */
  saveConfig(): void {
    try {
      const configJson = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configFilePath, configJson, "utf-8");
      console.log(`✅ 設定ファイルを保存: ${this.configFilePath}`);
    } catch (error) {
      console.error(`❌ 設定ファイルの保存に失敗: ${error}`);
    }
  }

  /**
   * デフォルト設定ファイルを生成
   */
  generateDefaultConfigFile(outputPath?: string): void {
    const filePath = outputPath || "processing-config.json";

    try {
      const configJson = JSON.stringify(DEFAULT_CONFIG, null, 2);
      fs.writeFileSync(filePath, configJson, "utf-8");
      console.log(`✅ デフォルト設定ファイルを生成: ${filePath}`);
      console.log(`📝 設定ファイルを編集して、処理をカスタマイズできます`);
    } catch (error) {
      console.error(`❌ デフォルト設定ファイルの生成に失敗: ${error}`);
    }
  }

  /**
   * 設定の概要を表示
   */
  displayConfigSummary(): void {
    if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
      console.log(`\n⚙️  === 処理設定概要 ===`);
      console.log(`バッチサイズ: ${this.config.batchSize}`);
      console.log(`遅延時間: ${this.config.delayMs}ms`);
      console.log(`最大リトライ回数: ${this.config.maxRetries}`);
      console.log(
        `最小成功率: ${Math.round(this.config.minSuccessRate * 100)}%`
      );
      console.log(`並行度: ${this.config.maxConcurrency}`);
      console.log(
        `メモリ最適化: ${
          this.config.enableMemoryOptimization ? "有効" : "無効"
        }`
      );
      console.log(
        `拡張プログレス: ${
          this.config.enableEnhancedProgress ? "有効" : "無効"
        }`
      );
      console.log(
        `キャラクターフィルタリング: ${
          this.config.enableCharacterFiltering ? "有効" : "無効"
        }`
      );
      console.log(
        `デバッグモード: ${this.config.enableDebugMode ? "有効" : "無効"}`
      );
      console.log(`入力ファイル: ${this.config.scrapingFilePath}`);
      console.log(`出力ファイル: ${this.config.outputFilePath}`);
      console.log(
        `ボンプアイコン出力: ${this.config.bompIconDownload.outputDirectory}`
      );
      console.log(
        `音動機リスト: ${this.config.weaponProcessing.weaponListPath}`
      );
      console.log(`音動機出力: ${this.config.weaponProcessing.outputPath}`);
      console.log(`=======================\n`);
    }
  }

  /**
   * 設定の詳細レポートを生成
   */
  generateConfigReport(): string {
    let report = `# 処理設定レポート\n\n`;
    report += `生成日時: ${new Date().toLocaleString()}\n`;
    report += `設定ファイル: ${this.configFilePath}\n\n`;

    report += `## バッチ処理設定\n`;
    report += `- バッチサイズ: ${this.config.batchSize}\n`;
    report += `- 遅延時間: ${this.config.delayMs}ms\n`;
    report += `- 最大リトライ回数: ${this.config.maxRetries}\n`;
    report += `- 最小成功率: ${Math.round(
      this.config.minSuccessRate * 100
    )}%\n\n`;

    report += `## 並行処理設定\n`;
    report += `- 最大並行度: ${this.config.maxConcurrency}\n`;
    report += `- ワーカープール: ${
      this.config.enableWorkerPool ? "有効" : "無効"
    }\n\n`;

    report += `## メモリ最適化設定\n`;
    report += `- メモリ最適化: ${
      this.config.enableMemoryOptimization ? "有効" : "無効"
    }\n`;
    report += `- メモリ閾値: ${this.config.memoryThresholdMB}MB\n`;
    report += `- GC間隔: ${this.config.gcInterval}回\n\n`;

    report += `## プログレス表示設定\n`;
    report += `- 拡張プログレス: ${
      this.config.enableEnhancedProgress ? "有効" : "無効"
    }\n`;
    report += `- 更新間隔: ${this.config.progressUpdateInterval}ms\n`;
    report += `- メモリ使用量表示: ${
      this.config.showMemoryUsage ? "有効" : "無効"
    }\n`;
    report += `- パフォーマンス表示: ${
      this.config.showPerformanceMetrics ? "有効" : "無効"
    }\n`;
    report += `- 詳細タイミング: ${
      this.config.showDetailedTiming ? "有効" : "無効"
    }\n\n`;

    report += `## ファイル設定\n`;
    report += `- 入力ファイル: ${this.config.scrapingFilePath}\n`;
    report += `- 出力ファイル: ${this.config.outputFilePath}\n`;
    report += `- レポート生成: ${
      this.config.enableReportGeneration ? "有効" : "無効"
    }\n`;
    report += `- レポート出力先: ${this.config.reportOutputPath}\n\n`;

    if (this.config.enableCharacterFiltering) {
      report += `## キャラクターフィルター設定\n`;
      const filter = this.config.characterFilter;

      if (filter.includeCharacterIds) {
        report += `- 包含キャラクター: ${filter.includeCharacterIds.join(
          ", "
        )}\n`;
      }
      if (filter.excludeCharacterIds) {
        report += `- 除外キャラクター: ${filter.excludeCharacterIds.join(
          ", "
        )}\n`;
      }
      if (filter.pageIdRange) {
        report += `- ページID範囲: ${filter.pageIdRange.min}-${filter.pageIdRange.max}\n`;
      }
      if (filter.maxCharacters) {
        report += `- 最大処理数: ${filter.maxCharacters}\n`;
      }
      if (filter.randomSample?.enabled) {
        report += `- ランダムサンプリング: ${filter.randomSample.count}件\n`;
      }
      report += `\n`;
    }

    report += `## デバッグ設定\n`;
    report += `- デバッグモード: ${
      this.config.enableDebugMode ? "有効" : "無効"
    }\n`;
    report += `- ログレベル: ${this.config.logLevel}\n`;
    report += `- 詳細ログ: ${
      this.config.enableDetailedLogging ? "有効" : "無効"
    }\n\n`;

    report += `## ボンプアイコンダウンロード設定\n`;
    report += `- 出力ディレクトリ: ${this.config.bompIconDownload.outputDirectory}\n`;
    report += `- 最大並行数: ${this.config.bompIconDownload.maxConcurrency}\n`;
    report += `- リトライ回数: ${this.config.bompIconDownload.retryAttempts}\n`;
    report += `- リトライ遅延: ${this.config.bompIconDownload.retryDelayMs}ms\n`;
    report += `- リクエスト遅延: ${this.config.bompIconDownload.requestDelayMs}ms\n`;
    report += `- 既存ファイルスキップ: ${
      this.config.bompIconDownload.skipExisting ? "有効" : "無効"
    }\n`;
    report += `- ダウンロード検証: ${
      this.config.bompIconDownload.validateDownloads ? "有効" : "無効"
    }\n`;
    report += `- 最大ファイルサイズ: ${
      this.config.bompIconDownload.maxFileSizeMB || 10
    }MB\n`;
    report += `- 許可拡張子: ${(
      this.config.bompIconDownload.allowedExtensions || [
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
      ]
    ).join(", ")}\n`;
    report += `- 厳格セキュリティ: ${
      this.config.bompIconDownload.strictSecurity !== false ? "有効" : "無効"
    }\n\n`;

    report += `## 音動機処理設定\n`;
    report += `- 音動機リストパス: ${this.config.weaponProcessing.weaponListPath}\n`;
    report += `- 出力パス: ${this.config.weaponProcessing.outputPath}\n`;
    report += `- 処理対象レア度: ${this.config.weaponProcessing.includeRarities.join(
      ", "
    )}\n`;
    report += `- バッチサイズ: ${this.config.weaponProcessing.batchSize}\n`;
    report += `- 遅延時間: ${this.config.weaponProcessing.delayMs}ms\n`;
    report += `- 最大リトライ回数: ${this.config.weaponProcessing.maxRetries}\n`;
    report += `- エージェント検証スキップ: ${
      this.config.weaponProcessing.skipAgentValidation ? "有効" : "無効"
    }\n`;
    report += `- スキル情報抽出: ${
      this.config.weaponProcessing.enableSkillExtraction ? "有効" : "無効"
    }\n`;
    report += `- データ検証: ${
      this.config.weaponProcessing.enableValidation ? "有効" : "無効"
    }\n`;
    report += `- ログレベル: ${this.config.weaponProcessing.logLevel}\n`;

    return report;
  }
}
