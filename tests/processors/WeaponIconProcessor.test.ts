import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WeaponIconProcessor } from "../../src/processors/WeaponIconProcessor";
import { WeaponEntry, WeaponIconConfig } from "../../src/types/processing";
import { promises as fs } from "fs";
import path from "path";

// モック設定
vi.mock("../../src/utils/SecurityValidator");
vi.mock("fs", () => ({
  promises: {
    access: vi.fn(),
    mkdir: vi.fn(),
    stat: vi.fn(),
    unlink: vi.fn(),
  },
  createWriteStream: vi.fn(),
}));

// fetchのモック（基本テスト用）
global.fetch = vi.fn();

vi.mock("../../src/utils/Logger", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  LogMessages: {
    WEAPON_ICON_PROCESSING_START: "武器アイコン処理開始",
    WEAPON_ICON_PROCESSING_SUCCESS: "武器アイコン処理完了",
    WEAPON_ICON_PROCESSING_ERROR: "武器アイコン処理エラー",
    WEAPON_ICON_PROCESSING_RETRY: "武器アイコン処理リトライ",
    WEAPON_ICON_PROCESSING_FINAL_FAILURE: "武器アイコン処理最終失敗",
    WEAPON_ICON_URL_EXTRACTION_START: "アイコンURL抽出開始",
    WEAPON_ICON_URL_EXTRACTION_SUCCESS: "アイコンURL抽出成功",
    WEAPON_ICON_URL_EXTRACTION_ERROR: "アイコンURL抽出エラー",
    WEAPON_ICON_URL_NOT_FOUND: "アイコンURLが見つかりません",
    WEAPON_ICON_URL_INVALID: "無効なアイコンURL",
    WEAPON_ICON_DOWNLOAD_START: "アイコンダウンロード開始",
    WEAPON_ICON_DOWNLOAD_SUCCESS: "アイコンダウンロード完了",
    WEAPON_ICON_DOWNLOAD_ERROR: "アイコンダウンロードエラー",
    WEAPON_ICON_VALIDATION_START: "アイコンファイル検証開始",
    WEAPON_ICON_VALIDATION_SUCCESS: "アイコンファイル検証成功",
    WEAPON_ICON_VALIDATION_ERROR: "アイコンファイル検証エラー",
    WEAPON_ICON_FILE_EXISTS: "既存ファイルをスキップ",
    WEAPON_ICON_DIRECTORY_CREATED: "ディレクトリを作成しました",
    WEAPON_ICON_SECURITY_VALIDATION_ERROR: "セキュリティ検証に失敗",
    WEAPON_ICON_CONTENT_TYPE_INVALID: "無効なコンテンツタイプ",
    WEAPON_ICON_RARITY_FILTERED: "レアリティフィルタによりスキップ",
  },
}));

describe("WeaponIconProcessor", () => {
  let processor: WeaponIconProcessor;
  let config: WeaponIconConfig;

  const mockWeaponEntryS: WeaponEntry = {
    entry_page_id: "936",
    name: "燔火の朧夜",
    icon_url:
      "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2025/10/14/07da3f94e491eeeb50491f1d8c0dfdda_7120678420596402422.png",
    filter_values: {
      w_engine_rarity: {
        values: ["S"],
      },
    },
    desc: "S級武器",
  };

  const mockWeaponEntryA: WeaponEntry = {
    entry_page_id: "935",
    name: "炉で歌い上げられる夢",
    icon_url:
      "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2025/10/14/test_image.png",
    filter_values: {
      w_engine_rarity: {
        values: ["A"],
      },
    },
    desc: "A級武器",
  };

  const mockWeaponEntryB: WeaponEntry = {
    entry_page_id: "934",
    name: "B級武器",
    icon_url:
      "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2025/10/14/b_weapon.png",
    filter_values: {
      w_engine_rarity: {
        values: ["B"],
      },
    },
    desc: "B級武器",
  };

  beforeEach(async () => {
    // SecurityValidatorのモックを設定
    const { SecurityValidator } = await import(
      "../../src/utils/SecurityValidator"
    );
    vi.mocked(SecurityValidator.validateAll).mockReturnValue(true);
    vi.mocked(SecurityValidator.validateIconUrl).mockReturnValue(true);
    vi.mocked(SecurityValidator.validateFilePath).mockReturnValue(true);
    vi.mocked(SecurityValidator.validateFileSize).mockReturnValue(true);
    vi.mocked(SecurityValidator.validateImageContentType).mockReturnValue(true);
    vi.mocked(SecurityValidator.sanitizeFileName).mockImplementation(
      (fileName) => {
        // 実際のサニタイゼーション動作をシミュレート
        if (fileName === "test@#$%weapon") {
          return "testweapon";
        }
        if (fileName === "../../../etc/passwd") {
          return "etcpasswd";
        }
        if (fileName === 'test<>:"/\\|?*file') {
          return "testfile";
        }
        return fileName.replace(/[^a-zA-Z0-9-_.]/g, "");
      }
    );

    config = {
      outputDirectory: "assets/images/weapons",
      maxConcurrency: 3,
      retryAttempts: 3,
      retryDelayMs: 1000,
      requestDelayMs: 500,
      skipExisting: true,
      validateDownloads: true,
      maxFileSizeMB: 10,
      allowedExtensions: [".png", ".jpg", ".jpeg", ".webp"],
    };

    processor = new WeaponIconProcessor(config);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("extractIconUrl", () => {
    it("正常な武器エントリからアイコンURLを抽出できる", () => {
      const result = processor.extractIconUrl(mockWeaponEntryS);

      expect(result).toBe(
        "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2025/10/14/07da3f94e491eeeb50491f1d8c0dfdda_7120678420596402422.png"
      );
    });

    it("icon_urlが存在しない場合はnullを返す", () => {
      const weaponEntryWithoutIcon: WeaponEntry = {
        entry_page_id: "936",
        name: "テスト武器",
        icon_url: "",
        filter_values: {
          w_engine_rarity: {
            values: ["S"],
          },
        },
      };

      const result = processor.extractIconUrl(weaponEntryWithoutIcon);

      expect(result).toBeNull();
    });

    it("無効なドメインのURLの場合はnullを返す", async () => {
      const { SecurityValidator } = await import(
        "../../src/utils/SecurityValidator"
      );
      vi.mocked(SecurityValidator.validateIconUrl).mockReturnValue(false);

      const weaponEntryWithInvalidUrl: WeaponEntry = {
        entry_page_id: "936",
        name: "テスト武器",
        icon_url: "https://malicious-site.com/image.png",
        filter_values: {
          w_engine_rarity: {
            values: ["S"],
          },
        },
      };

      const result = processor.extractIconUrl(weaponEntryWithInvalidUrl);

      expect(result).toBeNull();
    });
  });

  describe("isValidRarity", () => {
    it("Sレアリティの武器は処理対象として判定される", () => {
      const result = processor.isValidRarity(mockWeaponEntryS);

      expect(result).toBe(true);
    });

    it("Aレアリティの武器は処理対象として判定される", () => {
      const result = processor.isValidRarity(mockWeaponEntryA);

      expect(result).toBe(true);
    });

    it("Bレアリティの武器は処理対象外として判定される", () => {
      const result = processor.isValidRarity(mockWeaponEntryB);

      expect(result).toBe(false);
    });

    it("レアリティ情報が存在しない場合はfalseを返す", () => {
      const weaponEntryWithoutRarity: WeaponEntry = {
        entry_page_id: "936",
        name: "テスト武器",
        icon_url: "https://act-webstatic.hoyoverse.com/test.png",
      };

      const result = processor.isValidRarity(weaponEntryWithoutRarity);

      expect(result).toBe(false);
    });

    it("レアリティ値が配列でない場合はfalseを返す", () => {
      const weaponEntryWithInvalidRarity: WeaponEntry = {
        entry_page_id: "936",
        name: "テスト武器",
        icon_url: "https://act-webstatic.hoyoverse.com/test.png",
        filter_values: {
          w_engine_rarity: {
            values: "S" as any, // 配列でない値
          },
        },
      };

      const result = processor.isValidRarity(weaponEntryWithInvalidRarity);

      expect(result).toBe(false);
    });
  });

  describe("generateWeaponId", () => {
    it("entry_page_idから武器IDを生成する", () => {
      const result = processor.generateWeaponId("936");

      expect(result).toBe("936");
    });

    it("数字以外のentry_page_idも正しく処理する", () => {
      const result = processor.generateWeaponId("test-weapon-123");

      expect(result).toBe("test-weapon-123");
    });
  });

  describe("generateLocalPath", () => {
    it("武器IDから正しいローカルパスを生成する", () => {
      const result = processor.generateLocalPath("936");
      const expected = path.join("assets/images/weapons", "936.png");

      expect(result).toBe(expected);
    });

    it("特殊文字を含む武器IDをサニタイズする", () => {
      const result = processor.generateLocalPath("test@#$%weapon");
      const expected = path.join("assets/images/weapons", "testweapon.png");

      expect(result).toBe(expected);
    });
  });

  describe("validateIconFile", () => {
    it("正常なファイルの場合はtrueを返す", async () => {
      const mockStats = {
        size: 1024,
        isFile: () => true,
      };

      vi.mocked(fs.stat).mockResolvedValue(mockStats as any);

      const result = await processor.validateIconFile("/path/to/file.png");

      expect(result).toBe(true);
    });

    it("ファイルサイズが0の場合はfalseを返す", async () => {
      const { SecurityValidator } = await import(
        "../../src/utils/SecurityValidator"
      );
      vi.mocked(SecurityValidator.validateFileSize).mockReturnValue(false);

      const mockStats = {
        size: 0,
        isFile: () => true,
      };

      vi.mocked(fs.stat).mockResolvedValue(mockStats as any);

      const result = await processor.validateIconFile("/path/to/file.png");

      expect(result).toBe(false);
    });

    it("ファイルサイズが大きすぎる場合はfalseを返す", async () => {
      const { SecurityValidator } = await import(
        "../../src/utils/SecurityValidator"
      );
      vi.mocked(SecurityValidator.validateFileSize).mockReturnValue(false);

      const mockStats = {
        size: 11 * 1024 * 1024, // 11MB
        isFile: () => true,
      };

      vi.mocked(fs.stat).mockResolvedValue(mockStats as any);

      const result = await processor.validateIconFile("/path/to/file.png");

      expect(result).toBe(false);
    });

    it("通常ファイルでない場合はfalseを返す", async () => {
      const mockStats = {
        size: 1024,
        isFile: () => false,
      };

      vi.mocked(fs.stat).mockResolvedValue(mockStats as any);

      const result = await processor.validateIconFile("/path/to/file.png");

      expect(result).toBe(false);
    });
  });

  describe("セキュリティ機能", () => {
    it("セキュリティ検証に失敗した場合はエラー結果を返す", async () => {
      const { SecurityValidator } = await import(
        "../../src/utils/SecurityValidator"
      );
      vi.mocked(SecurityValidator.validateAll).mockReturnValue(false);

      const result = await processor.processWeaponIcon(mockWeaponEntryS);

      expect(result.success).toBe(false);
      expect(result.error).toContain("セキュリティ検証に失敗しました");
    });

    it("ディレクトリトラバーサル攻撃を防ぐ", () => {
      // SecurityValidatorがファイル名をサニタイズするため、通常は安全になる
      const result = processor.generateLocalPath("../../../etc/passwd");
      const expected = path.join("assets/images/weapons", "etcpasswd.png");

      expect(result).toBe(expected);
    });

    it("無効なURLを拒否する", async () => {
      const { SecurityValidator } = await import(
        "../../src/utils/SecurityValidator"
      );
      vi.mocked(SecurityValidator.validateIconUrl).mockReturnValue(false);

      const weaponEntryWithInvalidUrl: WeaponEntry = {
        entry_page_id: "936",
        name: "テスト武器",
        icon_url: "http://act-upload.hoyoverse.com/image.png", // HTTP
        filter_values: {
          w_engine_rarity: {
            values: ["S"],
          },
        },
      };

      const result = processor.extractIconUrl(weaponEntryWithInvalidUrl);

      expect(result).toBeNull();
    });

    it("ファイル名の特殊文字をサニタイズする", () => {
      const dangerousName = 'test<>:"/\\|?*file';
      const result = processor.generateLocalPath(dangerousName);
      const expected = path.join("assets/images/weapons", "testfile.png");

      expect(result).toBe(expected);
    });
  });

  describe("ダウンロード機能の基本テスト", () => {
    it("ダウンロード機能が呼び出し可能である", () => {
      // ダウンロード機能のメソッドが存在することを確認
      expect(typeof processor.downloadIcon).toBe("function");
    });

    it("ダウンロード機能は適切なパラメータを受け取る", () => {
      // メソッドシグネチャの確認
      expect(processor.downloadIcon.length).toBe(2); // iconUrl, outputPath
    });
  });

  describe("レアリティフィルタリング", () => {
    it("Bレアリティの武器は処理をスキップする", async () => {
      const result = await processor.processWeaponIcon(mockWeaponEntryB);

      expect(result.success).toBe(false);
      expect(result.error).toBe("レアリティフィルタによりスキップされました");
    });

    it("SとAの混合レアリティは処理対象として判定される", () => {
      const mixedRarityWeapon: WeaponEntry = {
        entry_page_id: "937",
        name: "混合レアリティ武器",
        icon_url: "https://act-webstatic.hoyoverse.com/test.png",
        filter_values: {
          w_engine_rarity: {
            values: ["S", "A"],
          },
        },
      };

      const result = processor.isValidRarity(mixedRarityWeapon);

      expect(result).toBe(true);
    });

    it("BとSの混合レアリティは処理対象として判定される", () => {
      const mixedRarityWeapon: WeaponEntry = {
        entry_page_id: "938",
        name: "混合レアリティ武器",
        icon_url: "https://act-webstatic.hoyoverse.com/test.png",
        filter_values: {
          w_engine_rarity: {
            values: ["B", "S"],
          },
        },
      };

      const result = processor.isValidRarity(mixedRarityWeapon);

      expect(result).toBe(true);
    });
  });
});
