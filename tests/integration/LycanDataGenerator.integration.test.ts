import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { LycanDataGenerator } from "../../src/main";
import * as fs from "fs";

/**
 * 統合テスト: LycanDataGenerator
 * 実際のjson/mock/lycaon.jsonファイルを使用したエンドツーエンドのデータ処理テスト
 * 要件: 全要件の統合検証
 */
describe("LycanDataGenerator Integration Tests", () => {
  let generator: LycanDataGenerator;
  const testOutputFile = "data/test-characters.ts";
  const lycaonJsonPath = "json/mock/lycaon.json";

  beforeEach(() => {
    generator = new LycanDataGenerator();

    // テスト用出力ファイルが存在する場合は削除
    if (fs.existsSync(testOutputFile)) {
      fs.unlinkSync(testOutputFile);
    }
  });

  afterEach(() => {
    // テスト後のクリーンアップ
    if (fs.existsSync(testOutputFile)) {
      fs.unlinkSync(testOutputFile);
    }
  });

  describe("エンドツーエンドデータ処理", () => {
    it("json/mock/lycaon.jsonから完全なCharacterオブジェクトを生成できる", async () => {
      // json/mock/lycaon.jsonファイルの存在確認
      expect(fs.existsSync(lycaonJsonPath)).toBe(true);

      // メイン処理を実行
      await expect(
        generator.execute(lycaonJsonPath, testOutputFile)
      ).resolves.not.toThrow();

      // 出力ファイルが生成されることを確認
      expect(fs.existsSync(testOutputFile)).toBe(true);

      // 出力ファイルの内容を検証
      const outputContent = fs.readFileSync(testOutputFile, "utf-8");

      // TypeScript形式の出力であることを確認
      expect(outputContent).toContain("export default [");
      expect(outputContent).toContain("] as Character[];");

      // 必須フィールドの存在確認
      expect(outputContent).toContain("id:");
      expect(outputContent).toContain("name:");
      expect(outputContent).toContain("fullName:");
      expect(outputContent).toContain("specialty:");
      expect(outputContent).toContain("stats:");
      expect(outputContent).toContain("attackType:");
      expect(outputContent).toContain("faction:");
      expect(outputContent).toContain("rarity:");
      expect(outputContent).toContain("attr:");
    });

    it("生成されたCharacterオブジェクトが正しい構造を持つ", async () => {
      await generator.execute(lycaonJsonPath, testOutputFile);

      const outputContent = fs.readFileSync(testOutputFile, "utf-8");

      // JSONとして解析可能な形式であることを確認
      const characterArrayMatch = outputContent.match(
        /export default (\[[\s\S]*\]) as Character\[\];/
      );
      expect(characterArrayMatch).toBeTruthy();

      if (characterArrayMatch) {
        // TypeScriptオブジェクトをJavaScriptとして評価
        const characterArray = eval(characterArrayMatch[1]);
        expect(Array.isArray(characterArray)).toBe(true);
        expect(characterArray.length).toBe(1);

        const character = characterArray[0];

        // 基本フィールドの検証
        expect(character).toHaveProperty("id");
        expect(character).toHaveProperty("name");
        expect(character).toHaveProperty("fullName");
        expect(character).toHaveProperty("specialty");
        expect(character).toHaveProperty("stats");
        expect(character).toHaveProperty("attackType");
        expect(character).toHaveProperty("faction");
        expect(character).toHaveProperty("rarity");
        expect(character).toHaveProperty("attr");

        // 多言語オブジェクトの検証
        expect(character.name).toHaveProperty("ja");
        expect(character.name).toHaveProperty("en");
        expect(character.fullName).toHaveProperty("ja");
        expect(character.fullName).toHaveProperty("en");

        // 属性オブジェクトの検証
        const attr = character.attr;
        expect(attr).toHaveProperty("hp");
        expect(attr).toHaveProperty("atk");
        expect(attr).toHaveProperty("def");
        expect(attr).toHaveProperty("impact");
        expect(attr).toHaveProperty("critRate");
        expect(attr).toHaveProperty("critDmg");
        expect(attr).toHaveProperty("anomalyMastery");
        expect(attr).toHaveProperty("anomalyProficiency");
        expect(attr).toHaveProperty("penRatio");
        expect(attr).toHaveProperty("energy");

        // 配列の長さ検証
        expect(Array.isArray(attr.hp)).toBe(true);
        expect(attr.hp.length).toBe(7);
        expect(Array.isArray(attr.atk)).toBe(true);
        expect(attr.atk.length).toBe(7);
        expect(Array.isArray(attr.def)).toBe(true);
        expect(attr.def.length).toBe(7);
      }
    });

    it("ライカンの具体的なデータ値が正しく抽出される", async () => {
      await generator.execute(lycaonJsonPath, testOutputFile);

      const outputContent = fs.readFileSync(testOutputFile, "utf-8");
      const characterArrayMatch = outputContent.match(
        /export default (\[[\s\S]*\]) as Character\[\];/
      );

      if (characterArrayMatch) {
        const characterArray = eval(characterArrayMatch[1]);
        const lycaon = characterArray[0];

        // ライカンの基本情報検証
        expect(lycaon.id).toBe("lycaon");
        expect(lycaon.name.ja).toBe("フォン・ライカン");
        expect(lycaon.specialty).toBe("stun");
        expect(lycaon.stats).toBe("ice");
        expect(lycaon.attackType).toBe("strike");
        expect(lycaon.rarity).toBe("S");
        expect(lycaon.faction).toBe(2); // ヴィクトリア家政のID

        // ステータス値の検証（実際のjson/mock/lycaon.jsonから期待される値）
        expect(lycaon.attr.hp).toEqual([
          677, 1967, 3350, 4732, 6114, 7498, 8416,
        ]);
        expect(lycaon.attr.atk).toEqual([105, 197, 296, 394, 494, 592, 653]);
        expect(lycaon.attr.def).toEqual([49, 141, 241, 340, 441, 540, 606]);
        expect(lycaon.attr.impact).toBe(119);
        expect(lycaon.attr.critRate).toBe(5);
        expect(lycaon.attr.critDmg).toBe(50);
        expect(lycaon.attr.anomalyMastery).toBe(91);
        expect(lycaon.attr.anomalyProficiency).toBe(90);
        expect(lycaon.attr.penRatio).toBe(0);
        expect(lycaon.attr.energy).toBe(1.2);
      }
    });
  });

  describe("エラーハンドリング統合テスト", () => {
    it("存在しないファイルに対して適切なエラーを発生させる", async () => {
      const nonExistentFile = "non-existent-file.json";

      await expect(
        generator.execute(nonExistentFile, testOutputFile)
      ).rejects.toThrow();
    });

    it("無効な入力パラメータに対して適切なエラーを発生させる", async () => {
      await expect(generator.execute("", testOutputFile)).rejects.toThrow(
        "入力ファイルパスが無効です"
      );

      await expect(generator.execute(lycaonJsonPath, "")).rejects.toThrow(
        "出力ファイルパスが無効です"
      );
    });

    it("不正なJSONファイルに対して適切なエラーを発生させる", async () => {
      const invalidJsonFile = "test-invalid.json";

      // 不正なJSONファイルを作成
      fs.writeFileSync(invalidJsonFile, "{ invalid json }");

      try {
        await expect(
          generator.execute(invalidJsonFile, testOutputFile)
        ).rejects.toThrow();
      } finally {
        // クリーンアップ
        if (fs.existsSync(invalidJsonFile)) {
          fs.unlinkSync(invalidJsonFile);
        }
      }
    });
  });

  describe("データ整合性検証", () => {
    it("生成されたデータが全要件を満たす", async () => {
      await generator.execute(lycaonJsonPath, testOutputFile);

      const outputContent = fs.readFileSync(testOutputFile, "utf-8");
      const characterArrayMatch = outputContent.match(
        /export default (\[[\s\S]*\]) as Character\[\];/
      );

      if (characterArrayMatch) {
        const characterArray = eval(characterArrayMatch[1]);
        const character = characterArray[0];

        // 要件1: API データの正常取得と解析
        expect(character.id).toBeTruthy();
        expect(character.name.ja).toBeTruthy();
        expect(character.name.en).toBeTruthy();

        // 要件2: 基本キャラクター情報の抽出
        expect([
          "attack",
          "stun",
          "anomaly",
          "support",
          "defense",
          "rupture",
        ]).toContain(character.specialty);
        expect([
          "ether",
          "fire",
          "ice",
          "physical",
          "electric",
          "frostAttribute",
          "auricInk",
        ]).toContain(character.stats);
        expect(["slash", "pierce", "strike"]).toContain(character.attackType);
        expect(["A", "S"]).toContain(character.rarity);

        // 要件3: 陣営情報の抽出
        expect(typeof character.faction).toBe("number");
        expect(character.faction).toBeGreaterThan(0);

        // 要件4: 属性データの抽出
        const attr = character.attr;
        expect(attr.hp.length).toBe(7);
        expect(attr.atk.length).toBe(7);
        expect(attr.def.length).toBe(7);
        expect(typeof attr.impact).toBe("number");
        expect(typeof attr.critRate).toBe("number");
        expect(typeof attr.critDmg).toBe("number");
        expect(typeof attr.anomalyMastery).toBe("number");
        expect(typeof attr.anomalyProficiency).toBe("number");
        expect(typeof attr.penRatio).toBe("number");
        expect(typeof attr.energy).toBe("number");

        // 要件5: TypeScript型準拠のCharacterオブジェクト生成
        expect(character.id).toBe("lycaon");
        expect(character.name).toHaveProperty("ja");
        expect(character.name).toHaveProperty("en");
        expect(character.fullName).toHaveProperty("ja");
        expect(character.fullName).toHaveProperty("en");

        // 要件6: データ検証
        // 必須フィールドの存在確認
        expect(character.id).not.toBeNull();
        expect(character.name.ja).not.toBe("");
        expect(character.name.en).not.toBe("");
        expect(character.fullName.ja).not.toBe("");
        expect(character.fullName.en).not.toBe("");

        // 数値配列の検証
        attr.hp.forEach((value) => expect(typeof value).toBe("number"));
        attr.atk.forEach((value) => expect(typeof value).toBe("number"));
        attr.def.forEach((value) => expect(typeof value).toBe("number"));
      }
    });
  });

  describe("パフォーマンステスト", () => {
    it("処理が合理的な時間内に完了する", async () => {
      const startTime = Date.now();

      await generator.execute(lycaonJsonPath, testOutputFile);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // 処理時間が5秒以内であることを確認
      expect(processingTime).toBeLessThan(5000);
    });
  });

  describe("ファイル操作統合テスト", () => {
    it("異なる出力パスでファイルを生成できる", async () => {
      const customOutputPath = "test-output-characters.ts";

      try {
        await generator.execute(lycaonJsonPath, customOutputPath);

        expect(fs.existsSync(customOutputPath)).toBe(true);

        const content = fs.readFileSync(customOutputPath, "utf-8");
        expect(content).toContain("export default [");
        expect(content).toContain("] as Character[];");
      } finally {
        // クリーンアップ
        if (fs.existsSync(customOutputPath)) {
          fs.unlinkSync(customOutputPath);
        }
      }
    });

    it("既存ファイルを上書きできる", async () => {
      // 既存ファイルを作成
      fs.writeFileSync(testOutputFile, "existing content");
      expect(fs.existsSync(testOutputFile)).toBe(true);

      // 処理を実行
      await generator.execute(lycaonJsonPath, testOutputFile);

      // ファイルが上書きされていることを確認
      const content = fs.readFileSync(testOutputFile, "utf-8");
      expect(content).not.toBe("existing content");
      expect(content).toContain("export default [");
    });
  });
});
