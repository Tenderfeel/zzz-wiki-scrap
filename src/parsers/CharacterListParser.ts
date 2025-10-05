import { readFileSync } from "fs";
import { CharacterEntry } from "../types";

/**
 * Scraping.mdファイルからキャラクター情報を抽出するパーサー
 */
export class CharacterListParser {
  /**
   * Scraping.mdファイルを解析してキャラクターエントリーの配列を返す
   * @param filePath Scraping.mdファイルのパス
   * @returns キャラクターエントリーの配列
   */
  public async parseScrapingFile(filePath: string): Promise<CharacterEntry[]> {
    try {
      const content = readFileSync(filePath, "utf-8");
      return this.extractCharacterEntries(content);
    } catch (error) {
      throw new Error(
        `Scraping.mdファイルの読み込みに失敗しました: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Scraping.mdの内容からキャラクターエントリーを抽出する
   * @param content Scraping.mdファイルの内容
   * @returns キャラクターエントリーの配列
   */
  public extractCharacterEntries(content: string): CharacterEntry[] {
    // 正規表現パターン: - [キャラクターID](URL) - pageId: 数値
    const pattern = /- \[([^\]]+)\]\(([^)]+)\) - pageId: (\d+)/g;
    const entries: CharacterEntry[] = [];
    let match;

    while ((match = pattern.exec(content)) !== null) {
      const [, id, wikiUrl, pageIdStr] = match;
      const pageId = parseInt(pageIdStr, 10);

      // 抽出したデータの検証
      if (!id || !wikiUrl || isNaN(pageId)) {
        console.warn(
          `無効なキャラクターエントリーをスキップしました: ${match[0]}`
        );
        continue;
      }

      entries.push({
        id: id.trim(),
        pageId,
        wikiUrl: wikiUrl.trim(),
      });
    }

    if (entries.length === 0) {
      throw new Error("Scraping.mdからキャラクター情報を抽出できませんでした");
    }

    if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
      console.log(`${entries.length}個のキャラクターエントリーを抽出しました`);
    }
    return entries;
  }

  /**
   * 抽出されたキャラクターエントリーの統計情報を表示する
   * @param entries キャラクターエントリーの配列
   */
  public displayStatistics(entries: CharacterEntry[]): void {
    console.log("\n=== キャラクターリスト統計 ===");
    console.log(`総キャラクター数: ${entries.length}`);

    if (entries.length > 0) {
      console.log(
        `ページID範囲: ${Math.min(
          ...entries.map((e) => e.pageId)
        )} - ${Math.max(...entries.map((e) => e.pageId))}`
      );

      // 最初の5個と最後の5個を表示
      console.log("\n最初の5キャラクター:");
      entries.slice(0, 5).forEach((entry) => {
        console.log(`  - ${entry.id} (pageId: ${entry.pageId})`);
      });

      if (entries.length > 10) {
        console.log("\n最後の5キャラクター:");
        entries.slice(-5).forEach((entry) => {
          console.log(`  - ${entry.id} (pageId: ${entry.pageId})`);
        });
      }
    }
    console.log("========================\n");
  }
}
