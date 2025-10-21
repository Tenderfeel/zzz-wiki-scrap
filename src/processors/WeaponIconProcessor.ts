import { promises as fs } from "fs";
import { createWriteStream } from "fs";
import path from "path";
import {
  WeaponEntry,
  WeaponIconConfig,
  WeaponIconInfo,
  WeaponIconDownloadResult,
} from "../types/processing";
import {
  WeaponIconDownloadError,
  WeaponIconValidationError,
  WeaponIconFileSystemError,
  WeaponIconSecurityError,
} from "../errors";
import { logger, LogMessages } from "../utils/Logger";
import { SecurityValidator } from "../utils/SecurityValidator";

/**
 * 武器アイコンの処理を担当するクラス
 * weapon-list.json からアイコン URL を抽出し、画像をダウンロードする
 */
export class WeaponIconProcessor {
  private readonly config: WeaponIconConfig;

  constructor(config: WeaponIconConfig) {
    this.config = config;
  }

  /**
   * 武器エントリーからアイコンをダウンロードする
   * @param weaponEntry 武器エントリー情報
   * @returns ダウンロード結果
   */
  async processWeaponIcon(
    weaponEntry: WeaponEntry
  ): Promise<WeaponIconDownloadResult> {
    let retryCount = 0;
    let lastError: Error | null = null;
    const processingStartTime = Date.now();

    // 詳細なデバッグ情報を記録
    logger.debug("武器アイコン処理開始 - 詳細情報", {
      weaponEntry: {
        entry_page_id: weaponEntry.entry_page_id,
        name: weaponEntry.name,
        icon_url: weaponEntry.icon_url,
        filter_values: weaponEntry.filter_values,
        desc: weaponEntry.desc,
      },
      config: {
        outputDirectory: this.config.outputDirectory,
        maxConcurrency: this.config.maxConcurrency,
        retryAttempts: this.config.retryAttempts,
        retryDelayMs: this.config.retryDelayMs,
        skipExisting: this.config.skipExisting,
        validateDownloads: this.config.validateDownloads,
      },
      systemInfo: {
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      },
    });

    while (retryCount <= this.config.retryAttempts) {
      const attemptStartTime = Date.now();
      try {
        logger.info(LogMessages.WEAPON_ICON_PROCESSING_START, {
          weaponId: weaponEntry.entry_page_id,
          weaponName: weaponEntry.name,
          retryCount,
          attemptStartTime: new Date(attemptStartTime).toISOString(),
          totalElapsedMs: attemptStartTime - processingStartTime,
        });

        // レアリティフィルタリング
        if (!this.isValidRarity(weaponEntry)) {
          logger.info(LogMessages.WEAPON_ICON_RARITY_FILTERED, {
            weaponId: weaponEntry.entry_page_id,
            weaponName: weaponEntry.name,
            rarity: weaponEntry.filter_values?.w_engine_rarity?.values,
          });

          return {
            success: false,
            weaponId: weaponEntry.entry_page_id,
            error: "レアリティフィルタによりスキップされました",
            retryCount,
          };
        }

        // アイコン URL を抽出
        const iconUrl = this.extractIconUrl(weaponEntry);
        if (!iconUrl) {
          throw new WeaponIconValidationError(
            weaponEntry.entry_page_id,
            "アイコン URL が見つかりません"
          );
        }

        // 武器IDとローカルパスを生成
        const weaponId = this.generateWeaponId(weaponEntry.entry_page_id);
        const localPath = this.generateLocalPath(weaponId);

        // セキュリティ検証を実行
        if (
          !SecurityValidator.validateAll(
            iconUrl,
            localPath,
            this.config.outputDirectory
          )
        ) {
          throw new WeaponIconSecurityError(
            weaponId,
            "セキュリティ検証に失敗しました",
            new Error(`URL: ${iconUrl}, Path: ${localPath}`)
          );
        }

        // 既存ファイルのチェック
        if (this.config.skipExisting && (await this.fileExists(localPath))) {
          const existingFileSize = await this.getFileSize(localPath);
          if (existingFileSize > 0) {
            logger.info(LogMessages.WEAPON_ICON_FILE_EXISTS, {
              weaponId,
              weaponName: weaponEntry.name,
              localPath,
              fileSize: existingFileSize,
            });

            return {
              success: true,
              weaponId,
              iconInfo: {
                weaponId,
                weaponName: weaponEntry.name,
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
          throw new WeaponIconDownloadError(
            weaponId,
            "アイコンダウンロードに失敗しました",
            new Error(`URL: ${iconUrl}`)
          );
        }

        // ファイル検証
        if (this.config.validateDownloads) {
          logger.debug(LogMessages.WEAPON_ICON_VALIDATION_START, {
            weaponId,
            weaponName: weaponEntry.name,
            localPath,
          });

          const isValid = await this.validateIconFile(localPath);
          if (!isValid) {
            throw new WeaponIconValidationError(
              weaponId,
              "ダウンロードしたファイルの検証に失敗しました",
              new Error(`Path: ${localPath}`)
            );
          }

          logger.debug(LogMessages.WEAPON_ICON_VALIDATION_SUCCESS, {
            weaponId,
            weaponName: weaponEntry.name,
          });
        }

        const fileSize = await this.getFileSize(localPath);
        const iconInfo: WeaponIconInfo = {
          weaponId,
          weaponName: weaponEntry.name,
          iconUrl,
          localPath,
          fileSize,
          downloadedAt: new Date(),
        };

        const processingEndTime = Date.now();
        const totalProcessingTime = processingEndTime - processingStartTime;
        const attemptTime = processingEndTime - attemptStartTime;

        logger.info(LogMessages.WEAPON_ICON_PROCESSING_SUCCESS, {
          weaponId,
          weaponName: weaponEntry.name,
          fileSize,
          localPath,
          performance: {
            totalProcessingTimeMs: totalProcessingTime,
            currentAttemptTimeMs: attemptTime,
            retryCount,
            avgAttemptTimeMs: totalProcessingTime / (retryCount + 1),
          },
          memoryUsage: process.memoryUsage(),
        });

        // 詳細な成功ログ
        logger.debug("武器アイコン処理成功 - 詳細情報", {
          weaponId,
          weaponName: weaponEntry.name,
          iconInfo: {
            ...iconInfo,
            downloadedAt: iconInfo.downloadedAt?.toISOString(),
          },
          processingMetrics: {
            totalProcessingTimeMs: totalProcessingTime,
            currentAttemptTimeMs: attemptTime,
            retryCount,
            finalAttempt: retryCount + 1,
            avgAttemptTimeMs: totalProcessingTime / (retryCount + 1),
          },
          systemMetrics: {
            memoryUsage: process.memoryUsage(),
            timestamp: new Date().toISOString(),
          },
        });

        return {
          success: true,
          weaponId,
          iconInfo,
          retryCount,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retryCount++;
        const attemptEndTime = Date.now();
        const attemptTime = attemptEndTime - attemptStartTime;
        const totalElapsedTime = attemptEndTime - processingStartTime;

        // 共通のエラーコンテキスト情報
        const errorContext = {
          weaponId: weaponEntry.entry_page_id,
          weaponName: weaponEntry.name,
          retryCount,
          maxRetries: this.config.retryAttempts,
          timing: {
            attemptTimeMs: attemptTime,
            totalElapsedMs: totalElapsedTime,
            attemptStartTime: new Date(attemptStartTime).toISOString(),
            attemptEndTime: new Date(attemptEndTime).toISOString(),
          },
          systemInfo: {
            memoryUsage: process.memoryUsage(),
            timestamp: new Date().toISOString(),
          },
          weaponContext: {
            iconUrl: weaponEntry.icon_url,
            rarity: weaponEntry.filter_values?.w_engine_rarity?.values,
            desc: weaponEntry.desc,
          },
        };

        // エラータイプに応じた詳細ログ
        if (error instanceof WeaponIconDownloadError) {
          logger.warn(LogMessages.WEAPON_ICON_DOWNLOAD_ERROR, {
            ...errorContext,
            error: error.message,
            details: error.details,
            originalError: error.originalError?.message,
            errorStack: error.stack,
            errorType: "WeaponIconDownloadError",
          });
        } else if (error instanceof WeaponIconValidationError) {
          logger.warn(LogMessages.WEAPON_ICON_VALIDATION_ERROR, {
            ...errorContext,
            error: error.message,
            details: error.details,
            originalError: error.originalError?.message,
            errorStack: error.stack,
            errorType: "WeaponIconValidationError",
          });
        } else if (error instanceof WeaponIconSecurityError) {
          logger.error(LogMessages.WEAPON_ICON_SECURITY_VALIDATION_ERROR, {
            ...errorContext,
            error: error.message,
            details: error.details,
            originalError: error.originalError?.message,
            errorStack: error.stack,
            errorType: "WeaponIconSecurityError",
            securityContext: {
              iconUrl: weaponEntry.icon_url,
              outputDirectory: this.config.outputDirectory,
            },
          });
        } else {
          logger.warn(LogMessages.WEAPON_ICON_PROCESSING_ERROR, {
            ...errorContext,
            error: lastError.message,
            errorStack: lastError.stack,
            errorType: lastError.constructor.name,
            errorName: lastError.name,
          });
        }

        // 詳細なデバッグ情報（全エラータイプ共通）
        logger.debug("武器アイコン処理エラー - 詳細デバッグ情報", {
          ...errorContext,
          errorDetails: {
            message: lastError.message,
            name: lastError.name,
            stack: lastError.stack,
            cause: (lastError as any).cause,
          },
          processingState: {
            currentRetry: retryCount,
            remainingRetries: this.config.retryAttempts - retryCount,
            willRetry: retryCount <= this.config.retryAttempts,
          },
          configSnapshot: {
            ...this.config,
          },
        });

        if (retryCount <= this.config.retryAttempts) {
          const delay = this.calculateRetryDelay(retryCount);
          logger.info(LogMessages.WEAPON_ICON_PROCESSING_RETRY, {
            weaponId: weaponEntry.entry_page_id,
            weaponName: weaponEntry.name,
            delayMs: delay,
            retryCount,
          });
          await this.sleep(delay);
        }
      }
    }

    const finalFailureTime = Date.now();
    const totalProcessingTime = finalFailureTime - processingStartTime;

    logger.error(LogMessages.WEAPON_ICON_PROCESSING_FINAL_FAILURE, {
      weaponId: weaponEntry.entry_page_id,
      weaponName: weaponEntry.name,
      error: lastError?.message,
      errorType: lastError?.constructor.name,
      totalRetries: retryCount - 1,
      finalFailureContext: {
        totalProcessingTimeMs: totalProcessingTime,
        finalFailureTime: new Date(finalFailureTime).toISOString(),
        processingStartTime: new Date(processingStartTime).toISOString(),
        avgAttemptTimeMs: totalProcessingTime / retryCount,
        allRetriesExhausted: true,
      },
      systemInfo: {
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      },
      weaponContext: {
        iconUrl: weaponEntry.icon_url,
        rarity: weaponEntry.filter_values?.w_engine_rarity?.values,
        desc: weaponEntry.desc,
      },
      errorHistory: {
        lastErrorMessage: lastError?.message,
        lastErrorStack: lastError?.stack,
        lastErrorName: lastError?.name,
      },
    });

    // 最終失敗時の詳細デバッグ情報
    logger.debug("武器アイコン処理最終失敗 - 完全なデバッグ情報", {
      weaponEntry: {
        entry_page_id: weaponEntry.entry_page_id,
        name: weaponEntry.name,
        icon_url: weaponEntry.icon_url,
        filter_values: weaponEntry.filter_values,
        desc: weaponEntry.desc,
      },
      processingHistory: {
        totalProcessingTimeMs: totalProcessingTime,
        totalAttempts: retryCount,
        avgAttemptTimeMs: totalProcessingTime / retryCount,
        processingStartTime: new Date(processingStartTime).toISOString(),
        finalFailureTime: new Date(finalFailureTime).toISOString(),
      },
      finalError: {
        message: lastError?.message,
        name: lastError?.name,
        stack: lastError?.stack,
        constructor: lastError?.constructor.name,
        cause: (lastError as any)?.cause,
      },
      configUsed: {
        ...this.config,
      },
      systemState: {
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      },
    });

    return {
      success: false,
      weaponId: weaponEntry.entry_page_id,
      error: lastError?.message || "不明なエラー",
      retryCount: retryCount - 1,
    };
  }

  /**
   * 武器エントリーからアイコン URL を抽出する
   * @param weaponEntry 武器エントリー
   * @returns アイコン URL または null
   */
  extractIconUrl(weaponEntry: WeaponEntry): string | null {
    try {
      logger.debug(LogMessages.WEAPON_ICON_URL_EXTRACTION_START, {
        weaponId: weaponEntry.entry_page_id,
        weaponName: weaponEntry.name,
      });

      const iconUrl = weaponEntry.icon_url;

      if (!iconUrl || typeof iconUrl !== "string") {
        logger.warn(LogMessages.WEAPON_ICON_URL_NOT_FOUND, {
          weaponId: weaponEntry.entry_page_id,
          weaponName: weaponEntry.name,
          iconUrl: iconUrl,
        });
        return null;
      }

      // URL の妥当性をチェック（SecurityValidatorを使用）
      if (!SecurityValidator.validateIconUrl(iconUrl)) {
        logger.warn(LogMessages.WEAPON_ICON_URL_INVALID, {
          weaponId: weaponEntry.entry_page_id,
          weaponName: weaponEntry.name,
          iconUrl,
        });
        return null;
      }

      logger.debug(LogMessages.WEAPON_ICON_URL_EXTRACTION_SUCCESS, {
        weaponId: weaponEntry.entry_page_id,
        weaponName: weaponEntry.name,
        iconUrl,
      });
      return iconUrl;
    } catch (error) {
      logger.error(LogMessages.WEAPON_ICON_URL_EXTRACTION_ERROR, {
        weaponId: weaponEntry.entry_page_id,
        weaponName: weaponEntry.name,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * 武器のレアリティが処理対象かチェックする（SまたはAのみ、Bは除外）
   * @param weaponEntry 武器エントリー
   * @returns 処理対象かどうか
   */
  isValidRarity(weaponEntry: WeaponEntry): boolean {
    try {
      const rarityValues = weaponEntry.filter_values?.w_engine_rarity?.values;

      if (!rarityValues || !Array.isArray(rarityValues)) {
        logger.warn("レアリティ情報が見つかりません", {
          weaponId: weaponEntry.entry_page_id,
          weaponName: weaponEntry.name,
          filterValues: weaponEntry.filter_values,
        });
        return false;
      }

      // SまたはAレアリティのみ処理対象
      const isValid = rarityValues.some(
        (rarity) => rarity === "S" || rarity === "A"
      );

      logger.debug("レアリティフィルタリング結果", {
        weaponId: weaponEntry.entry_page_id,
        weaponName: weaponEntry.name,
        rarityValues,
        isValid,
      });

      return isValid;
    } catch (error) {
      logger.error("レアリティチェックエラー", {
        weaponId: weaponEntry.entry_page_id,
        weaponName: weaponEntry.name,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
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
      logger.debug(LogMessages.WEAPON_ICON_DOWNLOAD_START, {
        iconUrl,
        outputPath,
      });

      // ディレクトリを作成
      await this.ensureDirectoryExists(path.dirname(outputPath));

      // fetch でアイコンを取得
      const response = await fetch(iconUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; WeaponIconDownloader/1.0)",
          Accept: "image/*",
        },
      });

      if (!response.ok) {
        throw new WeaponIconDownloadError(
          path.basename(outputPath, ".png"),
          `HTTP ${response.status}: ${response.statusText}`,
          new Error(`URL: ${iconUrl}`)
        );
      }

      // Content-Type をチェック（SecurityValidatorを使用）
      const contentType = response.headers.get("content-type");
      if (!SecurityValidator.validateImageContentType(contentType)) {
        logger.error(LogMessages.WEAPON_ICON_CONTENT_TYPE_INVALID, {
          contentType,
          iconUrl,
        });
        throw new WeaponIconValidationError(
          path.basename(outputPath, ".png"),
          `無効なコンテンツタイプ: ${contentType}`,
          new Error(`URL: ${iconUrl}`)
        );
      }

      // ストリーミングダウンロードでメモリ効率を最適化
      const fileStream = createWriteStream(outputPath);

      if (!response.body) {
        throw new WeaponIconDownloadError(
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
              new WeaponIconFileSystemError(
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

      logger.debug(LogMessages.WEAPON_ICON_DOWNLOAD_SUCCESS, { outputPath });
      return true;
    } catch (error) {
      // 既にWeaponIconErrorの場合はそのまま再スロー
      if (
        error instanceof WeaponIconDownloadError ||
        error instanceof WeaponIconValidationError ||
        error instanceof WeaponIconFileSystemError
      ) {
        throw error;
      }

      logger.error(LogMessages.WEAPON_ICON_DOWNLOAD_ERROR, {
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
   * entry_page_id から武器ID を生成する
   * @param entryPageId entry_page_id
   * @returns 武器ID
   */
  generateWeaponId(entryPageId: string): string {
    // entry_page_idをそのまま武器IDとして使用
    return entryPageId;
  }

  /**
   * 武器 ID から安全なローカルファイルパスを生成する
   * @param weaponId 武器 ID
   * @returns ローカルファイルパス
   */
  generateLocalPath(weaponId: string): string {
    const sanitizedId = SecurityValidator.sanitizeFileName(weaponId);
    const fileName = `${sanitizedId}.png`;
    const fullPath = path.join(this.config.outputDirectory, fileName);

    // ディレクトリトラバーサル攻撃の防止
    if (
      !SecurityValidator.validateFilePath(fullPath, this.config.outputDirectory)
    ) {
      throw new WeaponIconSecurityError(
        weaponId,
        `安全でないファイルパス: ${fullPath}`,
        new Error(`OutputDir: ${this.config.outputDirectory}`)
      );
    }

    return fullPath;
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
      logger.info(LogMessages.WEAPON_ICON_DIRECTORY_CREATED, { dirPath });
    }
  } /**

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
  /**
   * ダウンロードした武器アイコンファイルを検証する
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
      logger.error("武器アイコンファイル検証エラー", {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
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
}
