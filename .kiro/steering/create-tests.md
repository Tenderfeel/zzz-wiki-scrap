---
globs: *.stories.tsx,index.test.ts,index.test.tsx
inclusion: always
---

テストファイルをルートディレクトリに作成しないこと。
必ず tests ディレクトリの該当するレイヤーディレクトリ内に作成すること。

## 概要

本ガイドラインは、テストコードの設計、記述方法、および関連ツールとの連携について定義します。

## ディレクトリ

- ルートディレクトリでのテストファイルの作成は禁止とする
- `tests/{該当する機能レイヤーのディレクトリ}` 以下に作成すること

## 書くべきテスト

原則として、これらを対象としますが、機能の複雑性に応じて調整します。特に複雑性が高い機能については網羅的に実施し、異常系のテストを重点的に行います。簡潔な実装については、一部のテストの省略も許容します。

### 主要機能の正常系テスト

ユーザーが頻繁に利用するコア機能について、まずは正常系のテストケースを記述します。これにより、基本的な動作が保証されていることを確認します。異常系のテストは、mock の調整などで比較的容易に追加できるため、まずは正常系の網羅を優先します。

### 主要機能の異常系テスト

正常系テストに加え、異常系のテストケースを記述します。これには、不正な入力値、API エラー、ネットワークエラーなど、予期せぬ状況を想定したテストが含まれます。テストケースが増加し、統合テストだけでは効率が悪化する場合は、子コンポーネントに対する単体テストの導入も検討します。

**単体テストに関する補足:**
単体テストは記述が容易なため初期段階で導入したくなるかもしれませんが、ビジネス上の価値を考慮し、過度な投資は避けるべきです。ただし、特定のロジックや複雑なコンポーネントに対しては有効です。

### 非主要機能のテスト

主要機能以外で提供されている機能についてもテストを記述します。運用中のプロダクトであれば、エラー発生頻度やユーザーの利用状況といった実データに基づき、テスト対象の優先順位を決定することが推奨されます。主要機能の異常系テストと非主要機能のテストの実施順序は、プロダクトの特性に応じて柔軟に変更可能です。

## テストの記述方法

### テストケース名

- 原則として日本語で記述します。 - 例: 「ユーザーがログインに成功することを確認する」- 多言語対応が必要な場合は英語も検討します。

### describe と it の構成

- テストスイート (`describe`) とテストケース (`test`) の 2 階層で構成します。 - `describe`: - コンポーネントの場合: `〇〇を表示するXXコンポーネント` - ロジックの場合: `〇〇を整形するXX関数` - `test`: - `〇〇な状態のとき、××となること` のような形式で記述します。

### テストコードの構造 (AAA パターン)

- テストケース内のコードは、Arrange（準備）、Act（実行）、Assert（検証）の AAA パターンに準拠します。 - **Arrange:** テストに必要なデータや状態を準備します。 - **Act:** テスト対象の関数やコンポーネントを実行します。 - **Assert:** 実行結果が期待通りであることを検証します。

## 参考資料

- [書籍「フロントエンド開発のためのテスト入門 今からでも間に合う自動テスト戦略の必須知識」](mdc:https:/book.mynavi.jp/ec/products/detail/id=134252)
- [Kent C. Dodds' Blog: The Testing Trophy and Testing Classifications](mdc:https:/kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)- [Speaker Deck: フロントエンドにおけるテスト方針 (Testing Trophy の概念と BDD)](mdc:https:/speakerdeck.com/yajihum/hurontoendoniokeru-tesutofang-zhen-testing-trophynogai-nian-tobdd?slide=13)
- [Zenn: mizchi - 俺のテスト方針](mdc:https:/zenn.dev/mizchi/articles/my-test-policy)
- [Koki Tbk: フロントエンドのテスト戦略について考える](mdc:https:/zenn.dev/koki_tech/articles/a96e58695540a7)
- [Coconala: ココナラのフロントエンドにおけるテスト自動化戦略](mdc:https:/zenn.dev/coconala/articles/f048377f314507)
- [Cybozu Inside Out: Web Frontend Testing and Automation @ Cybozu 2023](mdc:https:/speakerdeck.com/cybozuinsideout/web_frontend_testing_and_automation-2023)
