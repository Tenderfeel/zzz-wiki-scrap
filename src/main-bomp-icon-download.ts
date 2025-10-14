#!/usr/bin/env node

import { BompListParser } from "./parsers/BompListParser";
import { BompIconProcessor } from "./processors/BompIconProcessor";
import { BompIconGenerator } from "./generators/BompIconGenerator";
import { HoyoLabApiClient } from "./clients/HoyoLabApiClient";
import { ConfigManager } from "./config/ProcessingConfig";
import { BompIconProcessingResult } from "./types/processing";
import { logger, LogMessages } from "./utils/Logger";
import {
  AllCharactersError,
  ProcessingStage,
  BompIconError,
  BompIconBatchError,
} from "./errors";

/**
 * ボンプアイコンダウンロードのメインエントリーポイント
 * 全32のボンプアイコンを効率的にダウンロードし、統計情報を提供
 * 要件: 5.1, 5.5
 */

/**
 * コマンドライン引数の解析結果
 */
interface CommandLineArgs {
  configPath?: string;
  outputDir?: string;
  maxConcurrency?: number;
  skipExisting?: boolean;
  help?: boolean;
  verbose?: boolean;
}

/**
 * メイン実行関数
 * ボンプアイコンダウンロードの統合実行機能
 * 設定ファイルからの処理パラメータ読み込み
 * 実行結果の検証と統計情報出力
 * 要件: 5.1, 5.5
 */
async function main(): Promise<void> {
  const startTime = new Date();

  if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
    console.log(`🖼️  === ボンプアイコンダウンロード開始 ===`);
    console.log(`開始時刻: ${startTime.toLocaleString()}`);
    console.log(`==========================================\n`);
  }

  try {
    // コマンドライン引数を解析
    const args = parseCommandLineArgs();

    if (args.help) {
      printUsage();
      process.exit(0);
    }

    // 設定管理を初期化
    const configManager = ConfigManager.getInstance(args.configPath);
    const config = configManager.getBompIconConfig();

    // コマンドライン引数で設定を上書き
    if (args.outputDir) {
      config.outputDirectory = args.outputDir;
    }
    if (args.maxConcurrency !== undefined) {
      config.maxConcurrency = args.maxConcurrency;
    }
    if (args.skipExisting !== undefined) {
      config.skipExisting = args.skipExisting;
    }

    // 詳細ログの設定
    if (args.verbose) {
      process.env.LOG_LEVEL = "debug";
    }

    // 設定概要を表示
    if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
      displayConfigSummary(config);
    }

    // 依存関係を初期化
    const bompListParser = new BompListParser();
    const apiClient = new HoyoLabApiClient();
    const bompIconProcessor = new BompIconProcessor(apiClient, config);
    const bompIconGenerator = new BompIconGenerator(
      bompListParser,
      bompIconProcessor,
      config
    );

    logger.info(LogMessages.BOMP_ICON_GENERATION_START, {
      config: {
        outputDirectory: config.outputDirectory,
        maxConcurrency: config.maxConcurrency,
        retryAttempts: config.retryAttempts,
        skipExisting: config.skipExisting,
      },
    });

    // メイン処理を実行
    const result = await bompIconGenerator.generateBompIcons();

    // 処理結果を検証
    validateProcessingResult(result);

    const endTime = new Date();
    const executionTime = endTime.getTime() - startTime.getTime();

    // 成功時の処理
    if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
      displaySuccessSummary(result, executionTime, startTime, endTime);
    }

    // 処理レポートを生成
    await generateProcessingReport(result, executionTime, config);

    logger.info(LogMessages.BOMP_ICON_GENERATION_SUCCESS, {
      statistics: result.statistics,
      executionTimeMs: executionTime,
    });
    process.exit(0);
  } catch (error) {
    const endTime = new Date();
    const executionTime = endTime.getTime() - startTime.getTime();

    // エラー時の処理
    if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
      displayErrorSummary(error, executionTime, startTime, endTime);
    }

    // エラータイプに応じた詳細ログ
    if (error instanceof BompIconError) {
      logger.error(LogMessages.BOMP_ICON_PROCESSING_ERROR, {
        errorType: error.constructor.name,
        bompId: error.bompId,
        details: error.details,
        originalError: error.originalError?.message,
        executionTimeMs: executionTime,
      });
    } else if (error instanceof BompIconBatchError) {
      logger.error(LogMessages.BOMP_ICON_BATCH_ERROR, {
        errorType: error.constructor.name,
        failedBomps: error.failedBomps,
        totalBomps: error.totalBomps,
        details: error.details,
        originalError: error.originalError?.message,
        executionTimeMs: executionTime,
      });
    } else if (error instanceof AllCharactersError) {
      logger.error(LogMessages.BOMP_ICON_GENERATION_ERROR, {
        errorType: error.constructor.name,
        stage: error.stage,
        characterId: error.characterId,
        details: error.details,
        originalError: error.originalError?.message,
        executionTimeMs: executionTime,
      });
    } else {
      logger.error(LogMessages.BOMP_ICON_GENERATION_ERROR, {
        errorType: error instanceof Error ? error.constructor.name : "Unknown",
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: executionTime,
      });
    }

    process.exit(1);
  }
}

/**
 * コマンドライン引数を解析
 * @returns 解析されたコマンドライン引数
 */
function parseCommandLineArgs(): CommandLineArgs {
  const args = process.argv.slice(2);
  const result: CommandLineArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case "--config":
      case "-c":
        result.configPath = nextArg;
        i++; // 次の引数をスキップ
        break;
      case "--output-dir":
      case "-o":
        result.outputDir = nextArg;
        i++; // 次の引数をスキップ
        break;
      case "--max-concurrency":
      case "-m":
        result.maxConcurrency = parseInt(nextArg, 10);
        if (isNaN(result.maxConcurrency)) {
          console.error(`❌ 無効な並行数: ${nextArg}`);
          process.exit(1);
        }
        i++; // 次の引数をスキップ
        break;
      case "--skip-existing":
      case "-s":
        result.skipExisting = true;
        break;
      case "--no-skip-existing":
        result.skipExisting = false;
        break;
      case "--verbose":
      case "-v":
        result.verbose = true;
        break;
      case "--help":
      case "-h":
        result.help = true;
        break;
      default:
        if (arg.startsWith("-")) {
          console.warn(`⚠️  不明なオプション: ${arg}`);
        }
        break;
    }
  }

  return result;
}

/**
 * 使用方法を表示
 */
function printUsage(): void {
  console.log(`
🖼️  ボンプアイコンダウンロードツール

使用方法:
  npm run generate:bomp-icons [オプション]
  tsx src/main-bomp-icon-download.ts [オプション]

オプション:
  -c, --config <path>           設定ファイルのパス (デフォルト: processing-config.json)
  -o, --output-dir <path>       出力ディレクトリのパス (デフォルト: assets/images/bomps)
  -m, --max-concurrency <num>   最大並行数 (デフォルト: 3)
  -s, --skip-existing           既存ファイルをスキップ (デフォルト: true)
      --no-skip-existing        既存ファイルを上書き
  -v, --verbose                 詳細ログを有効化
  -h, --help                    このヘルプを表示

例:
  npm run generate:bomp-icons
  npm run generate:bomp-icons -- --output-dir custom/icons --max-concurrency 5
  npm run generate:bomp-icons -- --config custom-config.json --verbose
  npm run generate:bomp-icons -- --no-skip-existing

設定ファイル例 (processing-config.json):
{
  "bompIconDownload": {
    "outputDirectory": "assets/images/bomps",
    "maxConcurrency": 3,
    "retryAttempts": 3,
    "retryDelayMs": 1000,
    "requestDelayMs": 500,
    "skipExisting": true,
    "validateDownloads": true,
    "maxFileSizeMB": 10
  }
}
`);
}

/**
 * 設定概要を表示
 * @param config ボンプアイコン設定
 */
function displayConfigSummary(config: any): void {
  console.log(`⚙️  === 設定概要 ===`);
  console.log(`出力ディレクトリ: ${config.outputDirectory}`);
  console.log(`最大並行数: ${config.maxConcurrency}`);
  console.log(`リトライ回数: ${config.retryAttempts}`);
  console.log(`リトライ遅延: ${config.retryDelayMs}ms`);
  console.log(`リクエスト遅延: ${config.requestDelayMs}ms`);
  console.log(`既存ファイルスキップ: ${config.skipExisting ? "有効" : "無効"}`);
  console.log(
    `ダウンロード検証: ${config.validateDownloads ? "有効" : "無効"}`
  );
  console.log(`最大ファイルサイズ: ${config.maxFileSizeMB || 10}MB`);
  console.log(`==================\n`);
}

/**
 * 処理結果を検証
 * @param result 処理結果
 */
function validateProcessingResult(result: BompIconProcessingResult): void {
  const { statistics } = result;

  // 最小成功率のチェック（80%以上）
  const successRate = statistics.successful / statistics.total;
  const minSuccessRate = 0.8;

  if (successRate < minSuccessRate) {
    throw new AllCharactersError(
      ProcessingStage.VALIDATION,
      null,
      `成功率が最小要件を下回りました: ${Math.round(
        successRate * 100
      )}% < ${Math.round(minSuccessRate * 100)}%`
    );
  }

  // 成功したダウンロードが0件の場合はエラー
  if (statistics.successful === 0) {
    throw new AllCharactersError(
      ProcessingStage.VALIDATION,
      null,
      "成功したアイコンダウンロードがありません"
    );
  }

  logger.info("処理結果の検証が完了しました", {
    successRate: Math.round(successRate * 100),
    successful: statistics.successful,
    total: statistics.total,
    minSuccessRateRequired: Math.round(minSuccessRate * 100),
    validationPassed: true,
  });
}

/**
 * 成功時の概要を表示
 * @param result 処理結果
 * @param executionTime 実行時間
 * @param startTime 開始時刻
 * @param endTime 終了時刻
 */
function displaySuccessSummary(
  result: BompIconProcessingResult,
  executionTime: number,
  startTime: Date,
  endTime: Date
): void {
  const { statistics } = result;
  const successRate = Math.round(
    (statistics.successful / statistics.total) * 100
  );

  console.log(`\n🎉 === ボンプアイコンダウンロード完了 ===`);
  console.log(`終了時刻: ${endTime.toLocaleString()}`);
  console.log(`総実行時間: ${formatDuration(executionTime)}`);
  console.log(`========================================`);
  console.log(`📊 処理結果:`);
  console.log(`  総ボンプ数: ${statistics.total}`);
  console.log(`  ダウンロード成功: ${statistics.successful}`);
  console.log(`  ダウンロード失敗: ${statistics.failed}`);
  console.log(`  成功率: ${successRate}%`);
  console.log(
    `  総ファイルサイズ: ${formatFileSize(statistics.totalSizeBytes)}`
  );
  console.log(`  処理時間: ${formatDuration(statistics.processingTimeMs)}`);

  if (statistics.successful > 0) {
    const avgFileSize = statistics.totalSizeBytes / statistics.successful;
    const throughput = statistics.total / (statistics.processingTimeMs / 1000);
    console.log(`  平均ファイルサイズ: ${formatFileSize(avgFileSize)}`);
    console.log(`  スループット: ${throughput.toFixed(2)} ボンプ/秒`);
  }

  console.log(`========================================`);

  if (result.failed.length > 0) {
    console.log(`\n⚠️  失敗したボンプ:`);
    result.failed.slice(0, 5).forEach((failed, index) => {
      console.log(`  ${index + 1}. ${failed.bompId}: ${failed.error}`);
    });
    if (result.failed.length > 5) {
      console.log(`  ... その他 ${result.failed.length - 5}件`);
    }
  }

  console.log(`\n✅ ボンプアイコンダウンロードが完了しました！`);
  console.log(`📁 出力ディレクトリ: assets/images/bomps/`);
  console.log(`========================================\n`);
}

/**
 * エラー時の概要を表示
 * @param error 発生したエラー
 * @param executionTime 実行時間
 * @param startTime 開始時刻
 * @param endTime 終了時刻
 */
function displayErrorSummary(
  error: unknown,
  executionTime: number,
  startTime: Date,
  endTime: Date
): void {
  console.error(`\n💥 === ボンプアイコンダウンロード失敗 ===`);
  console.error(`終了時刻: ${endTime.toLocaleString()}`);
  console.error(`実行時間: ${formatDuration(executionTime)}`);
  console.error(`==========================================`);

  if (error instanceof BompIconError) {
    console.error(`❌ エラータイプ: ${error.constructor.name}`);
    console.error(`🎯 対象ボンプ: ${error.bompId}`);
    console.error(`📝 詳細: ${error.details}`);
    if (error.originalError) {
      console.error(`🔗 元のエラー: ${error.originalError.message}`);
    }
  } else if (error instanceof BompIconBatchError) {
    console.error(`❌ エラータイプ: ${error.constructor.name}`);
    console.error(
      `📊 失敗したボンプ数: ${error.failedBomps.length}/${error.totalBomps}`
    );
    console.error(`📝 詳細: ${error.details}`);
    console.error(
      `🎯 失敗したボンプ: ${error.failedBomps.slice(0, 5).join(", ")}${
        error.failedBomps.length > 5 ? "..." : ""
      }`
    );
    if (error.originalError) {
      console.error(`🔗 元のエラー: ${error.originalError.message}`);
    }
  } else if (error instanceof AllCharactersError) {
    console.error(`❌ エラータイプ: ${error.constructor.name}`);
    console.error(`🔍 処理段階: ${error.stage}`);
    console.error(`📝 詳細: ${error.details}`);
    if (error.characterId) {
      console.error(`🎯 対象ボンプ: ${error.characterId}`);
    }
    if (error.originalError) {
      console.error(`🔗 元のエラー: ${error.originalError.message}`);
    }
  } else if (error instanceof Error) {
    console.error(`❌ エラー: ${error.message}`);
    if (error.stack) {
      console.error(`📚 スタックトレース: ${error.stack}`);
    }
  } else {
    console.error(`❌ 不明なエラー: ${String(error)}`);
  }

  console.error(`\n💡 トラブルシューティング:`);
  console.error(
    `1. Scraping.md ファイルが存在し、正しい形式であることを確認してください`
  );
  console.error(`2. インターネット接続が安定していることを確認してください`);
  console.error(`3. 出力ディレクトリの書き込み権限を確認してください`);
  console.error(`4. API レート制限に達していないか確認してください`);
  console.error(
    `5. 設定ファイル (processing-config.json) の内容を確認してください`
  );
  console.error(`6. --verbose オプションで詳細ログを確認してください`);
  console.error(`==========================================\n`);
}

/**
 * 処理レポートを生成
 * @param result 処理結果
 * @param executionTime 実行時間
 * @param config 設定
 */
async function generateProcessingReport(
  result: BompIconProcessingResult,
  executionTime: number,
  config: any
): Promise<void> {
  try {
    const reportPath = "bomp-icon-download-report.md";
    const report = generateReportContent(result, executionTime, config);

    const fs = await import("fs");
    fs.writeFileSync(reportPath, report, "utf-8");

    if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
      console.log(`📄 処理レポートを生成しました: ${reportPath}`);
    }

    logger.info("処理レポートを生成しました", {
      reportPath,
      reportSize: report.length,
      successfulCount: result.successful.length,
      failedCount: result.failed.length,
    });
  } catch (error) {
    logger.error("処理レポートの生成に失敗しました", {
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : "Unknown",
    });
  }
}

/**
 * レポート内容を生成
 * @param result 処理結果
 * @param executionTime 実行時間
 * @param config 設定
 * @returns レポート内容
 */
function generateReportContent(
  result: BompIconProcessingResult,
  executionTime: number,
  config: any
): string {
  const { statistics, successful, failed } = result;
  const successRate = Math.round(
    (statistics.successful / statistics.total) * 100
  );

  let report = `# ボンプアイコンダウンロード処理レポート\n\n`;
  report += `生成日時: ${new Date().toLocaleString()}\n`;
  report += `総実行時間: ${formatDuration(executionTime)}\n\n`;

  report += `## 処理結果概要\n\n`;
  report += `| 項目 | 値 |\n`;
  report += `|------|----|\n`;
  report += `| 総ボンプ数 | ${statistics.total} |\n`;
  report += `| ダウンロード成功 | ${statistics.successful} |\n`;
  report += `| ダウンロード失敗 | ${statistics.failed} |\n`;
  report += `| 成功率 | ${successRate}% |\n`;
  report += `| 総ファイルサイズ | ${formatFileSize(
    statistics.totalSizeBytes
  )} |\n`;
  report += `| 処理時間 | ${formatDuration(statistics.processingTimeMs)} |\n`;

  if (statistics.successful > 0) {
    const avgFileSize = statistics.totalSizeBytes / statistics.successful;
    const throughput = statistics.total / (statistics.processingTimeMs / 1000);
    report += `| 平均ファイルサイズ | ${formatFileSize(avgFileSize)} |\n`;
    report += `| スループット | ${throughput.toFixed(2)} ボンプ/秒 |\n`;
  }

  report += `\n## 設定情報\n\n`;
  report += `| 設定項目 | 値 |\n`;
  report += `|----------|----|\n`;
  report += `| 出力ディレクトリ | ${config.outputDirectory} |\n`;
  report += `| 最大並行数 | ${config.maxConcurrency} |\n`;
  report += `| リトライ回数 | ${config.retryAttempts} |\n`;
  report += `| リトライ遅延 | ${config.retryDelayMs}ms |\n`;
  report += `| リクエスト遅延 | ${config.requestDelayMs}ms |\n`;
  report += `| 既存ファイルスキップ | ${
    config.skipExisting ? "有効" : "無効"
  } |\n`;
  report += `| ダウンロード検証 | ${
    config.validateDownloads ? "有効" : "無効"
  } |\n`;

  if (successful.length > 0) {
    report += `\n## 成功したダウンロード\n\n`;
    report += `| No. | ボンプID | ファイルサイズ | ダウンロード時刻 |\n`;
    report += `|-----|----------|----------------|------------------|\n`;
    successful.forEach((iconInfo, index) => {
      const downloadTime = iconInfo.downloadedAt?.toLocaleString() || "不明";
      report += `| ${index + 1} | ${iconInfo.bompId} | ${formatFileSize(
        iconInfo.fileSize || 0
      )} | ${downloadTime} |\n`;
    });
  }

  if (failed.length > 0) {
    report += `\n## 失敗したダウンロード\n\n`;
    report += `| No. | ボンプID | エラー内容 |\n`;
    report += `|-----|----------|------------|\n`;
    failed.forEach((failedItem, index) => {
      report += `| ${index + 1} | ${failedItem.bompId} | ${
        failedItem.error
      } |\n`;
    });
  }

  report += `\n## 出力ファイル一覧\n\n`;
  if (successful.length > 0) {
    successful.forEach((iconInfo) => {
      report += `- \`${iconInfo.localPath}\`\n`;
    });
  } else {
    report += `出力されたファイルはありません。\n`;
  }

  return report;
}

/**
 * 時間を人間が読みやすい形式にフォーマット
 * @param ms ミリ秒
 * @returns フォーマットされた時間文字列
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}秒`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}分${seconds}秒`;
  }
}

/**
 * ファイルサイズを人間が読みやすい形式にフォーマット
 * @param bytes バイト数
 * @returns フォーマットされたファイルサイズ文字列
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

// プロセス終了時のクリーンアップ
process.on("SIGINT", () => {
  if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
    console.log(
      `\n⚠️  処理が中断されました。部分的な結果が保存されている可能性があります。`
    );
  }
  process.exit(130);
});

process.on("SIGTERM", () => {
  if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
    console.log(
      `\n⚠️  処理が終了されました。部分的な結果が保存されている可能性があります。`
    );
  }
  process.exit(143);
});

// メイン関数を実行（スクリプトが直接実行された場合のみ）
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`💥 予期しないエラーが発生しました:`, error);
    process.exit(1);
  });
}

export { main };
