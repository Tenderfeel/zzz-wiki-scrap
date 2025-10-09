# 設計書

## 概要

ボンプデータ生成システムは、HoyoLab API から全 32 のボンプエンティティの詳細情報を抽出し、既存のプロジェクトアーキテクチャに準拠した構造化 TypeScript オブジェクトを生成します。システムは既存のキャラクターデータ処理パイプラインを拡張し、ボンプ固有の要件に対応します。

## アーキテクチャ

### レイヤー構造

既存のアーキテクチャパターンに従い、以下のレイヤーでボンプデータ処理を実装：

```
src/
├── clients/          # HoyoLabApiClient（既存）を使用
├── parsers/          # BompListParser（新規）
├── mappers/          # BompDataMapper（新規）
├── processors/       # BompDataProcessor（新規）
├── generators/       # BompGenerator（新規）
└── types/           # Bomp型定義（既存に追加）
```

### データフロー

```
Scraping.md → BompListParser → HoyoLabApiClient → BompDataMapper → BompDataProcessor → BompGenerator → data/bomps.ts
```

## コンポーネントと インターフェース

### 1. BompListParser

**責任**: Scraping.md からボンプエントリ情報を抽出

```typescript
interface BompEntry {
  id: string; // 例: "excaliboo"
  pageId: number; // 例: 912
  wikiUrl: string; // 例: "https://wiki.hoyolab.com/pc/zzz/entry/912"
  jaName: string; // 例: "セイケンボンプ"
}

class BompListParser {
  parseBompEntries(): BompEntry[];
  validateBompEntry(entry: BompEntry): boolean;
}
```

### 2. BompDataMapper

**責任**: API レスポンスから Bomp オブジェクトへのデータマッピング

```typescript
class BompDataMapper extends DataMapper {
  mapBompData(
    jaData: ApiResponse,
    enData: ApiResponse,
    bompId: string
  ): ProcessedBompData;
  extractBompAttributes(moduleData: Module[]): Attributes;
  mapBompStats(statsValue: string): Stats;
  extractExtraAbility(moduleData: Module[]): string;
}

interface ProcessedBompData {
  basicInfo: BasicBompInfo;
  attributesInfo: AttributesInfo;
  extraAbility: string;
}

interface BasicBompInfo {
  id: string;
  name: string;
  stats: string;
  releaseVersion?: number;
}
```

### 3. BompDataProcessor

**責任**: ボンプデータの変換とビジネスロジック処理

```typescript
class BompDataProcessor extends DataProcessor {
  processBompData(bompEntry: BompEntry): Promise<ProcessedBompData>;
  extractBompFactions(moduleData: Module[]): number[];
  processExtraAbility(abilityData: string): string;
  validateBompData(data: ProcessedBompData): ValidationResult;
}
```

### 4. BompGenerator

**責任**: 最終的な Bomp オブジェクトの生成と出力

```typescript
class BompGenerator {
  generateBomp(
    jaData: ProcessedBompData,
    enData: ProcessedBompData,
    bompId: string
  ): Bomp;
  validateBomp(bomp: Bomp): ValidationResult;
  outputBompFile(bomps: Bomp[], outputPath: string): void;
  formatBompArray(bomps: Bomp[]): string;
}
```

## データモデル

### Bomp 型定義（既存を拡張）

```typescript
export type Bomp = {
  id: string; // Scraping.mdのリンクテキスト
  name: { [key in Lang]: string }; // 多言語名
  stats: Stats; // 属性（ice, fire, electric, physical, ether）
  releaseVersion?: number; // 実装バージョン
  faction?: number[]; // 陣営ID配列（複数所属可能）
  attr: Attributes; // ステータス（既存のAttributes型を使用）
  extraAbility: string; // 『追加能力』の説明文
};
```

### API データ抽出パス

#### 基本情報

- **id**: `data.page.id`
- **name**: `data.page.name`
- **stats**: `data.page.agent_stats.values[0]` または類似フィールド

#### 属性データ

- **場所**: `data.page.modules` → `ascension` コンポーネント
- **処理**: 既存の `AttributesProcessor.processAscensionData()` を使用

#### 追加能力

- **場所**: `data.page.modules` → `talent` または `skill` コンポーネント
- **抽出**: JSON データから能力説明文を取得

#### 陣営情報

- **場所**: `data.page.modules` → `baseInfo` コンポーネント
- **処理**: 複数陣営への所属可能性を考慮

## エラーハンドリング

### エラー分類と対応

1. **API エラー**

   - ネットワーク障害: リトライ機構（最大 3 回）
   - レート制限: 指数バックオフ
   - データ不整合: ログ記録 + 処理継続

2. **データ解析エラー**

   - 必須フィールド欠損: デフォルト値使用
   - 型変換エラー: 適切なフォールバック値
   - JSON 解析失敗: エラーログ + スキップ

3. **検証エラー**
   - 型安全性違反: 詳細エラーメッセージ
   - 必須データ欠損: 処理中断

### グレースフル劣化戦略

```typescript
interface BompProcessingResult {
  successful: Bomp[];
  failed: {
    bompId: string;
    error: string;
    partialData?: Partial<Bomp>;
  }[];
  statistics: ProcessingStatistics;
}
```

## テスト戦略

### 単体テスト

1. **BompListParser**

   - Scraping.md 解析の正確性
   - エントリ検証ロジック

2. **BompDataMapper**

   - API レスポンス → Bomp オブジェクト変換
   - 日本語 → 英語マッピング
   - エラーケース処理

3. **BompDataProcessor**

   - データ変換ロジック
   - 属性処理の正確性
   - 追加能力抽出

4. **BompGenerator**
   - Bomp オブジェクト生成
   - ファイル出力機能
   - データ検証

### 統合テスト

1. **エンドツーエンド処理**

   - 全ボンプデータの処理
   - 出力ファイルの妥当性
   - パフォーマンス測定

2. **API 統合**
   - 実際の HoyoLab API との連携
   - レート制限対応
   - エラー回復機能

### モックデータ

```typescript
// テスト用のボンプ API レスポンス
const mockBompApiResponse = {
  retcode: 0,
  message: "OK",
  data: {
    page: {
      id: "912",
      name: "セイケンボンプ",
      agent_stats: { values: ["氷属性"] },
      modules: [
        {
          name: "ascension",
          components: [
            {
              component_id: "ascension",
              data: JSON.stringify(mockAscensionData),
            },
          ],
        },
      ],
    },
  },
};
```

## パフォーマンス考慮事項

### API リクエスト最適化

1. **バッチ処理**: 5 件ずつのバッチでリクエスト
2. **遅延制御**: リクエスト間 500ms の遅延
3. **並行処理**: 日本語・英語の並行取得
4. **キャッシュ**: 処理済みデータの一時保存

### メモリ管理

1. **ストリーミング処理**: 大量データの逐次処理
2. **ガベージコレクション**: 不要オブジェクトの適切な解放
3. **メモリ監視**: 処理中のメモリ使用量追跡

## 設定管理

### 処理設定

```typescript
interface BompProcessingConfig {
  batchSize: number; // デフォルト: 5
  delayMs: number; // デフォルト: 500
  maxRetries: number; // デフォルト: 3
  outputPath: string; // デフォルト: "data/bomps.ts"
  enableValidation: boolean; // デフォルト: true
}
```

### 環境対応

- 開発環境: 詳細ログ + 検証強化
- 本番環境: エラーログのみ + パフォーマンス重視
- テスト環境: モックデータ使用

## セキュリティ考慮事項

1. **API キー管理**: 不要（パブリック API）
2. **レート制限遵守**: API 利用規約の遵守
3. **データ検証**: 入力データの適切な検証
4. **エラー情報**: 機密情報の漏洩防止

## 実装優先順位

### フェーズ 1: 基盤実装

1. BompListParser の実装
2. 既存 HoyoLabApiClient の拡張
3. 基本的な BompDataMapper

### フェーズ 2: データ処理

1. BompDataProcessor の実装
2. 属性データ処理の拡張
3. 追加能力抽出機能

### フェーズ 3: 出力・検証

1. BompGenerator の実装
2. データ検証機能
3. エラーハンドリングの強化

### フェーズ 4: 最適化・テスト

1. パフォーマンス最適化
2. 包括的テストスイート
3. ドキュメント整備
