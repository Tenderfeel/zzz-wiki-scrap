# 設計ドキュメント

## 概要

この設計は、現在のキャラクターデータ生成システムから攻撃タイプ（AttackType）機能を完全に削除するための包括的なアプローチを定義します。攻撃タイプに関連するすべてのコード、型定義、テスト、設定を体系的に除去し、システムを攻撃タイプ機能がない状態に戻します。

## アーキテクチャ

### 現在のシステム構造（攻撃タイプ機能あり）

```
DataProcessor → AttackTypeFallback → DataMapper → CharacterGenerator
     ↓               ↓                   ↓              ↓
ProcessedData → Enhanced Data → AttackType → Character Object
                                    ↓              ↓
                              (attackType field) (with AttackType)
```

### 削除後のシステム構造（攻撃タイプ機能なし）

```
DataProcessor → DataMapper → CharacterGenerator
     ↓              ↓              ↓
ProcessedData → Mapped Data → Character Object
                     ↓              ↓
               (no attackType) (without AttackType)
```

### 削除対象コンポーネント

1. **AttackTypeFallbackService** - 完全削除
2. **AttackType 型定義** - 完全削除
3. **攻撃タイプマッピング機能** - DataMapper から削除
4. **攻撃タイプフィールド** - Character 型から削除
5. **関連テスト** - 完全削除

## コンポーネントと インターフェース

### 1. 削除対象ファイル

以下のファイルを完全に削除します：

```
src/services/AttackTypeFallbackService.ts
tests/services/AttackTypeFallbackService.test.ts
tests/integration/AttackTypeFallback.integration.test.ts
tests/integration/AttackTypeFallback.performance.test.ts
```

### 2. 修正対象ファイル

#### src/types/index.ts

```typescript
// 削除前
export type AttackType = "slash" | "pierce" | "strike";

export type Character = {
  id: number;
  name: { [key in Lang]: string };
  fullName: { [key in Lang]: string };
  specialty: Specialty;
  stats: Stats;
  attackType: AttackType; // ← この行を削除
  faction: Faction;
  rarity: Rarity;
  attr: Attributes;
};

// 削除後
export type Character = {
  id: number;
  name: { [key in Lang]: string };
  fullName: { [key in Lang]: string };
  specialty: Specialty;
  stats: Stats;
  faction: Faction;
  rarity: Rarity;
  attr: Attributes;
};
```

#### src/mappers/DataMapper.ts

```typescript
// 削除前
export class DataMapper {
  private attackTypeFallback: AttackTypeFallbackService;

  public mapAttackType(rawAttackType: string, pageId?: string): AttackType;
  private mapAttackTypeWithFallback(
    rawAttackType: string,
    pageId: string
  ): AttackType;
}

// 削除後
export class DataMapper {
  // AttackTypeFallbackService 関連のプロパティとメソッドを削除
  // mapAttackType メソッドを完全に削除
}
```

#### src/generators/CharacterGenerator.ts

```typescript
// 削除前
const character: Character = {
  id: pageId,
  name: characterName,
  fullName: characterFullName,
  specialty: this.dataMapper.mapSpecialty(specialtyValue),
  stats: this.dataMapper.mapStats(statsValue),
  attackType: this.dataMapper.mapAttackType(attackTypeValue, pageId.toString()), // ← この行を削除
  faction: faction,
  rarity: this.dataMapper.mapRarity(rarityValue),
  attr: attributes,
};

// 削除後
const character: Character = {
  id: pageId,
  name: characterName,
  fullName: characterFullName,
  specialty: this.dataMapper.mapSpecialty(specialtyValue),
  stats: this.dataMapper.mapStats(statsValue),
  faction: faction,
  rarity: this.dataMapper.mapRarity(rarityValue),
  attr: attributes,
};
```

### 3. API データ処理の変更

#### src/processors/DataProcessor.ts

```typescript
// 削除前
const attackTypeValue = this.extractAttackType(pageData);

// 削除後
// agent_attack_type フィールドの抽出処理を削除
```

## データモデル

### 削除される型定義

```typescript
// 完全に削除される型
export type AttackType = "slash" | "pierce" | "strike";

// 削除される定数
const ATTACK_TYPE_MAPPING: Record<string, AttackType> = {
  打撃: "strike",
  斬撃: "slash",
  刺突: "pierce",
};

const ENGLISH_ATTACK_TYPE_MAPPING: Record<string, AttackType> = {
  Slash: "slash",
  Pierce: "pierce",
  Strike: "strike",
};
```

### 更新される型定義

```typescript
// Character 型から attackType フィールドを削除
export type Character = {
  id: number;
  name: { [key in Lang]: string };
  fullName: { [key in Lang]: string };
  specialty: Specialty;
  stats: Stats;
  // attackType: AttackType; ← 削除
  faction: Faction;
  rarity: Rarity;
  attr: Attributes;
};
```

## エラーハンドリング

### 削除される エラーハンドリング

1. **攻撃タイプ取得失敗時の処理**

   - フォールバック機能の呼び出し
   - デフォルト値 "strike" の設定
   - 攻撃タイプ関連のエラーログ

2. **AttackTypeFallbackService のエラー処理**
   - list.json ファイル読み込みエラー
   - JSON 解析エラー
   - 未知の攻撃タイプ値の処理

### 残存する エラーハンドリング

既存の他の機能（specialty, stats, faction, rarity, attr）のエラーハンドリングは維持されます。

## テスト戦略

### 削除対象テスト

1. **単体テスト**

   - `tests/services/AttackTypeFallbackService.test.ts`
   - `tests/mappers/DataMapper.test.ts` の攻撃タイプ関連テストケース
   - `tests/generators/CharacterGenerator.test.ts` の攻撃タイプ関連テストケース

2. **統合テスト**
   - `tests/integration/AttackTypeFallback.integration.test.ts`
   - `tests/integration/AttackTypeFallback.performance.test.ts`
   - 他の統合テストファイルの攻撃タイプ関連テストケース

### 更新対象テスト

1. **Character オブジェクト生成テスト**

   - 期待値から attackType フィールドを削除
   - アサーション文から攻撃タイプチェックを削除

2. **型定義テスト**
   - AttackType 型の参照を削除
   - Character 型のテストから attackType フィールドを削除

### 新規テスト

攻撃タイプ削除後の動作確認テスト：

```typescript
describe("Attack Type Removal Verification", () => {
  it("should generate character without attackType field", () => {
    const character = generateCharacter(mockData);
    expect(character).not.toHaveProperty("attackType");
  });

  it("should compile TypeScript without AttackType references", () => {
    // TypeScript コンパイルエラーがないことを確認
  });
});
```

## 実装の詳細

### 削除手順

1. **段階的削除アプローチ**

   - テストファイルから削除開始
   - サービスクラスの削除
   - 型定義の削除
   - メインロジックからの削除

2. **依存関係の解決**

   - import 文の削除
   - 未使用変数の削除
   - 型参照の削除

3. **コンパイルエラーの修正**
   - TypeScript エラーの段階的解決
   - テストエラーの修正

### 影響範囲の分析

#### 直接影響を受けるファイル

```
src/types/index.ts
src/mappers/DataMapper.ts
src/generators/CharacterGenerator.ts
src/processors/DataProcessor.ts
src/services/AttackTypeFallbackService.ts (削除)
```

#### 間接影響を受けるファイル

```
tests/ 配下の関連テストファイル
data/characters.ts (生成ファイル)
json/ 配下の中間ファイル
```

### パフォーマンス への影響

1. **改善される点**

   - list.json ファイルの読み込み処理が不要
   - 攻撃タイプマッピング処理の削除による CPU 使用量削減
   - メモリ使用量の削減

2. **変更されない点**
   - 他のフィールド処理のパフォーマンス
   - API リクエスト回数
   - 全体的な処理時間（攻撃タイプ処理は軽量）

## セキュリティ考慮事項

### 削除による影響

- list.json ファイル読み込み処理の削除により、ファイルアクセス関連のセキュリティリスクが軽減
- 攻撃タイプデータの処理が不要になることで、データ検証の複雑性が軽減

### 残存するセキュリティ要件

- 他のフィールドのデータ検証は継続
- API レスポンスの適切な処理は維持

## 監視とログ

### 削除されるログ

```
[INFO] AttackType fallback used for character pageId: 28, result: strike
[WARN] Unknown attack type value: "Unknown", using default: strike
[DEBUG] Character found in list.json: pageId=28, name=Von Lycaon
```

### 残存するログ

他のフィールド処理に関するログは維持されます：

```
[INFO] Character generated successfully: pageId=28, name=Von Lycaon
[WARN] Missing specialty data for character: pageId=28
[ERROR] Failed to process character data: pageId=28
```

## 移行計画

### 既存データの処理

1. **生成済みファイルの更新**

   - `data/characters.ts` の再生成（attackType フィールドなし）
   - 中間 JSON ファイルの更新

2. **設定ファイルの更新**
   - 攻撃タイプ関連の設定項目削除
   - ドキュメントの更新

### 後方互換性

- 攻撃タイプフィールドを期待する外部システムがある場合は、事前に通知が必要
- API の変更により、消費者側での対応が必要な場合があります

## 検証方法

### 削除完了の確認

1. **コード検索**

   ```bash
   grep -r "AttackType" src/
   grep -r "attackType" src/
   grep -r "attack_type" src/
   ```

2. **TypeScript コンパイル**

   ```bash
   npm run build
   ```

3. **テスト実行**

   ```bash
   npm test
   ```

4. **データ生成テスト**
   ```bash
   npm run generate
   ```

### 成功基準

- すべてのテストが通過
- TypeScript コンパイルエラーなし
- 生成されるキャラクターデータに attackType フィールドが含まれない
- 攻撃タイプ関連のコードが完全に削除されている
