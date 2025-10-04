# 要件定義書

## 概要

HoyoLab ZZZ Wiki API から全てのキャラクターデータを取得し、grungerad プロジェクトで使用可能な構造化された Character オブジェクトの配列を生成する機能です。この機能は、Scraping.md に記載された全キャラクターの API エンドポイントを通じて基本情報、ステータス、属性などの詳細データを抽出し、TypeScript 型に準拠したデータ形式で出力します。

## 要件

### 要件 1

**ユーザーストーリー:** 開発者として、Scraping.md に記載された全てのキャラクターのページ ID とリンクテキストを取得し、各キャラクターの API データを一括で取得したい。

#### 受け入れ基準

1. WHEN システムが全キャラクターデータを要求する THEN Scraping.md ファイルを解析してキャラクターリストを抽出する SHALL
2. WHEN キャラクターリストを解析する THEN システムは各キャラクターのページ ID とリンクテキスト（キャラクター識別子）を抽出する SHALL
3. WHEN API リクエストを行う THEN システムは各キャラクターに対して `https://sg-wiki-api-static.hoyolab.com/hoyowiki/zzz/wapi/entry_page` に適切な entry_page_id で API コールを行う SHALL
4. WHEN API リクエストを行う THEN システムは日本語（`ja-jp`）と英語（`en-us`）の両方の言語パラメータをサポートする SHALL
5. IF API リクエストが失敗する THEN システムはエラーを適切に処理し、失敗したキャラクターを記録して処理を継続する SHALL

### 要件 2

**ユーザーストーリー:** 開発者として、各キャラクターの API レスポンスから基本キャラクター情報を抽出し、Character プロパティの中核部分を設定したい。

#### 受け入れ基準

1. WHEN API レスポンスを解析する THEN システムは `data.page.id` からキャラクター ID を抽出する SHALL
2. WHEN キャラクター識別子を設定する THEN システムは Scraping.md から抽出したリンクテキストを Character.id として使用する SHALL
3. WHEN キャラクター名を抽出する THEN システムは `data.page.name` から日本語と英語の多言語名オブジェクトを作成する SHALL
4. WHEN キャラクター特性を決定する THEN システムは `data.page.agent_specialties.values[0]` を正しい Specialty 列挙値にマッピングする SHALL
5. WHEN キャラクター属性を抽出する THEN システムは `data.page.agent_stats.values[0]` を正しい Stats 列挙値にマッピングする SHALL
6. WHEN 攻撃タイプを決定する THEN システムは `data.page.agent_attack_type.values[0]` を正しい AttackType 列挙値にマッピングする SHALL
7. WHEN レア度を抽出する THEN システムは `data.page.agent_rarity.values[0]` を正しい Rarity 列挙値にマッピングする SHALL

### 要件 3

**ユーザーストーリー:** 開発者として、各キャラクターの API レスポンスから陣営情報を抽出し、キャラクターを適切な陣営に関連付けたい。

#### 受け入れ基準

1. WHEN 陣営データを抽出する THEN システムは `data.page.modules[0].components[0].data` の JSON 文字列を解析する SHALL
2. WHEN 陣営情報を解析する THEN システムは baseInfo セクションの陣営 ep_id フィールドから陣営 ID を抽出する SHALL
3. WHEN 陣営名を抽出する THEN システムは `data.page.agent_faction.values[0]` から陣営名を取得する SHALL
4. WHEN 陣営オブジェクトを作成する THEN システムは日本語と英語の多言語陣営名を作成する SHALL
5. WHEN 陣営 ID を解決する THEN システムは data/factions.ts の既存陣営データと照合して正しい ID を割り当てる SHALL

### 要件 4

**ユーザーストーリー:** 開発者として、昇格データから各キャラクターの詳細な属性とステータスを抽出し、完全な Attributes オブジェクトを設定したい。

#### 受け入れ基準

1. WHEN 属性を抽出する THEN システムは `data.page.modules` 内の昇格コンポーネントを特定する SHALL
2. WHEN 昇格データを解析する THEN システムは昇格コンポーネントの data フィールドの JSON 文字列を解析する SHALL
3. WHEN レベル別ステータスを抽出する THEN システムはレベル 1、10、20、30、40、50、60 の HP、ATK、DEF の配列を作成する SHALL
4. WHEN 固定ステータスを抽出する THEN システムはレベル 1 データから impact、critRate、critDmg、anomalyMastery、anomalyProficiency、penRatio、energy の単一値を取得する SHALL
5. WHEN ステータス値を処理する THEN システムは文字列値を適切な数値型に変換する SHALL
6. WHEN "-" 値に遭遇する THEN システムはそれらを適切なデフォルト値（ほとんどのステータスで 0）に変換する SHALL
7. WHEN パーセンテージ値を処理する THEN システムは "%" 記号を削除し、数値に変換する SHALL

### 要件 5

**ユーザーストーリー:** 開発者として、TypeScript 型定義に準拠した完全な Character オブジェクトの配列を生成し、grungerad プロジェクトでシームレスに使用できるようにしたい。

#### 受け入れ基準

1. WHEN Character オブジェクトを生成する THEN システムは各キャラクターに対して必要なすべてのプロパティを含める SHALL: id、name、fullName、specialty、stats、attackType、faction、rarity、attr
2. WHEN 多言語プロパティを作成する THEN システムは "en" と "ja" の両方の言語キーを提供する SHALL
3. WHEN faction プロパティを設定する THEN システムは陣営を ID のみで参照する SHALL
4. WHEN attributes オブジェクトを作成する THEN システムは正しいデータ型で必要なすべての Attributes プロパティを含める SHALL
5. WHEN Character 配列を出力する THEN システムは data/characters.ts にインポート可能な有効な TypeScript として全キャラクターをフォーマットする SHALL

### 要件 6

**ユーザーストーリー:** 開発者として、生成された全 Character データを検証し、データの整合性と完全性を確保したい。

#### 受け入れ基準

1. WHEN Character データを生成する THEN システムは各キャラクターの必要なすべてのフィールドが存在し、null でないことを検証する SHALL
2. WHEN 数値配列を検証する THEN システムは各キャラクターの HP、ATK、DEF 配列が正確に 7 つの値を含むことを確認する SHALL
3. WHEN 列挙値を検証する THEN システムは各キャラクターの specialty、stats、attackType、rarity が定義された列挙値と一致することを確認する SHALL
4. WHEN 多言語オブジェクトを検証する THEN システムは各キャラクターの "en" と "ja" の両方のキーが存在し、空でない文字列値を持つことを確認する SHALL
5. WHEN 重複チェックを行う THEN システムは Character.id の重複がないことを確認する SHALL
6. IF 検証が失敗する THEN システムはどのキャラクターのどのフィールドが無効かを示す具体的なエラーメッセージを提供する SHALL

### 要件 7

**ユーザーストーリー:** 開発者として、大量のキャラクターデータ処理を効率的に行い、処理の進捗と結果を把握したい。

#### 受け入れ基準

1. WHEN 大量データを処理する THEN システムは API リクエストのレート制限を考慮した適切な間隔で処理を行う SHALL
2. WHEN 処理を実行する THEN システムは現在処理中のキャラクター名と進捗状況を表示する SHALL
3. WHEN エラーが発生する THEN システムは失敗したキャラクターを記録し、成功したキャラクターの処理は継続する SHALL
4. WHEN 処理が完了する THEN システムは成功・失敗したキャラクター数の統計情報を表示する SHALL
5. WHEN 部分的な失敗が発生する THEN システムは成功したキャラクターのデータのみで characters.ts ファイルを生成する SHALL
