// 言語タイプ
export type Lang = "en" | "ja";

// 特性
export type Specialty =
  | "attack" // 強攻
  | "stun" // 撃破
  | "anomaly" // 異常
  | "support" // 支援
  | "defense" // 防護
  | "rupture"; // 命破

export type SpecialtyData = {
  id: Specialty;
  label: { [key in Lang]: string };
};

// 属性
export type Stats =
  | "ether" // エーテル
  | "fire" // 炎
  | "ice" // 氷
  | "physical" // 物理
  | "electric" // 電気
  | "frost" // 霜烈
  | "auricInk"; // 玄墨

export type StatsData = {
  id: Stats;
  label: { [key in Lang]: string };
};

// レア度
export type Rarity = "A" | "S";

// 属性データ
export type Attributes = {
  hp: number[]; // HP（7レベル分）
  atk: number[]; // 攻撃力（7レベル分）
  def: number[]; // 防御力（7レベル分）
  impact: number; // 衝撃力
  critRate: number; // 会心率
  critDmg: number; // 会心ダメージ
  anomalyMastery: number; // 異常マスタリー
  anomalyProficiency: number; // 異常掌握
  penRatio: number; // 貫通率
  energy: number; // エネルギー自動回復
};

// 陣営
export type Faction = {
  id: number;
  name: { [key in Lang]: string };
};

// 名前マッピング
export interface NameMapping {
  ja: string;
  en: string;
}

export interface NameMappings {
  [characterId: string]: NameMapping;
}

// キャラクターエントリー（Scraping.mdから抽出される情報）
export type CharacterEntry = {
  id: string; // リンクテキスト（例: "lycaon"）
  pageId: number; // API用ページID（例: 28）
  wikiUrl: string; // wiki URL
};

// ボンプエントリー（Scraping.mdから抽出される情報）
export type BompEntry = {
  id: string; // リンクテキスト（例: "excaliboo"）
  pageId: number; // API用ページID（例: 912）
  wikiUrl: string; // wiki URL
  jaName: string; // 日本語名（例: "セイケンボンプ"）
};

// list.json用の型定義
export interface ValueType {
  id: string;
  value: string;
  mi18n_key: string;
  icon: string;
  enum_string: string;
}

export interface CharacterListItem {
  entry_page_id: string;
  name: string;
  icon_url: string;
  display_field: {
    materials: string;
    [key: string]: string; // attr_level_1, attr_level_10 など
  };
  filter_values: {
    agent_stats?: {
      values: string[];
      value_types: ValueType[];
      key: null;
    };
    agent_faction?: {
      values: string[];
      value_types: ValueType[];
      key: null;
    };
    agent_rarity?: {
      values: string[];
      value_types: ValueType[];
      key: null;
    };
    agent_specialties?: {
      values: string[];
      value_types: ValueType[];
      key: null;
    };
  };
  desc: string;
}

export interface ListJsonData {
  retcode: number;
  message: string;
  data: {
    list: CharacterListItem[];
  };
}

export type AssistType =
  | "evasive" // 回避支援
  | "defensive"; // パリィ支援

// キャラクター
export type Character = {
  id: string; // Scraping.mdのリンクテキストと同じ
  name: { [key in Lang]: string }; // 多言語名
  fullName: { [key in Lang]: string }; // 多言語フルネーム
  specialty: Specialty; // 特性
  stats: Stats[]; // 属性（配列形式）
  assistType?: AssistType; // 支援タイプ（オプショナル）
  faction: number; // 陣営ID
  rarity: Rarity; // レア度
  attr: Attributes; // ステータス
  releaseVersion?: number; // 実装バージョン（例: 1.0, 1.1）
};

// ボンプ
export type Bomp = {
  id: string; // Scraping.mdのリンクテキストと同じ
  name: { [key in Lang]: string }; // 多言語名
  stats: Stats[]; // 属性（配列形式）
  rarity: Rarity; // レア度
  releaseVersion?: number; // 実装バージョン（例: 1.0, 1.1）
  faction: number[]; // 陣営ID（空配列の場合は陣営なし）
  attr: Attributes; // ステータス
  extraAbility: string; // 『追加能力』
};

// ボンプ処理用の中間データ型
export interface BasicBompInfo {
  id: string;
  name: string;
  stats: string; // 処理中は文字列、最終的にStats[]に変換される
  rarity: string; // 処理中は文字列（"A級"、"S級"）、最終的にRarityに変換される
  releaseVersion?: number;
}

export interface AttributesInfo {
  hp: number[];
  atk: number[];
  def: number[];
  impact: number;
  critRate: number;
  critDmg: number;
  anomalyMastery: number;
  anomalyProficiency: number;
  penRatio: number;
  energy: number;
}

export interface ProcessedBompData {
  basicInfo: BasicBompInfo;
  attributesInfo: AttributesInfo;
  extraAbility: string;
  factionIds?: number[];
}

// ボンプ処理設定
export interface BompProcessingConfig {
  batchSize: number;
  delayMs: number;
  maxRetries: number;
  outputPath: string;
  enableValidation: boolean;
  scrapingFilePath: string;
  reportOutputPath: string;
  minSuccessRate: number;
  logLevel: string;
  enableDebugMode: boolean;
  maxConcurrency?: number;
  enableMemoryOptimization?: boolean;
  memoryThresholdMB?: number;
  gcInterval?: number;
  enableEnhancedProgress?: boolean;
  progressUpdateInterval?: number;
  showMemoryUsage?: boolean;
  showPerformanceMetrics?: boolean;
  showDetailedTiming?: boolean;
  progressBarWidth?: number;
  useColors?: boolean;
  enableDetailedLogging?: boolean;
  environments?: {
    [key: string]: Partial<BompProcessingConfig>;
  };
}

// ボンプ処理結果
export interface BompProcessingResult {
  successful: Bomp[];
  failed: {
    bompId: string;
    error: string;
    partialData?: Partial<Bomp>;
  }[];
  statistics: ProcessingStatistics;
}

// 処理統計
export interface ProcessingStatistics {
  totalProcessed: number;
  successful: number;
  failed: number;
  successRate: number;
  totalTime: number;
  averageTimePerItem: number;
  memoryUsage?: {
    peak: number;
    average: number;
  };
}

export type DeadlyAssultEnemy = {
  id: string;
  name: { [key in Lang]: string };
  weaknesses: Stats[];
  resistances: Stats[];
  detail: { [key in Lang]: string[] };
  reccomend: {
    assistType: AssistType[];
    speciality: Specialty[];
  };
};

// 音動機関連の型定義

// 音動機エントリー（weapon-list.jsonから抽出される情報）
export type WeaponEntry = {
  id: string; // entry_page_id
  name: string; // 日本語名
  rarity: "A" | "S"; // レア度（Bは除外）
  specialty?: string; // 特性（filter_valuesから抽出）
};

// 音動機属性データ
export type WeaponAttributes = {
  hp: number[]; // 7レベル分（該当データなしの場合は空配列）
  atk: number[]; // 7レベル分（該当データなしの場合は空配列）
  def: number[]; // 7レベル分（該当データなしの場合は空配列）
  impact: number[]; // 7レベル分（該当データなしの場合は空配列）
  critRate: number[]; // 7レベル分（該当データなしの場合は空配列）
  critDmg: number[]; // 7レベル分（該当データなしの場合は空配列）
  anomalyMastery: number[]; // 7レベル分（該当データなしの場合は空配列）
  anomalyProficiency: number[]; // 7レベル分（該当データなしの場合は空配列）
  penRatio: number[]; // 7レベル分（該当データなしの場合は空配列）
  energy: number[]; // 7レベル分（該当データなしの場合は空配列）
};

// 属性タイプ
export type Attribute =
  | "hp"
  | "atk"
  | "def"
  | "impact"
  | "critRate"
  | "critDmg"
  | "anomalyMastery"
  | "anomalyProficiency"
  | "penRatio"
  | "energy";

// 音動機
export type Weapon = {
  id: number; // pageId
  name: { [key in Lang]: string }; // 多言語名
  equipmentSkillName: { [key in Lang]: string }; // スキル名
  equipmentSkillDesc: { [key in Lang]: string }; // スキル説明
  rarity: Rarity; // レア度（AまたはS）
  attr: WeaponAttributes; // 突破ステータス
  specialty: Specialty; // 特性
  stats: Stats[]; // 属性配列
  agentId: string; // 該当エージェントID
  baseAttr: Attribute; // 基礎ステータス
  advancedAttr: Attribute; // 上級ステータス
};

// 音動機処理用の中間データ型
export interface BasicWeaponInfo {
  id: string;
  name: string;
  rarity: string; // 処理中は文字列（"A"、"S"）、最終的にRarityに変換される
  specialty?: string; // 処理中は文字列、最終的にSpecialtyに変換される
}

export interface WeaponSkillInfo {
  equipmentSkillName: string;
  equipmentSkillDesc: string;
}

export interface WeaponAttributesInfo {
  hp: number[];
  atk: number[];
  def: number[];
  impact: number[];
  critRate: number[];
  critDmg: number[];
  anomalyMastery: number[];
  anomalyProficiency: number[];
  penRatio: number[];
  energy: number[];
}

export interface WeaponAgentInfo {
  agentId?: string; // 該当エージェントID（存在しない場合はundefined）
}

export interface ProcessedWeaponData {
  basicInfo: BasicWeaponInfo;
  skillInfo: WeaponSkillInfo;
  attributesInfo: WeaponAttributesInfo;
  agentInfo: WeaponAgentInfo;
}

// 音動機処理設定（processing.tsから再エクスポート）
export type { WeaponProcessingConfig } from "./processing";
