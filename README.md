# Lycan Character Data

HoyoLab ZZZ Wiki API からライカンのキャラクターデータを取得し、TypeScript 形式で出力するプロジェクトです。

## 概要

このプロジェクトは、Zenless Zone Zero（ZZZ）のキャラクター「フォン・ライカン」のデータを HoyoLab Wiki API から取得し、構造化された TypeScript ファイルとして出力します。

## プロジェクト構造

```
.
├── data/                    # 生成されたデータファイル
│   ├── characters.ts        # キャラクターデータ
│   └── factions.ts         # 陣営データ
├── json/mock/              # モックデータ
│   └── lycaon.json         # ライカンのAPIレスポンスデータ
├── src/                    # ソースコード
│   ├── clients/            # APIクライアント
│   ├── generators/         # データ生成器
│   ├── loaders/           # ファイルローダー
│   ├── mappers/           # データマッパー
│   ├── processors/        # データプロセッサー
│   ├── types/             # 型定義
│   └── main.ts            # メインエントリーポイント
└── tests/                 # テストファイル
```

## スクリプトコマンド

### データ生成

| コマンド           | 説明                               |
| ------------------ | ---------------------------------- |
| `npm run generate` | ライカンのキャラクターデータを生成 |

**使用例:**

```bash
# キャラクターデータを生成
npm run generate
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

### 2. キャラクターデータの生成

```bash
npm run generate
```

### 3. 生成されたファイルの確認

生成されたファイルは `data/` ディレクトリに保存されます：

- `data/characters.ts` - ライカンのキャラクターデータ
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
    attackType: "strike", // 打撃
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
] as Character[];
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
- **カバレッジ**: 85 個のテストで全機能をカバー

### データソース

- **API**: HoyoLab ZZZ Wiki API
- **エンドポイント**: `https://sg-wiki-api-static.hoyolab.com/hoyowiki/zzz/wapi/entry_page`
- **モックデータ**: `json/mock/lycaon.json`

## ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。
