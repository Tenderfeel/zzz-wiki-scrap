# 設計書

## 概要

ゼンレスゾーンゼロ（ZZZ）のキャラクターデータシステムに支援タイプ（assistType）情報を統合する機能の設計です。この機能は、HoyoLab API から支援タイプ情報を抽出し、既存のデータ処理パイプラインに統合して、各キャラクターの支援メカニズム（回避支援またはパリィ支援）を正確に表現します。

## アーキテクチャ

### データフロー

```
HoyoLab API → Parser → Mapper → Processor → Generator
     ↓           ↓        ↓         ↓          ↓
  APIレスポンス → 抽出 → マッピング → 変換 → TypeScript出力
```

### 処理レイヤー

1. **API Layer** (`src/clients/`): HoyoLab API から支援タイプ情報を含むレスポンスを取得
2. **Parser Layer** (`src/parsers/`): API レスポンスから支援タイプ関連フィールドを抽出
3. **Mapper Layer** (`src/mappers/`): 日本語の支援タイプ値を英語列挙値にマッピング
4. **Processor Layer** (`src/processors/`): 支援タイプデータの検証と変換
5. **Generator Layer** (`src/generators/`): 支援タイプを含むキャラクターデータの出力

## コンポーネントと インターフェース

### 1. 型定義の拡張

既存の`AssistType`型は定義済みですが、使用されていません：

```typescript
export type AssistType =
  | "evasive" // 回避支援
  | "defensive"; // パリィ支援
```

`Character`型の`assistType`フィールドをオプショナルから必須に変更する必要があります。

### 2. DataMapper の拡張

`src/mappers/DataMapper.ts`に支援タイプマッピング機能を追加：

```typescript
// 支援タイプマッピング
private static readonly ASSIST_TYPE_MAPPING: Record<string, AssistType> = {
  "回避支援": "evasive",
  "パリィ支援": "defensive",
};

public mapAssistType(rawAssistType: string): AssistType | undefined {
  if (!rawAssistType || rawAssistType.trim() === "") {
    return undefined;
  }
  return DataMapper.ASSIST_TYPE_MAPPING[rawAssistType.trim()];
}
```

### 3. API レスポンス構造の調査

HoyoLab API レスポンスで支援タイプ情報を含む可能性のあるフィールド：

- `data.page.agent_assist_type.values[0]` (推測)
- `data.page.modules[].components[]` 内の特定コンポーネント
- `data.page.filter_values` 内の新しいフィールド

### 4. DataProcessor の拡張

`src/processors/DataProcessor.ts`に支援タイプ処理ロジックを追加：

```typescript
private extractAssistType(filterValues: any): AssistType | undefined {
  try {
    // APIレスポンスから支援タイプ情報を抽出
    const rawAssistType = filterValues?.agent_assist_type?.values?.[0];

    if (!rawAssistType) {
      logger.debug("支援タイプ情報が見つかりません", { filterValues });
      return undefined;
    }

    return this.dataMapper.mapAssistType(rawAssistType);
  } catch (error) {
    logger.warn("支援タイプ処理中にエラーが発生", { error, filterValues });
    return undefined;
  }
}
```

## データモデル

### API レスポンス構造（推測）

```typescript
interface ApiResponse {
  data: {
    page: {
      id: string;
      name: string;
      agent_specialties: { values: string[] };
      agent_stats: { values: string[] };
      agent_rarity: { values: string[] };
      agent_faction: { values: string[] };
      modules: [
        {
          "name": "エージェントスキル",
          "components": [
            {
              "component_id": "agent_talent",
              "data": string  // この文字列に支援タイプ情報が含まれている
              // ...
            }
          ]
        }
       ] as Module[];
    };
  };
}
```

### 処理済みキャラクターデータ

```typescript
type Character = {
  id: string;
  name: { [key in Lang]: string };
  fullName: { [key in Lang]: string };
  specialty: Specialty;
  stats: Stats;
  assistType?: AssistType; // オプショナル（一部キャラクターのみ）
  faction: number;
  rarity: Rarity;
  attr: Attributes;
};
```

## エラーハンドリング

### 1. 支援タイプ情報の欠損

- API レスポンスに支援タイプ情報がない場合：`assistType`を`undefined`に設定
- 処理を継続し、他のキャラクターデータに影響しない

### 2. 無効な支援タイプ値

- 未知の支援タイプ値を受信した場合：警告をログ出力し、`undefined`を設定
- マッピングエラーは致命的エラーとして扱わない

### 3. 部分的な失敗

- 一部のキャラクターで支援タイプ処理が失敗しても、全体の処理は継続
- 失敗したキャラクターの詳細をログに記録

## テスト戦略

### 1. 単体テスト

- `DataMapper.mapAssistType()`のマッピング機能
- `DataProcessor`の支援タイプ抽出ロジック
- エラーハンドリングの動作確認

### 2. 統合テスト

- HoyoLab API からの実際のデータを使用した処理テスト
- 支援タイプ情報を含むキャラクターと含まないキャラクターの混在テスト

### 3. エラーシナリオテスト

- API レスポンスに支援タイプ情報がない場合
- 無効な支援タイプ値を受信した場合
- ネットワークエラーや部分的な失敗の場合

## 実装上の考慮事項

### 1. 後方互換性

- 既存のキャラクターデータ構造を破綻させない
- `assistType`フィールドはオプショナルとして実装
- 既存のテストが引き続き通過する

### 2. パフォーマンス

- 支援タイプ処理による処理時間の増加を最小限に抑制
- キャッシュ機能は既存のものを活用
- 並列処理への影響を考慮

### 3. ログ出力

- 支援タイプ処理の詳細をデバッグレベルでログ出力
- エラーや警告は適切なレベルで記録
- 統計情報（支援タイプ別キャラクター数など）を提供

### 4. 設定管理

- 支援タイプマッピングは`DataMapper`内にハードコード
- 将来的な拡張性を考慮した設計
- 新しい支援タイプの追加が容易な構造

## セキュリティ考慮事項

- 入力値の検証とサニタイゼーション
- API レスポンスの構造検証
- 予期しないデータ形式への対応

## 監視とメトリクス

- 支援タイプ処理の成功率
- 各支援タイプの分布
- 処理時間の監視
- エラー発生率の追跡
