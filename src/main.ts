#!/usr/bin/env node

import {
  EnhancedMainPipeline,
  PipelineOptions,
} from "./main-pipeline-enhanced";
import { AllCharactersError } from "./errors";

/**
 * メインエントリーポイント
 * 全キャラクターデータ生成の実行
 * 要件: 1.1, 1.5, 5.5, 6.6, 7.3, 7.4
 */
async function main(): Promise<void> {
  console.log(`🎮 === ZZZ 全キャラクターデータ生成ツール ===`);
  console.log(`開始時刻: ${new Date().toLocaleString()}`);
  console.log(`==========================================\n`);

  // コマンドライン引数から設定を取得
  const options: PipelineOptions = parseCommandLineArgs();

  const pipeline = new EnhancedMainPipeline();

  try {
    // メインパイプラインを実行
    const result = await pipeline.execute(options);

    // 成功時の処理
    console.log(`\n🎉 === 処理完了 ===`);
    console.log(`✅ 全キャラクターデータの生成が正常に完了しました！`);
    console.log(`📁 出力ファイル: ${result.outputFilePath}`);
    console.log(`📊 生成されたキャラクター数: ${result.characters.length}`);
    console.log(`⏱️  総実行時間: ${formatDuration(result.executionTime)}`);
    console.log(`==================\n`);

    // 処理レポートを生成
    await pipeline.generateReport(result);
    console.log(`📄 詳細な処理レポートが生成されました: processing-report.md`);

    process.exit(0);
  } catch (error) {
    // エラー時の処理
    console.error(`\n💥 === 処理失敗 ===`);

    if (error instanceof AllCharactersError) {
      console.error(`❌ エラータイプ: ${error.constructor.name}`);
      console.error(`🔍 処理段階: ${error.stage}`);
      console.error(`📝 詳細: ${error.details}`);
      if (error.characterId) {
        console.error(`👤 キャラクターID: ${error.characterId}`);
      }
      if (error.originalError) {
        console.error(`🔗 元のエラー: ${error.originalError.message}`);
      }
    } else if (error instanceof Error) {
      console.error(`❌ エラー: ${error.message}`);
      console.error(`📚 スタックトレース: ${error.stack}`);
    } else {
      console.error(`❌ 不明なエラー: ${String(error)}`);
    }

    console.error(`\n💡 トラブルシューティング:`);
    console.error(
      `1. Scraping.md ファイルが存在し、正しい形式であることを確認してください`
    );
    console.error(`2. インターネット接続が安定していることを確認してください`);
    console.error(`3. API レート制限に達していないか確認してください`);
    console.error(
      `4. 部分的な結果が保存されている場合は、*-partial.ts ファイルを確認してください`
    );
    console.error(
      `5. error-report.md ファイルで詳細なエラー情報を確認してください`
    );
    console.error(`==================\n`);

    process.exit(1);
  }
}

/**
 * コマンドライン引数を解析
 * @returns PipelineOptions 設定オプション
 */
function parseCommandLineArgs(): PipelineOptions {
  const args = process.argv.slice(2);
  const options: PipelineOptions = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];

    switch (key) {
      case "--scraping-file":
      case "-s":
        options.scrapingFilePath = value;
        break;
      case "--output":
      case "-o":
        options.outputFilePath = value;
        break;
      case "--batch-size":
      case "-b":
        options.batchSize = parseInt(value, 10);
        break;
      case "--delay":
      case "-d":
        options.delayMs = parseInt(value, 10);
        break;
      case "--retries":
      case "-r":
        options.maxRetries = parseInt(value, 10);
        break;
      case "--min-success-rate":
      case "-m":
        options.minSuccessRate = parseFloat(value);
        break;
      case "--help":
      case "-h":
        printUsage();
        process.exit(0);
        break;
      default:
        if (key.startsWith("-")) {
          console.warn(`⚠️  不明なオプション: ${key}`);
        }
        break;
    }
  }

  return options;
}

/**
 * 使用方法を表示
 */
function printUsage(): void {
  console.log(`
🎮 ZZZ 全キャラクターデータ生成ツール

使用方法:
  npm run generate-all-characters [オプション]

オプション:
  -s, --scraping-file <path>     Scraping.mdファイルのパス (デフォルト: Scraping.md)
  -o, --output <path>            出力ファイルのパス (デフォルト: data/characters.ts)
  -b, --batch-size <number>      バッチサイズ (デフォルト: 5)
  -d, --delay <number>           リクエスト間隔（ミリ秒） (デフォルト: 200)
  -r, --retries <number>         最大リトライ回数 (デフォルト: 3)
  -m, --min-success-rate <rate>  最小成功率 (0.0-1.0) (デフォルト: 0.8)
  -h, --help                     このヘルプを表示

例:
  npm run generate-all-characters
  npm run generate-all-characters --batch-size 3 --delay 500
  npm run generate-all-characters --output custom/characters.ts --min-success-rate 0.9
`);
}

/**
 * 時間を人間が読みやすい形式にフォーマット
 * @param ms ミリ秒
 * @returns フォーマットされた時間文字列
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

// プロセス終了時のクリーンアップ
process.on("SIGINT", () => {
  console.log(
    `\n⚠️  処理が中断されました。部分的な結果が保存されている可能性があります。`
  );
  process.exit(130);
});

process.on("SIGTERM", () => {
  console.log(
    `\n⚠️  処理が終了されました。部分的な結果が保存されている可能性があります。`
  );
  process.exit(143);
});

// メイン関数を実行
if (require.main === module) {
  main().catch((error) => {
    console.error(`💥 予期しないエラーが発生しました:`, error);
    process.exit(1);
  });
}

export { main };
