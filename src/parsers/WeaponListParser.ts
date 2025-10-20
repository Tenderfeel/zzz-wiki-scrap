import { readFileSync } from "fs";
import { WeaponEntry } from "../types";

/**
 * weapon-list.jsonファイルから音動機情報を抽出するパーサー
 */
export class WeaponListParser {
  /**
   * weapon-list.jsonファイルを解析して音動機エントリーの配列を返す
   * レア度AとSのみをフィルタリングし、レア度Bは除外する
   * @param filePath weapon-list.jsonファイルのパス
   * @returns 音動機エントリーの配列
   */
  public async parseWeaponList(filePath: string): Promise<WeaponEntry[]> {
    try {
      const content = readFileSync(filePath, "utf-8");
      const jsonData = JSON.parse(content);

      if (!Array.isArray(jsonData)) {
        throw new Error(
          "weapon-list.jsonの形式が無効です: ルートが配列ではありません"
        );
      }

      const entries: WeaponEntry[] = [];

      for (const item of jsonData) {
        const weaponEntry = this.extractWeaponEntry(item);

        if (weaponEntry && this.validateWeaponEntry(weaponEntry)) {
          // レア度AとSのみを処理対象とし、レア度Bは除外
          if (weaponEntry.rarity === "A" || weaponEntry.rarity === "S") {
            entries.push(weaponEntry);
          } else {
            if (
              process.env.NODE_ENV !== "test" &&
              process.env.VITEST !== "true"
            ) {
              console.log(
                `レア度B音動機を除外しました: ${weaponEntry.name} (ID: ${weaponEntry.id})`
              );
            }
          }
        }
      }

      if (entries.length === 0) {
        throw new Error(
          "weapon-list.jsonから有効な音動機情報を抽出できませんでした"
        );
      }

      if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
        console.log(
          `${entries.length}個の音動機エントリーを抽出しました（レア度A: ${
            entries.filter((e) => e.rarity === "A").length
          }, レア度S: ${entries.filter((e) => e.rarity === "S").length}）`
        );
      }

      return entries;
    } catch (error) {
      throw new Error(
        `weapon-list.jsonファイルの読み込みに失敗しました: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * weapon-list.jsonの単一アイテムから音動機エントリーを抽出する
   * @param item weapon-list.jsonの単一アイテム
   * @returns 音動機エントリーまたはnull
   */
  private extractWeaponEntry(item: any): WeaponEntry | null {
    try {
      // 必須フィールドの存在確認
      if (!item.entry_page_id || !item.name) {
        return null;
      }

      // レア度の抽出
      const rarity = item.filter_values?.w_engine_rarity?.values?.[0];
      if (!rarity || !["A", "S", "B"].includes(rarity)) {
        return null;
      }

      // 特性の抽出（オプショナル）
      const specialty = item.filter_values?.filter_key_13?.values?.[0];

      return {
        id: item.entry_page_id,
        name: item.name,
        rarity: rarity as "A" | "S",
        specialty: specialty || undefined,
      };
    } catch (error) {
      console.warn(
        `音動機エントリーの抽出中にエラーが発生しました: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    }
  }

  /**
   * 音動機エントリーの妥当性を検証する
   * @param entry 検証する音動機エントリー
   * @returns 妥当性チェック結果
   */
  public validateWeaponEntry(
    entry: Partial<WeaponEntry>
  ): entry is WeaponEntry {
    // 必須フィールドの存在確認
    if (!entry.id || typeof entry.id !== "string" || entry.id.trim() === "") {
      return false;
    }

    if (
      !entry.name ||
      typeof entry.name !== "string" ||
      entry.name.trim() === ""
    ) {
      return false;
    }

    if (!entry.rarity || !["A", "S"].includes(entry.rarity)) {
      return false;
    }

    // IDの形式確認（数値文字列）
    const idPattern = /^\d+$/;
    if (!idPattern.test(entry.id.trim())) {
      return false;
    }

    // specialtyがある場合の検証
    if (entry.specialty !== undefined) {
      if (
        typeof entry.specialty !== "string" ||
        entry.specialty.trim() === ""
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * 抽出された音動機エントリーの統計情報を表示する
   * @param entries 音動機エントリーの配列
   */
  public displayStatistics(entries: WeaponEntry[]): void {
    console.log("\n=== 音動機リスト統計 ===");
    console.log(`総音動機数: ${entries.length}`);

    // レア度別統計
    const rarityStats = entries.reduce((acc, entry) => {
      acc[entry.rarity] = (acc[entry.rarity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log("レア度別:");
    Object.entries(rarityStats).forEach(([rarity, count]) => {
      console.log(`  - ${rarity}級: ${count}個`);
    });

    // 特性別統計（特性が設定されているもののみ）
    const specialtyStats = entries
      .filter((entry) => entry.specialty)
      .reduce((acc, entry) => {
        const specialty = entry.specialty!;
        acc[specialty] = (acc[specialty] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    if (Object.keys(specialtyStats).length > 0) {
      console.log("特性別:");
      Object.entries(specialtyStats).forEach(([specialty, count]) => {
        console.log(`  - ${specialty}: ${count}個`);
      });
    }

    if (entries.length > 0) {
      // 最初の5個と最後の5個を表示
      console.log("\n最初の5音動機:");
      entries.slice(0, 5).forEach((entry) => {
        console.log(
          `  - ${entry.name} (ID: ${entry.id}, レア度: ${entry.rarity}${
            entry.specialty ? `, 特性: ${entry.specialty}` : ""
          })`
        );
      });

      if (entries.length > 10) {
        console.log("\n最後の5音動機:");
        entries.slice(-5).forEach((entry) => {
          console.log(
            `  - ${entry.name} (ID: ${entry.id}, レア度: ${entry.rarity}${
              entry.specialty ? `, 特性: ${entry.specialty}` : ""
            })`
          );
        });
      }
    }
    console.log("===================\n");
  }
}
