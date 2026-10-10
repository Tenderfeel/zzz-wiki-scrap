import defaultCorrections from "../../json/data-corrections.json";
import { logger } from "./Logger";

/**
 * 取得元（HoYoLAB wiki）のデータ誤りを補正する上書き定義
 *
 * from に誤った元の値を書いておき、元データが from と一致する場合だけ to で上書きする。
 * 取得元が修正されて値が変わった場合は上書きせずにログを出すので、
 * 不要になった補正や想定外の変更に気付ける。
 */
export type DataCorrection = {
  /** 対象データの ID */
  id: string;
  /** ドット区切りのプロパティパス（例: "attr.atk.6"） */
  path: string;
  /** 取得元の誤った値 */
  from: unknown;
  /** 補正後の値 */
  to: unknown;
  /** 補正の根拠 */
  reason: string;
};

export type DataCorrections = Record<string, DataCorrection[]>;

/**
 * 補正定義を適用した新しいオブジェクトを返す（引数のオブジェクトは変更しない）
 * @param category 補正定義のカテゴリ（例: "bomps"）
 * @param id 対象データの ID
 * @param target 補正対象のオブジェクト
 * @param corrections 補正定義（省略時は json/data-corrections.json）
 * @returns 補正適用後のオブジェクト
 */
export function applyDataCorrections<T>(
  category: string,
  id: string,
  target: T,
  corrections: DataCorrections = defaultCorrections
): T {
  const matched = (corrections[category] || []).filter((c) => c.id === id);
  if (matched.length === 0) {
    return target;
  }

  const result = structuredClone(target);

  for (const correction of matched) {
    const keys = correction.path.split(".");
    const lastKey = keys.pop()!;
    const parent = keys.reduce<any>((obj, key) => obj?.[key], result);
    const context = { category, id, path: correction.path };

    if (parent == null || !(lastKey in parent)) {
      logger.warn("補正対象のパスが存在しないため、補正をスキップしました", context);
      continue;
    }

    const actual = parent[lastKey];
    if (actual === correction.from) {
      parent[lastKey] = correction.to;
      logger.info("取得元データを補正しました", {
        ...context,
        from: correction.from,
        to: correction.to,
        reason: correction.reason,
      });
    } else if (actual === correction.to) {
      logger.info(
        "取得元データが修正済みのため、補正は不要です（json/data-corrections.json から削除できます）",
        context
      );
    } else {
      logger.warn("取得元データが想定外の値に変わっているため、補正をスキップしました", {
        ...context,
        expected: correction.from,
        actual,
      });
    }
  }

  return result;
}
