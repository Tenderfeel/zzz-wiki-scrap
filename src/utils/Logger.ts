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
