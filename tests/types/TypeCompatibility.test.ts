import { describe, it, expect } from "vitest";
import {
  Character,
  AssistType,
  Specialty,
  Stats,
  Rarity,
  Attributes,
  Lang,
  DriverDisc,
} from "../../src/types";
import driverDiscs from "../../data/driverDiscs";

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

describe("DriverDisc specialty配列形式の互換性", () => {
  it("DriverDisc型のspecialtyフィールドが配列型であることを確認", () => {
    const driverDisc: DriverDisc = {
      id: 1,
      name: { ja: "テストディスク", en: "Test Disc" },
      fourSetEffect: { ja: "4セット効果", en: "4-set effect" },
      twoSetEffect: { ja: "2セット効果", en: "2-set effect" },
      releaseVersion: 1.0,
      specialty: ["attack", "stun"],
    };

    expect(Array.isArray(driverDisc.specialty)).toBe(true);
    expect(driverDisc.specialty).toHaveLength(2);
    expect(driverDisc.specialty).toContain("attack");
    expect(driverDisc.specialty).toContain("stun");
  });

  it("単一の特性を持つドライバディスクが正常に動作することを確認", () => {
    const singleSpecialtyDisc: DriverDisc = {
      id: 2,
      name: { ja: "単一特性ディスク", en: "Single Specialty Disc" },
      fourSetEffect: { ja: "効果", en: "Effect" },
      twoSetEffect: { ja: "効果", en: "Effect" },
      releaseVersion: 1.0,
      specialty: ["support"],
    };

    expect(Array.isArray(singleSpecialtyDisc.specialty)).toBe(true);
    expect(singleSpecialtyDisc.specialty).toHaveLength(1);
    expect(singleSpecialtyDisc.specialty[0]).toBe("support");
  });

  it("複数の特性を持つドライバディスクが正常に動作することを確認", () => {
    const multiSpecialtyDisc: DriverDisc = {
      id: 3,
      name: { ja: "複数特性ディスク", en: "Multi Specialty Disc" },
      fourSetEffect: { ja: "効果", en: "Effect" },
      twoSetEffect: { ja: "効果", en: "Effect" },
      releaseVersion: 1.0,
      specialty: ["attack", "anomaly", "stun"],
    };

    expect(Array.isArray(multiSpecialtyDisc.specialty)).toBe(true);
    expect(multiSpecialtyDisc.specialty).toHaveLength(3);
    expect(multiSpecialtyDisc.specialty).toContain("attack");
    expect(multiSpecialtyDisc.specialty).toContain("anomaly");
    expect(multiSpecialtyDisc.specialty).toContain("stun");
  });

  it("全ての有効なSpecialty値が配列に含まれることを確認", () => {
    const allSpecialtiesDisc: DriverDisc = {
      id: 4,
      name: { ja: "全特性ディスク", en: "All Specialties Disc" },
      fourSetEffect: { ja: "効果", en: "Effect" },
      twoSetEffect: { ja: "効果", en: "Effect" },
      releaseVersion: 1.0,
      specialty: ["attack", "stun", "anomaly", "support", "defense", "rupture"],
    };

    const validSpecialties: Specialty[] = [
      "attack",
      "stun",
      "anomaly",
      "support",
      "defense",
      "rupture",
    ];

    expect(Array.isArray(allSpecialtiesDisc.specialty)).toBe(true);
    expect(allSpecialtiesDisc.specialty).toHaveLength(6);

    for (const specialty of validSpecialties) {
      expect(allSpecialtiesDisc.specialty).toContain(specialty);
    }
  });

  it("実際のドライバディスクデータが全て配列形式のspecialtyを持つことを確認", () => {
    expect(driverDiscs).toBeDefined();
    expect(Array.isArray(driverDiscs)).toBe(true);
    expect(driverDiscs.length).toBeGreaterThan(0);

    for (const disc of driverDiscs) {
      // specialtyフィールドが配列であることを確認
      expect(Array.isArray(disc.specialty)).toBe(true);

      // 配列が空でないことを確認
      expect(disc.specialty.length).toBeGreaterThan(0);

      // 各要素が有効なSpecialty値であることを確認
      const validSpecialties: Specialty[] = [
        "attack",
        "stun",
        "anomaly",
        "support",
        "defense",
        "rupture",
      ];

      for (const specialty of disc.specialty) {
        expect(validSpecialties).toContain(specialty);
      }
    }
  });

  it("ドライバディスクデータのTypeScriptコンパイル互換性を確認", () => {
    // TypeScriptコンパイラがエラーを報告しないことを確認
    const discs: DriverDisc[] = driverDiscs;

    expect(discs).toBeDefined();
    expect(discs.length).toBe(driverDiscs.length);

    // 各ドライバディスクがDriverDisc型に準拠していることを確認
    for (const disc of discs) {
      expect(disc).toHaveProperty("id");
      expect(disc).toHaveProperty("name");
      expect(disc).toHaveProperty("fourSetEffect");
      expect(disc).toHaveProperty("twoSetEffect");
      expect(disc).toHaveProperty("releaseVersion");
      expect(disc).toHaveProperty("specialty");

      expect(typeof disc.id).toBe("number");
      expect(typeof disc.name).toBe("object");
      expect(typeof disc.fourSetEffect).toBe("object");
      expect(typeof disc.twoSetEffect).toBe("object");
      expect(typeof disc.releaseVersion).toBe("number");
      expect(Array.isArray(disc.specialty)).toBe(true);
    }
  });

  it("specialty配列の操作が正常に動作することを確認", () => {
    const disc: DriverDisc = {
      id: 5,
      name: { ja: "操作テストディスク", en: "Operation Test Disc" },
      fourSetEffect: { ja: "効果", en: "Effect" },
      twoSetEffect: { ja: "効果", en: "Effect" },
      releaseVersion: 1.0,
      specialty: ["attack", "support", "anomaly"],
    };

    // filter操作
    const attackSpecialties = disc.specialty.filter((s) => s === "attack");
    expect(attackSpecialties).toHaveLength(1);
    expect(attackSpecialties[0]).toBe("attack");

    // map操作
    const specialtyNames = disc.specialty.map((s) => s.toUpperCase());
    expect(specialtyNames).toContain("ATTACK");
    expect(specialtyNames).toContain("SUPPORT");
    expect(specialtyNames).toContain("ANOMALY");

    // includes操作
    expect(disc.specialty.includes("attack")).toBe(true);
    expect(disc.specialty.includes("defense")).toBe(false);

    // forEach操作
    let count = 0;
    disc.specialty.forEach(() => count++);
    expect(count).toBe(3);
  });

  it("JSONシリアライゼーションでspecialty配列が正常に処理されることを確認", () => {
    const disc: DriverDisc = {
      id: 6,
      name: { ja: "JSONテストディスク", en: "JSON Test Disc" },
      fourSetEffect: { ja: "効果", en: "Effect" },
      twoSetEffect: { ja: "効果", en: "Effect" },
      releaseVersion: 1.0,
      specialty: ["stun", "support"],
    };

    const jsonString = JSON.stringify(disc);
    const parsedDisc = JSON.parse(jsonString) as DriverDisc;

    expect(Array.isArray(parsedDisc.specialty)).toBe(true);
    expect(parsedDisc.specialty).toHaveLength(2);
    expect(parsedDisc.specialty).toContain("stun");
    expect(parsedDisc.specialty).toContain("support");
  });
});
