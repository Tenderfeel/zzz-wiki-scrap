# 設定ガイド

このドキュメントでは、キャラクターデータ生成システムとボンプデータ生成システムの設定について詳しく説明します。

## 設定ファイル概要

### キャラクターデータ生成設定

**ファイル**: `processing-config.json`

```json
{
  "batchSize": 5,
  "delayMs": 200,
  "maxRetries": 3,
  "minSuccessRate": 0.8,
  "maxConcurrency": 5,
  "enableWorkerPool": true,
  "enableMemoryOptimization": true,
  "memoryThresholdMB": 100,
  "gcInterval": 10,
  "enableEnhancedProgress": true,
  "progressUpdateInterval": 1000,
  "showMemoryUsage": true,
  "showPerformanceMetrics": true,
  "showDetailedTiming": true,
  "progressBarWidth": 40,
  "useColors": true,
  "scrapingFilePath": "Scraping.md",
  "outputFilePath": "data/characters.ts",
  "enableReportGeneration": true,
  "reportOutputPath": "processing-report.md",
  "enableCharacterFiltering": false,
  "characterFilter": {},
  "enableDebugMode": false,
  "logLevel": "info",
  "enableDetailedLogging": false
}
```

### ボンプデータ生成設定

**ファイル**: `bomp-processing-config.json`

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
  "enableDebugMode": false,
  "maxConcurrency": 3,
  "enableMemoryOptimization": true,
  "memoryThresholdMB": 100,
  "gcInterval": 10,
  "enableEnhancedProgress": true,
  "progressUpdateInterval": 1000,
  "showMemoryUsage": true,
  "showPerformanceMetrics": true,
  "showDetailedTiming": true,
  "progressBarWidth": 40,
  "useColors": true,
  "enableDetailedLogging": false,
  "environments": {
    "development": {
      "logLevel": "debug",
      "enableDebugMode": true,
      "enableDetailedLogging": true,
      "delayMs": 1000,
      "enableValidation": true
    },
    "production": {
      "logLevel": "error",
      "enableDebugMode": false,
      "enableDetailedLogging": false,
      "delayMs": 500,
      "enableValidation": false
    },
    "test": {
      "logLevel": "warn",
      "enableDebugMode": false,
      "enableDetailedLogging": false,
      "delayMs": 100,
      "enableValidation": true,
      "useMockData": true
    }
  }
}
```

## 設定項目詳細

### 基本処理設定

#### `batchSize` (number)

- **説明**: 同時に処理するアイテム数
- **デフォルト**: 5
- **推奨値**:
  - 高速処理: 8-10
  - 安定処理: 3-5
  - 低リソース: 1-2

#### `delayMs` (number)

- **説明**: API リクエスト間の遅延時間（ミリ秒）
- **デフォルト**:
  - キャラクター: 200ms
  - ボンプ: 500ms
- **推奨値**:
  - 高速処理: 100-200ms
  - 安定処理: 300-500ms
  - レート制限回避: 1000ms 以上

#### `maxRetries` (number)

- **説明**: API 失敗時の最大リトライ回数
- **デフォルト**: 3
- **推奨値**: 3-5

#### `minSuccessRate` (number)

- **説明**: 最小成功率（0-1）
- **デフォルト**: 0.8 (80%)
- **推奨値**: 0.7-0.9

### パフォーマンス設定

#### `maxConcurrency` (number)

- **説明**: 最大並行処理数
- **デフォルト**:
  - キャラクター: 5
  - ボンプ: 3
- **推奨値**: CPU コア数の 1-2 倍

#### `enableWorkerPool` (boolean)

- **説明**: ワーカープールの使用
- **デフォルト**: true（キャラクターのみ）
- **推奨**: CPU 集約的な処理で有効

#### `enableMemoryOptimization` (boolean)

- **説明**: メモリ最適化の有効化
- **デフォルト**: true
- **推奨**: 大量データ処理時は有効

#### `memoryThresholdMB` (number)

- **説明**: メモリ使用量の閾値（MB）
- **デフォルト**: 100
- **推奨値**:
  - 低メモリ環境: 50-100MB
  - 通常環境: 100-200MB
  - 高メモリ環境: 200MB 以上

#### `gcInterval` (number)

- **説明**: ガベージコレクション実行間隔
- **デフォルト**: 10
- **推奨値**: 5-20

### プログレス表示設定

#### `enableEnhancedProgress` (boolean)

- **説明**: 拡張プログレス表示の有効化
- **デフォルト**: true
- **推奨**: 開発時は有効、本番時は無効

#### `progressUpdateInterval` (number)

- **説明**: プログレス更新間隔（ミリ秒）
- **デフォルト**: 1000
- **推奨値**: 500-2000

#### `showMemoryUsage` (boolean)

- **説明**: メモリ使用量表示
- **デフォルト**: true
- **推奨**: デバッグ時のみ有効

#### `showPerformanceMetrics` (boolean)

- **説明**: パフォーマンス指標表示
- **デフォルト**: true
- **推奨**: 開発・テスト時のみ有効

#### `showDetailedTiming` (boolean)

- **説明**: 詳細タイミング情報表示
- **デフォルト**: true
- **推奨**: デバッグ時のみ有効

#### `progressBarWidth` (number)

- **説明**: プログレスバーの幅（文字数）
- **デフォルト**: 40
- **推奨値**: 20-60

#### `useColors` (boolean)

- **説明**: カラー出力の使用
- **デフォルト**: true
- **推奨**: ターミナル対応に応じて設定

### ファイル設定

#### `scrapingFilePath` (string)

- **説明**: スクレイピング対象リストファイルのパス
- **デフォルト**: "Scraping.md"
- **推奨**: プロジェクトルートからの相対パス

#### `outputFilePath` (string)

- **説明**: 出力ファイルのパス
- **デフォルト**:
  - キャラクター: "data/characters.ts"
  - ボンプ: "data/bomps.ts"
- **推奨**: `data/` ディレクトリ内

#### `enableReportGeneration` (boolean)

- **説明**: 処理レポート生成の有効化
- **デフォルト**: true
- **推奨**: 本番環境でも有効

#### `reportOutputPath` (string)

- **説明**: 処理レポートの出力パス
- **デフォルト**:
  - キャラクター: "processing-report.md"
  - ボンプ: "bomp-processing-report.md"

### ログ設定

#### `logLevel` (string)

- **説明**: ログレベル
- **選択肢**: "error", "warn", "info", "debug"
- **デフォルト**: "info"
- **推奨**:
  - 開発: "debug"
  - テスト: "info"
  - 本番: "warn" または "error"

#### `enableDebugMode` (boolean)

- **説明**: デバッグモードの有効化
- **デフォルト**: false
- **推奨**: 開発時のみ有効

#### `enableDetailedLogging` (boolean)

- **説明**: 詳細ログの有効化
- **デフォルト**: false
- **推奨**: トラブルシューティング時のみ有効

### 検証設定

#### `enableValidation` (boolean)

- **説明**: データ検証の有効化
- **デフォルト**: true（ボンプのみ）
- **推奨**: 常に有効

#### `enableCharacterFiltering` (boolean)

- **説明**: キャラクターフィルタリングの有効化
- **デフォルト**: false（キャラクターのみ）
- **推奨**: 部分処理時のみ有効

#### `characterFilter` (object)

- **説明**: キャラクターフィルター設定
- **デフォルト**: {}
- **例**:

```json
{
  "characterFilter": {
    "ids": ["lycaon", "anby"],
    "factions": [1, 2],
    "rarities": ["S"]
  }
}
```

## 環境別設定

### 開発環境設定

```json
{
  "environments": {
    "development": {
      "logLevel": "debug",
      "enableDebugMode": true,
      "enableDetailedLogging": true,
      "delayMs": 1000,
      "batchSize": 2,
      "enableValidation": true,
      "showMemoryUsage": true,
      "showPerformanceMetrics": true,
      "showDetailedTiming": true
    }
  }
}
```

### テスト環境設定

```json
{
  "environments": {
    "test": {
      "logLevel": "warn",
      "enableDebugMode": false,
      "enableDetailedLogging": false,
      "delayMs": 100,
      "batchSize": 3,
      "enableValidation": true,
      "useMockData": true,
      "enableEnhancedProgress": false
    }
  }
}
```

### 本番環境設定

```json
{
  "environments": {
    "production": {
      "logLevel": "error",
      "enableDebugMode": false,
      "enableDetailedLogging": false,
      "delayMs": 300,
      "batchSize": 5,
      "enableValidation": false,
      "showMemoryUsage": false,
      "showPerformanceMetrics": false,
      "showDetailedTiming": false,
      "useColors": false
    }
  }
}
```

## 設定の適用方法

### 環境変数での設定

```bash
# 環境の指定
export NODE_ENV=development
npm run generate:bomps

# カスタム設定ファイルの指定
npm run generate:bomps -- --config custom-config.json
```

### プログラムでの設定読み込み

```typescript
import { BompProcessingConfig } from "./src/types";

// 環境別設定の読み込み
const config: BompProcessingConfig = {
  ...baseConfig,
  ...baseConfig.environments?.[process.env.NODE_ENV || "development"],
};
```

## パフォーマンスチューニング

### 高速処理設定

```json
{
  "batchSize": 8,
  "delayMs": 100,
  "maxConcurrency": 6,
  "enableEnhancedProgress": false,
  "showDetailedTiming": false,
  "enableMemoryOptimization": true
}
```

### 安定処理設定

```json
{
  "batchSize": 3,
  "delayMs": 500,
  "maxRetries": 5,
  "maxConcurrency": 3,
  "enableMemoryOptimization": true,
  "memoryThresholdMB": 100
}
```

### 低リソース設定

```json
{
  "batchSize": 1,
  "delayMs": 1000,
  "maxConcurrency": 1,
  "enableWorkerPool": false,
  "enableEnhancedProgress": false,
  "memoryThresholdMB": 50,
  "gcInterval": 5
}
```

## トラブルシューティング設定

### デバッグ設定

```json
{
  "logLevel": "debug",
  "enableDebugMode": true,
  "enableDetailedLogging": true,
  "showMemoryUsage": true,
  "showPerformanceMetrics": true,
  "showDetailedTiming": true,
  "batchSize": 1,
  "delayMs": 2000
}
```

### エラー診断設定

```json
{
  "maxRetries": 10,
  "delayMs": 3000,
  "enableValidation": true,
  "enableReportGeneration": true,
  "logLevel": "debug"
}
```

## 設定の検証

### 設定ファイルの妥当性確認

```bash
# JSON 形式の確認
node -e "console.log(JSON.parse(require('fs').readFileSync('bomp-processing-config.json', 'utf8')))"

# 設定値の確認
npm run config:validate
```

### 推奨設定の確認

```typescript
// 設定値の妥当性チェック
function validateConfig(config: BompProcessingConfig): boolean {
  if (config.batchSize < 1 || config.batchSize > 10) {
    console.warn("batchSize should be between 1 and 10");
    return false;
  }

  if (config.delayMs < 100) {
    console.warn("delayMs should be at least 100ms to avoid rate limits");
    return false;
  }

  return true;
}
```

## 関連ドキュメント

- [ボンプデータ生成ガイド](./docs/BOMP_GENERATION.md)
- [API 仕様](./docs/API.md)
- [使用方法とトラブルシューティング](./docs/USAGE_AND_TROUBLESHOOTING.md)
