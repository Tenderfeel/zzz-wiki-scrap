# Requirements Document

## Introduction

音動機データ処理システムにおいて、該当エージェント情報から agentId が正しく取得できないバグを修正します。現在、`WeaponDataMapper.extractAgentInfo`メソッドで`agentItem`が`undefined`になる可能性があり、TypeScript エラーが発生しています。また、API レスポンスの構造変化に対応できていない可能性があります。

## Requirements

### Requirement 1

**User Story:** 開発者として、音動機データ処理時に agentId が確実に取得できるシステムが欲しい。これにより、音動機とキャラクターの関連付けが正確に行われ、データの整合性が保たれる。

#### Acceptance Criteria

1. WHEN baseInfo コンポーネントから該当エージェント情報を検索する THEN agentItem が存在しない場合でも適切にハンドリングする SHALL
2. WHEN agentItem が見つからない場合 THEN 空の agentId を返し、エラーを発生させない SHALL
3. WHEN agentItem の value プロパティにアクセスする THEN 配列形式のデータ構造に対応する SHALL
4. WHEN レアリティ S の音動機を処理する THEN 該当エージェント情報が必ず存在することを前提とした処理を行う SHALL
5. WHEN エージェント情報の抽出に失敗する THEN 詳細なデバッグ情報をログに出力する SHALL

### Requirement 2

**User Story:** 開発者として、API レスポンスの実際の構造に対応したエージェント名抽出機能が欲しい。これにより、`value`配列内の JSON 文字列から正確にエージェント情報を取得できる。

#### Acceptance Criteria

1. WHEN エージェント情報の値を解析する THEN `value`配列の最初の要素から JSON 文字列を抽出する SHALL
2. WHEN JSON 文字列を解析する THEN `$[{...}]$`形式の文字列から中身の JSON オブジェクトを取得する SHALL
3. WHEN JSON オブジェクトを処理する THEN `name`フィールドからエージェント名を抽出する SHALL
4. WHEN `ep_id`フィールドが存在する THEN エージェントのページ ID も取得する SHALL
5. WHEN JSON 解析に失敗する THEN 正規表現によるフォールバック処理を実行する SHALL
6. WHEN 抽出処理でエラーが発生する THEN 詳細なエラー情報をログに記録し、処理を継続する SHALL

### Requirement 3

**User Story:** 開発者として、エージェント名から agentId へのマッピングが確実に動作することを確認したい。これにより、音動機データに正しいキャラクター情報が関連付けられる。

#### Acceptance Criteria

1. WHEN エージェント名マッピングを実行する THEN 完全一致と部分一致の両方をサポートする SHALL
2. WHEN 新しいキャラクター（リュシアなど）が追加される THEN マッピングテーブルを容易に更新できる SHALL
3. WHEN マッピングに失敗する THEN デバッグ用の詳細情報を提供する SHALL
4. WHEN 複数の候補がある場合 THEN 最も適切なマッチを選択する SHALL
5. WHEN 未知のエージェント名が検出される THEN ログに記録して今後の対応に備える SHALL

### Requirement 4

**User Story:** 開発者として、agentId 抽出機能の動作を検証できるテストとデバッグツールが欲しい。これにより、問題の特定と修正が効率的に行える。

#### Acceptance Criteria

1. WHEN デバッグスクリプトを実行する THEN 実際の API データを使用して agentId 抽出をテストする SHALL
2. WHEN テストが失敗する THEN 失敗の原因と中間データを詳細に表示する SHALL
3. WHEN 新しいエージェントデータをテストする THEN 簡単に対象を変更できる SHALL
4. WHEN 抽出プロセスを監視する THEN 各ステップの結果を段階的に確認できる SHALL

### Requirement 5

**User Story:** 開発者として、プロジェクトの構造規約に従ったファイル配置が維持されることを確認したい。これにより、コードベースの整理された状態を保つことができる。

#### Acceptance Criteria

1. WHEN テストファイルを作成する THEN `tests`ディレクトリ内の適切なレイヤーディレクトリに配置する SHALL
2. WHEN 既存のルートディレクトリのテストファイルが存在する THEN `tests`ディレクトリの該当するレイヤーディレクトリへ移動する SHALL
3. WHEN デバッグスクリプトを作成する THEN `tests/debug`ディレクトリに配置する SHALL
4. WHEN ファイル移動を実行する THEN 既存の参照やインポートパスを適切に更新する SHALL
