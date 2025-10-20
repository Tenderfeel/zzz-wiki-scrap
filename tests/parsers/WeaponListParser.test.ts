import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { WeaponListParser } from "../../src/parsers/WeaponListParser";
import { WeaponEntry } from "../../src/types";

describe("WeaponListParser", () => {
  let parser: WeaponListParser;
  const testFilePath = "test-weapon-list.json";

  beforeEach(() => {
    parser = new WeaponListParser();
    // テスト環境の設定
    process.env.NODE_ENV = "test";
    process.env.VITEST = "true";
  });

  afterEach(() => {
    // テストファイルのクリーンアップ
    if (existsSync(testFilePath)) {
      unlinkSync(testFilePath);
    }
    // 環境変数のクリーンアップ
    delete process.env.NODE_ENV;
    delete process.env.VITEST;
  });

  describe("parseWeaponList", () => {
    it("有効な weapon-list.json を正しく解析する", async () => {
      // 有効なテストデータを作成（新しい配列構造）
      const validWeaponListData = [
        {
          entry_page_id: "936",
          name: "燔火の朧夜",
          filter_values: {
            w_engine_rarity: {
              values: ["A"],
            },
            filter_key_13: {
              values: ["命破"],
            },
          },
        },
        {
          entry_page_id: "935",
          name: "炉で歌い上げられる夢",
          filter_values: {
            w_engine_rarity: {
              values: ["S"],
            },
            filter_key_13: {
              values: ["支援"],
            },
          },
        },
      ];

      writeFileSync(testFilePath, JSON.stringify(validWeaponListData));

      const result = await parser.parseWeaponList(testFilePath);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "936",
        name: "燔火の朧夜",
        rarity: "A",
        specialty: "命破",
      });
      expect(result[1]).toEqual({
        id: "935",
        name: "炉で歌い上げられる夢",
        rarity: "S",
        specialty: "支援",
      });
    });

    it("レア度Bの音動機を除外する", async () => {
      const weaponListWithRarityB = [
        {
          entry_page_id: "100",
          name: "レア度A音動機",
          filter_values: {
            w_engine_rarity: {
              values: ["A"],
            },
          },
        },
        {
          entry_page_id: "200",
          name: "レア度B音動機",
          filter_values: {
            w_engine_rarity: {
              values: ["B"],
            },
          },
        },
        {
          entry_page_id: "300",
          name: "レア度S音動機",
          filter_values: {
            w_engine_rarity: {
              values: ["S"],
            },
          },
        },
      ];

      writeFileSync(testFilePath, JSON.stringify(weaponListWithRarityB));

      const result = await parser.parseWeaponList(testFilePath);

      // レア度Bのアイテムはフィルタリングされるべき
      expect(result).toHaveLength(2);
      expect(
        result.find((item) => item.name === "レア度B音動機")
      ).toBeUndefined();
      expect(
        result.find((item) => item.name === "レア度A音動機")
      ).toBeDefined();
      expect(
        result.find((item) => item.name === "レア度S音動機")
      ).toBeDefined();
    });

    it("specialtyが存在しない場合でも正しく処理する", async () => {
      const weaponListWithoutSpecialty = [
        {
          entry_page_id: "400",
          name: "特性なし音動機",
          filter_values: {
            w_engine_rarity: {
              values: ["A"],
            },
            // filter_key_13が存在しない
          },
        },
      ];

      writeFileSync(testFilePath, JSON.stringify(weaponListWithoutSpecialty));

      const result = await parser.parseWeaponList(testFilePath);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: "400",
        name: "特性なし音動機",
        rarity: "A",
        specialty: undefined,
      });
    });

    it("ファイルが存在しない場合にエラーをスローする", async () => {
      await expect(
        parser.parseWeaponList("non-existent-file.json")
      ).rejects.toThrow("weapon-list.jsonファイルの読み込みに失敗しました");
    });

    it("無効なJSONファイルの場合にエラーをスローする", async () => {
      writeFileSync(testFilePath, "invalid json content");

      await expect(parser.parseWeaponList(testFilePath)).rejects.toThrow(
        "weapon-list.jsonファイルの読み込みに失敗しました"
      );
    });

    it("ルートが配列でない場合にエラーをスローする", async () => {
      const invalidStructure = {
        retcode: 0,
        message: "OK",
        data: {
          list: "not an array",
        },
      };

      writeFileSync(testFilePath, JSON.stringify(invalidStructure));

      await expect(parser.parseWeaponList(testFilePath)).rejects.toThrow(
        "weapon-list.jsonの形式が無効です: ルートが配列ではありません"
      );
    });

    it("ルートがオブジェクトの場合にエラーをスローする", async () => {
      const noDataProperty = {
        retcode: 0,
        message: "OK",
        // 配列ではなくオブジェクト
      };

      writeFileSync(testFilePath, JSON.stringify(noDataProperty));

      await expect(parser.parseWeaponList(testFilePath)).rejects.toThrow(
        "weapon-list.jsonの形式が無効です: ルートが配列ではありません"
      );
    });

    it("有効な音動機情報が存在しない場合にエラーをスローする", async () => {
      const noValidWeapons = [
        {
          // entry_page_idが存在しない
          name: "無効な音動機",
          filter_values: {
            w_engine_rarity: {
              values: ["A"],
            },
          },
        },
        {
          entry_page_id: "500",
          // nameが存在しない
          filter_values: {
            w_engine_rarity: {
              values: ["S"],
            },
          },
        },
      ];

      writeFileSync(testFilePath, JSON.stringify(noValidWeapons));

      await expect(parser.parseWeaponList(testFilePath)).rejects.toThrow(
        "weapon-list.jsonから有効な音動機情報を抽出できませんでした"
      );
    });

    it("部分的に無効なデータが含まれていても有効なデータは処理する", async () => {
      const mixedValidityData = [
        {
          entry_page_id: "600",
          name: "有効な音動機1",
          filter_values: {
            w_engine_rarity: {
              values: ["A"],
            },
          },
        },
        {
          // entry_page_idが存在しない（無効）
          name: "無効な音動機",
          filter_values: {
            w_engine_rarity: {
              values: ["S"],
            },
          },
        },
        {
          entry_page_id: "700",
          name: "有効な音動機2",
          filter_values: {
            w_engine_rarity: {
              values: ["S"],
            },
          },
        },
      ];

      writeFileSync(testFilePath, JSON.stringify(mixedValidityData));

      const result = await parser.parseWeaponList(testFilePath);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("有効な音動機1");
      expect(result[1].name).toBe("有効な音動機2");
    });
  });

  describe("validateWeaponEntry", () => {
    it("有効な音動機エントリーに対してtrueを返す", () => {
      const validEntry: WeaponEntry = {
        id: "123",
        name: "テスト音動機",
        rarity: "A",
        specialty: "強攻",
      };

      expect(parser.validateWeaponEntry(validEntry)).toBe(true);
    });

    it("specialtyがundefinedでも有効とする", () => {
      const validEntryWithoutSpecialty: WeaponEntry = {
        id: "456",
        name: "特性なし音動機",
        rarity: "S",
      };

      expect(parser.validateWeaponEntry(validEntryWithoutSpecialty)).toBe(true);
    });

    it("idが存在しない場合にfalseを返す", () => {
      const invalidEntry = {
        name: "テスト音動機",
        rarity: "A" as const,
      };

      expect(parser.validateWeaponEntry(invalidEntry)).toBe(false);
    });

    it("idが空文字列の場合にfalseを返す", () => {
      const invalidEntry = {
        id: "",
        name: "テスト音動機",
        rarity: "A" as const,
      };

      expect(parser.validateWeaponEntry(invalidEntry)).toBe(false);
    });

    it("idが文字列でない場合にfalseを返す", () => {
      const invalidEntry = {
        id: 123 as any,
        name: "テスト音動機",
        rarity: "A" as const,
      };

      expect(parser.validateWeaponEntry(invalidEntry)).toBe(false);
    });

    it("nameが存在しない場合にfalseを返す", () => {
      const invalidEntry = {
        id: "123",
        rarity: "A" as const,
      };

      expect(parser.validateWeaponEntry(invalidEntry)).toBe(false);
    });

    it("nameが空文字列の場合にfalseを返す", () => {
      const invalidEntry = {
        id: "123",
        name: "",
        rarity: "A" as const,
      };

      expect(parser.validateWeaponEntry(invalidEntry)).toBe(false);
    });

    it("nameが文字列でない場合にfalseを返す", () => {
      const invalidEntry = {
        id: "123",
        name: 456 as any,
        rarity: "A" as const,
      };

      expect(parser.validateWeaponEntry(invalidEntry)).toBe(false);
    });

    it("rarityが存在しない場合にfalseを返す", () => {
      const invalidEntry = {
        id: "123",
        name: "テスト音動機",
      };

      expect(parser.validateWeaponEntry(invalidEntry)).toBe(false);
    });

    it("rarityがAまたはS以外の場合にfalseを返す", () => {
      const invalidEntry = {
        id: "123",
        name: "テスト音動機",
        rarity: "B" as any,
      };

      expect(parser.validateWeaponEntry(invalidEntry)).toBe(false);
    });

    it("idが数値文字列でない場合にfalseを返す", () => {
      const invalidEntry = {
        id: "abc123",
        name: "テスト音動機",
        rarity: "A" as const,
      };

      expect(parser.validateWeaponEntry(invalidEntry)).toBe(false);
    });

    it("specialtyが空文字列の場合にfalseを返す", () => {
      const invalidEntry = {
        id: "123",
        name: "テスト音動機",
        rarity: "A" as const,
        specialty: "",
      };

      expect(parser.validateWeaponEntry(invalidEntry)).toBe(false);
    });

    it("specialtyが文字列でない場合にfalseを返す", () => {
      const invalidEntry = {
        id: "123",
        name: "テスト音動機",
        rarity: "A" as const,
        specialty: 123 as any,
      };

      expect(parser.validateWeaponEntry(invalidEntry)).toBe(false);
    });

    it("idに空白が含まれていても数値として有効であればtrueを返す", () => {
      const validEntry = {
        id: " 123 ",
        name: "テスト音動機",
        rarity: "A" as const,
      };

      expect(parser.validateWeaponEntry(validEntry)).toBe(true);
    });
  });

  describe("displayStatistics", () => {
    it("音動機統計を正しく表示する", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const entries: WeaponEntry[] = [
        { id: "1", name: "音動機1", rarity: "A", specialty: "強攻" },
        { id: "2", name: "音動機2", rarity: "S", specialty: "支援" },
        { id: "3", name: "音動機3", rarity: "A", specialty: "強攻" },
        { id: "4", name: "音動機4", rarity: "S" }, // specialtyなし
      ];

      parser.displayStatistics(entries);

      expect(consoleSpy).toHaveBeenCalledWith("\n=== 音動機リスト統計 ===");
      expect(consoleSpy).toHaveBeenCalledWith("総音動機数: 4");
      expect(consoleSpy).toHaveBeenCalledWith("レア度別:");
      expect(consoleSpy).toHaveBeenCalledWith("  - A級: 2個");
      expect(consoleSpy).toHaveBeenCalledWith("  - S級: 2個");
      expect(consoleSpy).toHaveBeenCalledWith("特性別:");
      expect(consoleSpy).toHaveBeenCalledWith("  - 強攻: 2個");
      expect(consoleSpy).toHaveBeenCalledWith("  - 支援: 1個");

      consoleSpy.mockRestore();
    });

    it("空の配列に対して適切に統計を表示する", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      parser.displayStatistics([]);

      expect(consoleSpy).toHaveBeenCalledWith("\n=== 音動機リスト統計 ===");
      expect(consoleSpy).toHaveBeenCalledWith("総音動機数: 0");

      consoleSpy.mockRestore();
    });

    it("10個以下の音動機の場合、全て表示する", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const entries: WeaponEntry[] = [
        { id: "1", name: "音動機1", rarity: "A" },
        { id: "2", name: "音動機2", rarity: "S" },
        { id: "3", name: "音動機3", rarity: "A" },
      ];

      parser.displayStatistics(entries);

      expect(consoleSpy).toHaveBeenCalledWith("\n最初の5音動機:");
      expect(consoleSpy).toHaveBeenCalledWith("  - 音動機1 (ID: 1, レア度: A)");
      expect(consoleSpy).toHaveBeenCalledWith("  - 音動機2 (ID: 2, レア度: S)");
      expect(consoleSpy).toHaveBeenCalledWith("  - 音動機3 (ID: 3, レア度: A)");

      // 10個以下なので「最後の5音動機」は表示されない
      expect(consoleSpy).not.toHaveBeenCalledWith("\n最後の5音動機:");

      consoleSpy.mockRestore();
    });

    it("10個を超える音動機の場合、最初と最後の5個を表示する", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const entries: WeaponEntry[] = Array.from({ length: 15 }, (_, i) => ({
        id: String(i + 1),
        name: `音動機${i + 1}`,
        rarity: (i % 2 === 0 ? "A" : "S") as "A" | "S",
      }));

      parser.displayStatistics(entries);

      expect(consoleSpy).toHaveBeenCalledWith("\n最初の5音動機:");
      expect(consoleSpy).toHaveBeenCalledWith("  - 音動機1 (ID: 1, レア度: A)");
      expect(consoleSpy).toHaveBeenCalledWith("  - 音動機5 (ID: 5, レア度: A)");

      expect(consoleSpy).toHaveBeenCalledWith("\n最後の5音動機:");
      expect(consoleSpy).toHaveBeenCalledWith(
        "  - 音動機11 (ID: 11, レア度: A)"
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "  - 音動機15 (ID: 15, レア度: A)"
      );

      consoleSpy.mockRestore();
    });
  });

  describe("extractWeaponEntry (private method behavior)", () => {
    it("無効なデータに対してnullを返す（間接的テスト）", async () => {
      const weaponListWithInvalidData = [
        {
          // entry_page_idが存在しない
          name: "無効な音動機",
          filter_values: {
            w_engine_rarity: {
              values: ["A"],
            },
          },
        },
        {
          entry_page_id: "800",
          name: "有効な音動機",
          filter_values: {
            w_engine_rarity: {
              values: ["A"],
            },
          },
        },
      ];

      writeFileSync(testFilePath, JSON.stringify(weaponListWithInvalidData));

      const result = await parser.parseWeaponList(testFilePath);

      // 無効なデータは除外され、有効なデータのみが返される
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("有効な音動機");
    });

    it("レア度が無効な場合にnullを返す（間接的テスト）", async () => {
      const weaponListWithInvalidRarity = [
        {
          entry_page_id: "900",
          name: "無効レア度音動機",
          filter_values: {
            w_engine_rarity: {
              values: ["X"], // 無効なレア度
            },
          },
        },
        {
          entry_page_id: "901",
          name: "有効レア度音動機",
          filter_values: {
            w_engine_rarity: {
              values: ["A"],
            },
          },
        },
      ];

      writeFileSync(testFilePath, JSON.stringify(weaponListWithInvalidRarity));

      const result = await parser.parseWeaponList(testFilePath);

      // 無効なレア度のデータは除外される
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("有効レア度音動機");
    });
  });

  describe("エラーハンドリング", () => {
    it("extractWeaponEntry内でエラーが発生してもプロセスを継続する", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // 異常な構造のデータを含むテストケース
      const weaponListWithCorruptedData = [
        {
          entry_page_id: "1000",
          name: "正常な音動機",
          filter_values: {
            w_engine_rarity: {
              values: ["A"],
            },
          },
        },
        null, // nullデータ
        {
          entry_page_id: "1001",
          name: "別の正常な音動機",
          filter_values: {
            w_engine_rarity: {
              values: ["S"],
            },
          },
        },
      ];

      writeFileSync(testFilePath, JSON.stringify(weaponListWithCorruptedData));

      const result = await parser.parseWeaponList(testFilePath);

      // エラーが発生しても処理は継続され、有効なデータは取得される
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("正常な音動機");
      expect(result[1].name).toBe("別の正常な音動機");

      consoleSpy.mockRestore();
    });
  });
});
