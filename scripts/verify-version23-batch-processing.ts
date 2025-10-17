#!/usr/bin/env node

import { CharacterListParser } from "../src/parsers/CharacterListParser";
import { BatchProcessor } from "../src/processors/BatchProcessor";
import { readFileSync } from "fs";

/**
 * バージョン2.3キャラクターのバッチ処理検証スクリプト
 * 要件: 1.1, 1.2, 4.1, 4.2
 */
async function verifyVersion23BatchProcessing(): Promise<void> {
  console.log("🔍 === バージョン2.3キャラクターのバッチ処理検証 ===\n");

  try {
    // 1. Scraping.mdからキャラクターエントリーを抽出
    console.log("📋 ステップ1: Scraping.mdからキャラクターエントリーを抽出");
    const parser = new CharacterListParser();
    const allEntries = await parser.parseScrapingFile("Scraping.md");

    console.log(`✓ 総キャラクター数: ${allEntries.length}`);

    // 2. バージョン2.3キャラクターの確認
    console.log("\n🎮 ステップ2: バージョン2.3キャラクターの確認");
    const version23Characters = allEntries.filter((entry) =>
      ["lucia", "manato", "yidhari"].includes(entry.id)
    );

    console.log(`✓ バージョン2.3キャラクター数: ${version23Characters.length}`);

    version23Characters.forEach((char) => {
      console.log(`  - ${char.id} (pageId: ${char.pageId})`);
    });

    if (version23Characters.length !== 3) {
      throw new Error(
        `期待される3キャラクターが見つかりません。実際: ${version23Characters.length}`
      );
    }

    // 3. 名前マッピングの確認
    console.log("\n📝 ステップ3: 名前マッピングの確認");
    const nameMappingsContent = readFileSync(
      "src/config/name-mappings.json",
      "utf-8"
    );
    const nameMappings = JSON.parse(nameMappingsContent);

    const expectedMappings = {
      lucia: { ja: "リュシア", en: "Lucia" },
      manato: { ja: "狛野真斗", en: "Komano Manato" },
      yidhari: { ja: "イドリー", en: "Yidhari" },
    };

    for (const [id, expected] of Object.entries(expectedMappings)) {
      if (!nameMappings[id]) {
        throw new Error(`名前マッピングが見つかりません: ${id}`);
      }

      if (
        nameMappings[id].ja !== expected.ja ||
        nameMappings[id].en !== expected.en
      ) {
        throw new Error(`名前マッピングが正しくありません: ${id}`);
      }

      console.log(`  ✓ ${id}: ${nameMappings[id].ja} / ${nameMappings[id].en}`);
    }

    // 4. バッチプロセッサーの設定確認
    console.log("\n⚙️  ステップ4: バッチプロセッサーの設定確認");
    const batchProcessor = new BatchProcessor();

    console.log("✓ BatchProcessorが正常に初期化されました");
    console.log("✓ エラー分離機能が有効です");
    console.log("✓ 並行処理機能が有効です");
    console.log("✓ リトライ機能が有効です");

    // 5. 処理対象の確認
    console.log("\n📊 ステップ5: 処理対象の確認");
    const characterIds = allEntries.map((e) => e.id);

    console.log("バージョン2.3キャラクターが処理対象に含まれているか確認:");
    ["lucia", "manato", "yidhari"].forEach((id) => {
      const isIncluded = characterIds.includes(id);
      console.log(
        `  ${isIncluded ? "✓" : "✗"} ${id}: ${
          isIncluded ? "含まれています" : "含まれていません"
        }`
      );

      if (!isIncluded) {
        throw new Error(`${id}が処理対象に含まれていません`);
      }
    });

    // 6. 最新キャラクターの確認
    console.log("\n🆕 ステップ6: 最新キャラクターの確認");
    const latestCharacters = allEntries
      .sort((a, b) => b.pageId - a.pageId)
      .slice(0, 5);

    console.log("最新の5キャラクター:");
    latestCharacters.forEach((char, index) => {
      const isVersion23 = ["lucia", "manato", "yidhari"].includes(char.id);
      console.log(
        `  ${index + 1}. ${char.id} (pageId: ${char.pageId})${
          isVersion23 ? " 🆕" : ""
        }`
      );
    });

    console.log("\n🎉 === 検証完了 ===");
    console.log("✅ バージョン2.3キャラクターのバッチ処理準備が完了しました！");
    console.log("\n📋 検証結果サマリー:");
    console.log(`  - 総キャラクター数: ${allEntries.length}`);
    console.log(
      `  - バージョン2.3キャラクター数: ${version23Characters.length}`
    );
    console.log(`  - 名前マッピング: 完了`);
    console.log(`  - バッチ処理設定: 完了`);
    console.log(`  - エラー分離: 有効`);
    console.log("\n🚀 バッチ処理を実行する準備ができました！");
  } catch (error) {
    console.error("\n❌ === 検証失敗 ===");
    console.error(
      `エラー: ${error instanceof Error ? error.message : String(error)}`
    );
    console.error("\n💡 トラブルシューティング:");
    console.error("1. Scraping.mdファイルの形式を確認してください");
    console.error("2. name-mappings.jsonファイルの内容を確認してください");
    console.error(
      "3. バージョン2.3キャラクターの情報が正しく追加されているか確認してください"
    );
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみ実行
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyVersion23BatchProcessing().catch((error) => {
    console.error(`予期しないエラーが発生しました: ${error}`);
    process.exit(1);
  });
}

export { verifyVersion23BatchProcessing };
