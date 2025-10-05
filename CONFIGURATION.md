# 設定ガイド

このドキュメントでは、全キャラクターデータ生成ツールの設定オプションについて説明します。

## 基本的な使用方法

### 1. デフォルト設定で実行

```bash
npm run generate:configurable
```

### 3. カスタム設定ファイルを使用

```bash
npm run generate:configurable --config my-config.json
```

### 5. シンプルな生成（設定なし）

```bash
npm run generate
```

### 6. ヘルプを表示

```bash
npm run generate:configurable --help
```

## 設定ファイル

設定ファイルは JSON 形式で、以下の構造を持ちます：

```json
{
  "batchSize": 5,
  "delayMs": 200,
  "enableCharacterFiltering": true,
  "characterFilter": {
    "includeCharacterIds": ["lycaon", "anby", "billy"]
  }
}
```

## 設定オプション

### バッチ処理設定

| オプション       | 型     | デフォルト | 説明                              |
| ---------------- | ------ | ---------- | --------------------------------- |
| `batchSize`      | number | 5          | 同時処理するキャラクター数 (1-20) |
| `delayMs`        | number | 200        | API リクエスト間の遅延時間 (ms)   |
| `maxRetries`     | number | 3          | 失敗時の最大リトライ回数          |
| `minSuccessRate` | number | 0.8        | 最小成功率 (0-1)                  |

### 並行処理設定

| オプション         | 型      | デフォルト | 説明                   |
| ------------------ | ------- | ---------- | ---------------------- |
| `maxConcurrency`   | number  | 5          | 最大並行処理数         |
| `enableWorkerPool` | boolean | true       | ワーカープールの有効化 |

### メモリ最適化設定

| オプション                 | 型      | デフォルト | 説明                         |
| -------------------------- | ------- | ---------- | ---------------------------- |
| `enableMemoryOptimization` | boolean | true       | メモリ最適化の有効化         |
| `memoryThresholdMB`        | number  | 100        | メモリ使用量の閾値 (MB)      |
| `gcInterval`               | number  | 10         | ガベージコレクション実行間隔 |

### プログレス表示設定

| オプション               | 型      | デフォルト | 説明                       |
| ------------------------ | ------- | ---------- | -------------------------- |
| `enableEnhancedProgress` | boolean | true       | 拡張プログレス表示の有効化 |
| `progressUpdateInterval` | number  | 1000       | プログレス更新間隔 (ms)    |
| `showMemoryUsage`        | boolean | true       | メモリ使用量の表示         |
| `showPerformanceMetrics` | boolean | true       | パフォーマンス指標の表示   |
| `showDetailedTiming`     | boolean | true       | 詳細タイミング情報の表示   |
| `progressBarWidth`       | number  | 40         | プログレスバーの幅         |
| `useColors`              | boolean | true       | カラー表示の有効化         |

### ファイル設定

| オプション               | 型      | デフォルト             | 説明                 |
| ------------------------ | ------- | ---------------------- | -------------------- |
| `scrapingFilePath`       | string  | "Scraping.md"          | 入力ファイルのパス   |
| `outputFilePath`         | string  | "data/characters.ts"   | 出力ファイルのパス   |
| `enableReportGeneration` | boolean | true                   | レポート生成の有効化 |
| `reportOutputPath`       | string  | "processing-report.md" | レポート出力先       |

### キャラクターフィルタリング設定

| オプション                 | 型      | デフォルト | 説明                       |
| -------------------------- | ------- | ---------- | -------------------------- |
| `enableCharacterFiltering` | boolean | false      | フィルタリングの有効化     |
| `characterFilter`          | object  | {}         | フィルター設定オブジェクト |

#### フィルター設定詳細

```json
{
  "characterFilter": {
    "includeCharacterIds": ["lycaon", "anby", "billy"],
    "excludeCharacterIds": ["soldier11"],
    "includePageIds": [28, 2, 19],
    "excludePageIds": [100, 200],
    "pageIdRange": {
      "min": 1,
      "max": 100
    },
    "maxCharacters": 10,
    "randomSample": {
      "enabled": true,
      "count": 5,
      "seed": 12345
    }
  }
}
```

| フィルターオプション  | 型       | 説明                      |
| --------------------- | -------- | ------------------------- |
| `includeCharacterIds` | string[] | 処理対象のキャラクター ID |
| `excludeCharacterIds` | string[] | 除外するキャラクター ID   |
| `includePageIds`      | number[] | 処理対象のページ ID       |
| `excludePageIds`      | number[] | 除外するページ ID         |
| `pageIdRange`         | object   | ページ ID の範囲指定      |
| `maxCharacters`       | number   | 最大処理キャラクター数    |
| `randomSample`        | object   | ランダムサンプリング設定  |

### デバッグ設定

| オプション              | 型      | デフォルト | 説明                               |
| ----------------------- | ------- | ---------- | ---------------------------------- |
| `enableDebugMode`       | boolean | false      | デバッグモードの有効化             |
| `logLevel`              | string  | "info"     | ログレベル (error/warn/info/debug) |
| `enableDetailedLogging` | boolean | false      | 詳細ログの有効化                   |

## 使用例

### 例 1: 特定のキャラクターのみ処理

```json
{
  "enableCharacterFiltering": true,
  "characterFilter": {
    "includeCharacterIds": ["lycaon", "anby", "billy", "nicole", "corin"]
  }
}
```

### 例 2: 高速処理設定

```json
{
  "batchSize": 10,
  "delayMs": 100,
  "maxConcurrency": 10,
  "enableEnhancedProgress": false
}
```

### 例 3: 低メモリ環境向け設定

```json
{
  "batchSize": 2,
  "maxConcurrency": 2,
  "memoryThresholdMB": 50,
  "gcInterval": 5
}
```

### 例 4: テスト用ランダムサンプリング

```json
{
  "enableCharacterFiltering": true,
  "characterFilter": {
    "randomSample": {
      "enabled": true,
      "count": 5,
      "seed": 12345
    }
  },
  "enableDebugMode": true
}
```

### 例 5: 特定範囲のページ ID のみ処理

```json
{
  "enableCharacterFiltering": true,
  "characterFilter": {
    "pageIdRange": {
      "min": 1,
      "max": 50
    },
    "maxCharacters": 20
  }
}
```

## パフォーマンス調整

### 高速化のための設定

- `batchSize` を増やす (5-10)
- `delayMs` を減らす (100-200ms)
- `maxConcurrency` を増やす (5-10)
- `enableEnhancedProgress` を無効化

### 安定性重視の設定

- `batchSize` を減らす (2-3)
- `delayMs` を増やす (300-500ms)
- `maxRetries` を増やす (5-10)
- `minSuccessRate` を下げる (0.6-0.7)

### メモリ使用量削減

- `batchSize` を減らす (2-3)
- `maxConcurrency` を減らす (2-3)
- `memoryThresholdMB` を下げる (50-80MB)
- `gcInterval` を減らす (5-8)

## トラブルシューティング

### よくある問題と解決方法

1. **メモリ不足エラー**

   - `batchSize` と `maxConcurrency` を減らす
   - `memoryThresholdMB` を下げる
   - `gcInterval` を減らす

2. **API レート制限エラー**

   - `delayMs` を増やす (500-1000ms)
   - `batchSize` を減らす

3. **処理が遅い**

   - `batchSize` を増やす
   - `delayMs` を減らす
   - `maxConcurrency` を増やす

4. **フィルタリングが効かない**
   - `enableCharacterFiltering` が `true` になっているか確認
   - キャラクター ID の綴りを確認
   - フィルター設定の競合をチェック

## 設定ファイルの管理

### 複数の設定ファイルを使用

```bash
# 開発用設定
npm run generate:configurable -- --config config/development.json

# 本番用設定
npm run generate:configurable -- --config config/production.json

# テスト用設定
npm run generate:configurable -- --config config/test.json
```

### 設定ファイルのバージョン管理

設定ファイルは Git で管理することを推奨します：

```bash
# 設定ファイルをコミット
git add processing-config.json
git commit -m "Add processing configuration"
```

### 設定の検証

設定ファイルの妥当性は自動的に検証されますが、手動で確認することも可能です：

```bash
# 設定ファイルを生成して内容を確認
npm run generate:config
cat processing-config.json
```

## 高度な使用方法

### 環境変数との組み合わせ

設定ファイルと環境変数を組み合わせて使用することも可能です：

```bash
# 環境変数で設定を上書き
BATCH_SIZE=10 npm run generate:configurable
```

### CI/CD での使用

継続的インテグレーション環境での使用例：

```yaml
# GitHub Actions の例
- name: Generate character data
  run: |
    npm run generate:config
    # 設定をカスタマイズ
    jq '.batchSize = 3 | .enableDebugMode = false' processing-config.json > ci-config.json
    npm run generate:configurable -- --config ci-config.json
```

このガイドを参考に、あなたの環境や要件に合わせて設定をカスタマイズしてください。
