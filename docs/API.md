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
  | "frostAttribute"
  | "auricInk";
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
