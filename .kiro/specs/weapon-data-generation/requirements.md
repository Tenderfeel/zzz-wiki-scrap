# Requirements Document

## Introduction

ZZZ キャラクターデータ処理システムに音動機（武器）データリストを生成する機能を追加します。この機能は、HoyoLab API から音動機の詳細情報を取得し、型安全な TypeScript ファイルとして出力することで、既存のキャラクターデータ処理システムと統合された包括的なゲームデータ管理システムを構築します。

## Requirements

### Requirement 1

**User Story:** 開発者として、音動機データを自動的に取得・処理できるシステムが欲しい。これにより、手動でのデータ入力作業を削減し、データの一貫性を保つことができる。

#### Acceptance Criteria

1. WHEN システムが音動機データ処理を開始する THEN `json/mock/weapon-list.json`から音動機リストを読み込む SHALL
2. WHEN weapon-list.json を解析する THEN 各音動機の entry_page_id と name を抽出する SHALL
3. WHEN API リクエストを送信する THEN 日本語（ja-jp）を優先し、失敗時は英語（en-us）にフォールバックする SHALL
4. WHEN 音動機データを処理する THEN 抽出した entry_page_id を使用して HoyoLab API から詳細データを取得する SHALL
5. WHEN API レート制限に遭遇する THEN 適切な遅延を実装してリクエストを継続する SHALL

### Requirement 2

**User Story:** 開発者として、音動機の基本情報と詳細ステータスを構造化されたデータとして取得したい。これにより、アプリケーションで音動機情報を効率的に利用できる。

#### Acceptance Criteria

1. WHEN 音動機の基本情報を抽出する THEN id、name、rarity、specialty を正確に取得する SHALL
2. WHEN 音動機のレア度を判定する THEN レア度 A と S のみを処理対象とし、レア度 B は除外する SHALL
3. WHEN 音動機のスキル情報を抽出する THEN equipmentSkillName と equipmentSkillDesc を多言語で取得する SHALL
4. WHEN 音動機の突破ステータスを処理する THEN 7 レベル分の「後」の値（配列インデックス 1）を数値配列として格納する SHALL
5. WHEN 該当エージェント情報を抽出する THEN baseInfo コンポーネントから agentId を取得する SHALL
6. WHEN 基礎・上級ステータスを識別する THEN baseInfo から適切な属性タイプを判定する SHALL

### Requirement 3

**User Story:** 開発者として、音動機データが既存のプロジェクト構造と一貫性を保って出力されることを確認したい。これにより、既存のコードベースとの統合が容易になる。

#### Acceptance Criteria

1. WHEN 音動機データを出力する THEN `data/weapons.ts`ファイルとして生成する SHALL
2. WHEN TypeScript 型定義を使用する THEN 既存の Weapon 型に準拠したデータ構造を維持する SHALL
3. WHEN 日本語 → 英語マッピングを適用する THEN specialty、stats、rarity の値を正しく変換する SHALL
4. WHEN エラーハンドリングを実装する THEN 部分的失敗でも処理を継続し、詳細なログを出力する SHALL

### Requirement 4

**User Story:** 開発者として、音動機データ処理の進捗と結果を監視できるシステムが欲しい。これにより、処理の状況を把握し、問題が発生した場合に迅速に対応できる。

#### Acceptance Criteria

1. WHEN データ処理を実行する THEN 進捗状況をリアルタイムで表示する SHALL
2. WHEN 処理が完了する THEN 成功・失敗の統計情報を含むレポートを生成する SHALL
3. WHEN エラーが発生する THEN 詳細なエラー情報と部分的に取得できたデータを記録する SHALL
4. WHEN 設定可能な処理オプションを提供する THEN バッチサイズ、遅延時間、リトライ回数を調整可能にする SHALL

### Requirement 5

**User Story:** 開発者として、音動機データ処理機能が既存のプロジェクトアーキテクチャに適合することを確認したい。これにより、コードの保守性と拡張性を維持できる。

#### Acceptance Criteria

1. WHEN 新しいコンポーネントを実装する THEN 既存のレイヤー構造（clients/parsers/mappers/processors/generators）に従う SHALL
2. WHEN 音動機専用のクラスを作成する THEN WeaponGenerator、WeaponDataProcessor、WeaponDataMapper を実装する SHALL
3. WHEN 共通ユーティリティを活用する THEN 既存の Logger、ErrorRecoveryHandler、SecurityValidator を使用する SHALL
4. WHEN 設定管理を統合する THEN 既存の ProcessingConfig システムを拡張して音動機処理設定を追加する SHALL
