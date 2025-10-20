# エージェント抽出デバッグツール

## 概要

`agent-extraction-debug.ts` は、音動機データ処理システムにおけるエージェント ID 抽出機能をデバッグするためのツールです。実際の API データを使用して、抽出プロセスの各ステップを詳細に監視・記録できます。

## 主な機能

### AgentExtractionDebugger クラス

- **testSpecificWeapon(weaponId)**: 単一武器のエージェント抽出をテスト
- **testMultipleWeapons(weaponIds[])**: 複数武器の一括テスト
- **displayDetailedResult()**: 詳細なデバッグ結果の表示
- **displaySummary()**: 複数武器テストのサマリー表示

### デバッグ情報の構造

```typescript
interface AgentExtractionDebugInfo {
  step: string; // ステップ名
  success: boolean; // 成功/失敗
  data?: any; // 中間データ
  error?: string; // エラーメッセージ
  agentValue?: string; // エージェント値
  extractedName?: string; // 抽出されたエージェント名
  mappedId?: string; // マッピングされたID
  timestamp: number; // タイムスタンプ
  duration?: number; // 処理時間
}
```

## 使用方法

### 1. 単一武器のテスト

```typescript
import { AgentExtractionDebugger } from './agent-extraction-debug';

const debugger = new AgentExtractionDebugger();

// 特定の武器IDでテスト
const result = await debugger.testSpecificWeapon("1234");
debugger.displayDetailedResult(result);
```

### 2. 複数武器の一括テスト

```typescript
const weaponIds = ["1234", "1235", "1236"];
const results = await debugger.testMultipleWeapons(weaponIds);
debugger.displaySummary(results);
```

### 3. サンプルスクリプトの実行

```bash
# TypeScript で直接実行
npx ts-node tests/debug/agent-extraction-debug.ts

# または JavaScript にコンパイル後実行
npx tsc tests/debug/agent-extraction-debug.ts
node tests/debug/agent-extraction-debug.js
```

## 監視されるステップ

1. **API データ取得**: HoyoLab API からの武器データ取得
2. **baseInfo コンポーネント検索**: モジュール内の baseInfo コンポーネント検索
3. **baseInfo データ解析**: JSON データの解析
4. **該当エージェント項目検索**: 該当エージェント情報の検索
5. **value 配列検証**: value 配列の存在と形式確認
6. **エージェント名抽出**: JSON 文字列からのエージェント名抽出
7. **agentId マッピング**: エージェント名から ID へのマッピング

## 出力例

### 単一武器テスト結果

```
=== 武器 1234 のエージェント抽出デバッグ結果 ===
最終結果: 成功
抽出されたエージェントID: lucia
総処理時間: 1250ms

--- 処理ステップ詳細 ---
1. API データ取得: ✓ (800ms)
2. baseInfo コンポーネント検索: ✓ (5ms)
3. baseInfo データ解析: ✓ (10ms)
4. 該当エージェント項目検索: ✓ (2ms)
5. value 配列検証: ✓ (1ms)
6. エージェント名抽出: ✓ (15ms)
   抽出名: リュシア・プラム
7. agentId マッピング: ✓ (2ms)
   マッピングID: lucia
```

### 複数武器テストサマリー

```
=== 複数武器エージェント抽出テスト サマリー ===
総武器数: 10
成功: 8 (80.00%)
失敗: 2
平均処理時間: 1150.50ms

--- 抽出されたエージェント ---
lucia: 3件
lycaon: 2件
billy: 2件
soldier11: 1件

--- よくあるエラー ---
該当エージェント項目が見つかりません: 1件
有効な value 配列が存在しません: 1件
```

## トラブルシューティング

### よくある問題

1. **API エラー**: ネットワーク接続やレート制限の問題
2. **該当エージェント項目が見つからない**: baseInfo に該当エージェント情報が存在しない
3. **JSON 解析エラー**: API レスポンスの形式変更
4. **マッピング失敗**: 新しいエージェント名が AgentMapping に未登録

### デバッグのヒント

- `displayDetailedResult()` で各ステップの詳細を確認
- `data` フィールドで中間データの構造を確認
- API レート制限を避けるため、複数武器テスト時は適切な遅延を設定
- 新しいエージェントが検出された場合は `AgentMapping.ts` の更新が必要

## 関連ファイル

- `src/mappers/WeaponDataMapper.ts`: 実際の抽出ロジック
- `src/utils/AgentMapping.ts`: エージェント名マッピング
- `src/clients/HoyoLabApiClient.ts`: API クライアント
- `tests/mappers/WeaponDataMapper.test.ts`: 単体テスト
