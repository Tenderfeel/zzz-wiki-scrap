# ZZZ Character & Bomp Data Generator

HoyoLab ZZZ Wiki API から Zenless Zone Zero のキャラクターとボンプ（Bangboo）データを取得し、TypeScript 形式で出力するプロジェクトです。

## 概要

このプロジェクトは、Zenless Zone Zero（ZZZ）の以下のデータを HoyoLab Wiki API から取得し、構造化された TypeScript ファイルとして出力します：

- **キャラクターデータ**: 全キャラクターの詳細情報（属性、ステータス、派閥など）
- **ボンプデータ**: 全ボンプ（Bangboo）の詳細情報（属性、ステータス、追加能力など）
- **派閥データ**: ゲーム内の派閥情報

## プロジェクト構造

```
.
├── data/                    # 生成されたデータファイル
│   ├── characters.ts        # キャラクターデータ
│   ├── bomps.ts            # ボンプデータ
│   └── factions.ts         # 陣営データ
├── json/mock/              # モックデータ
│   ├── lycaon.json         # ライカンのAPIレスポンスデータ
│   └── bomp.json           # ボンプのAPIレスポンスデータ
├── src/                    # ソースコード
│   ├── clients/            # APIクライアント
│   ├── generators/         # データ生成器
│   ├── loaders/           # ファイルローダー
│   ├── mappers/           # データマッパー
│   ├── parsers/           # データパーサー
│   ├── processors/        # データプロセッサー
│   ├── types/             # 型定義
│   └── main*.ts           # メインエントリーポイント
├── tests/                 # テ��トファイル
├── docs/                  # ドキュメント
│   ├── BOMP_GENERATION.md # ボンプデータ生成ガイド
│   ├── API.md             # API仕様
│   └── USAGE_AND_TROUBLESHOOTING.md # 使用方法とトラブルシューティング
├── processing-config.json      # キャラクター処理設定
└── bomp-processing-config.json # ボンプ処理設定
```

## スクリプトコマンド

### データ生成

| コマンド                 | 説明                                 |
| ------------------------ | ------------------------------------ |
| `npm run generate`       | 全キャラクターデータを生成           |
| `npm run generate:bomps` | 全ボンプデータを生成                 |
| `npm run generate:all`   | キャラクターとボンプデータを一括生成 |

**使用例:**

```bash
# 全キャラクターデータを生成
npm run generate

# 全ボンプデータを生成
npm run generate:bomps

# 全データを一括生成
npm run generate:all
```

### テスト

| コマンド                | 説明                                                     |
| ----------------------- | -------------------------------------------------------- |
| `npm test`              | 全テストを 1 回実行                                      |
| `npm run test:watch`    | テストをウォッチモードで実行（ファイル変更時に自動実行） |
| `npm run test:ui`       | テスト UI を起動してブラウザで結果を確認                 |
| `npm run test:coverage` | カバレッジレポート付きでテスト実行                       |

**使用例:**

```bash
# 全テストを実行
npm test

# 開発中にテストを監視
npm run test:watch

# カバレッジを確認
npm run test:coverage
```

## 使用方法

### 1. 依存関係のインストール

```bash
npm install
```

### 2. データの生成

```bash
# 全キャラクターデータを生成
npm run generate

# 全ボンプデータを生成
npm run generate:bomps

# 全データを一括生成
npm run generate:all
```

### 3. 生成されたファイルの確認

生成されたファイルは `data/` ディレクトリに保存されます：

- `data/characters.ts` - 全キャラクターデータ
- `data/bomps.ts` - 全ボンプデータ
- `data/factions.ts` - 陣営データ

### 4. テストの実行

```bash
# 全テストを実行
npm test

# テスト結果をブラウザで確認
npm run test:ui
```

## 出力データ形式

### キャラクターデータ (data/characters.ts)

```typescript
export default [
  {
    id: "lycaon",
    name: { ja: "フォン・ライカン", en: "Von Lycaon" },
    fullName: { ja: "フォン・ライカン", en: "Von Lycaon" },
    specialty: "stun", // 撃破
    stats: "ice", // 氷属性
    assistType: "defensive", // パリィ支援
    faction: 2, // ヴィクトリア家政
    rarity: "S",
    attr: {
      hp: [677, 1967, 3350, 4732, 6114, 7498, 8416],
      atk: [105, 197, 296, 394, 494, 592, 653],
      def: [49, 141, 241, 340, 441, 540, 606],
      impact: 119,
      critRate: 5,
      critDmg: 50,
      anomalyMastery: 91,
      anomalyProficiency: 90,
      penRatio: 0,
      energy: 1.2,
    },
  },
  // ... 他のキャラクター
] as Character[];
```

### ボンプデータ (data/bomps.ts)

```typescript
export default [
  {
    id: "excaliboo",
    name: { ja: "セイケンボンプ", en: "Excaliboo" },
    stats: ["physical"], // 属性（配列形式）
    rarity: "A", // レア度（A級またはS級）
    releaseVersion: 1.0,
    faction: [1], // 陣営ID配列
    attr: {
      hp: [100, 200, 300, 400, 500, 600, 700],
      atk: [50, 100, 150, 200, 250, 300, 350],
      def: [30, 60, 90, 120, 150, 180, 210],
      impact: 10,
      critRate: 5,
      critDmg: 50,
      anomalyMastery: 0,
      anomalyProficiency: 0,
      penRatio: 0,
      energy: 100,
    },
    extraAbility: "『追加能力』の説明文",
  },
  // ... 他のボンプ
] as Bomp[];
```

### 陣営データ (data/factions.ts)

```typescript
export default [
  {
    id: 1,
    name: { ja: "邪兎屋", en: "Cunning Hares" },
  },
  {
    id: 2,
    name: { ja: "ヴィクトリア家政", en: "Victoria Housekeeping Co." },
  },
  // ... その他の陣営
] as Faction[];
```

## 開発情報

### 技術スタック

- **言語**: TypeScript
- **テストフレームワーク**: Vitest
- **HTTP クライアント**: Axios
- **実行環境**: ts-node（直接 TypeScript 実行）

### テスト構成

- **単体テスト**: 各コンポーネントの機能テスト
- **統合テスト**: エンドツーエンドのデータ処理テスト
- **カバレッジ**: 100+ 個のテストで全機能をカバー

### データソース

- **API**: HoyoLab ZZZ Wiki API
- **エンドポイント**: `https://sg-wiki-api-static.hoyolab.com/hoyowiki/zzz/wapi/entry_page`
- **データソース**: `Scraping.md`（キャラクター・ボンプリスト）
- **モックデータ**: `json/mock/`（テスト用データ）

## 機能詳細

### キャラクターデータ生成

- 全キャラクターの基本情報、ステータス、派閥情報を自動取得
- 日本語・英語の多言語対応
- 支援タイプ（回避支援・パリィ支援）の自動判定
- エラー耐性とグレースフル劣化

### ボンプデータ生成

- 全ボンプの基本情報、ステータス、追加能力を自動取得
- **レア度情報の自動抽出**（A 級・S 級の分類）
- 複数派閥への所属対応
- バッチ処理とリトライ機能
- 詳細な処理レポート生成

### 設定管理

- 環境別設定対応（開発・本番・テスト）
- API レート制限対応
- メモリ最適化とパフォーマンス監視

## ドキュメント

- [ボンプデータ生成ガイド](./docs/BOMP_GENERATION.md)
- [API 仕様](./docs/API.md)
- [使用方法とトラブルシューティング](./docs/USAGE_AND_TROUBLESHOOTING.md)
- [設定ガイド](./CONFIGURATION.md)

## ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。
