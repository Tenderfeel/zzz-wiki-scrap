// エージェント情報抽出のテスト
const {
  extractAgentNameFromApiValue,
  getAgentIdByName,
} = require("../../src/utils/AgentMapping.ts");

// json/mock/weapon.jsonから取得した実際のデータ
const agentValue = `$[{"ep_id":29,"icon":"https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2024/05/28/71b99a24f7864beec31370cf07cbcafb_7099117086480817211.png","amount":0,"name":"エレン・ジョー","menuId":"agent","_menuId":"8"}]$`;

console.log("Agent Value:", agentValue);

try {
  const agentName = extractAgentNameFromApiValue(agentValue);
  console.log("Extracted Agent Name:", agentName);

  const agentId = getAgentIdByName(agentName);
  console.log("Mapped Agent ID:", agentId);
} catch (error) {
  console.error("Error:", error);
}
