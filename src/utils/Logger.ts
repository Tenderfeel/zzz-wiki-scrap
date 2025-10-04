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
  // AttackTypeFallbackService関連
  FALLBACK_SERVICE_INITIALIZED:
    "AttackTypeFallbackService initialized successfully",
  FALLBACK_SERVICE_INIT_ERROR: "Failed to initialize AttackTypeFallbackService",
  LIST_JSON_NOT_FOUND: "list.json file not found, fallback service disabled",
  LIST_JSON_PARSE_ERROR: "Failed to parse list.json file",
  CHARACTER_FOUND_IN_LIST: "Character found in list.json",
  CHARACTER_NOT_FOUND_IN_LIST: "Character not found in list.json",
  ATTACK_TYPE_MAPPED: "Attack type mapped from English to enum",
  UNKNOWN_ATTACK_TYPE: "Unknown attack type value, using default",

  // DataMapper関連
  FALLBACK_USED: "AttackType fallback used for character",
  WIKI_DATA_USED: "AttackType obtained from wiki data",
  MAPPING_FALLBACK_TO_DEFAULT: "Mapping fallback to default attack type",

  // CharacterGenerator関連
  CHARACTER_GENERATION_START: "Starting character generation",
  CHARACTER_GENERATION_SUCCESS: "Character generation completed successfully",
  CHARACTER_GENERATION_ERROR: "Error during character generation",
  ATTACK_TYPE_RETRIEVAL_METHOD: "Attack type retrieval method",
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
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage(LogLevel.INFO, message, context));
    }
  }

  public warn(message: string, context?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message, context));
    }
  }

  public error(message: string, context?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage(LogLevel.ERROR, message, context));
    }
  }
}

/**
 * デフォルトロガーインスタンス
 */
export const logger = Logger.getInstance();
