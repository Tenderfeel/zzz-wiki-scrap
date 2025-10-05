## ZZZ wiki Scraping

[hoyoLab wiki](https://wiki.hoyolab.com/) のキャラクターページから必要な情報を取得する。

#### API エンドポイント

ページデータが格納されている JSON は下記 URL で取得可能：

```
https://sg-wiki-api-static.hoyolab.com/hoyowiki/zzz/wapi/entry_page?entry_page_id={pageId}
```

言語別クエリパラメータ：

- 日本語: `?lang=ja-jp`
- 英語: `?lang=en-us`

### キャラクターページリスト

日本語クエリ `?lang=ja-jp`、英語クエリ `?lang=en-us` を末尾に追加する。  
リンクテキストはキャラクター ID として使用する。

- [anby](https://wiki.hoyolab.com/pc/zzz/entry/2) - pageId: 2
- [billy](https://wiki.hoyolab.com/pc/zzz/entry/19) - pageId: 19
- [nicole](https://wiki.hoyolab.com/pc/zzz/entry/20) - pageId: 20
- [nekomata](https://wiki.hoyolab.com/pc/zzz/entry/21) - pageId: 21
- [soldier11](https://wiki.hoyolab.com/pc/zzz/entry/22) - pageId: 22
- [corin](https://wiki.hoyolab.com/pc/zzz/entry/23) - pageId: 23
- [anton](https://wiki.hoyolab.com/pc/zzz/entry/24) - pageId: 24
- [ben](https://wiki.hoyolab.com/pc/zzz/entry/25) - pageId: 25
- [koleda](https://wiki.hoyolab.com/pc/zzz/entry/26) - pageId: 26
- [grace](https://wiki.hoyolab.com/pc/zzz/entry/27) - pageId: 27
- [lycaon](https://wiki.hoyolab.com/pc/zzz/entry/28) - pageId: 28
- [ellen](https://wiki.hoyolab.com/pc/zzz/entry/29) - pageId: 29
- [rina](https://wiki.hoyolab.com/pc/zzz/entry/30) - pageId: 30
- [zhuyuan](https://wiki.hoyolab.com/pc/zzz/entry/31) - pageId: 31
- [soukaku](https://wiki.hoyolab.com/pc/zzz/entry/89) - pageId: 89
- [lucy](https://wiki.hoyolab.com/pc/zzz/entry/125) - pageId: 125
- [piper](https://wiki.hoyolab.com/pc/zzz/entry/126) - pageId: 126
- [qingyi](https://wiki.hoyolab.com/pc/zzz/entry/350) - pageId: 350
- [jane](https://wiki.hoyolab.com/pc/zzz/entry/368) - pageId: 368
- [seth](https://wiki.hoyolab.com/pc/zzz/entry/369) - pageId: 369
- [caesar](https://wiki.hoyolab.com/pc/zzz/entry/381) - pageId: 381
- [burnice](https://wiki.hoyolab.com/pc/zzz/entry/382) - pageId: 382
- [yanagi](https://wiki.hoyolab.com/pc/zzz/entry/529) - pageId: 529
- [lighter](https://wiki.hoyolab.com/pc/zzz/entry/530) - pageId: 530
- [miyabi](https://wiki.hoyolab.com/pc/zzz/entry/537) - pageId: 537
- [harumasa](https://wiki.hoyolab.com/pc/zzz/entry/538) - pageId: 538
- [astra](https://wiki.hoyolab.com/pc/zzz/entry/588) - pageId: 588
- [evelyn](https://wiki.hoyolab.com/pc/zzz/entry/589) - pageId: 589
- [soldier0anby](https://wiki.hoyolab.com/pc/zzz/entry/618) - pageId: 618
- [pulchra](https://wiki.hoyolab.com/pc/zzz/entry/619) - pageId: 619
- [trigger](https://wiki.hoyolab.com/pc/zzz/entry/620) - pageId: 620
- [vivian](https://wiki.hoyolab.com/pc/zzz/entry/626) - pageId: 626
- [hugo](https://wiki.hoyolab.com/pc/zzz/entry/707) - pageId: 707
- [jufufu](https://wiki.hoyolab.com/pc/zzz/entry/750) - pageId: 750
- [pan](https://wiki.hoyolab.com/pc/zzz/entry/751) - pageId: 751
- [yixuan](https://wiki.hoyolab.com/pc/zzz/entry/752) - pageId: 752
- [yuzuha](https://wiki.hoyolab.com/pc/zzz/entry/837) - pageId: 837
- [alice](https://wiki.hoyolab.com/pc/zzz/entry/838) - pageId: 838
- [seed](https://wiki.hoyolab.com/pc/zzz/entry/901) - pageId: 901
- [orphie](https://wiki.hoyolab.com/pc/zzz/entry/902) - pageId: 902

## name リスト

短縮名リスト

```
- anby: { ja: "アンビー", en: "Anby" }
- billy: {ja: "ビリー", en: "Billy" }
- nicole: { ja: "ニコ", en: "Nicole" }
- nekomata: { ja: "猫又", en: "Necomata"}
- soldier11: { ja: "11号", en: "Soldier 11" }
- corin: { ja: "カリン", en: "Corin"}
- anton: { ja: "アンドー", en: "Anton"}
- ben: { ja: "ベン", en: "Ben"}
- koreda: {ja: "クレタ", en: "Koleda"}
- grace: {ja: "グレース", en: "Grace"}
- lycaon: {ja: "ライカン", en: "Lycaon"}
- ellen: {ja: "エレン", en: "Ellen" }
- rina: { ja: "リナ", en: "Rina"}
- zhuyuan: {ja "朱鳶", en: "Zhu Yuan"}
- soukaku: { ja: "蒼角", en: "Soukaku"}
- lucy: {ja: "ルーシー", en: "Lucy"}
- piper: { ja: "パイパー", en: "Piper"}
- qingyi: {ja: "青衣", en: "Qingyi"}
- jane: {ja:"ジェーン", en: "Jane"}
- seth:  {ja: "セス", en: "Seth"}
- caesar: {ja: "シーザー", en: "Caesar"}
- burnice: {ja: "バーニス", en: "Burnice"}
- yanagi: {ja: "柳", en: "Yanagi"}
- lighter: { ja: "ライト", en: "Lighter"}
- miyabi: { ja: "雅", en: "Miyabi"}
- harumasa: { ja: "悠真", en: "Harumasa"}
- astra: { ja: "アストラ", en: "Astra"}
- evelyn: { ja: "イヴリン", en: "Evelyn"}
- soldier0anby: { ja: "0号アンビー", en: "0-Anby"}
- pulchra: { ja: "プルクラ", en: "Pulchra"}
- trigger: {ja: "トリガー", en: "Trigger"}
- vivian: {ja: "ビビアン", en: "Vivian"}
- hugo: {ja:"ヒューゴ", en: "Hugo"}
- jufufu: {ja: "橘福福", en: "Ju Fufu"}
- pan: {ja: "潘引壺", en: "Pan"}
- yixuan: { ja: "儀玄", en: "Yixuan"}
- yuzuha: {ja: "柚葉", en: "Yuzuha"}
- alice: {ja: "アリス", en: "Alice"}
- seed: {ja: "シード", en: "Seed"}
- orphie: {ja: "オルペウス", en: "Orphie"}
```

## 作成するデータ

### 1.characters.ts

```
export default [
  // データを生成
] as Character []
```

### 2.factions.ts

`/json/filters` ディレクトリ内 JSON から作成。
配列の index を ID として使用する（1 スタート）

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
  - **id**: `data.page.modules[0].components[0].data` (JSON 解析) → baseInfo → 陣営 → ep_id
  - **name**: `data.page.agent_faction.values[0]` (例: "ヴィクトリア家政")

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
