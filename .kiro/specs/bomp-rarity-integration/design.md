# 設計書

## 概要

ボンプレア度統合システムは、既存のボンプデータ生成パイプラインを拡張して、HoyoLab API の`data.page.modules`の`baseInfo`コンポーネントからレア度情報を抽出し、キャラクターデータと同様の`rarity: Rarity`フィールドをボンプデータに追加します。システムは既存のアーキテクチャパターンを維持しながら、最小限の変更でレア度機能を統合します。

## アーキテクチャ

### 既存システムとの統合

既存のボンプデータ処理パイプラインを拡張：

```
HoyoLab API → BompDataMapper → BompDataProcessor → BompGenerator → data/bomps.ts
     ↓              ↓                ↓               ↓
  baseInfo     extractRarity    processRarity   outputRarity
```

### 変更対象コンポーネント

1. **型定義の拡張** (`src/types/index.ts`)

   - `Bomp`インターフェースに`rarity: Rarity`フィールドを追加
   - `BasicBompInfo`インターフェースに`rarity: string`フィールドを追加

2. **BompDataMapper の拡張** (`src/mappers/BompDataMapper.ts`)

   - `extractRarityFromBaseInfo()`メソッドを追加
   - `extractBasicBompInfo()`メソッドでレア度抽出を統合

3. **BompDataProcessor の拡張** (`src/processors/BompDataProcessor.ts`)

   - レア度データの検証機能を追加
   - `validateBompData()`メソッドでレア度検証を統合

4. **BompGenerator の拡張** (`src/generators/BompGenerator.ts`)
   - `generateBomp()`メソッドでレア度マッピングを統合
   - `validateBomp()`メソッドでレア度検証を追加
   - `formatBompObject()`メソッドでレア度出力を追加

## コンポーネントと インターフェース

### 1. 型定義の拡張

```typescript
// src/types/index.ts に追加
export type Bomp = {
  id: string;
  name: { [key in Lang]: string };
  stats: Stats[];
  rarity: Rarity; // 新規追加
  releaseVersion?: number;
  faction: number[];
  attr: Attributes;
  extraAbility: string;
};

export interface BasicBompInfo {
  id: string;
  name: string;
  stats: string;
  rarity: string; // 新規追加（処理中は文字列）
  releaseVersion?: number;
}
```

### 2. BompDataMapper の拡張

```typescript
class BompDataMapper extends DataMapper {
  /**
   * baseInfoコンポーネントからレア度情報を抽出
   * @param modules モジュール配列
   * @returns レア度文字列（"A級"、"S級"）
   */
  public extractRarityFromBaseInfo(modules: Module[]): string {
    // baseInfoモジュールを検索
    const baseInfoModule = modules?.find(
      (module) => module.name === "ステータス" || module.name === "baseInfo"
    );

    if (!baseInfoModule) {
      throw new MappingError("baseInfoモジュールが見つかりません");
    }

    const baseInfoComponent = baseInfoModule.components?.find(
      (component) => component.component_id === "baseInfo"
    );

    if (!baseInfoComponent?.data) {
      throw new MappingError("baseInfoデータが存在しません");
    }

    // JSON データを解析
    const baseInfoData = JSON.parse(baseInfoComponent.data);

    if (!baseInfoData.list || !Array.isArray(baseInfoData.list)) {
      throw new MappingError("baseInfo.listが存在しません");
    }

    // レア度キーを検索
    const rarityItem = baseInfoData.list.find(
      (item: any) => item.key === "レア度" || item.key === "rarity"
    );

    if (!rarityItem || !rarityItem.value || !Array.isArray(rarityItem.value)) {
      throw new MappingError("レア度情報が見つかりません");
    }

    const rarityValue = rarityItem.value[0];
    if (typeof rarityValue !== "string") {
      throw new MappingError("レア度値が文字列ではありません");
    }

    return rarityValue; // "A級" または "S級"
  }

  /**
   * レア度文字列を正規化（"A級" → "A", "S級" → "S"）
   * @param rawRarity 生のレア度文字列
   * @returns 正規化されたレア度文字列
   */
  public normalizeRarity(rawRarity: string): string {
    if (!rawRarity || typeof rawRarity !== "string") {
      throw new MappingError("レア度値が無効です");
    }

    // "級"を除去
    const normalized = rawRarity.replace(/級$/, "").trim();

    if (!["A", "S"].includes(normalized)) {
      throw new MappingError(`未知のレア度値: "${rawRarity}"`);
    }

    return normalized;
  }
}
```

### 3. BompDataProcessor の拡張

```typescript
class BompDataProcessor extends DataProcessor {
  /**
   * レア度データの検証機能
   * @param rarity レア度文字列
   * @returns 検証結果
   */
  private validateRarityData(rarity: string): ValidationResult {
    const errors: string[] = [];

    if (!rarity || typeof rarity !== "string") {
      errors.push("レア度データが存在しません");
    } else {
      const validRarities = ["A", "S"];
      if (!validRarities.includes(rarity)) {
        errors.push(`無効なレア度値: "${rarity}"`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
    };
  }
}
```

### 4. BompGenerator の拡張

```typescript
class BompGenerator {
  /**
   * レア度マッピングを統合したボンプ生成
   */
  generateBomp(
    jaData: ProcessedBompData,
    enData: ProcessedBompData | null,
    bompId: string
  ): Bomp {
    // 既存の処理...

    // レア度マッピング
    const rarity = this.dataMapper.mapRarity(
      this.bompDataMapper.normalizeRarity(jaData.basicInfo.rarity)
    );

    const bomp: Bomp = {
      id: bompId,
      name,
      stats,
      rarity, // 新規追加
      attr: attributes,
      extraAbility: jaData.extraAbility || "",
      releaseVersion: jaData.basicInfo.releaseVersion,
      faction: jaData.factionIds || [],
    };

    return bomp;
  }
}
```

## データモデル

### API データ抽出パス

#### レア度情報の抽出パス

```
data.page.modules
  → find(module => module.name === "ステータス" || module.name === "baseInfo")
    → components
      → find(component => component.component_id === "baseInfo")
        → data (JSON文字列)
          → JSON.parse()
            → list[]
              → find(item => item.key === "レア度")
                → value[0] // "A級" または "S級"
```

#### データ変換フロー

```
"A級" → normalizeRarity() → "A" → mapRarity() → "A" (Rarity型)
"S級" → normalizeRarity() → "S" → mapRarity() → "S" (Rarity型)
```

### 更新された Bomp 型定義

```typescript
export type Bomp = {
  id: string; // 既存
  name: { [key in Lang]: string }; // 既存
  stats: Stats[]; // 既存
  rarity: Rarity; // 新規追加
  releaseVersion?: number; // 既存
  faction: number[]; // 既存
  attr: Attributes; // 既存
  extraAbility: string; // 既存
};
```

## エラーハンドリング

### レア度抽出エラーの分類

1. **構造エラー**

   - baseInfo モジュール不存在
   - baseInfo コンポーネント不存在
   - データフィールド不存在

2. **データエラー**

   - JSON 解析失敗
   - list 配列不存在
   - レア度キー不存在

3. **値エラー**
   - レア度値が文字列でない
   - 未知のレア度値（"A 級"、"S 級"以外）

### グレースフル劣化戦略

```typescript
interface RarityExtractionResult {
  success: boolean;
  rarity?: Rarity;
  error?: string;
  fallbackUsed?: boolean;
}

class RarityExtractionHandler {
  extractWithFallback(
    modules: Module[],
    bompId: string
  ): RarityExtractionResult {
    try {
      // 主要な抽出方法を試行
      const rawRarity = this.bompDataMapper.extractRarityFromBaseInfo(modules);
      const normalizedRarity = this.bompDataMapper.normalizeRarity(rawRarity);
      const rarity = this.dataMapper.mapRarity(normalizedRarity);

      return { success: true, rarity };
    } catch (error) {
      // フォールバック: デフォルト値を使用
      logger.warn("レア度抽出に失敗、デフォルト値を使用", {
        bompId,
        error: error.message,
        fallbackRarity: "A",
      });

      return {
        success: false,
        rarity: "A", // デフォルト値
        error: error.message,
        fallbackUsed: true,
      };
    }
  }
}
```

## テスト戦略

### 単体テスト

1. **BompDataMapper.extractRarityFromBaseInfo()**

   - 正常な baseInfo データからのレア度抽出
   - 異なるレア度値（"A 級"、"S 級"）の処理
   - エラーケース（モジュール不存在、データ不正）

2. **BompDataMapper.normalizeRarity()**

   - "A 級" → "A" 変換
   - "S 級" → "S" 変換
   - 無効な値の処理

3. **BompGenerator.generateBomp()**
   - レア度フィールドを含むボンプ生成
   - レア度マッピングの正確性
   - エラー時のフォールバック処理

### 統合テスト

1. **エンドツーエンドレア度処理**

   - 実際の API データからのレア度抽出
   - 全ボンプデータでのレア度統合
   - 出力ファイルでのレア度表示

2. **後方互換性テスト**
   - 既存のボンプデータ生成機能の維持
   - レア度なしデータの適切な処理
   - 既存テストの継続実行

### モックデータ

```typescript
const mockBaseInfoWithRarity = {
  list: [
    {
      key: "レア度",
      value: ["A級"],
      // その他のフィールド...
    },
    // その他のアイテム...
  ],
};

const mockBompApiResponseWithRarity = {
  retcode: 0,
  message: "OK",
  data: {
    page: {
      id: "912",
      name: "セイケンボンプ",
      modules: [
        {
          name: "ステータス",
          components: [
            {
              component_id: "baseInfo",
              data: JSON.stringify(mockBaseInfoWithRarity),
            },
          ],
        },
      ],
    },
  },
};
```

## パフォーマンス考慮事項

### 処理効率の最適化

1. **レア度抽出の最適化**

   - baseInfo データの一度だけの解析
   - キャッシュ機構の活用
   - 不要な JSON 解析の回避

2. **メモリ使用量の管理**
   - 大きな baseInfo データの適切な処理
   - 一時オブジェクトの適切な解放
   - ストリーミング処理の継続

## 実装優先順位

### フェーズ 1: 型定義とインターフェース

1. `src/types/index.ts`の`Bomp`型にレア度フィールド追加
2. `BasicBompInfo`インターフェースの拡張
3. 型定義の検証とコンパイルエラー修正

### フェーズ 2: データ抽出機能

1. `BompDataMapper.extractRarityFromBaseInfo()`実装
2. `BompDataMapper.normalizeRarity()`実装
3. 既存の`extractBasicBompInfo()`メソッドの拡張

### フェーズ 3: データ処理統合

1. `BompDataProcessor`でのレア度検証追加
2. `BompGenerator`でのレア度マッピング統合
3. エラーハンドリングとグレースフル劣化

### フェーズ 4: テストと検証

1. 単体テストの実装
2. 統合テストの実行
3. 既存機能の回帰テスト
4. 全ボンプデータでの検証

## セキュリティ考慮事項

1. **入力検証**

   - baseInfo データの適切な検証
   - JSON 解析時の安全性確保
   - 型安全性の維持

2. **エラー情報の管理**
   - 機密情報の漏洩防止
   - 適切なログレベルの設定
   - エラーメッセージの標準化

## 設定管理

### レア度処理設定

```typescript
interface RarityProcessingConfig {
  enableRarityExtraction: boolean; // デフォルト: true
  fallbackRarity: Rarity; // デフォルト: "A"
  strictValidation: boolean; // デフォルト: true
  logRarityExtractionDetails: boolean; // デフォルト: false
}
```

### 環境対応

- **開発環境**: 詳細なレア度抽出ログ
- **本番環境**: エラーログのみ
- **テスト環境**: モックレア度データ使用
