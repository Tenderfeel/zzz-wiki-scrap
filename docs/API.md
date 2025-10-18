# API ドキュメント

## 概要

このドキュメントでは、キャラクターデータ生成システムの主要なクラスとメソッドの API について説明します。

## DataMapper

API レスポンスから取得したデータを内部型にマッピングするクラスです。

### クラス概要

```typescript
export class DataMapper {
  // 各種マッピングメソッドを提供
}
```

## BompDataMapper

ボンプ専用のデータマッピング機能を提供するクラスです。

### クラス概要

```typescript
export class BompDataMapper extends DataMapper {
  // ボンプ固有のマッピングメソッドを提供
}
```

### メソッド

#### `mapSpecialty(rawSpecialty: string): Specialty`

日本語の特性名を英語の列挙値にマッピングします。

**パラメータ:**

- `rawSpecialty` (string): 日本語の特性名

**戻り値:** `Specialty`

**マッピング:**

- `"撃破"` → `"stun"`
- `"強攻"` → `"attack"`
- `"異常"` → `"anomaly"`
- `"支援"` → `"support"`
- `"防護"` → `"defense"`
- `"命破"` → `"rupture"`

#### `mapStats(rawStats: string): Stats`

日本語の属性名を英語の列挙値にマッピングします。

**パラメータ:**

- `rawStats` (string): 日本語の属性名

**戻り値:** `Stats`

**マッピング:**

- `"氷属性"` → `"ice"`
- `"炎属性"` → `"fire"`
- `"電気属性"` → `"electric"`
- `"物理属性"` → `"physical"`
- `"エーテル属性"` → `"ether"`

#### `mapRarity(rawRarity: string): Rarity`

レアリティ値をマッピングします。

**パラメータ:**

- `rawRarity` (string): レアリティ値

**戻り値:** `Rarity`

**マッピング:**

- `"A"` → `"A"`
- `"S"` → `"S"`

#### `mapAssistType(rawAssistType: string): AssistType | undefined`

日本語の支援タイプ名を英語の列挙値にマッピングします。

**パラメータ:**

- `rawAssistType` (string): 日本語の支援タイプ名

**戻り値:** `AssistType | undefined`

**マッピング:**

- `"回避支援"` → `"evasive"`
- `"パリィ支援"` → `"defensive"`
- その他の値 → `undefined`

### BompDataMapper メソッド

#### `extractRarityFromBaseInfo(modules: Module[]): string`

API レスポンスの baseInfo コンポーネントからレア度情報を抽出します。

**パラメータ:**

- `modules` (Module[]): API レスポンスのモジュール配列

**戻り値:** `string` - 生のレア度文字列（"A 級" または "S 級"）

**抽出パス:**

```
data.page.modules
  → find(module => module.name === "ステータス" || module.name === "baseInfo")
    → components
      → find(component => component.component_id === "baseInfo")
        → data (JSON文字列)
          → JSON.parse()
            → list[]
              → find(item => item.key === "レア度")
                → value[0] // "A級" または "S級"
```

**エラー:**

- `MappingError`: baseInfo モジュール/コンポーネントが見つからない場合
- `MappingError`: レア度情報が存在しない場合

#### `normalizeRarity(rawRarity: string): string`

生のレア度文字列を正規化します。

**パラメータ:**

- `rawRarity` (string): 生のレア度文字列（"A 級", "S 級"）

**戻り値:** `string` - 正規化されたレア度文字列（"A", "S"）

**変換:**

- `"A級"` → `"A"`
- `"S級"` → `"S"`

**エラー:**

- `MappingError`: 無効なレア度値の場合

## CharacterGenerator

キャラクターデータを生成するクラスです。

### クラス概要

```typescript
export class CharacterGenerator {
  constructor(
    private dataMapper: DataMapper,
    private dataProcessor: DataProcessor
  ) {}
}
```

### メソッド

#### `generateCharacter(pageId: number): Promise<Character>`

指定されたページ ID のキャラクターデータを生成します。

**パラメータ:**

- `pageId` (number): キャラクターのページ ID

**戻り値:** `Promise<Character>`

**動作:**

1. API からキャラクターデータを取得
2. データの解析と変換を実行
3. Character オブジェクトを生成して返す

## 型定義

### Character

キャラクター情報を表現する型です。

```typescript
type Character = {
  id: number;
  name: { [key in Lang]: string };
  fullName: { [key in Lang]: string };
  specialty: Specialty;
  stats: Stats;
  assistType?: AssistType; // 支援タイプ（オプショナル）
  faction: Faction;
  rarity: Rarity;
  attr: Attributes;
};
```

### Specialty

キャラクターの特性を表現する型です。

```typescript
type Specialty =
  | "attack"
  | "stun"
  | "anomaly"
  | "support"
  | "defense"
  | "rupture";
```

### Stats

キャラクターの属性を表現する型です。

```typescript
type Stats =
  | "ether"
  | "fire"
  | "ice"
  | "physical"
  | "electric"
  | "frost"
  | "auricInk";
```

### AssistType

キャラクターの支援タイプを表現する型です。

```typescript
type AssistType =
  | "evasive" // 回避支援
  | "defensive"; // パリィ支援
```

### Bomp

ボンプ情報を表現する型です。

```typescript
type Bomp = {
  id: string; // ボンプID
  name: { [key in Lang]: string }; // 多言語名
  stats: Stats[]; // 属性（配列形式）
  rarity: Rarity; // レア度（A級またはS級）
  releaseVersion?: number; // 実装バージョン
  faction: number[]; // 陣営ID配列
  attr: Attributes; // ステータス
  extraAbility: string; // 追加能力
};
```

### Rarity

レア度を表現する型です。

```typescript
type Rarity = "A" | "S";
```

### Attributes

キャラクターのステータス情報を表現する型です。

```typescript
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
```

## 使用例

### 基本的な使用方法

```typescript
import { DataMapper } from "./mappers/DataMapper.js";
import { CharacterGenerator } from "./generators/CharacterGenerator.js";

const mapper = new DataMapper();
const generator = new CharacterGenerator(mapper, dataProcessor);

// 特性のマッピング
const specialty = mapper.mapSpecialty("撃破"); // "stun"

// 属性のマッピング
const stats = mapper.mapStats("氷属性"); // "ice"

// 支援タイプのマッピング
const assistType = mapper.mapAssistType("パリィ支援"); // "defensive"

// キャラクター生成
const character = await generator.generateCharacter(28);
```

## エラーハンドリング

### MappingError

未知の値でマッピングが失敗した場合にスローされます。

```typescript
try {
  const specialty = mapper.mapSpecialty("未知の値");
} catch (error) {
  if (error instanceof MappingError) {
    console.error("マッピングエラー:", error.message);
  }
}
```

### ログレベル

- **INFO**: 処理完了、データ生成成功
- **WARN**: データ不整合、デフォルト値使用
- **DEBUG**: 詳細な処理情報
- **ERROR**: 重大なシステムエラー、処理失敗

## パフォーマンス考慮事項

- API リクエストは適切な間隔で実行
- メモリ使用量を最適化
- エラー時も処理を継続し、システム全体の安定性を保つ
- バッチ処理により効率的なデータ生成を実現
