# 使用例とトラブルシューティングガイド

## 概要

このドキュメントでは、攻撃タイプフォールバック機能の使用例と、エラー時のトラブルシューティング手順について説明します。

## 使用例

### 1. 基本的な使用方法

#### DataMapper での攻撃タイプマッピング

```typescript
import { DataMapper } from "./mappers/DataMapper.js";

const mapper = new DataMapper();

// 従来の日本語マッピング（既存機能）
try {
  const attackType = mapper.mapAttackType("打撃");
  console.log(attackType); // "strike"
} catch (error) {
  console.error("マッピングエラー:", error.message);
}

// フォールバック機能付きマッピング
try {
  const attackType = mapper.mapAttackType("未知の値", "28");
  console.log(attackType); // フォールバック結果または "strike"
} catch (error) {
  console.error("マッピングエラー:", error.message);
}
```

#### CharacterGenerator での使用

```typescript
import { CharacterGenerator } from "./generators/CharacterGenerator.js";

const generator = new CharacterGenerator();

// pageId を含むキャラクター生成（フォールバック機能有効）
try {
  const character = await generator.generateCharacter(
    jaApiData,
    enApiData,
    "28" // pageId を指定
  );
  console.log("生成されたキャラクター:", character);
} catch (error) {
  console.error("キャラクター生成エラー:", error.message);
}
```

### 2. AttackTypeFallbackService の直接使用

```typescript
import { AttackTypeFallbackService } from "./services/AttackTypeFallbackService.js";

const service = new AttackTypeFallbackService();

// サービスの初期化
await service.initialize();

// 攻撃タイプの取得
const attackType = service.getAttackTypeByPageId("28");
if (attackType) {
  console.log("取得された攻撃タイプ:", attackType);
} else {
  console.log("攻撃タイプが見つかりませんでした");
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

## フォールバック機能の動作フロー

```
1. wiki データから攻撃タイプ取得を試行
   ↓ (成功)
   結果を返す

   ↓ (失敗 & pageId あり)
2. json/data/list.json からフォールバック取得を試行
   ↓ (成功)
   フォールバック結果を返す

   ↓ (失敗)
3. デフォルト値 "strike" を返す
```

## ログメッセージの解釈

### INFO レベル

#### `AttackTypeFallbackService initialized successfully`

- **意味**: フォールバックサービスが正常に初期化されました
- **コンテキスト**: `{ characterCount: number }`
- **対応**: 正常な動作です

#### `AttackType fallback used for character`

- **意味**: フォールバック機能が使用されました
- **コンテキスト**: `{ pageId: string, result: AttackType }`
- **対応**: wiki データから取得できなかったため、list.json から取得しました

#### `Wiki data mapping failed, trying fallback`

- **意味**: wiki データのマッピングが失敗し、フォールバックを試行中です
- **コンテキスト**: `{ rawAttackType: string, pageId: string }`
- **対応**: 正常なフォールバック処理です

### WARN レベル

#### `list.json file not found, fallback service disabled`

- **意味**: list.json ファイルが見つからず、フォールバック機能が無効化されました
- **コンテキスト**: `{ path: string }`
- **対応**: ファイルの存在を確認してください

#### `Unknown attack type value, using default`

- **意味**: 未知の攻撃タイプ値が検出され、デフォルト値を使用します
- **コンテキスト**: `{ englishValue: string, defaultValue: "strike" }`
- **対応**: 新しい攻撃タイプが追加された可能性があります

#### `Mapping fallback to default attack type`

- **意味**: フォールバックも失敗し、デフォルト値を使用します
- **コンテキスト**: `{ pageId: string, rawAttackType: string, defaultValue: "strike" }`
- **対応**: キャラクターが list.json に存在しない可能性があります

### DEBUG レベル

#### `Character found in list.json`

- **意味**: キャラクターが list.json で見つかりました
- **コンテキスト**: `{ characterName: string, pageId: string, attackType: string }`
- **対応**: 正常な動作です

#### `Character not found in list.json`

- **意味**: キャラクターが list.json で見つかりませんでした
- **コンテキスト**: `{ pageId: string }`
- **対応**: pageId が正しいか確認してください

#### `Attack type mapped from English to enum`

- **意味**: 英語の攻撃タイプが enum 値にマッピングされました
- **コンテキスト**: `{ englishValue: string, mappedValue: AttackType }`
- **対応**: 正常な動作です

### ERROR レベル

#### `Failed to initialize AttackTypeFallbackService`

- **意味**: フォールバックサービスの初期化に失敗しました
- **コンテキスト**: `{ error: string }`
- **対応**: エラー詳細を確認し、ファイルアクセス権限や JSON 形式を確認してください

## トラブルシューティング

### 1. list.json ファイルが見つからない

**症状:**

```
[WARN] list.json file not found, fallback service disabled
```

**原因:**

- `json/data/list.json` ファイルが存在しない
- ファイルパスが間違っている

**解決方法:**

1. ファイルの存在を確認:
   ```bash
   ls -la json/data/list.json
   ```
2. ファイルが存在しない場合は、適切な場所に配置
3. ファイルパスが正しいか確認

### 2. JSON 解析エラー

**症状:**

```
[ERROR] Failed to initialize AttackTypeFallbackService
```

**原因:**

- list.json ファイルの JSON 形式が不正
- ファイルが破損している

**解決方法:**

1. JSON 形式の検証:
   ```bash
   cat json/data/list.json | jq .
   ```
2. ファイルの再取得または修復
3. 必要なデータ構造の確認:
   ```json
   {
     "retcode": 0,
     "message": "OK",
     "data": {
       "list": [...]
     }
   }
   ```

### 3. キャラクターが見つからない

**症状:**

```
[DEBUG] Character not found in list.json
```

**原因:**

- 指定された pageId が list.json に存在しない
- pageId の形式が間違っている

**解決方法:**

1. pageId の確認:
   ```typescript
   // pageId は文字列として渡す
   const result = service.getAttackTypeByPageId("28"); // ✓
   const result = service.getAttackTypeByPageId(28); // ✗
   ```
2. list.json 内のキャラクター一覧を確認
3. 新しいキャラクターの場合は list.json の更新が必要

### 4. 未知の攻撃タイプ値

**症状:**

```
[WARN] Unknown attack type value, using default
```

**原因:**

- 新しい攻撃タイプが追加された
- list.json のデータ形式が変更された

**解決方法:**

1. 新しい攻撃タイプの確認
2. `AttackTypeFallbackService` のマッピング定義を更新:
   ```typescript
   const mapping: Record<string, AttackType> = {
     Slash: "slash",
     Pierce: "pierce",
     Strike: "strike",
     // 新しい攻撃タイプを追加
   };
   ```
3. 型定義の更新が必要な場合は `AttackType` を拡張

### 5. フォールバック機能が動作しない

**症状:**

- フォールバック関連のログが出力されない
- 常にデフォルト値が使用される

**原因:**

- pageId が渡されていない
- サービスの初期化が完了していない

**解決方法:**

1. pageId の渡し方を確認:
   ```typescript
   // pageId を必ず渡す
   const attackType = mapper.mapAttackType("未知の値", "28");
   ```
2. 初期化の完了を待つ:
   ```typescript
   const service = new AttackTypeFallbackService();
   await service.initialize(); // 初期化完了を待つ
   ```

### 6. パフォーマンスの問題

**症状:**

- 初回の処理が遅い
- メモリ使用量が多い

**原因:**

- list.json ファイルが大きい
- 複数回の初期化が実行されている

**解決方法:**

1. 初期化は一度だけ実行されることを確認
2. ログレベルを INFO 以上に設定してデバッグログを無効化:
   ```typescript
   logger.setLogLevel(LogLevel.INFO);
   ```
3. 必要に応じて list.json のサイズを最適化

## ベストプラクティス

### 1. エラーハンドリング

```typescript
try {
  const attackType = mapper.mapAttackType(rawValue, pageId);
  // 成功時の処理
} catch (error) {
  if (error instanceof MappingError) {
    // マッピングエラーの処理
    logger.warn("Mapping failed, using fallback", { rawValue, pageId });
  } else {
    // その他のエラー
    logger.error("Unexpected error", { error: error.message });
  }
}
```

### 2. ログレベルの適切な設定

```typescript
// 開発環境
if (process.env.NODE_ENV === "development") {
  logger.setLogLevel(LogLevel.DEBUG);
}

// 本番環境
if (process.env.NODE_ENV === "production") {
  logger.setLogLevel(LogLevel.WARN);
}
```

### 3. 初期化の確認

```typescript
// DataMapper を使用する前に初期化が完了していることを確認
const mapper = new DataMapper();
// 少し待ってから使用（非同期初期化のため）
setTimeout(() => {
  const attackType = mapper.mapAttackType("未知の値", "28");
}, 100);
```

## 監視とメトリクス

### 推奨する監視項目

1. **フォールバック使用率**

   - `FALLBACK_USED` ログの頻度
   - wiki データ取得失敗の傾向

2. **エラー発生率**

   - `FALLBACK_SERVICE_INIT_ERROR` の発生頻度
   - `UNKNOWN_ATTACK_TYPE` の発生頻度

3. **パフォーマンス**
   - 初期化時間
   - メモリ使用量

### ログ分析例

```bash
# フォールバック使用回数の集計
grep "AttackType fallback used" app.log | wc -l

# エラー発生回数の集計
grep "\[ERROR\]" app.log | wc -l

# 未知の攻撃タイプの種類
grep "Unknown attack type value" app.log | grep -o '"englishValue":"[^"]*"' | sort | uniq -c
```
