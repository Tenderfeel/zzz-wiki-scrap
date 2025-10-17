import { Stats } from "../types/index.js";

/**
 * 属性値を配列形式にマッピングするユーティリティ
 *
 * 特別な属性の場合：
 * - frost → ["ice", "frost"]
 * - auricInk → ["ether", "auricInk"]
 *
 * その他の属性は単一要素配列に変換
 */

/**
 * 単一の属性値を適切な配列に変換する
 * @param stats 単一の属性値
 * @returns 属性値の配列
 */
export function mapStatsToArray(stats: Stats): Stats[] {
  switch (stats) {
    case "frost":
      return ["ice", "frost"];
    case "auricInk":
      return ["ether", "auricInk"];
    default:
      return [stats];
  }
}

/**
 * 複数の属性値を配列形式にマッピングする
 * @param statsArray 属性値の配列
 * @returns マッピングされた属性値の配列
 */
export function mapStatsArrayToArray(statsArray: Stats[]): Stats[] {
  const result: Stats[] = [];

  for (const stats of statsArray) {
    const mapped = mapStatsToArray(stats);
    result.push(...mapped);
  }

  // 重複を除去して返す
  return Array.from(new Set(result));
}

/**
 * 属性マッピングの定数定義
 * 各属性がどの配列にマッピングされるかを定義
 */
export const STATS_ARRAY_MAPPING: Record<Stats, Stats[]> = {
  frost: ["ice", "frost"],
  auricInk: ["ether", "auricInk"],
  electric: ["electric"],
  fire: ["fire"],
  ice: ["ice"],
  physical: ["physical"],
  ether: ["ether"],
} as const;

/**
 * マッピング定数を使用した属性変換関数
 * @param stats 単一の属性値
 * @returns 属性値の配列
 */
export function mapStatsUsingConstant(stats: Stats): Stats[] {
  return STATS_ARRAY_MAPPING[stats];
}
