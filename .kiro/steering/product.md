---
inclusion: always
---

# データマッピング・型定義

## データ変換マッピング

### API フィールド → 内部型変換

| 出力フィールド | API パス                                | 変換ルール             |
| -------------- | --------------------------------------- | ---------------------- |
| `id`           | `data.page.id`                          | 数値変換               |
| `name`         | `data.page.name`                        | 多言語オブジェクト     |
| `specialty`    | `data.page.agent_specialties.values[0]` | 日本語 → 英語 enum     |
| `stats`        | `data.page.agent_stats.values[0]`       | 属性名 → 英語 enum     |
| `attackType`   | `data.page.agent_attack_type.values[0]` | 攻撃タイプ → 英語 enum |
| `faction`      | `data.page.agent_faction.values[0]`     | 陣営 ID 参照           |
| `rarity`       | `data.page.agent_rarity.values[0]`      | そのまま使用           |

### 日本語 → 英語 enum 変換

**Specialty (特性)**:

- `"撃破"` → `"stun"` | `"強攻"` → `"attack"` | `"異常"` → `"anomaly"`
- `"支援"` → `"support"` | `"防護"` → `"defense"` | `"命破"` → `"rupture"`

**Stats (属性)**:

- `"氷属性"` → `"ice"` | `"炎属性"` → `"fire"` | `"電気属性"` → `"electric"`
- `"物理属性"` → `"physical"` | `"エーテル属性"` → `"ether"`

**AttackType (攻撃タイプ)**:

- `"打撃"` → `"strike"` | `"斬撃"` → `"slash"` | `"刺突"` → `"pierce"`

## Attributes (ステータス) 抽出

### データ場所

`data.page.modules` → `ascension`コンポーネント → `data` (JSON 文字列)

### 処理ルール

- **レベル別配列** (7 レベル: 1,10,20,30,40,50,60): `hp[]`, `atk[]`, `def[]`
- **固定値** (レベル 1 のみ): `impact`, `critRate`, `critDmg`, `anomalyMastery`, `anomalyProficiency`, `penRatio`, `energy`
- **値取得**: `combatList` → `values[1]` (強化後値)
- **変換**: `"-"` → `0`, `"50%"` → `50` (パーセンテージ除去)

## TypeScript 型定義

```typescript
type Lang = "en" | "ja";

type Specialty =
  | "attack"
  | "stun"
  | "anomaly"
  | "support"
  | "defense"
  | "rupture";
type Stats =
  | "ether"
  | "fire"
  | "ice"
  | "physical"
  | "electric"
  | "frostAttribute"
  | "auricInk";
type AttackType = "slash" | "pierce" | "strike";
type Rarity = "A" | "S";

type Attributes = {
  hp: number[]; // [1,10,20,30,40,50,60]レベル別
  atk: number[]; // [1,10,20,30,40,50,60]レベル別
  def: number[]; // [1,10,20,30,40,50,60]レベル別
  impact: number; // 固定値
  critRate: number; // 固定値 (% 除去済み)
  critDmg: number; // 固定値 (% 除去済み)
  anomalyMastery: number;
  anomalyProficiency: number;
  penRatio: number; // 固定値 (% 除去済み)
  energy: number;
};

type Faction = {
  id: number;
  name: { [key in Lang]: string };
};

type Character = {
  id: number;
  name: { [key in Lang]: string };
  fullName: { [key in Lang]: string };
  specialty: Specialty;
  stats: Stats;
  attackType: AttackType;
  faction: Faction;
  rarity: Rarity;
  attr: Attributes;
};
```

## 出力ファイル仕様

- **`data/characters.ts`**: `export default Character[]`
- **`data/factions.ts`**: `export default Faction[]`

## 重要な処理規約

- **言語優先順位**: 日本語 (`ja-jp`) → 英語 (`en-us`) フォールバック
- **エラーハンドリング**: `"-"` 値・欠損データの適切な処理
- **型安全性**: 厳密な TypeScript 型定義準拠
