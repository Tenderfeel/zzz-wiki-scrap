import { describe, it, expect } from "vitest";
import { SecurityValidator } from "../../src/utils/SecurityValidator";
import path from "path";

describe("SecurityValidator", () => {
  describe("validateIconUrl", () => {
    it("有効なHoyoLabドメインのHTTPS URLを受け入れる", () => {
      const validUrls = [
        "https://act-upload.hoyoverse.com/event-ugc-hoyowiki/2025/09/07/test.png",
        "https://act-webstatic.hoyoverse.com/images/test.jpg",
        "https://upload-os-bbs.hoyolab.com/upload/test.webp",
        "https://webstatic-sea.hoyolab.com/static/test.jpeg",
        "https://webstatic.hoyoverse.com/assets/test.gif",
      ];

      validUrls.forEach((url) => {
        expect(SecurityValidator.validateIconUrl(url)).toBe(true);
      });
    });

    it("HTTPプロトコルのURLを拒否する", () => {
      const httpUrl = "http://act-upload.hoyoverse.com/test.png";
      expect(SecurityValidator.validateIconUrl(httpUrl)).toBe(false);
    });

    it("許可されていないドメインを拒否する", () => {
      const invalidUrls = [
        "https://malicious.com/test.png",
        "https://example.com/test.jpg",
        "https://fake-hoyoverse.com/test.webp",
      ];

      invalidUrls.forEach((url) => {
        expect(SecurityValidator.validateIconUrl(url)).toBe(false);
      });
    });

    it("画像拡張子でないURLを拒否する", () => {
      const nonImageUrls = [
        "https://act-upload.hoyoverse.com/test.txt",
        "https://act-upload.hoyoverse.com/test.exe",
        "https://act-upload.hoyoverse.com/test",
      ];

      nonImageUrls.forEach((url) => {
        expect(SecurityValidator.validateIconUrl(url)).toBe(false);
      });
    });

    it("無効なURLを拒否する", () => {
      const invalidUrls = [
        "not-a-url",
        "",
        "ftp://act-upload.hoyoverse.com/test.png",
      ];

      invalidUrls.forEach((url) => {
        expect(SecurityValidator.validateIconUrl(url)).toBe(false);
      });
    });

    it("パスが短すぎるまたは長すぎるURLを拒否する", () => {
      const shortPath = "https://act-upload.hoyoverse.com/";
      const longPath =
        "https://act-upload.hoyoverse.com/" + "a".repeat(500) + ".png";

      expect(SecurityValidator.validateIconUrl(shortPath)).toBe(false);
      expect(SecurityValidator.validateIconUrl(longPath)).toBe(false);
    });
  });

  describe("sanitizeFileName", () => {
    it("安全な文字のみを保持する", () => {
      expect(SecurityValidator.sanitizeFileName("test-file_123.png")).toBe(
        "test-file_123.png"
      );
      expect(SecurityValidator.sanitizeFileName("simple")).toBe("simple");
    });

    it("危険な文字を除去する", () => {
      expect(SecurityValidator.sanitizeFileName("test/file\\name")).toBe(
        "testfilename"
      );
      expect(SecurityValidator.sanitizeFileName("file<>name")).toBe("filename");
      expect(SecurityValidator.sanitizeFileName("file|name")).toBe("filename");
    });

    it("連続するピリオドを単一に変換する", () => {
      expect(SecurityValidator.sanitizeFileName("test..file")).toBe(
        "test.file"
      );
      expect(SecurityValidator.sanitizeFileName("test...file")).toBe(
        "test.file"
      );
    });

    it("先頭・末尾のピリオドやハイフンを除去する", () => {
      expect(SecurityValidator.sanitizeFileName(".test")).toBe("test");
      expect(SecurityValidator.sanitizeFileName("test.")).toBe("test");
      expect(SecurityValidator.sanitizeFileName("-test-")).toBe("test");
    });

    it("空の文字列や無効な入力に対してデフォルト値を返す", () => {
      expect(SecurityValidator.sanitizeFileName("")).toBe("unknown");
      expect(SecurityValidator.sanitizeFileName("...")).toBe("unknown");
      expect(SecurityValidator.sanitizeFileName(null as any)).toBe("unknown");
      expect(SecurityValidator.sanitizeFileName(undefined as any)).toBe(
        "unknown"
      );
    });

    it("長すぎるファイル名を切り詰める", () => {
      const longName = "a".repeat(150);
      const result = SecurityValidator.sanitizeFileName(longName);
      expect(result.length).toBe(100);
      expect(result).toBe("a".repeat(100));
    });

    it("Windows予約語に接頭辞を追加する", () => {
      const reservedNames = ["CON", "PRN", "AUX", "NUL", "COM1", "LPT1"];

      reservedNames.forEach((name) => {
        expect(SecurityValidator.sanitizeFileName(name)).toBe(`safe_${name}`);
        expect(SecurityValidator.sanitizeFileName(name.toLowerCase())).toBe(
          `safe_${name.toLowerCase()}`
        );
      });
    });
  });

  describe("validateFilePath", () => {
    const baseDir = "/safe/base/directory";

    it("ベースディレクトリ内の安全なパスを受け入れる", () => {
      const safePaths = [
        path.join(baseDir, "file.png"),
        path.join(baseDir, "subdir", "file.jpg"),
        baseDir,
      ];

      safePaths.forEach((filePath) => {
        expect(SecurityValidator.validateFilePath(filePath, baseDir)).toBe(
          true
        );
      });
    });

    it("ディレクトリトラバーサルを拒否する", () => {
      const dangerousPaths = [
        path.join(baseDir, "..", "outside.png"),
        path.join(baseDir, "..", "..", "outside.png"),
        "/etc/passwd",
      ];

      dangerousPaths.forEach((filePath) => {
        expect(SecurityValidator.validateFilePath(filePath, baseDir)).toBe(
          false
        );
      });
    });

    it("空の文字列や無効な入力を拒否する", () => {
      expect(SecurityValidator.validateFilePath("", baseDir)).toBe(false);
      expect(SecurityValidator.validateFilePath("test", "")).toBe(false);
      expect(SecurityValidator.validateFilePath(null as any, baseDir)).toBe(
        false
      );
    });
  });

  describe("validateFileSize", () => {
    it("適切なサイズのファイルを受け入れる", () => {
      expect(SecurityValidator.validateFileSize(1024)).toBe(true); // 1KB
      expect(SecurityValidator.validateFileSize(1024 * 1024)).toBe(true); // 1MB
      expect(SecurityValidator.validateFileSize(5 * 1024 * 1024)).toBe(true); // 5MB
    });

    it("0バイトのファイルを拒否する", () => {
      expect(SecurityValidator.validateFileSize(0)).toBe(false);
    });

    it("負のサイズを拒否する", () => {
      expect(SecurityValidator.validateFileSize(-1)).toBe(false);
    });

    it("制限を超えるサイズを拒否する", () => {
      const maxSize = 10; // 10MB
      const oversizeFile = (maxSize + 1) * 1024 * 1024; // 11MB
      expect(SecurityValidator.validateFileSize(oversizeFile, maxSize)).toBe(
        false
      );
    });

    it("カスタム制限サイズを使用する", () => {
      const customLimit = 5; // 5MB
      const fileSize = 6 * 1024 * 1024; // 6MB
      expect(SecurityValidator.validateFileSize(fileSize, customLimit)).toBe(
        false
      );
    });
  });

  describe("validateImageContentType", () => {
    it("有効な画像Content-Typeを受け入れる", () => {
      const validTypes = [
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
        "image/gif",
      ];

      validTypes.forEach((type) => {
        expect(SecurityValidator.validateImageContentType(type)).toBe(true);
      });
    });

    it("大文字小文字を区別しない", () => {
      expect(SecurityValidator.validateImageContentType("IMAGE/PNG")).toBe(
        true
      );
      expect(SecurityValidator.validateImageContentType("Image/Jpeg")).toBe(
        true
      );
    });

    it("追加パラメータ付きのContent-Typeを受け入れる", () => {
      expect(
        SecurityValidator.validateImageContentType("image/png; charset=utf-8")
      ).toBe(true);
    });

    it("無効なContent-Typeを拒否する", () => {
      const invalidTypes = [
        "text/plain",
        "application/json",
        "video/mp4",
        "audio/mp3",
      ];

      invalidTypes.forEach((type) => {
        expect(SecurityValidator.validateImageContentType(type)).toBe(false);
      });
    });

    it("nullまたは空のContent-Typeを拒否する", () => {
      expect(SecurityValidator.validateImageContentType(null)).toBe(false);
      expect(SecurityValidator.validateImageContentType("")).toBe(false);
    });
  });

  describe("validateAll", () => {
    const baseDir = "/safe/directory";
    const validUrl = "https://act-upload.hoyoverse.com/test.png";
    const validPath = path.join(baseDir, "test.png");

    it("全ての検証に合格する場合にtrueを返す", () => {
      expect(SecurityValidator.validateAll(validUrl, validPath, baseDir)).toBe(
        true
      );
    });

    it("URLが無効な場合にfalseを返す", () => {
      const invalidUrl = "https://malicious.com/test.png";
      expect(
        SecurityValidator.validateAll(invalidUrl, validPath, baseDir)
      ).toBe(false);
    });

    it("パスが無効な場合にfalseを返す", () => {
      const invalidPath = path.join(baseDir, "..", "outside.png");
      expect(
        SecurityValidator.validateAll(validUrl, invalidPath, baseDir)
      ).toBe(false);
    });

    it("両方が無効な場合にfalseを返す", () => {
      const invalidUrl = "https://malicious.com/test.png";
      const invalidPath = path.join(baseDir, "..", "outside.png");
      expect(
        SecurityValidator.validateAll(invalidUrl, invalidPath, baseDir)
      ).toBe(false);
    });
  });
});
