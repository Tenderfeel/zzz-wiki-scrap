# マスターデータ一元管理 設計ドキュメント

## 背景と目的

現状、属性・特性・陣営・支援タイプのデータが複数ファイルに分散しており、ゲームアップデートで新コンテンツが追加されるたびに複数箇所を手動更新する必要がある。

新しい属性を追加する場合の現状：
- `src/types/index.ts` — union型の追加
- `data/stats.ts` — 表示ラベルの追加
- `src/mappers/DataMapper.ts` — マッピング辞書の追加
- `src/mappers/AttributeMapper.ts` — マッピング辞書の追加（属性のみ）

目的：`json/master-data.json` を唯一の編集対象とし、後続ファイルをすべてコード生成で自動更新する。

## スコープ

- **対象**: Stats（属性）, Specialty（特性）, Faction（陣営）, AssistType（支援タイプ）
- **非対象**: キャラクター・武器・ドライバーディスク・ボンプのデータ生成パイプライン（現状維持）

## アーキテクチャ

### 単一ソースオブトゥルース

```
json/master-data.json
```

このファイルのみ手動編集する。他のファイルはすべて生成物。

### データフロー

```
json/master-data.json
        ↓  npm run generate:master
src/types/master-types.ts      (生成) Stats / Specialty / AssistType union型
src/mappers/MasterMappings.ts  (生成) DataMapper / AttributeMapper 用マッピング辞書
data/stats.ts                  (生成) 表示ラベル
data/specialties.ts            (生成) 表示ラベル
data/factions.ts               (生成) 表示ラベル
```

### 変更しないファイル

- `src/types/index.ts` — `master-types.ts` を re-export する行を追加するだけ。他の型定義はそのまま。
- `DataMapper.ts` / `AttributeMapper.ts` — ハードコード辞書を `MasterMappings.ts` インポートに差し替えるだけ。ロジックは変更しない。

## JSONファイル設計

### `json/master-data.json`

```jsonc
{
  "stats": [
    {
      "id": "ice",
      "label": { "ja": "氷", "en": "Ice" },
      "aliases": ["氷属性", "ice", "Ice"]
    },
    {
      "id": "fire",
      "label": { "ja": "炎", "en": "Fire" },
      "aliases": ["炎属性", "fire", "Fire"]
    },
    {
      "id": "electric",
      "label": { "ja": "電気", "en": "Electric" },
      "aliases": ["電気属性", "electric", "Electric"]
    },
    {
      "id": "physical",
      "label": { "ja": "物理", "en": "Physical" },
      "aliases": ["物理属性", "physical", "Physical"]
    },
    {
      "id": "ether",
      "label": { "ja": "エーテル", "en": "Ether" },
      "aliases": ["エーテル属性", "ether", "Ether"]
    },
    {
      "id": "wind",
      "label": { "ja": "風", "en": "Wind" },
      "aliases": ["風属性", "wind", "Wind"]
    },
    {
      "id": "frost",
      "label": { "ja": "霜烈", "en": "Frost" },
      "aliases": ["霜烈属性", "frost", "Frost", "Frost Attribute"]
    },
    {
      "id": "auricInk",
      "label": { "ja": "玄墨", "en": "Auric Ink" },
      "aliases": ["玄墨属性", "auricInk", "Auric Ink"]
    },
    {
      "id": "lumiflux",
      "label": { "ja": "流明", "en": "Lumiflux" },
      "aliases": ["流明属性", "lumiflux", "Lumiflux"]
    },
    {
      "id": "honedEdge",
      "label": { "ja": "凛刃", "en": "Honed Edge" },
      "aliases": ["凛刃属性", "honedEdge", "Honed Edge"]
    }
  ],
  "specialties": [
    {
      "id": "attack",
      "label": { "ja": "強攻", "en": "Attack" },
      "aliases": ["強攻", "Attack"]
    },
    {
      "id": "stun",
      "label": { "ja": "撃破", "en": "Stun" },
      "aliases": ["撃破", "Stun"]
    },
    {
      "id": "anomaly",
      "label": { "ja": "異常", "en": "Anomaly" },
      "aliases": ["異常", "Anomaly"]
    },
    {
      "id": "support",
      "label": { "ja": "支援", "en": "Support" },
      "aliases": ["支援", "Support"]
    },
    {
      "id": "defense",
      "label": { "ja": "防護", "en": "Defense" },
      "aliases": ["防護", "Defense"]
    },
    {
      "id": "rupture",
      "label": { "ja": "命破", "en": "Rupture" },
      "aliases": ["命破", "Rupture"]
    },
    {
      "id": "armorer",
      "label": { "ja": "鋭御", "en": "Armorer" },
      "aliases": ["鋭御", "Armorer"]
    }
  ],
  "factions": [
    { "id": 1, "name": { "ja": "邪兎屋", "en": "Cunning Hares" } },
    { "id": 2, "name": { "ja": "ヴィクトリア家政", "en": "Victoria Housekeeping Co." } },
    { "id": 3, "name": { "ja": "白祇重工", "en": "Belobog Heavy Industries" } },
    { "id": 4, "name": { "ja": "防衛軍・オボルス小隊", "en": "Defense Force - Obol Squad" } },
    { "id": 5, "name": { "ja": "対ホロウ特別行動部第六課", "en": "Hollow Special Operations Section 6" } },
    { "id": 6, "name": { "ja": "治安局・特務捜査班", "en": "Criminal Investigation Special Response Team" } },
    { "id": 7, "name": { "ja": "カリュドーンの子", "en": "Sons of Calydon" } },
    { "id": 8, "name": { "ja": "スターズ・オブ・リラ", "en": "Stars of Lyra" } },
    { "id": 9, "name": { "ja": "防衛軍・シルバー小隊", "en": "Defense Force - Silver Squad" } },
    { "id": 10, "name": { "ja": "モッキンバード", "en": "Mockingbird" } },
    { "id": 11, "name": { "ja": "雲嶽山", "en": "Yunkui Summit" } },
    { "id": 12, "name": { "ja": "怪啖屋", "en": "Spook Shack" } },
    { "id": 13, "name": { "ja": "クランプスの黒枝", "en": "Krampus Compliance Authority" } },
    { "id": 14, "name": { "ja": "妄想エンジェル", "en": "Angels of Delusion" } },
    { "id": 15, "name": { "ja": "治安局・都市秩序部", "en": "Public Security: Metropolitan Order Division" } },
    { "id": 16, "name": { "ja": "パエトーン", "en": "Phaethon" } },
    { "id": 17, "name": { "ja": "外務計策局", "en": "External Strategy Department" } },
    { "id": 18, "name": { "ja": "ダアト結社", "en": "Covenant of Dayat" } },
    { "id": 19, "name": { "ja": "空域巡警局", "en": "Airspace Patrol Department" } },
    { "id": 20, "name": { "ja": "フリンツ工房", "en": "Flint Workshop" } }
  ],
  "assistTypes": [
    {
      "id": "evasive",
      "label": { "ja": "回避支援", "en": "Evasive Assist" },
      "aliases": ["回避支援", "Evasive Assist"]
    },
    {
      "id": "defensive",
      "label": { "ja": "パリィ支援", "en": "Defensive Assist" },
      "aliases": ["パリィ支援", "Defensive Assist"]
    }
  ]
}
```

### スキーマ定義

```typescript
// Stats・Specialty・AssistType の各エントリ
{
  id: string;                        // TypeScript union値・表示ファイルのキー
  label: { ja: string; en: string }; // 表示用ラベル
  aliases: string[];                 // APIから来る全表記（日英混在）→ このIDへのマッピング用
}

// Faction エントリ
{
  id: number;
  name: { ja: string; en: string };
}
```

## 生成スクリプト設計

### `scripts/generate-master.ts`

処理フロー：
1. `json/master-data.json` を読み込み・バリデーション
   - alias の重複チェック（同じ文字列が複数IDにマッピングされていないか）
   - id の重複チェック
   - label・aliases が空でないかチェック
2. `src/types/master-types.ts` を生成
3. `src/mappers/MasterMappings.ts` を生成
4. `data/stats.ts` を生成
5. `data/specialties.ts` を生成
6. `data/factions.ts` を生成
7. 生成完了サマリーをコンソール出力

### 生成ファイル例

**`src/types/master-types.ts`**（生成）
```typescript
// このファイルは自動生成です。編集は json/master-data.json で行ってください。
export type Stats = "ice" | "fire" | "electric" | "physical" | "ether" | "wind" | "frost" | "auricInk" | "lumiflux" | "honedEdge";
export type Specialty = "attack" | "stun" | "anomaly" | "support" | "defense" | "rupture" | "armorer";
export type AssistType = "evasive" | "defensive";
```

**`src/mappers/MasterMappings.ts`**（生成）
```typescript
// このファイルは自動生成です。編集は json/master-data.json で行ってください。
import type { Stats, Specialty, AssistType } from "../types";
export const STATS_MAPPING: Record<string, Stats> = {
  "氷属性": "ice", "ice": "ice", "Ice": "ice",
  "炎属性": "fire", ...
};
export const SPECIALTY_MAPPING: Record<string, Specialty> = { ... };
export const ASSIST_TYPE_MAPPING: Record<string, AssistType> = { ... };
```

## 既存ファイルへの変更

### `src/types/index.ts`（変更：最小限）

```typescript
// 追加（ファイル先頭付近）
export type { Stats, Specialty, AssistType } from "./master-types";
// 削除：Stats、Specialty、AssistType のunion型定義（master-types.ts に移動）
// 維持：StatsData、SpecialtyData、Rarity、Attributes、Faction、その他すべて
```

### `src/mappers/DataMapper.ts`（変更：最小限）

```typescript
// 追加
import { STATS_MAPPING, SPECIALTY_MAPPING, ASSIST_TYPE_MAPPING } from "./MasterMappings";
// 削除：STATS_MAPPING、SPECIALTY_MAPPING、ASSIST_TYPE_MAPPING の static readonly 定義
// 変更：各メソッドの参照を DataMapper.XXX_MAPPING → インポートした定数に変更
```

### `src/mappers/AttributeMapper.ts`（変更：最小限）

```typescript
// 追加
import { STATS_MAPPING } from "./MasterMappings";
// 削除：ATTRIBUTE_MAPPING の static readonly 定義
// 変更：this.ATTRIBUTE_MAPPING → STATS_MAPPING（別名なし、同じキーを使用）
```

### `package.json`（追加）

```json
"scripts": {
  "generate:master": "tsx scripts/generate-master.ts"
}
```

## 副作用・既知の修正点

- `data/stats.ts` の `wind` 重複エントリ：`master-data.json` は重複なしで定義するため、生成時に自動解消される。

## 更新ワークフロー（完成後）

新属性を追加する場合：
1. `json/master-data.json` の `stats` 配列に1エントリ追加（id・label・aliases）
2. `npm run generate:master` を実行
3. 生成されたファイルをコミット

新陣営を追加する場合：
1. `json/master-data.json` の `factions` 配列に1エントリ追加
2. `npm run generate:master` を実行
3. 生成されたファイルをコミット
