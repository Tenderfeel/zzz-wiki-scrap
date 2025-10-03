# 技術スタック

## プロジェクトタイプ

ZZZ wiki キャラクター情報のデータスクレイピング/API 統合プロジェクト

## API 統合

- **主要 API**: HoyoLab Wiki API
- **ベース URL**: `https://sg-wiki-api-static.hoyolab.com/hoyowiki/zzz/wapi/entry_page`
- **パラメータ**:
  - `entry_page_id`: キャラクターページ ID
  - `lang`: 言語コード（日本語は`ja-jp`、英語は`en-us`）

## 言語サポート

- 日本語（`ja-jp`）
- 英語（`en-us`）

## データ形式

- 入力: API エンドポイントからの JSON レスポンス
- キャラクターデータは固有のページ ID（2-902 の範囲）で整理

## 共通操作

これは主にデータ抽出プロジェクトのため、共通操作には以下が含まれます：

- キャラクターデータを取得するための API リクエスト
- JSON の解析とデータ変換
- 多言語データの処理
- キャラクター ID マッピングと管理
