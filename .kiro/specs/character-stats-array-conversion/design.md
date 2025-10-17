# Design Document

## Overview

キャラクターデータの属性（stats）フィールドを単一の文字列値から文字列配列に変更する設計です。この変更により、将来的に複数の属性を持つキャラクターに対応できるようになります。特に霜烈属性（frost）と玄墨属性（auricInk）のキャラクターは、それぞれ複数の属性値を持つように変更されます。

## Architecture

### 影響を受けるコンポーネント

1. **型定義システム** (`src/types/index.ts`)

   - `Character`型の`stats`フィールドを`Stats`から`Stats[]`に変更
   - `Bomp`型の`stats`フィールドも同様に変更

2. **データ生成システム** (`src/generators/`)

   - `CharacterGenerator.ts`: 配列形式での出力に対応
   - `AllCharactersGenerator.ts`: 配列形式での出力に対応
   - `BompGenerator.ts`: 配列形式での出力に対応

3. **データ処理システム** (`src/processors/`, `src/mappers/`)

   - 既存の単一値処理ロジックを配列対応に変更
   - 特別な属性マッピングロジックの追加

4. **既存データファイル** (`data/characters.ts`)
   - 全キャラクターデータの移行

## Components and Interfaces

### 型定義の変更

```typescript
// Before
export type Character = {
  // ...
  stats: Stats;
  // ...
};

// After
export type Character = {
  // ...
  stats: Stats[];
  // ...
};
```

### 属性マッピングロジック

特別な属性に対する複数値マッピング：

```typescript
const STATS_ARRAY_MAPPING: Record<Stats, Stats[]> = {
  frost: ["ice", "frost"],
  auricInk: ["ether", "auricInk"],
  // その他の属性は単一値のまま
  electric: ["electric"],
  fire: ["fire"],
  ice: ["ice"],
  physical: ["physical"],
  ether: ["ether"],
};
```

## Data Models

### 移行前後のデータ構造

**移行前:**

```typescript
{
  id: "miyabi",
  stats: "frost",
  // ...
}
```

**移行後:**

```typescript
{
  id: "miyabi",
  stats: ["ice", "frost"],
  // ...
}
```

### 移行対象キャラクター

1. **霜烈属性キャラクター**: `stats: "frost"` → `stats: ["ice", "frost"]`

   - 雅（miyabi）

2. **玄墨属性キャラクター**: `stats: "auricInk"` → `stats: ["ether", "auricInk"]`

   - 儀玄（yixuan）

3. **その他全キャラクター**: `stats: "X"` → `stats: ["X"]`

## Error Handling

### 型安全性の確保

1. **コンパイル時チェック**: TypeScript の型システムで配列アクセスを強制
2. **ランタイム検証**: 配列が空でないことの確認
3. **後方互換性**: 既存のコードが段階的に移行できるよう配慮

### エラーケース

1. **空配列**: `stats: []` は無効として扱う
2. **無効な属性値**: 配列内に未定義の属性が含まれる場合
3. **型不整合**: 文字列が配列として扱われる場合

## Testing Strategy

### 単体テスト

1. **型定義テスト**: 新しい型定義が正しく動作することを確認
2. **マッピングロジックテスト**: 特別な属性の複数値マッピングをテスト
3. **生成器テスト**: 配列形式での出力が正しいことを確認

### 統合テスト

1. **データ移行テスト**: 全キャラクターデータが正しく移行されることを確認
2. **エンドツーエンドテスト**: データ生成から出力まで全体が動作することを確認
3. **後方互換性テスト**: 既存の機能が引き続き動作することを確認

### テスト対象ファイル

- `tests/types/TypeCompatibility.test.ts`: 型定義の互換性テスト
- `tests/generators/`: 各生成器の配列出力テスト
- `tests/integration/`: 統合テストの更新

## Implementation Considerations

### 段階的移行戦略

1. **Phase 1**: 型定義の更新
2. **Phase 2**: データ処理ロジックの更新
3. **Phase 3**: 既存データの移行
4. **Phase 4**: 生成器の更新
5. **Phase 5**: テストの更新

### パフォーマンス考慮事項

- 配列アクセスのオーバーヘッドは最小限
- メモリ使用量の増加は軽微（ほとんどのキャラクターは単一要素配列）
- 既存の処理速度への影響は無視できる程度

### 保守性

- 新しい複数属性キャラクターの追加が容易
- 属性マッピングロジックの拡張が可能
- 型安全性により実行時エラーを防止
