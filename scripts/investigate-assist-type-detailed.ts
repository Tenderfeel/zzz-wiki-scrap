#!/usr/bin/env tsx

import { HoyoLabApiClient } from "../src/clients/HoyoLabApiClient";

async function investigateAssistTypeDetailed() {
  const client = new HoyoLabApiClient();

  try {
    // 複数のキャラクターを調査
    const characters = [
      { id: 28, name: "ライカン（パリィ支援）" },
      { id: 2, name: "エレン（攻撃）" },
      { id: 3, name: "ニコル（支援）" },
      { id: 4, name: "アンビー（支援）" },
    ];

    for (const char of characters) {
      console.log(`\n=== ${char.name} (ID: ${char.id}) ===`);

      try {
        const response = await client.fetchCharacterData(char.id, "ja-jp");

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
              console.log("支援スキル発見:", assistSkill.title);

              // 支援タイプを特定
              if (assistSkill.children) {
                assistSkill.children.forEach((child: any) => {
                  console.log(`  - ${child.title}`);
                  if (child.title.includes("パリィ支援")) {
                    console.log("    → パリィ支援（defensive）");
                  } else if (child.title.includes("回避支援")) {
                    console.log("    → 回避支援（evasive）");
                  }
                });
              }

              // attributesからも支援タイプを探す
              if (assistSkill.attributes) {
                assistSkill.attributes.forEach((attr: any) => {
                  if (attr.key.includes("パリィ支援")) {
                    console.log(
                      `  属性: ${attr.key} → パリィ支援（defensive）`
                    );
                  } else if (attr.key.includes("回避支援")) {
                    console.log(`  属性: ${attr.key} → 回避支援（evasive）`);
                  }
                });
              }
            } else {
              console.log("支援スキルなし");
            }
          }
        }

        // 少し待機（API制限対策）
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(
          `${char.name}の調査中にエラー:`,
          (error as Error).message
        );
      }
    }
  } catch (error) {
    console.error("調査中にエラーが発生:", (error as Error).message);
  }
}

investigateAssistTypeDetailed();
