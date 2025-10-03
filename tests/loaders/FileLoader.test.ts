import { describe, it, expect, beforeEach, vi } from "vitest";
import { FileLoader } from "../../src/loaders/FileLoader";
import { ParsingError } from "../../src/errors";
import * as fs from "fs";

// fsモジュールをモック
vi.mock("fs");

describe("FileLoader", () => {
  let fileLoader: FileLoader;

  beforeEach(() => {
    fileLoader = new FileLoader();
    vi.clearAllMocks();
  });

  describe("loadFromFile", () => {
    it("正常なJSONファイルを読み込める", async () => {
      // モックデータ
      const mockApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "28",
            name: "フォン・ライカン",
            modules: [],
          },
        },
      };

      // fsモックの設定
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify(mockApiResponse)
      );

      const result = await fileLoader.loadFromFile("test.json");

      expect(result).toEqual(mockApiResponse);
      expect(fs.existsSync).toHaveBeenCalledWith("test.json");
      expect(fs.readFileSync).toHaveBeenCalledWith("test.json", "utf-8");
    });

    it("存在しないファイルの場合はParsingErrorを投げる", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(fileLoader.loadFromFile("nonexistent.json")).rejects.toThrow(
        ParsingError
      );
      await expect(fileLoader.loadFromFile("nonexistent.json")).rejects.toThrow(
        "ファイルが見つかりません: nonexistent.json"
      );
    });

    it("空のファイルの場合はParsingErrorを投げる", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("   "); // 空白のみ

      await expect(fileLoader.loadFromFile("empty.json")).rejects.toThrow(
        ParsingError
      );
      await expect(fileLoader.loadFromFile("empty.json")).rejects.toThrow(
        "ファイルが空です: empty.json"
      );
    });

    it("不正なJSONの場合はParsingErrorを投げる", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("{ invalid json }");

      await expect(fileLoader.loadFromFile("invalid.json")).rejects.toThrow(
        ParsingError
      );
      await expect(fileLoader.loadFromFile("invalid.json")).rejects.toThrow(
        "JSONの解析に失敗しました: invalid.json"
      );
    });

    it("不正なAPIレスポンス構造の場合はParsingErrorを投げる", async () => {
      const invalidResponse = { invalid: "structure" };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify(invalidResponse)
      );

      await expect(
        fileLoader.loadFromFile("invalid-structure.json")
      ).rejects.toThrow(ParsingError);
    });

    it("retcodeが数値でない場合はParsingErrorを投げる", async () => {
      const invalidResponse = {
        retcode: "invalid",
        message: "OK",
        data: { page: { id: "28", name: "test", modules: [] } },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify(invalidResponse)
      );

      await expect(
        fileLoader.loadFromFile("invalid-retcode.json")
      ).rejects.toThrow(ParsingError);
      await expect(
        fileLoader.loadFromFile("invalid-retcode.json")
      ).rejects.toThrow("retcodeが数値ではありません");
    });

    it("ファイル読み込みエラーの場合はParsingErrorを投げる", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error("Permission denied");
      });

      await expect(
        fileLoader.loadFromFile("permission-denied.json")
      ).rejects.toThrow(ParsingError);
      await expect(
        fileLoader.loadFromFile("permission-denied.json")
      ).rejects.toThrow(
        "ファイルの読み込みに失敗しました: permission-denied.json"
      );
    });
  });
});
