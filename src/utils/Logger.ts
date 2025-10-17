/**
 * ログレベル定義
 */
export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

/**
 * ログメッセージテンプレート
 */
export const LogMessages = {
  // CharacterGenerator関連
  CHARACTER_GENERATION_START: "Starting character generation",
  CHARACTER_GENERATION_SUCCESS: "Character generation completed successfully",
  CHARACTER_GENERATION_ERROR: "Error during character generation",

  // NameResolver関連
  NAME_MAPPING_LOAD_START: "名前マッピング設定ファイルの読み込みを開始",
  NAME_MAPPING_LOAD_SUCCESS: "名前マッピングを読み込みました",
  NAME_MAPPING_LOAD_ERROR: "名前マッピングの読み込み中にエラーが発生しました",
  NAME_MAPPING_FILE_NOT_FOUND: "名前マッピング設定ファイルが見つかりません",
  NAME_MAPPING_INVALID_FORMAT: "名前マッピング設定ファイルの形式が無効です",
  NAME_MAPPING_VALIDATION_START: "名前マッピングの検証を開始",
  NAME_MAPPING_VALIDATION_SUCCESS: "名前マッピング検証完了",
  NAME_MAPPING_RESOLVE_SUCCESS: "名前マッピングを取得",
  NAME_MAPPING_RESOLVE_NOT_FOUND: "名前マッピングが見つかりません",
  NAME_MAPPING_FILE_ACCESS_ERROR: "名前マッピングファイルへのアクセスに失敗",
  NAME_MAPPING_FALLBACK_MODE: "名前マッピング機能がフォールバックモードで動作",
  NAME_MAPPING_VALIDATION_ERROR: "名前マッピング検証でエラーが検出されました",
  NAME_MAPPING_CHARACTER_INVALID:
    "無効なキャラクターマッピングが検出されました",

  // DataMapper関連
  NAME_FALLBACK_START: "フォールバック処理を開始",
  NAME_FALLBACK_USE_PREDEFINED: "事前定義名を使用",
  NAME_FALLBACK_USE_API: "APIレスポンスの名前にフォールバック",
  NAME_FALLBACK_SUCCESS: "フォールバック名を使用",
  NAME_FALLBACK_ERROR: "フォールバック処理中にエラーが発生",
  NAME_FALLBACK_INVALID_INPUT: "フォールバック処理で無効な入力が検出されました",
  NAME_FALLBACK_MAPPING_ATTEMPT: "名前マッピング取得を試行",
  NAME_FALLBACK_API_NAMES_USED:
    "APIレスポンスの名前を使用してフォールバック完了",
  NAME_FALLBACK_WARNING_ISSUED: "名前マッピング不在による警告を発行",

  // エラーハンドリング関連
  ERROR_RECOVERY_ATTEMPT: "エラーからの回復を試行",
  ERROR_RECOVERY_SUCCESS: "エラーからの回復に成功",
  ERROR_RECOVERY_FAILED: "エラーからの回復に失敗",
  CRITICAL_ERROR_DETECTED: "重大なエラーが検出されました",
  GRACEFUL_DEGRADATION: "機能の段階的縮退を実行",

  // BompIconProcessor関連
  BOMP_ICON_PROCESSING_START: "ボンプアイコン処理開始",
  BOMP_ICON_PROCESSING_SUCCESS: "ボンプアイコン処理完了",
  BOMP_ICON_PROCESSING_ERROR: "ボンプアイコン処理エラー",
  BOMP_ICON_PROCESSING_RETRY: "ボンプアイコン処理リトライ",
  BOMP_ICON_PROCESSING_FINAL_FAILURE: "ボンプアイコン処理最終失敗",
  BOMP_ICON_URL_EXTRACTION_START: "アイコンURL抽出開始",
  BOMP_ICON_URL_EXTRACTION_SUCCESS: "アイコンURL抽出成功",
  BOMP_ICON_URL_EXTRACTION_ERROR: "アイコンURL抽出エラー",
  BOMP_ICON_URL_NOT_FOUND: "アイコンURLが見つかりません",
  BOMP_ICON_URL_INVALID: "無効なアイコンURL",
  BOMP_ICON_DOWNLOAD_START: "アイコンダウンロード開始",
  BOMP_ICON_DOWNLOAD_SUCCESS: "アイコンダウンロード完了",
  BOMP_ICON_DOWNLOAD_ERROR: "アイコンダウンロードエラー",
  BOMP_ICON_VALIDATION_START: "アイコンファイル検証開始",
  BOMP_ICON_VALIDATION_SUCCESS: "アイコンファイル検証成功",
  BOMP_ICON_VALIDATION_ERROR: "アイコンファイル検証エラー",
  BOMP_ICON_FILE_EXISTS: "既存ファイルをスキップ",
  BOMP_ICON_DIRECTORY_CREATED: "ディレクトリを作成しました",
  BOMP_ICON_SECURITY_VALIDATION_ERROR: "セキュリティ検証に失敗",
  BOMP_ICON_CONTENT_TYPE_INVALID: "無効なコンテンツタイプ",

  // BompIconGenerator関連
  BOMP_ICON_GENERATION_START: "ボンプアイコンダウンロード処理を開始",
  BOMP_ICON_GENERATION_SUCCESS: "ボンプアイコンダウンロード処理完了",
  BOMP_ICON_GENERATION_ERROR: "ボンプアイコンダウンロード処理でエラーが発生",
  BOMP_ICON_BATCH_START: "バッチ処理開始",
  BOMP_ICON_BATCH_PROGRESS: "バッチ処理進捗",
  BOMP_ICON_BATCH_ERROR: "バッチ処理エラー",
  BOMP_ICON_BATCH_INDIVIDUAL_FALLBACK: "個別処理にフォールバック",
  BOMP_ICON_OUTPUT_DIRECTORY_VALIDATION: "出力ディレクトリ検証",
  BOMP_ICON_OUTPUT_DIRECTORY_CREATED: "出力ディレクトリを作成",
  BOMP_ICON_OUTPUT_DIRECTORY_WRITE_TEST: "出力ディレクトリ書き込み権限確認",
  BOMP_ICON_STATISTICS_SUMMARY: "ボンプアイコンダウンロード統計",
  BOMP_ICON_PERFORMANCE_METRICS: "パフォーマンス統計",

  // Version 2.3 キャラクター処理関連
  VERSION23_PROCESSING_START: "バージョン2.3キャラクター処理を開始",
  VERSION23_PROCESSING_SUCCESS: "バージョン2.3キャラクター処理完了",
  VERSION23_PROCESSING_ERROR: "バージョン2.3キャラクター処理でエラーが発生",
  VERSION23_CHARACTER_START: "バージョン2.3キャラクター個別処理開始",
  VERSION23_CHARACTER_SUCCESS: "バージョン2.3キャラクター個別処理成功",
  VERSION23_CHARACTER_FAILURE: "バージョン2.3キャラクター個別処理失敗",
  VERSION23_CHARACTER_PARTIAL_SUCCESS: "バージョン2.3キャラクター部分的成功",
  VERSION23_CHARACTER_SKIPPED: "バージョン2.3キャラクター処理をスキップ",

  // 部分データ処理関連
  PARTIAL_DATA_DETECTION_START: "部分データ検出処理を開始",
  PARTIAL_DATA_DETECTION_SUCCESS: "部分データ検出完了",
  PARTIAL_DATA_PROCESSING_START: "部分データ処理を開始",
  PARTIAL_DATA_PROCESSING_SUCCESS: "部分データ処理完了",
  PARTIAL_DATA_PROCESSING_FAILURE: "部分データ処理失敗",
  PARTIAL_DATA_FIELD_MISSING: "データフィールドが欠損",
  PARTIAL_DATA_FIELD_RECOVERED: "欠損フィールドを回復",
  PARTIAL_DATA_EMPTY_VALUE_APPLIED: "空の値を適用",
  PARTIAL_DATA_VALIDATION_START: "部分データ検証開始",
  PARTIAL_DATA_VALIDATION_SUCCESS: "部分データ検証成功",
  PARTIAL_DATA_VALIDATION_FAILURE: "部分データ検証失敗",

  // エラー回復機能関連
  ERROR_RECOVERY_START: "エラー回復処理を開始",
  ERROR_RECOVERY_COMPLETE: "エラー回復処理成功",
  ERROR_RECOVERY_FAILURE: "エラー回復処理失敗",
  ERROR_RECOVERY_RETRY_ATTEMPT: "リトライ処理を実行",
  ERROR_RECOVERY_RETRY_SUCCESS: "リトライ処理成功",
  ERROR_RECOVERY_RETRY_FAILURE: "リトライ処理失敗",
  ERROR_RECOVERY_GRACEFUL_DEGRADATION: "グレースフル劣化を実行",
} as const;

/**
 * シンプルなロガークラス
 */
export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
    ];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: Record<string, any>
  ): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : "";
    return `[${timestamp}] [${level}] ${message}${contextStr}`;
  }

  public debug(message: string, context?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, context));
    }
  }

  public info(message: string, context?: Record<string, any>): void {
    if (
      this.shouldLog(LogLevel.INFO) &&
      process.env.NODE_ENV !== "test" &&
      process.env.VITEST !== "true"
    ) {
      console.info(this.formatMessage(LogLevel.INFO, message, context));
    }
  }

  public warn(message: string, context?: Record<string, any>): void {
    if (
      this.shouldLog(LogLevel.WARN) &&
      process.env.NODE_ENV !== "test" &&
      process.env.VITEST !== "true"
    ) {
      console.warn(this.formatMessage(LogLevel.WARN, message, context));
    }
  }

  public error(message: string, context?: Record<string, any>): void {
    if (
      this.shouldLog(LogLevel.ERROR) &&
      process.env.NODE_ENV !== "test" &&
      process.env.VITEST !== "true"
    ) {
      console.error(this.formatMessage(LogLevel.ERROR, message, context));
    }
  }
}

/**
 * デフォルトロガーインスタンス
 */
export const logger = Logger.getInstance();
