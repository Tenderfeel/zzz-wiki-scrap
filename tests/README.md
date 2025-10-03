# テスト仕様書

## 概要

このプロジェクトでは、各コンポーネントの機能を検証するための包括的な単体テストを実装しています。テストは Vitest フレームワークを使用して作成されており、モックデータを活用して各コンポーネントの動作を検証しています。

## テスト構成

### テストファイル構造

```
tests/
├── clients/
│   └── HoyoLabApiClient.test.ts    # API クライアントのテスト
├── errors/
│   └── index.test.ts               # エラークラスのテスト
├── generators/
│   └── CharacterGenerator.test.ts  # キャラクタージェネレーターのテスト
├── loaders/
│   └── FileLoader.test.ts          # ファイルローダーのテスト
├── mappers/
│   └── DataMapper.test.ts          # データマッパーのテスト
├── processors/
│   ├── AttributesProcessor.test.ts # 属性プロセッサーのテスト
│   └── DataProcessor.test.ts       # データプロセッサーのテスト
└── setup.ts                        # テスト用セットアップファイル
```

## テスト実行方法

### 基本的なテスト実行

```bash
# 全テストを実行
npm test

# テストをウォッチモードで実行
npm run test:watch

# テストUIを起動
npm run test:ui

# カバレッジレポート付きでテスト実行
npm run test:coverage
```

## テスト内容

### 1. FileLoader テスト

**ファイル**: `tests/loaders/FileLoader.test.ts`

- 正常な JSON ファイルの読み込み
- 存在しないファイルのエラーハンドリング
- 空ファイルのエラーハンドリング
- 不正な JSON のエラーハンドリング
- API レスポンス構造の検証

**カバレッジ**: 61.11%

### 2. DataMapper テスト

**ファイル**: `tests/mappers/DataMapper.test.ts`

- 特性マッピング（撃破 → stun など）
- 属性マッピング（氷属性 → ice など）
- 攻撃タイプマッピング（打撃 → strike など）
- レア度マッピング（S → S など）
- 多言語名オブジェクト生成
- 未知の値に対するエラーハンドリング

**カバレッジ**: 100%

### 3. AttributesProcessor テスト

**ファイル**: `tests/processors/AttributesProcessor.test.ts`

- 昇格データの正常処理
- レベル別ステータス配列の生成（HP、ATK、DEF）
- 固定ステータス値の抽出（impact、critRate など）
- パーセンテージ値の処理（%記号除去）
- "-"値のデフォルト値変換
- 不正データのエラーハンドリング

**カバレッジ**: 75%

### 4. DataProcessor テスト

**ファイル**: `tests/processors/DataProcessor.test.ts`

- 基本キャラクター情報の抽出
- 陣営情報の抽出と ID 解決
- 属性データの抽出
- API レスポンス構造の検証
- 不正データのエラーハンドリング

**カバレッジ**: 80%

### 5. CharacterGenerator テスト

**ファイル**: `tests/generators/CharacterGenerator.test.ts`

- Character オブジェクトの生成
- データ検証機能（必須フィールド、配列長、列挙値）
- ファイル出力機能
- 多言語オブジェクトの完全性確認
- 不正データのエラーハンドリング

**カバレッジ**: 80.85%

### 6. HoyoLabApiClient テスト

**ファイル**: `tests/clients/HoyoLabApiClient.test.ts`

- 正常な API レスポンスの取得
- HTTP エラーのハンドリング
- ネットワークエラーのハンドリング
- タイムアウトのハンドリング
- 多言語データの並行取得
- API レスポンスの検証

**カバレッジ**: 91.15%

### 7. エラークラス テスト

**ファイル**: `tests/errors/index.test.ts`

- ApiError、ParsingError、MappingError、ValidationError の作成
- エラーメッセージとタイプの検証
- 元のエラーオブジェクトの保持
- エラー継承の確認

**カバレッジ**: 100%

## テスト結果

### 最新のテスト実行結果

```
Test Files  7 passed (7)
Tests      75 passed (75)
Duration   633ms
```

### カバレッジサマリー

| コンポーネント      | ステートメント | ブランチ | 関数 | 行     |
| ------------------- | -------------- | -------- | ---- | ------ |
| HoyoLabApiClient    | 91.15%         | 67.64%   | 100% | 91.15% |
| DataMapper          | 100%           | 100%     | 100% | 100%   |
| CharacterGenerator  | 80.85%         | 58.49%   | 100% | 80.85% |
| DataProcessor       | 80%            | 76.92%   | 100% | 80%    |
| AttributesProcessor | 75%            | 72.3%    | 100% | 75%    |
| FileLoader          | 61.11%         | 70.83%   | 100% | 61.11% |
| エラークラス        | 100%           | 100%     | 100% | 100%   |

## モックデータ

テストでは以下のモックデータを使用しています：

- **API レスポンス**: 実際の HoyoLab API レスポンス構造を模倣
- **キャラクターデータ**: ライカンの実際のステータス値を使用
- **陣営データ**: data/factions.ts の実際のデータを使用
- **昇格データ**: 7 レベル分の完全なステータス配列

## テストの特徴

1. **包括的なエラーハンドリング**: 各コンポーネントで想定されるエラーケースを網羅
2. **実データに基づくテスト**: 実際の API レスポンス構造とデータを使用
3. **モック活用**: fs モジュールや fetch API を適切にモック化
4. **型安全性**: TypeScript の型システムを活用した堅牢なテスト
5. **要件トレーサビリティ**: 各テストが対応する要件を明確化

## 継続的改善

- 新機能追加時は対応するテストも追加
- カバレッジ 80%以上を維持
- エラーケースの網羅性を継続的に向上
- パフォーマンステストの追加検討

## 統合テスト

### 8. 統合テスト

**ファイル**: `tests/integration/LycanDataGenerator.integration.test.ts`

- エンドツーエンドのデータ処理テスト
- 実際の lycaon.json ファイルを使用したテスト
- 全要件の統合検証
- エラーハンドリングの統合テスト
- パフォーマンステスト
- ファイル操作の統合テスト

**カバレッジ**: 100%（10 テスト全て成功）

### 統合テスト内容

#### エンドツーエンドデータ処理

1. **lycaon.json から完全な Character オブジェクトを生成できる**

   - 実際の lycaon.json ファイルを使用
   - 完全なデータ処理フローの検証
   - TypeScript 形式での出力確認

2. **生成された Character オブジェクトが正しい構造を持つ**

   - 全必須フィールドの存在確認
   - 多言語オブジェクトの構造検証
   - 属性オブジェクトの完全性確認
   - 配列の長さ検証（HP、ATK、DEF 配列が 7 要素）

3. **ライカンの具体的なデータ値が正しく抽出される**
   - ライカンの基本情報検証（id: "lycaon", specialty: "stun"等）
   - 実際のステータス値の検証
   - 陣営 ID（ヴィクトリア家政 = 2）の確認

#### エラーハンドリング統合テスト

4. **存在しないファイルに対して適切なエラーを発生させる**
5. **無効な入力パラメータに対して適切なエラーを発生させる**
6. **不正な JSON ファイルに対して適切なエラーを発生させる**

#### データ整合性検証

7. **生成されたデータが全要件を満たす**
   - 要件 1-6 の全項目を統合的に検証
   - 型安全性の確認
   - データ完全性の検証

#### パフォーマンステスト

8. **処理が合理的な時間内に完了する**
   - 5 秒以内での処理完了を確認

#### ファイル操作統合テスト

9. **異なる出力パスでファイルを生成できる**
10. **既存ファイルを上書きできる**

### 統合テスト実行結果

```
✓ tests/integration/LycanDataGenerator.integration.test.ts (10 tests) 23ms
  ✓ LycanDataGenerator Integration Tests > エンドツーエンドデータ処理 > lycaon.jsonから完全なCharacterオブジェクトを生成できる 6ms
  ✓ LycanDataGenerator Integration Tests > エンドツーエンドデータ処理 > 生成されたCharacterオブジェクトが正しい構造を持つ 2ms
  ✓ LycanDataGenerator Integration Tests > エンドツーエンドデータ処理 > ライカンの具体的なデータ値が正しく抽出される 2ms
  ✓ LycanDataGenerator Integration Tests > エラーハンドリング統合テスト > 存在しないファイルに対して適切なエラーを発生させる 4ms
  ✓ LycanDataGenerator Integration Tests > エラーハンドリング統合テスト > 無効な入力パラメータに対して適切なエラーを発生させる 0ms
  ✓ LycanDataGenerator Integration Tests > エラーハンドリング統合テスト > 不正なJSONファイルに対して適切なエラーを発生させる 1ms
  ✓ LycanDataGenerator Integration Tests > データ整合性検証 > 生成されたデータが全要件を満たす 3ms
  ✓ LycanDataGenerator Integration Tests > パフォーマンステスト > 処理が合理的な時間内に完了する 1ms
  ✓ LycanDataGenerator Integration Tests > ファイル操作統合テスト > 異なる出力パスでファイルを生成できる 2ms
  ✓ LycanDataGenerator Integration Tests > ファイル操作統合テスト > 既存ファイルを上書きできる 1ms

Test Files  1 passed (1)
Tests  10 passed (10)
```

### 統合テストの特徴

1. **実データ使用**: 実際の lycaon.json ファイルを使用した現実的なテスト
2. **全要件カバー**: 要件定義書の全項目を統合的に検証
3. **エラーシナリオ**: 様々なエラーケースを網羅
4. **パフォーマンス**: 処理時間の妥当性を確認
5. **ファイル操作**: 実際のファイル入出力を検証
6. **型安全性**: TypeScript 型システムとの整合性確認

## 全体テスト結果サマリー

### 単体テスト + 統合テスト

```
Test Files  8 passed (8)
Tests  85 passed (85)
```

### 総合カバレッジ

| テストタイプ | ファイル数 | テスト数 | 成功率   |
| ------------ | ---------- | -------- | -------- |
| 単体テスト   | 7          | 75       | 100%     |
| 統合テスト   | 1          | 10       | 100%     |
| **合計**     | **8**      | **85**   | **100%** |
