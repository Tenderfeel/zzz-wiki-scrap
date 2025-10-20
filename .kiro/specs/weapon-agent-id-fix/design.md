# Design Document

## Overview

音動機データ処理システムにおける agentId 取得バグを修正するための設計です。現在の`WeaponDataMapper.extractAgentInfo`メソッドには以下の問題があります：

1. `agentItem`が`undefined`の可能性がある TypeScript エラー
2. API レスポンスの実際の構造（`value`配列）に対応していない
3. 新しいキャラクター（リュシアなど）のマッピングが不足
4. テストファイルがルートディレクトリに配置されている

この設計では、堅牢なエラーハンドリング、実際の API レスポンス構造への対応、拡張可能なマッピングシステム、適切なファイル配置を実現します。

## Architecture

### 修正対象コンポーネント

```
src/mappers/WeaponDataMapper.ts
├── extractAgentInfo() - メインの修正対象
└── プライベートヘルパーメソッド追加

src/utils/AgentMapping.ts
├── AGENT_NAME_TO_ID_MAP - マッピングテーブル拡張
├── extractAgentNameFromApiValue() - 修正
└── getAgentIdByName() - 改善

tests/debug/
└── agent-extraction-debug.ts - 新規作成

tests/mappers/
└── WeaponDataMapper.test.ts - テスト強化
```

### データフロー

```
API Response (baseInfo)
    ↓
該当エージェント検索
    ↓
value配列からJSON文字列抽出
    ↓
JSON解析（$[{...}]$形式）
    ↓
nameフィールド抽出
    ↓
agentIdマッピング
    ↓
結果返却
```

## Components and Interfaces

### 1. WeaponDataMapper.extractAgentInfo() 修正

**現在の問題:**

```typescript
// agentItemがundefinedの可能性
const agentValues = agentItem.values || agentItem.value;
```

**修正後の設計:**

```typescript
public extractAgentInfo(modules: Module[]): WeaponAgentInfo {
  try {
    const baseInfoComponent = this.findComponentByType(modules, "baseInfo");
    if (!baseInfoComponent) {
      logger.warn("baseInfoコンポーネントが見つかりません");
      return { agentId: "" };
    }

    const baseInfoData: BaseInfoData = JSON.parse(baseInfoComponent.data);
    const agentItem = baseInfoData.list.find(
      (item) => item.key === "該当エージェント"
    );

    // Null安全性の確保
    if (!agentItem) {
      logger.debug("該当エージェント情報が見つかりません");
      return { agentId: "" };
    }

    // value配列の存在確認
    const agentValues = agentItem.value;
    if (!agentValues || !Array.isArray(agentValues) || agentValues.length === 0) {
      logger.debug("該当エージェントのvalue配列が空です");
      return { agentId: "" };
    }

    // JSON文字列の抽出と解析
    const agentValue = agentValues[0];
    const agentName = this.extractAgentNameFromValue(agentValue);

    if (!agentName) {
      logger.debug("エージェント名が抽出できませんでした", { agentValue });
      return { agentId: "" };
    }

    // agentIdマッピング
    const agentId = getAgentIdByName(agentName);

    if (agentId) {
      logger.debug("エージェント情報抽出成功", { agentName, agentId });
      return { agentId };
    } else {
      logger.warn("未知のエージェント名が検出されました", { agentName, agentValue });
      return { agentId: "" };
    }
  } catch (error) {
    logger.error("エージェント情報抽出中にエラーが発生しました", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { agentId: "" };
  }
}
```

### 2. プライベートヘルパーメソッド追加

```typescript
/**
 * value配列の要素からエージェント名を抽出
 * @param agentValue value配列の要素（JSON文字列）
 * @returns エージェント名（抽出失敗時は空文字）
 */
private extractAgentNameFromValue(agentValue: string): string {
  try {
    // $[{...}]$形式の解析
    const jsonMatch = agentValue.match(/\$\[(.*?)\]\$/);
    if (!jsonMatch || !jsonMatch[1]) {
      logger.debug("JSON形式のマッチに失敗", { agentValue });
      return this.fallbackNameExtraction(agentValue);
    }

    // JSONオブジェクトの解析
    const agentData = JSON.parse(jsonMatch[1]);
    if (agentData && typeof agentData === 'object' && agentData.name) {
      logger.debug("エージェント名抽出成功", {
        name: agentData.name,
        ep_id: agentData.ep_id
      });
      return agentData.name;
    }

    return this.fallbackNameExtraction(agentValue);
  } catch (error) {
    logger.debug("JSON解析エラー、フォールバック処理を実行", {
      agentValue,
      error: error instanceof Error ? error.message : String(error)
    });
    return this.fallbackNameExtraction(agentValue);
  }
}

/**
 * フォールバック：正規表現によるname抽出
 * @param agentValue 元の文字列
 * @returns エージェント名（抽出失敗時は空文字）
 */
private fallbackNameExtraction(agentValue: string): string {
  try {
    const nameMatch = agentValue.match(/"name":\s*"([^"]+)"/);
    if (nameMatch && nameMatch[1]) {
      logger.debug("フォールバック処理でエージェント名抽出成功", { name: nameMatch[1] });
      return nameMatch[1];
    }
  } catch (error) {
    logger.debug("フォールバック処理も失敗", { error });
  }
  return "";
}
```

### 3. AgentMapping.ts の拡張

**新しいキャラクターの追加:**

```typescript
export const AGENT_NAME_TO_ID_MAP: Record<string, string> = {
  // 既存のマッピング...

  // 新規追加
  リュシア: "lucia",
  "リュシア・プラム": "lucia",
  Lucia: "lucia",
  "Lucia Plum": "lucia",

  // 将来の拡張に備えた構造
};
```

**改善されたマッピング関数:**

```typescript
export function getAgentIdByName(agentName: string): string {
  const normalizedName = agentName.trim();

  // 完全一致を優先
  if (AGENT_NAME_TO_ID_MAP[normalizedName]) {
    return AGENT_NAME_TO_ID_MAP[normalizedName];
  }

  // 部分一致（より厳密な条件）
  for (const [mappedName, agentId] of Object.entries(AGENT_NAME_TO_ID_MAP)) {
    if (
      mappedName === normalizedName ||
      (mappedName.includes(normalizedName) && normalizedName.length > 2) ||
      (normalizedName.includes(mappedName) && mappedName.length > 2)
    ) {
      return agentId;
    }
  }

  return "";
}
```

## Data Models

### API レスポンス構造の明確化

```typescript
interface BaseInfoItem {
  key: string;
  value?: string[]; // 実際の構造：配列形式
  values?: string[]; // 後方互換性のため保持
}

interface AgentInfoData {
  ep_id: number;
  icon: string;
  amount: number;
  name: string;
  menuId: string;
  _menuId: string;
}
```

### エラー情報の構造化

```typescript
interface AgentExtractionDebugInfo {
  step: string;
  success: boolean;
  data?: any;
  error?: string;
  agentValue?: string;
  extractedName?: string;
  mappedId?: string;
}
```

## Error Handling

### 1. 段階的エラーハンドリング

```typescript
// レベル1: コンポーネント存在確認
if (!baseInfoComponent) {
  return { agentId: "" }; // 警告レベル
}

// レベル2: データ構造確認
if (!agentItem) {
  return { agentId: "" }; // デバッグレベル
}

// レベル3: 値の存在確認
if (!agentValues || agentValues.length === 0) {
  return { agentId: "" }; // デバッグレベル
}

// レベル4: 解析エラー
catch (error) {
  logger.error(...); // エラーレベル
  return { agentId: "" };
}
```

### 2. 詳細ログ出力

```typescript
// 成功時
logger.debug("エージェント情報抽出成功", {
  weaponId: context.weaponId,
  agentName,
  agentId,
  ep_id: agentData.ep_id,
});

// 失敗時
logger.warn("未知のエージェント名", {
  weaponId: context.weaponId,
  agentName,
  agentValue: agentValue.substring(0, 100) + "...", // 長い文字列は切り詰め
});
```

## Testing Strategy

### 1. ファイル配置の修正

**移動対象:**

- `test-agent-debug.ts` → `tests/debug/agent-extraction-debug.ts`
- `test-agent-extraction.js` → `tests/debug/agent-extraction-legacy.js`
- `test-weapon-mapper.ts` → `tests/mappers/WeaponDataMapper.debug.ts`

### 2. 新しいデバッグツール

```typescript
// tests/debug/agent-extraction-debug.ts
export class AgentExtractionDebugger {
  async testSpecificWeapon(
    weaponId: string
  ): Promise<AgentExtractionDebugInfo[]> {
    const steps: AgentExtractionDebugInfo[] = [];

    // 各ステップの結果を記録
    steps.push({
      step: "API取得",
      success: true,
      data: apiResponse,
    });

    // ... 各ステップの詳細ログ

    return steps;
  }

  async testMultipleWeapons(
    weaponIds: string[]
  ): Promise<Map<string, AgentExtractionDebugInfo[]>> {
    // 複数武器の一括テスト
  }
}
```

### 3. 単体テストの強化

```typescript
// tests/mappers/WeaponDataMapper.test.ts
describe("extractAgentInfo", () => {
  it("should handle missing agentItem gracefully", () => {
    // agentItemが存在しない場合のテスト
  });

  it("should extract agent name from value array", () => {
    // 実際のAPIレスポンス構造でのテスト
  });

  it("should handle new characters like Lucia", () => {
    // 新キャラクターのテスト
  });

  it("should fallback to regex extraction on JSON parse failure", () => {
    // フォールバック処理のテスト
  });
});
```

### 4. 統合テスト

```typescript
// tests/integration/AgentIdExtraction.integration.test.ts
describe("Agent ID Extraction Integration", () => {
  it("should extract agent IDs for all S-rank weapons", async () => {
    // レアリティSの全武器でagentId抽出をテスト
  });

  it("should handle API response variations", async () => {
    // 異なるAPIレスポンス形式でのテスト
  });
});
```

## Implementation Notes

### 1. 後方互換性

既存の`values`プロパティへの参照も保持し、段階的に移行：

```typescript
const agentValues = agentItem.value || agentItem.values;
```

### 2. パフォーマンス考慮

- JSON 解析の最適化
- 正規表現の効率化
- ログ出力の条件分岐

### 3. 拡張性

- 新キャラクター追加の簡素化
- マッピングルールの柔軟性
- デバッグツールの再利用性

この設計により、現在の agentId 取得バグを修正し、将来の拡張にも対応できる堅牢なシステムを構築します。
