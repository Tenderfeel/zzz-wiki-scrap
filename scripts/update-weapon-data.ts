#!/usr/bin/env node

import { WeaponDataUpdater } from "../src/utils/WeaponDataUpdater";
import { logger } from "../src/utils/Logger";

/**
 * 既存の武器データファイルを属性抽出結果で更新するスクリプト
 *
 * 使用方法:
 *   npm run update-weapon-data
 *   tsx scripts/update-weapon-data.ts
 */
async function main() {
  try {
    logger.info("武器データ更新スクリプトを開始");

    const updater = new WeaponDataUpdater();

    // 既存の武器データを更新
    const result = await updater.updateWeaponDataFile(
      "data/weapons.ts", // 入力ファイル
      "data/weapons.ts" // 出力ファイル（元ファイルを上書き）
    );

    logger.info("武器データ更新完了", {
      totalWeapons: result.totalWeapons,
      updatedWeapons: result.updatedWeapons,
      failedWeapons: result.failedWeapons,
      successRate: `${(
        (result.updatedWeapons / result.totalWeapons) *
        100
      ).toFixed(2)}%`,
    });

    // 属性抽出レポートを生成
    logger.info("属性抽出レポート生成中...");

    // 更新された武器データを読み込み
    const weaponsModule = await import("../data/weapons.ts");
    const weapons = weaponsModule.default;

    const report = await updater.generateAttributeExtractionReport(weapons);

    // レポートをファイルに出力
    const fs = await import("fs");
    const reportPath = "weapon-attribute-extraction-report.md";
    fs.writeFileSync(reportPath, report, "utf-8");

    logger.info("属性抽出レポート生成完了", {
      reportPath,
    });

    console.log("\n=== 武器データ更新結果 ===");
    console.log(`総武器数: ${result.totalWeapons}`);
    console.log(`更新成功: ${result.updatedWeapons}`);
    console.log(`更新失敗: ${result.failedWeapons}`);
    console.log(
      `成功率: ${((result.updatedWeapons / result.totalWeapons) * 100).toFixed(
        2
      )}%`
    );
    console.log(`\n属性抽出レポート: ${reportPath}`);
    console.log(`更新されたファイル: data/weapons.ts`);
  } catch (error) {
    logger.error("武器データ更新スクリプトでエラーが発生", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみmain関数を実行
if (require.main === module) {
  main().catch((error) => {
    console.error("予期しないエラーが発生しました:", error);
    process.exit(1);
  });
}

export { main };
