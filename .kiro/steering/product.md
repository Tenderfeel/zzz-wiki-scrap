# プロダクト概要

HoyoLab でホストされている Zenless Zone Zero（ZZZ）wiki からキャラクター情報を抽出するデータスクレイピングプロジェクトです。従来の Web スクレイピングではなく、API エンドポイントを通じてキャラクターデータを収集し、grungerad プロジェクトで使用するデータを作成することに焦点を当てています。

## 必要事項

- Kiro のチャットにおける返答、および作成するドキュメントは全て日本語で記載すること

## 目的

- ZZZ wiki ページからキャラクター情報を抽出
- 複数言語（日本語・英語）をサポート
- API エンドポイントを通じた構造化されたキャラクターデータへのアクセスを提供

## データソース

- 主要ソース: HoyoLab ZZZ Wiki (https://wiki.hoyolab.com/)
- API エンドポイント: `https://sg-wiki-api-static.hoyolab.com/hoyowiki/zzz/wapi/entry_page`
- 固有のページ ID を持つ 35 以上のキャラクターをサポート

## 作成するデータ

### 1.characters.ts

キャラクターページのスクレイピングから作成

```
export default [
  // データを生成
] as Character []
```

### 2.faction.ts

`/json/filters` ディレクトリ内 JSON から作成

```
export default [
  // データを生成
] as Faction[]

```

## データ取得場所

### API レスポンス構造からのデータマッピング

#### 基本情報

- **id**: `data.page.id` (例: "28")
- **name**: `data.page.name` (例: "フォン・ライカン")
- **fullName**: `data.page.name` (基本的に同じ値)

#### キャラクター特性

- **specialty**: `data.page.agent_specialties.values[0]`
  - "撃破" → `"stun"`
  - "強攻" → `"attack"`
  - "異常" → `"anomaly"`
  - "支援" → `"support"`
  - "防護" → `"defense"`
  - "命破" → `"rupture"`

#### 属性

- **stats**: `data.page.agent_stats.values[0]`
  - "氷属性" → `"ice"`
  - "炎属性" → `"fire"`
  - "電気属性" → `"electric"`
  - "物理属性" → `"physical"`
  - "エーテル属性" → `"ether"`

#### 攻撃タイプ

- **attackType**: `data.page.agent_attack_type.values[0]`
  - "打撃" → `"strike"`
  - "斬撃" → `"slash"`
  - "刺突" → `"pierce"`

#### 陣営

- **faction**: `data.page.agent_faction`

  - **name**: `data.page.agent_faction.values[0]` (例: "ヴィクトリア家政")

ID は `data/factions.ts` を参照すること。

#### レア度

- **rarity**: `data.page.agent_rarity.values[0]`
  - "S" → `"S"`
  - "A" → `"A"`

#### ステータス (Attributes)

- **場所**: `data.page.modules` → `ascension` コンポーネント内の `data` (JSON 文字列)
- **構造**: `list` 配列 → 各レベル（1, 10, 20, 30, 40, 50, 60）→ `combatList` 配列

##### 配列形式ステータス（レベル別）

- **HP**: 各レベルの `combatList` → "HP" → `values[1]` (強化後の値)
  - 取得例: `[677, 1967, 3350, 4732, 6114, 7498, 8416]`
- **攻撃力**: 各レベルの `combatList` → "攻撃力" → `values[1]`
  - 取得例: `[105, 197, 296, 394, 494, 592, 653]`
- **防御力**: 各レベルの `combatList` → "防御力" → `values[1]`
  - 取得例: `[49, 141, 241, 340, 441, 540, 606]`

##### 固定値ステータス（レベル 1 のみ）

- **衝撃力**: レベル 1 の `combatList` → "衝撃力" → `values[1]`
  - 取得例: `119`
- **会心率**: レベル 1 の `combatList` → "会心率" → `values[1]` (% 除去)
  - 取得例: `5` (5%から変換)
- **会心ダメージ**: レベル 1 の `combatList` → "会心ダメージ" → `values[1]` (% 除去)
  - 取得例: `50` (50%から変換)
- **異常マスタリー**: レベル 1 の `combatList` → "異常マスタリー" → `values[1]`
  - 取得例: `91`
- **異常掌握**: レベル 1 の `combatList` → "異常掌握" → `values[1]`
  - 取得例: `90`
- **貫通率**: レベル 1 の `combatList` → "貫通率" → `values[1]` (% 除去)
  - 取得例: `0` (0%から変換)
- **エネルギー自動回復**: レベル 1 の `combatList` → "エネルギー自動回復" → `values[1]`
  - 取得例: `1.2`

##### データ処理注意事項

- `values` 配列の `[0]` は「前」（強化前）、`[1]` は「後」（強化後）の値
- "-" 値は 0 または適切なデフォルト値に変換が必要
- パーセンテージ値（%）は数値変換時に % 記号を除去
- レベル 60 では一部ステータスが "-" になる場合がある

##### ステータス処理の実装例

```javascript
function extractAttributes(ascensionData) {
  const parsedData = JSON.parse(ascensionData);
  const levels = ["1", "10", "20", "30", "40", "50", "60"];

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

// 使用例
const ascensionComponent = modules.find((m) =>
  m.components.some((c) => c.component_id === "ascension")
);
const ascensionData = ascensionComponent.components.find(
  (c) => c.component_id === "ascension"
).data;

const attributes = extractAttributes(ascensionData);
// 結果:
// {
//   hp: [677, 1967, 3350, 4732, 6114, 7498, 8416],
//   atk: [105, 197, 296, 394, 494, 592, 653],
//   def: [49, 141, 241, 340, 441, 540, 606],
//   impact: 119,
//   critRate: 5,
//   critDmg: 50,
//   anomalyMastery: 91,
//   anomalyProficiency: 90,
//   penRatio: 0,
//   energy: 1.2
// }
```

### 多言語対応

- **日本語**: `lang=ja-jp` パラメータで API リクエスト
- **英語**: `lang=en-us` パラメータで API リクエスト
- 両方のデータを取得して、`name`と`fullName`の多言語オブジェクトを構築

### 注意事項

1. ステータス値は文字列として格納されているため、数値変換が必要
2. 一部のステータス値は "-" で表示される場合があり、適切なデフォルト値への変換が必要
3. 陣営 ID は baseInfo コンポーネントの JSON 文字列内に埋め込まれているため、JSON 解析が必要

### 型

```
type Lang = "en" | "ja";

// 陣営
type Faction = {
  id: number;
  name: { [key in Lang]: string };
};

// 特性
type Specialty =
  | "attack" // 強攻
  | "stun" // 撃破
  | "anomaly" //異常
  | "support" // 支援
  | "defense" // 防護
  | "rupture"; // 命破 ;

type Stats =
  | "ether" // エーテル
  | "fire" // 炎
  | "ice" //氷
  | "physical" // 物理
  | "electric" // 電気
  | "frostAttribute" // 霜烈
  | "auricInk"; // 玄墨

type AttackType =
  | "slash" // 斬撃
  | "pierce" // 刺突
  | "strike";

type Rarity = "A" | "S";

type Attributes = {
  // HP
  hp: number[];
  // 攻撃力
  atk: number[];
  // 防御力
  def: number[];
  // 衝撃力
  impact: number;
  // 会心率
  critRate: number;
  // 会心ダメージ
  critDmg: number;
  // 異常マスタリー
  anomalyMastery: number;
  // 異常掌握
  anomalyProficiency: number;
  // 貫通率
  penRatio: number;
  // エネルギー自動回復
  energy: number;
};

// キャラクター
type Character = {
  id: number;
  name: { [key in Lang]: string };
  fullName: { [key in Lang]: string };
  specialty: Specialty; // 特性
  stats: Stats; // 属性
  attackType: AttackType; // 攻撃タイプ
  faction: Faction<"id">; // 陣営
  rarity: Rarity; // レア度
  attr: Attributes; // ステータス
};
```
