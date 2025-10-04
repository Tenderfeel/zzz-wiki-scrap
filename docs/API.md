# API ドキュメント

## 概要

このドキュメントでは、攻撃タイプフォールバック機能の実装で追加・拡張されたクラスとメソッドの API について説明します。

## AttackTypeFallbackService

`json/data/list.json` から攻撃タイプ情報を取得し、wiki データから取得できなかった場合のフォールバック機能を提供するサービスクラスです。

### クラス概要

```typescript
export class AttackTypeFallbackService {
  private listData: ListJsonData | null = null;
  private isInitialized: boolean = false;
}
```

### メソッド

#### `initialize(): Promise<void>`

list.json データの初期化を行います。一度だけ実行され、ファイルの存在確認、読み込み、JSON 解析を行います。

**パラメータ:** なし

**戻り値:** `Promise<void>`

**動作:**

- 既に初期化済みの場合は何もしない
- `json/data/list.json` ファイルの存在を確認
- ファイルを読み込み、JSON として解析
- データ構造の基本的な検証を実行
- エラー時は適切なログを出力し、処理を継続

**例外処理:**

- ファイルが存在しない場合: 警告ログを出力し、初期化完了とする
- JSON 解析エラー: エラーログを出力し、`listData` を `null` に設定

#### `getAttackTypeByPageId(pageId: string): AttackType | null`

キャラクターのページ ID に基づいて攻撃タイプを取得します。

**パラメータ:**

- `pageId` (string): キャラクターのページ ID

**戻り値:** `AttackType | null`

- 攻撃タイプが見つかった場合: 対応する `AttackType` 値
- 見つからない場合: `null`

**動作:**

1. 初期化状態とデータの存在を確認
2. `entry_page_id` でキャラクターを検索
3. 攻撃タイプ情報の存在を確認
4. 複数攻撃タイプがある場合は最初の値を使用
5. 英語の攻撃タイプを enum 値にマッピング

**ログ出力:**

- DEBUG: キャラクター検索結果
- DEBUG: マッピング結果
- WARN: 未知の攻撃タイプ値

## DataMapper (拡張)

既存の `DataMapper` クラスに攻撃タイプのフォールバック機能が統合されました。

### 新しいコンストラクタ

```typescript
constructor() {
  this.attackTypeFallback = new AttackTypeFallbackService();
  // サービスの初期化（非同期）
}
```

**動作:**

- `AttackTypeFallbackService` のインスタンスを作成
- バックグラウンドでサービスの初期化を実行
- 初期化エラー時は適切なログを出力

### 拡張されたメソッド

#### `mapAttackType(rawAttackType: string, pageId?: string): AttackType`

日本語の攻撃タイプ名を英語の列挙値にマッピングします。フォールバック機能付きで、wiki データから取得できない場合は `json/data/list.json` からの取得を試行します。

**パラメータ:**

- `rawAttackType` (string): 日本語の攻撃タイプ名
- `pageId` (string, オプション): キャラクターのページ ID（フォールバック用）

**戻り値:** `AttackType`

**動作フロー:**

1. 既存の日本語マッピングを優先して試行
2. 成功した場合: マッピング結果を返す
3. 失敗し、`pageId` が提供されている場合: フォールバック機能を使用
4. フォールバックも失敗した場合: `MappingError` をスロー

**例外:**

- `MappingError`: 未知の攻撃タイプ名でフォールバックも失敗した場合

**ログ出力:**

- DEBUG: wiki データ使用時
- INFO: フォールバック機能使用時
- WARN: デフォルト値使用時

### 新しいプライベートメソッド

#### `mapAttackTypeWithFallback(rawAttackType: string, pageId: string): AttackType`

フォールバック機能付きの攻撃タイプマッピングを実行します。

**パラメータ:**

- `rawAttackType` (string): 日本語の攻撃タイプ名（失敗したもの）
- `pageId` (string): キャラクターのページ ID

**戻り値:** `AttackType`

**動作:**

1. `AttackTypeFallbackService` を使用してフォールバック取得を試行
2. 成功した場合: フォールバック結果を返す
3. 失敗した場合: デフォルト値 "strike" を返す
4. エラー時: エラーログを出力し、デフォルト値 "strike" を返す

## 新しい型定義

### ListJsonData

`json/data/list.json` のデータ構造を表現する型です。

```typescript
export interface ListJsonData {
  retcode: number;
  message: string;
  data: {
    list: CharacterListItem[];
  };
}
```

### CharacterListItem

list.json 内の個別キャラクター情報を表現する型です。

```typescript
export interface CharacterListItem {
  entry_page_id: string;
  name: string;
  icon_url: string;
  display_field: {
    materials: string;
    [key: string]: string;
  };
  filter_values: {
    agent_attack_type?: {
      values: string[];
      value_types: AttackTypeValueType[];
      key: null;
    };
    // その他のフィルター値...
  };
  desc: string;
}
```

### AttackTypeValueType

攻撃タイプの詳細情報を表現する型です。

```typescript
export interface AttackTypeValueType {
  id: string;
  value: string;
  mi18n_key: string;
  icon: string;
  enum_string: string;
}
```

## 使用例

### 基本的な使用方法

```typescript
import { DataMapper } from "./mappers/DataMapper.js";

const mapper = new DataMapper();

// 既存の日本語マッピング（従来通り）
const attackType1 = mapper.mapAttackType("打撃"); // "strike"

// フォールバック機能付きマッピング
const attackType2 = mapper.mapAttackType("未知の値", "28"); // フォールバック実行
```

### AttackTypeFallbackService の直接使用

```typescript
import { AttackTypeFallbackService } from "./services/AttackTypeFallbackService.js";

const service = new AttackTypeFallbackService();
await service.initialize();

const attackType = service.getAttackTypeByPageId("28"); // "strike" または null
```

## エラーハンドリング

### MappingError

未知の攻撃タイプ値でフォールバックも失敗した場合にスローされます。

```typescript
try {
  const attackType = mapper.mapAttackType("未知の値"); // pageId なし
} catch (error) {
  if (error instanceof MappingError) {
    console.error("マッピングエラー:", error.message);
  }
}
```

### ログレベル

- **INFO**: フォールバック機能の使用、サービス初期化完了
- **WARN**: ファイル読み込みエラー、未知の攻撃タイプ、デフォルト値使用
- **DEBUG**: キャラクター検索結果、マッピング詳細
- **ERROR**: 重大なシステムエラー、初期化エラー

## パフォーマンス考慮事項

- `json/data/list.json` の読み込みは初回のみ実行
- メモリ上にキャッシュして再利用
- 初期化は非同期で実行され、コンストラクタをブロックしない
- エラー時も処理を継続し、システム全体の安定性を保つ
