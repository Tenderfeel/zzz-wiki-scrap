# 設計文書

## 概要

HoyoLab ZZZ Wiki API からライカン（フォン・ライカン、pageId: 28）のキャラクターデータを取得し、grungerad プロジェクトで使用する Character オブジェクトを生成するシステムの設計です。このシステムは、API からの生データを解析し、TypeScript 型に準拠した構造化データに変換します。

## アーキテクチャ

### システム構成

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   API Client    │───▶│  Data Processor  │───▶│ Character Gen   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ HoyoLab API     │    │ Data Mapping     │    │ TypeScript      │
│ (ja-jp/en-us)   │    │ & Validation     │    │ Character Obj   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### データフロー

1. **API 取得**: 日本語と英語の両方でライカンのデータを取得
2. **データ解析**: JSON レスポンスから必要な情報を抽出
3. **データマッピング**: 生データを型定義に準拠した形式に変換
4. **検証**: 生成されたデータの整合性を確認
5. **出力**: TypeScript ファイルとして出力

## コンポーネントと インターフェース

### 1. API クライアント (ApiClient)

**責任**: HoyoLab API との通信を管理、またはローカルファイルからのデータ読み込み

```typescript
interface ApiClient {
  fetchCharacterData(
    pageId: number,
    lang: "ja-jp" | "en-us"
  ): Promise<ApiResponse>;
  loadFromFile(filePath: string): Promise<ApiResponse>;
}

interface ApiResponse {
  retcode: number;
  message: string;
  data: {
    page: PageData;
  };
}
```

**主要メソッド**:

- `fetchCharacterData()`: 指定されたページ ID と言語でキャラクターデータを取得
- `loadFromFile()`: ローカルファイル（lycaon.json 等）からデータを読み込み

### 2. データプロセッサー (DataProcessor)

**責任**: API レスポンスの解析と基本的なデータ抽出

```typescript
interface DataProcessor {
  extractBasicInfo(apiData: ApiResponse): BasicCharacterInfo;
  extractFactionInfo(apiData: ApiResponse): FactionInfo;
  extractAttributes(apiData: ApiResponse): AttributesInfo;
  resolveFactionId(factionName: string): number;
}

interface BasicCharacterInfo {
  id: number;
  name: string;
  specialty: string;
  stats: string;
  attackType: string;
  rarity: string;
}

interface FactionInfo {
  id: number;
  name: string;
}
```

**注意事項**:

- `resolveFactionId()`: API から取得した陣営名を`data/factions.ts`の既存 ID にマッピング
- ヴィクトリア家政の場合、API の"ヴィクトリア家政"を`data/factions.ts`の ID: 2 にマッピング

interface AttributesInfo {
ascensionData: string; // JSON 文字列
}

````

### 3. データマッパー (DataMapper)

**責任**: 生データを型定義に準拠した形式に変換

```typescript
interface DataMapper {
  mapSpecialty(rawSpecialty: string): Specialty;
  mapStats(rawStats: string): Stats;
  mapAttackType(rawAttackType: string): AttackType;
  mapRarity(rawRarity: string): Rarity;
  mapAttributes(ascensionData: string): Attributes;
}
````

**マッピング規則**:

- 特性: "撃破" → "stun", "強攻" → "attack", "異常" → "anomaly", "支援" → "support", "防護" → "defense"
- 属性: "氷属性" → "ice", "炎属性" → "fire", "電気属性" → "electric", "物理属性" → "physical", "エーテル属性" → "ether"
- 攻撃タイプ: "打撃" → "strike", "斬撃" → "slash", "刺突" → "pierce"

### 4. 属性プロセッサー (AttributesProcessor)

**責任**: 昇格データからステータス配列と固定値を抽出

```typescript
interface AttributesProcessor {
  processAscensionData(jsonData: string): Attributes;
  extractLevelBasedStats(combatList: CombatStat[]): LevelBasedStats;
  extractFixedStats(level1Data: CombatStat[]): FixedStats;
}

interface LevelBasedStats {
  hp: number[];
  atk: number[];
  def: number[];
}

interface FixedStats {
  impact: number;
  critRate: number;
  critDmg: number;
  anomalyMastery: number;
  anomalyProficiency: number;
  penRatio: number;
  energy: number;
}
```

### 5. キャラクタージェネレーター (CharacterGenerator)

**責任**: 最終的な Character オブジェクトの生成と`characters.ts`ファイルの出力

```typescript
interface CharacterGenerator {
  generateCharacter(jaData: ProcessedData, enData: ProcessedData): Character;
  validateCharacter(character: Character): ValidationResult;
  outputCharacterFile(character: Character): void;
}
```

**出力ファイル**:

- `characters.ts`: ライカンの Character オブジェクトを含む TypeScript ファイル

**出力形式例**:

```typescript
// characters.ts
export default [
  {
    id: "lycaon", // Scraping.mdのキャラクターページリストのリンクテキストと同じ
    name: { ja: "フォン・ライカン", en: "Von Lycaon" },
    fullName: { ja: "フォン・ライカン", en: "Von Lycaon" },
    specialty: "stun",
    stats: "ice",
    attackType: "strike",
    faction: 2, // data/factions.tsのヴィクトリア家政のID
    rarity: "S",
    attr: {
      hp: [677, 1967, 3350, 4732, 6114, 7498, 8416],
      atk: [105, 197, 296, 394, 494, 592, 653],
      def: [49, 141, 241, 340, 441, 540, 606],
      impact: 119,
      critRate: 5,
      critDmg: 50,
      anomalyMastery: 91,
      anomalyProficiency: 90,
      penRatio: 0,
      energy: 1.2,
    },
  },
] as Character[];
```

## データモデル

### 出力データ型定義

```typescript
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
  | "rupture"; // 命破

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
  | "strike"; // 打撃

type Rarity = "A" | "S";

type Attributes = {
  hp: number[]; // HP
  atk: number[]; // 攻撃力
  def: number[]; // 防御力
  impact: number; // 衝撃力
  critRate: number; // 会心率
  critDmg: number; // 会心ダメージ
  anomalyMastery: number; // 異常マスタリー
  anomalyProficiency: number; // 異常掌握
  penRatio: number; // 貫通率
  energy: number; // エネルギー自動回復
};

// キャラクター
type Character = {
  id: string; // Scraping.mdのリンクテキストと同じ（例: "lycaon"）
  name: { [key in Lang]: string };
  fullName: { [key in Lang]: string };
  specialty: Specialty; // 特性
  stats: Stats; // 属性
  attackType: AttackType; // 攻撃タイプ
  faction: number; // 陣営ID
  rarity: Rarity; // レア度
  attr: Attributes; // ステータス
};
```

### API レスポンス構造

```typescript
interface ApiPageData {
  id: string;
  name: string;
  agent_specialties: { values: string[] };
  agent_stats: { values: string[] };
  agent_attack_type: { values: string[] };
  agent_rarity: { values: string[] };
  agent_faction: { values: string[] };
  modules: Module[];
}

interface Module {
  components: Component[];
}

interface Component {
  component_id: string;
  data: string; // JSON文字列
}
```

### 昇格データ構造

```typescript
interface AscensionData {
  list: LevelData[];
}

interface LevelData {
  key: string; // レベル ("1", "10", "20", etc.)
  combatList: CombatStat[];
}

interface CombatStat {
  key: string; // ステータス名 ("HP", "攻撃力", etc.)
  values: [string, string]; // [強化前, 強化後]
}
```

## エラーハンドリング

### エラータイプ

1. **API エラー**: ネットワーク障害、API レスポンスエラー
2. **データ解析エラー**: 不正な JSON、予期しないデータ構造
3. **マッピングエラー**: 未知の列挙値、データ型不一致
4. **検証エラー**: 必須フィールドの欠如、データ整合性の問題

### エラーハンドリング戦略

```typescript
interface ErrorHandler {
  handleApiError(error: ApiError): void;
  handleParsingError(error: ParsingError): void;
  handleMappingError(error: MappingError): void;
  handleValidationError(error: ValidationError): void;
}

class LycanDataGeneratorError extends Error {
  constructor(
    public type: "API" | "PARSING" | "MAPPING" | "VALIDATION",
    public details: string,
    public originalError?: Error
  ) {
    super(`${type}: ${details}`);
  }
}
```

## テスト戦略

### 単体テスト

1. **API クライアント**: モックレスポンスを使用した API 呼び出しテスト
2. **データプロセッサー**: 各抽出メソッドの正確性テスト
3. **データマッパー**: 各マッピング規則の正確性テスト
4. **属性プロセッサー**: 昇格データ解析の正確性テスト
5. **キャラクタージェネレーター**: 最終出力の整合性テスト

### 統合テスト

1. **エンドツーエンド**: 実際の API からライカンデータを取得し、完全な Character オブジェクトを生成
2. **多言語対応**: 日本語と英語の両方のデータが正しく統合されることを確認
3. **エラーシナリオ**: 各種エラー条件での適切な処理を確認

### テストデータ

実際のライカン API レスポンスデータは `lycaon.json` ファイルに保存されており、これをモックデータとして使用します。

```typescript
// lycaon.jsonファイルからモックデータを読み込み
import * as fs from "fs";

const mockLycanResponse = JSON.parse(fs.readFileSync("./lycaon.json", "utf-8"));

// 実際のデータ構造例（lycaon.jsonから抜粋）:
// {
//   "retcode": 0,
//   "message": "OK",
//   "data": {
//     "page": {
//       "id": "28",
//       "name": "フォン・ライカン",
//       "modules": [
//         {
//           "components": [
//             {
//               "component_id": "baseInfo",
//               "data": "{\"list\":[...陣営情報を含む...]}"
//             },
//             {
//               "component_id": "ascension",
//               "data": "{\"list\":[...レベル別ステータス...]}"
//             }
//           ]
//         }
//       ]
//     }
//   }
// }
```

**lycaon.json ファイルの利点**:

- 実際の API レスポンス構造を正確に反映
- 完全なステータスデータとメタデータを含有
- テスト時に API 呼び出しが不要
- データ構造の変更に対する堅牢性

## 実装の考慮事項

### パフォーマンス

- **並行処理**: 日本語と英語の API リクエストを並行実行
- **キャッシュ**: 同一セッション内での API レスポンスキャッシュ
- **メモリ効率**: 大きな JSON オブジェクトの適切な管理

### 拡張性

- **設定可能性**: ページ ID や言語設定の外部化
- **プラグイン対応**: 他のキャラクターへの拡張を考慮した設計
- **出力形式**: TypeScript 以外の出力形式への対応準備

### セキュリティ

- **入力検証**: API レスポンスの適切な検証
- **エラー情報**: 機密情報を含まないエラーメッセージ
- **レート制限**: API 呼び出し頻度の制御
