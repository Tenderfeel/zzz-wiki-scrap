# Bomp Integration Test Suite

## 概要

このディレクトリには、ボンプデータ生成システムの統合テストスイートが含まれています。これらのテストは、エンドツーエンド処理、API 統合、パフォーマンス、メモリ使用量を包括的に検証します。

## テストファイル

### 1. BompIntegrationFinal.test.ts

**メインの統合テストスイート** - 要件 4.1, 4.3 を満たす完全な統合テスト

#### テストカテゴリ

##### End-to-End Processing

- **単一ボンプの完全パイプライン処理**: Scraping.md → API 取得 → データ変換 → TypeScript 出力
- **複数ボンプのバッチ処理**: バッチサイズを考慮した効率的な処理
- **データ整合性の維持**: 処理パイプライン全体でのデータ品質保証

##### API Integration

- **API レート制限の適切な処理**: リクエスト間遅延の実装確認
- **API エラーとリトライロジック**: 失敗時の自動リトライ機能
- **不正形式 API レスポンスの処理**: エラー耐性とグレースフル劣化

##### Performance and Memory

- **処理時間制限の遵守**: 大量データ処理での性能要件
- **メモリ使用量の監視**: メモリリークの防止と効率的な使用
- **パフォーマンスメトリクスの生成**: 詳細な性能レポート作成

##### Configuration

- **設定ファイルの読み込み**: デフォルト設定とカスタム設定の処理
- **エラーシナリオの処理**: 部分的失敗での継続処理

##### Component Integration

- **全処理コンポーネントの統合**: Parser → Processor → Generator の連携
- **生成ボンプオブジェクトの検証**: 型安全性とデータ構造の確認

### 2. BompDebug.test.ts

**デバッグ用テストスイート** - 個別コンポーネントの動作確認

- Scraping.md ファイルの解析テスト
- 単一ボンプ処理の詳細ログ出力
- 個別コンポーネントの動作確認

### 3. 既存の統合テストファイル

- `BompDataGeneration.integration.test.ts`: 基本的なデータ生成テスト
- `BompSystemIntegration.test.ts`: システム全体の統合テスト
- `BompPerformance.integration.test.ts`: パフォーマンス専用テスト

## パフォーマンス監視

### メトリクス収集

各テストは以下のパフォーマンスメトリクスを収集します：

- **処理時間**: テスト開始から終了までの時間
- **メモリ使用量**: ヒープ使用量と RSS 使用量の変化
- **処理されたボンプ数**: 成功・失敗の詳細
- **API 呼び出し回数**: レート制限対応の確認
- **スループット**: 秒あたりの処理ボンプ数
- **メモリ効率**: ボンプあたりのメモリ使用量

### レポート生成

パフォーマンスデータは以下のファイルに保存されます：

- `final-performance.json`: 詳細なパフォーマンスメトリクス
- `detailed-performance-report.json`: 包括的な性能レポート

## テスト実行

### 全統合テストの実行

```bash
npm test tests/integration/
```

### 特定のテストスイートの実行

```bash
# メインの統合テストスイート
npm test tests/integration/BompIntegrationFinal.test.ts

# デバッグテスト
npm test tests/integration/BompDebug.test.ts
```

### 個別テストの実行

```bash
# 特定のテストカテゴリ
npm test tests/integration/BompIntegrationFinal.test.ts -t "End-to-End Processing"

# 特定のテストケース
npm test tests/integration/BompIntegrationFinal.test.ts -t "should process single bomp"
```

## モックとテストデータ

### API レスポンスのモック

テストでは実際の HoyoLab API を呼び出さず、以下の構造でモックレスポンスを使用：

```typescript
{
  retcode: 0,
  message: "OK",
  data: {
    page: {
      id: "912",
      name: "テストボンプ",
      agent_specialties: { values: [] },
      agent_stats: { values: ["氷属性"] },
      agent_rarity: { values: [] },
      agent_faction: { values: [] },
      modules: [
        // ascension, baseInfo, talent コンポーネント
      ]
    }
  }
}
```

### テスト用 Scraping.md ファイル

各テストで動的に生成される標準化された Scraping.md ファイル：

```markdown
# Test Scraping.md

## ボンプページリスト

- [test-bomp-1](https://wiki.hoyolab.com/pc/zzz/entry/912) - テストボンプ 1
- [test-bomp-2](https://wiki.hoyolab.com/pc/zzz/entry/913) - テストボンプ 2

## その他のセクション

テスト用のコンテンツ...
```

## エラーハンドリングテスト

### テスト対象のエラーシナリオ

- **API エラー**: レート制限、ネットワーク障害
- **データ形式エラー**: 不正な JSON、欠損フィールド
- **ファイルシステムエラー**: 読み込み・書き込み失敗
- **設定エラー**: 不正な設定ファイル

### グレースフル劣化の確認

- 部分的失敗での処理継続
- 適切なエラーメッセージの生成
- フォールバック値の使用

## 品質保証

### カバレッジ要件

統合テストは以下の要件を満たします：

- **機能カバレッジ**: 全主要機能の動作確認
- **エラーカバレッジ**: 想定されるエラーシナリオの網羅
- **パフォーマンスカバレッジ**: 性能要件の検証
- **統合カバレッジ**: コンポーネント間の連携確認

### 成功基準

- 全テストケースの合格
- パフォーマンス要件の達成
- メモリ使用量の制限内維持
- エラー処理の適切な動作

## 継続的改善

### メトリクス監視

- 処理時間の傾向分析
- メモリ使用量の最適化
- API 呼び出し効率の改善

### テスト拡張

- 新機能追加時のテストケース追加
- エッジケースの発見と対応
- パフォーマンス要件の更新

## トラブルシューティング

### よくある問題

1. **テストタイムアウト**

   - 原因: 大量データ処理や API 遅延
   - 対策: タイムアウト値の調整、バッチサイズの最適化

2. **メモリ不足**

   - 原因: 大量のモックデータ生成
   - 対策: テストデータサイズの調整、ガベージコレクション

3. **モック設定エラー**
   - 原因: API レスポンス構造の不一致
   - 対策: 実際の API 構造との同期、型定義の確認

### デバッグ方法

- `BompDebug.test.ts`を使用した個別コンポーネントテスト
- コンソールログによる処理状況の確認
- パフォーマンスレポートによる詳細分析

## 関連ドキュメント

- [BOMP_GENERATION.md](../../docs/BOMP_GENERATION.md): ボンプデータ生成の詳細
- [API.md](../../docs/API.md): API 仕様とデータ構造
- [USAGE_AND_TROUBLESHOOTING.md](../../docs/USAGE_AND_TROUBLESHOOTING.md): 使用方法とトラブルシューティング
