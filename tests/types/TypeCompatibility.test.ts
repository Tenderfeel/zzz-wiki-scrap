import { describe, it, expect } from "vitest";
import {
  Character,
  AssistType,
  Specialty,
  Stats,
  Rarity,
  Attributes,
  Lang,
} from "../../src/types";

describe("型定義の互換性テスト", () => {
  describe("Character型の互換性", () => {
    it("assistTypeフィールドがオプショナルであることを確認", () => {
      // assistTypeなしのキャラクターデータ（既存データ形式）
      const characterWithoutAssistType: Character = {
        id: "test-character",
        name: { ja: "テストキャラ", en: "Test Character" },
        fullName: { ja: "テスト・キャラクター", en: "Test Character" },
        specialty: "attack",
        stats: ["physical"],
        faction: 1,
        rarity: "A",
        attr: {
          hp: [100, 200, 300, 400, 500, 600, 700],
          atk: [50, 60, 70, 80, 90, 100, 110],
          def: [30, 40, 50, 60, 70, 80, 90],
          impact: 95,
          critRate: 5,
          critDmg: 50,
          anomalyMastery: 90,
          anomalyProficiency: 86,
          penRatio: 0,
          energy: 1.2,
        },
      };

      // TypeScriptコンパイルエラーが発生しないことを確認
      expect(characterWithoutAssistType).toBeDefined();
      expect(characterWithoutAssistType.assistType).toBeUndefined();
    });

    it("assistTypeフィールドありのキャラクターデータが正常に動作することを確認", () => {
      // assistTypeありのキャラクターデータ（新形式）
      const characterWithAssistType: Character = {
        id: "test-character-with-assist",
        name: { ja: "支援テストキャラ", en: "Assist Test Character" },
        fullName: {
          ja: "支援・テスト・キャラクター",
          en: "Assist Test Character",
        },
        specialty: "support",
        stats: ["ether"],
        assistType: "evasive",
        faction: 2,
        rarity: "S",
        attr: {
          hp: [150, 250, 350, 450, 550, 650, 750],
          atk: [60, 70, 80, 90, 100, 110, 120],
          def: [40, 50, 60, 70, 80, 90, 100],
          impact: 88,
          critRate: 5,
          critDmg: 50,
          anomalyMastery: 93,
          anomalyProficiency: 90,
          penRatio: 0,
          energy: 1.2,
        },
      };

      expect(characterWithAssistType).toBeDefined();
      expect(characterWithAssistType.assistType).toBe("evasive");
    });

    it("既存のキャラクターデータ配列との互換性を確認", () => {
      // 混在したキャラクターデータ配列
      const mixedCharacters: Character[] = [
        {
          id: "old-character",
          name: { ja: "旧キャラ", en: "Old Character" },
          fullName: { ja: "旧・キャラクター", en: "Old Character" },
          specialty: "attack",
          stats: ["fire"],
          faction: 1,
          rarity: "A",
          attr: {
            hp: [100, 200, 300, 400, 500, 600, 700],
            atk: [50, 60, 70, 80, 90, 100, 110],
            def: [30, 40, 50, 60, 70, 80, 90],
            impact: 95,
            critRate: 5,
            critDmg: 50,
            anomalyMastery: 90,
            anomalyProficiency: 86,
            penRatio: 0,
            energy: 1.2,
          },
        },
        {
          id: "new-character",
          name: { ja: "新キャラ", en: "New Character" },
          fullName: { ja: "新・キャラクター", en: "New Character" },
          specialty: "support",
          stats: ["ice"],
          assistType: "defensive",
          faction: 2,
          rarity: "S",
          attr: {
            hp: [120, 220, 320, 420, 520, 620, 720],
            atk: [55, 65, 75, 85, 95, 105, 115],
            def: [35, 45, 55, 65, 75, 85, 95],
            impact: 88,
            critRate: 5,
            critDmg: 50,
            anomalyMastery: 93,
            anomalyProficiency: 90,
            penRatio: 0,
            energy: 1.2,
          },
        },
      ];

      expect(mixedCharacters).toHaveLength(2);
      expect(mixedCharacters[0].assistType).toBeUndefined();
      expect(mixedCharacters[1].assistType).toBe("defensive");
    });
  });

  describe("AssistType型の検証", () => {
    it("有効なAssistType値を受け入れることを確認", () => {
      const evasiveType: AssistType = "evasive";
      const defensiveType: AssistType = "defensive";

      expect(evasiveType).toBe("evasive");
      expect(defensiveType).toBe("defensive");
    });

    it("AssistType値の型安全性を確認", () => {
      // TypeScriptコンパイル時に型チェックされることを確認
      const validAssistTypes: AssistType[] = ["evasive", "defensive"];

      expect(validAssistTypes).toContain("evasive");
      expect(validAssistTypes).toContain("defensive");
      expect(validAssistTypes).toHaveLength(2);
    });
  });

  describe("既存型定義との互換性", () => {
    it("Specialty型が正常に動作することを確認", () => {
      const specialties: Specialty[] = [
        "attack",
        "stun",
        "anomaly",
        "support",
        "defense",
        "rupture",
      ];

      expect(specialties).toHaveLength(6);
      expect(specialties).toContain("support"); // 支援タイプと関連する特性
    });

    it("Stats型が正常に動作することを確認", () => {
      const stats: Stats[] = [
        "ether",
        "fire",
        "ice",
        "physical",
        "electric",
        "frost",
        "auricInk",
      ];

      expect(stats).toHaveLength(7);
    });

    it("Character.stats配列型が正常に動作することを確認", () => {
      // 単一属性キャラクター
      const singleStatsCharacter: Character = {
        id: "single-stats",
        name: { ja: "単一属性", en: "Single Stats" },
        fullName: { ja: "単一属性キャラ", en: "Single Stats Character" },
        specialty: "attack",
        stats: ["physical"],
        faction: 1,
        rarity: "A",
        attr: {
          hp: [100, 200, 300, 400, 500, 600, 700],
          atk: [50, 60, 70, 80, 90, 100, 110],
          def: [30, 40, 50, 60, 70, 80, 90],
          impact: 95,
          critRate: 5,
          critDmg: 50,
          anomalyMastery: 90,
          anomalyProficiency: 86,
          penRatio: 0,
          energy: 1.2,
        },
      };

      // 複数属性キャラクター（霜烈属性）
      const multiStatsCharacter: Character = {
        id: "multi-stats",
        name: { ja: "複数属性", en: "Multi Stats" },
        fullName: { ja: "複数属性キャラ", en: "Multi Stats Character" },
        specialty: "anomaly",
        stats: ["ice", "frost"],
        faction: 1,
        rarity: "S",
        attr: {
          hp: [120, 220, 320, 420, 520, 620, 720],
          atk: [55, 65, 75, 85, 95, 105, 115],
          def: [35, 45, 55, 65, 75, 85, 95],
          impact: 88,
          critRate: 5,
          critDmg: 50,
          anomalyMastery: 93,
          anomalyProficiency: 90,
          penRatio: 0,
          energy: 1.2,
        },
      };

      expect(singleStatsCharacter.stats).toHaveLength(1);
      expect(singleStatsCharacter.stats[0]).toBe("physical");

      expect(multiStatsCharacter.stats).toHaveLength(2);
      expect(multiStatsCharacter.stats).toContain("ice");
      expect(multiStatsCharacter.stats).toContain("frost");
    });

    it("Rarity型が正常に動作することを確認", () => {
      const rarities: Rarity[] = ["A", "S"];

      expect(rarities).toHaveLength(2);
      expect(rarities).toContain("A");
      expect(rarities).toContain("S");
    });

    it("Lang型が正常に動作することを確認", () => {
      const languages: Lang[] = ["en", "ja"];

      expect(languages).toHaveLength(2);
      expect(languages).toContain("ja");
      expect(languages).toContain("en");
    });

    it("Attributes型が正常に動作することを確認", () => {
      const attributes: Attributes = {
        hp: [100, 200, 300, 400, 500, 600, 700],
        atk: [50, 60, 70, 80, 90, 100, 110],
        def: [30, 40, 50, 60, 70, 80, 90],
        impact: 95,
        critRate: 5,
        critDmg: 50,
        anomalyMastery: 90,
        anomalyProficiency: 86,
        penRatio: 0,
        energy: 1.2,
      };

      expect(attributes.hp).toHaveLength(7);
      expect(attributes.atk).toHaveLength(7);
      expect(attributes.def).toHaveLength(7);
      expect(typeof attributes.impact).toBe("number");
    });
  });

  describe("データ処理関数との互換性", () => {
    it("assistTypeフィールドの有無に関わらず処理できることを確認", () => {
      const processCharacter = (character: Character): string => {
        const assistInfo = character.assistType
          ? ` (支援タイプ: ${character.assistType})`
          : " (支援タイプなし)";

        return `${character.name.ja}${assistInfo}`;
      };

      const characterWithoutAssist: Character = {
        id: "test1",
        name: { ja: "テスト1", en: "Test1" },
        fullName: { ja: "テスト・ワン", en: "Test One" },
        specialty: "attack",
        stats: ["physical"],
        faction: 1,
        rarity: "A",
        attr: {
          hp: [100, 200, 300, 400, 500, 600, 700],
          atk: [50, 60, 70, 80, 90, 100, 110],
          def: [30, 40, 50, 60, 70, 80, 90],
          impact: 95,
          critRate: 5,
          critDmg: 50,
          anomalyMastery: 90,
          anomalyProficiency: 86,
          penRatio: 0,
          energy: 1.2,
        },
      };

      const characterWithAssist: Character = {
        ...characterWithoutAssist,
        id: "test2",
        name: { ja: "テスト2", en: "Test2" },
        assistType: "evasive",
      };

      expect(processCharacter(characterWithoutAssist)).toBe(
        "テスト1 (支援タイプなし)"
      );
      expect(processCharacter(characterWithAssist)).toBe(
        "テスト2 (支援タイプ: evasive)"
      );
    });

    it("配列操作でassistTypeフィールドが適切に処理されることを確認", () => {
      const characters: Character[] = [
        {
          id: "char1",
          name: { ja: "キャラ1", en: "Char1" },
          fullName: { ja: "キャラクター・ワン", en: "Character One" },
          specialty: "support",
          stats: ["ether"],
          assistType: "evasive",
          faction: 1,
          rarity: "S",
          attr: {
            hp: [100, 200, 300, 400, 500, 600, 700],
            atk: [50, 60, 70, 80, 90, 100, 110],
            def: [30, 40, 50, 60, 70, 80, 90],
            impact: 88,
            critRate: 5,
            critDmg: 50,
            anomalyMastery: 93,
            anomalyProficiency: 90,
            penRatio: 0,
            energy: 1.2,
          },
        },
        {
          id: "char2",
          name: { ja: "キャラ2", en: "Char2" },
          fullName: { ja: "キャラクター・ツー", en: "Character Two" },
          specialty: "attack",
          stats: ["fire"],
          faction: 2,
          rarity: "A",
          attr: {
            hp: [120, 220, 320, 420, 520, 620, 720],
            atk: [55, 65, 75, 85, 95, 105, 115],
            def: [35, 45, 55, 65, 75, 85, 95],
            impact: 95,
            critRate: 5,
            critDmg: 50,
            anomalyMastery: 90,
            anomalyProficiency: 86,
            penRatio: 0,
            energy: 1.2,
          },
        },
      ];

      // 支援タイプを持つキャラクターのフィルタリング
      const charactersWithAssist = characters.filter(
        (char) => char.assistType !== undefined
      );
      expect(charactersWithAssist).toHaveLength(1);
      expect(charactersWithAssist[0].assistType).toBe("evasive");

      // 支援タイプを持たないキャラクターのフィルタリング
      const charactersWithoutAssist = characters.filter(
        (char) => char.assistType === undefined
      );
      expect(charactersWithoutAssist).toHaveLength(1);
      expect(charactersWithoutAssist[0].id).toBe("char2");
    });
  });

  describe("JSON シリアライゼーション互換性", () => {
    it("assistTypeフィールドありのキャラクターがJSONシリアライゼーションで正常に処理されることを確認", () => {
      const character: Character = {
        id: "json-test",
        name: { ja: "JSONテスト", en: "JSON Test" },
        fullName: {
          ja: "JSON・テスト・キャラクター",
          en: "JSON Test Character",
        },
        specialty: "support",
        stats: ["ice"],
        assistType: "defensive",
        faction: 1,
        rarity: "S",
        attr: {
          hp: [100, 200, 300, 400, 500, 600, 700],
          atk: [50, 60, 70, 80, 90, 100, 110],
          def: [30, 40, 50, 60, 70, 80, 90],
          impact: 88,
          critRate: 5,
          critDmg: 50,
          anomalyMastery: 93,
          anomalyProficiency: 90,
          penRatio: 0,
          energy: 1.2,
        },
      };

      const jsonString = JSON.stringify(character);
      const parsedCharacter = JSON.parse(jsonString) as Character;

      expect(parsedCharacter.assistType).toBe("defensive");
      expect(parsedCharacter.id).toBe("json-test");
    });

    it("assistTypeフィールドなしのキャラクターがJSONシリアライゼーションで正常に処理されることを確認", () => {
      const character: Character = {
        id: "json-test-no-assist",
        name: { ja: "JSON支援なし", en: "JSON No Assist" },
        fullName: {
          ja: "JSON・支援なし・キャラクター",
          en: "JSON No Assist Character",
        },
        specialty: "attack",
        stats: ["physical"],
        faction: 1,
        rarity: "A",
        attr: {
          hp: [100, 200, 300, 400, 500, 600, 700],
          atk: [50, 60, 70, 80, 90, 100, 110],
          def: [30, 40, 50, 60, 70, 80, 90],
          impact: 95,
          critRate: 5,
          critDmg: 50,
          anomalyMastery: 90,
          anomalyProficiency: 86,
          penRatio: 0,
          energy: 1.2,
        },
      };

      const jsonString = JSON.stringify(character);
      const parsedCharacter = JSON.parse(jsonString) as Character;

      expect(parsedCharacter.assistType).toBeUndefined();
      expect(parsedCharacter.id).toBe("json-test-no-assist");
    });
  });
});
