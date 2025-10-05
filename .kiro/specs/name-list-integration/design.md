# 設計書

## 概要

現在のシステムは HoyoLab API レスポンスからキャラクター名を取得していますが、Scraping.md で定義された固定の名前リストを使用するように変更します。この変更により、キャラクター名の一貫性と制御性が向上し、API レスポンスの変動に依存しない安定したデータ生成が実現されます。

## アーキテクチャ

### 現在のデータフロー

```
API Response → DataProcessor.extractBasicInfo() → DataMapper.createMultiLangName() → Character Object
```

### 新しいデータフロー

```
Scraping.md Name List → NameResolver → DataMapper.createMultiLangName() → Character Object
                                    ↓ (fallback)
API Response → DataProcessor.extractBasicInfo() → DataMapper.createMultiLangName()
```

### 主要な変更点

1. **新しいコンポーネント**: `NameResolver`クラスの追加
2. **DataMapper の拡張**: 名前解決機能の統合
3. **CharacterGenerator の修正**: 名前取得ロジックの変更
4. **設定ファイル**: 名前マッピングの外部化

## コンポーネントと インターフェース

### 1. NameResolver クラス

**場所**: `src/mappers/NameResolver.ts`

**責任**:

- Scraping.md の名前リストを読み込み・解析
- キャラクター ID から名前マッピングを取得
- フォールバック処理の実装

**インターフェース**:

```typescript
interface NameMapping {
  ja: string;
  en: string;
}

interface NameMappings {
  [characterId: string]: NameMapping;
}

class NameResolver {
  private nameMappings: NameMappings;

  constructor();
  loadNameMappings(): void;
  resolveNames(characterId: string): NameMapping | null;
  hasMapping(characterId: string): boolean;
  validateMappings(): boolean;
}
```

### 2. DataMapper クラスの拡張

**既存機能の保持**:

- 特性、属性、レア度のマッピング機能
- 多言語オブジェクト生成機能

**新機能の追加**:

```typescript
class DataMapper {
  private nameResolver: NameResolver;

  // 新しいメソッド
  createNamesFromMapping(characterId: string): { [key in Lang]: string } | null;
  createNamesWithFallback(
    characterId: string,
    fallbackJaName: string,
    fallbackEnName: string
  ): { [key in Lang]: string };
}
```

### 3. CharacterGenerator クラスの修正

**変更点**:

- `generateCharacter`メソッドでの名前取得ロジック変更
- キャラクター ID の決定方法の明確化

**新しい実装**:

```typescript
generateCharacter(
  jaData: ProcessedData,
  enData: ProcessedData,
  characterId: string // 明示的にキャラクターIDを受け取る
): Character {
  // 1. 事前定義された名前マッピングを試行
  const mappedNames = this.dataMapper.createNamesFromMapping(characterId);

  // 2. フォールバック処理
  const names = mappedNames || this.dataMapper.createNamesWithFallback(
    characterId,
    jaData.basicInfo.name,
    enData.basicInfo.name
  );

  // Character オブジェクト構築
  return {
    id: characterId,
    name: names,
    fullName: names, // 同じ値を使用
    // ... 他のプロパティ
  };
}
```

## データモデル

### 名前マッピング設定ファイル

**場所**: `src/config/name-mappings.json`

**構造**:

```json
{
  "anby": { "ja": "アンビー", "en": "Anby" },
  "billy": { "ja": "ビリー", "en": "Billy" },
  "nicole": { "ja": "ニコ", "en": "Nicole" },
  "nekomata": { "ja": "猫又", "en": "Necomata" },
  "soldier11": { "ja": "11号", "en": "Soldier 11" },
  "corin": { "ja": "カリン", "en": "Corin" },
  "anton": { "ja": "アンドー", "en": "Anton" },
  "ben": { "ja": "ベン", "en": "Ben" },
  "koleda": { "ja": "クレタ", "en": "Koleda" },
  "grace": { "ja": "グレース", "en": "Grace" },
  "lycaon": { "ja": "ライカン", "en": "Lycaon" },
  "ellen": { "ja": "エレン", "en": "Ellen" },
  "rina": { "ja": "リナ", "en": "Rina" },
  "zhuyuan": { "ja": "朱鳶", "en": "Zhu Yuan" },
  "soukaku": { "ja": "蒼角", "en": "Soukaku" },
  "lucy": { "ja": "ルーシー", "en": "Lucy" },
  "piper": { "ja": "パイパー", "en": "Piper" },
  "qingyi": { "ja": "青衣", "en": "Qingyi" },
  "jane": { "ja": "ジェーン", "en": "Jane" },
  "seth": { "ja": "セス", "en": "Seth" },
  "caesar": { "ja": "シーザー", "en": "Caesar" },
  "burnice": { "ja": "バーニス", "en": "Burnice" },
  "yanagi": { "ja": "柳", "en": "Yanagi" },
  "lighter": { "ja": "ライト", "en": "Lighter" },
  "miyabi": { "ja": "雅", "en": "Miyabi" },
  "harumasa": { "ja": "悠真", "en": "Harumasa" },
  "astra": { "ja": "アストラ", "en": "Astra" },
  "evelyn": { "ja": "イヴリン", "en": "Evelyn" },
  "soldier0anby": { "ja": "0号アンビー", "en": "0-Anby" },
  "pulchra": { "ja": "プルクラ", "en": "Pulchra" },
  "trigger": { "ja": "トリガー", "en": "Trigger" },
  "vivian": { "ja": "ビビアン", "en": "Vivian" },
  "hugo": { "ja": "ヒューゴ", "en": "Hugo" },
  "jufufu": { "ja": "橘福福", "en": "Ju Fufu" },
  "pan": { "ja": "潘引壺", "en": "Pan" },
  "yixuan": { "ja": "儀玄", "en": "Yixuan" },
  "yuzuha": { "ja": "柚葉", "en": "Yuzuha" },
  "alice": { "ja": "アリス", "en": "Alice" },
  "seed": { "ja": "シード", "en": "Seed" },
  "orphie": { "ja": "オルペウス", "en": "Orphie" }
}
```

### 型定義の追加

**場所**: `src/types/index.ts`に追加

```typescript
export interface NameMapping {
  ja: string;
  en: string;
}

export interface NameMappings {
  [characterId: string]: NameMapping;
}
```

## エラーハンドリング

### 新しいエラータイプ

**場所**: `src/errors/index.ts`に追加

```typescript
export class NameMappingError extends Error {
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = "NameMappingError";
    this.cause = cause;
  }
}
```

### エラーシナリオと対応

1. **名前マッピングファイルが見つからない**

   - ログ警告を出力
   - 全てのキャラクターでフォールバック処理を使用

2. **名前マッピングファイルの形式が無効**

   - NameMappingError をスロー
   - 処理を停止

3. **特定のキャラクター ID のマッピングが見つからない**

   - 警告ログを出力
   - API レスポンスの名前にフォールバック

4. **フォールバック時に API レスポンスの名前も無効**
   - ValidationError をスロー
   - そのキャラクターの処理をスキップ

## テスト戦略

### 単体テスト

1. **NameResolver クラス**

   - 名前マッピングの読み込み
   - 有効なキャラクター ID での名前解決
   - 無効なキャラクター ID での null 返却
   - マッピング検証機能

2. **DataMapper クラス（拡張部分）**

   - 名前マッピングからの多言語オブジェクト生成
   - フォールバック処理
   - エラーハンドリング

3. **CharacterGenerator クラス（修正部分）**
   - 名前マッピング優先の処理
   - フォールバック処理
   - キャラクター ID 設定

### 統合テスト

1. **完全なデータフロー**

   - 名前マッピング使用時の正常処理
   - フォールバック処理の動作確認
   - 生成された Character オブジェクトの検証

2. **エラーシナリオ**
   - 名前マッピングファイル不在時の動作
   - 部分的なマッピング不在時の動作

### パフォーマンステスト

1. **名前解決の処理速度**
   - 大量キャラクター処理時の性能
   - メモリ使用量の確認

## 実装の詳細

### フェーズ 1: NameResolver の実装

1. `src/mappers/NameResolver.ts`の作成
2. 名前マッピング設定ファイルの作成
3. 基本的な名前解決機能の実装

### フェーズ 2: DataMapper の拡張

1. NameResolver の統合
2. 新しい名前生成メソッドの追加
3. フォールバック処理の実装

### フェーズ 3: CharacterGenerator の修正

1. 名前取得ロジックの変更
2. キャラクター ID 処理の明確化
3. エラーハンドリングの強化

### フェーズ 4: テストとバリデーション

1. 単体テストの作成
2. 統合テストの実行
3. 既存機能の回帰テスト

## 後方互換性

### 保持される機能

1. **Character 型の構造**: 変更なし
2. **生成されるファイル形式**: 変更なし
3. **他のマッピング機能**: 特性、属性、レア度のマッピングは変更なし
4. **API**: 公開インターフェースは変更なし

### 変更される動作

1. **名前の取得元**: API レスポンス → 事前定義マッピング
2. **フォールバック処理**: 新しい警告ログの追加
3. **設定ファイル**: 新しい名前マッピング設定の追加

## 設定管理

### 名前マッピングの更新手順

1. `src/config/name-mappings.json`を編集
2. 新しいキャラクターの追加または既存キャラクターの名前修正
3. システム再起動（設定の再読み込み）

### 設定の検証

1. 起動時の設定ファイル検証
2. 必須フィールド（ja, en）の存在確認
3. 重複キーの検出
