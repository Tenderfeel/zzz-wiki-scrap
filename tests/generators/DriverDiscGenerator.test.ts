import { describe, test, expect, beforeEach } from "vitest";
import { DriverDiscGenerator } from "../../src/generators/DriverDiscGenerator";
import { ProcessedDriverDiscData, DriverDisc } from "../../src/types";
import * as fs from "fs";

describe("DriverDiscGeneratorクラス", () => {
  let generator: DriverDiscGenerator;

  beforeEach(() => {
    generator = new DriverDiscGenerator();
  });

  describe("generateDriverDisc メソッド", () => {
    test("日本語データのみでDriverDiscオブジェクトを正常に生成できること", () => {
      // Arrange
      const jaData: ProcessedDriverDiscData = {
        basicInfo: {
          id: 123,
          name: "テストドライバーディスク",
          releaseVersion: 1.0,
        },
        setEffectInfo: {
          fourSetEffect: "4セット効果のテスト",
          twoSetEffect: "2セット効果のテスト",
        },
        specialty: "attack",
      };

      // Act
      const result = generator.generateDriverDisc(jaData, null, "test-disc");

      // Assert
      expect(result).toEqual({
        id: 123,
        name: {
          ja: "テストドライバーディスク",
          en: "テストドライバーディスク", // フォールバック
        },
        fourSetEffect: {
          ja: "4セット効果のテスト",
          en: "4セット効果のテスト", // フォールバック
        },
        twoSetEffect: {
          ja: "2セット効果のテスト",
          en: "2セット効果のテスト", // フォールバック
        },
        releaseVersion: 1.0,
        specialty: "attack",
      });
    });

    test("日本語と英語データでDriverDiscオブジェクトを正常に生成できること", () => {
      // Arrange
      const jaData: ProcessedDriverDiscData = {
        basicInfo: {
          id: 456,
          name: "テストドライバーディスク",
          releaseVersion: 1.1,
        },
        setEffectInfo: {
          fourSetEffect: "4セット効果のテスト",
          twoSetEffect: "2セット効果のテスト",
        },
        specialty: "stun",
      };

      const enData: ProcessedDriverDiscData = {
        basicInfo: {
          id: 456,
          name: "Test Driver Disc",
          releaseVersion: 1.1,
        },
        setEffectInfo: {
          fourSetEffect: "Test 4-set effect",
          twoSetEffect: "Test 2-set effect",
        },
        specialty: "stun",
      };

      // Act
      const result = generator.generateDriverDisc(jaData, enData, "test-disc");

      // Assert
      expect(result).toEqual({
        id: 456,
        name: {
          ja: "テストドライバーディスク",
          en: "Test Driver Disc",
        },
        fourSetEffect: {
          ja: "4セット効果のテスト",
          en: "Test 4-set effect",
        },
        twoSetEffect: {
          ja: "2セット効果のテスト",
          en: "Test 2-set effect",
        },
        releaseVersion: 1.1,
        specialty: "stun",
      });
    });

    test("releaseVersionが未定義の場合デフォルト値1.0が設定されること", () => {
      // Arrange
      const jaData: ProcessedDriverDiscData = {
        basicInfo: {
          id: 789,
          name: "テストドライバーディスク",
          // releaseVersionは未定義
        },
        setEffectInfo: {
          fourSetEffect: "4セット効果のテスト",
          twoSetEffect: "2セット効果のテスト",
        },
        specialty: "anomaly",
      };

      // Act
      const result = generator.generateDriverDisc(jaData, null, "test-disc");

      // Assert
      expect(result.releaseVersion).toBe(1.0);
    });

    test("日本語データが存在しない場合エラーが発生すること", () => {
      // Act & Assert
      expect(() => {
        generator.generateDriverDisc(null as any, null, "test-disc");
      }).toThrow("日本語データが存在しません");
    });

    test("discIdが空の場合エラーが発生すること", () => {
      // Arrange
      const jaData: ProcessedDriverDiscData = {
        basicInfo: {
          id: 123,
          name: "テストドライバーディスク",
        },
        setEffectInfo: {
          fourSetEffect: "4セット効果のテスト",
          twoSetEffect: "2セット効果のテスト",
        },
        specialty: "attack",
      };

      // Act & Assert
      expect(() => {
        generator.generateDriverDisc(jaData, null, "");
      }).toThrow("ドライバーディスクIDが指定されていません");
    });
  });

  describe("validateDriverDisc メソッド", () => {
    test("有効なDriverDiscオブジェクトの検証が成功すること", () => {
      // Arrange
      const validDriverDisc: DriverDisc = {
        id: 123,
        name: {
          ja: "テストドライバーディスク",
          en: "Test Driver Disc",
        },
        fourSetEffect: {
          ja: "4セット効果のテスト",
          en: "Test 4-set effect",
        },
        twoSetEffect: {
          ja: "2セット効果のテスト",
          en: "Test 2-set effect",
        },
        releaseVersion: 1.0,
        specialty: "attack",
      };

      // Act
      const result = generator.validateDriverDisc(validDriverDisc);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("無効なIDの場合検証が失敗すること", () => {
      // Arrange
      const invalidDriverDisc: DriverDisc = {
        id: NaN,
        name: {
          ja: "テストドライバーディスク",
          en: "Test Driver Disc",
        },
        fourSetEffect: {
          ja: "4セット効果のテスト",
          en: "Test 4-set effect",
        },
        twoSetEffect: {
          ja: "2セット効果のテスト",
          en: "Test 2-set effect",
        },
        releaseVersion: 1.0,
        specialty: "attack",
      };

      // Act
      const result = generator.validateDriverDisc(invalidDriverDisc);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "id フィールドが有効な数値ではありません"
      );
    });

    test("空の多言語名の場合検証が失敗すること", () => {
      // Arrange
      const invalidDriverDisc: DriverDisc = {
        id: 123,
        name: {
          ja: "",
          en: "Test Driver Disc",
        },
        fourSetEffect: {
          ja: "4セット効果のテスト",
          en: "Test 4-set effect",
        },
        twoSetEffect: {
          ja: "2セット効果のテスト",
          en: "Test 2-set effect",
        },
        releaseVersion: 1.0,
        specialty: "attack",
      };

      // Act
      const result = generator.validateDriverDisc(invalidDriverDisc);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("name.ja が空または存在しません");
    });

    test("無効な特性の場合検証が失敗すること", () => {
      // Arrange
      const invalidDriverDisc: DriverDisc = {
        id: 123,
        name: {
          ja: "テストドライバーディスク",
          en: "Test Driver Disc",
        },
        fourSetEffect: {
          ja: "4セット効果のテスト",
          en: "Test 4-set effect",
        },
        twoSetEffect: {
          ja: "2セット効果のテスト",
          en: "Test 2-set effect",
        },
        releaseVersion: 1.0,
        specialty: "invalid" as any,
      };

      // Act
      const result = generator.validateDriverDisc(invalidDriverDisc);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'specialty "invalid" は有効な値ではありません'
      );
    });
  });

  describe("generateDriverDiscsFile メソッド", () => {
    const testOutputPath = "test-output/driverDiscs.ts";

    // テスト後のクリーンアップ
    const cleanup = () => {
      try {
        if (fs.existsSync(testOutputPath)) {
          fs.unlinkSync(testOutputPath);
        }
        if (fs.existsSync("test-output")) {
          fs.rmdirSync("test-output");
        }
      } catch (error) {
        // クリーンアップエラーは無視
      }
    };

    test("DriverDiscファイルを正常に生成できること", async () => {
      // Arrange
      const driverDiscs: DriverDisc[] = [
        {
          id: 123,
          name: {
            ja: "テストドライバーディスク1",
            en: "Test Driver Disc 1",
          },
          fourSetEffect: {
            ja: "4セット効果のテスト1",
            en: "Test 4-set effect 1",
          },
          twoSetEffect: {
            ja: "2セット効果のテスト1",
            en: "Test 2-set effect 1",
          },
          releaseVersion: 1.0,
          specialty: "attack",
        },
        {
          id: 456,
          name: {
            ja: "テストドライバーディスク2",
            en: "Test Driver Disc 2",
          },
          fourSetEffect: {
            ja: "4セット効果のテスト2",
            en: "Test 4-set effect 2",
          },
          twoSetEffect: {
            ja: "2セット効果のテスト2",
            en: "Test 2-set effect 2",
          },
          releaseVersion: 1.1,
          specialty: "stun",
        },
      ];

      try {
        // Act
        await generator.generateDriverDiscsFile(driverDiscs, testOutputPath);

        // Assert
        expect(fs.existsSync(testOutputPath)).toBe(true);

        const fileContent = fs.readFileSync(testOutputPath, "utf-8");
        expect(fileContent).toContain(
          'import { DriverDisc } from "./src/types";'
        );
        expect(fileContent).toContain("export default [");
        expect(fileContent).toContain("] as DriverDisc[];");
        expect(fileContent).toContain("テストドライバーディスク1");
        expect(fileContent).toContain("Test Driver Disc 1");
        expect(fileContent).toContain('specialty: "attack"');
        expect(fileContent).toContain('specialty: "stun"');
      } finally {
        cleanup();
      }
    });

    test("空の配列でファイルを生成できること", async () => {
      // Arrange
      const driverDiscs: DriverDisc[] = [];

      try {
        // Act
        await generator.generateDriverDiscsFile(driverDiscs, testOutputPath);

        // Assert
        expect(fs.existsSync(testOutputPath)).toBe(true);

        const fileContent = fs.readFileSync(testOutputPath, "utf-8");
        expect(fileContent).toContain(
          'import { DriverDisc } from "./src/types";'
        );
        expect(fileContent).toContain("export default [\n\n] as DriverDisc[];");
      } finally {
        cleanup();
      }
    });

    test("無効なDriverDiscオブジェクトがある場合エラーが発生すること", async () => {
      // Arrange
      const invalidDriverDiscs: DriverDisc[] = [
        {
          id: NaN, // 無効なID
          name: {
            ja: "テストドライバーディスク",
            en: "Test Driver Disc",
          },
          fourSetEffect: {
            ja: "4セット効果のテスト",
            en: "Test 4-set effect",
          },
          twoSetEffect: {
            ja: "2セット効果のテスト",
            en: "Test 2-set effect",
          },
          releaseVersion: 1.0,
          specialty: "attack",
        },
      ];

      // Act & Assert
      await expect(
        generator.generateDriverDiscsFile(invalidDriverDiscs, testOutputPath)
      ).rejects.toThrow("DriverDiscオブジェクトの検証に失敗しました");

      cleanup();
    });
  });
});
