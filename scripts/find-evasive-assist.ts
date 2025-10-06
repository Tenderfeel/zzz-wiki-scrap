#!/usr/bin/env tsx

import { HoyoLabApiClient } from "../src/clients/HoyoLabApiClient";

async function findEvasiveAssist() {
  const client = new HoyoLabApiClient();

  try {
    // より多くのキャラクターを調査（回避支援を探すため）
    const characterIds = [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ];

    for (const id of characterIds) {
      console.log(`\n=== キャラクター ID: ${id} ===`);

      try {
        const response = await client.fetchCharacterData(id, "ja-jp");
        console.log(`名前: ${response.data.page.name}`);

        // 支援スキルモジュールを探す
        const skillModule = response.data.page.modules.find((module) =>
          module.name.includes("スキル")
        );

        if (skillModule) {
          const agentTalent = skillModule.components.find(
            (c) => c.component_id === "agent_talent"
          );

          if (agentTalent) {
            const talentData = JSON.parse(agentTalent.data);

            // 支援スキルを探す
            const assistSkill = talentData.list.find(
              (item: any) => item.title && item.title.includes("支援")
            );

            if (assistSkill) {
              let assistType = "unknown";

              // 支援タイプを特定
              if (assistSkill.children) {
                assistSkill.children.forEach((child: any) => {
                  if (child.title.includes("パリィ支援")) {
                    assistType = "defensive";
                  } else if (child.title.includes("回避支援")) {
                    assistType = "evasive";
                  }
                });
              }

              // attributesからも支援タイプを探す
              if (assistSkill.attributes) {
                assistSkill.attributes.forEach((attr: any) => {
                  if (attr.key.includes("パリィ支援")) {
                    assistType = "defensive";
                  } else if (attr.key.includes("回避支援")) {
                    assistType = "evasive";
                  }
                });
              }

              console.log(`支援タイプ: ${assistType}`);

              if (assistType === "evasive") {
                console.log("🎯 回避支援キャラクター発見！");
                // 詳細を出力
                console.log(
                  "支援スキル詳細:",
                  JSON.stringify(assistSkill, null, 2)
                );
              }
            } else {
              console.log("支援スキルなし");
            }
          }
        }

        // API制限対策
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`ID ${id}の調査中にエラー:`, (error as Error).message);
        // エラーが発生しても続行
        continue;
      }
    }
  } catch (error) {
    console.error("調査中にエラーが発生:", (error as Error).message);
  }
}

findEvasiveAssist();
