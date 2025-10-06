// データ処理用の中間型定義

export interface BasicCharacterInfo {
  id: string;
  name: string;
  specialty: string;
  stats: string;
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
