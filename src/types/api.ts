// API レスポンス型定義

export interface ApiResponse {
  retcode: number;
  message: string;
  data: {
    page: PageData;
  };
}

export interface PageData {
  id: string;
  name: string;
  agent_specialties: { values: string[] };
  agent_stats: { values: string[] };
  agent_attack_type: { values: string[] };
  agent_rarity: { values: string[] };
  agent_faction: { values: string[] };
  modules: Module[];
}

export interface Module {
  components: Component[];
}

export interface Component {
  component_id: string;
  data: string; // JSON文字列
}

// 昇格データ構造
export interface AscensionData {
  list: LevelData[];
}

export interface LevelData {
  key: string; // レベル ("1", "10", "20", etc.)
  combatList: CombatStat[];
}

export interface CombatStat {
  key: string; // ステータス名 ("HP", "攻撃力", etc.)
  values: [string, string]; // [強化前, 強化後]
}

// 基本情報データ構造
export interface BaseInfoData {
  list: BaseInfoItem[];
}

export interface BaseInfoItem {
  key: string;
  values: string[];
  ep_id?: string; // 陣営ID
}
