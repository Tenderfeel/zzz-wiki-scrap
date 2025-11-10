// データ処理用の中間型定義

export interface BasicCharacterInfo {
  id: string;
  name: string;
  specialty: string;
  stats: string; // 処理中は文字列、最終的にStats[]に変換される
  rarity: string;
  releaseVersion?: number; // 実装バージョン（オプショナル、処理中に追加される）
}

export interface FactionInfo {
  id: number;
  name: string;
}

export interface AttributesInfo {
  ascensionData: string; // JSON文字列
}

export interface ProcessedData {
  basicInfo: BasicCharacterInfo;
  factionInfo: FactionInfo;
  attributesInfo: AttributesInfo;
  assistType?: import("./index").AssistType;
}

export interface LevelBasedStats {
  hp: number[];
  atk: number[];
  def: number[];
}

export interface FixedStats {
  impact: number;
  critRate: number;
  critDmg: number;
  anomalyMastery: number;
  anomalyProficiency: number;
  penRatio: number;
  energy: number;
}

// バッチ処理用の型定義
export interface BilingualApiData {
  ja: import("./api").ApiResponse;
  en: import("./api").ApiResponse;
}

export interface ApiDataResult {
  entry: import("./index").CharacterEntry;
  data: BilingualApiData | null;
  error?: string;
}

export interface BatchProcessingOptions {
  batchSize?: number;
  delayMs?: number;
  maxRetries?: number;
}

export interface ProcessingStatistics {
  total: number;
  successful: number;
  failed: number;
  processingTime: number;
  startTime: Date;
  endTime?: Date;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

// ボンプ処理用の型定義
export interface BasicBompInfo {
  id: string;
  name: string;
  stats: import("./index").Stats[]; // 配列形式の属性値
  rarity: string; // 処理中は文字列（"A級"、"S級"）、最終的にRarityに変換される
  releaseVersion?: number;
}

export interface ProcessedBompData {
  basicInfo: BasicBompInfo;
  attributesInfo: AttributesInfo;
  extraAbility: string;
  factionIds?: number[];
}

export interface BompProcessingResult {
  successful: import("./index").Bomp[];
  failed: {
    bompId: string;
    error: string;
    partialData?: Partial<import("./index").Bomp>;
  }[];
  statistics: ProcessingStatistics;
}

// ボンプアイコンダウンロード用の型定義
export interface BompIcon {
  bompId: string; // Scraping.mdのリンクテキスト
  iconUrl: string; // 元のHoyoLab画像URL
  localPath: string; // ローカルファイルパス
  fileSize: number; // ファイルサイズ（バイト）
  downloadedAt: Date; // ダウンロード日時
}

export interface BompIconInfo {
  bompId: string;
  iconUrl: string;
  localPath: string;
  fileSize?: number;
  downloadedAt?: Date;
}

export interface BompIconDownloadResult {
  success: boolean;
  bompId: string;
  iconInfo?: BompIconInfo;
  error?: string;
  retryCount: number;
}

export interface BompIconConfig {
  outputDirectory: string; // デフォルト: "assets/images/bomps"
  maxConcurrency: number; // デフォルト: 3
  retryAttempts: number; // デフォルト: 3
  retryDelayMs: number; // デフォルト: 1000
  requestDelayMs: number; // デフォルト: 500
  skipExisting: boolean; // デフォルト: true
  validateDownloads: boolean; // デフォルト: true
  maxFileSizeMB?: number; // デフォルト: 10
  allowedExtensions?: string[]; // デフォルト: [".png", ".jpg", ".jpeg", ".webp"]
  strictSecurity?: boolean; // デフォルト: true
}

export interface BompIconProcessingResult {
  successful: BompIconInfo[];
  failed: {
    bompId: string;
    error: string;
    iconUrl?: string;
  }[];
  statistics: {
    total: number;
    successful: number;
    failed: number;
    totalSizeBytes: number;
    processingTimeMs: number;
  };
}

// 音動機処理用の型定義
export interface WeaponProcessingConfig {
  weaponListPath: string; // weapon-list.jsonのパス
  outputPath: string; // 出力ファイルパス
  includeRarities: ("A" | "S")[]; // 処理対象レア度
  batchSize: number; // バッチサイズ
  delayMs: number; // 遅延時間
  maxRetries: number; // 最大リトライ回数
  skipAgentValidation: boolean; // エージェント検証スキップ
  enableSkillExtraction: boolean; // スキル情報抽出の有効化
  enableValidation: boolean; // データ検証の有効化
  logLevel: "error" | "warn" | "info" | "debug"; // ログレベル
}

// 武器アイコンダウンロード用の型定義
export interface WeaponIcon {
  weaponId: string; // 生成された武器ID（entry_page_id）
  weaponName: string; // 武器の名前
  entryPageId: string; // entry_page_id
  iconUrl: string; // 元のHoyoLab画像URL
  localPath: string; // ローカルファイルパス
  fileSize: number; // ファイルサイズ（バイト）
  downloadedAt: Date; // ダウンロード日時
}

export interface WeaponIconInfo {
  weaponId: string;
  weaponName: string;
  iconUrl: string;
  localPath: string;
  fileSize?: number;
  downloadedAt?: Date;
}

export interface WeaponIconDownloadResult {
  success: boolean;
  weaponId: string;
  iconInfo?: WeaponIconInfo;
  error?: string;
  retryCount: number;
}

export interface WeaponIconConfig {
  outputDirectory: string; // デフォルト: "assets/images/weapons"
  maxConcurrency: number; // デフォルト: 3
  retryAttempts: number; // デフォルト: 3
  retryDelayMs: number; // デフォルト: 1000
  requestDelayMs: number; // デフォルト: 500
  skipExisting: boolean; // デフォルト: true
  validateDownloads: boolean; // デフォルト: true
  maxFileSizeMB?: number; // デフォルト: 10
  allowedExtensions?: string[]; // デフォルト: [".png", ".jpg", ".jpeg", ".webp"]
  strictSecurity?: boolean; // デフォルト: true
}

export interface WeaponIconProcessingResult {
  successful: WeaponIconInfo[];
  failed: {
    weaponId: string;
    weaponName: string;
    error: string;
    iconUrl?: string;
  }[];
  statistics: {
    total: number;
    successful: number;
    failed: number;
    totalSizeBytes: number;
    processingTimeMs: number;
  };
}

export interface WeaponEntry {
  entry_page_id: string;
  name: string;
  icon_url: string;
  display_field?: any;
  filter_values?: {
    w_engine_rarity?: {
      values?: string[];
    };
  };
  desc?: string;
}

// ドライバーディスク処理用の型定義
export interface DriverDiscListItem {
  entry_page_id: string;
  name: string;
  icon_url: string;
  display_field: {
    four_set_effect: string;
    two_set_effect: string;
    single_set_effect?: string;
  };
  filter_values?: any;
  desc?: string;
}

export interface DriverDiscListJsonData {
  retcode: number;
  message: string;
  data: {
    list: DriverDiscListItem[];
    total: string;
  };
}

// ドライバーディスク処理用の型定義
export interface DriverDiscEntry {
  id: string; // entry_page_id
  name: string; // 日本語名
  iconUrl: string; // アイコンURL
}

export interface BasicDriverDiscInfo {
  id: number;
  name: string;
  releaseVersion?: number;
}

export interface SetEffectInfo {
  fourSetEffect: string;
  twoSetEffect: string;
}

export interface ProcessedDriverDiscData {
  basicInfo: BasicDriverDiscInfo;
  setEffectInfo: SetEffectInfo;
  specialty: import("./index").Specialty;
}

export interface DriverDiscProcessingConfig {
  discListPath: string; // disc-list.jsonのパス
  outputPath: string; // 出力ファイルパス
  batchSize: number; // バッチサイズ
  delayMs: number; // 遅延時間
  maxRetries: number; // 最大リトライ回数
  enableValidation: boolean; // データ検証の有効化
  logLevel: "error" | "warn" | "info" | "debug"; // ログレベル
}

export interface DriverDiscProcessingResult {
  successful: import("./index").DriverDisc[];
  failed: {
    discId: string;
    error: string;
    partialData?: Partial<import("./index").DriverDisc>;
  }[];
  statistics: ProcessingStatistics;
}

export interface DriverDiscErrorContext {
  discId: string;
  discName?: string;
  operation: string;
  attempt?: number;
  maxAttempts?: number;
  processingPhase: "parsing" | "api_fetch" | "mapping" | "generation";
  errorType:
    | "network"
    | "api"
    | "data_structure"
    | "validation"
    | "system"
    | "unknown";
  severity: "low" | "moderate" | "high" | "critical";
  recoveryStrategy:
    | "retry"
    | "skip"
    | "partial_data"
    | "graceful_degradation"
    | "abort";
}
