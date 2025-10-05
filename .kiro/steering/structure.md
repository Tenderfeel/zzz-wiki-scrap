---
inclusion: always
---

# アーキテクチャ・コード構成

## ディレクトリ構造

### 実装ディレクトリ

- `src/` - TypeScript 実装 (レイヤード・アーキテクチャ)
- `data/` - 生成済み TypeScript ファイル (`characters.ts`, `factions.ts`)
- `json/` - 中間 JSON データ・フィルター設定
- `tests/` - 単体・統合・パフォーマンステスト
- `scripts/` - データ生成・処理スクリプト

### レイヤード・アーキテクチャ

```
src/
├── clients/     # API通信層 (HoyoLab API)
├── processors/  # データ変換・処理ロジック
├── generators/  # データ生成エンジン
├── mappers/     # APIレスポンス → 内部型変換
├── parsers/     # JSON解析・構造化
├── services/    # ビジネスロジック
└── utils/       # 共通機能・ヘルパー
```

## 命名規則

### ファイル・クラス

- **ファイル名**: `PascalCase.ts` (例: `CharacterGenerator.ts`)
- **クラス名**: `PascalCase` (例: `DataProcessor`)
- **関数名**: `camelCase` (例: `processCharacterData`)
- **定数**: `UPPER_SNAKE_CASE` (例: `API_BASE_URL`)

### データ識別子

- **キャラクター参照**: 小文字 (例: `lycaon`, `soldier11`)
- **言語コード**: `ja-jp` (日本語), `en-us` (英語)
- **特殊文字**: 数字・記号保持 (例: `soldier0anby`)

## 出力ファイル仕様

### 必須出力

- `data/characters.ts`: `export default Character[]`
- `data/factions.ts`: `export default Faction[]`

### 中間ファイル (デバッグ用)

- `json/data/list.json`: 処理済みキャラクターリスト
- `json/filters/`: 言語別フィルター設定

## 実装パターン

### データフロー

1. **API Client** → HoyoLab API リクエスト
2. **Parser** → JSON 解析・ネストされた JSON 文字列処理
3. **Mapper** → 日本語値 → 英語 enum 変換
4. **Processor** → 数値変換・バリデーション
5. **Generator** → TypeScript ファイル生成

### エラーハンドリング

- **カスタムエラー**: `src/errors/` でエラー分類
- **ログ出力**: 処理状況・エラー詳細記録
- **フォールバック**: 部分的失敗でも処理継続
- **バリデーション**: 必須フィールド検証・デフォルト値設定

### 設定管理

- `processing-config.json`: 処理パラメータ外部化
- 環境別設定サポート
- 設定値検証・デフォルト値提供
