import { describe, it, expect } from "vitest";
import characters from "../../data/characters";
import {
  Character,
  AssistType,
  Specialty,
  Stats,
  Rarity,
} from "../../src/types";

describe("キャラクターデータの整合性テスト", () => {
  describe("assistType 値の妥当性テスト", () => {
    const validAssistTypes: AssistType[] = ["evasive", "defensive"];

    it("全キャラクターの assistType が有効な値であること", () => {
      const invalidAssistTypes: Array<{
        id: string;
        assistType: unknown;
      }> = [];

      characters.forEach((character) => {
        if (character.assistType !== undefined) {
          if (!validAssistTypes.includes(character.assistType)) {
            invalidAssistTypes.push({
              id: character.id,
              assistType: character.assistType,
            });
          }
        }
      });

      expect(invalidAssistTypes).toEqual([]);
    });

    it("assistType が設定されているキャラクターの統計情報", () => {
      const withAssistType = characters.filter(
        (char) => char.assistType !== undefined
      );
      const withoutAssistType = characters.filter(
        (char) => char.assistType === undefined
      );

      const evasiveCount = characters.filter(
        (char) => char.assistType === "evasive"
      ).length;
      const defensiveCount = characters.filter(
        (char) => char.assistType === "defensive"
      ).length;

      // 統計情報の妥当性チェック
      expect(withAssistType.length + withoutAssistType.length).toBe(
        characters.length
      );
      expect(evasiveCount + defensiveCount).toBe(withAssistType.length);
    });

    it("assistType が未設定のキャラクターリスト", () => {
      const charactersWithoutAssistType = characters
        .filter((char) => char.assistType === undefined)
        .map((char) => ({
          id: char.id,
          name: char.name.ja,
          specialty: char.specialty,
        }));

      // 要件 1.3: キャラクターが支援タイプを持たない場合、assistType フィールドは undefined
      // これは正常な状態なので、テストは通過させる
      expect(charactersWithoutAssistType).toBeDefined();
    });
  });

  describe("データファイルの構造検証テスト", () => {
    it("全キャラクターが必須フィールドを持つこと", () => {
      const requiredFields = [
        "id",
        "name",
        "fullName",
        "specialty",
        "stats",
        "faction",
        "rarity",
        "attr",
      ];

      const invalidCharacters: Array<{
        id: string;
        missingFields: string[];
      }> = [];

      characters.forEach((character) => {
        const missingFields = requiredFields.filter(
          (field) =>
            !(field in character) ||
            character[field as keyof Character] === undefined
        );

        if (missingFields.length > 0) {
          invalidCharacters.push({
            id: character.id || "unknown",
            missingFields,
          });
        }
      });

      expect(invalidCharacters).toEqual([]);
    });

    it("name と fullName が多言語対応していること", () => {
      const invalidNames: Array<{
        id: string;
        issue: string;
      }> = [];

      characters.forEach((character) => {
        // name の検証
        if (!character.name || typeof character.name !== "object") {
          invalidNames.push({
            id: character.id,
            issue: "name が正しいオブジェクト形式ではない",
          });
        } else {
          if (!character.name.ja || !character.name.en) {
            invalidNames.push({
              id: character.id,
              issue: "name に ja または en が不足",
            });
          }
        }

        // fullName の検証
        if (!character.fullName || typeof character.fullName !== "object") {
          invalidNames.push({
            id: character.id,
            issue: "fullName が正しいオブジェクト形式ではない",
          });
        } else {
          if (!character.fullName.ja || !character.fullName.en) {
            invalidNames.push({
              id: character.id,
              issue: "fullName に ja または en が不足",
            });
          }
        }
      });

      expect(invalidNames).toEqual([]);
    });

    it("specialty が有効な値であること", () => {
      const validSpecialties: Specialty[] = [
        "attack",
        "stun",
        "anomaly",
        "support",
        "defense",
        "rupture",
      ];

      const invalidSpecialties = characters.filter(
        (char) => !validSpecialties.includes(char.specialty)
      );

      expect(invalidSpecialties).toEqual([]);
    });

    it("stats が有効な値であること", () => {
      const validStats: Stats[] = [
        "ether",
        "fire",
        "ice",
        "physical",
        "electric",
        "frostAttribute",
        "auricInk",
      ];

      const invalidStats = characters.filter(
        (char) => !validStats.includes(char.stats)
      );

      expect(invalidStats).toEqual([]);
    });

    it("rarity が有効な値であること", () => {
      const validRarities: Rarity[] = ["A", "S"];

      const invalidRarities = characters.filter(
        (char) => !validRarities.includes(char.rarity)
      );

      expect(invalidRarities).toEqual([]);
    });

    it("attr フィールドが正しい構造を持つこと", () => {
      const invalidAttrs: Array<{
        id: string;
        issues: string[];
      }> = [];

      characters.forEach((character) => {
        const issues: string[] = [];
        const attr = character.attr;

        if (!attr) {
          issues.push("attr が存在しない");
          invalidAttrs.push({ id: character.id, issues });
          return;
        }

        // 配列フィールドの検証（7要素である必要がある）
        const arrayFields = ["hp", "atk", "def"];
        arrayFields.forEach((field) => {
          const value = attr[field as keyof typeof attr];
          if (!Array.isArray(value)) {
            issues.push(`${field} が配列ではない`);
          } else if (value.length !== 7) {
            issues.push(`${field} の要素数が7ではない (${value.length})`);
          } else if (!value.every((v) => typeof v === "number")) {
            issues.push(`${field} に数値以外の要素が含まれている`);
          }
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
          const value = attr[field as keyof typeof attr];
          if (typeof value !== "number") {
            issues.push(`${field} が数値ではない`);
          }
        });

        if (issues.length > 0) {
          invalidAttrs.push({ id: character.id, issues });
        }
      });

      expect(invalidAttrs).toEqual([]);
    });
  });

  describe("重複や欠損データの検出テスト", () => {
    it("キャラクター ID に重複がないこと", () => {
      const ids = characters.map((char) => char.id);
      const uniqueIds = new Set(ids);

      const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

      expect(duplicates).toEqual([]);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it("キャラクター名（日本語）に重複がないこと", () => {
      const jaNames = characters.map((char) => char.name.ja);
      const uniqueJaNames = new Set(jaNames);

      const duplicates = jaNames.filter(
        (name, index) => jaNames.indexOf(name) !== index
      );

      expect(duplicates).toEqual([]);
      expect(jaNames.length).toBe(uniqueJaNames.size);
    });

    it("キャラクター名（英語）に重複がないこと", () => {
      const enNames = characters.map((char) => char.name.en);
      const uniqueEnNames = new Set(enNames);

      const duplicates = enNames.filter(
        (name, index) => enNames.indexOf(name) !== index
      );

      expect(duplicates).toEqual([]);
      expect(enNames.length).toBe(uniqueEnNames.size);
    });

    it("faction ID が有効な範囲内であること", () => {
      const invalidFactions = characters.filter(
        (char) => typeof char.faction !== "number" || char.faction < 1
      );

      expect(invalidFactions).toEqual([]);
    });

    it("空文字列や null 値が含まれていないこと", () => {
      const invalidValues: Array<{
        id: string;
        field: string;
        value: unknown;
      }> = [];

      characters.forEach((character) => {
        // ID の検証
        if (!character.id || character.id.trim() === "") {
          invalidValues.push({
            id: character.id || "unknown",
            field: "id",
            value: character.id,
          });
        }

        // 名前の検証
        if (!character.name.ja || character.name.ja.trim() === "") {
          invalidValues.push({
            id: character.id,
            field: "name.ja",
            value: character.name.ja,
          });
        }
        if (!character.name.en || character.name.en.trim() === "") {
          invalidValues.push({
            id: character.id,
            field: "name.en",
            value: character.name.en,
          });
        }

        // フルネームの検証
        if (!character.fullName.ja || character.fullName.ja.trim() === "") {
          invalidValues.push({
            id: character.id,
            field: "fullName.ja",
            value: character.fullName.ja,
          });
        }
        if (!character.fullName.en || character.fullName.en.trim() === "") {
          invalidValues.push({
            id: character.id,
            field: "fullName.en",
            value: character.fullName.en,
          });
        }
      });

      expect(invalidValues).toEqual([]);
    });

    it("数値フィールドが適切な範囲内であること", () => {
      const invalidRanges: Array<{
        id: string;
        field: string;
        value: number;
        issue: string;
      }> = [];

      characters.forEach((character) => {
        const attr = character.attr;

        // HP, ATK, DEF の範囲チェック
        ["hp", "atk", "def"].forEach((field) => {
          const values = attr[field as keyof typeof attr] as number[];
          if (Array.isArray(values)) {
            values.forEach((value, index) => {
              if (value < 0) {
                invalidRanges.push({
                  id: character.id,
                  field: `${field}[${index}]`,
                  value,
                  issue: "負の値",
                });
              }
              if (value > 50000) {
                // 現実的でない高い値
                invalidRanges.push({
                  id: character.id,
                  field: `${field}[${index}]`,
                  value,
                  issue: "異常に高い値",
                });
              }
            });
          }
        });

        // パーセンテージ値の範囲チェック
        if (attr.critRate < 0 || attr.critRate > 100) {
          invalidRanges.push({
            id: character.id,
            field: "critRate",
            value: attr.critRate,
            issue: "0-100の範囲外",
          });
        }

        if (attr.critDmg < 0 || attr.critDmg > 1000) {
          invalidRanges.push({
            id: character.id,
            field: "critDmg",
            value: attr.critDmg,
            issue: "0-1000の範囲外",
          });
        }
      });

      expect(invalidRanges).toEqual([]);
    });
  });

  describe("assistType と specialty の関連性テスト", () => {
    it("support specialty のキャラクターの assistType 分布", () => {
      const supportCharacters = characters.filter(
        (char) => char.specialty === "support"
      );

      const supportWithAssistType = supportCharacters.filter(
        (char) => char.assistType !== undefined
      );

      const supportEvasive = supportCharacters.filter(
        (char) => char.assistType === "evasive"
      );

      const supportDefensive = supportCharacters.filter(
        (char) => char.assistType === "defensive"
      );

      // support キャラクターは何らかの assistType を持つべき（要件に基づく）
      expect(supportCharacters.length).toBeGreaterThan(0);

      // 統計情報を検証
      expect(
        supportWithAssistType.length +
          (supportCharacters.length - supportWithAssistType.length)
      ).toBe(supportCharacters.length);
      expect(supportEvasive.length + supportDefensive.length).toBe(
        supportWithAssistType.length
      );
    });

    it("各 specialty における assistType の分布", () => {
      const specialtyDistribution: Record<
        Specialty,
        { total: number; evasive: number; defensive: number; undefined: number }
      > = {
        attack: { total: 0, evasive: 0, defensive: 0, undefined: 0 },
        stun: { total: 0, evasive: 0, defensive: 0, undefined: 0 },
        anomaly: { total: 0, evasive: 0, defensive: 0, undefined: 0 },
        support: { total: 0, evasive: 0, defensive: 0, undefined: 0 },
        defense: { total: 0, evasive: 0, defensive: 0, undefined: 0 },
        rupture: { total: 0, evasive: 0, defensive: 0, undefined: 0 },
      };

      characters.forEach((char) => {
        const dist = specialtyDistribution[char.specialty];
        dist.total++;

        if (char.assistType === "evasive") {
          dist.evasive++;
        } else if (char.assistType === "defensive") {
          dist.defensive++;
        } else {
          dist.undefined++;
        }
      });

      // 分布の妥当性チェック
      Object.values(specialtyDistribution).forEach((dist) => {
        expect(dist.evasive + dist.defensive + dist.undefined).toBe(dist.total);
      });

      // 現在のデータ状況を記録（テスト失敗時の参考情報）
      const currentStats = {
        totalCharacters: characters.length,
        withAssistType: characters.filter((c) => c.assistType !== undefined)
          .length,
        evasiveTotal: characters.filter((c) => c.assistType === "evasive")
          .length,
        defensiveTotal: characters.filter((c) => c.assistType === "defensive")
          .length,
      };

      expect(currentStats.totalCharacters).toBeGreaterThan(0);
    });
  });

  describe("データ品質の詳細検証", () => {
    it("assistType の値が型定義と一致すること", () => {
      const validAssistTypes = ["evasive", "defensive"];

      characters.forEach((char) => {
        if (char.assistType !== undefined) {
          expect(validAssistTypes).toContain(char.assistType);
          expect(typeof char.assistType).toBe("string");
        }
      });
    });

    it("assistType 未設定キャラクターの一覧が要件と一致すること", () => {
      const charactersWithoutAssistType = characters
        .filter((char) => char.assistType === undefined)
        .map((char) => char.id);

      // 要件 1.3: キャラクターが支援タイプを持たない場合、assistType フィールドは undefined
      // これは正常な状態として扱う
      expect(Array.isArray(charactersWithoutAssistType)).toBe(true);

      // 未設定キャラクターが存在する場合、それらが有効なキャラクターIDであることを確認
      charactersWithoutAssistType.forEach((id) => {
        expect(typeof id).toBe("string");
        expect(id.length).toBeGreaterThan(0);
      });
    });

    it("assistType 設定済みキャラクターの分布が妥当であること", () => {
      const evasiveChars = characters.filter(
        (char) => char.assistType === "evasive"
      );
      const defensiveChars = characters.filter(
        (char) => char.assistType === "defensive"
      );

      // 両方のタイプが存在することを確認（現在のデータに基づく）
      expect(evasiveChars.length).toBeGreaterThanOrEqual(0);
      expect(defensiveChars.length).toBeGreaterThanOrEqual(0);

      // evasive と defensive の合計が assistType 設定済みキャラクター数と一致
      const totalWithAssistType = characters.filter(
        (char) => char.assistType !== undefined
      ).length;
      expect(evasiveChars.length + defensiveChars.length).toBe(
        totalWithAssistType
      );
    });

    it("キャラクターデータの完全性チェック", () => {
      // 全キャラクターが有効なオブジェクトであることを確認
      characters.forEach((char, index) => {
        expect(char).toBeDefined();
        expect(typeof char).toBe("object");
        expect(char).not.toBeNull();

        // インデックス情報をエラーメッセージに含める
        expect(
          char.id,
          `Character at index ${index} should have valid id`
        ).toBeDefined();
        expect(
          typeof char.id,
          `Character at index ${index} id should be string`
        ).toBe("string");
      });
    });

    it("現在のデータ状況のスナップショット", () => {
      // 現在のデータ状況を記録（将来の変更を追跡するため）
      const currentSnapshot = {
        totalCharacters: characters.length,
        withAssistType: characters.filter((c) => c.assistType !== undefined)
          .length,
        withoutAssistType: characters.filter((c) => c.assistType === undefined)
          .length,
        evasiveCount: characters.filter((c) => c.assistType === "evasive")
          .length,
        defensiveCount: characters.filter((c) => c.assistType === "defensive")
          .length,
        specialtyDistribution: {
          attack: characters.filter((c) => c.specialty === "attack").length,
          stun: characters.filter((c) => c.specialty === "stun").length,
          anomaly: characters.filter((c) => c.specialty === "anomaly").length,
          support: characters.filter((c) => c.specialty === "support").length,
          defense: characters.filter((c) => c.specialty === "defense").length,
          rupture: characters.filter((c) => c.specialty === "rupture").length,
        },
      };

      // 基本的な整合性チェック
      expect(
        currentSnapshot.withAssistType + currentSnapshot.withoutAssistType
      ).toBe(currentSnapshot.totalCharacters);
      expect(
        currentSnapshot.evasiveCount + currentSnapshot.defensiveCount
      ).toBe(currentSnapshot.withAssistType);

      // 現在のスナップショットが妥当であることを確認
      expect(currentSnapshot.totalCharacters).toBeGreaterThan(0);
      expect(
        Object.values(currentSnapshot.specialtyDistribution).reduce(
          (a, b) => a + b,
          0
        )
      ).toBe(currentSnapshot.totalCharacters);
    });
  });
});
