# 設計ドキュメント

## 概要

キャラクターデータに実装バージョン（`releaseVersion`）フィールドを追加する機能の設計です。HoyoLab API から取得した実装バージョン情報を解析し、数値形式で保存します。

## アーキテクチャ

### データフロー

```
HoyoLab API → DataProcessor → DataMapper → Character型 → TypeScript出力
     ↓              ↓             ↓           ↓
実装バージョン → バージョン抽出 → 数値変換 → releaseVersion → data/characters.ts
```

### 処理レイヤー

1. **Parser Layer**: API レスポンスから基本情報（baseInfo）コンポーネントを抽出
2. **Mapper Layer**: `Ver.X.Y「バージョン名」` 形式から数値部分を抽出
3. **Processor Layer**: 抽出した数値を number 型に変換
4. **Generator Layer**: Character 型に releaseVersion フィールドを含めて出力

## コンポーネントと インターフェース

### 1. API レスポンス構造

実装バージョン情報は以下の場所に格納されています：

```typescript
// 実際のAPIレスポンス構造（lycaon.jsonから確認）
data.page.modules[0] → components[0] (component_id: "baseInfo") →
  data (JSON文字列) → list[] →
  { key: "実装バージョン", value: ["<p>Ver.1.0「新エリー都へようこそ」</p>"] }
```

具体例：

```json
{
  "key": "実装バージョン",
  "value": ["<p>Ver.1.0「新エリー都へようこそ」</p>"],
  "id": "baseInfo50400"
}
```

### 2. 型定義の拡張

#### Character 型の拡張

```typescript
// src/types/index.ts
export type Character = {
  id: string;
  name: { [key in Lang]: string };
  fullName: { [key in Lang]: string };
  specialty: Specialty;
  stats: Stats;
  assistType?: AssistType;
  faction: number;
  rarity: Rarity;
  attr: Attributes;
  releaseVersion: number; // 新規追加
};
```

#### 中間処理型の拡張

```typescript
// src/types/processing.ts
export interface BasicCharacterInfo {
  id: string;
  name: string;
  specialty: string;
  stats: string;
  rarity: string;
  releaseVersion?: number; // 新規追加
}
```

### 3. DataProcessor の拡張

#### 新しいメソッド

```typescript
/**
 * 実装バージョン情報を抽出
 * @param apiData APIレスポンス
 * @returns 実装バージョン（数値）、見つからない場合は0
 */
extractReleaseVersion(apiData: ApiResponse): number
```

#### 処理ロジック

1. `baseInfo` コンポーネントを検索
2. JSON データをパースして `list` 配列を取得
3. `key: "実装バージョン"` のアイテムを検索
4. `value` 配列から HTML 文字列を取得
5. 正規表現で `Ver.X.Y` パターンを抽出
6. 数値部分を `parseFloat()` で変換

### 4. DataMapper の拡張

#### バージョン解析メソッド

```typescript
/**
 * バージョン文字列から数値を抽出
 * @param versionString "Ver.1.0「バージョン名」" 形式の文字列
 * @returns 数値バージョン（例: 1.0）
 */
parseVersionNumber(versionString: string): number | null
```

#### 正規表現パターン

```typescript
// Ver.X.Y パターンを抽出する正規表現
const VERSION_PATTERN = /Ver\.(\d+\.\d+)/;
```

## データモデル

### 実装バージョンの形式

- **入力形式**: `"<p>Ver.1.0「新エリー都へようこそ」</p>"`
- **抽出パターン**: `Ver.(\d+\.\d+)`
- **出力形式**: `1.0` (number 型)

### デフォルト値の処理

- バージョン情報が見つからない場合: `0`
- パース失敗の場合: `0`
- 無効な形式の場合: `0`

### バージョン番号の例

- `Ver.1.0` → `1.0`
- `Ver.1.1` → `1.1`
- `Ver.1.2` → `1.2`
- `Ver.2.0` → `2.0`

## エラーハンドリング

### エラーケースと対応

1. **baseInfo コンポーネントが見つからない**

   - ログ出力: WARN レベル
   - デフォルト値: `0`
   - 処理継続: YES

2. **実装バージョンキーが見つからない**

   - ログ出力: DEBUG レベル
   - デフォルト値: `0`
   - 処理継続: YES

3. **バージョン文字列の解析失敗**

   - ログ出力: WARN レベル
   - デフォルト値: `0`
   - 処理継続: YES

4. **数値変換失敗**
   - ログ出力: ERROR レベル
   - デフォルト値: `0`
   - 処理継続: YES

### ログ出力例

```typescript
// 成功時
logger.debug("実装バージョン抽出成功", {
  characterId: "lycaon",
  rawVersion: "Ver.1.0「新エリー都へようこそ」",
  parsedVersion: 1.0,
});

// 失敗時
logger.warn("実装バージョン情報が見つかりません", {
  characterId: "lycaon",
  defaultVersion: 0,
});
```

## テスト戦略

### 単体テスト

1. **DataProcessor.extractReleaseVersion()**

   - 正常なバージョン文字列の解析
   - 異常なバージョン文字列の処理
   - baseInfo コンポーネントが存在しない場合
   - 実装バージョンキーが存在しない場合

2. **DataMapper.parseVersionNumber()**
   - 各種バージョン形式のテスト
   - 無効な文字列の処理
   - null/undefined の処理

### 統合テスト

1. **完全なデータ処理パイプライン**

   - 実際の API レスポンスを使用
   - 生成された Character 型の検証
   - TypeScript 出力ファイルの検証

2. **エラー処理の統合テスト**
   - 部分的に欠損した API データの処理
   - 複数キャラクターでの一括処理

### テストデータ

```typescript
// 正常ケース
const validApiResponse = {
  data: {
    page: {
      modules: [
        {
          components: [
            {
              component_id: "baseInfo",
              data: JSON.stringify({
                list: [
                  {
                    key: "実装バージョン",
                    value: ["<p>Ver.1.0「新エリー都へようこそ」</p>"],
                  },
                ],
              }),
            },
          ],
        },
      ],
    },
  },
};

// 異常ケース
const invalidApiResponse = {
  data: {
    page: {
      modules: [], // baseInfoコンポーネントなし
    },
  },
};
```

## 実装の考慮事項

### パフォーマンス

- 正規表現の使用は最小限に抑制
- JSON.parse() のエラーハンドリングを適切に実装
- ログ出力の頻度を調整

### 後方互換性

- 既存の Character 型を拡張するため、既存コードへの影響を最小化
- オプショナルフィールドとして実装し、段階的に必須化

### 拡張性

- 将来的なバージョン形式の変更に対応できる設計
- 設定ファイルでのバージョン解析ルールの外部化を検討

## 設定管理

### processing-config.json の拡張

```json
{
  "versionExtraction": {
    "enabled": true,
    "defaultVersion": 0,
    "pattern": "Ver\\.(\\d+\\.\\d+)",
    "logLevel": "debug"
  }
}
```

### 設定項目

- `enabled`: バージョン抽出機能の有効/無効
- `defaultVersion`: デフォルトバージョン値
- `pattern`: バージョン抽出用正規表現
- `logLevel`: ログ出力レベル
