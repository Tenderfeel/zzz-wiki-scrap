import path from "path";
import { logger } from "./Logger";

/**
 * セキュリティ検証を担当するユーティリティクラス
 * URL検証、ファイル名サニタイゼーション、ディレクトリトラバーサル防止を提供
 */
export class SecurityValidator {
  /**
   * アイコンURLの妥当性を検証する
   * HoyoLabドメインのみ許可し、HTTPSプロトコルを強制
   * @param url 検証するURL
   * @returns 妥当性
   */
  static validateIconUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);

      // HTTPSプロトコルのみ許可
      if (urlObj.protocol !== "https:") {
        logger.warn("非HTTPSプロトコルのURLは許可されません", {
          url,
          protocol: urlObj.protocol,
        });
        return false;
      }

      // 許可されたHoyoLabドメインのみ
      const allowedDomains = [
        "act-upload.hoyoverse.com",
        "act-webstatic.hoyoverse.com",
        "upload-os-bbs.hoyolab.com",
        "webstatic-sea.hoyolab.com",
        "webstatic.hoyoverse.com",
      ];

      if (!allowedDomains.includes(urlObj.hostname)) {
        logger.warn("許可されていないドメインです", {
          url,
          hostname: urlObj.hostname,
          allowedDomains,
        });
        return false;
      }

      // パスの基本検証（空でない、適切な長さ）
      if (
        !urlObj.pathname ||
        urlObj.pathname.length < 2 ||
        urlObj.pathname.length > 500
      ) {
        logger.warn("無効なURLパスです", { url, pathname: urlObj.pathname });
        return false;
      }

      // 画像ファイル拡張子の検証
      const allowedExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
      const hasValidExtension = allowedExtensions.some((ext) =>
        urlObj.pathname.toLowerCase().endsWith(ext)
      );

      if (!hasValidExtension) {
        logger.warn("許可されていない画像拡張子です", {
          url,
          pathname: urlObj.pathname,
          allowedExtensions,
        });
        return false;
      }

      return true;
    } catch (error) {
      logger.warn("URL解析エラー", {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * ファイル名をサニタイズする
   * 安全でない文字を除去し、適切な長さに制限
   * @param fileName サニタイズするファイル名
   * @returns サニタイズされたファイル名
   */
  static sanitizeFileName(fileName: string): string {
    if (!fileName || typeof fileName !== "string") {
      logger.warn("無効なファイル名です", { fileName });
      return "unknown";
    }

    // 英数字、ハイフン、アンダースコア、ピリオドのみ許可
    let sanitized = fileName.replace(/[^a-zA-Z0-9-_.]/g, "");

    // 連続するピリオドを単一に変換（ディレクトリトラバーサル防止）
    sanitized = sanitized.replace(/\.{2,}/g, ".");

    // 先頭・末尾のピリオドやハイフンを除去
    sanitized = sanitized.replace(/^[.-]+|[.-]+$/g, "");

    // 長さ制限（1-100文字）
    if (sanitized.length === 0) {
      logger.warn("サニタイズ後にファイル名が空になりました", {
        originalFileName: fileName,
      });
      return "unknown";
    }

    if (sanitized.length > 100) {
      sanitized = sanitized.substring(0, 100);
      logger.info("ファイル名が長すぎるため切り詰めました", {
        originalFileName: fileName,
        sanitizedFileName: sanitized,
      });
    }

    // 予約語チェック（Windows）
    const reservedNames = [
      "CON",
      "PRN",
      "AUX",
      "NUL",
      "COM1",
      "COM2",
      "COM3",
      "COM4",
      "COM5",
      "COM6",
      "COM7",
      "COM8",
      "COM9",
      "LPT1",
      "LPT2",
      "LPT3",
      "LPT4",
      "LPT5",
      "LPT6",
      "LPT7",
      "LPT8",
      "LPT9",
    ];

    const nameWithoutExt = sanitized.split(".")[0].toUpperCase();
    if (reservedNames.includes(nameWithoutExt)) {
      sanitized = `safe_${sanitized}`;
      logger.info("予約語のため接頭辞を追加しました", {
        originalFileName: fileName,
        sanitizedFileName: sanitized,
      });
    }

    return sanitized;
  }

  /**
   * ファイルパスがベースディレクトリ内にあることを検証する
   * ディレクトリトラバーサル攻撃を防止
   * @param filePath 検証するファイルパス
   * @param baseDir ベースディレクトリ
   * @returns パスが安全かどうか
   */
  static validateFilePath(filePath: string, baseDir: string): boolean {
    try {
      if (!filePath || !baseDir) {
        logger.warn("ファイルパスまたはベースディレクトリが空です", {
          filePath,
          baseDir,
        });
        return false;
      }

      // パスを正規化
      const resolvedPath = path.resolve(filePath);
      const resolvedBase = path.resolve(baseDir);

      // ベースディレクトリ内にあることを確認
      const isWithinBase =
        resolvedPath.startsWith(resolvedBase + path.sep) ||
        resolvedPath === resolvedBase;

      if (!isWithinBase) {
        logger.warn("ディレクトリトラバーサルの可能性があります", {
          filePath,
          baseDir,
          resolvedPath,
          resolvedBase,
        });
        return false;
      }

      // 相対パスに危険な要素が含まれていないかチェック
      const relativePath = path.relative(resolvedBase, resolvedPath);
      if (relativePath.includes("..") || relativePath.startsWith("/")) {
        logger.warn("危険な相対パス要素が含まれています", {
          filePath,
          relativePath,
        });
        return false;
      }

      return true;
    } catch (error) {
      logger.error("ファイルパス検証エラー", {
        filePath,
        baseDir,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * ファイルサイズが許可範囲内かチェック
   * @param sizeBytes ファイルサイズ（バイト）
   * @param maxSizeMB 最大サイズ（MB）
   * @returns サイズが適切かどうか
   */
  static validateFileSize(sizeBytes: number, maxSizeMB: number = 10): boolean {
    if (sizeBytes < 0) {
      logger.warn("無効なファイルサイズです", { sizeBytes });
      return false;
    }

    if (sizeBytes === 0) {
      logger.warn("ファイルサイズが0バイトです", { sizeBytes });
      return false;
    }

    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (sizeBytes > maxSizeBytes) {
      logger.warn("ファイルサイズが制限を超えています", {
        sizeBytes,
        maxSizeBytes,
        maxSizeMB,
      });
      return false;
    }

    return true;
  }

  /**
   * Content-Typeが画像形式かチェック
   * @param contentType HTTPレスポンスのContent-Type
   * @returns 画像形式かどうか
   */
  static validateImageContentType(contentType: string | null): boolean {
    if (!contentType) {
      logger.warn("Content-Typeが設定されていません");
      return false;
    }

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/gif",
    ];

    const isValidType = allowedTypes.some((type) =>
      contentType.toLowerCase().includes(type)
    );

    if (!isValidType) {
      logger.warn("許可されていないContent-Typeです", {
        contentType,
        allowedTypes,
      });
      return false;
    }

    return true;
  }

  /**
   * 包括的なセキュリティ検証を実行
   * @param url アイコンURL
   * @param filePath 保存先ファイルパス
   * @param baseDir ベースディレクトリ
   * @returns 全ての検証に合格したかどうか
   */
  static validateAll(url: string, filePath: string, baseDir: string): boolean {
    const urlValid = this.validateIconUrl(url);
    const pathValid = this.validateFilePath(filePath, baseDir);

    if (!urlValid || !pathValid) {
      logger.warn("セキュリティ検証に失敗しました", {
        url,
        filePath,
        baseDir,
        urlValid,
        pathValid,
      });
      return false;
    }

    return true;
  }
}
