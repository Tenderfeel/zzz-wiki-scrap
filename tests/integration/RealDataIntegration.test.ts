import { describe, it, expect } from "vitest";
import { CharacterGenerator } from "../../src/generators/CharacterGenerator";
import { DataMapper } from "../../src/mappers/DataMapper";
import { NameResolver } from "../../src/mappers/NameResolver";
import { ProcessedData } from "../../src/types/processing";
import * as fs from "fs";
import * as path from "path";

/**
 * 実際のデータを使用した統合テスト
 * 実際の名前マッピング設定ファイルと実際のキャラクターデータで動作確認
 */
describe("Real Data Integration Tests", () => {
  let characterGenerator: CharacterGenerator;
  let dataMapper: DataMapper;
  let nameResolver: NameResolver;

  // 実際の設定ファイルパス
  const realConfigPath = path.join(
    process.cwd(),
    "src",
    "config",
    "name-mappings.json"
  );

  // 実際のキャラクターデータを模擬したProcessedData
  const createRealCharacterData = (
    characterId: string,
    jaName: string,
    enName: string
  ): { ja: ProcessedData; en: ProcessedData } => ({
    ja: {
      basicInfo: {
        id: characterId,
        name: jaName,
        specialty: "撃破",
        stats: "氷属性",
        rarity: "S",
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
        rarity: "S",
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
    // 実際の設定ファイルを使用
    nameResolver = new NameResolver(realConfigPath);
    dataMapper = new DataMapper(nameResolver);
    characterGenerator = new CharacterGenerator();

    // CharacterGeneratorのdataMapperを置き換え
    (characterGenerator as any).dataMapper = dataMapper;
  });

  describe("実際の名前マッピング設定ファイルでのテスト", () => {
    it("実際の設定ファイルが存在し、読み込み可能であることを確認", () => {
      // 設定ファイルの存在確認
      expect(fs.existsSync(realConfigPath)).toBe(true);

      // 設定ファイルの内容確認
      const configContent = fs.readFileSync(realConfigPath, "utf-8");
      const nameMappings = JSON.parse(configContent);

      // 基本的な構造確認
      expect(typeof nameMappings).toBe("object");
      expect(Object.keys(nameMappings).length).toBeGreaterThan(0);

      // いくつかの期待されるキャラクターが含まれていることを確認
      const expectedCharacters = ["lycaon", "anby", "billy", "nicole"];
      expectedCharacters.forEach((characterId) => {
        expect(nameMappings).toHaveProperty(characterId);
        expect(nameMappings[characterId]).toHaveProperty("ja");
        expect(nameMappings[characterId]).toHaveProperty("en");
        expect(typeof nameMappings[characterId].ja).toBe("string");
        expect(typeof nameMappings[characterId].en).toBe("string");
      });
    });

    it("実際のキャラクターデータでライカンの名前マッピングを確認", () => {
      const characterId = "lycaon";
      const mockData = createRealCharacterData(
        characterId,
        "フォン・ライカン", // API名
        "Von Lycaon"
      );

      const character = characterGenerator.generateCharacter(
        mockData.ja,
        mockData.en,
        characterId
      );

      // 実際の設定ファイルに基づいた名前マッピングが適用されることを確認
      expect(character.name).toEqual({
        ja: "ライカン", // name: Scraping.mdの値（マッピング）
        en: "Lycaon",
      });
      expect(character.fullName).toEqual({
        ja: "フォン・ライカン", // fullName: API名
        en: "Von Lycaon",
      });
      expect(character.id).toBe(characterId);
    });

    it("実際のキャラクターデータでアンビーの名前マッピングを確認", () => {
      const characterId = "anby";
      const mockData = createRealCharacterData(
        characterId,
        "アンビー・デマラ", // API名
        "Anby Demara"
      );

      const character = characterGenerator.generateCharacter(
        mockData.ja,
        mockData.en,
        characterId
      );

      // 実際の設定ファイルに基づいた名前マッピングが適用されることを確認
      expect(character.name).toEqual({
        ja: "アンビー", // name: Scraping.mdの値（マッピング）
        en: "Anby",
      });
      expect(character.fullName).toEqual({
        ja: "アンビー・デマラ", // fullName: API名
        en: "Anby Demara",
      });
      expect(character.id).toBe(characterId);
    });

    it("実際のキャラクターデータで11号の名前マッピングを確認", () => {
      const characterId = "soldier11";
      const mockData = createRealCharacterData(
        characterId,
        "11号", // API名
        "Soldier 11"
      );

      const character = characterGenerator.generateCharacter(
        mockData.ja,
        mockData.en,
        characterId
      );

      // 実際の設定ファイルに基づいた名前マッピングが適用されることを確認
      expect(character.name).toEqual({
        ja: "11号", // name: Scraping.mdの値（マッピング）
        en: "Soldier 11",
      });
      expect(character.fullName).toEqual({
        ja: "11号", // fullName: API名（この場合同じ）
        en: "Soldier 11",
      });
      expect(character.id).toBe(characterId);
    });

    it("マッピングされていないキャラクターでフォールバック処理を確認", () => {
      const characterId = "unmapped_real_character";
      const mockData = createRealCharacterData(
        characterId,
        "マッピングされていないキャラクター",
        "Unmapped Real Character"
      );

      const character = characterGenerator.generateCharacter(
        mockData.ja,
        mockData.en,
        characterId
      );

      // フォールバック処理でAPI名が使用されることを確認
      expect(character.name).toEqual({
        ja: "マッピングされていないキャラクター",
        en: "Unmapped Real Character",
      });
      expect(character.fullName).toEqual({
        ja: "マッピングされていないキャラクター",
        en: "Unmapped Real Character",
      });
      expect(character.id).toBe(characterId);
    });

    it("実際の設定ファイルの全キャラクターマッピングを検証", () => {
      // 設定ファイルを読み込み
      const configContent = fs.readFileSync(realConfigPath, "utf-8");
      const nameMappings = JSON.parse(configContent);

      // 各キャラクターのマッピングを検証
      Object.entries(nameMappings).forEach(
        ([characterId, mapping]: [string, any]) => {
          const mockData = createRealCharacterData(
            characterId,
            `API名_${characterId}`,
            `API Name ${characterId}`
          );

          const character = characterGenerator.generateCharacter(
            mockData.ja,
            mockData.en,
            characterId
          );

          // マッピングされた名前が使用されることを確認
          expect(character.name).toEqual({
            ja: mapping.ja, // name: Scraping.mdの値（マッピング）
            en: mapping.en,
          });
          expect(character.fullName).toEqual({
            ja: `API名_${characterId}`, // fullName: API名
            en: `API Name ${characterId}`,
          });
          expect(character.id).toBe(characterId);

          // Character型の完全性も確認
          const validationResult =
            characterGenerator.validateCharacter(character);
          expect(validationResult.isValid).toBe(true);
        }
      );
    });

    it("名前マッピング統計情報の確認", () => {
      const stats = nameResolver.getMappingStats();

      // 統計情報の基本確認
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.characterIds).toBeInstanceOf(Array);
      expect(stats.characterIds.length).toBe(stats.total);

      // 期待されるキャラクターが含まれていることを確認
      const expectedCharacters = [
        "lycaon",
        "anby",
        "billy",
        "nicole",
        "soldier11",
      ];
      expectedCharacters.forEach((characterId) => {
        expect(stats.characterIds).toContain(characterId);
      });

      console.log(`実際の名前マッピング統計:`);
      console.log(`  総キャラクター数: ${stats.total}`);
      console.log(
        `  最初の10キャラクター: ${stats.characterIds.slice(0, 10).join(", ")}`
      );
    });

    it("名前マッピングファイルの可用性チェック", () => {
      const availability = nameResolver.checkMappingFileAvailability();

      expect(availability.available).toBe(true);
      expect(availability.fallbackMode).toBe(false);
      expect(availability.error).toBeUndefined();
    });

    it("大文字小文字の正規化が実際の設定で動作することを確認", () => {
      const testCases = [
        { input: "LYCAON", expected: "lycaon" },
        { input: "Lycaon", expected: "lycaon" },
        { input: "lycaon", expected: "lycaon" },
        { input: "  LYCAON  ", expected: "lycaon" },
      ];

      testCases.forEach((testCase) => {
        const mockData = createRealCharacterData(
          testCase.input,
          "フォン・ライカン",
          "Von Lycaon"
        );

        const character = characterGenerator.generateCharacter(
          mockData.ja,
          mockData.en,
          testCase.input
        );

        // 正規化されたIDに対応するマッピングが使用されることを確認
        expect(character.name).toEqual({
          ja: "ライカン",
          en: "Lycaon",
        });
        expect(character.id).toBe(testCase.input); // 元のIDが保持される
      });
    });
  });

  describe("システム統合での実際のデータフロー確認", () => {
    it("複数の実際のキャラクターでの統合処理", () => {
      // 実際の設定ファイルから一部のキャラクターを取得
      const configContent = fs.readFileSync(realConfigPath, "utf-8");
      const nameMappings = JSON.parse(configContent);

      // 最初の5キャラクターでテスト
      const testCharacterIds = Object.keys(nameMappings).slice(0, 5);
      const characters = [];

      testCharacterIds.forEach((characterId) => {
        const mapping = nameMappings[characterId];
        const mockData = createRealCharacterData(
          characterId,
          `API名_${characterId}`,
          `API Name ${characterId}`
        );

        const character = characterGenerator.generateCharacter(
          mockData.ja,
          mockData.en,
          characterId
        );

        characters.push(character);

        // 各キャラクターの検証
        expect(character.name).toEqual({
          ja: mapping.ja, // name: Scraping.mdの値（マッピング）
          en: mapping.en,
        });
        expect(character.fullName).toEqual({
          ja: `API名_${characterId}`, // fullName: API名
          en: `API Name ${characterId}`,
        });
        expect(character.id).toBe(characterId);

        const validationResult =
          characterGenerator.validateCharacter(character);
        expect(validationResult.isValid).toBe(true);
      });

      // 全キャラクターが正常に処理されることを確認
      expect(characters).toHaveLength(testCharacterIds.length);

      // ID重複がないことを確認
      const ids = characters.map((c) => c.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids.length).toBe(uniqueIds.length);

      console.log(`実際のデータでの統合処理結果:`);
      console.log(`  処理されたキャラクター数: ${characters.length}`);
      console.log(`  キャラクターID: ${ids.join(", ")}`);
    });

    it("実際の設定ファイルでのパフォーマンス確認", () => {
      const startTime = Date.now();

      // 設定ファイルから全キャラクターを取得
      const configContent = fs.readFileSync(realConfigPath, "utf-8");
      const nameMappings = JSON.parse(configContent);
      const allCharacterIds = Object.keys(nameMappings);

      const characters = [];

      allCharacterIds.forEach((characterId) => {
        const mockData = createRealCharacterData(
          characterId,
          `API名_${characterId}`,
          `API Name ${characterId}`
        );

        const character = characterGenerator.generateCharacter(
          mockData.ja,
          mockData.en,
          characterId
        );

        characters.push(character);
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // パフォーマンス検証
      expect(characters).toHaveLength(allCharacterIds.length);
      expect(executionTime).toBeLessThan(5000); // 5秒以内

      // 1キャラクターあたりの平均処理時間
      const avgTimePerCharacter = executionTime / allCharacterIds.length;
      expect(avgTimePerCharacter).toBeLessThan(100); // 100ms以内

      console.log(`実際のデータでのパフォーマンス結果:`);
      console.log(`  総実行時間: ${executionTime}ms`);
      console.log(`  1キャラクターあたり平均時間: ${avgTimePerCharacter}ms`);
      console.log(`  処理されたキャラクター数: ${characters.length}`);
    });
  });
});
