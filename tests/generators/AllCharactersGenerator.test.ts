import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AllCharactersGenerator,
  ArrayValidationResult,
} from "../../src/generators/AllCharactersGenerator";
import { Character, CharacterEntry } from "../../src/types";
import { CharacterResult } from "../../src/processors/BatchProcessor";
import { ApiResponse } from "../../src/types/api";
import { ValidationError, ParsingError } from "../../src/errors";
import * as fs from "fs";
import * as path from "path";

// fsモジュールをモック
vi.mock("fs");
const mockFs = vi.mocked(fs);

// pathモジュールをモック
vi.mock("path");
const mockPath = vi.mocked(path);

describe("AllCharactersGenerator", () => {
  let generator: AllCharactersGenerator;

  // モックデータ
  const mockCharacterEntry: CharacterEntry = {
    id: "test-character",
    pageId: 123,
    wikiUrl: "https://example.com/test",
  };

  const mockApiResponse: ApiResponse = {
    retcode: 0,
    message: "success",
    data: {
      page: {
        id: "123",
        name: "テストキャラクター",
        agent_specialties: { values: ["撃破"] },
        agent_stats: { values: ["氷属性"] },
        agent_rarity: { values: ["S"] },
        agent_faction: { values: ["邪兎屋"] },
        modules: [],
      },
    },
  };

  const mockCharacter: Character = {
    id: "test-character",
    name: { ja: "テストキャラクター", en: "Test Character" },
    fullName: { ja: "テストキャラクター", en: "Test Character" },
    specialty: "stun",
    stats: "ice",
    faction: 1,
    rarity: "S",
    attr: {
      hp: [677, 1967, 3350, 4732, 6114, 7498, 8416],
      atk: [105, 197, 296, 394, 494, 592, 653],
      def: [49, 141, 241, 340, 441, 540, 606],
      impact: 119,
      critRate: 5,
      critDmg: 50,
      anomalyMastery: 91,
      anomalyProficiency: 90,
      penRatio: 0,
      energy: 1.2,
    },
  };

  const mockCharacterResult: CharacterResult = {
    entry: mockCharacterEntry,
    jaData: mockApiResponse,
    enData: mockApiResponse,
    character: mockCharacter,
  };

  beforeEach(() => {
    generator = new AllCharactersGenerator();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("generateAllCharacters", () => {
    it("正常なCharacterResultからCharacter配列を生成する", async () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const results = [mockCharacterResult];

      // Act
      const characters = await generator.generateAllCharacters(results);

      // Assert
      expect(characters).toHaveLength(1);
      expect(characters[0]).toEqual(mockCharacter);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Character配列生成開始")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Character配列生成完了: 1キャラクター")
      );

      consoleSpy.mockRestore();
    });

    it("複数のCharacterResultを正しく処理する", async () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const character2: Character = {
        ...mockCharacter,
        id: "character2",
        name: { ja: "キャラクター2", en: "Character 2" },
      };
      const result2: CharacterResult = {
        ...mockCharacterResult,
        entry: { ...mockCharacterEntry, id: "character2" },
        character: character2,
      };
      const results = [mockCharacterResult, result2];

      // Act
      const characters = await generator.generateAllCharacters(results);

      // Assert
      expect(characters).toHaveLength(2);
      expect(characters[0]).toEqual(mockCharacter);
      expect(characters[1]).toEqual(character2);

      consoleSpy.mockRestore();
    });

    it("Character.idがエントリーIDと一致しない場合は修正する", async () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const mismatchedCharacter: Character = {
        ...mockCharacter,
        id: "mismatched-id",
      };
      const result: CharacterResult = {
        ...mockCharacterResult,
        character: mismatchedCharacter,
      };

      // Act
      const characters = await generator.generateAllCharacters([result]);

      // Assert
      expect(characters).toHaveLength(1);
      expect(characters[0].id).toBe("test-character"); // エントリーIDに修正される
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Character.id (mismatched-id) がエントリーID (test-character) と一致しません"
        )
      );

      consoleSpy.mockRestore();
    });

    it("空の結果配列の場合はValidationErrorを投げる", async () => {
      // Act & Assert
      await expect(generator.generateAllCharacters([])).rejects.toThrow(
        ValidationError
      );
      await expect(generator.generateAllCharacters([])).rejects.toThrow(
        "処理結果が空です"
      );
    });

    it("nullまたはundefinedの結果の場合はValidationErrorを投げる", async () => {
      // Act & Assert
      await expect(
        generator.generateAllCharacters(null as any)
      ).rejects.toThrow(ValidationError);
      await expect(
        generator.generateAllCharacters(undefined as any)
      ).rejects.toThrow(ValidationError);
    });

    it("Characterオブジェクトが存在しない場合はValidationErrorを投げる", async () => {
      // Arrange
      const invalidResult: CharacterResult = {
        ...mockCharacterResult,
        character: null as any,
      };

      // Act & Assert
      await expect(
        generator.generateAllCharacters([invalidResult])
      ).rejects.toThrow(ValidationError);
      await expect(
        generator.generateAllCharacters([invalidResult])
      ).rejects.toThrow(
        'キャラクター "test-character" のCharacterオブジェクトが存在しません'
      );
    });

    it("多言語名が不完全な場合はValidationErrorを投げる", async () => {
      // Arrange
      const incompleteCharacter: Character = {
        ...mockCharacter,
        name: { ja: "テスト", en: "" }, // 英語名が空
      };
      const result: CharacterResult = {
        ...mockCharacterResult,
        character: incompleteCharacter,
      };

      // Act & Assert
      await expect(generator.generateAllCharacters([result])).rejects.toThrow(
        ValidationError
      );
      await expect(generator.generateAllCharacters([result])).rejects.toThrow(
        'キャラクター "test-character" の多言語名が不完全です'
      );
    });

    it("factionが数値IDでない場合はValidationErrorを投げる", async () => {
      // Arrange
      const invalidCharacter: Character = {
        ...mockCharacter,
        faction: "invalid" as any,
      };
      const result: CharacterResult = {
        ...mockCharacterResult,
        character: invalidCharacter,
      };

      // Act & Assert
      await expect(generator.generateAllCharacters([result])).rejects.toThrow(
        ValidationError
      );
      await expect(generator.generateAllCharacters([result])).rejects.toThrow(
        'キャラクター "test-character" のfactionプロパティが数値IDではありません'
      );
    });
  });

  describe("validateCharacterArray", () => {
    it("有効なCharacter配列を正しく検証する", () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const characters = [mockCharacter];

      // Act
      const result = generator.validateCharacterArray(characters);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.duplicateIds).toHaveLength(0);
      expect(result.invalidCharacters).toHaveLength(0);
      expect(result.totalCharacters).toBe(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Character配列検証完了: 全て有効")
      );

      consoleSpy.mockRestore();
    });

    it("重複IDを検出する", () => {
      // Arrange
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const character2 = { ...mockCharacter }; // 同じID
      const characters = [mockCharacter, character2];

      // Act
      const result = generator.validateCharacterArray(characters);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.duplicateIds).toContain("test-character");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("重複ID検出: test-character")
      );

      consoleErrorSpy.mockRestore();
    });

    it("無効なキャラクターを検出する", () => {
      // Arrange
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const invalidCharacter: Character = {
        ...mockCharacter,
        id: "", // 無効なID
        attr: {
          ...mockCharacter.attr,
          hp: [1, 2, 3], // 無効な配列長
        },
      };
      const characters = [invalidCharacter];

      // Act
      const result = generator.validateCharacterArray(characters);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.invalidCharacters).toHaveLength(1);
      expect(result.invalidCharacters[0].index).toBe(0);
      expect(result.invalidCharacters[0].errors).toContain(
        "id フィールドが空または存在しません"
      );
      expect(result.invalidCharacters[0].errors).toContain(
        "attr.hp 配列は正確に 7 つの値を含む必要があります (現在: 3)"
      );

      consoleErrorSpy.mockRestore();
    });

    it("空の配列を正しく処理する", () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const characters: Character[] = [];

      // Act
      const result = generator.validateCharacterArray(characters);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.totalCharacters).toBe(0);

      consoleSpy.mockRestore();
    });
  });

  describe("outputCharactersFile", () => {
    beforeEach(() => {
      mockPath.dirname.mockReturnValue("data");
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {});
    });

    it("Character配列を正しいTypeScriptファイル形式で出力する", () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const characters = [mockCharacter];
      const outputPath = "data/characters.ts";

      // Act
      generator.outputCharactersFile(characters, outputPath);

      // Assert
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        outputPath,
        expect.stringContaining('import { Character } from "../src/types";'),
        "utf-8"
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        outputPath,
        expect.stringContaining("export default ["),
        "utf-8"
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        outputPath,
        expect.stringContaining("] as Character[];"),
        "utf-8"
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        outputPath,
        expect.stringContaining('id: "test-character"'),
        "utf-8"
      );

      consoleSpy.mockRestore();
    });

    it("出力ディレクトリが存在しない場合は作成する", () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => {});
      const characters = [mockCharacter];

      // Act
      generator.outputCharactersFile(characters, "new-dir/characters.ts");

      // Assert
      expect(mockFs.mkdirSync).toHaveBeenCalledWith("data", {
        recursive: true,
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("ディレクトリ作成: data")
      );

      consoleSpy.mockRestore();
    });

    it("空のキャラクター配列の場合はValidationErrorを投げる", () => {
      // Act & Assert
      expect(() => generator.outputCharactersFile([])).toThrow(ValidationError);
      expect(() => generator.outputCharactersFile([])).toThrow(
        "出力するキャラクター配列が空です"
      );
    });

    it("無効な出力パスの場合はValidationErrorを投げる", () => {
      // Act & Assert
      expect(() => generator.outputCharactersFile([mockCharacter], "")).toThrow(
        ValidationError
      );
      expect(() => generator.outputCharactersFile([mockCharacter], "")).toThrow(
        "出力ファイルパスが無効です"
      );
    });

    it("ファイル書き込みエラーの場合はParsingErrorを投げる", () => {
      // Arrange
      const writeError = new Error("書き込み権限がありません");
      mockFs.writeFileSync.mockImplementation(() => {
        throw writeError;
      });

      // Act & Assert
      expect(() =>
        generator.outputCharactersFile([mockCharacter], "data/characters.ts")
      ).toThrow(ParsingError);
      expect(() =>
        generator.outputCharactersFile([mockCharacter], "data/characters.ts")
      ).toThrow('ファイル "data/characters.ts" の書き込みに失敗しました');
    });

    it("複数のキャラクターを正しい形式で出力する", () => {
      // Arrange
      const character2: Character = {
        ...mockCharacter,
        id: "character2",
        name: { ja: "キャラクター2", en: "Character 2" },
      };
      const characters = [mockCharacter, character2];

      // Act
      generator.outputCharactersFile(characters, "data/characters.ts");

      // Assert
      const writtenContent = mockFs.writeFileSync.mock.calls[0][1] as string;
      expect(writtenContent).toContain('id: "test-character"');
      expect(writtenContent).toContain('id: "character2"');
      expect(writtenContent).toContain('ja: "テストキャラクター"');
      expect(writtenContent).toContain('ja: "キャラクター2"');
    });
  });

  describe("generateProcessingReport", () => {
    it("詳細な処理レポートを生成する", () => {
      // Arrange
      const processingResult = {
        successful: [mockCharacterResult],
        failed: [
          {
            entry: { ...mockCharacterEntry, id: "failed-character" },
            error: "処理失敗",
            stage: "DATA_PROCESSING" as const,
            timestamp: new Date(),
          },
        ],
        statistics: {
          total: 2,
          successful: 1,
          failed: 1,
          processingTime: 5000,
          startTime: new Date("2023-01-01T10:00:00Z"),
          endTime: new Date("2023-01-01T10:00:05Z"),
        },
      };

      // Act
      const report = generator.generateProcessingReport(processingResult);

      // Assert
      expect(report).toContain("# 全キャラクター処理レポート");
      expect(report).toContain("総キャラクター数: 2");
      expect(report).toContain("成功: 1");
      expect(report).toContain("失敗: 1");
      expect(report).toContain("成功率: 50%");
      expect(report).toContain("test-character (テストキャラクター)");
      expect(report).toContain("failed-character - DATA_PROCESSING: 処理失敗");
    });

    it("成功のみの場合のレポートを生成する", () => {
      // Arrange
      const processingResult = {
        successful: [mockCharacterResult],
        failed: [],
        statistics: {
          total: 1,
          successful: 1,
          failed: 0,
          processingTime: 2000,
          startTime: new Date("2023-01-01T10:00:00Z"),
          endTime: new Date("2023-01-01T10:00:02Z"),
        },
      };

      // Act
      const report = generator.generateProcessingReport(processingResult);

      // Assert
      expect(report).toContain("成功率: 100%");
      expect(report).toContain("## 成功したキャラクター (1)");
      expect(report).not.toContain("## 失敗したキャラクター");
    });

    it("失敗のみの場合のレポートを生成する", () => {
      // Arrange
      const processingResult = {
        successful: [],
        failed: [
          {
            entry: mockCharacterEntry,
            error: "API取得失敗",
            stage: "API_FETCH" as const,
            timestamp: new Date(),
          },
        ],
        statistics: {
          total: 1,
          successful: 0,
          failed: 1,
          processingTime: 1000,
          startTime: new Date("2023-01-01T10:00:00Z"),
          endTime: new Date("2023-01-01T10:00:01Z"),
        },
      };

      // Act
      const report = generator.generateProcessingReport(processingResult);

      // Assert
      expect(report).toContain("成功率: 0%");
      expect(report).toContain("## 失敗したキャラクター (1)");
      expect(report).not.toContain("## 成功したキャラクター");
    });
  });

  describe("private methods", () => {
    it("formatFileSize - バイト数を正しくフォーマットする", () => {
      // privateメソッドのテストのため、publicメソッド経由でテスト
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // 小さなファイル（バイト）
      generator.outputCharactersFile([mockCharacter], "test.ts");
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("bytes"));

      consoleSpy.mockRestore();
    });

    it("formatDuration - 時間を正しくフォーマットする", () => {
      // Arrange
      const processingResult = {
        successful: [],
        failed: [],
        statistics: {
          total: 0,
          successful: 0,
          failed: 0,
          processingTime: 3661000, // 1時間1分1秒
          startTime: new Date(),
          endTime: new Date(),
        },
      };

      // Act
      const report = generator.generateProcessingReport(processingResult);

      // Assert
      expect(report).toContain("1時間1分1秒");
    });
  });
});
