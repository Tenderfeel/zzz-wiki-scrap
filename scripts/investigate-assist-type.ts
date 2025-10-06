#!/usr/bin/env tsx

import { HoyoLabApiClient } from "../src/clients/HoyoLabApiClient";

async function investigateAssistType() {
  const client = new HoyoLabApiClient();

  try {
    // ライカン（支援キャラクター）のデータを取得
    console.log("ライカン（ID: 28）のAPIレスポンスを調査中...");
    const response = await client.fetchCharacterData(28, "ja-jp");

    // レスポンス構造を調査
    console.log("=== Page構造 ===");
    console.log("Page keys:", Object.keys(response.data.page));

    // filter_valuesの内容を確認
    if ((response.data.page as any).filter_values) {
      console.log("\n=== filter_values構造 ===");
      console.log(
        "filter_values keys:",
        Object.keys((response.data.page as any).filter_values)
      );

      // 各フィールドの値を確認
      Object.entries((response.data.page as any).filter_values).forEach(
        ([key, value]) => {
          console.log(`${key}:`, value);
        }
      );
    }

    // modulesの中で支援タイプ関連の情報を探す
    console.log("\n=== Modules調査 ===");
    response.data.page.modules.forEach((module, index) => {
      console.log(`Module ${index}: ${module.name}`);
      if (module.name.includes("支援") || module.name.includes("スキル")) {
        console.log(
          "  Components:",
          module.components.map((c) => c.component_id)
        );

        // agent_talentコンポーネントのデータを確認
        const agentTalent = module.components.find(
          (c) => c.component_id === "agent_talent"
        );
        if (agentTalent) {
          try {
            const talentData = JSON.parse(agentTalent.data);
            console.log("  agent_talent keys:", Object.keys(talentData));
            if (talentData.list) {
              talentData.list.forEach((item: any, i: number) => {
                console.log(`    Item ${i}: ${item.title}`);
                if (item.title && item.title.includes("支援")) {
                  console.log(
                    "      支援関連アイテム発見:",
                    JSON.stringify(item, null, 2)
                  );
                }
              });
            }
          } catch (e) {
            console.log(
              "  agent_talentデータのパースに失敗:",
              (e as Error).message
            );
          }
        }
      }
    });

    // 他のキャラクターも調査（比較のため）
    console.log("\n=== 他のキャラクター調査 ===");

    // エレン（攻撃キャラクター）
    console.log("\nエレン（ID: 2）の調査...");
    const ellenResponse = await client.fetchCharacterData(2, "ja-jp");

    if ((ellenResponse.data.page as any).filter_values) {
      console.log(
        "エレン filter_values keys:",
        Object.keys((ellenResponse.data.page as any).filter_values)
      );
    }

    // 支援スキルモジュールを探す
    ellenResponse.data.page.modules.forEach((module, index) => {
      if (module.name.includes("支援") || module.name.includes("スキル")) {
        console.log(`エレン Module ${index}: ${module.name}`);
      }
    });
  } catch (error) {
    console.error("調査中にエラーが発生:", (error as Error).message);
  }
}

investigateAssistType();
