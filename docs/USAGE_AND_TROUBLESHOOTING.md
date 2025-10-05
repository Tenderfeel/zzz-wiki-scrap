# 使用例とトラブルシューティングガイド

## 概要

このドキュメントでは、キャラクターデータ生成システムの使用例と、エラー時のトラブルシューティング手順について説明します。

## 使用例

### 1. 基本的な使用方法

#### DataMapper でのデータマッピング

```typescript
import { DataMapper } from "./mappers/DataMapper.js";

const mapper = new DataMapper();

// 特性のマッピング
try {
  const specialty = mapper.mapSpecialty("撃破");
  console.log(specialty); // "stun"
} catch (error) {
  console.error("マッピングエラー:", error.message);
}

// 属性のマッピング
try {
  const stats = mapper.mapStats("氷属性");
  console.log(stats); // "ice"
} catch (error) {
  console.error("マッピングエラー:", error.message);
}

// レアリティのマッピング
try {
  const rarity = mapper.mapRarity("S");
  console.log(rarity); // "S"
} catch (error) {
  console.error("マッピングエラー:", error.message);
}
```

#### CharacterGenerator での使用

```typescript
import { CharacterGenerator } from "./generators/CharacterGenerator.js";

const generator = new CharacterGenerator();

// キャラクター生成
try {
  const character = await generator.generateCharacter(28);
  console.log("生成されたキャラクター:", character);
} catch (error) {
  console.error("キャラクター生成エラー:", error.message);
}
```

### 2. AllCharactersGenerator での一括生成

```typescript
import { AllCharactersGenerator } from "./generators/AllCharactersGenerator.js";

const generator = new AllCharactersGenerator();

// 全キャラクターデータの生成
try {
  const result = await generator.generateAllCharacters();
  console.log(`生成完了: ${result.characters.length}体のキャラクター`);
  console.log(`出力ファイル: ${result.outputFilePath}`);
} catch (error) {
  console.error("一括生成エラー:", error.message);
}
```

### 3. ログレベルの設定

```typescript
import { logger, LogLevel } from "./utils/Logger.js";

// デバッグ情報を表示したい場合
logger.setLogLevel(LogLevel.DEBUG);

// 警告以上のみ表示したい場合
logger.setLogLevel(LogLevel.WARN);
```

## データ処理フロー

```
1. API からキャラクターデータを取得
   ↓
2. JSON データの解析と変換
   ↓
3. 日本語値を英語 enum 値にマッピング
   ↓
4. Character オブジェクトの生成
   ↓
5. TypeScript ファイルとして出力
```

## ログメッセージの解釈

### INFO レベル

#### `Character generation completed successfully`

- **意味**: キャラクター生成が正常に完了しました
- **コンテキスト**: `{ pageId: number, characterName: string }`
- **対応**: 正常な動作です

#### `Data processing completed`

- **意味**: データ処理が完了しました
- **コンテキスト**: `{ processedCount: number, totalTime: number }`
- **対応**: 正常な動作です

### WARN レベル

#### `Missing data field, using default value`

- **意味**: データフィールドが欠損しており、デフォルト値を使用します
- **コンテキスト**: `{ field: string, defaultValue: any }`
- **対応**: API データの不整合の可能性があります

#### `Unknown enum value, using fallback`

- **意味**: 未知の enum 値が検出され、フォールバック値を使用します
- **コンテキスト**: `{ rawValue: string, fallbackValue: string }`
- **対応**: 新しい値が追加された可能性があります

### DEBUG レベル

#### `API request completed`

- **意味**: API リクエストが完了しました
- **コンテキスト**: `{ pageId: number, language: string, responseSize: number }`
- **対応**: 正常な動作です

#### `Data mapping completed`

- **意味**: データマッピングが完了しました
- **コンテキスト**: `{ field: string, originalValue: string, mappedValue: string }`
- **対応**: 正常な動作です

### ERROR レベル

#### `Failed to fetch character data`

- **意味**: キャラクターデータの取得に失敗しました
- **コンテキスト**: `{ pageId: number, error: string }`
- **対応**: API の状態やネットワーク接続を確認してください

## トラブルシューティング

### 1. API リクエストエラー

**症状:**

```
[ERROR] Failed to fetch character data
```

**原因:**

- ネットワーク接続の問題
- API サーバーの障害
- レート制限に達している

**解決方法:**

1. ネットワーク接続を確認:
   ```bash
   ping sg-wiki-api-static.hoyolab.com
   ```
2. API エンドポイントの状態を確認
3. リクエスト間隔を調整（delayMs を増加）

### 2. データマッピングエラー

**症状:**

```
[WARN] Unknown enum value, using fallback
```

**原因:**

- 新しい enum 値が API に追加された
- データ形式が変更された

**解決方法:**

1. 新しい値の確認
2. マッピング定義を更新:
   ```typescript
   const SPECIALTY_MAPPING: Record<string, Specialty> = {
     撃破: "stun",
     強攻: "attack",
     異常: "anomaly",
     支援: "support",
     防護: "defense",
     命破: "rupture",
     // 新しい特性を追加
   };
   ```
3. 型定義の更新が必要な場合は enum を拡張

### 3. JSON 解析エラー

**症状:**

```
[ERROR] Failed to parse JSON response
```

**原因:**

- API レスポンスの JSON 形式が不正
- ネストされた JSON 文字列の解析失敗

**解決方法:**

1. API レスポンスの確認:
   ```bash
   curl "https://sg-wiki-api-static.hoyolab.com/hoyowiki/zzz/wapi/entry_page?entry_page_id=28&lang=ja-jp"
   ```
2. JSON 形式の検証
3. ネストされた JSON 文字列の処理を確認

### 4. ファイル出力エラー

**症状:**

```
[ERROR] Failed to write output file
```

**原因:**

- ファイル書き込み権限がない
- ディスク容量不足
- ファイルパスが不正

**解決方法:**

1. 書き込み権限の確認:
   ```bash
   ls -la data/
   ```
2. ディスク容量の確認:
   ```bash
   df -h
   ```
3. 出力ディレクトリの作成:
   ```bash
   mkdir -p data
   ```

### 5. メモリ不足エラー

**症状:**

- 処理が途中で停止する
- メモリ使用量が異常に高い

**原因:**

- 大量のデータを一度に処理している
- メモリリークが発生している

**解決方法:**

1. バッチサイズを小さくする:
   ```json
   {
     "batchSize": 3,
     "enableMemoryOptimization": true
   }
   ```
2. メモリ最適化を有効にする
3. ガベージコレクションの間隔を調整

### 6. パフォーマンスの問題

**症状:**

- 処理が非常に遅い
- CPU 使用率が高い

**原因:**

- リクエスト間隔が短すぎる
- 並行処理数が多すぎる

**解決方法:**

1. 処理設定を調整:
   ```json
   {
     "delayMs": 500,
     "maxConcurrency": 3,
     "batchSize": 3
   }
   ```
2. プログレス表示を無効化:
   ```json
   {
     "enableEnhancedProgress": false,
     "showDetailedTiming": false
   }
   ```

## ベストプラクティス

### 1. エラーハンドリング

```typescript
try {
  const character = await generator.generateCharacter(pageId);
  // 成功時の処理
} catch (error) {
  if (error instanceof MappingError) {
    // マッピングエラーの処理
    logger.warn("Mapping failed", { pageId, error: error.message });
  } else if (error instanceof ApiError) {
    // API エラーの処理
    logger.error("API request failed", { pageId, error: error.message });
  } else {
    // その他のエラー
    logger.error("Unexpected error", { pageId, error: error.message });
  }
}
```

### 2. 設定の最適化

```typescript
// 開発環境での設定
const devConfig = {
  batchSize: 2,
  delayMs: 1000,
  enableDebugMode: true,
  logLevel: "debug",
};

// 本番環境での設定
const prodConfig = {
  batchSize: 5,
  delayMs: 200,
  enableDebugMode: false,
  logLevel: "warn",
};
```

### 3. リソース管理

```typescript
// メモリ使用量の監視
const memoryUsage = process.memoryUsage();
if (memoryUsage.heapUsed > 100 * 1024 * 1024) {
  // 100MB を超えた場合はガベージコレクションを実行
  global.gc?.();
}
```

## 監視とメトリクス

### 推奨する監視項目

1. **処理成功率**

   - 成功したキャラクター生成数
   - 失敗したリクエスト数

2. **パフォーマンス**

   - 平均処理時間
   - メモリ使用量
   - CPU 使用率

3. **エラー発生率**
   - API エラーの頻度
   - マッピングエラーの頻度

### ログ分析例

```bash
# 成功した処理の集計
grep "Character generation completed" app.log | wc -l

# エラー発生回数の集計
grep "\[ERROR\]" app.log | wc -l

# 処理時間の分析
grep "Data processing completed" app.log | grep -o '"totalTime":[0-9]*' | cut -d: -f2 | sort -n
```
