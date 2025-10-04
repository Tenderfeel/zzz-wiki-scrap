#!/usr/bin/env node

import { ConfigManager, ProcessingConfig } from "./config/ProcessingConfig";
import { CharacterFilterUtil } from "./utils/CharacterFilter";
import { EnhancedMainPipeline } from "./main-pipeline-enhanced";
import { CharacterListParser } from "./parsers/CharacterListParser";
import * as fs from "fs";

/**
 * 設定可能なメイン処理
 * コマンドライン引数と設定ファイルに基づいて処理を実行
 */
class ConfigurableMain {
  private configManager: ConfigManager;
  private config: ProcessingConfig;

  constructor(configFilePath?: string) {
    this.configManager = ConfigManager.getInstance(configFilePath);
    this.config = this.configManager.getConfig();
  }

  /**
   * メイン処理を実行
   */
  async run(): Promise<void> {
    try {
      console.log(`🚀 === 設定可能メイン処理開始 ===`);
      console.log(`開始時刻: ${new Date().toLocaleString()}`);

      // 設定概要を表示
      this.configManager.displayConfigSummary();

      // 設定レポートを生成（デバッグモードの場合）
      if (this.config.enableDebugMode) {
        const configReport = this.configManager.generateConfigReport();
        fs.writeFileSync("config-report.md", configReport, "utf-8");
        console.log(`📄 設定レポートを生成: config-report.md`);
      }

      // キャラクターリストを解析
      console.log(`📋 キャラクターリスト解析中...`);
      const parser = new CharacterListParser();
      const allEntries = await parser.parseScrapingFile(
        this.config.scrapingFilePath
      );

      // フィルタリングを適用
      let targetEntries = allEntries;
      if (this.config.enableCharacterFiltering) {
        console.log(`🔍 キャラクターフィルタリング適用中...`);

        // フィルター設定を検証
        const validation = CharacterFilterUtil.validateFilterConfig(
          this.config.characterFilter
        );
        if (!validation.isValid) {
          console.error(`❌ フィルター設定にエラーがあります:`);
          validation.errors.forEach((error) => console.error(`  - ${error}`));
          throw new Error("フィルター設定が無効です");
        }

        if (validation.warnings.length > 0) {
          console.warn(`⚠️  フィルター設定に警告があります:`);
          validation.warnings.forEach((warning) =>
            console.warn(`  - ${warning}`)
          );
        }

        // フィルタリングプレビューを表示
        const preview = CharacterFilterUtil.previewFiltering(
          allEntries,
          this.config.characterFilter
        );
        console.log(`📊 フィルタリングプレビュー:`);
        console.log(
          `  推定処理数: ${preview.estimatedCount}/${allEntries.length}`
        );
        console.log(`  フィルター: ${preview.filterDescription}`);

        // フィルタリングを実行
        const filteringResult = CharacterFilterUtil.filterCharacters(
          allEntries,
          this.config.characterFilter
        );
        targetEntries = filteringResult.filtered;

        // フィルタリングレポートを生成
        if (this.config.enableReportGeneration) {
          const filteringReport =
            CharacterFilterUtil.generateFilteringReport(filteringResult);
          fs.writeFileSync("filtering-report.md", filteringReport, "utf-8");
          console.log(`📄 フィルタリングレポートを生成: filtering-report.md`);
        }
      }

      // 処理対象が空の場合はエラー
      if (targetEntries.length === 0) {
        throw new Error(
          "処理対象のキャラクターがありません。フィルター設定を確認してください。"
        );
      }

      // パイプラインを実行
      console.log(`⚡ パイプライン実行開始...`);
      const pipeline = new EnhancedMainPipeline();

      const result = await pipeline.execute({
        scrapingFilePath: this.config.scrapingFilePath,
        outputFilePath: this.config.outputFilePath,
        batchSize: this.config.batchSize,
        delayMs: this.config.delayMs,
        maxRetries: this.config.maxRetries,
        minSuccessRate: this.config.minSuccessRate,
      });

      // 結果レポートを生成
      if (this.config.enableReportGeneration) {
        await pipeline.generateReport(result, this.config.reportOutputPath);
      }

      console.log(`\n🎉 === 処理完了 ===`);
      console.log(`完了時刻: ${new Date().toLocaleString()}`);
      console.log(`処理されたキャラクター数: ${result.characters.length}`);
      console.log(`出力ファイル: ${result.outputFilePath}`);
      console.log(`総実行時間: ${this.formatDuration(result.executionTime)}`);
      console.log(`==================\n`);
    } catch (error) {
      console.error(`\n❌ === 処理失敗 ===`);
      console.error(
        `エラー: ${error instanceof Error ? error.message : String(error)}`
      );
      console.error(`失敗時刻: ${new Date().toLocaleString()}`);
      console.error(`==================\n`);

      // デバッグモードの場合は詳細なエラー情報を出力
      if (this.config.enableDebugMode && error instanceof Error) {
        console.error(`スタックトレース:`);
        console.error(error.stack);
      }

      process.exit(1);
    }
  }

  /**
   * 時間を人間が読みやすい形式にフォーマット
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}時間${minutes % 60}分${seconds % 60}秒`;
    } else if (minutes > 0) {
      return `${minutes}分${seconds % 60}秒`;
    } else {
      return `${seconds}秒`;
    }
  }
}

/**
 * コマンドライン引数を解析
 */
function parseCommandLineArgs(): {
  configFile?: string;
  generateConfig?: boolean;
  help?: boolean;
} {
  const args = process.argv.slice(2);
  const result: any = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--config":
      case "-c":
        result.configFile = args[++i];
        break;
      case "--generate-config":
      case "-g":
        result.generateConfig = true;
        break;
      case "--help":
      case "-h":
        result.help = true;
        break;
    }
  }

  return result;
}

/**
 * ヘルプメッセージを表示
 */
function showHelp(): void {
  console.log(`
🚀 設定可能全キャラクターデータ生成ツール

使用方法:
  npm run main:configurable [オプション]

オプション:
  -c, --config <file>     設定ファイルのパスを指定 (デフォルト: processing-config.json)
  -g, --generate-config   デフォルト設定ファイルを生成
  -h, --help             このヘルプメッセージを表示

例:
  # デフォルト設定で実行
  npm run main:configurable

  # カスタム設定ファイルを使用
  npm run main:configurable --config my-config.json

  # デフォルト設定ファイルを生成
  npm run main:configurable --generate-config

設定ファイルの例:
{
  "batchSize": 3,
  "delayMs": 500,
  "maxRetries": 5,
  "enableCharacterFiltering": true,
  "characterFilter": {
    "includeCharacterIds": ["lycaon", "anby", "billy"],
    "maxCharacters": 10
  },
  "enableDebugMode": true
}

詳細な設定オプションについては、生成された設定ファイルを参照してください。
`);
}

/**
 * メイン実行部分
 */
async function main(): Promise<void> {
  const args = parseCommandLineArgs();

  // ヘルプ表示
  if (args.help) {
    showHelp();
    return;
  }

  // デフォルト設定ファイル生成
  if (args.generateConfig) {
    const configManager = ConfigManager.getInstance();
    configManager.generateDefaultConfigFile(
      args.configFile || "processing-config.json"
    );
    return;
  }

  // メイン処理実行
  const configurableMain = new ConfigurableMain(args.configFile);
  await configurableMain.run();
}

// スクリプトが直接実行された場合のみメイン処理を実行
if (require.main === module) {
  main().catch((error) => {
    console.error(`予期しないエラーが発生しました: ${error}`);
    process.exit(1);
  });
}

export { ConfigurableMain };
