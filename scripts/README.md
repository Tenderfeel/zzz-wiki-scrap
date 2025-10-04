# ZZZ キャラクターデータ生成スクリプト

このディレクトリには、HoyoLab API からキャラクター情報を取得し、TypeScript ファイルを自動生成するスクリプトが含まれています。

## ファイル構成

- `generate-characters.js` - メインの生成スクリプト
- `test-escape.js` - エスケープ処理のテストスクリプト
- `README.md` - このファイル

## 機能

### 自動エスケープ処理

スクリプトは以下の特殊文字を自動的にエスケープします：

- ダブルクォート (`"`) → `\"`
- シングルクォート (`'`) → `\'`
- バックスラッシュ (`\`) → `\\`
- 改行 (`\n`) → `\\n`
- キャリッジリターン (`\r`) → `\\r`
- タブ (`\t`) → `\\t`

### 例

```javascript
// 入力
"Orphie Magnusson & "Magus""

// 出力（エスケープ後）
"Orphie Magnusson & \"Magus\""
```

## 使用方法

### 1. エスケープ処理のテスト

```bash
node scripts/test-escape.js
```

### 2. キャラクターデータの生成

```bash
node scripts/generate-characters.js
```

このコマンドを実行すると：

1. `CHARACTER_PAGE_IDS` で定義された全キャラクターの API データを取得
2. 日本語と英語の両方のデータを処理
3. 特殊文字を自動的にエスケープ
4. `data/characters.ts` ファイルを生成

### 3. 新しいキャラクターの追加

新しいキャラクターを追加する場合：

1. `generate-characters.js` の `CHARACTER_PAGE_IDS` オブジェクトに新しいエントリを追加
2. スクリプトを再実行

```javascript
const CHARACTER_PAGE_IDS = {
  // 既存のキャラクター...
  newcharacter: 58, // 新しいキャラクターのページID
};
```

## API 仕様

### エンドポイント

```
https://sg-wiki-api-static.hoyolab.com/hoyowiki/zzz/wapi/entry_page
```

### パラメータ

- `entry_page_id`: キャラクターのページ ID
- `lang`: 言語コード (`ja-jp` または `en-us`)

## 注意事項

- API レート制限を避けるため、リクエスト間に 100ms の待機時間を設けています
- 陣営 ID のマッピングは別途 `data/factions.ts` を参照する必要があります
- エラーが発生した場合は、コンソールにログが出力されます

## トラブルシューティング

### よくある問題

1. **構文エラー**: 特殊文字が正しくエスケープされていない

   - 解決方法: `test-escape.js` でエスケープ処理を確認

2. **API エラー**: ネットワークまたはページ ID の問題

   - 解決方法: ページ ID が正しいか確認、ネットワーク接続を確認

3. **型エラー**: 生成されたデータが型定義と一致しない
   - 解決方法: `src/types.ts` の型定義を確認
