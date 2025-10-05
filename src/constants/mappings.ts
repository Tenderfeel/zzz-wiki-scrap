// マッピング定数

import { Specialty, Stats, Rarity } from "../types";

// 特性マッピング（日本語 → 英語列挙値）
export const SPECIALTY_MAPPING: Record<string, Specialty> = {
  撃破: "stun",
  強攻: "attack",
  異常: "anomaly",
  支援: "support",
  防護: "defense",
  命破: "rupture",
};

// 属性マッピング（日本語 → 英語列挙値）
export const STATS_MAPPING: Record<string, Stats> = {
  氷属性: "ice",
  炎属性: "fire",
  電気属性: "electric",
  物理属性: "physical",
  エーテル属性: "ether",
  霜烈属性: "frostAttribute",
  玄墨属性: "auricInk",
};

// レア度マッピング
export const RARITY_MAPPING: Record<string, Rarity> = {
  S: "S",
  A: "A",
};

// ステータス名マッピング（日本語 → 英語）
export const STAT_NAME_MAPPING: Record<string, string> = {
  HP: "hp",
  攻撃力: "atk",
  防御力: "def",
  衝撃力: "impact",
  会心率: "critRate",
  会心ダメージ: "critDmg",
  異常マスタリー: "anomalyMastery",
  異常掌握: "anomalyProficiency",
  貫通率: "penRatio",
  エネルギー自動回復: "energy",
};
