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

  // WeaponIconProcessor関連
  WEAPON_ICON_PROCESSING_START: "武器アイコン処理開始",
  WEAPON_ICON_PROCESSING_SUCCESS: "武器アイコン処理完了",
  WEAPON_ICON_PROCESSING_ERROR: "武器アイコン処理エラー",
  WEAPON_ICON_PROCESSING_RETRY: "武器アイコン処理リトライ",
  WEAPON_ICON_PROCESSING_FINAL_FAILURE: "武器アイコン処理最終失敗",
  WEAPON_ICON_URL_EXTRACTION_START: "武器アイコンURL抽出開始",
  WEAPON_ICON_URL_EXTRACTION_SUCCESS: "武器アイコンURL抽出成功",
  WEAPON_ICON_URL_EXTRACTION_ERROR: "武器アイコンURL抽出エラー",
  WEAPON_ICON_URL_NOT_FOUND: "武器アイコンURLが見つかりません",
  WEAPON_ICON_URL_INVALID: "無効な武器アイコンURL",
  WEAPON_ICON_DOWNLOAD_START: "武器アイコンダウンロード開始",
  WEAPON_ICON_DOWNLOAD_SUCCESS: "武器アイコンダウンロード完了",
  WEAPON_ICON_DOWNLOAD_ERROR: "武器アイコンダウンロードエラー",
  WEAPON_ICON_VALIDATION_START: "武器アイコンファイル検証開始",
  WEAPON_ICON_VALIDATION_SUCCESS: "武器アイコンファイル検証成功",
  WEAPON_ICON_VALIDATION_ERROR: "武器アイコンファイル検証エラー",
  WEAPON_ICON_FILE_EXISTS: "既存武器アイコンファイルをスキップ",
  WEAPON_ICON_DIRECTORY_CREATED: "武器アイコンディレクトリを作成しました",
  WEAPON_ICON_SECURITY_VALIDATION_ERROR: "武器アイコンセキュリティ検証に失敗",
  WEAPON_ICON_CONTENT_TYPE_INVALID: "無効な武器アイコンコンテンツタイプ",
  WEAPON_ICON_RARITY_FILTERED: "レアリティフィルタにより武器をスキップ",

  // WeaponIconGenerator関連
  WEAPON_ICON_GENERATION_START: "武器アイコンダウンロード処理を開始",
  WEAPON_ICON_GENERATION_SUCCESS: "武器アイコンダウンロード処理完了",
  WEAPON_ICON_GENERATION_ERROR: "武器アイコンダウンロード処理でエラーが発生",
  WEAPON_ICON_BATCH_START: "武器アイコンバッチ処理開始",
  WEAPON_ICON_BATCH_PROGRESS: "武器アイコンバッチ処理進捗",
  WEAPON_ICON_BATCH_ERROR: "武器アイコンバッチ処理エラー",
  WEAPON_ICON_BATCH_INDIVIDUAL_FALLBACK: "武器アイコン個別処理にフォールバック",
  WEAPON_ICON_OUTPUT_DIRECTORY_VALIDATION: "武器アイコン出力ディレクトリ検証",
  WEAPON_ICON_OUTPUT_DIRECTORY_CREATED: "武器アイコン出力ディレクトリを作成",
  WEAPON_ICON_OUTPUT_DIRECTORY_WRITE_TEST:
    "武器アイコン出力ディレクトリ書き込み権限確認",
  WEAPON_ICON_STATISTICS_SUMMARY: "武器アイコンダウンロード統計",
  WEAPON_ICON_PERFORMANCE_METRICS: "武器アイコンパフォーマンス統計",

  // 詳細デバッグ関連
  WEAPON_ICON_DEBUG_PROCESSING_START: "武器アイコン処理開始 - デバッグ情報",
  WEAPON_ICON_DEBUG_PROCESSING_SUCCESS: "武器アイコン処理成功 - デバッグ情報",
  WEAPON_ICON_DEBUG_PROCESSING_ERROR: "武器アイコン処理エラー - デバッグ情報",
  WEAPON_ICON_DEBUG_FINAL_FAILURE: "武器アイコン処理最終失敗 - デバッグ情報",
  WEAPON_ICON_DEBUG_GENERATION_COMPLETE: "武器アイコン生成完了 - デバッグ情報",
  WEAPON_ICON_DEBUG_GENERATION_ERROR: "武器アイコン生成エラー - デバッグ情報",
  WEAPON_ICON_DEBUG_MAIN_ERROR: "メイン処理エラー - デバッグ情報",

  // パフォーマンス監視関連
  WEAPON_ICON_PERFORMANCE_START: "武器アイコン処理パフォーマンス監視開始",
  WEAPON_ICON_PERFORMANCE_END: "武器アイコン処理パフォーマンス監視終了",
  WEAPON_ICON_MEMORY_USAGE: "武器アイコン処理メモリ使用量",
  WEAPON_ICON_TIMING_METRICS: "武器アイコン処理タイミング統計",

  // エラー回復関連
  WEAPON_ICON_ERROR_RECOVERY_START: "武器アイコンエラー回復処理開始",
  WEAPON_ICON_ERROR_RECOVERY_SUCCESS: "武器アイコンエラー回復処理成功",
  WEAPON_ICON_ERROR_RECOVERY_FAILURE: "武器アイコンエラー回復処理失敗",

  // DriverDisc処理関連
  DRIVER_DISC_PROCESSING_START: "ドライバーディスク処理開始",
  DRIVER_DISC_PROCESSING_SUCCESS: "ドライバーディスク処理完了",
  DRIVER_DISC_PROCESSING_ERROR: "ドライバーディスク処理エラー",
  DRIVER_DISC_PROCESSING_RETRY: "ドライバーディスク処理リトライ",
  DRIVER_DISC_PROCESSING_FINAL_FAILURE: "ドライバーディスク処理最終失敗",
  DRIVER_DISC_PARSING_START: "ドライバーディスクリスト解析開始",
  DRIVER_DISC_PARSING_SUCCESS: "ドライバーディスクリスト解析成功",
  DRIVER_DISC_PARSING_ERROR: "ドライバーディスクリスト解析エラー",
  DRIVER_DISC_API_FETCH_START: "ドライバーディスクAPI取得開始",
  DRIVER_DISC_API_FETCH_SUCCESS: "ドライバーディスクAPI取得成功",
  DRIVER_DISC_API_FETCH_ERROR: "ドライバーディスクAPI取得エラー",
  DRIVER_DISC_MAPPING_START: "ドライバーディスクデータマッピング開始",
  DRIVER_DISC_MAPPING_SUCCESS: "ドライバーディスクデータマッピング成功",
  DRIVER_DISC_MAPPING_ERROR: "ドライバーディスクデータマッピングエラー",
  DRIVER_DISC_GENERATION_START: "ドライバーディスクファイル生成開始",
  DRIVER_DISC_GENERATION_SUCCESS: "ドライバーディスクファイル生成完了",
  DRIVER_DISC_GENERATION_ERROR: "ドライバーディスクファイル生成エラー",
  DRIVER_DISC_VALIDATION_START: "ドライバーディスクデータ検証開始",
  DRIVER_DISC_VALIDATION_SUCCESS: "ドライバーディスクデータ検証成功",
  DRIVER_DISC_VALIDATION_ERROR: "ドライバーディスクデータ検証エラー",
  DRIVER_DISC_BATCH_START: "ドライバーディスクバッチ処理開始",
  DRIVER_DISC_BATCH_PROGRESS: "ドライバーディスクバッチ処理進捗",
  DRIVER_DISC_BATCH_ERROR: "ドライバーディスクバッチ処理エラー",
  DRIVER_DISC_BATCH_INDIVIDUAL_FALLBACK:
    "ドライバーディスク個別処理にフォールバック",
  DRIVER_DISC_STATISTICS_SUMMARY: "ドライバーディスク処理統計",
  DRIVER_DISC_PERFORMANCE_METRICS: "ドライバーディスクパフォーマンス統計",
  DRIVER_DISC_ERROR_RECOVERY_START: "ドライバーディスクエラー回復処理開始",
  DRIVER_DISC_ERROR_RECOVERY_SUCCESS: "ドライバーディスクエラー回復処理成功",
  DRIVER_DISC_ERROR_RECOVERY_FAILURE: "ドライバーディスクエラー回復処理失敗",
  DRIVER_DISC_GRACEFUL_DEGRADATION: "ドライバーディスクグレースフル劣化実行",
  DRIVER_DISC_PARTIAL_DATA_PROCESSING: "ドライバーディスク部分データ処理",
  DRIVER_DISC_SPECIALTY_EXTRACTION_START: "ドライバーディスク特性抽出開始",
  DRIVER_DISC_SPECIALTY_EXTRACTION_SUCCESS: "ドライバーディスク特性抽出成功",
  DRIVER_DISC_SPECIALTY_EXTRACTION_ERROR: "ドライバーディスク特性抽出エラー",
  DRIVER_DISC_SET_EFFECT_EXTRACTION_START:
    "ドライバーディスクセット効果抽出開始",
  DRIVER_DISC_SET_EFFECT_EXTRACTION_SUCCESS:
    "ドライバーディスクセット効果抽出成功",
  DRIVER_DISC_SET_EFFECT_EXTRACTION_ERROR:
    "ドライバーディスクセット効果抽出エラー",
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
