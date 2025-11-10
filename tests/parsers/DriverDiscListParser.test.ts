import { describe, test, expect, beforeEach } from "vitest";
import { DriverDiscListParser } from "../../src/parsers/DriverDiscListParser";
import { DriverDiscEntry } from "../../src/types";

describe("DriverDiscListParserを表示するコンポーネント", () => {
  let parser: DriverDiscListParser;

  beforeEach(() => {
    parser = new DriverDiscListParser();
  });

  test("disc-list.jsonファイルを正常に解析できること", async () => {
    // Arrange & Act
    const entries = await parser.parseDiscListFile("json/data/disc-list.json");

    // Assert
    expect(entries).toBeDefined();
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);

    // 各エントリーが正しい構造を持つことを確認
    entries.forEach((entry) => {
      expect(entry).toHaveProperty("id");
      expect(entry).toHaveProperty("name");
      expect(entry).toHaveProperty("iconUrl");
      expect(typeof entry.id).toBe("string");
      expect(typeof entry.name).toBe("string");
      expect(typeof entry.iconUrl).toBe("string");
    });
  });

  test("有効なドライバーディスクエントリーを正しく検証できること", () => {
    // Arrange
    const validEntry: DriverDiscEntry = {
      id: "790",
      name: "大山を統べる者",
      iconUrl: "https://example.com/icon.png",
    };

    // Act
    const result = parser.validateDriverDiscEntry(validEntry);

    // Assert
    expect(result).toBe(true);
  });

  test("無効なドライバーディスクエントリーを正しく検証できること", () => {
    // Arrange
    const invalidEntries = [
      // IDが空文字
      { id: "", name: "テスト", iconUrl: "https://example.com/icon.png" },
      // 名前が空文字
      { id: "123", name: "", iconUrl: "https://example.com/icon.png" },
      // アイコンURLが空文字
      { id: "123", name: "テスト", iconUrl: "" },
      // IDが数値でない
      { id: "abc", name: "テスト", iconUrl: "https://example.com/icon.png" },
      // アイコンURLがHTTPSでない
      { id: "123", name: "テスト", iconUrl: "http://example.com/icon.png" },
    ];

    // Act & Assert
    invalidEntries.forEach((entry) => {
      const result = parser.validateDriverDiscEntry(entry);
      expect(result).toBe(false);
    });
  });

  test("統計情報を正常に表示できること", async () => {
    // Arrange
    const entries = await parser.parseDiscListFile("json/data/disc-list.json");

    // Act & Assert - エラーが発生しないことを確認
    expect(() => parser.displayStatistics(entries)).not.toThrow();
  });

  test("存在しないファイルを指定した場合にエラーが発生すること", async () => {
    // Act & Assert
    await expect(
      parser.parseDiscListFile("non-existent-file.json")
    ).rejects.toThrow();
  });

  test("無効なJSON形式のファイルを指定した場合にエラーが発生すること", async () => {
    // Act & Assert
    await expect(parser.parseDiscListFile("package.json")).rejects.toThrow(
      "disc-list.jsonの形式が無効です"
    );
  });
});
