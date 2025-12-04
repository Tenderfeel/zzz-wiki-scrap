# Implementation Plan

- [x] 1. 型定義の更新

  - `src/types/index.ts`の`DriverDisc`型を更新し、`specialty`フィールドを`Specialty[]`配列型に変更する
  - `ProcessedDriverDiscData`インターフェースの`specialty`フィールドも配列型に変更する
  - _Requirements: 1.1, 1.2_

- [x] 2. DriverDiscDataMapper の拡張

  - [x] 2.1 効果テキストマッピングの定数を追加

    - `EFFECT_SPECIALTY_MAPPING`定数を作成し、Scraping.md の「効果に対応する specialty」マッピングルールを実装する
    - 各効果テキストに対応する特性配列を定義する
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15_

  - [x] 2.2 extractSpecialties メソッドの実装

    - 既存の`extractSpecialty`メソッドを`extractSpecialties`にリネームし、配列を返すように変更する
    - 4 セット効果と 2 セット効果の両方を引数として受け取るようにする
    - 特性キーワード（`[撃破]`など）の検出ロジックを実装する
    - 効果テキストマッピングルールを適用するロジックを実装する
    - `Set`を使用して重複する特性を除外する
    - 結果をソートして一貫性のある順序で返す
    - _Requirements: 2.1, 2.2, 2.16, 2.17, 2.18_

  - [x] 2.3 extractSpecialtiesFromText ヘルパーメソッドの実装
    - テキストから特性を抽出するプライベートメソッドを作成する
    - 特性キーワードと効果テキストマッピングの両方を適用する
    - _Requirements: 2.1, 2.2_

- [x] 3. DriverDiscGenerator の更新

  - [x] 3.1 formatDriverDiscObject メソッドの更新

    - `specialty`フィールドを配列形式で出力するように変更する
    - 配列要素を適切にフォーマットする（例: `["attack", "stun"]`）
    - _Requirements: 3.1_

  - [x] 3.2 validateDriverDisc メソッドの更新
    - `specialty`フィールドが配列であることを検証する
    - 配列が空でないことを検証する
    - 各要素が有効な`Specialty`値であることを検証する
    - _Requirements: 3.3_

- [x] 4. 既存データの変換

  - [x] 4.1 data/driverDiscs.ts の更新
    - 既存の全てのドライバディスクデータの`specialty`フィールドを配列形式に変換する
    - 各ドライバディスクについて、単一値を 1 要素の配列に変換する（例: `"attack"` → `["attack"]`）
    - _Requirements: 1.3_

- [x] 5. 既存コードの影響確認と修正

  - [x] 5.1 DriverDiscDataProcessor の更新

    - `extractSpecialties`メソッドの呼び出しを更新し、2 セット効果も渡すように変更する
    - 戻り値が配列であることを前提とした処理に変更する
    - _Requirements: 4.2_

  - [x] 5.2 型エラーの修正
    - TypeScript コンパイラを実行し、型エラーがないことを確認する
    - 必要に応じて、`specialty`フィールドを使用している他のコードを修正する
    - _Requirements: 4.1, 4.3_

- [x] 6. データ整合性の検証
  - 生成されたドライバディスクデータファイルをインポートし、TypeScript コンパイラがエラーを報告しないことを確認する
  - 全てのドライバディスクが配列形式の`specialty`フィールドを持つことを確認する
  - _Requirements: 3.3, 4.3_
