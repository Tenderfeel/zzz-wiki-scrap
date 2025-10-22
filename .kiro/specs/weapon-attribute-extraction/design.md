# Design Document

## Overview

武器のスキル説明テキストから属性情報を自動抽出し、武器データに統合するシステムを設計する。現在の武器データでは、equipmentSkillDesc フィールドに「炎属性ダメージ」「氷属性ダメージ」「電気属性ダメージ」「物理属性ダメージ」「エーテル属性ダメージ」などの属性情報が含まれているが、これらが構造化されたデータとして抽出されていない。

この機能により、武器の属性情報を自動的に抽出し、既存の Weapon 型に extractedAttributes フィールドを追加して、より豊富な武器データを提供する。

## Architecture

### システム構成

```
src/
├── extractors/
│   ├── WeaponAttributeExtractor.ts    # 属性抽出のメインロジック
│   └── index.ts                       # エクスポート
├── mappers/
│   ├── AttributeMapper.ts             # 日本語→英語属性マッピング
│   └── index.ts                       # 既存のマッパーに追加
├── processors/
│   ├── WeaponAttributeProcessor.ts    # 武器データ処理とバリデーション
│   └── index.ts                       # 既存のプロセッサーに追加
├── utils/
│   ├── AttributePatterns.ts           # 属性パターン定義
│   └── index.ts                       # 既存のユーティリティに追加
└── types/
    └── index.ts                       # 型定義の拡張
```

### データフロー

```
Weapon Data (equipmentSkillDesc)
    ↓
WeaponAttributeExtractor
    ↓
AttributeMapper (日本語→英語変換)
    ↓
WeaponAttributeProcessor (バリデーション・統合)
    ↓
Enhanced Weapon Data (extractedAttributes追加)
```

## Components and Interfaces

### 1. WeaponAttributeExtractor

属性抽出のメインロジックを担当するクラス。

```typescript
export class WeaponAttributeExtractor {
  private attributePatterns: AttributePatterns;
  private attributeMapper: AttributeMapper;

  constructor();

  /**
   * スキル説明から属性を抽出
   */
  extractAttributes(skillDescription: string, language: Lang): Stats[];

  /**
   * 複数の言語のスキル説明から属性を抽出
   */
  extractFromMultiLang(skillDesc: { [key in Lang]: string }): Stats[];

  /**
   * 抽出結果の詳細情報を取得
   */
  extractWithDetails(
    skillDescription: string,
    language: Lang
  ): AttributeExtractionResult;
}
```

### 2. AttributeMapper

日本語属性名から英語属性名への変換を担当。

```typescript
export class AttributeMapper {
  private static readonly ATTRIBUTE_MAPPING: Record<string, Stats> = {
    炎属性: "fire",
    氷属性: "ice",
    電気属性: "electric",
    物理属性: "physical",
    エーテル属性: "ether",
  };

  /**
   * 日本語属性名を英語に変換
   */
  static mapToEnglish(japaneseAttribute: string): Stats | null;

  /**
   * 複数の日本語属性名を英語に変換
   */
  static mapMultipleToEnglish(japaneseAttributes: string[]): Stats[];
}
```

### 3. AttributePatterns

属性パターンの定義と検索ロジック。

```typescript
export class AttributePatterns {
  private static readonly PATTERNS: AttributePattern[] = [
    {
      attribute: "炎属性",
      patterns: [/炎属性ダメージ/g, /炎属性の/g, /炎属性を与え/g],
    },
    {
      attribute: "氷属性",
      patterns: [/氷属性ダメージ/g, /氷属性の/g, /氷属性を与え/g],
    },
    // ... 他の属性パターン
  ];

  /**
   * テキストから属性パターンを検索
   */
  findAttributePatterns(text: string): string[];

  /**
   * 特定の属性パターンが存在するかチェック
   */
  hasAttributePattern(text: string, attribute: string): boolean;
}
```

### 4. WeaponAttributeProcessor

武器データの処理とバリデーションを担当。

```typescript
export class WeaponAttributeProcessor {
  private extractor: WeaponAttributeExtractor;

  constructor();

  /**
   * 武器データに抽出された属性を追加
   */
  processWeapon(weapon: Weapon): EnhancedWeapon;

  /**
   * 複数の武器データを一括処理
   */
  processWeapons(weapons: Weapon[]): ProcessingResult<EnhancedWeapon>;

  /**
   * 抽出結果のバリデーション
   */
  validateExtraction(
    weapon: Weapon,
    extractedAttributes: Stats[]
  ): ValidationResult;
}
```

## Data Models

### 型定義の拡張

```typescript
// 既存のWeapon型を拡張
export interface EnhancedWeapon extends Weapon {
  extractedAttributes: Stats[]; // 抽出された属性のリスト
}

// 属性抽出結果の詳細情報
export interface AttributeExtractionResult {
  attributes: Stats[];
  confidence: number; // 抽出の信頼度 (0-1)
  matchedPatterns: MatchedPattern[];
  warnings: string[];
}

// マッチしたパターンの情報
export interface MatchedPattern {
  attribute: Stats;
  pattern: string;
  matchCount: number;
  positions: number[];
}

// 属性パターンの定義
export interface AttributePattern {
  attribute: string;
  patterns: RegExp[];
}

// 処理結果
export interface ProcessingResult<T> {
  successful: T[];
  failed: FailedProcessing[];
  statistics: ProcessingStatistics;
}

export interface FailedProcessing {
  weaponId: number;
  error: string;
  partialData?: Partial<EnhancedWeapon>;
}

// バリデーション結果
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}
```

### 属性マッピング定義

```typescript
export const ATTRIBUTE_MAPPING: Record<string, Stats> = {
  炎属性: "fire",
  氷属性: "ice",
  電気属性: "electric",
  物理属性: "physical",
  エーテル属性: "ether",
};

export const ATTRIBUTE_PATTERNS: Record<string, RegExp[]> = {
  炎属性: [/炎属性ダメージ/g, /炎属性の/g, /炎属性を与え/g, /炎属性で/g],
  氷属性: [/氷属性ダメージ/g, /氷属性の/g, /氷属性を与え/g, /氷属性で/g],
  電気属性: [
    /電気属性ダメージ/g,
    /電気属性の/g,
    /電気属性を与え/g,
    /電気属性で/g,
  ],
  物理属性: [
    /物理属性ダメージ/g,
    /物理属性の/g,
    /物理属性を与え/g,
    /物理属性で/g,
  ],
  エーテル属性: [
    /エーテル属性ダメージ/g,
    /エーテル属性の/g,
    /エーテル属性を与え/g,
    /エーテル属性で/g,
    /エーテル透徹ダメージ/g,
  ],
};
```

## Error Handling

### エラー分類

1. **抽出エラー**: パターンマッチングの失敗
2. **マッピングエラー**: 未知の属性名の検出
3. **バリデーションエラー**: 抽出結果の整合性チェック失敗
4. **データエラー**: 武器データの不整合

### エラー処理戦略

```typescript
export class AttributeExtractionError extends Error {
  constructor(
    message: string,
    public readonly weaponId: number,
    public readonly errorType: "EXTRACTION" | "MAPPING" | "VALIDATION" | "DATA",
    public readonly details?: any
  ) {
    super(message);
    this.name = "AttributeExtractionError";
  }
}

// エラー処理のベストプラクティス
export class ErrorHandler {
  static handleExtractionError(error: AttributeExtractionError): void {
    // ログ出力
    Logger.error(`Attribute extraction failed for weapon ${error.weaponId}`, {
      errorType: error.errorType,
      message: error.message,
      details: error.details,
    });

    // エラー統計の更新
    // 必要に応じて部分的なデータの保存
  }
}
```

## Testing Strategy

### テスト分類

1. **単体テスト**: 各コンポーネントの個別機能テスト
2. **統合テスト**: コンポーネント間の連携テスト
3. **エンドツーエンドテスト**: 実際の武器データを使用した全体テスト

### テストケース設計

```typescript
describe("WeaponAttributeExtractor", () => {
  describe("extractAttributes", () => {
    it("should extract fire attribute from skill description", () => {
      const skillDesc = "装備者が与える炎属性ダメージ+15%";
      const result = extractor.extractAttributes(skillDesc, "ja");
      expect(result).toEqual(["fire"]);
    });

    it("should extract multiple attributes", () => {
      const skillDesc = "氷属性ダメージと炎属性ダメージの会心ダメージ+1.5%";
      const result = extractor.extractAttributes(skillDesc, "ja");
      expect(result).toEqual(["ice", "fire"]);
    });

    it("should handle no attributes found", () => {
      const skillDesc = "装備者の攻撃力+10%";
      const result = extractor.extractAttributes(skillDesc, "ja");
      expect(result).toEqual([]);
    });

    it("should deduplicate same attributes", () => {
      const skillDesc = "炎属性ダメージ+10%。炎属性ダメージを与えた時";
      const result = extractor.extractAttributes(skillDesc, "ja");
      expect(result).toEqual(["fire"]);
    });
  });
});
```

### パフォーマンステスト

```typescript
describe("Performance Tests", () => {
  it("should process 100 weapons within acceptable time", async () => {
    const weapons = generateTestWeapons(100);
    const startTime = Date.now();

    const result = await processor.processWeapons(weapons);

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    expect(processingTime).toBeLessThan(5000); // 5秒以内
    expect(result.successful.length).toBeGreaterThan(90); // 90%以上成功
  });
});
```

## Implementation Considerations

### パフォーマンス最適化

1. **正規表現の最適化**: 効率的なパターンマッチング
2. **キャッシュ機能**: 同じスキル説明の重複処理を避ける
3. **バッチ処理**: 大量の武器データの効率的な処理

### 拡張性

1. **新属性の追加**: パターン定義の追加で対応
2. **多言語対応**: 英語スキル説明からの抽出も可能
3. **カスタムパターン**: 設定ファイルでのパターン定義

### 保守性

1. **設定の外部化**: パターンとマッピングの設定ファイル化
2. **ログ機能**: 詳細な処理ログとデバッグ情報
3. **テストカバレッジ**: 高いテストカバレッジの維持

## Integration Points

### 既存システムとの統合

1. **WeaponGenerator**: 武器データ生成時の属性抽出統合
2. **DataProcessor**: 既存の処理パイプラインへの組み込み
3. **ValidationSystem**: 既存のバリデーション機能との連携

### 出力形式

```typescript
// 拡張された武器データの出力例
export const enhancedWeapons: EnhancedWeapon[] = [
  {
    id: 936,
    name: { ja: "燔火の朧夜", en: "燔火の朧夜" },
    equipmentSkillDesc: {
      ja: "装備者が与える炎属性ダメージ+15%...",
      en: "...",
    },
    // ... 既存のフィールド
    extractedAttributes: ["fire"], // 新しく追加されるフィールド
  },
];
```
