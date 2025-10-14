import { readFileSync } from "fs";
import { BompEntry } from "../types";

/**
 * Scraping.mdファイルからボンプ情報を抽出するパーサー
 */
export class BompListParser {
  /**
   * Scraping.mdファイルを解析してボンプエントリーの配列を返す
   * @param filePath Scraping.mdファイルのパス
   * @returns ボンプエントリーの配列
   */
  public async parseScrapingFile(filePath: string): Promise<BompEntry[]> {
    try {
      const content = readFileSync(filePath, "utf-8");
      return this.extractBompEntries(content);
    } catch (error) {
      throw new Error(
        `Scraping.mdファイルの読み込みに失敗しました: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Scraping.mdの内容からボンプエントリーを抽出する
   * @param content Scraping.mdファイルの内容
   * @returns ボンプエントリーの配列
   */
  public extractBompEntries(content: string): BompEntry[] {
    // ボンプページリストセクションを抽出
    const bompSectionMatch = content.match(
      /## ボンプページリスト\s*\n([\s\S]*?)(?=\n##|\n```|$)/
    );

    if (!bompSectionMatch) {
      throw new Error(
        "Scraping.mdからボンプページリストセクションが見つかりませんでした"
      );
    }

    const bompSection = bompSectionMatch[1];

    // 正規表現パターン: - [ボンプID](URL) - 日本語名
    const pattern = /- \[([^\]]+)\]\(([^)]+)\) - (.+)/g;
    const entries: BompEntry[] = [];
    let match;

    while ((match = pattern.exec(bompSection)) !== null) {
      const [, id, wikiUrl, jaName] = match;

      // URLからページIDを抽出
      const pageIdMatch = wikiUrl.match(/\/entry\/(\d+)/);
      if (!pageIdMatch) {
        console.warn(
          `無効なボンプエントリー（ページID抽出失敗）をスキップしました: ${match[0]}`
        );
        continue;
      }

      const pageId = parseInt(pageIdMatch[1], 10);

      // 抽出したデータの検証
      if (!this.validateBompEntry({ id, pageId, wikiUrl, jaName })) {
        console.warn(`無効なボンプエントリーをスキップしました: ${match[0]}`);
        continue;
      }

      entries.push({
        id: id.trim(),
        pageId,
        wikiUrl: wikiUrl.trim(),
        jaName: jaName.trim(),
      });
    }

    if (entries.length === 0) {
      throw new Error("Scraping.mdからボンプ情報を抽出できませんでした");
    }

    if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
      console.log(`${entries.length}個のボンプエントリーを抽出しました`);
    }
    return entries;
  }

  /**
   * ボンプエントリーの妥当性を検証する
   * @param entry 検証するボンプエントリー
   * @returns 妥当性チェック結果
   */
  public validateBompEntry(entry: Partial<BompEntry>): entry is BompEntry {
    // 必須フィールドの存在確認
    if (!entry.id || typeof entry.id !== "string" || entry.id.trim() === "") {
      return false;
    }

    if (
      !entry.pageId ||
      typeof entry.pageId !== "number" ||
      entry.pageId <= 0
    ) {
      return false;
    }

    if (
      !entry.wikiUrl ||
      typeof entry.wikiUrl !== "string" ||
      entry.wikiUrl.trim() === ""
    ) {
      return false;
    }

    if (
      !entry.jaName ||
      typeof entry.jaName !== "string" ||
      entry.jaName.trim() === ""
    ) {
      return false;
    }

    // URLの形式確認
    const urlPattern = /^https:\/\/wiki\.hoyolab\.com\/pc\/zzz\/entry\/\d+$/;
    if (!urlPattern.test(entry.wikiUrl.trim())) {
      return false;
    }

    // IDの形式確認（英数字とハイフン、アンダースコアのみ）
    const idPattern = /^[a-zA-Z0-9_-]+$/;
    if (!idPattern.test(entry.id.trim())) {
      return false;
    }

    return true;
  }

  /**
   * 抽出されたボンプエントリーの統計情報を表示する
   * @param entries ボンプエントリーの配列
   */
  public displayStatistics(entries: BompEntry[]): void {
    console.log("\n=== ボンプリスト統計 ===");
    console.log(`総ボンプ数: ${entries.length}`);

    if (entries.length > 0) {
      console.log(
        `ページID範囲: ${Math.min(
          ...entries.map((e) => e.pageId)
        )} - ${Math.max(...entries.map((e) => e.pageId))}`
      );

      // 最初の5個と最後の5個を表示
      console.log("\n最初の5ボンプ:");
      entries.slice(0, 5).forEach((entry) => {
        console.log(
          `  - ${entry.id} (${entry.jaName}) - pageId: ${entry.pageId}`
        );
      });

      if (entries.length > 10) {
        console.log("\n最後の5ボンプ:");
        entries.slice(-5).forEach((entry) => {
          console.log(
            `  - ${entry.id} (${entry.jaName}) - pageId: ${entry.pageId}`
          );
        });
      }
    }
    console.log("===================\n");
  }
}
