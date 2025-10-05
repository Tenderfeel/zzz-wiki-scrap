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
