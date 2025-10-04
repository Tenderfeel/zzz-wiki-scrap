import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, readFileSync } from "fs";
import { AttackTypeFallbackService } from "../../src/services/AttackTypeFallbackService.js";
import { ListJsonData } from "../../src/types/index.js";

// fsモジュールをモック化
vi.mock("fs");

describe("AttackTypeFallbackService", () => {
  let service: AttackTypeFallbackService;
  let mockExistsSync: any;
  let mockReadFileSync: any;
  let consoleInfoSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;
  let consoleDebugSpy: any;

  // テスト用のモックデータ
  const mockListData: ListJsonData = {
    retcode: 0,
    message: "OK",
    data: {
      list: [
        {
          entry_page_id: "28",
          name: "Von Lycaon",
          icon_url: "https://example.com/lycaon.png",
          display_field: {
            materials: "test",
          },
          filter_values: {
            agent_attack_type: {
              values: ["Strike"],
              value_types: [
                {
                  id: "15",
                  value: "Strike",
                  mi18n_key: "strike_key",
                  icon: "strike_icon",
                  enum_string: "strike",
                },
              ],
              key: null,
            },
          },
          desc: "Test character",
        },
        {
          entry_page_id: "29",
          name: "Anby Demara",
          icon_url: "https://example.com/anby.png",
          display_field: {
            materials: "test",
          },
          filter_values: {
            agent_attack_type: {
              values: ["Slash"],
              value_types: [
                {
                  id: "13",
                  value: "Slash",
                  mi18n_key: "slash_key",
                  icon: "slash_icon",
                  enum_string: "slash",
                },
              ],
              key: null,
            },
          },
          desc: "Test character",
        },
        {
          entry_page_id: "30",
          name: "Nicole Demara",
          icon_url: "https://example.com/nicole.png",
          display_field: {
            materials: "test",
          },
          filter_values: {
            agent_attack_type: {
              values: ["Pierce"],
              value_types: [
                {
                  id: "14",
                  value: "Pierce",
                  mi18n_key: "pierce_key",
                  icon: "pierce_icon",
                  enum_string: "pierce",
                },
              ],
              key: null,
            },
          },
          desc: "Test character",
        },
        {
          entry_page_id: "31",
          name: "Multiple Attack Types",
          icon_url: "https://example.com/multiple.png",
          display_field: {
            materials: "test",
          },
          filter_values: {
            agent_attack_type: {
              values: ["Slash", "Pierce"],
              value_types: [
                {
                  id: "13",
                  value: "Slash",
                  mi18n_key: "slash_key",
                  icon: "slash_icon",
                  enum_string: "slash",
                },
                {
                  id: "14",
                  value: "Pierce",
                  mi18n_key: "pierce_key",
                  icon: "pierce_icon",
                  enum_string: "pierce",
                },
              ],
              key: null,
            },
          },
          desc: "Test character",
        },
        {
          entry_page_id: "32",
          name: "No Attack Type",
          icon_url: "https://example.com/no_attack.png",
          display_field: {
            materials: "test",
          },
          filter_values: {},
          desc: "Test character",
        },
        {
          entry_page_id: "33",
          name: "Unknown Attack Type",
          icon_url: "https://example.com/unknown.png",
          display_field: {
            materials: "test",
          },
          filter_values: {
            agent_attack_type: {
              values: ["Unknown"],
              value_types: [
                {
                  id: "99",
                  value: "Unknown",
                  mi18n_key: "unknown_key",
                  icon: "unknown_icon",
                  enum_string: "unknown",
                },
              ],
              key: null,
            },
          },
          desc: "Test character",
        },
      ],
    },
  };

  beforeEach(() => {
    service = new AttackTypeFallbackService();
    mockExistsSync = vi.mocked(existsSync);
    mockReadFileSync = vi.mocked(readFileSync);

    // コンソールメソッドをスパイ化
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe("initialize", () => {
    it("正常にlist.jsonファイルを読み込んで初期化する", async () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockListData));

      // Act
      await service.initialize();

      // Assert
      expect(mockExistsSync).toHaveBeenCalledWith(
        expect.stringContaining("json/data/list.json")
      );
      expect(mockReadFileSync).toHaveBeenCalledWith(
        expect.stringContaining("json/data/list.json"),
        "utf-8"
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        "[INFO] AttackTypeFallbackService initialized with 6 characters"
      );
    });

    it("ファイルが存在しない場合は警告を出力して初期化を完了する", async () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);

      // Act
      await service.initialize();

      // Assert
      expect(mockExistsSync).toHaveBeenCalledWith(
        expect.stringContaining("json/data/list.json")
      );
      expect(mockReadFileSync).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[WARN] list.json file not found at:")
      );
    });

    it("JSON解析エラーが発生した場合はエラーを出力して初期化を完了する", async () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue("invalid json");

      // Act
      await service.initialize();

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "[ERROR] Failed to initialize AttackTypeFallbackService:"
        )
      );
    });

    it("無効なデータ構造の場合はエラーを出力する", async () => {
      // Arrange
      const invalidData = { retcode: 0, message: "OK", data: {} };
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidData));

      // Act
      await service.initialize();

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Invalid list.json structure: missing data.list array"
        )
      );
    });

    it("既に初期化済みの場合は何もしない", async () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockListData));

      // Act - 2回初期化を実行
      await service.initialize();
      await service.initialize();

      // Assert - ファイル読み込みは1回だけ実行される
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("getAttackTypeByPageId", () => {
    beforeEach(async () => {
      // 正常なデータで初期化
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockListData));
      await service.initialize();
    });

    it("存在するページIDに対して正しい攻撃タイプを返す - Strike", () => {
      // Act
      const result = service.getAttackTypeByPageId("28");

      // Assert
      expect(result).toBe("strike");
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        "[DEBUG] Found attack type for Von Lycaon (pageId: 28): Strike"
      );
    });

    it("存在するページIDに対して正しい攻撃タイプを返す - Slash", () => {
      // Act
      const result = service.getAttackTypeByPageId("29");

      // Assert
      expect(result).toBe("slash");
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        "[DEBUG] Found attack type for Anby Demara (pageId: 29): Slash"
      );
    });

    it("存在するページIDに対して正しい攻撃タイプを返す - Pierce", () => {
      // Act
      const result = service.getAttackTypeByPageId("30");

      // Assert
      expect(result).toBe("pierce");
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        "[DEBUG] Found attack type for Nicole Demara (pageId: 30): Pierce"
      );
    });

    it("複数の攻撃タイプがある場合は最初の値を返す", () => {
      // Act
      const result = service.getAttackTypeByPageId("31");

      // Assert
      expect(result).toBe("slash");
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        "[DEBUG] Found attack type for Multiple Attack Types (pageId: 31): Slash"
      );
    });

    it("存在しないページIDの場合はnullを返す", () => {
      // Act
      const result = service.getAttackTypeByPageId("999");

      // Assert
      expect(result).toBeNull();
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        "[DEBUG] Character not found in list.json for pageId: 999"
      );
    });

    it("攻撃タイプデータが存在しない場合はnullを返す", () => {
      // Act
      const result = service.getAttackTypeByPageId("32");

      // Assert
      expect(result).toBeNull();
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        "[DEBUG] No attack type data found for character: No Attack Type (pageId: 32)"
      );
    });

    it("未知の攻撃タイプの場合は警告を出力してデフォルト値を返す", () => {
      // Act
      const result = service.getAttackTypeByPageId("33");

      // Assert
      expect(result).toBe("strike");
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[WARN] Unknown attack type value: "Unknown", using default: strike'
      );
    });

    it("初期化されていない場合はnullを返す", () => {
      // Arrange - 新しいサービスインスタンス（初期化されていない）
      const uninitializedService = new AttackTypeFallbackService();

      // Act
      const result = uninitializedService.getAttackTypeByPageId("28");

      // Assert
      expect(result).toBeNull();
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        "[DEBUG] AttackTypeFallbackService not available for pageId: 28"
      );
    });

    it("初期化に失敗した場合はnullを返す", async () => {
      // Arrange - 初期化に失敗するサービス
      const failedService = new AttackTypeFallbackService();
      mockExistsSync.mockReturnValue(false);
      await failedService.initialize();

      // Act
      const result = failedService.getAttackTypeByPageId("28");

      // Assert
      expect(result).toBeNull();
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        "[DEBUG] AttackTypeFallbackService not available for pageId: 28"
      );
    });
  });

  describe("mapEnglishAttackType (private method testing via getAttackTypeByPageId)", () => {
    beforeEach(async () => {
      // 正常なデータで初期化
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockListData));
      await service.initialize();
    });

    it("Slashを正しくslashにマッピングする", () => {
      // Act
      const result = service.getAttackTypeByPageId("29");

      // Assert
      expect(result).toBe("slash");
    });

    it("Pierceを正しくpierceにマッピングする", () => {
      // Act
      const result = service.getAttackTypeByPageId("30");

      // Assert
      expect(result).toBe("pierce");
    });

    it("Strikeを正しくstrikeにマッピングする", () => {
      // Act
      const result = service.getAttackTypeByPageId("28");

      // Assert
      expect(result).toBe("strike");
    });

    it("未知の値の場合は警告を出力してデフォルト値strikeを返す", () => {
      // Act
      const result = service.getAttackTypeByPageId("33");

      // Assert
      expect(result).toBe("strike");
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[WARN] Unknown attack type value: "Unknown", using default: strike'
      );
    });
  });
});
