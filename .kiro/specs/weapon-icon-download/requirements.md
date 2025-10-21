# 要件定義書

## 概要

この機能は、Zenless Zone Zero の武器エンティティのアイコン画像を weapon-list.json に保存されている icon_url から取得し、ローカルファイルシステムに保存する武器アイコンダウンロードシステムを作成します。システムは既存のボンプアイコンダウンロード機能と同様のアーキテクチャを使用し、各武器のアイコンを効率的にダウンロードして整理します。

## 用語集

- **Weapon_Icon_System**: 武器アイコンダウンロードシステム
- **Weapon_List_JSON**: json/data/weapon-list.json ファイル
- **Icon_URL**: 各武器エントリの icon_url フィールド
- **Local_Storage**: ローカルファイルシステムの保存先

## 要件

### 要件 1

**ユーザーストーリー:** 開発者として、武器のアイコン画像をローカルに保存したい。そうすることで、オフライン環境でもアプリケーションが画像を表示でき、外部 URL への依存を減らすことができる。

#### 受入基準

1. WHEN Weapon_Icon_System が weapon-list.json を処理する時、THE Weapon_Icon_System SHALL レアリティが S または A の武器のみを対象として各エントリの icon_url からアイコンをダウンロードする
2. WHEN アイコンをダウンロードする時、THE Weapon_Icon_System SHALL 適切なファイル名とディレクトリ構造で保存する
3. WHEN ダウンロードが失敗する時、THE Weapon_Icon_System SHALL エラーをログに記録し、他の武器の処理を継続する
4. WHEN 全ての武器を処理する時、THE Weapon_Icon_System SHALL 各武器のアイコンを個別にダウンロードする
5. WHEN Icon_URL が存在しない時、THE Weapon_Icon_System SHALL 警告をログに記録し、その武器をスキップする
6. WHEN 武器のレアリティが B の時、THE Weapon_Icon_System SHALL その武器をスキップし、処理対象から除外する

### 要件 2

**ユーザーストーリー:** 開発者として、ダウンロードした武器アイコン画像を整理された構造で保存したい。そうすることで、画像の管理と参照が容易になり、プロジェクトの保守性が向上する。

#### 受入基準

1. WHEN アイコンを保存する時、THE Weapon_Icon_System SHALL `assets/images/weapons/` ディレクトリ構造を使用する
2. WHEN アイコンを保存する時、THE Weapon_Icon_System SHALL `{entry_page_id}.png` 形式でファイル名を付ける
3. WHEN ファイル名に無効な文字が含まれる時、THE Weapon_Icon_System SHALL 安全な文字に変換または除去する
4. WHEN アイコンを保存する時、THE Weapon_Icon_System SHALL PNG 形式で保存する
5. WHEN ディレクトリが存在しない時、THE Weapon_Icon_System SHALL 自動的に作成する

### 要件 3

**ユーザーストーリー:** 開発者として、武器アイコンダウンロードのパフォーマンスと信頼性を確保したい。そうすることで、全ての武器アイコンを効率的に処理し、ネットワークエラーに対して堅牢なシステムを構築できる。

#### 受入基準

1. WHEN 複数のアイコンをダウンロードする時、THE Weapon_Icon_System SHALL 並行処理を使用して効率を向上させる
2. WHEN ダウンロードが失敗する時、THE Weapon_Icon_System SHALL 最大 3 回まで自動リトライを実行する
3. WHEN レート制限に遭遇する時、THE Weapon_Icon_System SHALL 適切な遅延を実装してサーバー負荷を軽減する
4. WHEN 既存のアイコンファイルが存在する時、THE Weapon_Icon_System SHALL ファイルサイズで重複チェックを行う
5. WHEN ダウンロード進捗を追跡する時、THE Weapon_Icon_System SHALL 詳細なログとプログレス情報を提供する

### 要件 4

**ユーザーストーリー:** 開発者として、ダウンロードした武器アイコンの整合性を確保したい。そうすることで、アイコンファイルが正しくダウンロードされ、適切に保存されることを保証できる。

#### 受入基準

1. WHEN アイコンダウンロードが完了する時、THE Weapon_Icon_System SHALL ファイルサイズが 0 バイトでないことを確認する
2. WHEN アイコンを保存する時、THE Weapon_Icon_System SHALL ファイルの書き込みが成功したことを確認する
3. WHEN ダウンロード処理を実行する時、THE Weapon_Icon_System SHALL 成功・失敗の統計情報をログに出力する
4. WHEN 処理が完了する時、THE Weapon_Icon_System SHALL ダウンロードされたアイコンの総数を報告する
5. WHEN エラーが発生する時、THE Weapon_Icon_System SHALL 詳細なエラー情報をログに記録する

### 要件 5

**ユーザーストーリー:** 開発者として、武器アイコンダウンロードシステムを既存のプロジェクトアーキテクチャに統合したい。そうすることで、一貫性のあるコードベースを維持し、将来の拡張が容易になる。

#### 受入基準

1. WHEN システムを実装する時、THE Weapon_Icon_System SHALL 既存のアーキテクチャレイヤー（parsers → processors → generators）に従う
2. WHEN 設定を管理する時、THE Weapon_Icon_System SHALL processing-config.json に武器アイコンダウンロード設定を追加する
3. WHEN エラーハンドリングを実装する時、THE Weapon_Icon_System SHALL 既存のエラークラスとログシステムを使用する
4. WHEN 型定義を作成する時、THE Weapon_Icon_System SHALL TypeScript の厳格な型安全性を維持する
5. WHEN weapon-list.json を読み込む時、THE Weapon_Icon_System SHALL 既存のファイルローダーシステムを使用する
