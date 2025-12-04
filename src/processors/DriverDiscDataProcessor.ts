import { DataProcessor } from "./DataProcessor";
import { HoyoLabApiClient } from "../clients/HoyoLabApiClient";
import { DriverDiscDataMapper } from "../mappers/DriverDiscDataMapper";
import { ApiResponse } from "../types/api";
import {
  DriverDiscEntry,
  ProcessedDriverDiscData,
  BasicDriverDiscInfo,
  SetEffectInfo,
  Specialty,
  Lang,
} from "../types/index";
import { ApiError, ParsingError, MappingError } from "../errors";
import { logger } from "../utils/Logger";

/**
 * ドライバーディスクデータ処理クラス
 * HoyoLab API からドライバーディスクデータを取得し、ProcessedDriverDiscData に変換する
 */
export class DriverDiscDataProcessor extends DataProcessor {
  private apiClient: HoyoLabApiClient;
  protected dataMapper: DriverDiscDataMapper;

  constructor(apiClient?: HoyoLabApiClient, dataMapper?: DriverDiscDataMapper) {
    super();
    this.apiClient = apiClient || new HoyoLabApiClient();
    this.dataMapper = dataMapper || new DriverDiscDataMapper();
  }

  /**
   * ドライバーディスクエントリーを処理してProcessedDriverDiscDataを生成
   * @param discEntry ドライバーディスクエントリー
   * @returns 処理済みドライバーディスクデータ
   */
  public async processDriverDiscData(
    discEntry: DriverDiscEntry
  ): Promise<ProcessedDriverDiscData> {
    const discId = discEntry.id;

    logger.info("ドライバーディスクデータ処理を開始", {
      discId,
      discName: discEntry.name,
      timestamp: new Date().toISOString(),
    });

    try {
      // 多言語APIデータを取得
      const bilingualApiData = await this.fetchDriverDiscApiData(discEntry);

      logger.debug("多言語APIデータ取得完了", {
        discId,
        hasJaData: !!bilingualApiData.ja,
        hasEnData: !!bilingualApiData.en,
      });

      // 日本語データから基本情報を抽出
      const basicInfo = this.extractBasicDriverDiscInfo(
        bilingualApiData.ja,
        discId
      );

      logger.debug("基本ドライバーディスク情報抽出完了", {
        discId,
        extractedId: basicInfo.id,
        extractedName: basicInfo.name,
        releaseVersion: basicInfo.releaseVersion,
      });

      // 日本語データからセット効果情報を抽出
      const setEffectInfo = this.extractSetEffectInfo(bilingualApiData.ja);

      logger.debug("セット効果情報抽出完了", {
        discId,
        fourSetEffectLength: setEffectInfo.fourSetEffect.length,
        twoSetEffectLength: setEffectInfo.twoSetEffect.length,
      });

      // 4セット効果と2セット効果から特性配列を判定
      const specialty = this.determineSpecialties(
        setEffectInfo.fourSetEffect,
        setEffectInfo.twoSetEffect
      );

      logger.debug("特性判定完了", {
        discId,
        specialty,
        specialtyCount: specialty.length,
        fourSetEffectPreview: setEffectInfo.fourSetEffect.substring(0, 100),
      });

      const processedData: ProcessedDriverDiscData = {
        basicInfo,
        setEffectInfo,
        specialty,
      };

      logger.info("ドライバーディスクデータ処理完了", {
        discId,
        discName: basicInfo.name,
        specialty,
        processingTime: new Date().toISOString(),
      });

      return processedData;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("ドライバーディスクデータ処理中にエラーが発生", {
        discId,
        discName: discEntry.name,
        error: errorMessage,
        errorType: error instanceof Error ? error.constructor.name : "Unknown",
      });

      // エラーの種類に応じて適切な例外を再スロー
      if (error instanceof ApiError || error instanceof ParsingError) {
        throw error;
      }

      throw new ParsingError(
        `ドライバーディスクデータ処理に失敗しました (ID: ${discId})`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * ドライバーディスクの多言語APIデータを取得
   * @param discEntry ドライバーディスクエントリー
   * @returns 多言語APIデータ
   */
  private async fetchDriverDiscApiData(
    discEntry: DriverDiscEntry
  ): Promise<{ ja: ApiResponse; en: ApiResponse | null }> {
    const discId = discEntry.id;
    const pageId = parseInt(discId, 10);

    if (isNaN(pageId)) {
      throw new ParsingError(
        `無効なドライバーディスクID: ${discId} (数値に変換できません)`
      );
    }

    logger.debug("ドライバーディスクAPIデータ取得開始", {
      discId,
      pageId,
      discName: discEntry.name,
    });

    try {
      // 日本語データを取得（必須）
      logger.debug("日本語APIデータ取得開始", { discId, pageId });
      const jaData = await this.apiClient.fetchCharacterData(pageId, "ja-jp");

      logger.debug("日本語APIデータ取得成功", {
        discId,
        pageId,
        hasModules: !!jaData.data?.page?.modules,
        modulesCount: jaData.data?.page?.modules?.length || 0,
      });

      // 英語データを取得（オプショナル、失敗時はnull）
      let enData: ApiResponse | null = null;

      try {
        logger.debug("英語APIデータ取得開始", { discId, pageId });
        enData = await this.apiClient.fetchCharacterData(pageId, "en-us");

        logger.debug("英語APIデータ取得成功", {
          discId,
          pageId,
          hasModules: !!enData.data?.page?.modules,
          modulesCount: enData.data?.page?.modules?.length || 0,
        });
      } catch (enError) {
        const enErrorMessage =
          enError instanceof Error ? enError.message : String(enError);

        logger.warn("英語APIデータ取得に失敗、日本語データのみを使用", {
          discId,
          pageId,
          enError: enErrorMessage,
          fallbackStrategy: "japanese_only",
        });

        // 英語データの取得失敗は処理を継続（日本語データがあれば十分）
        enData = null;
      }

      return { ja: jaData, en: enData };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("ドライバーディスクAPIデータ取得に失敗", {
        discId,
        pageId,
        discName: discEntry.name,
        error: errorMessage,
      });

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(
        `ドライバーディスクAPIデータの取得に失敗しました (ID: ${discId}, PageID: ${pageId})`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * APIデータから基本ドライバーディスク情報を抽出
   * @param apiData APIレスポンス
   * @param discId ドライバーディスクID
   * @returns 基本ドライバーディスク情報
   */
  private extractBasicDriverDiscInfo(
    apiData: ApiResponse,
    discId: string
  ): BasicDriverDiscInfo {
    try {
      logger.debug("基本ドライバーディスク情報抽出開始", { discId });

      const basicInfo = this.dataMapper.extractBasicDriverDiscInfo(
        apiData,
        discId
      );

      logger.debug("基本ドライバーディスク情報抽出成功", {
        discId,
        extractedId: basicInfo.id,
        extractedName: basicInfo.name,
        releaseVersion: basicInfo.releaseVersion,
      });

      return basicInfo;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("基本ドライバーディスク情報の抽出に失敗", {
        discId,
        error: errorMessage,
      });

      if (error instanceof MappingError) {
        throw error;
      }

      throw new MappingError(
        `基本ドライバーディスク情報の抽出に失敗しました (ID: ${discId})`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * APIデータからセット効果情報を抽出
   * @param apiData APIレスポンス
   * @returns セット効果情報
   */
  private extractSetEffectInfo(apiData: ApiResponse): SetEffectInfo {
    try {
      logger.debug("セット効果情報抽出開始");

      const setEffectInfo = this.dataMapper.extractSetEffects(apiData);

      logger.debug("セット効果情報抽出成功", {
        fourSetEffectLength: setEffectInfo.fourSetEffect.length,
        twoSetEffectLength: setEffectInfo.twoSetEffect.length,
      });

      return setEffectInfo;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("セット効果情報の抽出に失敗", {
        error: errorMessage,
      });

      if (error instanceof MappingError) {
        throw error;
      }

      throw new MappingError(
        "セット効果情報の抽出に失敗しました",
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 4セット効果と2セット効果テキストから特性配列を判定
   * @param fourSetEffect 4セット効果テキスト
   * @param twoSetEffect 2セット効果テキスト
   * @returns 判定された特性配列
   */
  private determineSpecialties(
    fourSetEffect: string,
    twoSetEffect: string
  ): Specialty[] {
    try {
      logger.debug("特性判定開始", {
        fourSetEffectLength: fourSetEffect.length,
        twoSetEffectLength: twoSetEffect.length,
        fourSetEffectPreview: fourSetEffect.substring(0, 100),
        twoSetEffectPreview: twoSetEffect.substring(0, 100),
      });

      const specialties = this.dataMapper.extractSpecialties(
        fourSetEffect,
        twoSetEffect
      );

      logger.debug("特性判定成功", {
        specialties,
        specialtyCount: specialties.length,
        fourSetEffectPreview: fourSetEffect.substring(0, 100),
      });

      return specialties;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.warn("特性判定中にエラーが発生、デフォルト特性を使用", {
        error: errorMessage,
        defaultSpecialties: ["attack"],
        fourSetEffectPreview: fourSetEffect?.substring(0, 100),
      });

      // 特性判定の失敗は致命的ではないため、デフォルト値を返す
      return ["attack"];
    }
  }

  /**
   * 多言語セット効果オブジェクトを生成
   * @param jaSetEffect 日本語セット効果
   * @param enSetEffect 英語セット効果（オプショナル）
   * @returns 多言語セット効果オブジェクト
   */
  public createMultiLangSetEffect(
    jaSetEffect: string,
    enSetEffect?: string
  ): { [key in Lang]: string } {
    try {
      logger.debug("多言語セット効果生成開始", {
        jaLength: jaSetEffect?.length || 0,
        enLength: enSetEffect?.length || 0,
        hasEnglish: !!enSetEffect,
      });

      const multiLangSetEffect = this.dataMapper.createMultiLangSetEffect(
        jaSetEffect,
        enSetEffect
      );

      logger.debug("多言語セット効果生成成功", {
        jaLength: multiLangSetEffect.ja.length,
        enLength: multiLangSetEffect.en.length,
        usedFallback: multiLangSetEffect.ja === multiLangSetEffect.en,
      });

      return multiLangSetEffect;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("多言語セット効果の生成に失敗", {
        error: errorMessage,
        jaSetEffectPreview: jaSetEffect?.substring(0, 50),
        enSetEffectPreview: enSetEffect?.substring(0, 50),
      });

      if (error instanceof MappingError) {
        throw error;
      }

      throw new MappingError(
        "多言語セット効果の生成に失敗しました",
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * エラー回復機能付きドライバーディスクデータ処理
   * @param discEntry ドライバーディスクエントリー
   * @returns 処理済みドライバーディスクデータまたはnull
   */
  public async processDriverDiscDataWithRecovery(
    discEntry: DriverDiscEntry
  ): Promise<ProcessedDriverDiscData | null> {
    const discId = discEntry.id;

    logger.info("エラー回復機能付きドライバーディスクデータ処理開始", {
      discId,
      discName: discEntry.name,
      processingMode: "with_recovery",
    });

    try {
      // 通常の処理を試行
      const processedData = await this.processDriverDiscData(discEntry);

      logger.info("通常処理成功", {
        discId,
        discName: processedData.basicInfo.name,
        specialty: processedData.specialty,
      });

      return processedData;
    } catch (error) {
      const originalError = error as Error;

      logger.warn("通常処理失敗、エラー回復処理を開始", {
        discId,
        discName: discEntry.name,
        originalError: originalError.message,
        errorType: originalError.constructor.name,
      });

      // エラーの種類に応じた回復処理
      if (error instanceof ApiError) {
        logger.warn("API エラーによる処理失敗、スキップします", {
          discId,
          apiError: originalError.message,
          recoveryAction: "skip_disc",
        });
        return null;
      }

      if (error instanceof ParsingError || error instanceof MappingError) {
        logger.warn("データ解析エラーによる処理失敗、スキップします", {
          discId,
          parsingError: originalError.message,
          recoveryAction: "skip_disc",
        });
        return null;
      }

      // 予期しないエラーの場合もスキップ
      logger.error("予期しないエラーによる処理失敗、スキップします", {
        discId,
        discName: discEntry.name,
        unexpectedError: originalError.message,
        errorType: originalError.constructor.name,
        recoveryAction: "skip_disc",
      });

      return null;
    }
  }

  /**
   * バッチ処理用のドライバーディスクデータ処理
   * @param discEntries ドライバーディスクエントリー配列
   * @param delayMs 処理間隔（ミリ秒）
   * @returns バッチ処理結果
   */
  public async processDriverDiscDataBatch(
    discEntries: DriverDiscEntry[],
    delayMs: number = 1000
  ): Promise<{
    results: Array<{
      discId: string;
      data: ProcessedDriverDiscData | null;
      success: boolean;
      error?: string;
    }>;
    summary: {
      total: number;
      successful: number;
      failed: number;
      skipped: number;
      successRate: number;
    };
  }> {
    const results: Array<{
      discId: string;
      data: ProcessedDriverDiscData | null;
      success: boolean;
      error?: string;
    }> = [];

    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;

    logger.info("ドライバーディスクバッチ処理開始", {
      totalDiscs: discEntries.length,
      delayMs,
      discIds: discEntries.map((entry) => entry.id),
    });

    for (let i = 0; i < discEntries.length; i++) {
      const discEntry = discEntries[i];
      const discId = discEntry.id;

      try {
        logger.debug("個別ドライバーディスク処理開始", {
          discId,
          discName: discEntry.name,
          progress: `${i + 1}/${discEntries.length}`,
          currentSuccessRate:
            i > 0 ? `${Math.round((successCount / i) * 100)}%` : "N/A",
        });

        const processedData = await this.processDriverDiscDataWithRecovery(
          discEntry
        );

        if (processedData) {
          results.push({
            discId,
            data: processedData,
            success: true,
          });
          successCount++;

          logger.info("個別ドライバーディスク処理成功", {
            discId,
            discName: processedData.basicInfo.name,
            specialty: processedData.specialty,
            progress: `${i + 1}/${discEntries.length}`,
          });
        } else {
          results.push({
            discId,
            data: null,
            success: false,
            error: "処理がスキップされました",
          });
          skippedCount++;

          logger.warn("個別ドライバーディスク処理スキップ", {
            discId,
            discName: discEntry.name,
            progress: `${i + 1}/${discEntries.length}`,
            reason: "processing_skipped",
          });
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        results.push({
          discId,
          data: null,
          success: false,
          error: errorMessage,
        });
        failureCount++;

        logger.error("個別ドライバーディスク処理失敗", {
          discId,
          discName: discEntry.name,
          error: errorMessage,
          progress: `${i + 1}/${discEntries.length}`,
        });
      }

      // 最後の要素でない場合は遅延を追加
      if (i < discEntries.length - 1 && delayMs > 0) {
        logger.debug("処理間隔待機", {
          delayMs,
          nextDiscId: discEntries[i + 1].id,
        });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    const summary = {
      total: discEntries.length,
      successful: successCount,
      failed: failureCount,
      skipped: skippedCount,
      successRate: Math.round((successCount / discEntries.length) * 100),
    };

    logger.info("ドライバーディスクバッチ処理完了", {
      summary,
      processingTime: new Date().toISOString(),
      results: results.map((r) => ({
        discId: r.discId,
        success: r.success,
        hasData: !!r.data,
      })),
    });

    return { results, summary };
  }
}
