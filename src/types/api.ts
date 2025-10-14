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
  icon_url?: string; // ボンプアイコンURL（ボンプAPI用）
  agent_specialties: { values: string[] };
  agent_stats: { values: string[] };
  agent_rarity: { values: string[] };
  agent_faction: { values: string[] };
  modules: Module[];
  filter_values?: FilterValues; // 実際のAPIレスポンス構造
}

export interface FilterValues {
  agent_specialties?: { values: string[] };
  agent_stats?: { values: string[] };
  agent_rarity?: { values: string[] };
  agent_faction?: { values: string[] };
  agent_assist_type?: { values: string[] }; // 支援タイプ（オプショナル）
}

export interface Module {
  name: string;
  components: Component[];
}

export interface Component {
  component_id: string;
  data: string; // JSON文字列
}

// エージェントタレントデータ構造
export interface AgentTalentData {
  list: TalentItem[];
}

export interface TalentItem {
  title: string;
  icon_url?: string;
  attributes?: TalentAttribute[];
  children?: TalentChild[];
}

export interface TalentAttribute {
  key: string;
  values: string[];
}

export interface TalentChild {
  title: string;
  desc: string;
  icon_url?: string;
  img?: string;
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
