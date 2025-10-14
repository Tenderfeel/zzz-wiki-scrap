# ボンプデータ生成機能

このドキュメントでは、Zenless Zone Zero のボンプ（Bangboo）データを HoyoLab API から自動生成する機能について説明します。

## 概要

ボンプデータ生成機能は、以下の処理を自動化します：

1. `Scraping.md` からボンプエントリー情報を抽出
2. HoyoLab API からボンプの詳細データを取得
3. データを構造化された TypeScript オブジェクトに変換
4. `data/bomps.ts` ファイルとして出力

## 使用方法

### 基本的な使用方法

```bash
# デフォルト設定でボンプデータを生成
npm run generate:bomps

# カスタム設定ファイルを使用
npm run generate:bomps -- --config custom-bomp-config.json

# ヘルプを表示
npm run generate:bomps -- --help
```

### 設定ファイル

設定ファイル（`bomp-processing-config.json`）で処理パラメータをカスタマイズできます：

```json
{
  "batchSize": 5,
  "delayMs": 500,
  "maxRetries": 3,
  "scrapingFilePath": "Scraping.md",
  "outputFilePath": "data/bomps.ts",
  "enableReportGeneration": true,
  "reportOutputPath": "bomp-processing-report.md",
  "minSuccessRate": 0.8,
  "enableValidation": true,
  "logLevel": "info",
  "enableDebugMode": false
}
```

#### 設定項目の説明

- `batchSize`: 同時処理するボンプ数（デフォルト: 5）
- `delayMs`: API リクエスト間の遅延時間（ミリ秒、デフォルト: 500）
- `maxRetries`: API 失敗時の最大リトライ回数（デフォルト: 3）
- `scrapingFilePath`: ボンプリストファイルのパス（デフォルト: "Scraping.md"）
- `outputFilePath`: 出力ファイルのパス（デフォルト: "data/bomps.ts"）
- `enableReportGeneration`: 処理レポート生成の有効/無効（デフォルト: true）
- `reportOutputPath`: 処理レポートの出力パス（デフォルト: "bomp-processing-report.md"）
- `minSuccessRate`: 最小成功率（0-1、デフォルト: 0.8）
- `enableValidation`: 処理結果検証の有効/無効（デフォルト: true）
- `enableDebugMode`: デバッグモードの有効/無効（デフォルト: false）

## アーキテクチャ

### コンポーネント構成

```
src/
├── parsers/BompListParser.ts          # Scraping.md解析
├── processors/BompDataProcessor.ts    # ボンプデータ処理
├── processors/BompBatchProcessor.ts   # バッチ処理・リトライ機能
├── generators/BompGenerator.ts        # TypeScriptファイル生成
└── main-bomp-generation.ts           # メイン実行スクリプト
```

### データフロー

```
Scraping.md
    ↓ (BompListParser)
BompEntry[]
    ↓ (BompBatchProcessor)
API取得 + 処理
    ↓ (BompDataProcessor)
ProcessedBompData[]
    ↓ (BompGenerator)
data/bomps.ts
```

## 機能詳細

### 1. エラーハンドリングとリトライ機能

- **自動リトライ**: API 失敗時に最大 3 回まで自動リトライ
- **指数バックオフ**: リトライ間隔を段階的に延長
- **エラー分類**: ネットワーク、API、データ処理エラーを分類して適切に対応
- **グレースフル劣化**: 部分的な失敗でも処理を継続

### 2. API レート制限対応

- **バッチ処理**: 設定可能なバッチサイズで順次処理
- **遅延制御**: リクエスト間に適切な遅延を挿入
- **プログレス追跡**: リアルタイムで処理進捗を表示

### 3. データ検証

- **型安全性**: TypeScript の厳格な型チェック
- **必須フィールド検証**: 全ての必須データの存在確認
- **配列長検証**: HP、ATK、DEF 配列が 7 要素であることを確認
- **列挙値検証**: 属性、派閥 ID などの妥当性確認

### 4. 処理レポート生成

処理完了後、詳細なレポートが生成されます：

```markdown
# 全ボンプ処理レポート

## 処理概要

- 処理開始時刻: 2024-01-01 10:00:00
- 処理終了時刻: 2024-01-01 10:05:30
- 総処理時間: 5 分 30 秒
- 総ボンプ数: 32
- 成功: 30
- 失敗: 2
- 成功率: 94%

## 成功したボンプ (30)

1. excaliboo (セイケンボンプ)
2. bangvolver (バンボルバー)
   ...

## 失敗したボンプ (2)

1. failed-bomp - API 取得エラー
2. another-failed - データ解析エラー
```

## 出力データ形式

生成される `data/bomps.ts` ファイルの形式：

```typescript
import { Bomp } from "../src/types";

export default [
  {
    id: "excaliboo",
    name: { ja: "セイケンボンプ", en: "Excaliboo" },
    stats: "ice",
    releaseVersion: 1.0,
    faction: [1],
    attr: {
      hp: [100, 200, 300, 400, 500, 600, 700],
      atk: [50, 100, 150, 200, 250, 300, 350],
      def: [30, 60, 90, 120, 150, 180, 210],
      impact: 10,
      critRate: 5,
      critDmg: 50,
      anomalyMastery: 0,
      anomalyProficiency: 0,
      penRatio: 0,
      energy: 100,
    },
    extraAbility: "『追加能力』の説明文",
  },
  // ... 他のボンプ
] as Bomp[];
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. API レート制限エラー

**症状:**

```
[ERROR] Rate limit exceeded
[ERROR] Too many requests
```

**解決方法:**

```json
{
  "delayMs": 1000, // リクエスト間隔を1秒に延長
  "batchSize": 3, // バッチサイズを3に減少
  "maxRetries": 5 // リトライ回数を増加
}
```

#### 2. メモリ不足エラー

**症状:**

```
[ERROR] JavaScript heap out of memory
[WARN] Memory usage exceeded threshold
```

**解決方法:**

```json
{
  "batchSize": 2, // バッチサイズを最小に
  "enableMemoryOptimization": true, // メモリ最適化を有効
  "memoryThresholdMB": 50, // メモリ閾値を下げる
  "gcInterval": 5 // GC間隔を短縮
}
```

#### 3. ネットワークエラー

**症状:**

```
[ERROR] Network timeout
[ERROR] Connection refused
```

**解決方法:**

1. インターネット接続を確認
2. 設定を調整:

```json
{
  "maxRetries": 5,
  "delayMs": 2000,
  "enableDebugMode": true
}
```

#### 4. データ解析エラー

**症状:**

```
[ERROR] Failed to parse bomp data
[WARN] Missing required field
```

**解決方法:**

1. `Scraping.md` の形式を確認
2. デバッグモードを有効化:

```json
{
  "enableDebugMode": true,
  "logLevel": "debug",
  "enableDetailedLogging": true
}
```

#### 5. ファイル出力エラー

**症状:**

```
[ERROR] Failed to write output file
[ERROR] Permission denied
```

**解決方法:**

```bash
# ディレクトリの作成
mkdir -p data

# 権限の確認と修正
chmod 755 data/
ls -la data/
```

### 環境別設定の活用

#### 開発環境での詳細デバッグ

```json
{
  "environments": {
    "development": {
      "logLevel": "debug",
      "enableDebugMode": true,
      "enableDetailedLogging": true,
      "delayMs": 1000,
      "batchSize": 2
    }
  }
}
```

#### 本番環境での最適化

```json
{
  "environments": {
    "production": {
      "logLevel": "error",
      "enableDebugMode": false,
      "enableDetailedLogging": false,
      "delayMs": 300,
      "batchSize": 5
    }
  }
}
```

### ログレベル設定

```json
{
  "logLevel": "debug", // error, warn, info, debug
  "enableDebugMode": true,
  "enableDetailedLogging": true
}
```

### 部分的な処理

特定のボンプのみを処理したい場合：

1. **設定ファイルでフィルタリング**（将来実装予定）
2. **Scraping.md の編集**で対象ボンプのみを残す
3. **テスト環境**でモックデータを使用

### パフォーマンス最適化

#### 処理速度の向上

```json
{
  "maxConcurrency": 3, // 並行処理数を調整
  "enableEnhancedProgress": false, // プログレス表示を無効化
  "showDetailedTiming": false, // 詳細タイミングを無効化
  "useColors": false // カラー出力を無効化
}
```

#### メモリ使用量の削減

```json
{
  "enableMemoryOptimization": true,
  "memoryThresholdMB": 100,
  "gcInterval": 10,
  "batchSize": 3
}
```

### エラー診断コマンド

```bash
# ネットワーク接続の確認
ping sg-wiki-api-static.hoyolab.com

# API エンドポイントの確認
curl "https://sg-wiki-api-static.hoyolab.com/hoyowiki/zzz/wapi/entry_page?entry_page_id=912&lang=ja-jp"

# メモリ使用量の監視
node --max-old-space-size=4096 src/main-bomp-generation.ts

# デバッグモードでの実行
NODE_ENV=development npm run generate:bomps
```

### よくあるエラーメッセージ

| エラーメッセージ      | 原因         | 解決方法                   |
| --------------------- | ------------ | -------------------------- |
| `Rate limit exceeded` | API 制限     | `delayMs`を増加            |
| `Heap out of memory`  | メモリ不足   | `batchSize`を減少          |
| `Connection timeout`  | ネットワーク | 接続確認、`maxRetries`増加 |
| `Invalid JSON`        | データ形式   | `Scraping.md`確認          |
| `Permission denied`   | ファイル権限 | ディレクトリ権限確認       |

## 開発者向け情報

### テスト実行

```bash
# ボンプ関連のテストを実行
npm test -- tests/processors/BompBatchProcessor.test.ts
npm test -- tests/integration/BompDataGeneration.integration.test.ts

# 全テストを実行
npm test
```

### 新機能の追加

1. **新しいデータフィールドの追加**

   - `src/types/index.ts` の `Bomp` 型を更新
   - `BompDataMapper` でマッピングロジックを追加
   - テストを更新

2. **新しい処理ステップの追加**
   - 適切なレイヤー（parser/mapper/processor/generator）に実装
   - エラーハンドリングを追加
   - 単体テストを作成

### パフォーマンス最適化

- バッチサイズの調整
- 並行処理の最適化
- メモリ使用量の監視
- API リクエスト頻度の調整

## 関連ドキュメント

- [API 仕様](./API.md)
- [使用方法とトラブルシューティング](./USAGE_AND_TROUBLESHOOTING.md)
- [設定ガイド](../CONFIGURATION.md)
