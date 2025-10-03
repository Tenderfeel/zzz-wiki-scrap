// データ処理用の中間型定義

export interface BasicCharacterInfo {
  id: string;
  name: string;
  specialty: string;
  stats: string;
  attackType: string;
  rarity: string;
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

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}
