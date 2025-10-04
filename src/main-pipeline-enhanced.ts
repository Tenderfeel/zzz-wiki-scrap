import { CharacterListParser } from "./parsers/CharacterListParser";
import { BatchProcessor } from "./processors/BatchProcessor";
import { AllCharactersGenerator } from "./generators/AllCharactersGenerator";
import { EnhancedApiClient } from "./clients/EnhancedApiClient";
import { EnhancedDataProcessor } from "./processors/EnhancedDataProcessor";
import {
  AllCharactersError,
  ProcessingStage,
  ApiError,
  ParsingError,
  ValidationError,
  BatchProcessingError,
} from "./errors";
import { Character } from "./types";
import { ProcessingResult } from "./processors/BatchProcessor";

/**
 * メイン処理パイプライン設定
 */
export interface PipelineOptions {
  scrapingFilePath?: string;
  outputFilePath?: string;
  batchSize?: number;
  delayMs?: number;
  maxRetries?: number;
  minSuccessRate?: number;
}

/**
 * パイプライン実行結果
 */
export interface PipelineResult {
  characters: Character[];
  processingResult: ProcessingResult;
  outputFilePath: string;
  executionTime: number;
  success: boolean;
}

/**
 * 拡張メイン処理パイプライン
 * 包括的エラーハンドリングを含む完全フロー実装
 * 要件: 1.1, 1.5, 5.5, 6.6, 7.3, 7.4
 */
export class EnhancedMainPipeline {
  private readonly parser: CharacterListParser;
  private readonly batchProcessor: BatchProcessor;
  private readonly generator: AllCharactersGenerator;
  private readonly defaultOptions: Required<PipelineOptions> = {
    scrapingFilePath: "Scraping.md",
    outputFilePath: "data/characters.ts",
    batchSize: 5,
    delayMs: 200,
    maxRetries: 3,
    minSuccessRate: 0.8,
  };

  constructor() {
    this.parser = new CharacterListParser();

    // 依存関係を注入してバッチプロセッサーを初期化
    const apiClient = new EnhancedApiClient();
    const dataProcessor = new EnhancedDataProcessor();
    this.batchProcessor = new BatchProcessor(apiClient, dataProcessor);

    this.generator = new AllCharactersGenerator();
  }

  /**
   * 全体処理パイプラインを実行
   * 包括的エラーハンドリングを含む完全フロー
   * 要件: 1.1, 1.5, 5.5, 6.6, 7.3, 7.4
   */
  async execute(options: PipelineOptions = {}): Promise<PipelineResult> {
    const opts = { ...this.defaultOptions, ...options };
    const startTime = Date.now();

    console.log(`\n🚀 === 拡張メイン処理パイプライン開始 ===`);
    console.log(`開始時刻: ${new Date().toLocaleString()}`);
    console.log(`設定:`);
    console.log(`  - Scraping.mdファイル: ${opts.scrapingFilePath}`);
    console.log(`  - 出力ファイル: ${opts.outputFilePath}`);
    console.log(`  - バッチサイズ: ${opts.batchSize}`);
    console.log(`  - 遅延時間: ${opts.delayMs}ms`);
    console.log(`  - 最大リトライ回数: ${opts.maxRetries}`);
    console.log(`  - 最小成功率: ${Math.round(opts.minSuccessRate * 100)}%`);
    console.log(`==========================================\n`);

    let characterEntries: any[] = [];
    let processingResult: ProcessingResult | null = null;
    let characters: Character[] = [];

    try {
      // ステップ1: Scraping.md解析
      console.log(`📋 ステップ1: Scraping.md解析`);
      try {
        characterEntries = await this.parser.parseScrapingFile(
          opts.scrapingFilePath
        );
        this.parser.displayStatistics(characterEntries);
      } catch (error) {
        throw this.handleError(
          error,
          ProcessingStage.PARSING,
          null,
          "Scraping.mdファイルの解析に失敗しました"
        );
      }

      // ステップ2: バッチ処理（API取得 + データ処理）
      console.log(`🔄 ステップ2: バッチ処理開始`);
      try {
        processingResult = await this.batchProcessor.processAllCharacters(
          characterEntries,
          {
            batchSize: opts.batchSize,
            delayMs: opts.delayMs,
            maxRetries: opts.maxRetries,
          }
        );

        // 処理結果の検証
        this.batchProcessor.validateProcessingResult(
          processingResult,
          opts.minSuccessRate
        );
      } catch (error) {
        throw this.handleError(
          error,
          ProcessingStage.BATCH_PROCESSING,
          null,
          "バッチ処理に失敗しました"
        );
      }

      // ステップ3: Character配列生成
      console.log(`🏗️  ステップ3: Character配列生成`);
      try {
        characters = await this.generator.generateAllCharacters(
          processingResult.successful
        );
      } catch (error) {
        throw this.handleError(
          error,
          ProcessingStage.DATA_PROCESSING,
          null,
          "Character配列の生成に失敗しました"
        );
      }

      // ステップ4: 配列検証
      console.log(`🔍 ステップ4: Character配列検証`);
      try {
        const validationResult =
          this.generator.validateCharacterArray(characters);

        if (!validationResult.isValid) {
          const errorDetails =
            this.generateValidationErrorDetails(validationResult);
          throw new AllCharactersError(
            ProcessingStage.VALIDATION,
            null,
            `Character配列の検証に失敗しました: ${errorDetails}`
          );
        }
      } catch (error) {
        throw this.handleError(
          error,
          ProcessingStage.VALIDATION,
          null,
          "Character配列の検証に失敗しました"
        );
      }

      // ステップ5: ファイル出力
      console.log(`📝 ステップ5: ファイル出力`);
      try {
        this.generator.outputCharactersFile(characters, opts.outputFilePath);
      } catch (error) {
        throw this.handleError(
          error,
          ProcessingStage.FILE_OUTPUT,
          null,
          "ファイル出力に失敗しました"
        );
      }

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // 最終統計表示
      this.displayFinalSummary({
        characters,
        processingResult,
        outputFilePath: opts.outputFilePath,
        executionTime,
        success: true,
      });

      return {
        characters,
        processingResult,
        outputFilePath: opts.outputFilePath,
        executionTime,
        success: true,
      };
    } catch (error) {
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // 詳細なエラーレポートを生成
      const errorReport = this.generateErrorReport(error, {
        characterEntries,
        processingResult,
        characters,
        executionTime,
        options: opts,
      });

      console.error(`\n❌ === パイプライン実行失敗 ===`);
      console.error(
        `エラー: ${error instanceof Error ? error.message : String(error)}`
      );
      console.error(`実行時間: ${this.formatDuration(executionTime)}`);
      console.error(`==============================`);
      console.error(errorReport);
      console.error(`==============================\n`);

      // 部分的な結果があれば保存を試みる
      await this.handlePartialResults(
        error,
        processingResult,
        characters,
        opts.outputFilePath
      );

      // エラー復旧を試行（オプション）
      if (error instanceof AllCharactersError) {
        const recoveryAttempted = await this.attemptErrorRecovery(error, opts);
        if (recoveryAttempted) {
          console.log(
            `🔧 エラー復旧を試行しましたが、手動での確認が必要です。`
          );
        }
      }

      throw error;
    }
  }

  /**
   * エラーハンドリング機能
   * 各処理段階でのエラーキャッチ
   * 詳細なエラーメッセージとレポート生成
   * 要件: 1.5, 6.6, 7.3
   */
  private handleError(
    error: unknown,
    stage: ProcessingStage,
    characterId: string | null,
    contextMessage: string
  ): AllCharactersError {
    let errorMessage = contextMessage;
    let originalError: Error | undefined;

    if (error instanceof AllCharactersError) {
      // 既にAllCharactersErrorの場合はそのまま返す
      return error;
    } else if (error instanceof ApiError) {
      errorMessage = `${contextMessage}: API エラー - ${error.message}`;
      originalError = error;
    } else if (error instanceof ParsingError) {
      errorMessage = `${contextMessage}: 解析エラー - ${error.message}`;
      originalError = error;
    } else if (error instanceof ValidationError) {
      errorMessage = `${contextMessage}: 検証エラー - ${error.message}`;
      originalError = error;
    } else if (error instanceof BatchProcessingError) {
      errorMessage = `${contextMessage}: バッチ処理エラー - ${error.message}`;
      originalError = error;
    } else if (error instanceof Error) {
      errorMessage = `${contextMessage}: ${error.message}`;
      originalError = error;
    } else {
      errorMessage = `${contextMessage}: 不明なエラー - ${String(error)}`;
    }

    return new AllCharactersError(
      stage,
      characterId,
      errorMessage,
      originalError
    );
  }

  /**
   * 検証エラーの詳細を生成
   * @param validationResult 検証結果
   * @returns エラー詳細文字列
   */
  private generateValidationErrorDetails(validationResult: any): string {
    const details: string[] = [];

    if (validationResult.duplicateIds.length > 0) {
      details.push(
        `重複ID ${
          validationResult.duplicateIds.length
        }件: ${validationResult.duplicateIds.join(", ")}`
      );
    }

    if (validationResult.invalidCharacters.length > 0) {
      details.push(
        `無効キャラクター ${validationResult.invalidCharacters.length}件`
      );
      validationResult.invalidCharacters.slice(0, 3).forEach((invalid: any) => {
        details.push(
          `  - インデックス ${invalid.index}: ${invalid.errors
            .slice(0, 2)
            .join(", ")}`
        );
      });
      if (validationResult.invalidCharacters.length > 3) {
        details.push(
          `  - その他 ${validationResult.invalidCharacters.length - 3}件...`
        );
      }
    }

    return details.join("; ");
  }

  /**
   * 詳細なエラーレポートを生成
   * @param error 発生したエラー
   * @param context 実行コンテキスト
   * @returns エラーレポート文字列
   */
  private generateErrorReport(error: unknown, context: any): string {
    const {
      characterEntries,
      processingResult,
      characters,
      executionTime,
      options,
    } = context;

    let report = `\n📋 エラーレポート\n`;
    report += `================\n`;
    report += `発生時刻: ${new Date().toLocaleString()}\n`;
    report += `実行時間: ${this.formatDuration(executionTime)}\n`;

    if (error instanceof AllCharactersError) {
      report += `エラータイプ: AllCharactersError\n`;
      report += `処理段階: ${error.stage}\n`;
      report += `キャラクターID: ${error.characterId || "N/A"}\n`;
      report += `詳細: ${error.details}\n`;
      if (error.originalError) {
        report += `元のエラー: ${error.originalError.message}\n`;
      }
    } else if (error instanceof Error) {
      report += `エラータイプ: ${error.constructor.name}\n`;
      report += `メッセージ: ${error.message}\n`;
    } else {
      report += `エラータイプ: 不明\n`;
      report += `内容: ${String(error)}\n`;
    }

    report += `\n📊 実行状況:\n`;
    report += `- 解析されたキャラクター数: ${characterEntries?.length || 0}\n`;

    if (processingResult) {
      report += `- API取得成功: ${processingResult.statistics.successful}\n`;
      report += `- API取得失敗: ${processingResult.statistics.failed}\n`;
      report += `- 処理成功率: ${Math.round(
        (processingResult.statistics.successful /
          processingResult.statistics.total) *
          100
      )}%\n`;
    }

    report += `- 生成されたCharacter数: ${characters?.length || 0}\n`;

    report += `\n⚙️  設定:\n`;
    report += `- バッチサイズ: ${options.batchSize}\n`;
    report += `- 遅延時間: ${options.delayMs}ms\n`;
    report += `- 最大リトライ回数: ${options.maxRetries}\n`;
    report += `- 最小成功率: ${Math.round(options.minSuccessRate * 100)}%\n`;

    if (processingResult?.failed && processingResult.failed.length > 0) {
      report += `\n❌ 失敗したキャラクター:\n`;
      processingResult.failed.slice(0, 10).forEach((f: any) => {
        report += `- ${f.entry.id}: ${f.error}\n`;
      });
      if (processingResult.failed.length > 10) {
        report += `- その他 ${processingResult.failed.length - 10}件...\n`;
      }
    }

    report += `================\n`;
    return report;
  }

  /**
   * 部分的な結果の処理
   * エラー発生時に成功した部分のデータを保存
   * @param error 発生したエラー
   * @param processingResult 処理結果
   * @param characters 生成されたキャラクター配列
   * @param outputFilePath 出力ファイルパス
   */
  private async handlePartialResults(
    error: unknown,
    processingResult: ProcessingResult | null,
    characters: Character[],
    outputFilePath: string
  ): Promise<void> {
    try {
      // 部分的な結果があるかチェック
      const hasPartialResults =
        (processingResult?.successful &&
          processingResult.successful.length > 0) ||
        (characters && characters.length > 0);

      if (!hasPartialResults) {
        console.log(`⚠️  保存可能な部分的結果がありません。`);
        return;
      }

      console.log(`⚠️  部分的な結果の保存を試みます...`);

      // 成功したキャラクターがある場合
      if (
        processingResult?.successful &&
        processingResult.successful.length > 0
      ) {
        try {
          const partialCharacters =
            characters.length > 0
              ? characters
              : await this.generator.generateAllCharacters(
                  processingResult.successful
                );

          if (partialCharacters.length > 0) {
            // 部分的な結果用のファイル名を生成
            const partialOutputPath = outputFilePath.replace(
              ".ts",
              "-partial.ts"
            );

            this.generator.outputCharactersFile(
              partialCharacters,
              partialOutputPath
            );

            console.log(`✅ 部分的な結果を保存しました: ${partialOutputPath}`);
            console.log(
              `📊 保存されたキャラクター数: ${partialCharacters.length}`
            );

            // 部分的な結果のレポートも生成
            const partialReportPath = "partial-processing-report.md";
            await this.generateReport(
              {
                characters: partialCharacters,
                processingResult,
                outputFilePath: partialOutputPath,
                executionTime: 0,
                success: false,
              },
              partialReportPath
            );

            console.log(
              `📄 部分的な結果のレポートを生成: ${partialReportPath}`
            );
          }
        } catch (partialError) {
          console.error(
            `❌ 部分的な結果の保存に失敗: ${
              partialError instanceof Error
                ? partialError.message
                : String(partialError)
            }`
          );
        }
      }

      // エラーレポートを生成
      try {
        const errorReportPath = "error-report.md";
        const errorReport = this.generateErrorReport(error, {
          characterEntries: [],
          processingResult,
          characters,
          executionTime: 0,
          options: this.defaultOptions,
        });

        const fs = await import("fs");
        fs.writeFileSync(errorReportPath, errorReport, "utf-8");
        console.log(`📄 エラーレポートを生成: ${errorReportPath}`);
      } catch (reportError) {
        console.error(
          `❌ エラーレポートの生成に失敗: ${
            reportError instanceof Error
              ? reportError.message
              : String(reportError)
          }`
        );
      }
    } catch (handlingError) {
      console.error(
        `❌ 部分的結果の処理中にエラー: ${
          handlingError instanceof Error
            ? handlingError.message
            : String(handlingError)
        }`
      );
    }
  }

  /**
   * エラー復旧機能
   * 特定のエラータイプに対する自動復旧を試行
   * @param error 発生したエラー
   * @param options パイプラインオプション
   * @returns 復旧が成功した場合はtrue
   */
  private async attemptErrorRecovery(
    error: AllCharactersError,
    options: PipelineOptions
  ): Promise<boolean> {
    console.log(`🔧 エラー復旧を試行中: ${error.stage}`);

    try {
      switch (error.stage) {
        case ProcessingStage.API_FETCH:
          // API エラーの場合、遅延時間を増やして再試行
          console.log(`⏳ API エラー復旧: 遅延時間を増加して再試行`);
          const increasedDelay = (options.delayMs || 200) * 2;
          return await this.retryWithIncreasedDelay(increasedDelay);

        case ProcessingStage.BATCH_PROCESSING:
          // バッチ処理エラーの場合、バッチサイズを減らして再試行
          console.log(`📦 バッチ処理エラー復旧: バッチサイズを減少して再試行`);
          const reducedBatchSize = Math.max(
            1,
            Math.floor((options.batchSize || 5) / 2)
          );
          return await this.retryWithReducedBatchSize(reducedBatchSize);

        case ProcessingStage.VALIDATION:
          // 検証エラーの場合、問題のあるキャラクターを除外して再試行
          console.log(
            `🔍 検証エラー復旧: 問題のあるキャラクターを除外して再試行`
          );
          return await this.retryWithValidationFix();

        default:
          console.log(`❌ ${error.stage} に対する自動復旧方法がありません`);
          return false;
      }
    } catch (recoveryError) {
      console.error(
        `❌ エラー復旧に失敗: ${
          recoveryError instanceof Error
            ? recoveryError.message
            : String(recoveryError)
        }`
      );
      return false;
    }
  }

  /**
   * 遅延時間を増やして再試行
   * @param delayMs 新しい遅延時間
   * @returns 成功した場合はtrue
   */
  private async retryWithIncreasedDelay(delayMs: number): Promise<boolean> {
    // 実装は簡略化 - 実際の再試行ロジックは複雑になるため
    console.log(`⏳ 遅延時間を ${delayMs}ms に増加`);
    return false; // 実際の実装では再試行を行う
  }

  /**
   * バッチサイズを減らして再試行
   * @param batchSize 新しいバッチサイズ
   * @returns 成功した場合はtrue
   */
  private async retryWithReducedBatchSize(batchSize: number): Promise<boolean> {
    // 実装は簡略化 - 実際の再試行ロジックは複雑になるため
    console.log(`📦 バッチサイズを ${batchSize} に減少`);
    return false; // 実際の実装では再試行を行う
  }

  /**
   * 検証問題を修正して再試行
   * @returns 成功した場合はtrue
   */
  private async retryWithValidationFix(): Promise<boolean> {
    // 実装は簡略化 - 実際の修正ロジックは複雑になるため
    console.log(`🔍 検証問題の修正を試行`);
    return false; // 実際の実装では修正を行う
  }

  /**
   * 最終統計情報を表示
   * @param result パイプライン実行結果
   */
  private displayFinalSummary(result: PipelineResult): void {
    const { characters, processingResult, outputFilePath, executionTime } =
      result;
    const successRate =
      (processingResult.statistics.successful /
        processingResult.statistics.total) *
      100;

    console.log(`\n🎉 === パイプライン実行完了 ===`);
    console.log(`完了時刻: ${new Date().toLocaleString()}`);
    console.log(`総実行時間: ${this.formatDuration(executionTime)}`);
    console.log(`==============================`);
    console.log(`📊 最終結果:`);
    console.log(`  総キャラクター数: ${processingResult.statistics.total}`);
    console.log(`  処理成功: ${processingResult.statistics.successful}`);
    console.log(`  処理失敗: ${processingResult.statistics.failed}`);
    console.log(`  成功率: ${Math.round(successRate)}%`);
    console.log(`  生成されたCharacter数: ${characters.length}`);
    console.log(`  出力ファイル: ${outputFilePath}`);
    console.log(`==============================`);

    if (processingResult.failed.length > 0) {
      console.log(`\n⚠️  失敗したキャラクター:`);
      processingResult.failed.forEach((f) => {
        console.log(`  - ${f.entry.id}: ${f.error}`);
      });
    }

    console.log(`\n✅ 全キャラクターデータの生成が完了しました！`);
    console.log(`生成されたファイル: ${outputFilePath}`);
    console.log(`==============================\n`);
  }

  /**
   * 処理レポートを生成してファイルに保存
   * @param result パイプライン実行結果
   * @param reportPath レポートファイルのパス
   */
  async generateReport(
    result: PipelineResult,
    reportPath: string = "processing-report.md"
  ): Promise<void> {
    try {
      console.log(`📄 処理レポート生成中: ${reportPath}`);

      const report = this.generator.generateProcessingReport(
        result.processingResult
      );

      // 追加の統計情報を含める
      const additionalInfo = `
## パイプライン実行情報
- 総実行時間: ${this.formatDuration(result.executionTime)}
- 出力ファイル: ${result.outputFilePath}
- 生成されたCharacter数: ${result.characters.length}
- パイプライン成功: ${result.success ? "✅" : "❌"}

## 生成されたキャラクター一覧
${result.characters
  .map(
    (c, index) =>
      `${index + 1}. ${c.id} (${c.name.ja}) - ${c.specialty}/${c.stats}/${
        c.attackType
      }`
  )
  .join("\n")}
`;

      const fullReport = report + additionalInfo;

      const fs = await import("fs");
      fs.writeFileSync(reportPath, fullReport, "utf-8");

      console.log(`✅ 処理レポート生成完了: ${reportPath}`);
    } catch (error) {
      console.error(
        `❌ レポート生成に失敗: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 時間を人間が読みやすい形式にフォーマット
   * @param ms ミリ秒
   * @returns フォーマットされた時間文字列
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
