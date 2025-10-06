---
inclusion: always
---

# ZZZ Character Data Processing Guidelines

## プロジェクト概要

Zenless Zone Zero (ZZZ) キャラクター情報を HoyoLab API から取得する TypeScript ベースのデータスクレイピングシステム。型安全性、エラー耐性、保守可能なアーキテクチャを重視。

## 技術スタック

- **Runtime**: Node.js + TypeScript
- **Testing**: Vitest (`--run`フラグ使用、watch モード禁止)
- **Build**: TypeScript Compiler (`tsc`)
- **Package Manager**: npm

## アーキテクチャ（厳格遵守）

レイヤー間のデータフローを厳密に守る：

```
src/
├── clients/     # API通信（HoyoLab専用）
├── parsers/     # JSON解析・構造化
├── mappers/     # API応答→内部型変換
├── processors/  # データ変換・ビジネスロジック
├── generators/  # TypeScriptファイル出力
├── services/    # オーケストレーション
└── utils/       # 共通ユーティリティ
```

**データフロー**: Client → Parser → Mapper → Processor → Generator

## HoyoLab API 仕様（必須）

### API 制約

- **Base URL**: `https://sg-wiki-api-static.hoyolab.com/hoyowiki/zzz/wapi/entry_page`
- **認証**: 不要（パブリック API）
- **レート制限**: リクエスト間の遅延必須
- **パラメータ**: `entry_page_id` (2-902), `lang` (`ja-jp`/`en-us`)

### リクエストパターン（重要）

1. **`ja-jp`を最初にリクエスト** - プライマリデータソース
2. **`en-us`にフォールバック** - 日本語失敗時のみ
3. **部分的失敗でも継続** - プロセス全体を中断しない
4. **遅延実装** - API レート制限回避

### データ抽出パス（正確に）

```typescript
// APIレスポンスからの抽出パス
data.page.id → Character ID (数値変換)
data.page.name → 多言語名オブジェクト
data.page.agent_specialties.values[0] → 特技（マッピング必要）
data.page.agent_stats.values[0] → 属性（マッピング必要）
data.page.agent_attack_type.values[0] → 攻撃タイプ（マッピング必要）
data.page.agent_faction.values[0] → 派閥参照
data.page.agent_rarity.values[0] → レアリティ（"A"または"S"）
```

## 日本語 → 英語マッピング（必須）

```typescript
// 特技 (agent_specialties)
"撃破" → "stun"
"強攻" → "attack"
"異常" → "anomaly"
"支援" → "support"
"防護" → "defense"
"命破" → "rupture"

// 属性 (agent_stats)
"氷属性" → "ice"
"炎属性" → "fire"
"電気属性" → "electric"
"物理属性" → "physical"
"エーテル属性" → "ether"

// 攻撃タイプ (agent_attack_type)
"打撃" → "strike"
"斬撃" → "slash"
"刺突" → "pierce"
```

## キャラクター属性処理

**場所**: `data.page.modules` → `ascension`コンポーネント → `data`（JSON 文字列）を解析

### レベル配列（7 要素必須）

レベル: 1, 10, 20, 30, 40, 50, 60

- `combatList`から`hp[]`, `atk[]`, `def[]`を抽出
- **常に`values[1]`使用**（強化ステータス、ベースではない）

### 単一値（レベル 1 のみ）

`impact`, `critRate`, `critDmg`, `anomalyMastery`, `anomalyProficiency`, `penRatio`, `energy`

### 値変換（必須）

- `"-"` → `0`（null/欠損値処理）
- `"50%"` → `50`（パーセント記号除去）
- 文字列から数値への適切な変換

## TypeScript 型定義（厳格遵守）

```typescript
type Lang = "en" | "ja";
type Specialty =
  | "attack"
  | "stun"
  | "anomaly"
  | "support"
  | "defense"
  | "rupture";
type Stats = "ether" | "fire" | "ice" | "physical" | "electric";
type AttackType = "slash" | "pierce" | "strike";
type Rarity = "A" | "S";

type Attributes = {
  hp: number[]; // 7要素配列
  atk: number[]; // 7要素配列
  def: number[]; // 7要素配列
  impact: number;
  critRate: number;
  critDmg: number;
  anomalyMastery: number;
  anomalyProficiency: number;
  penRatio: number;
  energy: number;
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

type Faction = {
  id: number;
  name: { [key in Lang]: string };
};
```

## 出力要件（正確なファイル）

**必須生成ファイル**:

- `data/characters.ts` → `export default Character[]`
- `data/factions.ts` → `export default Faction[]`

## コーディング規約

### 命名規則（厳格）

- **ファイル**: `PascalCase.ts` (例: `CharacterGenerator.ts`)
- **クラス**: `PascalCase` (例: `DataProcessor`)
- **関数**: `camelCase` (例: `processCharacterData`)
- **定数**: `UPPER_SNAKE_CASE` (例: `API_BASE_URL`)
- **キャラクター ID**: 小文字、記号保持 (例: `lycaon`, `soldier11`)

### 言語使用規則

- **コード/変数**: 英語のみ
- **コメント**: ドメインコンテキストは日本語推奨
- **API リクエスト**: `ja-jp`優先、`en-us`フォールバック

## エラーハンドリング

- **カスタムエラークラス**: `src/errors/`を使用
- **詳細ログ**: 全処理ステップをログ出力
- **グレースフル劣化**: 部分的失敗でも継続
- **入力検証**: 適切なデフォルト値提供

## 型安全性（非交渉）

- **厳格 TypeScript モード**: 緩い設定禁止
- **`any`型禁止**: 明示的型付け必須
- **インターフェース準拠**: 全データが定義型に適合
- **ランタイム検証**: 境界でのデータ構造検証

## 設定管理

- **外部設定ファイル**: `processing-config.json`
- **環境サポート**: 異なる環境用の設定
- **検証必須**: 設定値チェック、デフォルト提供
