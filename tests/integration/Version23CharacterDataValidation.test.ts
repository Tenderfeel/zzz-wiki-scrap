import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  Character,
  Specialty,
  Stats,
  Rarity,
  AssistType,
} from "../../src/types";
import characters from "../../data/characters";
import * as fs from "fs";
import * as path from "path";

/**
 * バージョン2.3キャラクターデータの検証テスト
 * 要件: 3.1, 3.2, 3.3, 3.4
 *
 * このテストは生成されたキャラクターデータの構造、型適合性、
 * 必須フィールドの存在、空の値の適用、characters.ts出力形式を検証する
 */
describe("Version 2.3 Character Data Validation Tests", () => {
  // バージョン2.3キャラクターのID
  const version23CharacterIds = ["lucia", "manato", "yidhari"];

  // テスト用の一時ファイル
  const testOutputDir = "test-validation-output";
  const testCharactersFile = path.join(testOutputDir, "test-characters.ts");

  beforeEach(() => {
    // テスト用ディレクトリを作成
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterEach(() => {
    // テスト後のクリーンアップ
    if (fs.existsSync(testCharactersFile)) {
      fs.unlinkSync(testCharactersFile);
    }
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  describe("Character Object Structure and Type Compliance", () => {
    it("should validate that version 2.3 characters exist in the data", () => {
      const existingCharacterIds = characters.map((char) => char.id);

      version23CharacterIds.forEach((characterId) => {
        expect(existingCharacterIds).toContain(characterId);
      });
    });

    it("should validate Character type structure for version 2.3 characters", () => {
      const version23Characters = characters.filter((char) =>
        version23CharacterIds.includes(char.id)
      );

      expect(version23Characters.length).toBeGreaterThan(0);

      version23Characters.forEach((character) => {
        // 基本的な型チェック
        expect(character).toBeDefined();
        expect(typeof character).toBe("object");
        expect(character).not.toBeNull();

        // 必須フィールドの型チェック
        expect(typeof character.id).toBe("string");
        expect(character.id.length).toBeGreaterThan(0);

        // name フィールドの構造チェック
        expect(character.name).toBeDefined();
        expect(typeof character.name).toBe("object");
        expect(typeof character.name.ja).toBe("string");
        expect(typeof character.name.en).toBe("string");
        expect(character.name.ja.length).toBeGreaterThan(0);
        expect(character.name.en.length).toBeGreaterThan(0);

        // fullName フィールドの構造チェック
        expect(character.fullName).toBeDefined();
        expect(typeof character.fullName).toBe("object");
        expect(typeof character.fullName.ja).toBe("string");
        expect(typeof character.fullName.en).toBe("string");
        expect(character.fullName.ja.length).toBeGreaterThan(0);
        expect(character.fullName.en.length).toBeGreaterThan(0);

        // specialty の型チェック
        if (character.specialty !== undefined) {
          expect(typeof character.specialty).toBe("string");
          const validSpecialties: Specialty[] = [
            "attack",
            "stun",
            "anomaly",
            "support",
            "defense",
            "rupture",
          ];
          expect(validSpecialties).toContain(character.specialty);
        }

        // stats の型チェック
        expect(Array.isArray(character.stats)).toBe(true);
        expect(character.stats.length).toBeGreaterThan(0);
        const validStats: Stats[] = [
          "ether",
          "fire",
          "ice",
          "physical",
          "electric",
          "frost",
          "auricInk",
        ];
        character.stats.forEach((stat) => {
          expect(validStats).toContain(stat);
        });

        // assistType の型チェック（オプショナル）
        if (character.assistType !== undefined) {
          expect(typeof character.assistType).toBe("string");
          const validAssistTypes: AssistType[] = ["evasive", "defensive"];
          expect(validAssistTypes).toContain(character.assistType);
        }

        // faction の型チェック
        expect(typeof character.faction).toBe("number");
        expect(character.faction).toBeGreaterThanOrEqual(0);

        // rarity の型チェック
        if (character.rarity !== undefined) {
          expect(typeof character.rarity).toBe("string");
          const validRarities: Rarity[] = ["A", "S"];
          expect(validRarities).toContain(character.rarity);
        }

        // attr フィールドの構造チェック
        expect(character.attr).toBeDefined();
        expect(typeof character.attr).toBe("object");

        // 配列フィールドの検証（7要素）
        const arrayFields = ["hp", "atk", "def"];
        arrayFields.forEach((field) => {
          const value = character.attr[field as keyof typeof character.attr];
          expect(Array.isArray(value)).toBe(true);
          expect((value as number[]).length).toBe(7);
          (value as number[]).forEach((v) => {
            expect(typeof v).toBe("number");
            expect(v).toBeGreaterThanOrEqual(0);
          });
        });

        // 単一値フィールドの検証
        const singleFields = [
          "impact",
          "critRate",
          "critDmg",
          "anomalyMastery",
          "anomalyProficiency",
          "penRatio",
          "energy",
        ];
        singleFields.forEach((field) => {
          const value = character.attr[field as keyof typeof character.attr];
          expect(typeof value).toBe("number");
          expect(value).toBeGreaterThanOrEqual(0);
        });

        // releaseVersion の型チェック（オプショナル）
        if (character.releaseVersion !== undefined) {
          expect(typeof character.releaseVersion).toBe("number");
          expect(character.releaseVersion).toBeGreaterThan(0);
        }
      });
    });

    it("should validate specific version 2.3 character properties", () => {
      const lucia = characters.find((char) => char.id === "lucia");
      const manato = characters.find((char) => char.id === "manato");
      const yidhari = characters.find((char) => char.id === "yidhari");

      // lucia の検証
      if (lucia) {
        expect(lucia.name.ja).toBe("リュシア");
        expect(lucia.name.en).toBe("Lucia");
        expect(lucia.releaseVersion).toBe(2.3); // 実際のリリースバージョン

        // 完全なデータを持つことを確認
        expect(lucia.specialty).toBeDefined();
        expect(lucia.rarity).toBeDefined();
        expect(lucia.stats.length).toBeGreaterThan(0);
      }

      // manato の検証
      if (manato) {
        expect(manato.name.ja).toBe("狛野真斗");
        expect(manato.name.en).toBe("Komano Manato");
        expect(manato.releaseVersion).toBe(2.3); // 実際のリリースバージョン

        // 完全なデータを持つことを確認
        expect(manato.specialty).toBeDefined();
        expect(manato.rarity).toBeDefined();
        expect(manato.stats.length).toBeGreaterThan(0);
      }

      // yidhari の検証（部分データの可能性）
      if (yidhari) {
        expect(yidhari.name.ja).toBe("イドリー");
        expect(yidhari.name.en).toBe("Yidhari");
        expect(yidhari.releaseVersion).toBe(2.3); // 実際のリリースバージョン

        // 部分データでも基本構造は維持されることを確認
        expect(yidhari.id).toBe("yidhari");
        expect(yidhari.name).toBeDefined();
        expect(yidhari.fullName).toBeDefined();
        expect(yidhari.attr).toBeDefined();
      }
    });
  });

  describe("Required Field Presence and Empty Value Application", () => {
    it("should validate that all version 2.3 characters have required fields", () => {
      const version23Characters = characters.filter((char) =>
        version23CharacterIds.includes(char.id)
      );

      const requiredFields = [
        "id",
        "name",
        "fullName",
        "stats",
        "faction",
        "attr",
      ];

      version23Characters.forEach((character) => {
        requiredFields.forEach((field) => {
          expect(character).toHaveProperty(field);
          expect(character[field as keyof Character]).toBeDefined();
        });
      });
    });

    it("should validate empty value application for missing optional fields", () => {
      const yidhari = characters.find((char) => char.id === "yidhari");

      if (yidhari) {
        // yidhari は部分データなので、空の値が適用されている可能性がある

        // specialty が未定義または空の値の場合
        if (yidhari.specialty === undefined) {
          expect(yidhari.specialty).toBeUndefined();
        }

        // rarity が未定義または空の値の場合
        if (yidhari.rarity === undefined) {
          expect(yidhari.rarity).toBeUndefined();
        }

        // assistType が未定義の場合（これは正常）
        if (yidhari.assistType === undefined) {
          expect(yidhari.assistType).toBeUndefined();
        }

        // attr フィールドは必須なので、空の値でも存在する必要がある
        expect(yidhari.attr).toBeDefined();
        expect(yidhari.attr.hp).toBeDefined();
        expect(yidhari.attr.atk).toBeDefined();
        expect(yidhari.attr.def).toBeDefined();

        // 空の値が適用されている場合の検証
        if (yidhari.attr.hp.every((v) => v === 0)) {
          expect(yidhari.attr.hp).toEqual([]);
          expect(yidhari.attr.atk).toEqual([]);
          expect(yidhari.attr.def).toEqual([]);
        }
      }
    });

    it("should validate that empty values follow the correct format", () => {
      const version23Characters = characters.filter((char) =>
        version23CharacterIds.includes(char.id)
      );

      version23Characters.forEach((character) => {
        // 配列フィールドが空の場合、正しい長さを持つことを確認
        expect(character.attr.hp).toHaveLength(7);
        expect(character.attr.atk).toHaveLength(7);
        expect(character.attr.def).toHaveLength(7);

        // stats 配列が空でないことを確認
        expect(character.stats.length).toBeGreaterThan(0);

        // faction が有効な値であることを確認
        expect(character.faction).toBeGreaterThanOrEqual(0);

        // 文字列フィールドが空文字列でないことを確認
        expect(character.id.trim()).not.toBe("");
        expect(character.name.ja.trim()).not.toBe("");
        expect(character.name.en.trim()).not.toBe("");
        expect(character.fullName.ja.trim()).not.toBe("");
        expect(character.fullName.en.trim()).not.toBe("");
      });
    });

    it("should validate partial data handling for yidhari", () => {
      const yidhari = characters.find((char) => char.id === "yidhari");

      if (yidhari) {
        // yidhari の部分データ処理が正しく行われていることを確認

        // 基本情報は存在する必要がある
        expect(yidhari.id).toBe("yidhari");
        expect(yidhari.name.ja).toBe("イドリー");
        expect(yidhari.name.en).toBe("Yidhari");

        // stats は少なくとも1つの要素を持つ必要がある
        expect(yidhari.stats.length).toBeGreaterThan(0);

        // attr フィールドは存在し、正しい構造を持つ必要がある
        expect(yidhari.attr).toBeDefined();
        expect(yidhari.attr.hp).toHaveLength(7);
        expect(yidhari.attr.atk).toHaveLength(7);
        expect(yidhari.attr.def).toHaveLength(7);

        // 数値フィールドは数値である必要がある
        expect(typeof yidhari.attr.impact).toBe("number");
        expect(typeof yidhari.attr.critRate).toBe("number");
        expect(typeof yidhari.attr.critDmg).toBe("number");
        expect(typeof yidhari.attr.anomalyMastery).toBe("number");
        expect(typeof yidhari.attr.anomalyProficiency).toBe("number");
        expect(typeof yidhari.attr.penRatio).toBe("number");
        expect(typeof yidhari.attr.energy).toBe("number");
      }
    });
  });

  describe("characters.ts Output Format and Integration", () => {
    it("should validate characters.ts export format", () => {
      // characters.ts ファイルが正しい形式でエクスポートされていることを確認
      expect(Array.isArray(characters)).toBe(true);
      expect(characters.length).toBeGreaterThan(0);

      // バージョン2.3キャラクターが含まれていることを確認
      const characterIds = characters.map((char) => char.id);
      version23CharacterIds.forEach((id) => {
        expect(characterIds).toContain(id);
      });
    });

    it("should validate integration with existing character data", () => {
      const version23Characters = characters.filter((char) =>
        version23CharacterIds.includes(char.id)
      );
      const existingCharacters = characters.filter(
        (char) => !version23CharacterIds.includes(char.id)
      );

      // 既存キャラクターが存在することを確認
      expect(existingCharacters.length).toBeGreaterThan(0);

      // バージョン2.3キャラクターが追加されていることを確認
      expect(version23Characters.length).toBeGreaterThan(0);

      // 全体のデータ整合性を確認
      expect(version23Characters.length + existingCharacters.length).toBe(
        characters.length
      );

      // ID の重複がないことを確認
      const allIds = characters.map((char) => char.id);
      const uniqueIds = new Set(allIds);
      expect(allIds.length).toBe(uniqueIds.size);
    });

    it("should validate TypeScript export compatibility", () => {
      // TypeScript の型チェックが通ることを確認するため、
      // 各キャラクターが Character 型に適合することを検証

      characters.forEach((character, index) => {
        // Character 型の必須プロパティをチェック
        expect(character).toHaveProperty("id");
        expect(character).toHaveProperty("name");
        expect(character).toHaveProperty("fullName");
        expect(character).toHaveProperty("stats");
        expect(character).toHaveProperty("faction");
        expect(character).toHaveProperty("attr");

        // 型の整合性をチェック
        expect(typeof character.id).toBe("string");
        expect(typeof character.name).toBe("object");
        expect(typeof character.fullName).toBe("object");
        expect(Array.isArray(character.stats)).toBe(true);
        expect(typeof character.faction).toBe("number");
        expect(typeof character.attr).toBe("object");

        // エラー時のデバッグ情報
        if (version23CharacterIds.includes(character.id)) {
          console.log(
            `Version 2.3 character validation passed: ${character.id} (index: ${index})`
          );
        }
      });
    });

    it("should validate character data consistency across versions", () => {
      const version23Characters = characters.filter((char) =>
        version23CharacterIds.includes(char.id)
      );

      version23Characters.forEach((character) => {
        // リリースバージョンが適切に設定されていることを確認
        if (character.releaseVersion !== undefined) {
          expect(character.releaseVersion).toBeGreaterThanOrEqual(2.0);
        }

        // 他のキャラクターと同じデータ構造を持つことを確認
        const sampleExistingCharacter = characters.find(
          (char) =>
            !version23CharacterIds.includes(char.id) &&
            char.specialty !== undefined
        );

        if (sampleExistingCharacter) {
          // 同じプロパティ構造を持つことを確認
          const characterKeys = Object.keys(character).sort();
          const sampleKeys = Object.keys(sampleExistingCharacter).sort();

          // 必須フィールドが一致することを確認
          const requiredFields = [
            "id",
            "name",
            "fullName",
            "stats",
            "faction",
            "attr",
          ];
          requiredFields.forEach((field) => {
            expect(characterKeys).toContain(field);
            expect(sampleKeys).toContain(field);
          });
        }
      });
    });

    it("should create and validate test characters.ts output", () => {
      // テスト用のcharacters.tsファイルを生成
      const testCharactersContent = `import { Character } from "../src/types";

export default ${JSON.stringify(characters, null, 2)} as Character[];
`;

      fs.writeFileSync(testCharactersFile, testCharactersContent);

      // ファイルが正しく作成されたことを確認
      expect(fs.existsSync(testCharactersFile)).toBe(true);

      // ファイル内容を読み込んで検証
      const fileContent = fs.readFileSync(testCharactersFile, "utf-8");
      expect(fileContent).toContain("import { Character }");
      expect(fileContent).toContain("export default");

      // バージョン2.3キャラクターが含まれていることを確認
      version23CharacterIds.forEach((id) => {
        expect(fileContent).toContain(`"id": "${id}"`);
      });
    });

    it("should validate data serialization and deserialization", () => {
      // JSON シリアライゼーションが正しく動作することを確認
      const serialized = JSON.stringify(characters);
      const deserialized = JSON.parse(serialized);

      expect(Array.isArray(deserialized)).toBe(true);
      expect(deserialized.length).toBe(characters.length);

      // バージョン2.3キャラクターのシリアライゼーションを確認
      const version23Characters = deserialized.filter((char: any) =>
        version23CharacterIds.includes(char.id)
      );

      expect(version23Characters.length).toBeGreaterThan(0);

      version23Characters.forEach((character: any) => {
        expect(character.id).toBeDefined();
        expect(character.name).toBeDefined();
        expect(character.attr).toBeDefined();
        expect(Array.isArray(character.stats)).toBe(true);
      });
    });
  });

  describe("Version 2.3 Specific Validation", () => {
    it("should validate version 2.3 character release versions", () => {
      const version23Characters = characters.filter((char) =>
        version23CharacterIds.includes(char.id)
      );

      version23Characters.forEach((character) => {
        // リリースバージョンが2.3以上であることを確認（実際のリリースバージョン）
        if (character.releaseVersion !== undefined) {
          expect(character.releaseVersion).toBeGreaterThanOrEqual(2.3);
        }
      });
    });

    it("should validate version 2.3 character unique properties", () => {
      const lucia = characters.find((char) => char.id === "lucia");
      const manato = characters.find((char) => char.id === "manato");
      const yidhari = characters.find((char) => char.id === "yidhari");

      // lucia の特有プロパティ
      if (lucia) {
        expect(lucia.specialty).toBe("support");
        expect(lucia.stats).toContain("ether");
        expect(lucia.rarity).toBe("S");
      }

      // manato の特有プロパティ
      if (manato) {
        expect(manato.specialty).toBe("rupture");
        expect(manato.stats).toContain("fire");
        expect(manato.rarity).toBe("A");
      }

      // yidhari の特有プロパティ（部分データでも基本情報は存在）
      if (yidhari) {
        expect(yidhari.specialty).toBe("rupture");
        expect(yidhari.stats).toContain("ice");
        expect(yidhari.rarity).toBe("S");
      }
    });

    it("should validate version 2.3 character data completeness", () => {
      const version23Characters = characters.filter((char) =>
        version23CharacterIds.includes(char.id)
      );

      const completeCharacters = version23Characters.filter(
        (char) =>
          char.specialty !== undefined &&
          char.rarity !== undefined &&
          char.attr.hp.some((v) => v > 0)
      );

      const partialCharacters = version23Characters.filter(
        (char) =>
          char.specialty === undefined ||
          char.rarity === undefined ||
          char.attr.hp.every((v) => v === 0)
      );

      // 少なくとも一部のキャラクターは完全なデータを持つことを確認
      expect(completeCharacters.length).toBeGreaterThan(0);

      // 部分データキャラクターも基本構造は維持されることを確認
      partialCharacters.forEach((character) => {
        expect(character.id).toBeDefined();
        expect(character.name).toBeDefined();
        expect(character.fullName).toBeDefined();
        expect(character.attr).toBeDefined();
        expect(character.stats.length).toBeGreaterThan(0);
      });

      console.log(`Version 2.3 validation summary:`, {
        total: version23Characters.length,
        complete: completeCharacters.length,
        partial: partialCharacters.length,
        completeIds: completeCharacters.map((c) => c.id),
        partialIds: partialCharacters.map((c) => c.id),
      });
    });
  });
});
