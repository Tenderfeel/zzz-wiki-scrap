/**
 * エージェント名からIDへのマッピングユーティリティ
 * 音動機の該当エージェント情報からagentIdを取得するために使用
 */

/**
 * エージェント名（日本語）からagentIdへのマッピング
 * data/characters.ts から生成されたキャラクター情報を基に作成
 *
 * 新しいキャラクターを追加する際は以下の形式に従ってください：
 * - 日本語名（短縮形）: "agent_id"
 * - 日本語名（フルネーム）: "agent_id"
 *
 * agent_idはdata/characters.tsのidフィールドと一致させてください
 */
export const AGENT_NAME_TO_ID_MAP: Record<string, string> = {
  // 基本キャラクター（リリース1.0）
  アンビー: "anby",
  "アンビー・デマラ": "anby",
  ビリー: "billy",
  "ビリー・キッド": "billy",
  ニコ: "nicole",
  "ニコ・デマラ": "nicole",
  猫又: "nekomata",
  猫宮又奈: "nekomata",
  "11号": "soldier11",
  "「11号」": "soldier11",
  カリン: "corin",
  "カリン・ウィクス": "corin",
  アンドー: "anton",
  "アンドー・イワノフ": "anton",
  ベン: "ben",
  "ベン・ビガー": "ben",
  クレタ: "koleda",
  "クレタ・ベロボーグ": "koleda",
  グレース: "grace",
  "グレース・ハワード": "grace",
  ライカン: "lycaon",
  "フォン・ライカン": "lycaon",
  エレン: "ellen",
  "エレン・ジョー": "ellen",
  リナ: "rina",
  "アレクサンドリナ・セバスチャン": "rina",
  朱鳶: "zhuyuan",
  蒼角: "soukaku",
  ルーシー: "lucy",
  "ルシアーナ・デ・モンテフィーノ": "lucy",
  パイパー: "piper",
  "パイパー・ウィール": "piper",

  // 1.1追加キャラクター
  青衣: "qingyi",
  ジェーン: "jane",
  "ジェーン・ドゥ": "jane",
  セス: "seth",
  "セス・ローウェル": "seth",

  // 1.2追加キャラクター
  シーザー: "caesar",
  "キング・シーザー": "caesar",
  バーニス: "burnice",
  "バーニス・ホワイト": "burnice",

  // 1.3追加キャラクター
  柳: "yanagi",
  月城柳: "yanagi",
  ライト: "lighter",

  // 1.4追加キャラクター
  雅: "miyabi",
  星見雅: "miyabi",
  悠真: "harumasa",
  浅羽悠真: "harumasa",

  // 1.5追加キャラクター
  アストラ: "astra",
  "アストラ・ヤオ": "astra",
  イヴリン: "evelyn",
  "イヴリン・シェヴァリエ": "evelyn",

  // 1.6追加キャラクター
  "0号アンビー": "soldier0anby",
  "0号・アンビー": "soldier0anby",
  プルクラ: "pulchra",
  "プルクラ・フェリーニ": "pulchra",
  トリガー: "trigger",
  "「トリガー」": "trigger",

  // 1.7追加キャラクター
  ビビアン: "vivian",
  "ビビアン・バンシー": "vivian",
  ヒューゴ: "hugo",
  "ヒューゴ・ヴラド": "hugo",

  // 2.0追加キャラクター
  橘福福: "jufufu",
  潘引壺: "pan",
  儀玄: "yixuan",

  // 2.1追加キャラクター
  柚葉: "yuzuha",
  浮波柚葉: "yuzuha",
  アリス: "alice",
  "アリス・タイムフィールド": "alice",

  // 2.2追加キャラクター
  シード: "seed",
  "「シード」": "seed",
  オルペウス: "orphie",
  "オルペウス・マグヌッソン＆「鬼火」": "orphie",
  "オルペウス＆「鬼火」": "orphie",

  // 2.3追加キャラクター
  リュシア: "lucia",
  "リュシア・エロウェン": "lucia",
  狛野真斗: "manato",
  イドリー: "yidhari",
  "イドリー・マーフィー": "yidhari",
};

/**
 * エージェント名からagentIdを取得
 * @param agentName エージェント名（日本語または英語）
 * @returns agentId（見つからない場合は空文字）
 */
export function getAgentIdByName(agentName: string): string {
  const normalizedName = agentName.trim();

  // デバッグ情報: 入力値をログ出力
  console.debug(`[AgentMapping] エージェント名検索開始: "${normalizedName}"`);

  // 完全一致を優先（最も確実なマッチング）
  if (AGENT_NAME_TO_ID_MAP[normalizedName]) {
    const agentId = AGENT_NAME_TO_ID_MAP[normalizedName];
    console.debug(
      `[AgentMapping] 完全一致で発見: "${normalizedName}" -> "${agentId}"`
    );
    return agentId;
  }

  // より厳密な部分一致条件を実装
  for (const [mappedName, agentId] of Object.entries(AGENT_NAME_TO_ID_MAP)) {
    // 条件1: 完全一致（上記で処理済みだが念のため）
    if (mappedName === normalizedName) {
      console.debug(
        `[AgentMapping] 完全一致で発見: "${normalizedName}" -> "${agentId}"`
      );
      return agentId;
    }

    // 条件2: マップされた名前が入力名を含む（入力名が短縮形の場合）
    // 最小長制限を追加して誤マッチを防ぐ
    if (mappedName.includes(normalizedName) && normalizedName.length > 2) {
      console.debug(
        `[AgentMapping] 部分一致で発見（マップ名に含まれる）: "${normalizedName}" in "${mappedName}" -> "${agentId}"`
      );
      return agentId;
    }

    // 条件3: 入力名がマップされた名前を含む（入力名がフルネームの場合）
    // 最小長制限を追加して誤マッチを防ぐ
    if (normalizedName.includes(mappedName) && mappedName.length > 2) {
      console.debug(
        `[AgentMapping] 部分一致で発見（入力名に含まれる）: "${mappedName}" in "${normalizedName}" -> "${agentId}"`
      );
      return agentId;
    }
  }

  // マッチしなかった場合のデバッグ情報
  console.debug(
    `[AgentMapping] エージェント名が見つかりませんでした: "${normalizedName}"`
  );
  console.debug(
    `[AgentMapping] 利用可能なマッピング数: ${
      Object.keys(AGENT_NAME_TO_ID_MAP).length
    }`
  );

  return "";
}

/**
 * APIレスポンスの該当エージェント情報からエージェント名を抽出
 * @param agentValue APIから取得したエージェント情報の文字列
 * @returns エージェント名（見つからない場合は空文字）
 */
export function extractAgentNameFromApiValue(agentValue: string): string {
  try {
    // agentValueの形式: "$[{\"ep_id\":29,\"name\":\"エレン・ジョー\",...}]$"
    // まず$[...]$の部分を抽出
    const jsonMatch = agentValue.match(/\$\[(.*?)\]\$/);

    if (!jsonMatch || !jsonMatch[1]) {
      return "";
    }

    // JSONとしてパース
    const agentData = JSON.parse(jsonMatch[1]);

    // nameフィールドを取得（オブジェクトから直接）
    if (agentData && agentData.name) {
      return agentData.name;
    }

    return "";
  } catch (error) {
    // フォールバック: 正規表現でnameフィールドを直接抽出
    try {
      const nameMatch = agentValue.match(/"name":\s*"([^"]+)"/);

      if (nameMatch && nameMatch[1]) {
        return nameMatch[1];
      }
    } catch (fallbackError) {
      // 何もしない
    }

    return "";
  }
}
