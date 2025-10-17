#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import { BompBatchProcessor } from "./processors/BompBatchProcessor";
import { BompGenerator } from "./generators/BompGenerator";
import {
  BatchProcessingOptions,
  BompProcessingResult,
} from "./types/processing";
import { logger } from "./utils/Logger";

/**
 * ボンプ処理設定
 */
interface BompProcessingConfig extends BatchProcessingOptions {
  scrapingFilePath?: string;
  outputFilePath?: string;
  enableReportGeneration?: boolean;
  reportOutputPath?: string;
  minSuccessRate?: number;
  enableValidation?: boolean;
  logLevel?: string;
  enableDebugMode?: boolean;
}

/**
 * デフォルト設定
 */
const DEFAULT_CONFIG: Required<BompProcessingConfig> = {
  batchSize: 5,
  delayMs: 500,
  maxRetries: 3,
  scrapingFilePath: "Scraping.md",
  outputFilePath: "data/bomps.ts",
  enableReportGeneration: true,
  reportOutputPath: "bomp-processing-report.md",
  minSuccessRate: 0.8,
  enableValidation: true,
  logLevel: "info",
  enableDebugMode: false,
};

/**
 * 設定ファイルを読み込む
 */
function loadConfig(configPath?: string): BompProcessingConfig {
  // 優先順位: 引数 > グローバル変数 > デフォルト
  const finalConfigPath =
    configPath || (global as any).configPath || "bomp-processing-config.json";
  try {
    if (fs.existsSync(finalConfigPath)) {
      const configContent = fs.readFileSync(finalConfigPath, "utf-8");
      const config = JSON.parse(configContent);

      // ボンプ固有の設定を抽出（存在する場合）
      const bompConfig = config.bomp || config;

      logger.info("設定ファイルを読み込みました", {
        configPath: finalConfigPath,
        loadedConfig: bompConfig,
      });

      return { ...DEFAULT_CONFIG, ...bompConfig };
    } else {
      logger.warn("設定ファイルが見つかりません。デフォルト設定を使用します", {
        configPath: finalConfigPath,
      });
      return DEFAULT_CONFIG;
    }
  } catch (error) {
    logger.error(
      "設定ファイルの読み込みに失敗しました。デフォルト設定を使用します",
      {
        configPath: finalConfigPath,
        error: error instanceof Error ? error.message : String(error),
      }
    );
    return DEFAULT_CONFIG;
  }
}

/**
 * 出力ディレクトリを確保する
 */
function ensureOutputDirectory(outputPath: string): void {
  const outputDir = path.dirname(outputPath);

  if (!fs.existsSync(outputDir)) {
    logger.info("出力ディレクトリを作成します", { outputDir });
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

/**
 * 処理結果を検証する
 */
function validateResults(
  result: BompProcessingResult,
  outputPath: string,
  config: BompProcessingConfig
): void {
  logger.info("処理結果を検証中...");

  // 成功率の検証
  if (config.enableValidation && config.minSuccessRate) {
    const batchProcessor = new BompBatchProcessor();
    batchProcessor.validateProcessingResult(result, config.minSuccessRate);
  }

  // 出力ファイルの存在確認
  if (!fs.existsSync(outputPath)) {
    throw new Error(`出力ファイルが生成されませんでした: ${outputPath}`);
  }

  // 出力ファイルのサイズ確認
  const stats = fs.statSync(outputPath);
  if (stats.size === 0) {
    throw new Error(`出力ファイルが空です: ${outputPath}`);
  }

  logger.info("処理結果検証完了", {
    outputPath,
    fileSize: stats.size,
    successfulBomps: result.successful.length,
    failedBomps: result.failed.length,
  });
}

/**
 * 処理レポートを生成する
 */
function generateReport(
  result: BompProcessingResult,
  config: BompProcessingConfig
): void {
  if (!config.enableReportGeneration || !config.reportOutputPath) {
    return;
  }

  try {
    logger.info("処理レポートを生成中...", {
      reportPath: config.reportOutputPath,
    });

    const batchProcessor = new BompBatchProcessor();
    const report = batchProcessor.generateProcessingReport(result);

    // レポートファイルに書き込み
    fs.writeFileSync(config.reportOutputPath, report, "utf-8");

    logger.info("処理レポートを生成しました", {
      reportPath: config.reportOutputPath,
    });
  } catch (error) {
    logger.error("処理レポートの生成に失敗しました", {
      reportPath: config.reportOutputPath,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * メイン実行関数
 * 全ボンプデータ生成の統合実行機能
 * 設定ファイルからの処理パラメータ読み込み
 * 実行結果の検証と出力ファイル確認
 * 要件: 4.1
 */
async function main(): Promise<void> {
  const startTime = new Date();

  try {
    console.log("🚀 === ボンプデータ生成開始 ===");
    console.log(`開始時刻: ${startTime.toLocaleString()}`);
    console.log("================================\n");

    // 設定を読み込み
    const config = loadConfig();

    // デバッグモードの設定
    if (config.enableDebugMode) {
      process.env.DEBUG = "true";
      logger.info("デバッグモードが有効になりました");
    }

    // 出力ディレクトリを確保
    ensureOutputDirectory(config.outputFilePath!);

    // バッチプロセッサーを初期化
    const batchProcessor = new BompBatchProcessor();

    // プログレスコールバックを設定
    batchProcessor.setProgressCallback((progress) => {
      // プログレス情報をログに出力（詳細ログが有効な場合のみ）
      if (config.enableDebugMode) {
        logger.debug("処理進捗更新", progress);
      }
    });

    // 全ボンプを処理
    logger.info("ボンプバッチ処理を開始します", {
      scrapingFilePath: config.scrapingFilePath,
      batchSize: config.batchSize,
      delayMs: config.delayMs,
      maxRetries: config.maxRetries,
    });

    const result = await batchProcessor.processAllBomps(
      config.scrapingFilePath,
      {
        batchSize: config.batchSize,
        delayMs: config.delayMs,
        maxRetries: config.maxRetries,
      }
    );

    // ボンプファイルを出力
    if (result.successful.length > 0) {
      logger.info("ボンプファイルを出力中...", {
        outputPath: config.outputFilePath,
        bompCount: result.successful.length,
      });

      const bompGenerator = new BompGenerator();
      bompGenerator.outputBompFile(result.successful, config.outputFilePath!);

      logger.info("ボンプファイル出力完了", {
        outputPath: config.outputFilePath,
      });
    } else {
      logger.warn("成功したボンプがないため、ファイル出力をスキップします");
    }

    // 処理結果を検証
    if (config.enableValidation) {
      validateResults(result, config.outputFilePath!, config);
    }

    // 処理レポートを生成
    generateReport(result, config);

    const endTime = new Date();
    const processingTime = endTime.getTime() - startTime.getTime();

    console.log("\n🎉 === ボンプデータ生成完了 ===");
    console.log(`終了時刻: ${endTime.toLocaleString()}`);
    console.log(`総処理時間: ${formatDuration(processingTime)}`);
    console.log(`成功: ${result.successful.length}`);
    console.log(`失敗: ${result.failed.length}`);
    console.log(
      `成功率: ${Math.round(
        (result.successful.length / result.statistics.total) * 100
      )}%`
    );
    console.log("================================\n");

    // 失敗がある場合は警告を表示
    if (result.failed.length > 0) {
      console.warn(
        `⚠️  ${result.failed.length}個のボンプの処理に失敗しました。詳細はログを確認してください。`
      );

      // 失敗したボンプのリストを表示
      console.log("\n失敗したボンプ:");
      result.failed.forEach((failed, index) => {
        console.log(`  ${index + 1}. ${failed.bompId}: ${failed.error}`);
      });
    }

    // 成功時の終了コード
    process.exit(0);
  } catch (error) {
    const endTime = new Date();
    const processingTime = endTime.getTime() - startTime.getTime();

    console.error("\n❌ === ボンプデータ生成失敗 ===");
    console.error(`終了時刻: ${endTime.toLocaleString()}`);
    console.error(`処理時間: ${formatDuration(processingTime)}`);
    console.error(
      `エラー: ${error instanceof Error ? error.message : String(error)}`
    );
    console.error("================================\n");

    logger.error("ボンプデータ生成中に致命的なエラーが発生しました", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // 失敗時の終了コード
    process.exit(1);
  }
}

/**
 * 時間をフォーマット
 */
function formatDuration(ms: number): string {
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

/**
 * コマンドライン引数の処理
 */
function parseCommandLineArgs(): { configPath?: string; help?: boolean } {
  const args = process.argv.slice(2);
  const result: { configPath?: string; help?: boolean } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--config" || arg === "-c") {
      result.configPath = args[i + 1];
      i++; // 次の引数をスキップ
    }
  }

  return result;
}

/**
 * ヘルプメッセージを表示
 */
function showHelp(): void {
  console.log(`
ボンプデータ生成スクリプト

使用方法:
  npm run generate:bomps [オプション]
  node dist/main-bomp-generation.js [オプション]

オプション:
  --config, -c <path>   設定ファイルのパス (デフォルト: processing-config.json)
  --help, -h           このヘルプメッセージを表示

設定ファイル例:
{
  "bomp": {
    "batchSize": 5,
    "delayMs": 500,
    "maxRetries": 3,
    "scrapingFilePath": "Scraping.md",
    "outputFilePath": "data/bomps.ts",
    "enableReportGeneration": true,
    "reportOutputPath": "bomp-processing-report.md",
    "minSuccessRate": 0.8,
    "enableValidation": true,
    "enableDebugMode": false
  }
}

例:
  npm run generate:bomps
  npm run generate:bomps -- --config custom-config.json
  npm run generate:bomps -- --help
`);
}

// スクリプトが直接実行された場合のみメイン関数を実行
if (require.main === module) {
  const args = parseCommandLineArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  // 設定ファイルパスが指定された場合は使用
  if (args.configPath) {
    // グローバル変数として設定（loadConfig関数で使用）
    (global as any).configPath = args.configPath;
  }

  main().catch((error) => {
    console.error("予期しないエラーが発生しました:", error);
    process.exit(1);
  });
}

export { main, loadConfig };
export type { BompProcessingConfig };
