# 音動機データ生成機能

ZZZ キャラクターデータ処理システムの音動機（武器）データ生成機能の使用方法とトラブルシューティングガイドです。

## 概要

音動機データ生成機能は、HoyoLab API から音動機の詳細情報を取得し、型安全な TypeScript ファイル（`data/weapons.ts`）を生成します。既存のキャラクターデータ処理システムと統合されており、同じアーキテクチャパターンとエラーハンドリング機能を使用します。

## 機能

- `json/data/weapon-list.json` から音動機リストを読み込み
- HoyoLab API から音動機の詳細データを取得
- レア度 A と S の音動機のみを処理（レア度 B は除外）
- 多言語対応（日本語優先、英語フォールバック）
- 音動機スキル情報の抽出
- 突破ステータスの処理（7 レベル分）
- エージェント情報の関連付け
- グレースフル劣化とエラー回復
- 進捗監視とレポート生成

## 前提条件

### 必要なファイル

1. **音動機リストファイル**: `json/data/weapon-list.json`

   - HoyoLab から取得した音動機リストデータ
   - 各音動機の `entry_page_id` と基本情報を含む

2. **設定ファイル**: `weapon-processing-config.json`（オプション）
   - 処理設定をカスタマイズする場合に使用

### システム要件

- Node.js 18 以上
- TypeScript 5.0 以上
- 安定したインターネット接続（HoyoLab API アクセス用）

## 使用方法

### 1. 基本的な使用方法

```bash
# 音動機データ生成を実行
npm run weapon-generation

# または TypeScript で直接実行
npx tsx src/main-weapon-generation.ts
```

### 2. 設定ファイルを使用した実行

```bash
# カスタム設定ファイルを使用
npx tsx src/main-weapon-generation.ts --config weapon-processing-config.json
```

### 3. プログラムから使用

```typescript
import { WeaponDataProcessor, WeaponGenerator, WeaponListParser } from "./src";
import { ConfigManager } from "./src/config/ProcessingConfig";

async function generateWeaponData() {
  // 設定を読み込み
  const config = ConfigManager.getInstance("weapon-processing-config.json");
  const weaponConfig = config.getWeaponProcessingConfig();

  // 音動機リストを解析
  const parser = new WeaponListParser();
  const weaponEntries = parser.parseWeaponList(weaponConfig.weaponListPath);

  // 音動機データを処理
  const processor = new WeaponDataProcessor(config.getConfig());
  const processedData = [];

  for (const entry of weaponEntries) {
    try {
      const data = await processor.processWeaponData(entry);
      processedData.push(data);
    } catch (error) {
      console.error(`音動機 ${entry.id} の処理に失敗:`, error);
    }
  }

  // TypeScript ファイルを生成
  const generator = new WeaponGenerator();
  await generator.outputWeaponFile(processedData, weaponConfig.outputPath);
}
```

## 設定オプション

### WeaponProcessingConfig

音動機処理専用の設定項目：

```typescript
interface WeaponProcessingConfig {
  weaponListPath: string; // weapon-list.json のパス
  outputPath: string; // 出力ファイルパス
  includeRarities: ("A" | "S")[]; // 処理対象レア度
  batchSize: number; // バッチサイズ
  delayMs: number; // API リクエスト間の遅延
  maxRetries: number; // 最大リトライ回数
  skipAgentValidation: boolean; // エージェント検証スキップ
  enableSkillExtraction: boolean; // スキル情報抽出の有効化
  enableValidation: boolean; // データ検証の有効化
  logLevel: "error" | "warn" | "info" | "debug"; // ログレベル
}
```

### 設定ファイル例

`weapon-processing-config.json`:

```json
{
  "weaponProcessing": {
    "weaponListPath": "json/data/weapon-list.json",
    "outputPath": "data/weapons.ts",
    "includeRarities": ["A", "S"],
    "batchSize": 10,
    "delayMs": 1000,
    "maxRetries": 3,
    "skipAgentValidation": false,
    "enableSkillExtraction": true,
    "enableValidation": true,
    "logLevel": "info"
  },
  "batchSize": 10,
  "delayMs": 1000,
  "maxRetries": 3,
  "enableEnhancedProgress": true,
  "showMemoryUsage": true,
  "showPerformanceMetrics": true,
  "logLevel": "info"
}
```

### 設定項目の詳細

| 項目                    | デフォルト値                   | 説明                                   |
| ----------------------- | ------------------------------ | -------------------------------------- |
| `weaponListPath`        | `"json/data/weapon-list.json"` | 音動機リストファイルのパス             |
| `outputPath`            | `"data/weapons.ts"`            | 生成される TypeScript ファイルのパス   |
| `includeRarities`       | `["A", "S"]`                   | 処理対象のレア度（B は常に除外）       |
| `batchSize`             | `10`                           | 同時処理する音動機の数                 |
| `delayMs`               | `1000`                         | API リクエスト間の遅延時間（ミリ秒）   |
| `maxRetries`            | `3`                            | API エラー時の最大リトライ回数         |
| `skipAgentValidation`   | `false`                        | エージェント情報の検証をスキップするか |
| `enableSkillExtraction` | `true`                         | スキル情報の抽出を有効にするか         |
| `enableValidation`      | `true`                         | データ検証を有効にするか               |
| `logLevel`              | `"info"`                       | ログ出力レベル                         |

## 出力データ構造

生成される `data/weapons.ts` ファイルの構造：

```typescript
import { Weapon } from "../src/types";

const weapons: Weapon[] = [
  {
    id: 123, // 音動機ID
    name: {
      // 多言語名
      ja: "音動機名（日本語）",
      en: "Weapon Name (English)",
    },
    equipmentSkillName: {
      // スキル名
      ja: "スキル名（日本語）",
      en: "Skill Name (English)",
    },
    equipmentSkillDesc: {
      // スキル説明
      ja: "スキル説明（日本語）",
      en: "Skill Description (English)",
    },
    rarity: "S", // レア度
    attr: {
      // 突破ステータス
      hp: [100, 120, 140, 160, 180, 200, 220],
      atk: [50, 60, 70, 80, 90, 100, 110],
      def: [30, 36, 42, 48, 54, 60, 66],
      impact: [10, 12, 14, 16, 18, 20, 22],
      critRate: [5, 6, 7, 8, 9, 10, 11],
      critDmg: [50, 60, 70, 80, 90, 100, 110],
      anomalyMastery: [],
      anomalyProficiency: [],
      penRatio: [],
      energy: [],
    },
    specialty: "attack", // 特性
    stats: ["physical"], // 属性
    agentId: "lycaon", // 該当エージェントID
    baseAttr: "atk", // 基礎ステータス
    advancedAttr: "critRate", // 上級ステータス
  },
  // ... 他の音動機
];

export default weapons;
```

## データ抽出の詳細

### API データの抽出パス

音動機データは HoyoLab API から以下のパスで抽出されます：

#### 基本情報

- **ID**: `data.page.id` (数値変換)
- **名前**: `data.page.name`
- **レア度**: `filter_values.w_engine_rarity.values[0]`
- **特性**: `filter_values.filter_key_13.values[0]` → マッピング

#### スキル情報

- **スキル名**: `modules[equipment_skill].data.skill_name`
- **スキル説明**: `modules[equipment_skill].data.skill_desc`

#### 突破ステータス

- **場所**: `modules[ascension].data` (JSON 解析)
- **抽出**: 各レベル（0,10,20,30,40,50,60）の `combatList` から `values[1]`（「後」の値）

#### エージェント情報

- **エージェント ID**: `modules[baseInfo].data.list` → 該当エージェント → `ep_id`

#### 基礎・上級ステータス

- **基礎ステータス**: `modules[baseInfo].data.list` → 「基礎」が付く項目から「基礎」を除いた属性名
- **上級ステータス**: `modules[baseInfo].data.list` → 上級ステータス項目から属性名

### 日本語 → 英語マッピング

```typescript
// 特性 (specialty)
"撃破" → "stun"
"強攻" → "attack"
"異常" → "anomaly"
"支援" → "support"
"防護" → "defense"
"命破" → "rupture"

// 属性 (stats)
"氷属性" → "ice"
"炎属性" → "fire"
"電気属性" → "electric"
"物理属性" → "physical"
"エーテル属性" → "ether"
```

## エラーハンドリング

### グレースフル劣化

API エラーや部分的なデータ取得失敗が発生した場合、システムは以下の戦略でグレースフル劣化を行います：

1. **最小限のデータ作成**: 基本情報のみでも音動機オブジェクトを生成
2. **デフォルト値の使用**: 欠損データに対して適切なデフォルト値を設定
3. **処理継続**: 一部の音動機で失敗しても全体の処理を継続

### エラー分類

| エラータイプ           | 対応                       | 継続可否 |
| ---------------------- | -------------------------- | -------- |
| ファイル読み込みエラー | ログ出力、処理中断         | ❌       |
| API レート制限         | 遅延後リトライ             | ✅       |
| ネットワークエラー     | リトライ                   | ✅       |
| データマッピングエラー | グレースフル劣化           | ✅       |
| 検証エラー             | 警告ログ、デフォルト値使用 | ✅       |

## トラブルシューティング

### よくある問題と解決方法

#### 1. weapon-list.json が見つからない

**エラー**: `ENOENT: no such file or directory, open 'json/data/weapon-list.json'`

**解決方法**:

- ファイルパスが正しいか確認
- 設定ファイルで `weaponListPath` を正しいパスに設定
- weapon-list.json ファイルが存在するか確認

```bash
# ファイルの存在確認
ls -la json/data/weapon-list.json

# 設定ファイルでパスを修正
{
  "weaponProcessing": {
    "weaponListPath": "path/to/your/weapon-list.json"
  }
}
```

#### 2. API レート制限エラー

**エラー**: `429 Too Many Requests`

**解決方法**:

- `delayMs` を増加（推奨: 1000ms 以上）
- `batchSize` を減少（推奨: 5 以下）
- `maxRetries` を増加

```json
{
  "weaponProcessing": {
    "delayMs": 2000,
    "batchSize": 3,
    "maxRetries": 5
  }
}
```

#### 3. メモリ不足エラー

**エラー**: `JavaScript heap out of memory`

**解決方法**:

- メモリ最適化を有効化
- バッチサイズを減少
- Node.js のメモリ制限を増加

```bash
# Node.js メモリ制限を増加
node --max-old-space-size=4096 src/main-weapon-generation.ts
```

```json
{
  "enableMemoryOptimization": true,
  "memoryThresholdMB": 200,
  "weaponProcessing": {
    "batchSize": 5
  }
}
```

#### 4. データ検証エラー

**エラー**: `Validation failed: missing required field`

**解決方法**:

- データ検証を無効化（一時的）
- グレースフル劣化を有効化
- ログレベルを `debug` に設定して詳細を確認

```json
{
  "weaponProcessing": {
    "enableValidation": false,
    "logLevel": "debug"
  }
}
```

#### 5. 出力ファイル生成エラー

**エラー**: `EACCES: permission denied, open 'data/weapons.ts'`

**解決方法**:

- 出力ディレクトリの権限を確認
- 出力パスを変更
- ファイルが他のプロセスで使用されていないか確認

```bash
# ディレクトリ権限を確認
ls -la data/

# 権限を修正
chmod 755 data/
chmod 644 data/weapons.ts
```

### デバッグ方法

#### 1. 詳細ログの有効化

```json
{
  "weaponProcessing": {
    "logLevel": "debug"
  },
  "enableDetailedLogging": true,
  "enableDebugMode": true
}
```

#### 2. 単一音動機のテスト

```typescript
// 特定の音動機のみをテスト
const testWeaponEntry = {
  id: "123",
  name: "テスト音動機",
  rarity: "S" as const,
};

const processor = new WeaponDataProcessor(config);
const result = await processor.processWeaponData(testWeaponEntry);
console.log(JSON.stringify(result, null, 2));
```

#### 3. API 応答の確認

```typescript
import { HoyoLabApiClient } from "./src/clients";

const client = new HoyoLabApiClient();
const response = await client.fetchData("123", "ja-jp");
console.log(JSON.stringify(response, null, 2));
```

### パフォーマンス最適化

#### 1. 並列処理の調整

```json
{
  "maxConcurrency": 3,
  "weaponProcessing": {
    "batchSize": 5,
    "delayMs": 1000
  }
}
```

#### 2. メモリ使用量の監視

```json
{
  "enableEnhancedProgress": true,
  "showMemoryUsage": true,
  "showPerformanceMetrics": true
}
```

#### 3. キャッシュの活用

```typescript
// API 応答をキャッシュして重複リクエストを回避
const cache = new Map();
const cachedResponse =
  cache.get(weaponId) || (await client.fetchData(weaponId));
cache.set(weaponId, cachedResponse);
```

## 統合テスト

### テストの実行

```bash
# 音動機データ生成の統合テスト
npm test -- tests/integration/WeaponDataGeneration.integration.test.ts

# 全ての音動機関連テスト
npm test -- --grep "weapon"
```

### テストカバレッジ

- ✅ 音動機リスト解析
- ✅ API データ取得
- ✅ データマッピング
- ✅ TypeScript ファイル生成
- ✅ エラーハンドリング
- ✅ グレースフル劣化
- ✅ 設定管理

## 関連ドキュメント

- [API.md](./API.md) - HoyoLab API の詳細仕様
- [USAGE_AND_TROUBLESHOOTING.md](./USAGE_AND_TROUBLESHOOTING.md) - 全般的な使用方法
- [BOMP_GENERATION.md](./BOMP_GENERATION.md) - ボンプデータ生成機能

## サポート

問題が解決しない場合は、以下の情報を含めて報告してください：

1. エラーメッセージの全文
2. 使用している設定ファイル
3. Node.js と TypeScript のバージョン
4. 実行環境（OS、メモリ容量など）
5. 処理対象の音動機数

---

**注意**: この機能は HoyoLab の公開 API を使用しています。API の利用規約を遵守し、適切なレート制限を設定してください。
