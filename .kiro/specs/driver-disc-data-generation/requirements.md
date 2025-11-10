# 要件定義書

## 概要

ZZZ キャラクターデータ処理システムにドライバーディスク（driverDisc）データリストを生成する機能を追加します。この機能は、HoyoLab API からドライバーディスクの詳細情報を取得し、型安全な TypeScript ファイルとして出力することで、既存のキャラクター、ボンプ、音動機データ処理システムと統合された包括的なゲームデータ管理システムを構築します。

## 用語集

- **DriverDisc_System**: ドライバーディスクデータ処理システム
- **HoyoLab_API**: HoyoLab Wiki API エンドポイント
- **DiscList_File**: json/data/disc-list.json ファイル（データソース）
- **TypeScript_Output**: 生成される TypeScript データファイル

## 要件

### 要件 1

**ユーザーストーリー:** 開発者として、ドライバーディスクデータを自動的に取得・処理できるシステムが欲しい。これにより、手動でのデータ入力作業を削減し、データの一貫性を保つことができる。

#### 受入基準

1. WHEN DriverDisc_System がドライバーディスクデータ処理を開始する THEN `json/data/disc-list.json`からドライバーディスクリストを読み込む SHALL
2. WHEN disc-list.json を解析する THEN 各ドライバーディスクの entry_page_id と name を抽出する SHALL
3. WHEN HoyoLab_API リクエストを送信する THEN 日本語（ja-jp）を優先し、失敗時は英語（en-us）にフォールバックする SHALL
4. WHEN ドライバーディスクデータを処理する THEN 抽出した entry_page_id を使用して HoyoLab_API から詳細データを取得する SHALL
5. WHEN API レート制限に遭遇する THEN 適切な遅延を実装してリクエストを継続する SHALL

### 要件 2

**ユーザーストーリー:** 開発者として、ドライバーディスクの基本情報とセット効果を構造化されたデータとして取得したい。これにより、アプリケーションでドライバーディスク情報を効率的に利用できる。

#### 受入基準

1. WHEN ドライバーディスクの基本情報を抽出する THEN id、name、releaseVersion を正確に取得する SHALL
2. WHEN ドライバーディスクのセット効果を抽出する THEN fourSetEffect と twoSetEffect の説明を多言語で取得する SHALL
3. WHEN ドライバーディスクの特性を判定する THEN 4 セット効果の説明から specialty を抽出する SHALL
4. WHEN 多言語データを処理する THEN 日本語（ja-jp）と英語（en-us）両方の name、fourSetEffect、twoSetEffect を取得する SHALL
5. WHEN API データを解析する THEN HoyoLab_API レスポンスから適切なコンポーネントデータを抽出する SHALL

### 要件 3

**ユーザーストーリー:** 開発者として、ドライバーディスクデータが既存のプロジェクト構造と一貫性を保って出力されることを確認したい。これにより、既存のコードベースとの統合が容易になる。

#### 受入基準

1. WHEN ドライバーディスクデータを出力する THEN `data/driverDiscs.ts`ファイルとして生成する SHALL
2. WHEN TypeScript 型定義を使用する THEN Scraping.md で定義された DriverDisc 型に準拠したデータ構造を維持する SHALL
3. WHEN 日本語 → 英語マッピングを適用する THEN specialty の値を正しく変換する SHALL
4. WHEN エラーハンドリングを実装する THEN 部分的失敗でも処理を継続し、詳細なログを出力する SHALL

### 要件 4

**ユーザーストーリー:** 開発者として、ドライバーディスクデータ処理の進捗と結果を監視できるシステムが欲しい。これにより、処理の状況を把握し、問題が発生した場合に迅速に対応できる。

#### 受入基準

1. WHEN データ処理を実行する THEN 進捗状況をリアルタイムで表示する SHALL
2. WHEN 処理が完了する THEN 成功・失敗の統計情報を含むレポートを生成する SHALL
3. WHEN エラーが発生する THEN 詳細なエラー情報と部分的に取得できたデータを記録する SHALL
4. WHEN 設定可能な処理オプションを提供する THEN バッチサイズ、遅延時間、リトライ回数を調整可能にする SHALL

### 要件 5

**ユーザーストーリー:** 開発者として、ドライバーディスクデータ処理機能が既存のプロジェクトアーキテクチャに適合することを確認したい。これにより、コードの保守性と拡張性を維持できる。

#### 受入基準

1. WHEN 新しいコンポーネントを実装する THEN 既存のレイヤー構造（clients/parsers/mappers/processors/generators）に従う SHALL
2. WHEN ドライバーディスク専用のクラスを作成する THEN DriverDiscGenerator、DriverDiscDataProcessor、DriverDiscDataMapper を実装する SHALL
3. WHEN 共通ユーティリティを活用する THEN 既存の Logger、ErrorRecoveryHandler、SecurityValidator を使用する SHALL
4. WHEN 設定管理を統合する THEN 既存の ProcessingConfig システムを拡張してドライバーディスク処理設定を追加する SHALL
5. WHEN データ型定義を拡張する THEN Scraping.md で定義された DriverDisc 型を src/types/index.ts に統合する SHALL
