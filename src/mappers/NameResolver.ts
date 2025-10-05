import * as fs from "fs";
import * as path from "path";
import { NameMapping, NameMappings, Lang } from "../types/index.js";
import { NameMappingError } from "../errors/index.js";
import { logger, LogMessages } from "../utils/Logger.js";

/**
 * 名前マッピングの読み込み・解決機能を提供するクラス
 * Scraping.mdで定義された固定の名前リストを使用してキャラクター名を解決する
 */
export class NameResolver {
  private nameMappings: NameMappings = {};
  private isLoaded: boolean = false;
  private readonly configPath: string;

  constructor(configPath?: string) {
    // デフォルトの設定ファイルパスを設定
    this.configPath =
      configPath ||
      path.join(process.cwd(), "src", "config", "name-mappings.json");
  }

  /**
   * 名前マッピング設定ファイルを読み込む
   * @throws {NameMappingError} ファイルが見つからない場合やJSON形式が無効な場合
   */
  public loadNameMappings(): void {
    try {
      logger.debug("名前マッピング設定ファイルの読み込みを開始", {
        configPath: this.configPath,
      });

      if (!fs.existsSync(this.configPath)) {
        const errorMessage = `名前マッピング設定ファイルが見つかりません: ${this.configPath}`;
        logger.error(errorMessage, { configPath: this.configPath });
        throw new NameMappingError(errorMessage);
      }

      const fileContent = fs.readFileSync(this.configPath, "utf-8");
      logger.debug("設定ファイルの読み込み完了", {
        fileSize: fileContent.length,
      });

      const mappings = JSON.parse(fileContent);
      logger.debug("JSON解析完了", {
        mappingCount: Object.keys(mappings).length,
      });

      // 設定ファイルの検証
      if (!this.validateMappings(mappings)) {
        const errorMessage = "名前マッピング設定ファイルの形式が無効です";
        logger.error(errorMessage, { configPath: this.configPath });
        throw new NameMappingError(errorMessage);
      }

      this.nameMappings = mappings;
      this.isLoaded = true;

      const mappingCount = Object.keys(this.nameMappings).length;
      logger.info(`名前マッピングを読み込みました: ${mappingCount}件`, {
        configPath: this.configPath,
        mappingCount,
        characterIds: Object.keys(this.nameMappings).slice(0, 5), // 最初の5件をログに記録
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        const errorMessage = `名前マッピング設定ファイルのJSON形式が無効です: ${error.message}`;
        logger.error(errorMessage, {
          configPath: this.configPath,
          syntaxError: error.message,
        });
        throw new NameMappingError(errorMessage, error);
      }
      if (error instanceof NameMappingError) {
        // 既にログ出力済みのNameMappingErrorはそのまま再スロー
        throw error;
      }
      const errorMessage = `名前マッピングの読み込み中にエラーが発生しました: ${error}`;
      logger.error(errorMessage, {
        configPath: this.configPath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new NameMappingError(errorMessage, error as Error);
    }
  }

  /**
   * キャラクターIDから名前マッピングを取得する
   * @param characterId キャラクターID（小文字）
   * @returns 名前マッピング、見つからない場合はnull
   */
  public resolveNames(characterId: string): NameMapping | null {
    try {
      if (!characterId || typeof characterId !== "string") {
        logger.warn("無効なキャラクターIDが指定されました", {
          characterId,
          type: typeof characterId,
        });
        return null;
      }

      if (!this.isLoaded) {
        logger.debug("名前マッピングが未読み込みのため、読み込みを実行");
        this.loadNameMappings();
      }

      // キャラクターIDを小文字に正規化
      const normalizedId = characterId.toLowerCase().trim();

      if (normalizedId === "") {
        logger.warn("空のキャラクターIDが指定されました", {
          originalId: characterId,
        });
        return null;
      }

      const mapping = this.nameMappings[normalizedId];

      if (mapping) {
        logger.debug(`名前マッピングを取得: ${normalizedId}`, {
          characterId: normalizedId,
          jaName: mapping.ja,
          enName: mapping.en,
        });
      } else {
        logger.debug(`名前マッピングが見つかりません: ${normalizedId}`, {
          characterId: normalizedId,
          availableIds: Object.keys(this.nameMappings).slice(0, 10), // デバッグ用に最初の10件を表示
        });
      }

      return mapping || null;
    } catch (error) {
      logger.error(`名前解決中にエラーが発生しました: ${characterId}`, {
        characterId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * 指定されたキャラクターIDのマッピングが存在するかチェック
   * @param characterId キャラクターID
   * @returns マッピングが存在する場合true
   */
  public hasMapping(characterId: string): boolean {
    if (!this.isLoaded) {
      this.loadNameMappings();
    }

    const normalizedId = characterId.toLowerCase();
    return normalizedId in this.nameMappings;
  }

  /**
   * 名前マッピング設定の検証を行う
   * @param mappings 検証対象のマッピングオブジェクト
   * @returns 検証結果（true: 有効、false: 無効）
   */
  public validateMappings(mappings: any): mappings is NameMappings {
    logger.debug("名前マッピングの検証を開始");

    if (!mappings || typeof mappings !== "object") {
      logger.error("名前マッピングがオブジェクトではありません", {
        type: typeof mappings,
        value: mappings,
      });
      return false;
    }

    const entries = Object.entries(mappings);
    logger.debug(`${entries.length}件のマッピングを検証中`);

    let validCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const [characterId, mapping] of entries) {
      try {
        // キャラクターIDの検証
        if (typeof characterId !== "string" || characterId.trim() === "") {
          const error = `無効なキャラクターID: ${characterId}`;
          logger.error(error, { characterId, type: typeof characterId });
          errors.push(error);
          errorCount++;
          continue;
        }

        // マッピングオブジェクトの検証
        if (!mapping || typeof mapping !== "object") {
          const error = `キャラクター "${characterId}" のマッピングがオブジェクトではありません`;
          logger.error(error, {
            characterId,
            mappingType: typeof mapping,
            mapping,
          });
          errors.push(error);
          errorCount++;
          continue;
        }

        const nameMapping = mapping as any;

        // 必須フィールドの検証
        if (
          !nameMapping.ja ||
          typeof nameMapping.ja !== "string" ||
          nameMapping.ja.trim() === ""
        ) {
          const error = `キャラクター "${characterId}" の日本語名が無効です`;
          logger.error(error, {
            characterId,
            jaName: nameMapping.ja,
            jaType: typeof nameMapping.ja,
          });
          errors.push(error);
          errorCount++;
          continue;
        }

        if (
          !nameMapping.en ||
          typeof nameMapping.en !== "string" ||
          nameMapping.en.trim() === ""
        ) {
          const error = `キャラクター "${characterId}" の英語名が無効です`;
          logger.error(error, {
            characterId,
            enName: nameMapping.en,
            enType: typeof nameMapping.en,
          });
          errors.push(error);
          errorCount++;
          continue;
        }

        // 余分なプロパティの検証
        const allowedKeys = ["ja", "en"];
        const actualKeys = Object.keys(nameMapping);
        const invalidKeys = actualKeys.filter(
          (key) => !allowedKeys.includes(key)
        );

        if (invalidKeys.length > 0) {
          logger.warn(
            `キャラクター "${characterId}" に不明なプロパティがあります: ${invalidKeys.join(
              ", "
            )}`,
            {
              characterId,
              invalidKeys,
              allKeys: actualKeys,
            }
          );
        }

        validCount++;
        logger.debug(`キャラクター "${characterId}" の検証完了`, {
          characterId,
          jaName: nameMapping.ja,
          enName: nameMapping.en,
        });
      } catch (error) {
        const errorMessage = `キャラクター "${characterId}" の検証中にエラーが発生: ${error}`;
        logger.error(errorMessage, {
          characterId,
          error: error instanceof Error ? error.message : String(error),
        });
        errors.push(errorMessage);
        errorCount++;
      }
    }

    const isValid = errorCount === 0;
    logger.info("名前マッピング検証完了", {
      totalCount: entries.length,
      validCount,
      errorCount,
      isValid,
      errors: errors.slice(0, 5), // 最初の5件のエラーのみログに記録
    });

    return isValid;
  }

  /**
   * 読み込まれた名前マッピングの統計情報を取得
   * @returns マッピング統計情報
   */
  public getMappingStats(): { total: number; characterIds: string[] } {
    if (!this.isLoaded) {
      this.loadNameMappings();
    }

    return {
      total: Object.keys(this.nameMappings).length,
      characterIds: Object.keys(this.nameMappings).sort(),
    };
  }

  /**
   * 名前マッピングが読み込まれているかチェック
   * @returns 読み込み状態
   */
  public isNameMappingsLoaded(): boolean {
    return this.isLoaded;
  }

  /**
   * 多言語名前オブジェクトを作成する
   * @param characterId キャラクターID
   * @returns 多言語名前オブジェクト、マッピングが見つからない場合はnull
   */
  public createMultiLangName(
    characterId: string
  ): { [key in Lang]: string } | null {
    const mapping = this.resolveNames(characterId);

    if (!mapping) {
      return null;
    }

    return {
      ja: mapping.ja,
      en: mapping.en,
    };
  }

  /**
   * 名前マッピングファイルが利用可能かチェック（エラーハンドリング用）
   * @returns ファイルの利用可能性とエラー情報
   */
  public checkMappingFileAvailability(): {
    available: boolean;
    error?: string;
    fallbackMode: boolean;
  } {
    try {
      logger.debug("名前マッピングファイルの可用性チェックを開始", {
        configPath: this.configPath,
      });

      if (!fs.existsSync(this.configPath)) {
        logger.warn(LogMessages.NAME_MAPPING_FALLBACK_MODE, {
          configPath: this.configPath,
          reason: "ファイルが見つかりません",
        });
        return {
          available: false,
          error: "ファイルが見つかりません",
          fallbackMode: true,
        };
      }

      // ファイルの読み取り権限をチェック
      try {
        fs.accessSync(this.configPath, fs.constants.R_OK);
        logger.debug("名前マッピングファイルのアクセス権限確認完了", {
          configPath: this.configPath,
        });
      } catch (accessError) {
        logger.error(LogMessages.NAME_MAPPING_FILE_ACCESS_ERROR, {
          configPath: this.configPath,
          error:
            accessError instanceof Error
              ? accessError.message
              : String(accessError),
          errorType: "permission_denied",
        });
        return {
          available: false,
          error: "読み取り権限がありません",
          fallbackMode: true,
        };
      }

      // ファイルサイズをチェック（空ファイルの検出）
      try {
        const stats = fs.statSync(this.configPath);
        if (stats.size === 0) {
          logger.warn("名前マッピングファイルが空です", {
            configPath: this.configPath,
            fileSize: stats.size,
          });
          return {
            available: false,
            error: "ファイルが空です",
            fallbackMode: true,
          };
        }
        logger.debug("名前マッピングファイルサイズ確認完了", {
          configPath: this.configPath,
          fileSize: stats.size,
        });
      } catch (statError) {
        logger.error("名前マッピングファイルの統計情報取得に失敗", {
          configPath: this.configPath,
          error:
            statError instanceof Error ? statError.message : String(statError),
        });
        return {
          available: false,
          error: "ファイル統計情報の取得に失敗",
          fallbackMode: true,
        };
      }

      logger.debug("名前マッピングファイルの可用性チェック完了", {
        configPath: this.configPath,
        available: true,
      });

      return {
        available: true,
        fallbackMode: false,
      };
    } catch (error) {
      logger.error(
        "名前マッピングファイルの可用性チェック中に予期しないエラーが発生",
        {
          configPath: this.configPath,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }
      );
      return {
        available: false,
        error: error instanceof Error ? error.message : String(error),
        fallbackMode: true,
      };
    }
  }

  /**
   * 名前マッピングエラーからの回復を試行
   * @param error 発生したエラー
   * @param characterId 対象のキャラクターID
   * @returns 回復が成功した場合のマッピング、失敗した場合はnull
   */
  public attemptErrorRecovery(
    error: Error,
    characterId: string
  ): NameMapping | null {
    logger.info(LogMessages.ERROR_RECOVERY_ATTEMPT, {
      characterId,
      errorType: error.name,
      errorMessage: error.message,
    });

    try {
      // ファイルの再読み込みを試行
      if (error instanceof NameMappingError) {
        logger.debug("NameMappingErrorからの回復を試行", {
          characterId,
          configPath: this.configPath,
        });

        // 設定ファイルの可用性を再チェック
        const availability = this.checkMappingFileAvailability();
        if (availability.available) {
          try {
            // 強制的に再読み込み
            this.isLoaded = false;
            this.loadNameMappings();

            const mapping = this.resolveNames(characterId);
            if (mapping) {
              logger.info(LogMessages.ERROR_RECOVERY_SUCCESS, {
                characterId,
                jaName: mapping.ja,
                enName: mapping.en,
              });
              return mapping;
            }
          } catch (reloadError) {
            logger.error("名前マッピング再読み込み中にエラーが発生", {
              characterId,
              reloadError:
                reloadError instanceof Error
                  ? reloadError.message
                  : String(reloadError),
            });
          }
        }
      }

      logger.warn(LogMessages.ERROR_RECOVERY_FAILED, {
        characterId,
        errorType: error.name,
        reason: "回復処理が完了しましたが、マッピングは見つかりませんでした",
      });

      return null;
    } catch (recoveryError) {
      logger.error(LogMessages.ERROR_RECOVERY_FAILED, {
        characterId,
        originalError: error.message,
        recoveryError:
          recoveryError instanceof Error
            ? recoveryError.message
            : String(recoveryError),
      });
      return null;
    }
  }

  /**
   * 段階的縮退処理を実行
   * 名前マッピング機能が利用できない場合の代替処理
   * @param characterId キャラクターID
   * @returns 縮退モードでの処理結果
   */
  public gracefulDegradation(characterId: string): {
    mode: "degraded";
    reason: string;
    suggestion: string;
  } {
    logger.warn(LogMessages.GRACEFUL_DEGRADATION, {
      characterId,
      feature: "name_mapping",
    });

    const availability = this.checkMappingFileAvailability();

    let reason = "不明な理由";
    let suggestion = "システム管理者に連絡してください";

    if (!availability.available) {
      if (availability.error?.includes("見つかりません")) {
        reason = "名前マッピング設定ファイルが存在しません";
        suggestion = `設定ファイル ${this.configPath} を作成してください`;
      } else if (availability.error?.includes("権限")) {
        reason = "名前マッピング設定ファイルの読み取り権限がありません";
        suggestion = `ファイル ${this.configPath} の読み取り権限を確認してください`;
      } else if (availability.error?.includes("空")) {
        reason = "名前マッピング設定ファイルが空です";
        suggestion = `設定ファイル ${this.configPath} に有効なマッピングデータを追加してください`;
      } else {
        reason = availability.error || "ファイルアクセスエラー";
        suggestion = `設定ファイル ${this.configPath} の状態を確認してください`;
      }
    }

    logger.info("段階的縮退処理の詳細", {
      characterId,
      mode: "degraded",
      reason,
      suggestion,
      configPath: this.configPath,
    });

    return {
      mode: "degraded",
      reason,
      suggestion,
    };
  }
}
