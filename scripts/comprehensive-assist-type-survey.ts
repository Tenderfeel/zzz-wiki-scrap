#!/usr/bin/env tsx

import { HoyoLabApiClient } from "../src/clients/HoyoLabApiClient";

async function comprehensiveAssistTypeSurvey() {
  const client = new HoyoLabApiClient();

  // 既存のキャラクターIDとマッピング（data/characters.tsから）
  const characterMapping = {
    2: "anby",
    19: "billy",
    20: "nicole",
    21: "nekomata",
    22: "soldier11",
    23: "corin",
    24: "anton",
    25: "ben",
    26: "koleda",
    27: "grace",
    28: "lycaon",
    29: "ellen",
    30: "rina",
    31: "zhuyuan",
    32: "soukaku",
    33: "lucy",
    34: "piper",
    35: "qingyi",
    36: "jane",
    37: "seth",
    38: "caesar",
    39: "burnice",
    40: "yanagi",
    41: "lighter",
    42: "miyabi",
    43: "harumasa",
    44: "astra",
    45: "evelyn",
    46: "soldier0anby",
    47: "pulchra",
    48: "trigger",
    49: "vivian",
    50: "hugo",
    51: "jufufu",
    52: "pan",
    53: "yixuan",
    54: "yuzuha",
    55: "alice",
    56: "seed",
    57: "orphie",
  };

  const results: Record<string, string | null> = {};

  try {
    for (const [apiId, characterId] of Object.entries(characterMapping)) {
      console.log(`\n=== ${characterId} (API ID: ${apiId}) ===`);

      try {
        const response = await client.fetchCharacterData(
          parseInt(apiId),
          "ja-jp"
        );
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
              let assistType: string | null = null;

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

              results[characterId] = assistType;
              console.log(`支援タイプ: ${assistType || "不明"}`);
            } else {
              results[characterId] = null;
              console.log("支援スキルなし");
            }
          }
        } else {
          results[characterId] = null;
          console.log("スキルモジュールなし");
        }

        // API制限対策
        await new Promise((resolve) => setTimeout(resolve, 800));
      } catch (error) {
        console.error(
          `${characterId}の調査中にエラー:`,
          (error as Error).message
        );
        results[characterId] = null;
        // エラーが発生しても続行
        continue;
      }
    }

    // 結果をまとめて出力
    console.log("\n=== 調査結果まとめ ===");
    console.log("回避支援（evasive）:");
    Object.entries(results).forEach(([id, type]) => {
      if (type === "evasive") {
        console.log(`  - ${id}`);
      }
    });

    console.log("\nパリィ支援（defensive）:");
    Object.entries(results).forEach(([id, type]) => {
      if (type === "defensive") {
        console.log(`  - ${id}`);
      }
    });

    console.log("\n支援タイプなし:");
    Object.entries(results).forEach(([id, type]) => {
      if (type === null) {
        console.log(`  - ${id}`);
      }
    });

    // TypeScript形式で出力
    console.log("\n=== TypeScript形式 ===");
    console.log("const assistTypeMapping = {");
    Object.entries(results).forEach(([id, type]) => {
      if (type) {
        console.log(`  "${id}": "${type}",`);
      }
    });
    console.log("};");
  } catch (error) {
    console.error("調査中にエラーが発生:", (error as Error).message);
  }
}

comprehensiveAssistTypeSurvey();
