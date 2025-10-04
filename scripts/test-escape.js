/**
 * エスケープ処理のテストスクリプト
 */

const { escapeString } = require("./generate-characters");

// テストケース
const testCases = [
  "オルペウス・マグヌッソン＆「鬼火」",
  'Orphie Magnusson & "Magus"',
  "Test with 'single quotes'",
  'Test with "double quotes"',
  "Test with \\ backslash",
  "Test with\nnewline",
  "Test with\ttab",
  "Normal text without special characters",
];

console.log("エスケープ処理テスト結果:");
console.log("=".repeat(50));

testCases.forEach((testCase, index) => {
  const escaped = escapeString(testCase);
  console.log(`テスト ${index + 1}:`);
  console.log(`  元の文字列: ${testCase}`);
  console.log(`  エスケープ後: ${escaped}`);
  console.log(`  TypeScript: "${escaped}"`);
  console.log("");
});

// 実際のキャラクター名でのテスト
console.log("実際のキャラクター名テスト:");
console.log("=".repeat(50));

const characterNames = {
  ja: "オルペウス・マグヌッソン＆「鬼火」",
  en: 'Orphie Magnusson & "Magus"',
};

const escapedNames = {
  ja: escapeString(characterNames.ja),
  en: escapeString(characterNames.en),
};

console.log("生成されるTypeScriptコード:");
console.log(`name: { ja: "${escapedNames.ja}", en: "${escapedNames.en}" },`);
console.log(
  `fullName: { ja: "${escapedNames.ja}", en: "${escapedNames.en}" },`
);
