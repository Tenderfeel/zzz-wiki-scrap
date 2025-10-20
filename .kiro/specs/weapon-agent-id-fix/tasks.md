# Implementation Plan

- [x] 1. テストファイルの適切な配置への移動

  - ルートディレクトリにある既存のテストファイルを適切なディレクトリに移動
  - インポートパスとファイル参照を更新
  - _Requirements: 5.1, 5.2, 5.4_

- [x] 1.1 既存テストファイルの移動

  - `test-agent-debug.ts`を`tests/debug/agent-extraction-debug.ts`に移動
  - `test-agent-extraction.js`を`tests/debug/agent-extraction-legacy.js`に移動
  - `test-weapon-mapper.ts`を`tests/mappers/WeaponDataMapper.debug.ts`に移動
  - _Requirements: 5.2_

- [x] 1.2 移動したファイルのインポートパス修正

  - 相対パスを新しいディレクトリ構造に合わせて更新
  - TypeScript コンパイルエラーがないことを確認
  - _Requirements: 5.4_

- [x] 2. AgentMapping.ts の拡張

  - 新しいキャラクター（リュシアなど）のマッピングを追加
  - マッピング関数の改善
  - _Requirements: 3.2, 3.5_

- [x] 2.1 AGENT_NAME_TO_ID_MAP の拡張

  - リュシア（Lucia）のマッピングエントリを追加
  - 日本語名と英語名の両方をサポート
  - 将来の拡張に備えたコメント追加
  - _Requirements: 3.2_

- [x] 2.2 getAgentIdByName 関数の改善

  - より厳密な部分一致条件を実装
  - 完全一致を優先する処理を追加
  - デバッグ情報の出力を強化
  - _Requirements: 3.1, 3.3, 3.4_

- [x] 3. WeaponDataMapper.extractAgentInfo()の修正

  - TypeScript エラーの修正（agentItem undefined 対応）
  - 実際の API レスポンス構造（value 配列）への対応
  - 堅牢なエラーハンドリングの実装
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [x] 3.1 extractAgentInfo()メソッドの基本修正

  - agentItem の null 安全性チェックを追加
  - value 配列の存在確認と型チェックを実装
  - 適切なログ出力を各段階で追加
  - _Requirements: 1.1, 1.2, 1.5_

- [x] 3.2 プライベートヘルパーメソッドの追加

  - extractAgentNameFromValue()メソッドを実装
  - fallbackNameExtraction()メソッドを実装
  - JSON 解析とフォールバック処理の分離
  - _Requirements: 2.1, 2.2, 2.5, 2.6_

- [x] 3.3 エラーハンドリングの強化

  - 段階的エラーハンドリングの実装
  - 詳細なデバッグ情報の出力
  - 未知のエージェント名の警告ログ追加
  - _Requirements: 1.5, 2.6, 3.5_

- [x] 4. デバッグツールの作成

  - 新しいデバッグスクリプトの実装
  - 実際の API データを使用したテスト機能
  - 段階的な抽出プロセスの監視機能
  - _Requirements: 4.1, 4.2, 4.4_

- [x] 4.1 AgentExtractionDebugger クラスの実装

  - tests/debug/agent-extraction-debug.ts に新しいデバッガークラスを作成
  - testSpecificWeapon()メソッドで単一武器のテスト
  - testMultipleWeapons()メソッドで複数武器の一括テスト
  - _Requirements: 4.1, 4.3_

- [x] 4.2 デバッグ情報の構造化

  - AgentExtractionDebugInfo 型の定義
  - 各ステップの成功/失敗状態の記録
  - 中間データの保存と表示機能
  - _Requirements: 4.2, 4.4_

- [x] 5. 単体テストの強化

  - WeaponDataMapper.test.ts の拡張
  - 新しい修正内容に対応したテストケース追加
  - エラーケースとエッジケースのテスト
  - _Requirements: 1.1, 2.1, 3.1, 4.2_

- [x] 5.1 extractAgentInfo()のテストケース追加

  - agentItem が存在しない場合のテスト
  - value 配列が空の場合のテスト
  - JSON 解析失敗時のフォールバック処理テスト
  - 新キャラクター（リュシア）のテスト
  - _Requirements: 1.1, 1.2, 2.1, 3.2_

- [x] 5.2 AgentMapping のテストケース追加

  - 新しいマッピングエントリのテスト
  - 改善された getAgentIdByName()のテスト
  - 部分一致ロジックのテスト
  - _Requirements: 3.1, 3.4_

- [x] 6. 統合テストの実装

  - エンドツーエンドの agentId 抽出テスト
  - 実際の API レスポンスを使用したテスト
  - レアリティ S 武器の全件テスト
  - _Requirements: 1.4, 2.3, 4.1_

- [x] 6.1 AgentIdExtraction 統合テストの作成

  - tests/integration/AgentIdExtraction.integration.test.ts を作成
  - レアリティ S 武器での agentId 抽出テスト
  - API レスポンス形式の変化に対する耐性テスト
  - _Requirements: 1.4, 2.3_

- [x] 7. 修正内容の検証とドキュメント更新

  - 修正されたコードの動作確認
  - 既存機能への影響がないことの確認
  - 必要に応じてドキュメントの更新
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 7.1 修正内容の動作確認

  - 実際の音動機データで agentId 抽出をテスト
  - エラーが修正されていることの確認
  - パフォーマンスへの影響がないことの確認
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 7.2 既存機能への影響確認
  - 他の音動機データ処理機能が正常に動作することを確認
  - WeaponDataMapper の他のメソッドへの影響がないことを確認
  - 既存のテストが全て通ることを確認
  - _Requirements: 1.4, 1.5_
