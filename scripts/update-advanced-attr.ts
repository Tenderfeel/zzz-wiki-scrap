#!/usr/bin/env node

import { HoyoLabApiClient } from "../src/clients/HoyoLabApiClient";
import { WeaponDataMapper } from "../src/mappers/WeaponDataMapper";
import { logger } from "../src/utils/Logger";
import * as fs from "fs";

/**
 * 既存の武器データの上級ステータス（advancedAttr）を
 * APIレスポンスから取得した正しい値で更新するスクリプト
 */
async function updateAdvancedAttr() {
  try {
    logger.info("上級ステータス更新スクリプトを開始");

    const client = new HoyoLabApiClient();
    const mapper = new WeaponDataMapper();

    // 既存の武器データを読み込み
    const weaponsModule = await import("../data/weapons.ts");
    const weapons = weaponsModule.default;

    if (!Array.isArray(weapons)) {
      throw new Error("武器データが配列ではありません");
    }

    logger.info("武器データ読み込み完了", { weaponCount: weapons.length });

    let updatedCount = 0;
    let failedCount = 0;

    // 各武器の上級ステータスを更新
    for (const weapon of weapons) {
      try {
        logger.info(
          `武器ID ${weapon.id} (${weapon.name.ja}) の上級ステータスを取得中...`
        );

        // APIから武器データを取得
        const response = await client.fetchCharacterData(weapon.id, "ja-jp");

        if (!response.data?.page?.modules) {
          logger.warn(
            `武器ID ${weapon.id}: APIレスポンスにmodulesが含まれていません`
          );
          failedCount++;
          continue;
        }

        // 基礎・上級ステータスを抽出
        const attributes = mapper.extractBaseAndAdvancedAttributes(
          response.data.page.modules
        );

        // 上級ステータスが変更された場合のみ更新
        if (weapon.advancedAttr !== attributes.advancedAttr) {
          logger.info(
            `武器ID ${weapon.id}: 上級ステータスを ${weapon.advancedAttr} → ${attributes.advancedAttr} に更新`
          );
          weapon.advancedAttr = attributes.advancedAttr;
          updatedCount++;
        } else {
          logger.debug(
            `武器ID ${weapon.id}: 上級ステータスは既に正しい値です (${attributes.advancedAttr})`
          );
        }

        // API制限を避けるため少し待機
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        logger.error(`武器ID ${weapon.id} の処理でエラー:`, error);
        failedCount++;
      }
    }

    // 更新された武器データをファイルに書き込み
    // 元のファイルを読み込んで、advancedAttrのみを置換する方式を使用
    let fileContent = fs.readFileSync("data/weapons.ts", "utf-8");

    for (const weapon of weapons) {
      // 各武器のadvancedAttrを置換
      const oldPattern = new RegExp(
        `(id: ${weapon.id}[\\s\\S]*?advancedAttr: ")[^"]*(")`
      );
      const newValue = `$1${weapon.advancedAttr}$2`;
      fileContent = fileContent.replace(oldPattern, newValue);
    }

    fs.writeFileSync("data/weapons.ts", fileContent, "utf-8");

    logger.info("上級ステータス更新完了", {
      totalWeapons: weapons.length,
      updatedWeapons: updatedCount,
      failedWeapons: failedCount,
      successRate: `${(
        ((weapons.length - failedCount) / weapons.length) *
        100
      ).toFixed(2)}%`,
    });

    console.log("\n=== 上級ステータス更新結果 ===");
    console.log(`総武器数: ${weapons.length}`);
    console.log(`更新成功: ${updatedCount}`);
    console.log(`更新失敗: ${failedCount}`);
    console.log(
      `成功率: ${(
        ((weapons.length - failedCount) / weapons.length) *
        100
      ).toFixed(2)}%`
    );
  } catch (error) {
    logger.error("上級ステータス更新スクリプトでエラーが発生", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

updateAdvancedAttr();
