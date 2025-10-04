# 設計ドキュメント

## 概要

この設計は、wiki データから攻撃タイプを取得できなかった場合のフォールバック機能として、`json/data/list.json` から攻撃タイプ情報を取得する仕組みを実装します。現在のキャラクターデータ生成システムに最小限の変更でシームレスに統合され、既存のワークフローを維持しながら、データ取得の信頼性を向上させます。

## アーキテクチャ

### 現在のシステム構造

```
DataProcessor → DataMapper → CharacterGenerator
     ↓              ↓              ↓
ProcessedData → AttackType → Character Object
```

### 新しいフォールバック機能の統合

```
DataProcessor → AttackTypeFallback → DataMapper → CharacterGenerator
     ↓               ↓                   ↓              ↓
ProcessedData → Enhanced Data → AttackType → Character Object
```

### データフロー

1. **主要パス**: wiki データから攻撃タイプを正常に取得
2. **フォールバックパス**: wiki データから取得失敗時、`json/data/list.json` から取得
3. **エラーハンドリング**: 両方のソースから取得失敗時、デフォルト値を使用

## コンポーネントと インターフェース

### 1. AttackTypeFallbackService

新しいサービスクラスで、攻撃タイプのフォールバック機能を提供します。

```typescript
export class AttackTypeFallbackService {
  private listData: ListJsonData | null = null;
  private isInitialized: boolean = false;

  // list.jsonデータの初期化（一度だけ実行）
  public async initialize(): Promise<void>;

  // キャラクターIDに基づいて攻撃タイプを取得
  public getAttackTypeByPageId(pageId: string): AttackType | null;

  // 英語の攻撃タイプ値をenum値にマッピング
  private mapEnglishAttackType(englishValue: string): AttackType | null;
}
```

### 2. 拡張された DataMapper

既存の `DataMapper` クラスに攻撃タイプのフォールバック機能を統合します。

```typescript
export class DataMapper {
  private attackTypeFallback: AttackTypeFallbackService;

  // 既存のmapAttackTypeメソッドを拡張
  public mapAttackType(rawAttackType: string, pageId?: string): AttackType;

  // フォールバック機能付きの攻撃タイプマッピング
  private mapAttackTypeWithFallback(
    rawAttackType: string,
    pageId: string
  ): AttackType;
}
```

### 3. 新しい型定義

`json/data/list.json` のデータ構造に対応する型定義を追加します。

```typescript
// list.jsonのデータ構造
export interface ListJsonData {
  retcode: number;
  message: string;
  data: {
    list: CharacterListItem[];
  };
}

export interface CharacterListItem {
  entry_page_id: string;
  name: string;
  filter_values: {
    agent_attack_type?: {
      values: string[];
      value_types: AttackTypeValueType[];
    };
  };
}

export interface AttackTypeValueType {
  id: string;
  value: string;
  enum_string: string;
}
```

## データモデル

### 攻撃タイプマッピング

英語の攻撃タイプ値から enum 値へのマッピング：

```typescript
const ENGLISH_ATTACK_TYPE_MAPPING: Record<string, AttackType> = {
  Slash: "slash",
  Pierce: "pierce",
  Strike: "strike",
};
```

### フォールバック優先順位

1. **第一優先**: wiki データの日本語攻撃タイプ（既存の動作）
2. **第二優先**: `json/data/list.json` の英語攻撃タイプ
3. **デフォルト**: "strike"（エラー時）

## エラーハンドリング

### エラーケースと対応

1. **list.json ファイルが存在しない**

   - ログに警告を出力
   - フォールバック機能を無効化
   - 既存の動作を継続

2. **list.json の解析に失敗**

   - エラーログを出力
   - フォールバック機能を無効化
   - 既存の動作を継続

3. **キャラクターが list.json に存在しない**

   - デバッグログを出力
   - デフォルト値 "strike" を使用

4. **未知の攻撃タイプ値**
   - 警告ログを出力
   - デフォルト値 "strike" を使用

### ログレベル

- **INFO**: フォールバック機能の使用
- **WARN**: ファイル読み込みエラー、未知の攻撃タイプ
- **DEBUG**: キャラクター検索結果、マッピング詳細
- **ERROR**: 重大なシステムエラー

## テスト戦略

### 単体テスト

1. **AttackTypeFallbackService**

   - list.json の正常読み込み
   - ファイル不存在時の処理
   - 攻撃タイプマッピングの正確性
   - キャラクター検索機能

2. **拡張された DataMapper**
   - フォールバック機能付きマッピング
   - 既存機能の互換性
   - エラーハンドリング

### 統合テスト

1. **正常フロー**

   - wiki データから正常取得
   - フォールバック機能の動作
   - 最終的な Character オブジェクトの生成

2. **エラーシナリオ**
   - 各種エラーケースでの動作
   - ログ出力の確認
   - システムの継続動作

### テストデータ

```typescript
// テスト用のlist.jsonデータ
const mockListData = {
  retcode: 0,
  message: "OK",
  data: {
    list: [
      {
        entry_page_id: "28",
        name: "Von Lycaon",
        filter_values: {
          agent_attack_type: {
            values: ["Strike"],
            value_types: [
              {
                id: "15",
                value: "Strike",
                enum_string: "strike",
              },
            ],
          },
        },
      },
    ],
  },
};
```

## 実装の詳細

### フォールバック機能の統合ポイント

現在の `DataMapper.mapAttackType()` メソッドを拡張し、以下の流れで処理します：

1. 既存の日本語マッピングを試行
2. 失敗時、pageId を使用してフォールバック機能を呼び出し
3. フォールバック結果を返すか、デフォルト値を使用

### パフォーマンス考慮事項

- `json/data/list.json` の読み込みは初回のみ実行
- メモリ上にキャッシュして再利用
- 大きなファイルサイズに対応するため、必要な部分のみ抽出

### 既存コードへの影響

- `DataMapper` クラスの `mapAttackType` メソッドのシグネチャを拡張
- `CharacterGenerator` から pageId を渡すように修正
- 既存のテストケースは変更不要（後方互換性を維持）

## セキュリティ考慮事項

- ファイル読み込み時のパス検証
- JSON 解析時の例外処理
- 不正なデータに対する適切なバリデーション

## 監視とログ

### メトリクス

- フォールバック機能の使用回数
- 各攻撃タイプの取得成功率
- エラー発生頻度

### ログ形式

```
[INFO] AttackType fallback used for character pageId: 28, result: strike
[WARN] Unknown attack type value: "Unknown", using default: strike
[DEBUG] Character found in list.json: pageId=28, name=Von Lycaon
```
