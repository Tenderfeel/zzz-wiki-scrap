import characters from "../data/characters";

console.log("=== キャラクターデータの assistType 状況 ===");
console.log(`総キャラクター数: ${characters.length}`);

const withAssistType = characters.filter(
  (char) => char.assistType !== undefined
);
const withoutAssistType = characters.filter(
  (char) => char.assistType === undefined
);

console.log(`assistType 設定済み: ${withAssistType.length}`);
console.log(`assistType 未設定: ${withoutAssistType.length}`);

const evasiveCount = characters.filter(
  (char) => char.assistType === "evasive"
).length;
const defensiveCount = characters.filter(
  (char) => char.assistType === "defensive"
).length;

console.log(`evasive: ${evasiveCount}`);
console.log(`defensive: ${defensiveCount}`);

console.log("\n=== assistType 未設定のキャラクター ===");
withoutAssistType.forEach((char) => {
  console.log(`- ${char.id} (${char.name.ja}) - ${char.specialty}`);
});

console.log("\n=== Specialty 別 assistType 分布 ===");
const specialties = [
  "attack",
  "stun",
  "anomaly",
  "support",
  "defense",
  "rupture",
] as const;

specialties.forEach((specialty) => {
  const chars = characters.filter((char) => char.specialty === specialty);
  const withAssist = chars.filter((char) => char.assistType !== undefined);
  const evasive = chars.filter((char) => char.assistType === "evasive");
  const defensive = chars.filter((char) => char.assistType === "defensive");

  console.log(
    `${specialty}: 総数=${chars.length}, 設定済み=${withAssist.length}, evasive=${evasive.length}, defensive=${defensive.length}`
  );
});
