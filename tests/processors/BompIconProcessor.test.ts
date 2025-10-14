import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BompIconProcessor } from "../../src/processors/BompIconProcessor";
import { HoyoLabApiClient } from "../../src/clients/HoyoLabApiClient";
import { BompEntry } from "../../src/types";
import { BompIconConfig } from "../../src/types/processing";
import { promises as fs } from "fs";
import path from "path";

// モック設定
vi.mock("../../src/clients/HoyoLabApiClient");
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

vi.mock("../../src/utils/Logger", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  LogMessages: {
    BOMP_ICON_PROCESSING_START: "ボンプアイコン処理開始",
    BOMP_ICON_PROCESSING_SUCCESS: "ボンプアイコン処理完了",
    BOMP_ICON_PROCESSING_ERROR: "ボンプアイコン処理エラー",
    BOMP_ICON_PROCESSING_RETRY: "ボンプアイコン処理リトライ",
    BOMP_ICON_PROCESSING_FINAL_FAILURE: "ボンプアイコン処理最終失敗",
    BOMP_ICON_URL_EXTRACTION_START: "アイコンURL抽出開始",
    BOMP_ICON_URL_EXTRACTION_SUCCESS: "アイコンURL抽出成功",
    BOMP_ICON_URL_EXTRACTION_ERROR: "アイコンURL抽出エラー",
    BOMP_ICON_URL_NOT_FOUND: "アイコンURLが見つかりません",
    BOMP_ICON_URL_INVALID: "無効なアイコンURL",
    BOMP_ICON_DOWNLOAD_START: "アイコンダウンロード開始",
    BOMP_ICON_DOWNLOAD_SUCCESS: "アイコンダウンロード完了",
    BOMP_ICON_DOWNLOAD_ERROR: "アイコンダウンロードエラー",
    BOMP_ICON_VALIDATION_START: "アイコンファイル検証開始",
    BOMP_ICON_VALIDATION_SUCCESS: "アイコンファイル検証成功",
    BOMP_ICON_VALIDATION_ERROR: "アイコンファイル検証エラー",
    BOMP_ICON_FILE_EXISTS: "既存ファイルをスキップ",
    BOMP_ICON_DIRECTORY_CREATED: "ディレクトリを作成しました",
    BOMP_ICON_SECURITY_VALIDATION_ERROR: "セキュリティ検証に失敗",
    BOMP_ICON_CONTENT_TYPE_INVALID: "無効なコンテンツタイプ",
  },
}));

describe("BompIconProcessor", () => {
  let processor: BompIconProcessor;
  let mockApiClient: vi.Mocked<HoyoLabApiClient>;
  let config: BompIconConfig;

  const mockBompEntry: BompEntry = {
    id: "excaliboo",
    pageId: 912,
    wikiUrl: "https://wiki.hoyolab.com/pc/zzz/entry/912",
    jaName: "セイケンボンプ",
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
      (fileName) => fileName
    );

    mockApiClient = vi.mocked(new HoyoLabApiClient());
    config = {
      outputDirectory: "assets/images/bomps",
      maxConcurrency: 3,
      retryAttempts: 3,
      retryDelayMs: 1000,
      requestDelayMs: 500,
      skipExisting: true,
      validateDownloads: true,
      maxFileSizeMB: 10,
      allowedExtensions: [".png", ".jpg", ".jpeg", ".webp"],
      strictSecurity: true,
    };

    processor = new BompIconProcessor(mockApiClient, config);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("extractIconUrl", () => {
    it("正常なAPIレスポンスからアイコンURLを抽出できる", () => {
      const mockApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "912",
            name: "セイケンボンプ",
            icon_url:
              "https://act-upload.hoyoverse.com/event-ugc-hoyowiki/2025/09/07/59155606/52983421a01aba057aa9b9b5867bf77e_5531867362809073662.png",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [],
          },
        },
      };

      const result = processor.extractIconUrl(mockApiResponse);

      expect(result).toBe(
        "https://act-upload.hoyoverse.com/event-ugc-hoyowiki/2025/09/07/59155606/52983421a01aba057aa9b9b5867bf77e_5531867362809073662.png"
      );
    });

    it("icon_urlが存在しない場合はnullを返す", () => {
      const mockApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "912",
            name: "セイケンボンプ",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [],
          },
        },
      };

      const result = processor.extractIconUrl(mockApiResponse);

      expect(result).toBeNull();
    });

    it("無効なドメインのURLの場合はnullを返す", () => {
      const mockApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "912",
            name: "セイケンボンプ",
            icon_url: "https://malicious-site.com/image.png",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [],
          },
        },
      };

      const result = processor.extractIconUrl(mockApiResponse);

      expect(result).toBeNull();
    });
  });

  describe("generateLocalPath", () => {
    it("ボンプIDから正しいローカルパスを生成する", () => {
      const result = processor.generateLocalPath("excaliboo");
      const expected = path.join("assets/images/bomps", "excaliboo.png");

      expect(result).toBe(expected);
    });

    it("特殊文字を含むボンプIDをサニタイズする", () => {
      const result = processor.generateLocalPath("test@#$%bomp");
      const expected = path.join("assets/images/bomps", "testbomp.png");

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
      const mockStats = {
        size: 0,
        isFile: () => true,
      };

      vi.mocked(fs.stat).mockResolvedValue(mockStats as any);

      const result = await processor.validateIconFile("/path/to/file.png");

      expect(result).toBe(false);
    });

    it("ファイルサイズが大きすぎる場合はfalseを返す", async () => {
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
    it("セキュリティ検証に失敗した場合はエラーをスローする", async () => {
      const mockApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "912",
            name: "セイケンボンプ",
            icon_url: "https://malicious-site.com/image.png", // 無効なドメイン
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [],
          },
        },
      };

      mockApiClient.fetchCharacterData.mockResolvedValue(mockApiResponse);

      const result = await processor.processBompIcon(mockBompEntry);

      expect(result.success).toBe(false);
      expect(result.error).toContain("アイコン URL が見つかりません");
    }, 10000); // タイムアウトを10秒に延長

    it("ディレクトリトラバーサル攻撃を防ぐ", () => {
      // SecurityValidatorがファイル名をサニタイズするため、通常は安全になる
      // しかし、明示的に危険なパスを作成してテストする
      const result = processor.generateLocalPath("../../../etc/passwd");
      const expected = path.join("assets/images/bomps", "etcpasswd.png");

      expect(result).toBe(expected);
    });

    it("HTTPプロトコルのURLを拒否する", () => {
      const mockApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "912",
            name: "セイケンボンプ",
            icon_url: "http://act-upload.hoyoverse.com/image.png", // HTTP
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [],
          },
        },
      };

      const result = processor.extractIconUrl(mockApiResponse);

      expect(result).toBeNull();
    });

    it("画像以外の拡張子を持つURLを拒否する", () => {
      const mockApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "912",
            name: "セイケンボンプ",
            icon_url: "https://act-upload.hoyoverse.com/malicious.exe",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [],
          },
        },
      };

      const result = processor.extractIconUrl(mockApiResponse);

      expect(result).toBeNull();
    });

    it("ファイル名の特殊文字をサニタイズする", () => {
      const dangerousName = 'test<>:"/\\|?*file';
      const result = processor.generateLocalPath(dangerousName);
      const expected = path.join("assets/images/bomps", "testfile.png");

      expect(result).toBe(expected);
    });

    it("Windows予約語を安全な名前に変換する", () => {
      const reservedName = "CON";
      const result = processor.generateLocalPath(reservedName);
      const expected = path.join("assets/images/bomps", "safe_CON.png");

      expect(result).toBe(expected);
    });
  });
});
