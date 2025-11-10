import { readFileSync } from "fs";
import { DriverDiscEntry } from "../types";

/**
 * disc-list.jsonファイルからドライバーディスク情報を抽出するパーサー
 */
export class DriverDiscListParser {
  /**
   * disc-list.jsonファイルを解析してドライバーディスクエントリーの配列を返す
   * @param filePath disc-list.jsonファイルのパス
   * @returns ドライバーディスクエントリーの配列
   */
  public async parseDiscListFile(filePath: string): Promise<DriverDiscEntry[]> {
    try {
      const content = readFileSync(filePath, "utf-8");
      const jsonData = JSON.parse(content);

      if (!this.validateJsonStructure(jsonData)) {
        throw new Error(
          "disc-list.jsonの形式が無効です: 期待される構造と一致しません"
        );
      }

      const entries: DriverDiscEntry[] = [];

      for (const item of jsonData.data.list) {
        const discEntry = this.extractDriverDiscEntry(item);

        if (discEntry && this.validateDriverDiscEntry(discEntry)) {
          entries.push(discEntry);
        }
      }

      if (entries.length === 0) {
        throw new Error(
          "disc-list.jsonから有効なドライバーディスク情報を抽出できませんでした"
        );
      }

      if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
        console.log(
          `${entries.length}個のドライバーディスクエントリーを抽出しました`
        );
      }

      return entries;
    } catch (error) {
      throw new Error(
        `disc-list.jsonファイルの読み込みに失敗しました: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * JSONデータの構造を検証する
   * @param jsonData 検証するJSONデータ
   * @returns 構造が有効かどうか
   */
  private validateJsonStructure(jsonData: any): boolean {
    return (
      jsonData &&
      typeof jsonData === "object" &&
      jsonData.retcode === 0 &&
      jsonData.message === "OK" &&
      jsonData.data &&
      Array.isArray(jsonData.data.list)
    );
  }

  /**
   * disc-list.jsonの単一アイテムからドライバーディスクエントリーを抽出する
   * @param item disc-list.jsonの単一アイテム
   * @returns ドライバーディスクエントリーまたはnull
   */
  private extractDriverDiscEntry(item: any): DriverDiscEntry | null {
    try {
      // 必須フィールドの存在確認
      if (!item.entry_page_id || !item.name || !item.icon_url) {
        return null;
      }

      return {
        id: item.entry_page_id,
        name: item.name,
        iconUrl: item.icon_url,
      };
    } catch (error) {
      console.warn(
        `ドライバーディスクエントリーの抽出中にエラーが発生しました: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    }
  }

  /**
   * ドライバーディスクエントリーの妥当性を検証する
   * @param entry 検証するドライバーディスクエントリー
   * @returns 妥当性チェック結果
   */
  public validateDriverDiscEntry(
    entry: Partial<DriverDiscEntry>
  ): entry is DriverDiscEntry {
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

    if (
      !entry.iconUrl ||
      typeof entry.iconUrl !== "string" ||
      entry.iconUrl.trim() === ""
    ) {
      return false;
    }

    // IDの形式確認（数値文字列）
    const idPattern = /^\d+$/;
    if (!idPattern.test(entry.id.trim())) {
      return false;
    }

    // アイコンURLの形式確認（HTTPSで始まる）
    const urlPattern = /^https:\/\/.+/;
    if (!urlPattern.test(entry.iconUrl.trim())) {
      return false;
    }

    return true;
  }

  /**
   * 抽出されたドライバーディスクエントリーの統計情報を表示する
   * @param entries ドライバーディスクエントリーの配列
   */
  public displayStatistics(entries: DriverDiscEntry[]): void {
    console.log("\n=== ドライバーディスクリスト統計 ===");
    console.log(`総ドライバーディスク数: ${entries.length}`);

    if (entries.length > 0) {
      console.log(
        `エントリーページID範囲: ${Math.min(
          ...entries.map((e) => parseInt(e.id, 10))
        )} - ${Math.max(...entries.map((e) => parseInt(e.id, 10)))}`
      );

      // 最初の5個と最後の5個を表示
      console.log("\n最初の5ドライバーディスク:");
      entries.slice(0, 5).forEach((entry) => {
        console.log(`  - ${entry.name} (ID: ${entry.id})`);
      });

      if (entries.length > 10) {
        console.log("\n最後の5ドライバーディスク:");
        entries.slice(-5).forEach((entry) => {
          console.log(`  - ${entry.name} (ID: ${entry.id})`);
        });
      }
    }
    console.log("===============================\n");
  }
}
