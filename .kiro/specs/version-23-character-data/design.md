# Design Document

## Overview

バージョン 2.3 キャラクター（lucia, manato, yidhari）を既存の ZZZ キャラクターデータ処理システムに統合するための設計です。既存のアーキテクチャを活用し、新キャラクターの entry_page_id（907, 908, 909）を処理対象に追加します。部分的なデータ欠損に対応する汎用的なグレースフル劣化処理を実装します。

## Architecture

既存のレイヤードアーキテクチャを維持し、新キャラクター処理を統合します：

```
HoyoLab API (entry_page_id: 907, 908, 909)
    ↓
EnhancedApiClient (ja-jp優先、en-usフォールバック)
    ↓
DataProcessor (基本情報・陣営・属性抽出)
    ↓
DataMapper (日本語→英語マッピング)
    ↓
CharacterGenerator (Character型生成)
    ↓
data/characters.ts (既存配列に追加)
```

### 処理フロー

1. **設定更新**: processing-config.json に新キャラクター ID 追加
2. **API 取得**: 既存の EnhancedApiClient で 907, 908, 909 を処理
3. **データ抽出**: DataProcessor で各キャラクターの情報を抽出
4. **エラーハンドリング**: 部分的データ欠損に対する汎用的な処理
5. **統合出力**: 既存 characters.ts に新キャラクターを追加

## Components and Interfaces

### 2. Enhanced Data Processor

**既存**: `src/processors/DataProcessor.ts`

新機能追加：

- 汎用的な部分データハンドリング機能
- データ欠損パターンの自動検出
- 部分的データでの Character 生成サポート

```typescript
interface PartialCharacterData {
  id: string;
  hasBasicInfo: boolean;
  hasAttributesInfo: boolean;
  hasFactionInfo: boolean;
  missingFields: string[];
}
```

### 3. Partial Data Handler

**新規**: `src/utils/PartialDataHandler.ts`

```typescript
class PartialDataHandler {
  detectMissingFields(apiData: ApiResponse): string[];
  handlePartialData(
    apiData: ApiResponse,
    missingFields: string[]
  ): ProcessedData | null;
  createPartialCharacter(partialData: PartialCharacterData): Character | null;
  getEmptyValues(characterId: string): Partial<Character>;
  validatePartialData(data: Partial<ProcessedData>): boolean;
  fillMissingFieldsWithEmpty(character: Partial<Character>): Character;
}
```

### 4. Character Generator Extension

**既存**: `src/generators/CharacterGenerator.ts`

拡張機能：

- 部分的データからの Character 生成
- 汎用的な空の値適用システム
- 柔軟なキャラクター検証ルール

## Data Models

### Version 2.3 Character Specifications

**lucia (pageId: 907)**

- 完全なデータセット期待
- 標準的な処理フロー適用
- releaseVersion: 2.4

**manato (pageId: 908)**

- 完全なデータセット期待
- 標準的な処理フロー適用
- releaseVersion: 2.4

**yidhari (pageId: 909)**

- ステータス情報のみ利用可能
- specialty, attackType, faction 情報が欠損
- 汎用的な部分データハンドリングで対応

### Empty Values Strategy

```typescript
const EMPTY_VALUES_CONFIG = {
  specialty: undefined,
  stats: [],
  attackType: undefined,
  faction: undefined,
  rarity: undefined,
  assistType: undefined,
  releaseVersion: 2.4,
};

// 必須フィールドのみ最小限の値を設定
const MINIMAL_REQUIRED_VALUES = {
  id: "", // 実際のキャラクターIDで上書き
  name: { ja: "", en: "" }, // 実際の名前で上書き
  fullName: { ja: "", en: "" }, // 実際のフルネームで上書き
  attr: {
    hp: [0, 0, 0, 0, 0, 0, 0],
    atk: [0, 0, 0, 0, 0, 0, 0],
    def: [0, 0, 0, 0, 0, 0, 0],
    impact: 0,
    critRate: 0,
    critDmg: 0,
    anomalyMastery: 0,
    anomalyProficiency: 0,
    penRatio: 0,
    energy: 0,
  },
};
```

### Name Mapping Integration

**ファイル**: `src/config/name-mappings.json`

```json
{
  "lucia": { "ja": "リュシア", "en": "Lucia" },
  "manato": { "ja": "狛野真斗", "en": "Komano Manato" },
  "yidhari": { "ja": "イドリー", "en": "Yidhari" }
}
```

## Error Handling

### 1. API Level Error Handling

- **ネットワークエラー**: 既存のリトライロジック適用
- **404 エラー**: キャラクター個別にスキップ、他の処理継続
- **データ形式エラー**: ログ出力後、空の値適用

### 2. Generic Partial Data Error Handling

```typescript
class PartialDataErrorHandler {
  handleMissingField(fieldName: string, characterId: string): any;
  getEmptyValue(fieldName: string): any;
  validatePartialData(
    data: Partial<ProcessedData>,
    characterId: string
  ): boolean;
  logMissingField(
    fieldName: string,
    characterId: string,
    emptyValue: any
  ): void;
}
```

### 3. Validation Strategy

- **必須フィールド**: id, name, attr（ステータス）
- **オプショナルフィールド**: specialty, attackType, faction（設定可能）
- **フォールバック**: 欠損フィールドに空の値を適用

### 4. Logging Strategy

```typescript
// 汎用的な部分データ処理ログ
logger.warn("部分データ検出: フィールドが欠損、空の値を適用", {
  characterId,
  missingField,
  emptyValue,
  dataSource: "partial_data_handler",
  handlerType: "empty_value_fallback",
});
```

## Testing Strategy

### 1. Unit Tests

**新規テストファイル**: `tests/processors/Version23DataProcessor.test.ts`

- lucia, manato の標準処理テスト
- 部分データハンドリング機能のテスト
- 汎用エラーハンドリングのテスト
- 空の値適用システムのテスト

### 2. Integration Tests

**新規テストファイル**: `tests/integration/Version23Integration.test.ts`

- 3 キャラクター同時処理テスト
- 既存キャラクターとの統合テスト
- characters.ts 出力形式テスト
- API 障害時の動作テスト

### 3. Error Scenario Tests

- 各種データ欠損パターンのテスト
- ネットワーク障害時の動作
- 部分的成功（2/3 キャラクター成功）のテスト
- 異なるキャラクターでの部分データ処理テスト

### 4. Data Validation Tests

- 生成された Character オブジェクトの型適合性
- 必須フィールドの存在確認
- 空の値の正確性検証

## Implementation Approach

### Phase 1: Configuration and Setup

1. 汎用的な部分データハンドリング設定の追加
2. name-mappings.json に新キャラクター名追加
3. PartialDataHandler クラス実装

### Phase 2: Core Processing Logic

1. DataProcessor に汎用的な部分データ処理追加
2. 柔軟なエラーハンドリングロジック実装
3. CharacterGenerator の部分データ対応

### Phase 3: Integration and Testing

1. 既存システムとの統合テスト
2. エラーシナリオテスト
3. 出力形式検証

### Phase 4: Documentation and Deployment

1. 処理ログの詳細化
2. エラー統計の収集
3. 運用ドキュメント更新

## Performance Considerations

- **並列処理**: 3 キャラクターの並列 API 取得
- **メモリ効率**: 既存のメモリ最適化機能活用
- **エラー分離**: 1 キャラクターの失敗が他に影響しない設計
- **ログ効率**: 部分データ処理ログの適切なレベル設定

## Security Considerations

- **入力検証**: API 応答データの厳格な検証
- **空の値**: 安全な空の値の使用
- **エラー情報**: 機密情報を含まないエラーメッセージ
- **ログ出力**: 個人情報を含まないログ設計
