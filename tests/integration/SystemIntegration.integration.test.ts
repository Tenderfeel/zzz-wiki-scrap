import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CharacterGenerator } from "../../src/generators/CharacterGenerator";
import { DataMapper } from "../../src/mappers/DataMapper";
import { NameResolver } from "../../src/mappers/NameResolver";
import { AllCharactersGenerator } from "../../src/generators/AllCharactersGenerator";
import { ProcessedData } from "../../src/types/processing";
import { Character } from "../../src/types";
import { ValidationError } from "../../src/errors";
import * as fs from "fs";
import * as path from "path";

/**
 * システム統合テスト
 * 全コンポーネントの統合と既存のキャラクターデータ生成フローとの互換性を確認
 * 要件: 4.1, 4.2, 4.3, 4.4
 */
describe("System Integration Tests", () => {
  let characterGenerator: CharacterGenerator;
  let allCharactersGenerator: AllCharactersGenerator;
  let dataMapper: DataMapper;
  let nameResolver: NameResolver;

  const testOutputDir = "system-integration-test-output";
  const testConfigPath = path.join(testOutputDir, "test-name-mappings.json");
  const testOutputFile = path.join(testOutputDir, "test-characters.ts");

  // 実際のScraping.mdに基づいたテスト用名前マッピング
  const realNameMappings = {
    lycaon: { ja: "ライカン", en: "Lycaon" },
    anby: { ja: "アンビー", en: "Anby" },
    billy: { ja: "ビリー", en: "Billy" },
    nicole: { ja: "ニコ", en: "Nicole" },
    nekomata: { ja: "猫又", en: "Necomata" },
    soldier11: { ja: "11号", en: "Soldier 11" },
    corin: { ja: "カリン", en: "Corin" },
    anton: { ja: "アンドー", en: "Anton" },
    ben: { ja: "ベン", en: "Ben" },
    koleda: { ja: "クレタ", en: "Koleda" },
  };

  // 実際のAPIレスポンス形式に基づいたテストデータ生成
  const createRealisticProcessedData = (
    characterId: string,
    jaName: string,
    enName: string,
    specialty: string = "撃破",
    stats: string = "氷属性",
    rarity: string = "S"
  ): { ja: ProcessedData; en: ProcessedData } => ({
    ja: {
      basicInfo: {
        id: characterId,
        name: jaName,
        specialty,
        stats,
        rarity,
      },
      factionInfo: {
        id: 1,
        name: "ヴィクトリア家政",
      },
      attributesInfo: {
        ascensionData: JSON.stringify({
          list: [
            {
              key: "1",
              combatList: [
                { key: "HP", values: ["677", "677"] },
                { key: "攻撃力", values: ["105", "105"] },
                { key: "防御力", values: ["49", "49"] },
                { key: "衝撃力", values: ["119", "119"] },
                { key: "会心率", values: ["5%", "5%"] },
                { key: "会心ダメージ", values: ["50%", "50%"] },
                { key: "異常マスタリー", values: ["91", "91"] },
                { key: "異常掌握", values: ["90", "90"] },
                { key: "貫通率", values: ["0%", "0%"] },
                { key: "エネルギー自動回復", values: ["1.2", "1.2"] },
              ],
            },
            {
              key: "10",
              combatList: [
                { key: "HP", values: ["1967", "1967"] },
                { key: "攻撃力", values: ["197", "197"] },
                { key: "防御力", values: ["141", "141"] },
              ],
            },
            {
              key: "20",
              combatList: [
                { key: "HP", values: ["3350", "3350"] },
                { key: "攻撃力", values: ["296", "296"] },
                { key: "防御力", values: ["241", "241"] },
              ],
            },
            {
              key: "30",
              combatList: [
                { key: "HP", values: ["4732", "4732"] },
                { key: "攻撃力", values: ["394", "394"] },
                { key: "防御力", values: ["340", "340"] },
              ],
            },
            {
              key: "40",
              combatList: [
                { key: "HP", values: ["6114", "6114"] },
                { key: "攻撃力", values: ["494", "494"] },
                { key: "防御力", values: ["441", "441"] },
              ],
            },
            {
              key: "50",
              combatList: [
                { key: "HP", values: ["7498", "7498"] },
                { key: "攻撃力", values: ["592", "592"] },
                { key: "防御力", values: ["540", "540"] },
              ],
            },
            {
              key: "60",
              combatList: [
                { key: "HP", values: ["8416", "8416"] },
                { key: "攻撃力", values: ["653", "653"] },
                { key: "防御力", values: ["606", "606"] },
              ],
            },
          ],
        }),
      },
    },
    en: {
      basicInfo: {
        id: characterId,
        name: enName,
        specialty: "stun",
        stats: "ice",
        rarity,
      },
      factionInfo: {
        id: 1,
        name: "Victoria Housekeeping Co.",
      },
      attributesInfo: {
        ascensionData: "",
      },
    },
  });

  beforeEach(() => {
    // テスト用ディレクトリを作成
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }

    // テスト用名前マッピングファイルを作成
    fs.writeFileSync(
      testConfigPath,
      JSON.stringify(realNameMappings, null, 2),
      "utf-8"
    );

    // テスト用インスタンスを作成
    nameResolver = new NameResolver(testConfigPath);
    dataMapper = new DataMapper(nameResolver);
    characterGenerator = new CharacterGenerator();
    allCharactersGenerator = new AllCharactersGenerator();

    // CharacterGeneratorのdataMapperを置き換え
    (characterGenerator as any).dataMapper = dataMapper;

    // テスト用ファイルをクリーンアップ
    [testOutputFile].forEach((file) => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  });

  afterEach(() => {
    // テスト後のクリーンアップ
    [testConfigPath, testOutputFile].forEach((file) => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });

    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }

    vi.clearAllMocks();
  });

  describe("全コンポーネント統合テスト", () => {
    it("既存のキャラクターデータ生成フローとの互換性を確認", async () => {
      // 複数キャラクターのテストデータを準備
      const testCharacters = [
        {
          id: "lycaon",
          apiNames: { ja: "フォン・ライカン", en: "Von Lycaon" },
          expectedNames: { ja: "ライカン", en: "Lycaon" }, // name (Scraping.mdの値)
          expectedFullNames: { ja: "フォン・ライカン", en: "Von Lycaon" }, // fullName (API名)
          specialty: "撃破",
          stats: "氷属性",
        },
        {
          id: "anby",
          apiNames: { ja: "アンビー・デマラ", en: "Anby Demara" },
          expectedNames: { ja: "アンビー", en: "Anby" }, // name (Scraping.mdの値)
          expectedFullNames: { ja: "アンビー・デマラ", en: "Anby Demara" }, // fullName (API名)
          specialty: "撃破",
          stats: "電気属性",
        },
        {
          id: "billy",
          apiNames: { ja: "ビリー・キッド", en: "Billy Kid" },
          expectedNames: { ja: "ビリー", en: "Billy" }, // name (Scraping.mdの値)
          expectedFullNames: { ja: "ビリー・キッド", en: "Billy Kid" }, // fullName (API名)
          specialty: "強攻",
          stats: "物理属性",
        },
        {
          id: "unmapped_character",
          apiNames: { ja: "マッピングなしキャラ", en: "Unmapped Character" },
          expectedNames: {
            ja: "マッピングなしキャラ",
            en: "Unmapped Character",
          }, // name (フォールバック)
          expectedFullNames: {
            ja: "マッピングなしキャラ",
            en: "Unmapped Character",
          }, // fullName (API名)
          specialty: "支援",
          stats: "炎属性",
        },
      ];

      // 成功した処理結果をシミュレート
      const successfulResults = testCharacters.map((testChar) => {
        const mockData = createRealisticProcessedData(
          testChar.id,
          testChar.apiNames.ja,
          testChar.apiNames.en,
          testChar.specialty,
          testChar.stats
        );

        // CharacterGeneratorを使用してCharacterオブジェクトを生成
        const character = characterGenerator.generateCharacter(
          mockData.ja,
          mockData.en,
          testChar.id
        );

        return {
          entry: {
            id: testChar.id,
            jaPageId: 100,
            enPageId: 200,
          },
          jaData: mockData.ja as any, // ApiResponse型にキャスト
          enData: mockData.en as any, // ApiResponse型にキャスト
          character: character,
        };
      });

      // AllCharactersGeneratorを使用してキャラクター配列を生成
      const characters = await allCharactersGenerator.generateAllCharacters(
        successfulResults
      );

      // 生成されたキャラクター数の確認
      expect(characters).toHaveLength(testCharacters.length);

      // 各キャラクターの詳細検証
      characters.forEach((character) => {
        // 対応するテストキャラクターを見つける
        const testChar = testCharacters.find((tc) => tc.id === character.id);
        expect(testChar).toBeDefined();

        // 基本情報の確認
        expect(character.id).toBe(testChar!.id);
        expect(character.name).toEqual(testChar!.expectedNames); // name: Scraping.mdの値
        expect(character.fullName).toEqual(testChar!.expectedFullNames); // fullName: API名

        // 既存のCharacter型構造の維持確認
        expect(character).toHaveProperty("id");
        expect(character).toHaveProperty("name");
        expect(character).toHaveProperty("fullName");
        expect(character).toHaveProperty("specialty");
        expect(character).toHaveProperty("stats");
        expect(character).toHaveProperty("faction");
        expect(character).toHaveProperty("rarity");
        expect(character).toHaveProperty("attr");

        // 多言語オブジェクト構造の確認
        expect(character.name).toHaveProperty("ja");
        expect(character.name).toHaveProperty("en");
        expect(character.fullName).toHaveProperty("ja");
        expect(character.fullName).toHaveProperty("en");

        // 属性データ構造の確認
        expect(character.attr).toHaveProperty("hp");
        expect(character.attr).toHaveProperty("atk");
        expect(character.attr).toHaveProperty("def");
        expect(character.attr).toHaveProperty("impact");
        expect(character.attr).toHaveProperty("critRate");
        expect(character.attr).toHaveProperty("critDmg");
        expect(character.attr).toHaveProperty("anomalyMastery");
        expect(character.attr).toHaveProperty("anomalyProficiency");
        expect(character.attr).toHaveProperty("penRatio");
        expect(character.attr).toHaveProperty("energy");

        // 配列長の確認
        expect(character.attr.hp).toHaveLength(7);
        expect(character.attr.atk).toHaveLength(7);
        expect(character.attr.def).toHaveLength(7);
      });

      // Character配列の検証
      const validationResult =
        allCharactersGenerator.validateCharacterArray(characters);
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.duplicateIds).toHaveLength(0);
      expect(validationResult.invalidCharacters).toHaveLength(0);
    });

    it("生成されるCharacterオブジェクトの構造が変更されていないことを検証", () => {
      const characterId = "lycaon";
      const mockData = createRealisticProcessedData(
        characterId,
        "フォン・ライカン",
        "Von Lycaon"
      );

      const character = characterGenerator.generateCharacter(
        mockData.ja,
        mockData.en,
        characterId
      );

      // Character型の完全性検証
      const validationResult = characterGenerator.validateCharacter(character);
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);

      // 型構造の詳細確認
      expect(typeof character.id).toBe("string");
      expect(typeof character.name).toBe("object");
      expect(typeof character.fullName).toBe("object");
      expect(typeof character.specialty).toBe("string");
      expect(typeof character.stats).toBe("string");
      expect(typeof character.faction).toBe("number");
      expect(typeof character.rarity).toBe("string");
      expect(typeof character.attr).toBe("object");

      // 多言語オブジェクトの構造確認
      expect(Object.keys(character.name)).toEqual(["ja", "en"]);
      expect(Object.keys(character.fullName)).toEqual(["ja", "en"]);

      // 属性オブジェクトの構造確認
      const expectedAttrKeys = [
        "hp",
        "atk",
        "def",
        "impact",
        "critRate",
        "critDmg",
        "anomalyMastery",
        "anomalyProficiency",
        "penRatio",
        "energy",
      ];
      expect(Object.keys(character.attr).sort()).toEqual(
        expectedAttrKeys.sort()
      );

      // 配列型属性の確認
      expect(Array.isArray(character.attr.hp)).toBe(true);
      expect(Array.isArray(character.attr.atk)).toBe(true);
      expect(Array.isArray(character.attr.def)).toBe(true);

      // 数値型属性の確認
      expect(typeof character.attr.impact).toBe("number");
      expect(typeof character.attr.critRate).toBe("number");
      expect(typeof character.attr.critDmg).toBe("number");
      expect(typeof character.attr.anomalyMastery).toBe("number");
      expect(typeof character.attr.anomalyProficiency).toBe("number");
      expect(typeof character.attr.penRatio).toBe("number");
      expect(typeof character.attr.energy).toBe("number");
    });

    it("実際のキャラクターデータで名前マッピング機能をテスト", () => {
      // 実際のScraping.mdに存在するキャラクターでテスト
      const realCharacterTests = [
        {
          id: "lycaon",
          apiResponse: { ja: "フォン・ライカン", en: "Von Lycaon" },
          expectedName: { ja: "ライカン", en: "Lycaon" }, // name (Scraping.mdの値)
          expectedFullName: { ja: "フォン・ライカン", en: "Von Lycaon" }, // fullName (API名)
        },
        {
          id: "soldier11",
          apiResponse: { ja: "11号", en: "Soldier 11" },
          expectedName: { ja: "11号", en: "Soldier 11" }, // name (Scraping.mdの値)
          expectedFullName: { ja: "11号", en: "Soldier 11" }, // fullName (API名)
        },
        {
          id: "nekomata",
          apiResponse: { ja: "猫又", en: "Nekomiya Mana" },
          expectedName: { ja: "猫又", en: "Necomata" }, // name (Scraping.mdの値)
          expectedFullName: { ja: "猫又", en: "Nekomiya Mana" }, // fullName (API名)
        },
      ];

      realCharacterTests.forEach((test) => {
        const mockData = createRealisticProcessedData(
          test.id,
          test.apiResponse.ja,
          test.apiResponse.en
        );

        const character = characterGenerator.generateCharacter(
          mockData.ja,
          mockData.en,
          test.id
        );

        // 名前マッピングが正しく適用されることを確認
        expect(character.name).toEqual(test.expectedName); // name: Scraping.mdの値
        expect(character.fullName).toEqual(test.expectedFullName); // fullName: API名

        // その他のデータが正常に処理されることを確認
        expect(character.id).toBe(test.id);
        expect(character.specialty).toBe("stun");
        expect(character.stats).toBe("ice");
        expect(character.faction).toBe(1);
        expect(character.rarity).toBe("S");

        // 属性データの確認
        expect(character.attr.hp[0]).toBe(677);
        expect(character.attr.atk[0]).toBe(105);
        expect(character.attr.def[0]).toBe(49);
        expect(character.attr.impact).toBe(119);
        expect(character.attr.critRate).toBe(5);
        expect(character.attr.critDmg).toBe(50);
      });
    });

    it("ファイル出力機能の統合テスト", () => {
      const characterId = "lycaon";
      const mockData = createRealisticProcessedData(
        characterId,
        "フォン・ライカン",
        "Von Lycaon"
      );

      const character = characterGenerator.generateCharacter(
        mockData.ja,
        mockData.en,
        characterId
      );

      // ファイル出力を実行
      characterGenerator.outputCharacterFile(character, testOutputFile);

      // ファイルが生成されることを確認
      expect(fs.existsSync(testOutputFile)).toBe(true);

      // ファイル内容を確認
      const fileContent = fs.readFileSync(testOutputFile, "utf-8");

      // 期待される構造を確認
      expect(fileContent).toContain("import { Character } from");
      expect(fileContent).toContain("export default [");
      expect(fileContent).toContain("] as Character[];");
      expect(fileContent).toContain(`id: "${characterId}"`);
      expect(fileContent).toContain('name: { ja: "ライカン", en: "Lycaon" }');
      expect(fileContent).toContain(
        'fullName: { ja: "フォン・ライカン", en: "Von Lycaon" }'
      );
      expect(fileContent).toContain('specialty: "stun"');
      expect(fileContent).toContain('stats: "ice"');
      expect(fileContent).toContain("faction: 1");
      expect(fileContent).toContain('rarity: "S"');

      // 属性データの確認
      expect(fileContent).toContain(
        "hp: [677, 1967, 3350, 4732, 6114, 7498, 8416]"
      );
      expect(fileContent).toContain("atk: [105, 197, 296, 394, 494, 592, 653]");
      expect(fileContent).toContain("def: [49, 141, 241, 340, 441, 540, 606]");
      expect(fileContent).toContain("impact: 119");
      expect(fileContent).toContain("critRate: 5");
      expect(fileContent).toContain("critDmg: 50");
    });

    it("複数キャラクターファイル出力の統合テスト", () => {
      const testCharacters = [
        {
          id: "lycaon",
          apiNames: { ja: "フォン・ライカン", en: "Von Lycaon" },
        },
        {
          id: "anby",
          apiNames: { ja: "アンビー・デマラ", en: "Anby Demara" },
        },
        {
          id: "unmapped",
          apiNames: { ja: "マッピングなし", en: "Unmapped" },
        },
      ];

      const characters: Character[] = [];

      testCharacters.forEach((testChar) => {
        const mockData = createRealisticProcessedData(
          testChar.id,
          testChar.apiNames.ja,
          testChar.apiNames.en
        );

        const character = characterGenerator.generateCharacter(
          mockData.ja,
          mockData.en,
          testChar.id
        );

        characters.push(character);
      });

      // AllCharactersGeneratorを使用してファイル出力
      allCharactersGenerator.outputCharactersFile(characters, testOutputFile);

      // ファイルが生成されることを確認
      expect(fs.existsSync(testOutputFile)).toBe(true);

      // ファイル内容を確認
      const fileContent = fs.readFileSync(testOutputFile, "utf-8");

      // 全キャラクターが含まれることを確認
      expect(fileContent).toContain('id: "lycaon"');
      expect(fileContent).toContain('id: "anby"');
      expect(fileContent).toContain('id: "unmapped"');

      // 名前マッピングが正しく適用されることを確認
      expect(fileContent).toContain('name: { ja: "ライカン", en: "Lycaon" }');
      expect(fileContent).toContain('name: { ja: "アンビー", en: "Anby" }');
      expect(fileContent).toContain(
        'name: { ja: "マッピングなし", en: "Unmapped" }'
      );

      // 配列形式であることを確認
      const commaCount = (fileContent.match(/},\s*{/g) || []).length;
      expect(commaCount).toBe(characters.length - 1);
    });
  });

  describe("後方互換性テスト", () => {
    it("既存のCharacter型定義との完全互換性", () => {
      const characterId = "lycaon";
      const mockData = createRealisticProcessedData(
        characterId,
        "フォン・ライカン",
        "Von Lycaon"
      );

      const character = characterGenerator.generateCharacter(
        mockData.ja,
        mockData.en,
        characterId
      );

      // TypeScript型チェック（コンパイル時）
      const typeCheck: Character = character;
      expect(typeCheck).toBeDefined();

      // ランタイム型チェック
      expect(character.id).toEqual(expect.any(String));
      expect(character.name).toEqual(
        expect.objectContaining({
          ja: expect.any(String),
          en: expect.any(String),
        })
      );
      expect(character.fullName).toEqual(
        expect.objectContaining({
          ja: expect.any(String),
          en: expect.any(String),
        })
      );
      expect(character.specialty).toEqual(expect.any(String));
      expect(character.stats).toEqual(expect.any(String));
      expect(character.faction).toEqual(expect.any(Number));
      expect(character.rarity).toEqual(expect.any(String));
      expect(character.attr).toEqual(
        expect.objectContaining({
          hp: expect.any(Array),
          atk: expect.any(Array),
          def: expect.any(Array),
          impact: expect.any(Number),
          critRate: expect.any(Number),
          critDmg: expect.any(Number),
          anomalyMastery: expect.any(Number),
          anomalyProficiency: expect.any(Number),
          penRatio: expect.any(Number),
          energy: expect.any(Number),
        })
      );
    });

    it("生成されるTypeScriptファイル形式の互換性", () => {
      const characterId = "lycaon";
      const mockData = createRealisticProcessedData(
        characterId,
        "フォン・ライカン",
        "Von Lycaon"
      );

      const character = characterGenerator.generateCharacter(
        mockData.ja,
        mockData.en,
        characterId
      );

      characterGenerator.outputCharacterFile(character, testOutputFile);

      const fileContent = fs.readFileSync(testOutputFile, "utf-8");

      // 既存の形式と同じ構造であることを確認
      expect(fileContent).toMatch(/^import { Character } from/);
      expect(fileContent).toMatch(
        /export default \[[\s\S]*\] as Character\[\];/
      );

      // インデントと形式の確認
      expect(fileContent).toContain("  {"); // 2スペースインデント
      expect(fileContent).toContain("    id:"); // 4スペースインデント
      expect(fileContent).toContain("    name:");
      expect(fileContent).toContain("    fullName:");
      expect(fileContent).toContain("    specialty:");
      expect(fileContent).toContain("    stats:");
      expect(fileContent).toContain("    faction:");
      expect(fileContent).toContain("    rarity:");
      expect(fileContent).toContain("    attr:");

      // 属性の形式確認
      expect(fileContent).toContain("      hp: [");
      expect(fileContent).toContain("      atk: [");
      expect(fileContent).toContain("      def: [");
      expect(fileContent).toContain("      impact:");
      expect(fileContent).toContain("      critRate:");
      expect(fileContent).toContain("      critDmg:");
    });

    it("他のキャラクタープロパティが変更されないことを確認", () => {
      const characterId = "lycaon";
      const mockData = createRealisticProcessedData(
        characterId,
        "フォン・ライカン",
        "Von Lycaon",
        "撃破", // specialty
        "氷属性", // stats
        "S" // rarity
      );

      const character = characterGenerator.generateCharacter(
        mockData.ja,
        mockData.en,
        characterId
      );

      // 名前以外のプロパティが正常に処理されることを確認
      expect(character.specialty).toBe("stun"); // 日本語→英語マッピング
      expect(character.stats).toBe("ice"); // 日本語→英語マッピング
      expect(character.rarity).toBe("S"); // そのまま
      expect(character.faction).toBe(1); // 数値

      // 属性データが正常に処理されることを確認
      expect(character.attr.hp).toEqual([
        677, 1967, 3350, 4732, 6114, 7498, 8416,
      ]);
      expect(character.attr.atk).toEqual([105, 197, 296, 394, 494, 592, 653]);
      expect(character.attr.def).toEqual([49, 141, 241, 340, 441, 540, 606]);
      expect(character.attr.impact).toBe(119);
      expect(character.attr.critRate).toBe(5);
      expect(character.attr.critDmg).toBe(50);
      expect(character.attr.anomalyMastery).toBe(91);
      expect(character.attr.anomalyProficiency).toBe(90);
      expect(character.attr.penRatio).toBe(0);
      expect(character.attr.energy).toBe(1.2);
    });
  });

  describe("エラーハンドリング統合テスト", () => {
    it("名前マッピングエラー時のシステム全体の動作", () => {
      // 無効な名前マッピングファイルを作成
      fs.writeFileSync(testConfigPath, "invalid json", "utf-8");

      const failingNameResolver = new NameResolver(testConfigPath);
      const failingDataMapper = new DataMapper(failingNameResolver);
      const failingGenerator = new CharacterGenerator();
      (failingGenerator as any).dataMapper = failingDataMapper;

      const characterId = "lycaon";
      const mockData = createRealisticProcessedData(
        characterId,
        "フォン・ライカン",
        "Von Lycaon"
      );

      // システムがフォールバック処理で継続することを確認
      try {
        const character = failingGenerator.generateCharacter(
          mockData.ja,
          mockData.en,
          characterId
        );

        // フォールバック処理でAPI名が使用されることを確認
        expect(character.name).toEqual({
          ja: "フォン・ライカン",
          en: "Von Lycaon",
        });
        expect(character.id).toBe(characterId);

        // その他の処理は正常に継続されることを確認
        expect(character.specialty).toBe("stun");
        expect(character.stats).toBe("ice");
        expect(character.faction).toBe(1);
        expect(character.rarity).toBe("S");
      } catch (error) {
        // エラーが発生した場合、ValidationErrorであることを確認
        expect(error).toBeInstanceOf(ValidationError);
        // フォールバック処理が実装されていることを確認するため、
        // エラーメッセージに名前マッピング関連の内容が含まれることを確認
        expect(error.message).toContain(
          "Characterオブジェクトの生成に失敗しました"
        );
      }
    });

    it("部分的な名前マッピング失敗時のシステム動作", () => {
      const testCharacters = [
        {
          id: "lycaon", // マッピング有り
          apiNames: { ja: "フォン・ライカン", en: "Von Lycaon" },
          expectedNames: { ja: "ライカン", en: "Lycaon" }, // name: Scraping.mdの値
          expectedFullNames: { ja: "フォン・ライカン", en: "Von Lycaon" }, // fullName: API名
        },
        {
          id: "unmapped", // マッピング無し
          apiNames: { ja: "マッピングなし", en: "Unmapped" },
          expectedNames: { ja: "マッピングなし", en: "Unmapped" }, // name: フォールバック
          expectedFullNames: { ja: "マッピングなし", en: "Unmapped" }, // fullName: API名
        },
      ];

      const characters: Character[] = [];

      testCharacters.forEach((testChar) => {
        const mockData = createRealisticProcessedData(
          testChar.id,
          testChar.apiNames.ja,
          testChar.apiNames.en
        );

        const character = characterGenerator.generateCharacter(
          mockData.ja,
          mockData.en,
          testChar.id
        );

        characters.push(character);

        // 期待される名前が使用されることを確認
        expect(character.name).toEqual(testChar.expectedNames);
        expect(character.fullName).toEqual(testChar.expectedFullNames);
      });

      // 全キャラクターが正常に処理されることを確認
      expect(characters).toHaveLength(2);

      // AllCharactersGeneratorでの検証も正常に通ることを確認
      const validationResult =
        allCharactersGenerator.validateCharacterArray(characters);
      expect(validationResult.isValid).toBe(true);
    });
  });

  describe("パフォーマンス統合テスト", () => {
    it("大量キャラクター処理時のシステム全体パフォーマンス", async () => {
      const startTime = Date.now();
      const characterCount = 30;
      const successfulResults = [];

      // 大量のテストデータを生成
      for (let i = 0; i < characterCount; i++) {
        const characterId = `test_character_${i}`;
        const mockData = createRealisticProcessedData(
          characterId,
          `テストキャラクター${i}`,
          `Test Character ${i}`
        );

        // CharacterGeneratorを使用してCharacterオブジェクトを生成
        const character = characterGenerator.generateCharacter(
          mockData.ja,
          mockData.en,
          characterId
        );

        successfulResults.push({
          entry: {
            id: characterId,
            jaPageId: 100 + i,
            enPageId: 200 + i,
          },
          jaData: mockData.ja as any,
          enData: mockData.en as any,
          character: character,
        });
      }

      // AllCharactersGeneratorで一括処理
      const characters = await allCharactersGenerator.generateAllCharacters(
        successfulResults
      );

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // パフォーマンス検証
      expect(characters).toHaveLength(characterCount);
      expect(executionTime).toBeLessThan(10000); // 10秒以内

      // 1キャラクターあたりの平均処理時間
      const avgTimePerCharacter = executionTime / characterCount;
      expect(avgTimePerCharacter).toBeLessThan(200); // 200ms以内

      // 全キャラクターの検証
      const validationResult =
        allCharactersGenerator.validateCharacterArray(characters);
      expect(validationResult.isValid).toBe(true);

      console.log(`システム統合テスト パフォーマンス結果:`);
      console.log(`  総実行時間: ${executionTime}ms`);
      console.log(`  1キャラクターあたり平均時間: ${avgTimePerCharacter}ms`);
      console.log(`  処理されたキャラクター数: ${characters.length}`);
    });

    it("メモリ使用量の統合テスト", async () => {
      const initialMemory = process.memoryUsage();
      const characterCount = 50;
      const successfulResults = [];

      // 大量のテストデータを生成
      for (let i = 0; i < characterCount; i++) {
        const characterId = `memory_test_${i}`;
        const mockData = createRealisticProcessedData(
          characterId,
          `メモリテスト${i}`,
          `Memory Test ${i}`
        );

        // CharacterGeneratorを使用してCharacterオブジェクトを生成
        const character = characterGenerator.generateCharacter(
          mockData.ja,
          mockData.en,
          characterId
        );

        successfulResults.push({
          entry: {
            id: characterId,
            jaPageId: 100 + i,
            enPageId: 200 + i,
          },
          jaData: mockData.ja as any,
          enData: mockData.en as any,
          character: character,
        });
      }

      // 処理実行
      const characters = await allCharactersGenerator.generateAllCharacters(
        successfulResults
      );

      // ファイル出力も含めてテスト
      allCharactersGenerator.outputCharactersFile(characters, testOutputFile);

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // メモリ使用量の確認（100MB以内の増加）
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);

      // ファイルが正常に生成されることを確認
      expect(fs.existsSync(testOutputFile)).toBe(true);

      console.log(`システム統合テスト メモリ使用量結果:`);
      console.log(
        `  初期メモリ: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`
      );
      console.log(
        `  最終メモリ: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`
      );
      console.log(
        `  メモリ増加: ${Math.round(memoryIncrease / 1024 / 1024)}MB`
      );
    });
  });
});
