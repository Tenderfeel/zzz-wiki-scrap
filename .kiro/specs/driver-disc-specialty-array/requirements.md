# Requirements Document

## Introduction

ドライバディスクの`specialty`フィールドを単一値から配列形式に変更し、4 セット効果のテキストから複数の特性を抽出できるようにする機能を実装します。現在は 1 つの特性のみを保持していますが、一部のドライバディスクは複数の特性に対応している可能性があるため、より正確なデータ表現を実現します。

## Glossary

- **DriverDisc**: ドライバディスクのデータ型。キャラクターに装備可能なアイテム
- **Specialty**: キャラクターやドライバディスクの特性（attack, stun, anomaly, support, defense, rupture）
- **4 セット効果**: ドライバディスクを 4 つ装備した際に発動する効果
- **DriverDiscDataMapper**: ドライバディスクの API レスポンスを内部型に変換するマッパークラス
- **DriverDiscGenerator**: TypeScript ファイルとしてドライバディスクデータを出力するジェネレータークラス

## Requirements

### Requirement 1

**User Story:** 開発者として、ドライバディスクが複数の特性に対応している場合に正確にデータを表現したい

#### Acceptance Criteria

1. WHEN ドライバディスクデータを定義する時、THE DriverDisc 型 SHALL `specialty`フィールドを`Specialty[]`配列型として定義すること
2. THE DriverDisc 型 SHALL 既存の`id`, `name`, `fourSetEffect`, `twoSetEffect`, `releaseVersion`フィールドを保持すること
3. THE data/driverDiscs.ts SHALL 既存の全てのドライバディスクデータを新しい配列形式に変換すること

### Requirement 2

**User Story:** 開発者として、4 セット効果と 2 セット効果のテキストから複数の特性を自動的に抽出したい

#### Acceptance Criteria

1. WHEN 4 セット効果テキストを解析する時、THE DriverDiscDataMapper SHALL 日本語の特性キーワード（`[撃破]`, `[強攻]`, `[異常]`, `[支援]`, `[防護]`, `[命破]`）を検出すること
2. WHEN 4 セット効果または 2 セット効果テキストを解析する時、THE DriverDiscDataMapper SHALL 効果テキストに対応する特性マッピングルールを適用すること
3. WHEN 効果テキストに「エネルギー自動回復」が含まれる時、THE DriverDiscDataMapper SHALL `support`を特性配列に追加すること
4. WHEN 効果テキストに「会心率」が含まれる時、THE DriverDiscDataMapper SHALL `attack`を特性配列に追加すること
5. WHEN 効果テキストに「貫通率」が含まれる時、THE DriverDiscDataMapper SHALL `attack`, `support`, `anomaly`を特性配列に追加すること
6. WHEN 効果テキストに「異常マスタリー」が含まれる時、THE DriverDiscDataMapper SHALL `anomaly`を特性配列に追加すること
7. WHEN 効果テキストに「攻撃力」が含まれる時、THE DriverDiscDataMapper SHALL `attack`, `support`, `anomaly`を特性配列に追加すること
8. WHEN 効果テキストに「防御力」が含まれる時、THE DriverDiscDataMapper SHALL `defense`を特性配列に追加すること
9. WHEN 効果テキストに「炎属性ダメージ」、「エーテル属性ダメージ」、「電気属性ダメージ」、「氷属性ダメージ」、または「物理属性ダメージ」が含まれる時、THE DriverDiscDataMapper SHALL `attack`, `anomaly`, `stun`を特性配列に追加すること
10. WHEN 効果テキストに「シールド生成量」が含まれる時、THE DriverDiscDataMapper SHALL `defense`を特性配列に追加すること
11. WHEN 効果テキストに「会心ダメージ」が含まれる時、THE DriverDiscDataMapper SHALL `attack`, `anomaly`を特性配列に追加すること
12. WHEN 効果テキストに「異常掌握」が含まれる時、THE DriverDiscDataMapper SHALL `anomaly`, `support`を特性配列に追加すること
13. WHEN 効果テキストに「『追加攻撃』と『ダッシュ攻撃』」が含まれる時、THE DriverDiscDataMapper SHALL `attack`, `stun`を特性配列に追加すること
14. WHEN 効果テキストに「HP」が含まれる時、THE DriverDiscDataMapper SHALL `rupture`を特性配列に追加すること
15. WHEN 効果テキストに「攻撃の与えるブレイク値」が含まれる時、THE DriverDiscDataMapper SHALL `stun`, `support`を特性配列に追加すること
16. WHEN 複数のルールがマッチした時、THE DriverDiscDataMapper SHALL 全ての特性を配列として返すこと
17. THE DriverDiscDataMapper SHALL 重複する特性を除外すること
18. WHEN 特性キーワードも効果マッピングも検出されない時、THE DriverDiscDataMapper SHALL 空配列を返すこと

### Requirement 3

**User Story:** 開発者として、既存のドライバディスクデータが新しい形式で正しく出力されることを確認したい

#### Acceptance Criteria

1. WHEN ドライバディスクデータを生成する時、THE DriverDiscGenerator SHALL `specialty`フィールドを配列形式で出力すること
2. THE DriverDiscGenerator SHALL 既存の全てのフィールドを正しく出力すること
3. WHEN 生成されたファイルをインポートする時、THE TypeScript コンパイラ SHALL 型エラーを報告しないこと

### Requirement 4

**User Story:** 開発者として、変更が既存のコードに影響を与えないことを確認したい

#### Acceptance Criteria

1. WHEN 型定義を変更する時、THE 開発者 SHALL `src/types/index.ts`の`DriverDisc`型を更新すること
2. WHEN データマッパーを変更する時、THE 開発者 SHALL `DriverDiscDataMapper`の特性抽出ロジックを更新すること
3. WHEN 既存のテストを実行する時、THE テストスイート SHALL 全てのテストが成功すること
