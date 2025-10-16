/**
 * ZZZ キャラクターデータ生成スクリプト
 * HoyoLab API からキャラクター情報を取得し、TypeScript ファイルを生成
 */

const fs = require("fs");
const path = require("path");

// キャラクター ID とページ ID のマッピング
const CHARACTER_PAGE_IDS = {
  anby: 2,
  billy: 3,
  nicole: 4,
  nekomata: 5,
  soldier11: 6,
  corin: 7,
  anton: 8,
  ben: 9,
  koleda: 10,
  grace: 11,
  lycaon: 28,
  ellen: 29,
  rina: 30,
  zhuyuan: 31,
  soukaku: 32,
  lucy: 33,
  piper: 34,
  qingyi: 35,
  jane: 36,
  seth: 37,
  caesar: 38,
  burnice: 39,
  yanagi: 40,
  lighter: 41,
  miyabi: 42,
  harumasa: 43,
  astra: 44,
  evelyn: 45,
  soldier0anby: 46,
  pulchra: 47,
  trigger: 48,
  vivian: 49,
  hugo: 50,
  jufufu: 51,
  pan: 52,
  yixuan: 53,
  yuzuha: 54,
  alice: 55,
  seed: 56,
  orphie: 57,
};

// API エンドポイント
const API_BASE_URL =
  "https://sg-wiki-api-static.hoyolab.com/hoyowiki/zzz/wapi/entry_page";

/**
 * 文字列をエスケープする関数
 * @param {string} str - エスケープする文字列
 * @returns {string} エスケープされた文字列
 */
function escapeString(str) {
  if (typeof str !== "string") return str;

  return str
    .replace(/\\/g, "\\\\") // バックスラッシュをエスケープ
    .replace(/"/g, '\\"') // ダブルクォートをエスケープ
    .replace(/'/g, "\\'") // シングルクォートをエスケープ
    .replace(/\n/g, "\\n") // 改行をエスケープ
    .replace(/\r/g, "\\r") // キャリッジリターンをエスケープ
    .replace(/\t/g, "\\t"); // タブをエスケープ
}

/**
 * 特性の日本語から英語への変換
 */
const SPECIALTY_MAP = {
  撃破: "stun",
  強攻: "attack",
  異常: "anomaly",
  支援: "support",
  防護: "defense",
  命破: "rupture",
};

/**
 * 属性の日本語から英語への変換
 */
const STATS_MAP = {
  氷属性: "ice",
  炎属性: "fire",
  電気属性: "electric",
  物理属性: "physical",
  エーテル属性: "ether",
  霜烈属性: "frost",
  玄墨属性: "auricInk",
};

/**
 * 攻撃タイプの日本語から英語への変換
 */
const ATTACK_TYPE_MAP = {
  打撃: "strike",
  斬撃: "slash",
  刺突: "pierce",
};

/**
 * API からキャラクターデータを取得
 */
async function fetchCharacterData(pageId, lang = "ja-jp") {
  const url = `${API_BASE_URL}?entry_page_id=${pageId}&lang=${lang}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(
      `Failed to fetch data for page ID ${pageId} (${lang}):`,
      error
    );
    return null;
  }
}

/**
 * ステータスデータを抽出・処理
 */
function extractAttributes(ascensionData) {
  const parsedData = JSON.parse(ascensionData);

  const attributes = {
    hp: [],
    atk: [],
    def: [],
    impact: 0,
    critRate: 0,
    critDmg: 0,
    anomalyMastery: 0,
    anomalyProficiency: 0,
    penRatio: 0,
    energy: 0,
  };

  // 各レベルのデータを処理
  parsedData.list.forEach((levelData) => {
    const level = levelData.key;
    const combatList = levelData.combatList;

    combatList.forEach((stat) => {
      const value = stat.values[1]; // 強化後の値を使用

      switch (stat.key) {
        case "HP":
          const hpValue = value === "-" ? 0 : parseInt(value);
          attributes.hp.push(hpValue);
          break;
        case "攻撃力":
          const atkValue = value === "-" ? 0 : parseInt(value);
          attributes.atk.push(atkValue);
          break;
        case "防御力":
          const defValue = value === "-" ? 0 : parseInt(value);
          attributes.def.push(defValue);
          break;
        case "衝撃力":
          if (level === "1") {
            attributes.impact = value === "-" ? 0 : parseInt(value);
          }
          break;
        case "会心率":
          if (level === "1") {
            attributes.critRate =
              value === "-" ? 0 : parseFloat(value.replace("%", ""));
          }
          break;
        case "会心ダメージ":
          if (level === "1") {
            attributes.critDmg =
              value === "-" ? 0 : parseFloat(value.replace("%", ""));
          }
          break;
        case "異常マスタリー":
          if (level === "1") {
            attributes.anomalyMastery = value === "-" ? 0 : parseInt(value);
          }
          break;
        case "異常掌握":
          if (level === "1") {
            attributes.anomalyProficiency = value === "-" ? 0 : parseInt(value);
          }
          break;
        case "貫通率":
          if (level === "1") {
            attributes.penRatio =
              value === "-" ? 0 : parseFloat(value.replace("%", ""));
          }
          break;
        case "エネルギー自動回復":
          if (level === "1") {
            attributes.energy = value === "-" ? 0 : parseFloat(value);
          }
          break;
      }
    });
  });

  return attributes;
}

/**
 * キャラクターデータを処理
 */
async function processCharacterData(characterId, pageId) {
  console.log(`Processing ${characterId} (Page ID: ${pageId})...`);

  // 日本語と英語のデータを取得
  const [jaData, enData] = await Promise.all([
    fetchCharacterData(pageId, "ja-jp"),
    fetchCharacterData(pageId, "en-us"),
  ]);

  if (!jaData || !enData) {
    console.error(`Failed to fetch data for ${characterId}`);
    return null;
  }

  const jaPage = jaData.data.page;
  const enPage = enData.data.page;

  // 基本情報
  const character = {
    id: characterId,
    name: {
      ja: escapeString(jaPage.name),
      en: escapeString(enPage.name),
    },
    fullName: {
      ja: escapeString(jaPage.name),
      en: escapeString(enPage.name),
    },
    specialty: SPECIALTY_MAP[jaPage.agent_specialties.values[0]],
    stats: STATS_MAP[jaPage.agent_stats.values[0]],
    attackType: jaPage.agent_attack_type.values.map(
      (type) => ATTACK_TYPE_MAP[type]
    ),
    faction: parseInt(jaPage.agent_faction.values[0]), // 仮の値、実際は陣営IDマッピングが必要
    rarity: jaPage.agent_rarity.values[0],
  };

  // ステータス情報を抽出
  const ascensionComponent = jaPage.modules.find((m) =>
    m.components.some((c) => c.component_id === "ascension")
  );

  if (ascensionComponent) {
    const ascensionData = ascensionComponent.components.find(
      (c) => c.component_id === "ascension"
    ).data;

    character.attr = extractAttributes(ascensionData);
  }

  return character;
}

/**
 * TypeScript ファイルを生成
 */
function generateTypeScriptFile(characters) {
  const characterEntries = characters
    .filter((char) => char !== null)
    .map((char) => {
      const attackTypeArray = Array.isArray(char.attackType)
        ? `[${char.attackType.map((type) => `"${type}"`).join(", ")}]`
        : `["${char.attackType}"]`;

      return `  {
    id: "${char.id}",
    name: { ja: "${char.name.ja}", en: "${char.name.en}" },
    fullName: { ja: "${char.fullName.ja}", en: "${char.fullName.en}" },
    specialty: "${char.specialty}",
    stats: "${char.stats}",
    attackType: ${attackTypeArray},
    faction: ${char.faction},
    rarity: "${char.rarity}",
    attr: {
      hp: [${char.attr.hp.join(", ")}],
      atk: [${char.attr.atk.join(", ")}],
      def: [${char.attr.def.join(", ")}],
      impact: ${char.attr.impact},
      critRate: ${char.attr.critRate},
      critDmg: ${char.attr.critDmg},
      anomalyMastery: ${char.attr.anomalyMastery},
      anomalyProficiency: ${char.attr.anomalyProficiency},
      penRatio: ${char.attr.penRatio},
      energy: ${char.attr.energy},
    },
  }`;
    })
    .join(",\n");

  return `import { Character } from "../src/types";

export default [
${characterEntries}
] as Character[];
`;
}

/**
 * メイン処理
 */
async function main() {
  console.log("ZZZ キャラクターデータ生成を開始...");

  const characters = [];

  // 各キャラクターのデータを処理
  for (const [characterId, pageId] of Object.entries(CHARACTER_PAGE_IDS)) {
    const characterData = await processCharacterData(characterId, pageId);
    characters.push(characterData);

    // API レート制限を避けるため少し待機
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // TypeScript ファイルを生成
  const tsContent = generateTypeScriptFile(characters);

  // ファイルに書き込み
  const outputPath = path.join(__dirname, "..", "data", "characters.ts");
  fs.writeFileSync(outputPath, tsContent, "utf8");

  console.log(`キャラクターデータを ${outputPath} に生成しました`);
  console.log(
    `処理されたキャラクター数: ${characters.filter((c) => c !== null).length}`
  );
}

// スクリプト実行
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  escapeString,
  processCharacterData,
  generateTypeScriptFile,
};
