# 設計書

## 概要

武器アイコンダウンロードシステムは、weapon-list.json に保存されている icon_url から全ての武器アイコン画像を取得し、ローカルファイルシステムに PNG 形式で保存します。システムは既存のボンプアイコンダウンロード機能のアーキテクチャを踏襲し、効率的な並行処理とエラー耐性を提供します。

## アーキテクチャ

### レイヤー構造

既存のアーキテクチャパターンに従い、以下のレイヤーで武器アイコンダウンロードを実装：

```
src/
├── loaders/          # FileLoader（既存）を使用してweapon-list.json読み込み
├── processors/       # WeaponIconProcessor（新規）
├── generators/       # WeaponIconGenerator（新規）
└── types/           # WeaponIcon型定義（既存に追加）
```

### データフロー

```
weapon-list.json → FileLoader → WeaponIconProcessor → WeaponIconGenerator → assets/images/weapons/
```

## コンポーネントとインターフェース

### 1. WeaponIconProcessor

**責任**: weapon-list.json からアイコン URL を抽出し、画像をダウンロード

```typescript
interface WeaponIconInfo {
  weaponId: string;
  weaponName: string;
  iconUrl: string;
  localPath: string;
  fileSize?: number;
  downloadedAt?: Date;
}

interface WeaponIconDownloadResult {
  success: boolean;
  weaponId: string;
  iconInfo?: WeaponIconInfo;
  error?: string;
  retryCount: number;
}

class WeaponIconProcessor {
  constructor(private config: WeaponIconConfig);

  async processWeaponIcon(
    weaponEntry: WeaponEntry
  ): Promise<WeaponIconDownloadResult>;
  extractIconUrl(weaponEntry: WeaponEntry): string | null;
  isValidRarity(weaponEntry: WeaponEntry): boolean;
  downloadIcon(iconUrl: string, outputPath: string): Promise<boolean>;
  validateIconFile(filePath: string): Promise<boolean>;
  generateLocalPath(weaponId: string): string;
  generateWeaponId(entryPageId: string): string;
}
```

### 2. WeaponIconGenerator

**責任**: 武器アイコンダウンロードの統合処理と結果出力

```typescript
interface WeaponIconProcessingResult {
  successful: WeaponIconInfo[];
  failed: {
    weaponId: string;
    weaponName: string;
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

class WeaponIconGenerator {
  constructor(
    private fileLoader: FileLoader,
    private weaponIconProcessor: WeaponIconProcessor
  );

  async generateWeaponIcons(): Promise<WeaponIconProcessingResult>;
  async processWeaponsBatch(
    weaponEntries: WeaponEntry[]
  ): Promise<WeaponIconDownloadResult[]>;
  loadWeaponList(): Promise<WeaponEntry[]>;
  validateOutputDirectory(): void;
  logProcessingStatistics(result: WeaponIconProcessingResult): void;
}
```

### 3. 設定インターフェース

```typescript
interface WeaponIconConfig {
  outputDirectory: string; // デフォルト: "assets/images/weapons"
  maxConcurrency: number; // デフォルト: 3
  retryAttempts: number; // デフォルト: 3
  retryDelayMs: number; // デフォルト: 1000
  requestDelayMs: number; // デフォルト: 500
  skipExisting: boolean; // デフォルト: true
  validateDownloads: boolean; // デフォルト: true
}
```

## データモデル

### WeaponIcon 型定義（新規追加）

```typescript
export interface WeaponIcon {
  weaponId: string; // 生成された武器ID
  weaponName: string; // 武器の名前
  entryPageId: string; // entry_page_id
  iconUrl: string; // 元のHoyoLab画像URL
  localPath: string; // ローカルファイルパス
  fileSize: number; // ファイルサイズ（バイト）
  downloadedAt: Date; // ダウンロード日時
}

export interface WeaponEntry {
  entry_page_id: string;
  name: string;
  icon_url: string;
  display_field?: any;
  filter_values?: any;
  desc?: string;
}
```

### データ抽出とファイル名生成

#### weapon-list.json からの抽出

- **アイコン URL**: `icon_url` フィールド
- **武器名**: `name` フィールド
- **エントリ ID**: `entry_page_id` フィールド
- **レアリティフィルタ**: `filter_values.w_engine_rarity.values` から "S" または "A" のみ処理（B レアリティは無視）

#### レアリティフィルタリング

```typescript
// SまたはAレアリティのみ処理対象とする
const isValidRarity = (weaponEntry: WeaponEntry): boolean => {
  const rarityValues = weaponEntry.filter_values?.w_engine_rarity?.values;
  if (!rarityValues || !Array.isArray(rarityValues)) {
    return false;
  }

  return rarityValues.some((rarity) => rarity === "S" || rarity === "A");
};
```

#### ファイル名生成規則

```typescript
// entry_page_idを武器IDとして使用
const generateWeaponId = (entryPageId: string): string => {
  return entryPageId;
};

// 例: "936" → "936.png"
// 例: "935" → "935.png"
const generateFileName = (weaponId: string): string => {
  return `${weaponId}.png`;
};

// 例: assets/images/weapons/936.png
const generateLocalPath = (weaponId: string): string => {
  return path.join(config.outputDirectory, generateFileName(weaponId));
};
```

## エラーハンドリング

### エラー分類と対応

1. **ファイル読み込みエラー**

   - weapon-list.json が存在しない: エラー終了
   - JSON パースエラー: 詳細ログ + エラー終了
   - 空のデータ: 警告ログ + 正常終了

2. **ダウンロードエラー**

   - HTTP エラー: ステータスコード記録 + リトライ
   - ネットワーク障害: リトライ機構（最大 3 回）
   - レート制限: 指数バックオフ

3. **ファイルシステムエラー**
   - ディレクトリ作成失敗: 権限エラー詳細記録
   - ファイル書き込み失敗: 権限・容量チェック
   - 既存ファイル競合: スキップまたは上書き設定

### グレースフル劣化戦略

```typescript
interface WeaponIconErrorHandling {
  onFileLoadError: (filePath: string, error: Error) => void;
  onDownloadError: (weaponId: string, iconUrl: string, error: Error) => void;
  onFileSystemError: (weaponId: string, path: string, error: Error) => void;
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
class WeaponIconDownloader {
  private async downloadWithStream(
    iconUrl: string,
    outputPath: string
  ): Promise<boolean> {
    const response = await fetch(iconUrl);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

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
  "weaponIconDownload": {
    "enabled": true,
    "outputDirectory": "assets/images/weapons",
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
      "act-webstatic.hoyoverse.com",
      "act-upload.hoyoverse.com",
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

1. WeaponIconProcessor の基本実装
2. weapon-list.json の読み込み機能
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

1. WeaponIconGenerator の実装
2. 設定管理の統合
3. 包括的テストスイート

## 統合ポイント

### 既存システムとの連携

1. **FileLoader**: weapon-list.json の読み込み
2. **Logger**: 統一されたログ出力
3. **ProcessingConfig**: 設定管理の統合
4. **SecurityValidator**: 既存のセキュリティ機能

### 出力ディレクトリ構造

```
assets/
└── images/
    └── weapons/
        ├── 936.png  # 燔火の朧夜
        ├── 935.png  # 炉で歌い上げられる夢
        ├── 934.png
        └── ... (SとAレアリティの武器アイコン)
```

## テスト戦略

### 単体テスト

1. **WeaponIconProcessor**

   - アイコン URL 抽出の正確性
   - ダウンロード機能のテスト
   - エラーハンドリングの検証

2. **WeaponIconGenerator**
   - バッチ処理の正確性
   - 統計情報の生成
   - 結果出力の検証

### 統合テスト

1. **エンドツーエンド処理**

   - 全武器アイコンのダウンロード
   - ファイル整合性の検証
   - パフォーマンス測定

2. **エラーシナリオ**
   - ネットワークエラー時の動作
   - ファイルシステムエラー時の動作
   - 部分的失敗時の継続処理

### モックデータ

```typescript
// テスト用の武器エントリ
const mockWeaponEntry: WeaponEntry = {
  entry_page_id: "936",
  name: "燔火の朧夜",
  icon_url:
    "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2025/10/14/07da3f94e491eeeb50491f1d8c0dfdda_7120678420596402422.png",
  display_field: {},
  filter_values: {},
  desc: "",
};
```

## 既存システムとの差異

### ボンプアイコンダウンロードとの違い

1. **データソース**:

   - ボンプ: HoyoLab API レスポンス
   - 武器: weapon-list.json ファイル

2. **ファイル名生成**:

   - ボンプ: Scraping.md のリンクテキスト使用
   - 武器: 武器名から生成 + entry_page_id フォールバック

3. **出力ディレクトリ**:

   - ボンプ: `assets/images/bomps/`
   - 武器: `assets/images/weapons/`

4. **データ取得方法**:
   - ボンプ: API クライアント経由
   - 武器: ファイルローダー経由
