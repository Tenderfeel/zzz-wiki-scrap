import { promises as fs } from "fs";
import { createWriteStream } from "fs";
import path from "path";
import { HoyoLabApiClient } from "../clients/HoyoLabApiClient";
import { ApiResponse } from "../types/api";
import { BompEntry } from "../types";
import {
  BompIconConfig,
  BompIconInfo,
  BompIconDownloadResult,
} from "../types/processing";
import {
  ApiError,
  BompIconDownloadError,
  BompIconValidationError,
  BompIconFileSystemError,
  BompIconSecurityError,
} from "../errors";
import { logger, LogMessages } from "../utils/Logger";
import { SecurityValidator } from "../utils/SecurityValidator";

/**
 * ボンプアイコンの処理を担当するクラス
 * HoyoLab API からアイコン URL を取得し、画像をダウンロードする
 */
export class BompIconProcessor {
  private readonly apiClient: HoyoLabApiClient;
  private readonly config: BompIconConfig;

  constructor(apiClient: HoyoLabApiClient, config: BompIconConfig) {
    this.apiClient = apiClient;
    this.config = config;
  }

  /**
   * ボンプエントリーからアイコンをダウンロードする
   * @param bompEntry ボンプエントリー情報
   * @returns ダウンロード結果
   */
  async processBompIcon(bompEntry: BompEntry): Promise<BompIconDownloadResult> {
    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount <= this.config.retryAttempts) {
      try {
        logger.info(LogMessages.BOMP_ICON_PROCESSING_START, {
          bompId: bompEntry.id,
          pageId: bompEntry.pageId,
          retryCount,
        });

        // API からボンプデータを取得
        const apiResponse = await this.apiClient.fetchCharacterData(
          bompEntry.pageId,
          "ja-jp"
        );

        // アイコン URL を抽出
        const iconUrl = this.extractIconUrl(apiResponse);
        if (!iconUrl) {
          throw new BompIconValidationError(
            bompEntry.id,
            "アイコン URL が見つかりません"
          );
        }

        // ローカルパスを生成
        const localPath = this.generateLocalPath(bompEntry.id);

        // セキュリティ検証を実行
        if (
          !SecurityValidator.validateAll(
            iconUrl,
            localPath,
            this.config.outputDirectory
          )
        ) {
          throw new BompIconSecurityError(
            bompEntry.id,
            "セキュリティ検証に失敗しました",
            new Error(`URL: ${iconUrl}, Path: ${localPath}`)
          );
        }

        // 既存ファイルのチェック
        if (this.config.skipExisting && (await this.fileExists(localPath))) {
          const existingFileSize = await this.getFileSize(localPath);
          if (existingFileSize > 0) {
            logger.info(LogMessages.BOMP_ICON_FILE_EXISTS, {
              bompId: bompEntry.id,
              localPath,
              fileSize: existingFileSize,
            });

            return {
              success: true,
              bompId: bompEntry.id,
              iconInfo: {
                bompId: bompEntry.id,
                iconUrl,
                localPath,
                fileSize: existingFileSize,
                downloadedAt: new Date(),
              },
              retryCount,
            };
          }
        }

        // アイコンをダウンロード
        const downloadSuccess = await this.downloadIcon(iconUrl, localPath);
        if (!downloadSuccess) {
          throw new BompIconDownloadError(
            bompEntry.id,
            "アイコンダウンロードに失敗しました",
            new Error(`URL: ${iconUrl}`)
          );
        }

        // ファイル検証
        if (this.config.validateDownloads) {
          logger.debug(LogMessages.BOMP_ICON_VALIDATION_START, {
            bompId: bompEntry.id,
            localPath,
          });

          const isValid = await this.validateIconFile(localPath);
          if (!isValid) {
            throw new BompIconValidationError(
              bompEntry.id,
              "ダウンロードしたファイルの検証に失敗しました",
              new Error(`Path: ${localPath}`)
            );
          }

          logger.debug(LogMessages.BOMP_ICON_VALIDATION_SUCCESS, {
            bompId: bompEntry.id,
          });
        }

        const fileSize = await this.getFileSize(localPath);
        const iconInfo: BompIconInfo = {
          bompId: bompEntry.id,
          iconUrl,
          localPath,
          fileSize,
          downloadedAt: new Date(),
        };

        logger.info(LogMessages.BOMP_ICON_PROCESSING_SUCCESS, {
          bompId: bompEntry.id,
          fileSize,
          localPath,
        });

        return {
          success: true,
          bompId: bompEntry.id,
          iconInfo,
          retryCount,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retryCount++;

        // エラータイプに応じた詳細ログ
        if (error instanceof BompIconDownloadError) {
          logger.warn(LogMessages.BOMP_ICON_DOWNLOAD_ERROR, {
            bompId: bompEntry.id,
            error: error.message,
            details: error.details,
            retryCount,
            maxRetries: this.config.retryAttempts,
          });
        } else if (error instanceof BompIconValidationError) {
          logger.warn(LogMessages.BOMP_ICON_VALIDATION_ERROR, {
            bompId: bompEntry.id,
            error: error.message,
            details: error.details,
            retryCount,
            maxRetries: this.config.retryAttempts,
          });
        } else if (error instanceof BompIconSecurityError) {
          logger.error(LogMessages.BOMP_ICON_SECURITY_VALIDATION_ERROR, {
            bompId: bompEntry.id,
            error: error.message,
            details: error.details,
            retryCount,
            maxRetries: this.config.retryAttempts,
          });
        } else {
          logger.warn(LogMessages.BOMP_ICON_PROCESSING_ERROR, {
            bompId: bompEntry.id,
            error: lastError.message,
            retryCount,
            maxRetries: this.config.retryAttempts,
          });
        }

        if (retryCount <= this.config.retryAttempts) {
          const delay = this.calculateRetryDelay(retryCount);
          logger.info(LogMessages.BOMP_ICON_PROCESSING_RETRY, {
            bompId: bompEntry.id,
            delayMs: delay,
            retryCount,
          });
          await this.sleep(delay);
        }
      }
    }

    logger.error(LogMessages.BOMP_ICON_PROCESSING_FINAL_FAILURE, {
      bompId: bompEntry.id,
      error: lastError?.message,
      errorType: lastError?.constructor.name,
      totalRetries: retryCount - 1,
    });

    return {
      success: false,
      bompId: bompEntry.id,
      error: lastError?.message || "不明なエラー",
      retryCount: retryCount - 1,
    };
  }

  /**
   * API レスポンスからアイコン URL を抽出する
   * @param apiResponse API レスポンス
   * @returns アイコン URL または null
   */
  extractIconUrl(apiResponse: ApiResponse): string | null {
    try {
      logger.debug(LogMessages.BOMP_ICON_URL_EXTRACTION_START);

      const iconUrl = apiResponse.data?.page?.icon_url;

      if (!iconUrl || typeof iconUrl !== "string") {
        logger.warn(LogMessages.BOMP_ICON_URL_NOT_FOUND, {
          hasData: !!apiResponse.data,
          hasPage: !!apiResponse.data?.page,
          iconUrl: iconUrl,
        });
        return null;
      }

      // URL の妥当性をチェック（SecurityValidatorを使用）
      if (!SecurityValidator.validateIconUrl(iconUrl)) {
        logger.warn(LogMessages.BOMP_ICON_URL_INVALID, { iconUrl });
        return null;
      }

      logger.debug(LogMessages.BOMP_ICON_URL_EXTRACTION_SUCCESS, { iconUrl });
      return iconUrl;
    } catch (error) {
      logger.error(LogMessages.BOMP_ICON_URL_EXTRACTION_ERROR, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
  /**
   * アイコン画像をダウンロードする
   * @param iconUrl アイコンの URL
   * @param outputPath 保存先パス
   * @returns ダウンロード成功可否
   */
  async downloadIcon(iconUrl: string, outputPath: string): Promise<boolean> {
    try {
      logger.debug(LogMessages.BOMP_ICON_DOWNLOAD_START, {
        iconUrl,
        outputPath,
      });

      // ディレクトリを作成
      await this.ensureDirectoryExists(path.dirname(outputPath));

      // fetch でアイコンを取得
      const response = await fetch(iconUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; BompIconDownloader/1.0)",
          Accept: "image/*",
        },
      });

      if (!response.ok) {
        throw new BompIconDownloadError(
          path.basename(outputPath, ".png"),
          `HTTP ${response.status}: ${response.statusText}`,
          new Error(`URL: ${iconUrl}`)
        );
      }

      // Content-Type をチェック（SecurityValidatorを使用）
      const contentType = response.headers.get("content-type");
      if (!SecurityValidator.validateImageContentType(contentType)) {
        logger.error(LogMessages.BOMP_ICON_CONTENT_TYPE_INVALID, {
          contentType,
          iconUrl,
        });
        throw new BompIconValidationError(
          path.basename(outputPath, ".png"),
          `無効なコンテンツタイプ: ${contentType}`,
          new Error(`URL: ${iconUrl}`)
        );
      }

      // ストリーミングダウンロードでメモリ効率を最適化
      const fileStream = createWriteStream(outputPath);

      if (!response.body) {
        throw new BompIconDownloadError(
          path.basename(outputPath, ".png"),
          "レスポンスボディが空です",
          new Error(`URL: ${iconUrl}`)
        );
      }

      // Node.js の ReadableStream を使用
      const reader = response.body.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Buffer に変換して書き込み
          fileStream.write(Buffer.from(value));
        }
      } finally {
        reader.releaseLock();
      }

      // ファイルストリームを閉じる
      await new Promise<void>((resolve, reject) => {
        fileStream.end((error?: Error | null) => {
          if (error) {
            reject(
              new BompIconFileSystemError(
                path.basename(outputPath, ".png"),
                "ファイル書き込みエラー",
                error
              )
            );
          } else {
            resolve();
          }
        });
      });

      logger.debug(LogMessages.BOMP_ICON_DOWNLOAD_SUCCESS, { outputPath });
      return true;
    } catch (error) {
      // 既にBompIconErrorの場合はそのまま再スロー
      if (
        error instanceof BompIconDownloadError ||
        error instanceof BompIconValidationError ||
        error instanceof BompIconFileSystemError
      ) {
        throw error;
      }

      logger.error(LogMessages.BOMP_ICON_DOWNLOAD_ERROR, {
        iconUrl,
        outputPath,
        error: error instanceof Error ? error.message : String(error),
      });

      // 失敗した場合は部分的なファイルを削除
      try {
        await fs.unlink(outputPath);
      } catch {
        // ファイル削除エラーは無視
      }

      return false;
    }
  }

  /**
   * ボンプ ID から安全なローカルファイルパスを生成する
   * @param bompId ボンプ ID
   * @returns ローカルファイルパス
   */
  generateLocalPath(bompId: string): string {
    const sanitizedId = SecurityValidator.sanitizeFileName(bompId);
    const fileName = `${sanitizedId}.png`;
    const fullPath = path.join(this.config.outputDirectory, fileName);

    // ディレクトリトラバーサル攻撃の防止
    if (
      !SecurityValidator.validateFilePath(fullPath, this.config.outputDirectory)
    ) {
      throw new BompIconSecurityError(
        bompId,
        `安全でないファイルパス: ${fullPath}`,
        new Error(`OutputDir: ${this.config.outputDirectory}`)
      );
    }

    return fullPath;
  }

  /**
   * ダウンロードしたアイコンファイルを検証する
   * @param filePath ファイルパス
   * @returns 検証結果
   */
  async validateIconFile(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);

      // ファイルサイズチェック（SecurityValidatorを使用）
      const maxSizeMB = this.config.maxFileSizeMB || 10;
      if (!SecurityValidator.validateFileSize(stats.size, maxSizeMB)) {
        return false;
      }

      // ファイルが通常ファイルかチェック
      if (!stats.isFile()) {
        logger.warn("通常ファイルではありません", { filePath });
        return false;
      }

      return true;
    } catch (error) {
      logger.error("ファイル検証エラー", {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * ディレクトリが存在することを確認し、必要に応じて作成する
   * @param dirPath ディレクトリパス
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
      logger.info(LogMessages.BOMP_ICON_DIRECTORY_CREATED, { dirPath });
    }
  }

  /**
   * ファイルが存在するかチェック
   * @param filePath ファイルパス
   * @returns 存在可否
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * ファイルサイズを取得
   * @param filePath ファイルパス
   * @returns ファイルサイズ（バイト）
   */
  private async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  /**
   * リトライ遅延時間を計算（指数バックオフ）
   * @param retryCount リトライ回数
   * @returns 遅延時間（ミリ秒）
   */
  private calculateRetryDelay(retryCount: number): number {
    const baseDelay = this.config.retryDelayMs;
    return Math.min(baseDelay * Math.pow(2, retryCount - 1), 30000); // 最大30秒
  }

  /**
   * 指定時間待機する
   * @param ms 待機時間（ミリ秒）
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
