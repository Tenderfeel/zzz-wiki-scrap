import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CharacterGenerator } from "../../src/generators/CharacterGenerator";
import { DataMapper } from "../../src/mappers/DataMapper";
import { AttackTypeFallbackService } from "../../src/services/AttackTypeFallbackService";
import * as fs from "fs";
import * as path from "path";

/**
 * 統合テスト: AttackTypeFallback機能
 * 攻撃タイプフォールバック機能のエンドツーエンドテスト
 * 要件: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2, 3.3, 2.4
 */
describe("AttackTypeFallback Integration Tests", () => {
  let characterGenerator: CharacterGenerator;
  let dataMapper: DataMapper;
  let fallbackService: AttackTypeFallbackService;

  const testListJsonPath = "json/data/test-list.json";

  // テスト用のlist.jsonデータ
  const mockListData = {
    retcode: 0,
    message: "OK",
    data: {
      list: [
        {
          entry_page_id: "28",
          name: "Von Lycaon",
          filter_values: {
            agent_attack_type: {
              values: ["Strike"],
              value_types: [
                {
                  id: "15",
                  value: "Strike",
                  enum_string: "strike",
                },
              ],
            },
          },
        },
        {
          entry_page_id: "123",
          name: "Test Character",
          filter_values: {
            agent_attack_type: {
              values: ["Slash", "Pierce"],
              value_types: [
                {
                  id: "13",
                  value: "Slash",
                  enum_string: "slash",
                },
                {
                  id: "14",
                  value: "Pierce",
                  enum_string: "pierce",
                },
              ],
            },
          },
        },
      ],
    },
  };

  beforeEach(async () => {
    // テスト用のlist.jsonファイルを作成
    const testDir = path.dirname(testListJsonPath);
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    fs.writeFileSync(testListJsonPath, JSON.stringify(mockListData, null, 2));

    // サービスインスタンスを作成
    fallbackService = new AttackTypeFallbackService(testListJsonPath);
    dataMapper = new DataMapper(fallbackService);
    characterGenerator = new CharacterGenerator(dataMapper);
  });

  afterEach(() => {
    // テストファイルのクリーンアップ
    if (fs.existsSync(testListJsonPath)) {
      fs.unlinkSync(testListJsonPath);
    }
  });

  describe("正常フローの統合テスト", () => {
    it("wikiデータから正常に攻撃タイプを取得できる場合", async () => {
      // wikiデータから正常に取得できる場合のモック
      const mockProcessedData = {
        id: "28",
        name: { ja: "フォン・ライカン", en: "Von Lycaon" },
        fullName: { ja: "フォン・ライカン", en: "Von Lycaon" },
        specialty: "stun" as const,
        stats: "ice" as const,
        attackType: "strike" as const, // wikiから正常取得
        faction: {
          id: 2,
          name: { ja: "ヴィクトリア家政", en: "Victoria Housekeeping" },
        },
        rarity: "S" as const,
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

      const result = await characterGenerator.generateCharacter(
        mockProcessedData,
        "28"
      );

      // wikiデータが優先されることを確認
      expect(result.attackType).toBe("strike");
      expect(result.id).toBe("28");
      expect(result.name.ja).toBe("フォン・ライカン");
    });

    it("フォールバック機能が動作するケース", async () => {
      // DataMapperのmapAttackTypeを直接テスト
      const attackType = dataMapper.mapAttackType(undefined as any, "28");

      // フォールバック機能でlist.jsonから取得されることを確認
      expect(attackType).toBe("strike");
    });

    it("複数攻撃タイプがある場合に最初の値を使用する", async () => {
      // 複数攻撃タイプを持つキャラクターのテスト
      const attackType = dataMapper.mapAttackType(undefined as any, "123");

      // 最初の値（Slash）が使用されることを確認
      expect(attackType).toBe("slash");
    });

    it("最終的なCharacterオブジェクト生成の確認", async () => {
      const mockProcessedData = {
        id: "28",
        name: { ja: "フォン・ライカン", en: "Von Lycaon" },
        fullName: { ja: "フォン・ライカン", en: "Von Lycaon" },
        specialty: "stun" as const,
        stats: "ice" as const,
        attackType: undefined, // フォールバック使用
        faction: {
          id: 2,
          name: { ja: "ヴィクトリア家政", en: "Victoria Housekeeping" },
        },
        rarity: "S" as const,
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

      const result = await characterGenerator.generateCharacter(
        mockProcessedData,
        "28"
      );

      // 完全なCharacterオブジェクトが生成されることを確認
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("name");
      expect(result).toHaveProperty("fullName");
      expect(result).toHaveProperty("specialty");
      expect(result).toHaveProperty("stats");
      expect(result).toHaveProperty("attackType");
      expect(result).toHaveProperty("faction");
      expect(result).toHaveProperty("rarity");
      expect(result).toHaveProperty("attr");

      // フォールバック機能で攻撃タイプが設定されることを確認
      expect(result.attackType).toBe("strike");
      expect(["slash", "pierce", "strike"]).toContain(result.attackType);
    });
  });

  describe("AttackTypeFallbackServiceの統合動作", () => {
    it("サービスが正しく初期化される", async () => {
      await fallbackService.initialize();

      // 初期化後にデータが取得できることを確認
      const attackType = fallbackService.getAttackTypeByPageId("28");
      expect(attackType).toBe("strike");
    });

    it("pageIdによる検索が正しく動作する", async () => {
      await fallbackService.initialize();

      // 存在するキャラクターの検索
      const lycaonAttackType = fallbackService.getAttackTypeByPageId("28");
      expect(lycaonAttackType).toBe("strike");

      const testCharacterAttackType =
        fallbackService.getAttackTypeByPageId("123");
      expect(testCharacterAttackType).toBe("slash"); // 最初の値

      // 存在しないキャラクターの検索
      const nonExistentAttackType =
        fallbackService.getAttackTypeByPageId("999");
      expect(nonExistentAttackType).toBeNull();
    });

    it("英語攻撃タイプマッピングが正しく動作する", async () => {
      await fallbackService.initialize();

      // 各攻撃タイプのマッピングを確認
      const strikeType = fallbackService.getAttackTypeByPageId("28");
      expect(strikeType).toBe("strike");

      const slashType = fallbackService.getAttackTypeByPageId("123");
      expect(slashType).toBe("slash");
    });
  });

  describe("DataMapperとの統合", () => {
    it("DataMapperがフォールバック機能を正しく使用する", async () => {
      // wikiデータが無効な場合
      const result1 = dataMapper.mapAttackType("", "28");
      expect(result1).toBe("strike");

      const result2 = dataMapper.mapAttackType(null as any, "123");
      expect(result2).toBe("slash");

      // 存在しないpageIdの場合
      const result3 = dataMapper.mapAttackType("", "999");
      expect(result3).toBe("strike"); // デフォルト値
    });

    it("既存の日本語マッピングが優先される", async () => {
      // 日本語の攻撃タイプが正常に取得できる場合
      const result1 = dataMapper.mapAttackType("打撃", "28");
      expect(result1).toBe("strike");

      const result2 = dataMapper.mapAttackType("斬撃", "123");
      expect(result2).toBe("slash");

      const result3 = dataMapper.mapAttackType("刺突", "999");
      expect(result3).toBe("pierce");
    });
  });

  describe("ログ機能の統合テスト", () => {
    it("フォールバック使用時にログが出力される", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      try {
        // フォールバック機能を使用
        dataMapper.mapAttackType("", "28");

        // ログが出力されることを確認
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            "list.json から攻撃タイプをフォールバック取得"
          )
        );
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it("wiki データ使用時にログが出力される", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      try {
        // wiki データを使用
        dataMapper.mapAttackType("打撃", "28");

        // ログが出力されることを確認
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("wiki データから攻撃タイプを取得")
        );
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });
});
describe("エラーシナリオの統合テスト", () => {
  describe("list.jsonファイル不存在時の動作", () => {
    it("ファイルが存在しない場合にデフォルト値を使用する", async () => {
      // 存在しないファイルパスでサービスを作成
      const nonExistentPath = "json/data/non-existent-list.json";
      const fallbackServiceWithMissingFile = new AttackTypeFallbackService(
        nonExistentPath
      );
      const dataMapperWithMissingFile = new DataMapper(
        fallbackServiceWithMissingFile
      );

      // ファイルが存在しないことを確認
      expect(fs.existsSync(nonExistentPath)).toBe(false);

      // フォールバック機能を使用しようとした場合
      const result = dataMapperWithMissingFile.mapAttackType("", "28");

      // デフォルト値が返されることを確認
      expect(result).toBe("strike");
    });

    it("ファイル不存在時にエラーログが出力される", async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      try {
        const nonExistentPath = "json/data/non-existent-list.json";
        const fallbackServiceWithMissingFile = new AttackTypeFallbackService(
          nonExistentPath
        );

        // 初期化を試行
        await fallbackServiceWithMissingFile.initialize();

        // 警告ログが出力されることを確認
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining("list.json ファイルが見つかりません")
        );
      } finally {
        consoleWarnSpy.mockRestore();
      }
    });

    it("ファイル不存在でもシステムが継続動作する", async () => {
      const nonExistentPath = "json/data/non-existent-list.json";
      const fallbackServiceWithMissingFile = new AttackTypeFallbackService(
        nonExistentPath
      );
      const dataMapperWithMissingFile = new DataMapper(
        fallbackServiceWithMissingFile
      );
      const characterGeneratorWithMissingFile = new CharacterGenerator(
        dataMapperWithMissingFile
      );

      const mockProcessedData = {
        id: "28",
        name: { ja: "フォン・ライカン", en: "Von Lycaon" },
        fullName: { ja: "フォン・ライカン", en: "Von Lycaon" },
        specialty: "stun" as const,
        stats: "ice" as const,
        attackType: undefined, // フォールバック使用
        faction: {
          id: 2,
          name: { ja: "ヴィクトリア家政", en: "Victoria Housekeeping" },
        },
        rarity: "S" as const,
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

      // エラーを発生させずに処理が完了することを確認
      await expect(
        characterGeneratorWithMissingFile.generateCharacter(
          mockProcessedData,
          "28"
        )
      ).resolves.not.toThrow();

      const result = await characterGeneratorWithMissingFile.generateCharacter(
        mockProcessedData,
        "28"
      );
      expect(result.attackType).toBe("strike"); // デフォルト値
    });
  });

  describe("JSON解析エラー時の動作", () => {
    const invalidJsonPath = "json/data/invalid-list.json";

    beforeEach(() => {
      // 不正なJSONファイルを作成
      const testDir = path.dirname(invalidJsonPath);
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      fs.writeFileSync(invalidJsonPath, "{ invalid json content }");
    });

    afterEach(() => {
      // テストファイルのクリーンアップ
      if (fs.existsSync(invalidJsonPath)) {
        fs.unlinkSync(invalidJsonPath);
      }
    });

    it("不正なJSONファイルの場合にデフォルト値を使用する", async () => {
      const fallbackServiceWithInvalidJson = new AttackTypeFallbackService(
        invalidJsonPath
      );
      const dataMapperWithInvalidJson = new DataMapper(
        fallbackServiceWithInvalidJson
      );

      // フォールバック機能を使用しようとした場合
      const result = dataMapperWithInvalidJson.mapAttackType("", "28");

      // デフォルト値が返されることを確認
      expect(result).toBe("strike");
    });

    it("JSON解析エラー時にエラーログが出力される", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      try {
        const fallbackServiceWithInvalidJson = new AttackTypeFallbackService(
          invalidJsonPath
        );

        // 初期化を試行
        await fallbackServiceWithInvalidJson.initialize();

        // エラーログが出力されることを確認
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining("list.json の解析に失敗しました")
        );
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it("JSON解析エラーでもシステムが継続動作する", async () => {
      const fallbackServiceWithInvalidJson = new AttackTypeFallbackService(
        invalidJsonPath
      );
      const dataMapperWithInvalidJson = new DataMapper(
        fallbackServiceWithInvalidJson
      );
      const characterGeneratorWithInvalidJson = new CharacterGenerator(
        dataMapperWithInvalidJson
      );

      const mockProcessedData = {
        id: "28",
        name: { ja: "フォン・ライカン", en: "Von Lycaon" },
        fullName: { ja: "フォン・ライカン", en: "Von Lycaon" },
        specialty: "stun" as const,
        stats: "ice" as const,
        attackType: undefined,
        faction: {
          id: 2,
          name: { ja: "ヴィクトリア家政", en: "Victoria Housekeeping" },
        },
        rarity: "S" as const,
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

      // エラーを発生させずに処理が完了することを確認
      await expect(
        characterGeneratorWithInvalidJson.generateCharacter(
          mockProcessedData,
          "28"
        )
      ).resolves.not.toThrow();

      const result = await characterGeneratorWithInvalidJson.generateCharacter(
        mockProcessedData,
        "28"
      );
      expect(result.attackType).toBe("strike"); // デフォルト値
    });
  });

  describe("未知の攻撃タイプ値の処理", () => {
    const unknownAttackTypeJsonPath = "json/data/unknown-attack-type-list.json";

    // 未知の攻撃タイプを含むテストデータ
    const mockListDataWithUnknownType = {
      retcode: 0,
      message: "OK",
      data: {
        list: [
          {
            entry_page_id: "999",
            name: "Unknown Character",
            filter_values: {
              agent_attack_type: {
                values: ["UnknownType"],
                value_types: [
                  {
                    id: "99",
                    value: "UnknownType",
                    enum_string: "unknown",
                  },
                ],
              },
            },
          },
        ],
      },
    };

    beforeEach(() => {
      // 未知の攻撃タイプを含むJSONファイルを作成
      const testDir = path.dirname(unknownAttackTypeJsonPath);
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      fs.writeFileSync(
        unknownAttackTypeJsonPath,
        JSON.stringify(mockListDataWithUnknownType, null, 2)
      );
    });

    afterEach(() => {
      // テストファイルのクリーンアップ
      if (fs.existsSync(unknownAttackTypeJsonPath)) {
        fs.unlinkSync(unknownAttackTypeJsonPath);
      }
    });

    it("未知の攻撃タイプの場合にデフォルト値を使用する", async () => {
      const fallbackServiceWithUnknownType = new AttackTypeFallbackService(
        unknownAttackTypeJsonPath
      );
      const dataMapperWithUnknownType = new DataMapper(
        fallbackServiceWithUnknownType
      );

      // 未知の攻撃タイプのキャラクターを検索
      const result = dataMapperWithUnknownType.mapAttackType("", "999");

      // デフォルト値が返されることを確認
      expect(result).toBe("strike");
    });

    it("未知の攻撃タイプ時に警告ログが出力される", async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      try {
        const fallbackServiceWithUnknownType = new AttackTypeFallbackService(
          unknownAttackTypeJsonPath
        );
        const dataMapperWithUnknownType = new DataMapper(
          fallbackServiceWithUnknownType
        );

        // 未知の攻撃タイプのキャラクターを検索
        dataMapperWithUnknownType.mapAttackType("", "999");

        // 警告ログが出力されることを確認
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining("未知の攻撃タイプ値")
        );
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining("UnknownType")
        );
      } finally {
        consoleWarnSpy.mockRestore();
      }
    });

    it("未知の攻撃タイプでもシステムが継続動作する", async () => {
      const fallbackServiceWithUnknownType = new AttackTypeFallbackService(
        unknownAttackTypeJsonPath
      );
      const dataMapperWithUnknownType = new DataMapper(
        fallbackServiceWithUnknownType
      );
      const characterGeneratorWithUnknownType = new CharacterGenerator(
        dataMapperWithUnknownType
      );

      const mockProcessedData = {
        id: "999",
        name: { ja: "未知キャラクター", en: "Unknown Character" },
        fullName: { ja: "未知キャラクター", en: "Unknown Character" },
        specialty: "attack" as const,
        stats: "physical" as const,
        attackType: undefined,
        faction: { id: 1, name: { ja: "テスト陣営", en: "Test Faction" } },
        rarity: "A" as const,
        attr: {
          hp: [500, 1000, 1500, 2000, 2500, 3000, 3500],
          atk: [100, 150, 200, 250, 300, 350, 400],
          def: [50, 100, 150, 200, 250, 300, 350],
          impact: 100,
          critRate: 5,
          critDmg: 50,
          anomalyMastery: 0,
          anomalyProficiency: 0,
          penRatio: 0,
          energy: 1.0,
        },
      };

      // エラーを発生させずに処理が完了することを確認
      await expect(
        characterGeneratorWithUnknownType.generateCharacter(
          mockProcessedData,
          "999"
        )
      ).resolves.not.toThrow();

      const result = await characterGeneratorWithUnknownType.generateCharacter(
        mockProcessedData,
        "999"
      );
      expect(result.attackType).toBe("strike"); // デフォルト値
    });
  });

  describe("システム継続動作の確認", () => {
    it("複数のエラーケースが発生してもシステムが動作し続ける", async () => {
      // 複数のエラーケースを組み合わせたテスト
      const errors: string[] = [];
      const originalConsoleError = console.error;
      const originalConsoleWarn = console.warn;

      // エラーログを収集
      console.error = (message: string) => errors.push(message);
      console.warn = (message: string) => errors.push(message);

      try {
        // 1. 存在しないファイルでサービスを作成
        const nonExistentService = new AttackTypeFallbackService(
          "non-existent.json"
        );
        const nonExistentMapper = new DataMapper(nonExistentService);

        // 2. 不正なJSONファイルでサービスを作成
        const invalidJsonPath = "json/data/temp-invalid.json";
        const testDir = path.dirname(invalidJsonPath);
        if (!fs.existsSync(testDir)) {
          fs.mkdirSync(testDir, { recursive: true });
        }
        fs.writeFileSync(invalidJsonPath, "{ invalid }");

        const invalidJsonService = new AttackTypeFallbackService(
          invalidJsonPath
        );
        const invalidJsonMapper = new DataMapper(invalidJsonService);

        // 3. 複数のマッピング処理を実行
        const results = [
          nonExistentMapper.mapAttackType("", "28"),
          nonExistentMapper.mapAttackType("", "123"),
          invalidJsonMapper.mapAttackType("", "28"),
          invalidJsonMapper.mapAttackType("", "999"),
        ];

        // すべてデフォルト値が返されることを確認
        results.forEach((result) => {
          expect(result).toBe("strike");
        });

        // エラーログが記録されていることを確認
        expect(errors.length).toBeGreaterThan(0);

        // クリーンアップ
        if (fs.existsSync(invalidJsonPath)) {
          fs.unlinkSync(invalidJsonPath);
        }
      } finally {
        // ログ関数を復元
        console.error = originalConsoleError;
        console.warn = originalConsoleWarn;
      }
    });

    it("エラー発生後も正常なデータ処理が可能", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      try {
        // 1. エラーケースを実行
        const nonExistentService = new AttackTypeFallbackService(
          "non-existent.json"
        );
        const nonExistentMapper = new DataMapper(nonExistentService);
        const errorResult = nonExistentMapper.mapAttackType("", "28");
        expect(errorResult).toBe("strike");

        // 2. 正常なケースを実行
        const normalService = new AttackTypeFallbackService(testListJsonPath);
        const normalMapper = new DataMapper(normalService);
        const normalResult = normalMapper.mapAttackType("", "28");
        expect(normalResult).toBe("strike");

        // 3. wiki データからの正常取得も動作することを確認
        const wikiResult = normalMapper.mapAttackType("打撃", "28");
        expect(wikiResult).toBe("strike");
      } finally {
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
      }
    });
  });
});
