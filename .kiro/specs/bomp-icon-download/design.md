# 設計書

## 概要

ボンプアイコンダウンロードシステムは、HoyoLab API から全 32 のボンプエンティティのメインアイコン画像を取得し、ローカルファイルシステムに PNG 形式で保存します。システムは既存のプロジェクトアーキテクチャに準拠し、効率的な並行処理とエラー耐性を提供します。

## アーキテクチャ

### レイヤー構造

既存のアーキテクチャパターンに従い、以下のレイヤーでボンプアイコンダウンロードを実装：

```
src/
├── clients/          # HoyoLabApiClient（既存）を使用
├── parsers/          # BompListParser（既存）を使用
├── processors/       # BompIconProcessor（新規）
├── generators/       # BompIconGenerator（新規）
└── types/           # BompIcon型定義（既存に追加）
```

### データフロー

```
Scraping.md → BompListParser → HoyoLabApiClient → BompIconProcessor → BompIconGenerator → assets/images/bomps/
```

## コンポーネントと インターフェース

### 1. BompIconProcessor

**責任**: API レスポンスからアイコン URL を抽出し、画像をダウンロード

```typescript
interface BompIconInfo {
  bompId: string;
  iconUrl: string;
  localPath: string;
  fileSize?: number;
  downloadedAt?: Date;
}

interface BompIconDownloadResult {
  success: boolean;
  bompId: string;
  iconInfo?: BompIconInfo;
  error?: string;
  retryCount: number;
}

class BompIconProcessor {
  constructor(
    private apiClient: HoyoLabApiClient,
    private config: BompIconConfig
  );

  async processBompIcon(bompEntry: BompEntry): Promise<BompIconDownloadResult>;
  extractIconUrl(apiResponse: ApiResponse): string | null;
  downloadIcon(iconUrl: string, outputPath: string): Promise<boolean>;
  validateIconFile(filePath: string): Promise<boolean>;
  generateLocalPath(bompId: string): string;
}
```

### 2. BompIconGenerator

**責任**: ボンプアイコンダウンロードの統合処理と結果出力

```typescript
interface BompIconProcessingResult {
  successful: BompIconInfo[];
  failed: {
    bompId: string;
    error: string;
    iconUrl?: string;
  }[];
  statistics: {
    total: number;
    successful: number;
    failed: number;
    totalSizeBytes: number;
    processingTimeMs: number;
  };
}

class BompIconGenerator {
  constructor(
    private bompListParser: BompListParser,
    private bompIconProcessor: BompIconProcessor
  );

  async generateBompIcons(): Promise<BompIconProcessingResult>;
  async processBompsBatch(
    bompEntries: BompEntry[]
  ): Promise<BompIconDownloadResult[]>;
  validateOutputDirectory(): void;
  logProcessingStatistics(result: BompIconProcessingResult): void;
}
```

### 3. 設定インターフェース

```typescript
interface BompIconConfig {
  outputDirectory: string; // デフォルト: "assets/images/bomps"
  maxConcurrency: number; // デフォルト: 3
  retryAttempts: number; // デフォルト: 3
  retryDelayMs: number; // デフォルト: 1000
  requestDelayMs: number; // デフォルト: 500
  skipExisting: boolean; // デフォルト: true
  validateDownloads: boolean; // デフォルト: true
}
```

## データモデル

### BompIcon 型定義（新規追加）

```typescript
export interface BompIcon {
  bompId: string; // Scraping.mdのリンクテキスト
  iconUrl: string; // 元のHoyoLab画像URL
  localPath: string; // ローカルファイルパス
  fileSize: number; // ファイルサイズ（バイト）
  downloadedAt: Date; // ダウンロード日時
}
```

### API データ抽出パス

#### アイコン URL 抽出

- **場所**: `data.page.icon_url`
- **形式**: `https://act-upload.hoyoverse.com/event-ugc-hoyowiki/...`
- **拡張子**: 通常は `.png`

#### ファイル名生成規則

```typescript
// 例: excaliboo → excaliboo.png
const generateFileName = (bompId: string): string => {
  const sanitizedId = bompId.replace(/[^a-zA-Z0-9-_]/g, "");
  return `${sanitizedId}.png`;
};

// 例: assets/images/bomps/excaliboo.png
const generateLocalPath = (bompId: string): string => {
  return path.join(config.outputDirectory, generateFileName(bompId));
};
```

## エラーハンドリング

### エラー分類と対応

1. **API エラー**

   - ネットワーク障害: リトライ機構（最大 3 回）
   - レート制限: 指数バックオフ
   - データ不整合: ログ記録 + 処理継続

2. **ダウンロードエラー**

   - HTTP エラー: ステータスコード記録 + リトライ
   - ファイル書き込み失敗: 権限・容量チェック
   - 不正な画像データ: ファイルサイズ検証

3. **ファイルシステムエラー**
   - ディレクトリ作成失敗: 権限エラー詳細記録
   - 既存ファイル競合: スキップまたは上書き設定

### グレースフル劣化戦略

```typescript
interface BompIconErrorHandling {
  onApiError: (bompId: string, error: Error) => void;
  onDownloadError: (bompId: string, iconUrl: string, error: Error) => void;
  onFileSystemError: (bompId: string, path: string, error: Error) => void;
  shouldRetry: (error: Error, retryCount: number) => boolean;
  getRetryDelay: (retryCount: number) => number;
}
```

## パフォーマンス考慮事項

### 並行処理最適化

1. **バッチ処理**: 3-5 件ずつの並行ダウンロード
2. **遅延制御**: リクエスト間 500ms の遅延
3. **メモリ管理**: ストリーミングダウンロード
4. **プログレス追跡**: リアルタイム進捗表示

### ダウンロード最適化

```typescript
class BompIconDownloader {
  private async downloadWithStream(
    iconUrl: string,
    outputPath: string
  ): Promise<boolean> {
    const response = await fetch(iconUrl);
    const fileStream = fs.createWriteStream(outputPath);

    return new Promise((resolve, reject) => {
      response.body.pipe(fileStream);
      fileStream.on("finish", () => resolve(true));
      fileStream.on("error", reject);
    });
  }

  private async validateDownload(filePath: string): Promise<boolean> {
    const stats = await fs.promises.stat(filePath);
    return stats.size > 0 && stats.size < 10 * 1024 * 1024; // 10MB制限
  }
}
```

## 設定管理

### processing-config.json 拡張

```json
{
  "bompIconDownload": {
    "enabled": true,
    "outputDirectory": "assets/images/bomps",
    "maxConcurrency": 3,
    "retryAttempts": 3,
    "retryDelayMs": 1000,
    "requestDelayMs": 500,
    "skipExisting": true,
    "validateDownloads": true,
    "maxFileSizeMB": 10,
    "allowedExtensions": [".png", ".jpg", ".jpeg", ".webp"]
  }
}
```

### 環境対応

- 開発環境: 詳細ログ + 検証強化
- 本番環境: エラーログのみ + パフォーマンス重視
- テスト環境: モックダウンロード使用

## セキュリティ考慮事項

1. **URL 検証**: HoyoLab ドメインのみ許可
2. **ファイルサイズ制限**: 最大 10MB
3. **パス検証**: ディレクトリトラバーサル防止
4. **拡張子制限**: 画像ファイルのみ許可

```typescript
class SecurityValidator {
  static validateIconUrl(url: string): boolean {
    const allowedDomains = [
      "act-upload.hoyoverse.com",
      "act-webstatic.hoyoverse.com",
    ];

    try {
      const urlObj = new URL(url);
      return allowedDomains.includes(urlObj.hostname);
    } catch {
      return false;
    }
  }

  static sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9-_.]/g, "");
  }

  static validateFilePath(filePath: string, baseDir: string): boolean {
    const resolvedPath = path.resolve(filePath);
    const resolvedBase = path.resolve(baseDir);
    return resolvedPath.startsWith(resolvedBase);
  }
}
```

## 実装優先順位

### フェーズ 1: 基盤実装

1. BompIconProcessor の基本実装
2. 既存 BompListParser との統合
3. 基本的なダウンロード機能

### フェーズ 2: エラーハンドリング

1. リトライ機構の実装
2. ファイルシステムエラー処理
3. 検証機能の追加

### フェーズ 3: パフォーマンス最適化

1. 並行処理の実装
2. プログレス追跡機能
3. メモリ最適化

### フェーズ 4: 統合・テスト

1. BompIconGenerator の実装
2. 設定管理の統合
3. 包括的テストスイート

## 統合ポイント

### 既存システムとの連携

1. **BompListParser**: Scraping.md からボンプエントリを取得
2. **HoyoLabApiClient**: API レスポンスからアイコン URL を抽出
3. **Logger**: 統一されたログ出力
4. **ProcessingConfig**: 設定管理の統合

### 出力ディレクトリ構造

```
assets/
└── images/
    └── bomps/
        ├── excaliboo.png
        ├── mercury.png
        ├── missEsme.png
        ├── belion.png
        └── ... (全32個のボンプアイコン)
```

## テスト戦略

### 単体テスト

1. **BompIconProcessor**

   - アイコン URL 抽出の正確性
   - ダウンロード機能のテスト
   - エラーハンドリングの検証

2. **BompIconGenerator**
   - バッチ処理の正確性
   - 統計情報の生成
   - 結果出力の検証

### 統合テスト

1. **エンドツーエンド処理**

   - 全ボンプアイコンのダウンロード
   - ファイル整合性の検証
   - パフォーマンス測定

2. **エラーシナリオ**
   - ネットワークエラー時の動作
   - ファイルシステムエラー時の動作
   - 部分的失敗時の継続処理

### モックデータ

```typescript
// テスト用のボンプアイコンレスポンス
const mockBompIconResponse = {
  retcode: 0,
  message: "OK",
  data: {
    page: {
      id: "912",
      name: "セイケンボンプ",
      icon_url:
        "https://act-upload.hoyoverse.com/event-ugc-hoyowiki/2025/09/07/59155606/52983421a01aba057aa9b9b5867bf77e_5531867362809073662.png",
    },
  },
};
```
