#!/usr/bin/env node

import { FileLoader } from "./loaders/FileLoader";
import { WeaponIconProcessor } from "./processors/WeaponIconProcessor";
import { WeaponIconGenerator } from "./generators/WeaponIconGenerator";
import { ConfigManager } from "./config/ProcessingConfig";
import { WeaponIconProcessingResult } from "./types/processing";
import { logger, LogMessages } from "./utils/Logger";
import {
  WeaponIconError,
  WeaponIconBatchError,
  WeaponIconDownloadError,
  WeaponIconValidationError,
  WeaponIconFileSystemError,
  WeaponIconSecurityError,
} from "./errors";

/**
 * 武器アイコンダウンロードのメインエントリーポイント
 * SとAレアリティの武器アイコンを効率的にダウンロードし、統計情報を提供
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
 * 武器アイコンダウンロードの統合実行機能
 * 設定ファイルからの処理パラメータ読み込み
 * 実行結果の検証と統計情報出力
 * 要件: 5.1, 5.5
 */
async function main(): Promise<void> {
  const startTime = new Date();

  if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
    console.log(`⚔️  === 武器アイコンダウンロード開始 ===`);
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
    const config = configManager.getWeaponIconConfig();

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
    const fileLoader = new FileLoader();
    const weaponIconProcessor = new WeaponIconProcessor(config);
    const weaponIconGenerator = new WeaponIconGenerator(
      fileLoader,
      weaponIconProcessor,
      config
    );

    logger.info(LogMessages.WEAPON_ICON_GENERATION_START, {
      config: {
        outputDirectory: config.outputDirectory,
        maxConcurrency: config.maxConcurrency,
        retryAttempts: config.retryAttempts,
        retryDelayMs: config.retryDelayMs,
        requestDelayMs: config.requestDelayMs,
        skipExisting: config.skipExisting,
        validateDownloads: config.validateDownloads,
        maxFileSizeMB: config.maxFileSizeMB,
      },
      commandLineArgs: args,
      systemInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memoryUsage: process.memoryUsage(),
        cwd: process.cwd(),
        startTime: startTime.toISOString(),
      },
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        LOG_LEVEL: process.env.LOG_LEVEL,
        VITEST: process.env.VITEST,
      },
    });

    // メイン処理を実行
    const result = await weaponIconGenerator.generateWeaponIcons();

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

    logger.info(LogMessages.WEAPON_ICON_GENERATION_SUCCESS, {
      statistics: result.statistics,
      executionTimeMs: executionTime,
      performance: {
        avgProcessingTimePerWeapon: executionTime / result.statistics.total,
        throughputPerSecond: (result.statistics.total / executionTime) * 1000,
        successRate:
          (result.statistics.successful / result.statistics.total) * 100,
        totalSizeFormatted: formatFileSize(result.statistics.totalSizeBytes),
      },
      systemInfo: {
        finalMemoryUsage: process.memoryUsage(),
        endTime: endTime.toISOString(),
        startTime: startTime.toISOString(),
      },
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
    const errorContext = {
      executionTimeMs: executionTime,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      systemInfo: {
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        LOG_LEVEL: process.env.LOG_LEVEL,
        VITEST: process.env.VITEST,
      },
    };

    if (error instanceof WeaponIconError) {
      logger.error(LogMessages.WEAPON_ICON_PROCESSING_ERROR, {
        ...errorContext,
        errorType: error.constructor.name,
        weaponId: error.weaponId,
        details: error.details,
        originalError: error.originalError?.message,
        errorStack: error.stack,
        weaponIconError: {
          type: error.type,
          weaponId: error.weaponId,
          details: error.details,
        },
      });
    } else if (error instanceof WeaponIconBatchError) {
      logger.error(LogMessages.WEAPON_ICON_BATCH_ERROR, {
        ...errorContext,
        errorType: error.constructor.name,
        failedWeapons: error.failedWeapons,
        totalWeapons: error.totalWeapons,
        details: error.details,
        originalError: error.originalError?.message,
        errorStack: error.stack,
        batchErrorMetrics: {
          failureCount: error.failedWeapons.length,
          totalCount: error.totalWeapons,
          failureRate: (error.failedWeapons.length / error.totalWeapons) * 100,
        },
      });
    } else {
      logger.error(LogMessages.WEAPON_ICON_GENERATION_ERROR, {
        ...errorContext,
        errorType: error instanceof Error ? error.constructor.name : "Unknown",
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        errorName: error instanceof Error ? error.name : "Unknown",
      });
    }

    // 詳細なデバッグエラー情報
    logger.debug("メイン処理エラー - 完全なデバッグ情報", {
      ...errorContext,
      errorDetails: {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : "Unknown",
        stack: error instanceof Error ? error.stack : undefined,
        cause: error instanceof Error ? (error as any).cause : undefined,
        constructor:
          error instanceof Error ? error.constructor.name : "Unknown",
      },
      processingContext: {
        phase: "main_execution",
        executionTimeMs: executionTime,
        wasSuccessful: false,
      },
    });

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
⚔️  武器アイコンダウンロードツール

使用方法:
  npm run generate:weapon-icons [オプション]
  tsx src/main-weapon-icon-download.ts [オプション]

オプション:
  -c, --config <path>           設定ファイルのパス (デフォルト: processing-config.json)
  -o, --output-dir <path>       出力ディレクトリのパス (デフォルト: assets/images/weapons)
  -m, --max-concurrency <num>   最大並行数 (デフォルト: 3)
  -s, --skip-existing           既存ファイルをスキップ (デフォルト: true)
      --no-skip-existing        既存ファイルを上書き
  -v, --verbose                 詳細ログを有効化
  -h, --help                    このヘルプを表示

例:
  npm run generate:weapon-icons
  npm run generate:weapon-icons -- --output-dir custom/icons --max-concurrency 5
  npm run generate:weapon-icons -- --config custom-config.json --verbose
  npm run generate:weapon-icons -- --no-skip-existing

設定ファイル例 (processing-config.json):
{
  "weaponIconDownload": {
    "outputDirectory": "assets/images/weapons",
    "maxConcurrency": 3,
    "retryAttempts": 3,
    "retryDelayMs": 1000,
    "requestDelayMs": 500,
    "skipExisting": true,
    "validateDownloads": true,
    "maxFileSizeMB": 10
  }
}

注意事項:
- SとAレアリティの武器アイコンのみがダウンロードされます
- Bレアリティの武器は処理対象から除外されます
- ファイル名は entry_page_id.png 形式で保存されます
`);
}

/**
 * 設定概要を表示
 * @param config 武器アイコン設定
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
  console.log(`処理対象レアリティ: S, A (Bは除外)`);
  console.log(`==================\n`);
}

/**
 * 処理結果を検証
 * @param result 処理結果
 */
function validateProcessingResult(result: WeaponIconProcessingResult): void {
  const { statistics } = result;

  // 最小成功率のチェック（80%以上）
  const successRate = statistics.successful / statistics.total;
  const minSuccessRate = 0.8;

  if (successRate < minSuccessRate) {
    throw new WeaponIconBatchError(
      result.failed.map((f) => f.weaponId),
      statistics.total,
      `成功率が最小要件を下回りました: ${Math.round(
        successRate * 100
      )}% < ${Math.round(minSuccessRate * 100)}%`
    );
  }

  // 成功したダウンロードが0件の場合はエラー
  if (statistics.successful === 0) {
    throw new WeaponIconBatchError(
      [],
      statistics.total,
      "成功した武器アイコンダウンロードがありません"
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
  result: WeaponIconProcessingResult,
  executionTime: number,
  startTime: Date,
  endTime: Date
): void {
  const { statistics } = result;
  const successRate = Math.round(
    (statistics.successful / statistics.total) * 100
  );

  console.log(`\n🎉 === 武器アイコンダウンロード完了 ===`);
  console.log(`終了時刻: ${endTime.toLocaleString()}`);
  console.log(`総実行時間: ${formatDuration(executionTime)}`);
  console.log(`========================================`);
  console.log(`📊 処理結果:`);
  console.log(`  総武器数: ${statistics.total}`);
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
    console.log(`  スループット: ${throughput.toFixed(2)} 武器/秒`);
  }

  console.log(`========================================`);

  if (result.failed.length > 0) {
    console.log(`\n⚠️  失敗した武器:`);
    result.failed.slice(0, 5).forEach((failed, index) => {
      console.log(`  ${index + 1}. ${failed.weaponName}: ${failed.error}`);
    });
    if (result.failed.length > 5) {
      console.log(`  ... その他 ${result.failed.length - 5}件`);
    }
  }

  console.log(`\n✅ 武器アイコンダウンロードが完了しました！`);
  console.log(`📁 出力ディレクトリ: assets/images/weapons/`);
  console.log(`🎯 処理対象: SとAレアリティの武器のみ`);
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
  console.error(`\n💥 === 武器アイコンダウンロード失敗 ===`);
  console.error(`終了時刻: ${endTime.toLocaleString()}`);
  console.error(`実行時間: ${formatDuration(executionTime)}`);
  console.error(`==========================================`);

  if (error instanceof WeaponIconDownloadError) {
    console.error(`❌ エラータイプ: ${error.constructor.name}`);
    console.error(`🎯 対象武器: ${error.weaponId}`);
    console.error(`📝 詳細: ${error.details}`);
    if (error.originalError) {
      console.error(`🔗 元のエラー: ${error.originalError.message}`);
    }
  } else if (error instanceof WeaponIconValidationError) {
    console.error(`❌ エラータイプ: ${error.constructor.name}`);
    console.error(`🎯 対象武器: ${error.weaponId}`);
    console.error(`📝 詳細: ${error.details}`);
    if (error.originalError) {
      console.error(`🔗 元のエラー: ${error.originalError.message}`);
    }
  } else if (error instanceof WeaponIconFileSystemError) {
    console.error(`❌ エラータイプ: ${error.constructor.name}`);
    console.error(`🎯 対象武器: ${error.weaponId}`);
    console.error(`📝 詳細: ${error.details}`);
    if (error.originalError) {
      console.error(`🔗 元のエラー: ${error.originalError.message}`);
    }
  } else if (error instanceof WeaponIconSecurityError) {
    console.error(`❌ エラータイプ: ${error.constructor.name}`);
    console.error(`🎯 対象武器: ${error.weaponId}`);
    console.error(`📝 詳細: ${error.details}`);
    if (error.originalError) {
      console.error(`🔗 元のエラー: ${error.originalError.message}`);
    }
  } else if (error instanceof WeaponIconBatchError) {
    console.error(`❌ エラータイプ: ${error.constructor.name}`);
    console.error(
      `📊 失敗した武器数: ${error.failedWeapons.length}/${error.totalWeapons}`
    );
    console.error(`📝 詳細: ${error.details}`);
    console.error(
      `🎯 失敗した武器: ${error.failedWeapons.slice(0, 5).join(", ")}${
        error.failedWeapons.length > 5 ? "..." : ""
      }`
    );
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
    `1. json/data/weapon-list.json ファイルが存在し、正しい形式であることを確認してください`
  );
  console.error(`2. インターネット接続が安定していることを確認してください`);
  console.error(`3. 出力ディレクトリの書き込み権限を確認してください`);
  console.error(`4. API レート制限に達していないか確認してください`);
  console.error(
    `5. 設定ファイル (processing-config.json) の内容を確認してください`
  );
  console.error(`6. --verbose オプションで詳細ログを確認してください`);
  console.error(
    `7. SとAレアリティの武器のみが処理対象であることを確認してください`
  );
  console.error(`==========================================\n`);
}

/**
 * 処理レポートを生成
 * @param result 処理結果
 * @param executionTime 実行時間
 * @param config 設定
 */
async function generateProcessingReport(
  result: WeaponIconProcessingResult,
  executionTime: number,
  config: any
): Promise<void> {
  try {
    const reportPath = "weapon-icon-download-report.md";
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
  result: WeaponIconProcessingResult,
  executionTime: number,
  config: any
): string {
  const { statistics, successful, failed } = result;
  const successRate = Math.round(
    (statistics.successful / statistics.total) * 100
  );

  let report = `# 武器アイコンダウンロード処理レポート\n\n`;
  report += `生成日時: ${new Date().toLocaleString()}\n`;
  report += `総実行時間: ${formatDuration(executionTime)}\n\n`;

  report += `## 処理結果概要\n\n`;
  report += `| 項目 | 値 |\n`;
  report += `|------|----|\n`;
  report += `| 総武器数 | ${statistics.total} |\n`;
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
    report += `| スループット | ${throughput.toFixed(2)} 武器/秒 |\n`;
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
  report += `| 処理対象レアリティ | S, A (Bは除外) |\n`;

  if (successful.length > 0) {
    report += `\n## 成功したダウンロード\n\n`;
    report += `| No. | 武器ID | 武器名 | ファイルサイズ | ダウンロード時刻 |\n`;
    report += `|-----|--------|--------|----------------|------------------|\n`;
    successful.forEach((iconInfo, index) => {
      const downloadTime = iconInfo.downloadedAt?.toLocaleString() || "不明";
      report += `| ${index + 1} | ${iconInfo.weaponId} | ${
        iconInfo.weaponName
      } | ${formatFileSize(iconInfo.fileSize || 0)} | ${downloadTime} |\n`;
    });
  }

  if (failed.length > 0) {
    report += `\n## 失敗したダウンロード\n\n`;
    report += `| No. | 武器ID | 武器名 | エラー内容 |\n`;
    report += `|-----|--------|--------|------------|\n`;
    failed.forEach((failedItem, index) => {
      report += `| ${index + 1} | ${failedItem.weaponId} | ${
        failedItem.weaponName
      } | ${failedItem.error} |\n`;
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

  report += `\n## レアリティフィルタリング\n\n`;
  report += `このツールは以下のレアリティの武器アイコンのみをダウンロードします:\n`;
  report += `- **S級武器**: 最高レアリティの武器\n`;
  report += `- **A級武器**: 高レアリティの武器\n`;
  report += `- **B級武器**: 除外対象（ダウンロードされません）\n\n`;

  report += `## ファイル命名規則\n\n`;
  report += `ダウンロードされたアイコンファイルは以下の命名規則に従います:\n`;
  report += `- ファイル名: \`{entry_page_id}.png\`\n`;
  report += `- 例: \`936.png\`, \`935.png\`\n`;
  report += `- 保存先: \`assets/images/weapons/\`\n\n`;

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
