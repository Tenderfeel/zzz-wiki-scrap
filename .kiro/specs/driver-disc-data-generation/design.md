# 設計書

## 概要

ドライバーディスクデータ生成機能は、既存の ZZZ キャラクターデータ処理システムのアーキテクチャパターンに従い、HoyoLab API からドライバーディスクの詳細情報を取得し、型安全な TypeScript ファイルとして出力するシステムです。この機能は、キャラクター、ボンプ、音動機データ処理システムと統合され、包括的なゲームデータ管理システムを構築します。

## アーキテクチャ

### レイヤー構造

既存のプロジェクトアーキテクチャに従い、以下のレイヤー構造を採用します：

```
src/
├── clients/          # API通信層（既存のHoyoLabApiClientを使用）
├── parsers/          # JSONパース・構造化層
│   └── DriverDiscListParser.ts
├── mappers/          # APIレスポンス→内部型変換層
│   └── DriverDiscDataMapper.ts
├── processors/       # データ変換・ビジネスロジック層
│   └── DriverDiscDataProcessor.ts
├── generators/       # TypeScriptファイル出力層
│   └── DriverDiscGenerator.ts
└── utils/           # 共通ユーティリティ（既存を活用）
```

### データフロー

```
disc-list.json → Parser → API Client → Mapper → Processor → Generator → data/driverDiscs.ts
```

## コンポーネントと インターフェース

### 1. DriverDiscListParser

**責任**: `json/data/disc-list.json` の解析と DriverDiscEntry 配列の生成

```typescript
interface DriverDiscEntry {
  id: string; // entry_page_id
  name: string; // 日本語名
  iconUrl: string; // アイコンURL
}

class DriverDiscListParser {
  parseDiscListFile(filePath: string): Promise<DriverDiscEntry[]>;
  private validateEntry(entry: any): boolean;
}
```

### 2. DriverDiscDataMapper

**責任**: HoyoLab API レスポンスから内部データ構造への変換

```typescript
class DriverDiscDataMapper extends DataMapper {
  extractBasicDriverDiscInfo(
    apiResponse: ApiResponse,
    discId: string
  ): BasicDriverDiscInfo;
  extractSetEffects(apiResponse: ApiResponse): SetEffectInfo;
  extractSpecialty(fourSetEffect: string): Specialty;
  private mapSpecialtyFromText(text: string): Specialty;
}

interface BasicDriverDiscInfo {
  id: number;
  name: string;
  releaseVersion?: number;
}

interface SetEffectInfo {
  fourSetEffect: string;
  twoSetEffect: string;
}
```

### 3. DriverDiscDataProcessor

**責任**: ドライバーディスクデータの処理とビジネスロジック

```typescript
class DriverDiscDataProcessor extends DataProcessor {
  processDriverDiscData(
    discEntry: DriverDiscEntry
  ): Promise<ProcessedDriverDiscData>;
  private fetchDriverDiscApiData(
    discEntry: DriverDiscEntry
  ): Promise<BilingualApiData>;
  private extractBasicDriverDiscInfo(
    apiData: ApiResponse,
    discId: string
  ): BasicDriverDiscInfo;
  private extractSetEffectInfo(apiData: ApiResponse): SetEffectInfo;
  private determineSpecialty(fourSetEffect: string): Specialty;
}

interface ProcessedDriverDiscData {
  basicInfo: BasicDriverDiscInfo;
  setEffectInfo: SetEffectInfo;
  specialty: Specialty;
}
```

### 4. DriverDiscGenerator

**責任**: 最終的な DriverDisc オブジェクトの生成と TypeScript ファイル出力

```typescript
class DriverDiscGenerator {
  generateDriverDisc(
    jaData: ProcessedDriverDiscData,
    enData: ProcessedDriverDiscData | null,
    discId: string
  ): DriverDisc;
  generateDriverDiscsFile(
    driverDiscs: DriverDisc[],
    outputPath: string
  ): Promise<void>;
  private createMultiLanguageName(
    jaData: ProcessedDriverDiscData,
    enData: ProcessedDriverDiscData | null
  ): { [key in Lang]: string };
  private createMultiLanguageSetEffect(
    jaData: ProcessedDriverDiscData,
    enData: ProcessedDriverDiscData | null
  ): {
    fourSetEffect: { [key in Lang]: string };
    twoSetEffect: { [key in Lang]: string };
  };
}
```

## データモデル

### DriverDisc 型定義

Scraping.md で定義された型に基づく：

```typescript
type DriverDisc = {
  id: number;
  name: { [key in Lang]: string };
  fourSetEffect: { [key in Lang]: string }; // 4セット効果
  twoSetEffect: { [key in Lang]: string }; // 2セット効果
  releaseVersion: number;
  specialty: Specialty; // 特性（4セット効果に含まれている特性を設定）
};
```

### 処理用中間型

```typescript
interface DriverDiscProcessingConfig {
  discListPath: string; // disc-list.jsonのパス
  outputPath: string; // 出力ファイルパス
  batchSize: number; // バッチサイズ
  delayMs: number; // 遅延時間
  maxRetries: number; // 最大リトライ回数
  enableValidation: boolean; // データ検証の有効化
  logLevel: "error" | "warn" | "info" | "debug"; // ログレベル
}

interface DriverDiscProcessingResult {
  successful: DriverDisc[];
  failed: {
    discId: string;
    error: string;
    partialData?: Partial<DriverDisc>;
  }[];
  statistics: ProcessingStatistics;
}
```

## エラーハンドリング

### エラー処理戦略

1. **グレースフル劣化**: 部分的失敗でも処理を継続
2. **詳細ログ**: 各処理ステップでの包括的なエラー記録
3. **リトライ機構**: API 失敗時の自動リトライ
4. **バリデーション**: データ整合性の検証

### エラー分類

```typescript
// 既存のエラークラスを活用
- ApiError: API通信エラー
- ParsingError: JSONパースエラー
- MappingError: データマッピングエラー
- ValidationError: データ検証エラー
```

## テスト戦略

### テスト対象

1. **単体テスト**

   - DriverDiscListParser: disc-list.json 解析
   - DriverDiscDataMapper: API レスポンスマッピング
   - DriverDiscDataProcessor: データ処理ロジック
   - DriverDiscGenerator: ファイル生成

2. **統合テスト**

   - エンドツーエンドのデータ処理フロー
   - API 通信とエラーハンドリング
   - 実際の API データを使用した検証

3. **パフォーマンステスト**
   - 大量データ処理時のメモリ使用量
   - API レート制限への対応

### テストデータ

```typescript
// モックデータの準備
- json/mock/driver-disc.json: APIレスポンスモック
- json/mock/disc-list.json: ディスクリストモック
```

## 設定管理

### ProcessingConfig 拡張

既存の`ProcessingConfig`システムを拡張してドライバーディスク処理設定を追加：

```typescript
interface ProcessingConfig {
  // 既存設定...
  driverDisc: DriverDiscProcessingConfig;
}
```

### 設定ファイル

```json
// processing-config.json
{
  "driverDisc": {
    "discListPath": "json/data/disc-list.json",
    "outputPath": "data/driverDiscs.ts",
    "batchSize": 5,
    "delayMs": 1000,
    "maxRetries": 3,
    "enableValidation": true,
    "logLevel": "info"
  }
}
```

## 実装詳細

### API データ抽出

HoyoLab API からの主要データ抽出パス：

```typescript
// APIレスポンス構造
data.page.id → DriverDisc ID (数値変換)
data.page.name → 多言語名オブジェクト
data.page.modules → セット効果情報の抽出

// セット効果の抽出
display_field.four_set_effect → 4セット効果（HTML除去）
display_field.two_set_effect → 2セット効果（HTML除去）
```

### 特性抽出ロジック

4 セット効果のテキストから特性を抽出：

```typescript
const specialtyPatterns = {
  撃破: "stun",
  強攻: "attack",
  異常: "anomaly",
  支援: "support",
  防護: "defense",
  命破: "rupture",
};

// パターンマッチングによる特性判定
function extractSpecialtyFromText(text: string): Specialty {
  // HTMLタグ除去
  // 特性キーワード検索
  // 最も関連性の高い特性を返す
}
```

### 多言語対応

```typescript
// 日本語優先、英語フォールバック
async function fetchBilingualData(
  discEntry: DriverDiscEntry
): Promise<BilingualApiData> {
  const jaData = await apiClient.fetchData(discEntry.id, "ja-jp");
  let enData = null;

  try {
    enData = await apiClient.fetchData(discEntry.id, "en-us");
  } catch (error) {
    logger.warn("英語データ取得失敗、日本語データを使用", {
      discId: discEntry.id,
    });
  }

  return { ja: jaData, en: enData };
}
```

## パフォーマンス考慮事項

### メモリ最適化

- バッチ処理によるメモリ使用量制御
- 大量データ処理時のガベージコレクション
- ストリーミング処理の検討

### API レート制限対応

- リクエスト間隔の制御（デフォルト 1 秒）
- 指数バックオフによるリトライ
- 並行処理数の制限

### 進捗表示

```typescript
// 既存のEnhancedProgressTrackerを活用
-リアルタイム進捗表示 - 処理速度とETA表示 - メモリ使用量監視;
```

## セキュリティ

### データ検証

```typescript
// 既存のSecurityValidatorを活用
-入力データの検証 - APIレスポンスの検証 - ファイル出力時の検証;
```

### エラー情報の適切な処理

- 機密情報の漏洩防止
- ログレベルによる情報制御
- エラーメッセージのサニタイズ
