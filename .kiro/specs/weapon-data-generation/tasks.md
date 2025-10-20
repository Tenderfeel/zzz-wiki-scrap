# Implementation Plan

- [x] 1. 音動機データ処理の基盤構築

  - 音動機専用の型定義とインターフェースを作成
  - 既存の ProcessingConfig を拡張して音動機処理設定を追加
  - _Requirements: 1.1, 5.1, 5.4_

- [x] 1.1 音動機型定義の実装

  - src/types/index.ts に Weapon、WeaponAttributes、WeaponEntry 型を追加
  - Attribute 型の定義を追加
  - ProcessedWeaponData、BasicWeaponInfo、WeaponSkillInfo、WeaponAttributesInfo、WeaponAgentInfo 型を定義
  - _Requirements: 1.1, 2.1, 3.2_

- [x] 1.2 ProcessingConfig 拡張の実装

  - src/config/ProcessingConfig.ts に WeaponProcessingConfig 型を追加
  - 音動機処理用の設定項目（weaponListPath、outputPath、includeRarities 等）を定義
  - デフォルト設定値を設定
  - _Requirements: 5.4_

- [x] 2. WeaponListParser の実装

  - json/mock/weapon-list.json から音動機エントリーを抽出する機能を実装
  - レア度 A と S のみをフィルタリングする機能を実装
  - _Requirements: 1.1, 1.2, 2.2_

- [x] 2.1 WeaponListParser クラスの作成

  - src/parsers/WeaponListParser.ts を作成
  - parseWeaponList()メソッドで weapon-list.json を解析
  - validateWeaponEntry()メソッドで音動機エントリーの妥当性検証
  - レア度 B の除外処理を実装
  - _Requirements: 1.1, 1.2, 2.2_

- [x] 2.2 WeaponListParser のユニットテスト

  - tests/parsers/WeaponListParser.test.ts を作成
  - weapon-list.json 解析の正確性をテスト
  - レア度フィルタリング機能をテスト
  - 無効データの処理をテスト
  - _Requirements: 1.1, 2.2_

- [ ] 3. WeaponDataMapper の実装

  - API 応答から音動機データを抽出・変換する機能を実装
  - 基礎・上級ステータスの「基礎」除去ロジックを実装
  - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6_

- [x] 3.1 WeaponDataMapper クラスの作成

  - src/mappers/WeaponDataMapper.ts を作成
  - DataMapper クラスを継承
  - extractBasicWeaponInfo()メソッドで基本情報を抽出
  - _Requirements: 2.1, 5.2_

- [x] 3.2 スキル情報抽出機能の実装

  - extractWeaponSkillInfo()メソッドで equipment_skill コンポーネントからスキル情報を抽出
  - skill_name と skill_desc を多言語で取得
  - HTML タグの除去とテキストクリーニング機能を実装
  - _Requirements: 2.3_

- [x] 3.3 突破ステータス抽出機能の実装

  - extractWeaponAttributes()メソッドで ascension コンポーネントから突破ステータスを抽出
  - 7 レベル分の「後」の値（配列インデックス 1）のみを取得
  - 該当データがない場合は空配列を返す処理を実装
  - _Requirements: 2.4_

- [x] 3.4 エージェント情報抽出機能の実装

  - extractAgentInfo()メソッドで baseInfo から該当エージェント情報を抽出
  - ep_id から agentId を取得
  - エージェント情報が存在しない場合の処理を実装
  - _Requirements: 2.5_

- [x] 3.5 基礎・上級ステータス判定機能の実装

  - extractBaseAndAdvancedAttributes()メソッドで基礎・上級ステータス属性を判定
  - 「基礎」が付く項目から「基礎」を除いた属性名を抽出（例：基礎攻撃力 →atk）
  - 該当データがない場合のデフォルト値処理を実装
  - _Requirements: 2.6_

- [x] 3.6 WeaponDataMapper のユニットテスト

  - tests/mappers/WeaponDataMapper.test.ts を作成
  - API 応答からのデータ抽出をテスト
  - 日本語 → 英語マッピングをテスト
  - 突破データの「後」値抽出をテスト
  - 基礎ステータスの「基礎」除去ロジックをテスト
  - _Requirements: 2.1, 2.3, 2.4, 2.6_

- [x] 4. WeaponDataProcessor の実装

  - 音動機データの変換とビジネスロジック処理を実装
  - グレースフル劣化とエラー回復機能を実装
  - _Requirements: 1.3, 1.4, 1.5, 4.1, 4.2, 4.3_

- [x] 4.1 WeaponDataProcessor クラスの作成

  - src/processors/WeaponDataProcessor.ts を作成
  - DataProcessor クラスを継承
  - processWeaponData()メソッドで WeaponEntry から ProcessedWeaponData への変換
  - 既存の HoyoLabApiClient を使用した API データ取得
  - _Requirements: 1.3, 1.4, 5.2_

- [x] 4.2 音動機データ検証機能の実装

  - validateWeaponData()メソッドで ProcessedWeaponData の妥当性検証
  - 必須フィールドの存在確認と型チェック
  - レア度チェックの統合
  - _Requirements: 4.2_

- [x] 4.3 グレースフル劣化機能の実装

  - attemptGracefulDegradation()メソッドでエラー時のフォールバック処理
  - 最小限の音動機データを作成
  - 部分的失敗でも処理を継続する機能
  - _Requirements: 4.3_

- [x] 4.4 WeaponDataProcessor のユニットテスト

  - tests/processors/WeaponDataProcessor.test.ts を作成
  - 音動機データ処理の正確性をテスト
  - データ検証機能をテスト
  - グレースフル劣化機能をテスト
  - _Requirements: 1.3, 4.2, 4.3_

- [x] 5. WeaponGenerator の実装

  - ProcessedWeaponData から Weapon オブジェクトへの変換機能を実装
  - data/weapons.ts ファイルの生成機能を実装
  - _Requirements: 3.1, 3.2, 4.4_

- [x] 5.1 WeaponGenerator クラスの作成

  - src/generators/WeaponGenerator.ts を作成
  - generateWeapon()メソッドで ProcessedWeaponData から Weapon オブジェクトへの変換
  - 多言語データの統合と名前フォールバック処理
  - _Requirements: 3.1_

- [x] 5.2 音動機オブジェクト検証機能の実装

  - validateWeapon()メソッドで生成された Weapon オブジェクトの完全性チェック
  - 必須フィールドと配列長の検証
  - 列挙値の妥当性確認
  - _Requirements: 4.4_

- [x] 5.3 TypeScript ファイル出力機能の実装

  - outputWeaponFile()メソッドで data/weapons.ts ファイルの生成
  - 適切な import 文と型注釈を含むファイル構造
  - 音動機配列の整形された TypeScript コード出力
  - _Requirements: 3.1, 3.2_

- [x] 5.4 WeaponGenerator のユニットテスト

  - tests/generators/WeaponGenerator.test.ts を作成
  - Weapon オブジェクト生成をテスト
  - TypeScript ファイル出力をテスト
  - データ検証機能をテスト
  - _Requirements: 3.1, 4.4_

- [x] 6. メイン処理パイプラインの実装

  - 音動機データ処理の全体的なオーケストレーション機能を実装
  - 進捗監視とレポート生成機能を実装
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 6.1 音動機データ処理パイプラインの作成

  - src/main-weapon-generation.ts を作成
  - WeaponListParser、WeaponDataProcessor、WeaponGenerator を統合
  - バッチ処理と API レート制限対応を実装
  - _Requirements: 1.5, 4.1_

- [x] 6.2 進捗監視機能の実装

  - リアルタイム進捗表示機能を実装
  - 処理速度とメモリ使用量の監視
  - 既存の EnhancedProgressTracker を活用
  - _Requirements: 4.1_

- [x] 6.3 レポート生成機能の実装

  - 成功・失敗の統計情報を含むレポートを生成
  - 詳細なエラー情報と部分的に取得できたデータを記録
  - 処理結果の要約とパフォーマンス指標を出力
  - _Requirements: 4.2, 4.3_

- [x] 6.4 統合テストの実装

  - tests/integration/WeaponDataGeneration.integration.test.ts を作成
  - エンドツーエンドデータ処理をテスト
  - 実際の API 応答を使用したテスト
  - エラーシナリオのテスト
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 7. 設定とドキュメントの整備

  - 音動機処理用の設定ファイルとドキュメントを作成
  - 既存システムとの統合を完了
  - _Requirements: 5.3, 5.4_

- [x] 7.1 設定ファイルの作成

  - weapon-processing-config.json を作成
  - WeaponProcessingConfig 型に基づく設定項目を定義
  - 環境別設定のサポートを実装
  - _Requirements: 5.4_

- [x] 7.2 型定義ファイルの更新

  - src/types/index.ts の export を更新
  - 音動機関連の型をすべてエクスポート
  - 既存の型定義との整合性を確認
  - _Requirements: 3.2, 5.1_

- [x] 7.3 インデックスファイルの更新

  - src/generators/index.ts、src/processors/index.ts、src/mappers/index.ts、src/parsers/index.ts を更新
  - 新しい音動機関連クラスをエクスポート
  - 既存のエクスポート構造との一貫性を保持
  - _Requirements: 5.1_

- [x] 7.4 使用方法ドキュメントの作成
  - docs/WEAPON_GENERATION.md を作成
  - 音動機データ生成機能の使用方法を説明
  - 設定オプションとトラブルシューティングガイドを含める
  - _Requirements: 5.3_
