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

// 属性
export type Stats =
  | "ether" // エーテル
  | "fire" // 炎
  | "ice" // 氷
  | "physical" // 物理
  | "electric" // 電気
  | "frostAttribute" // 霜烈
  | "auricInk"; // 玄墨

// 攻撃タイプ
export type AttackType =
  | "slash" // 斬撃
  | "pierce" // 刺突
  | "strike"; // 打撃

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

// キャラクター
export type Character = {
  id: string; // Scraping.mdのリンクテキストと同じ
  name: { [key in Lang]: string }; // 多言語名
  fullName: { [key in Lang]: string }; // 多言語フルネーム
  specialty: Specialty; // 特性
  stats: Stats; // 属性
  attackType: AttackType; // 攻撃タイプ
  faction: number; // 陣営ID
  rarity: Rarity; // レア度
  attr: Attributes; // ステータス
};
