#!/usr/bin/env tsx

import characters from "../data/characters";
import { AssistType } from "../src/types";

function verifyAssistTypeData() {
  console.log("=== 支援タイプデータ検証 ===\n");

  // 支援タイプ別の統計
  const stats = {
    evasive: 0,
    defensive: 0,
    none: 0,
  };

  const evasiveCharacters: string[] = [];
  const defensiveCharacters: string[] = [];
  const noAssistTypeCharacters: string[] = [];

  // 各キャラクターを検証
  characters.forEach((character) => {
    if (character.assistType === "evasive") {
      stats.evasive++;
      evasiveCharacters.push(character.id);
    } else if (character.assistType === "defensive") {
      stats.defensive++;
      defensiveCharacters.push(character.id);
    } else {
      stats.none++;
      noAssistTypeCharacters.push(character.id);
    }

    // 型の妥当性チェック
    if (
      character.assistType &&
      !["evasive", "defensive"].includes(character.assistType)
    ) {
      console.error(
        `❌ 無効な支援タイプ: ${character.id} - ${character.assistType}`
      );
    }
  });

  // 結果を出力
  console.log("📊 統計情報:");
  console.log(`  回避支援（evasive）: ${stats.evasive}キャラクター`);
  console.log(`  パリィ支援（defensive）: ${stats.defensive}キャラクター`);
  console.log(`  支援タイプなし: ${stats.none}キャラクター`);
  console.log(`  合計: ${characters.length}キャラクター\n`);

  console.log("🏃 回避支援キャラクター:");
  evasiveCharacters.forEach((id) => {
    const char = characters.find((c) => c.id === id);
    console.log(`  - ${id}: ${char?.name.ja} (${char?.specialty})`);
  });

  console.log("\n🛡️ パリィ支援キャラクター:");
  defensiveCharacters.forEach((id) => {
    const char = characters.find((c) => c.id === id);
    console.log(`  - ${id}: ${char?.name.ja} (${char?.specialty})`);
  });

  console.log("\n❌ 支援タイプなしキャラクター:");
  noAssistTypeCharacters.slice(0, 10).forEach((id) => {
    const char = characters.find((c) => c.id === id);
    console.log(`  - ${id}: ${char?.name.ja} (${char?.specialty})`);
  });

  if (noAssistTypeCharacters.length > 10) {
    console.log(
      `  ... その他 ${noAssistTypeCharacters.length - 10}キャラクター`
    );
  }

  // 期待される結果と比較
  const expectedEvasive = ["billy", "grace", "rina", "zhuyuan"];
  const expectedDefensive = [
    "anby",
    "nicole",
    "nekomata",
    "soldier11",
    "corin",
    "anton",
    "ben",
    "koleda",
    "lycaon",
    "ellen",
  ];

  console.log("\n✅ 検証結果:");

  // 回避支援の検証
  const missingEvasive = expectedEvasive.filter(
    (id) => !evasiveCharacters.includes(id)
  );
  const extraEvasive = evasiveCharacters.filter(
    (id) => !expectedEvasive.includes(id)
  );

  if (missingEvasive.length === 0 && extraEvasive.length === 0) {
    console.log("  回避支援キャラクター: ✅ 正常");
  } else {
    if (missingEvasive.length > 0) {
      console.log(`  ❌ 不足している回避支援: ${missingEvasive.join(", ")}`);
    }
    if (extraEvasive.length > 0) {
      console.log(`  ❌ 余分な回避支援: ${extraEvasive.join(", ")}`);
    }
  }

  // パリィ支援の検証
  const missingDefensive = expectedDefensive.filter(
    (id) => !defensiveCharacters.includes(id)
  );
  const extraDefensive = defensiveCharacters.filter(
    (id) => !expectedDefensive.includes(id)
  );

  if (missingDefensive.length === 0 && extraDefensive.length === 0) {
    console.log("  パリィ支援キャラクター: ✅ 正常");
  } else {
    if (missingDefensive.length > 0) {
      console.log(
        `  ❌ 不足しているパリィ支援: ${missingDefensive.join(", ")}`
      );
    }
    if (extraDefensive.length > 0) {
      console.log(`  ❌ 余分なパリィ支援: ${extraDefensive.join(", ")}`);
    }
  }

  console.log("\n🎯 データ整合性検証完了");
}

verifyAssistTypeData();
