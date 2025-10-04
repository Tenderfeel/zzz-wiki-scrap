# 設計文書

## 概要

HoyoLab ZZZ Wiki API から Scraping.md に記載された全 38 キャラクターのデータを取得し、grungerad プロジェクトで使用する Character オブジェクトの配列を生成するシステムの設計です。このシステムは、各キャラクターの API からの生データを解析し、TypeScript 型に準拠した構造化データに変換して、data/characters.ts ファイルとして出力します。

## アーキテクチャ

### システム構成

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Character List  │───▶│  Batch Processor │───▶│ Characters Gen  │
│   Parser        │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Scraping.md     │    │ API Client Pool  │    │ data/characters │
│ Character List  │    │ (ja-jp/en-us)    │    │ .ts File        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │ Data Processing  │
                       │ Pipeline         │
                       └──────────────────┘
```

### データフロー

1. **キャラクターリスト解析**: Scraping.md からキャラクター ID とページ ID を抽出
2. **バッチ API 取得**: 各キャラクターの日本語と英語データを並行取得
3. **データ処理パイプライン**: 各キャラクターのデータを順次処理
4. **検証とエラーハンドリング**: 各キャラクターデータの整合性確認
5. **配列生成**: 全キャラクターの Character オブジェクト配列を作成
6. **ファイル出力**: data/characters.ts として TypeScript ファイル出力

## コンポーネントと インターフェース

### 1. キャラクターリストパーサー (CharacterListParser)

**責任**: Scraping.md ファイルの解析とキャラクター情報の抽出

```typescript
interface CharacterListParser {
  parseScrapingFile(filePath: string): Promise<CharacterEntry[]>;
  extractCharacterEntries(content: string): CharacterEntry[];
}

interface CharacterEntry {
  id: string; // リンクテキスト（例: "lycaon"）
  pageId: number; // API用ページID（例: 28）
  wikiUrl: string; // wiki URL
}
```

**抽出パターン**:

- 正規表現: `- \[([^\]]+)\]\([^)]+\) - pageId: (\d+)`
- 例: `- [lycaon](https://wiki.hoyolab.com/pc/zzz/entry/28) - pageId: 28`

### 2. バッチプロセッサー (BatchProcessor)

**責任**: 複数キャラクターの並行処理とプログレス管理

```typescript
interface BatchProcessor {
  processAllCharacters(entries: CharacterEntry[]): Promise<ProcessingResult>;
  processCharacterBatch(
    entries: CharacterEntry[],
    batchSize: number
  ): Promise<CharacterResult[]>;
  handleRateLimit(delay: number): Promise<void>;
}

interface ProcessingResult {
  successful: CharacterResult[];
  failed: FailedCharacter[];
  statistics: ProcessingStatistics;
}

interface CharacterResult {
  entry: CharacterEntry;
  jaData: ApiResponse;
  enData: ApiResponse;
  character: Character;
}

interface FailedCharacter {
  entry: CharacterEntry;
  error: string;
  stage: "API_FETCH" | "DATA_PROCESSING" | "VALIDATION";
}

interface ProcessingStatistics {
  total: number;
  successful: number;
  failed: number;
  processingTime: number;
}
```

**バッチ処理戦略**:

- バッチサイズ: 5 キャラクター同時処理
- レート制限: リクエスト間隔 200ms
- リトライ機能: API 失敗時の 3 回リトライ
- プログレス表示: 現在処理中のキャラクター名表示

### 3. 拡張 API クライアント (EnhancedApiClient)

**責任**: 複数キャラクターの API データ取得と並行処理

```typescript
interface EnhancedApiClient extends ApiClient {
  fetchCharacterDataBatch(entries: CharacterEntry[]): Promise<ApiDataResult[]>;
  fetchBothLanguages(pageId: number): Promise<BilingualApiData>;
  handleApiError(error: ApiError, entry: CharacterEntry): Promise<void>;
}

interface BilingualApiData {
  ja: ApiResponse;
  en: ApiResponse;
}

interface ApiDataResult {
  entry: CharacterEntry;
  data: BilingualApiData | null;
  error?: string;
}
```

### 4. 拡張データプロセッサー (EnhancedDataProcessor)

**責任**: 複数キャラクターのデータ処理と陣営解決

```typescript
interface EnhancedDataProcessor extends DataProcessor {
  processCharacterData(
    jaData: ApiResponse,
    enData: ApiResponse,
    entry: CharacterEntry
  ): Promise<Character>;
  resolveFactionFromData(apiData: ApiResponse): Promise<number>;
  validateProcessedData(character: Character): ValidationResult;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
```

**陣営解決ロジック**:

```typescript
// 陣営名から data/factions.ts の ID にマッピング
const factionNameToId: Record<string, number> = {
  邪兎屋: 1,
  ヴィクトリア家政: 2,
  白祇重工: 3,
  "防衛軍・オボルス小隊": 4,
  対ホロウ特別行動部第六課: 5,
  特務捜査班: 6,
  カリュドーンの子: 7,
  "スターズ・オブ・リラ": 8,
  "防衛軍・シルバー小隊": 9,
  モッキンバード: 10,
  雲嶽山: 11,
  怪啖屋: 12,
};
```

### 5. 全キャラクタージェネレーター (AllCharactersGenerator)

**責任**: 全キャラクターの Character オブジェクト配列生成と出力

```typescript
interface AllCharactersGenerator {
  generateAllCharacters(results: CharacterResult[]): Character[];
  validateCharacterArray(characters: Character[]): ArrayValidationResult;
  outputCharactersFile(characters: Character[]): Promise<void>;
  generateProcessingReport(result: ProcessingResult): string;
}

interface ArrayValidationResult {
  isValid: boolean;
  duplicateIds: string[];
  invalidCharacters: { index: number; errors: string[] }[];
  totalCharacters: number;
}
```

**出力ファイル形式**:

```typescript
// data/characters.ts
export default [
  {
    id: "anby",
    name: { ja: "アンビー", en: "Anby" },
    fullName: { ja: "アンビー", en: "Anby" },
    specialty: "stun",
    stats: "electric",
    attackType: "slash",
    faction: 1, // 邪兎屋
    rarity: "A",
    attr: {
      hp: [
        /* 7つの値 */
      ],
      atk: [
        /* 7つの値 */
      ],
      def: [
        /* 7つの値 */
      ],
      impact: 0,
      critRate: 0,
      critDmg: 0,
      anomalyMastery: 0,
      anomalyProficiency: 0,
      penRatio: 0,
      energy: 0,
    },
  },
  // ... 他の37キャラクター
] as Character[];
```

## データモデル

### キャラクターエントリー

```typescript
interface CharacterEntry {
  id: string; // Scraping.mdのリンクテキスト
  pageId: number; // API用ページID
  wikiUrl: string; // 元のwiki URL
}

// Scraping.mdから抽出される全38キャラクター
const ALL_CHARACTERS: CharacterEntry[] = [
  { id: "anby", pageId: 2, wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/2" },
  {
    id: "billy",
    pageId: 19,
    wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/19",
  },
  // ... 残り36キャラクター
];
```

### 処理結果データ

```typescript
interface ProcessingResult {
  successful: CharacterResult[];
  failed: FailedCharacter[];
  statistics: ProcessingStatistics;
}

interface CharacterResult {
  entry: CharacterEntry;
  jaData: ApiResponse;
  enData: ApiResponse;
  character: Character;
}
```

### 最終出力型定義

```typescript
// 既存の型定義を継承
type Character = {
  id: string; // Scraping.mdのリンクテキスト
  name: { [key in Lang]: string };
  fullName: { [key in Lang]: string };
  specialty: Specialty;
  stats: Stats;
  attackType: AttackType;
  faction: number; // data/factions.tsのID
  rarity: Rarity;
  attr: Attributes;
};
```

## エラーハンドリング

### エラータイプと処理戦略

```typescript
enum ProcessingStage {
  PARSING = "PARSING",
  API_FETCH = "API_FETCH",
  DATA_PROCESSING = "DATA_PROCESSING",
  VALIDATION = "VALIDATION",
  FILE_OUTPUT = "FILE_OUTPUT",
}

class AllCharactersError extends Error {
  constructor(
    public stage: ProcessingStage,
    public characterId: string | null,
    public details: string,
    public originalError?: Error
  ) {
    super(`${stage}${characterId ? ` (${characterId})` : ""}: ${details}`);
  }
}
```

### エラー処理方針

1. **個別キャラクターエラー**: 失敗したキャラクターをスキップし、成功したキャラクターで処理継続
2. **API エラー**: 3 回リトライ後、そのキャラクターを失敗として記録
3. **データ処理エラー**: 詳細なエラーログを出力し、次のキャラクターに進む
4. **検証エラー**: 警告として記録し、可能な限り修正して処理継続

### エラーレポート

```typescript
interface ProcessingReport {
  summary: {
    total: number;
    successful: number;
    failed: number;
    processingTime: string;
  };
  failedCharacters: {
    id: string;
    stage: ProcessingStage;
    error: string;
  }[];
  warnings: {
    id: string;
    message: string;
  }[];
}
```

## テスト戦略

### 単体テスト

1. **CharacterListParser**: Scraping.md 解析の正確性
2. **EnhancedApiClient**: API 呼び出しとエラーハンドリング
3. **EnhancedDataProcessor**: 各キャラクターデータの処理精度
4. **AllCharactersGenerator**: 配列生成と検証ロジック

### 統合テスト

1. **小規模バッチテスト**: 3-5 キャラクターでの完全処理テスト
2. **エラーシナリオテスト**: API 失敗、データ不整合等の処理確認
3. **パフォーマンステスト**: 全 38 キャラクターの処理時間測定

### テストデータ

```typescript
// テスト用の小規模キャラクターリスト
const TEST_CHARACTERS: CharacterEntry[] = [
  { id: "lycaon", pageId: 28, wikiUrl: "..." }, // 既存のlycaon.jsonを使用
  { id: "anby", pageId: 2, wikiUrl: "..." },
  { id: "billy", pageId: 19, wikiUrl: "..." },
];
```

## 実装の考慮事項

### パフォーマンス最適化

1. **並行処理**: 5 キャラクター同時処理で API 呼び出し効率化
2. **メモリ管理**: 大量の API レスポンスデータの適切な管理
3. **プログレス表示**: ユーザーへの処理状況フィードバック
4. **キャッシュ機能**: 同一セッション内での API レスポンス再利用

### 拡張性

1. **設定可能性**: バッチサイズ、リトライ回数、遅延時間の外部設定
2. **プラグイン対応**: 新キャラクター追加時の自動対応
3. **出力形式**: JSON、CSV 等の他形式出力対応準備
4. **フィルタリング**: 特定キャラクターのみ処理する機能

### 信頼性

1. **データ整合性**: 各キャラクターデータの厳密な検証
2. **部分的成功**: 一部失敗でも成功分のデータを出力
3. **詳細ログ**: 処理過程の完全な記録
4. **復旧機能**: 失敗したキャラクターのみ再処理する機能

### セキュリティ

1. **レート制限遵守**: API 提供者への配慮
2. **エラー情報**: 機密情報を含まない安全なエラーメッセージ
3. **入力検証**: Scraping.md ファイルの内容検証
4. **出力検証**: 生成される TypeScript ファイルの構文確認
