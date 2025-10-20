import { WeaponDataMapper } from "../../src/mappers/WeaponDataMapper";
import weaponMockData from "../../json/mock/weapon.json";

// 簡単なテスト実行
const mapper = new WeaponDataMapper();

console.log("=== WeaponDataMapper テスト ===");

// 基本情報抽出テスト
const basicInfo = mapper.extractBasicWeaponInfo(weaponMockData, "85");
console.log("基本情報:", basicInfo);

// スキル情報抽出テスト
const skillInfo = mapper.extractWeaponSkillInfo(
  weaponMockData.data.page.modules
);
console.log("スキル情報:", skillInfo);

// 突破ステータス抽出テスト
const attributes = mapper.extractWeaponAttributes(
  weaponMockData.data.page.modules
);
console.log("突破ステータス:", attributes);

// エージェント情報抽出テスト
const agentInfo = mapper.extractAgentInfo(weaponMockData.data.page.modules);
console.log("エージェント情報:", agentInfo);

// 基礎・上級ステータス抽出テスト
const baseAdvanced = mapper.extractBaseAndAdvancedAttributes(
  weaponMockData.data.page.modules
);
console.log("基礎・上級ステータス:", baseAdvanced);

console.log("=== テスト完了 ===");
