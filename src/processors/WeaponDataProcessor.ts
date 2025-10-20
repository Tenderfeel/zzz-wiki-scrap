import { DataProcessor } from "./DataProcessor";
import { HoyoLabApiClient } from "../clients/HoyoLabApiClient";
import { WeaponDataMapper } from "../mappers/WeaponDataMapper";
import { ApiResponse } from "../types/api";
import {
  WeaponEntry,
  ProcessedWeaponData,
  BasicWeaponInfo,
  WeaponSkillInfo,
  WeaponAttributesInfo,
  WeaponAgentInfo,
} from "../types/index";
import { ParsingError, MappingError } from "../errors";
import { logger } from "../utils/Logger";
import { ErrorRecoveryHandler } from "../utils/ErrorRecoveryHandler";
import { PartialDataHandler } from "../utils/PartialDataHandler";

/**
 * 音動機データプロセッサー - 音動機データの変換とビジネスロジック処理
 * 要件: 1.3, 1.4, 1.5, 4.1, 4.2, 4.3
 */
export class WeaponDataProcessor extends DataProcessor {
  private apiClient: HoyoLabApiClient;
  private weaponDataMapper: WeaponDataMapper;

  constructor(
    apiClient?: HoyoLabApiClient,
    weaponDataMapper?: WeaponDataMapper,
    errorRecoveryHandler?: ErrorRecoveryHandler,
    partialDataHandler?: PartialDataHandler
  ) {
    super(
      undefined,
      undefined,
      undefined,
      partialDataHandler,
      errorRecoveryHandler
    );
    this.apiClient = apiClient || new HoyoLabApiClient();
    this.weaponDataMapper = weaponDataMapper || new WeaponDataMapper();
  }

  /**
   * WeaponEntryからProcessedWeaponDataへの変換
   * 既存のHoyoLabApiClientを使用したAPIデータ取得
   * 要件: 1.3, 1.4, 5.2
   */
  async processWeaponData(
    weaponEntry: WeaponEntry
  ): Promise<ProcessedWeaponData> {
    const weaponId = weaponEntry.id;
    const processingStartTime = Date.now();

    logger.info("音動機データ処理を開始", {
      weaponId,
      weaponName: weaponEntry.name,
      rarity: weaponEntry.rarity,
      specialty: weaponEntry.specialty,
      timestamp: new Date().toISOString(),
    });

    try {
      // APIデータを取得（日本語優先、英語フォールバック）
      const apiData = await this.fetchWeaponApiData(weaponId);

      // 基本情報を抽出
      const basicInfo = this.weaponDataMapper.extractBasicWeaponInfo(
        apiData.ja,
        weaponId
      );

      logger.debug("基本音動機情報抽出完了", {
        weaponId,
        name: basicInfo.name,
        rarity: basicInfo.rarity,
        specialty: basicInfo.specialty,
      });

      // スキル情報を抽出
      const skillInfo = this.weaponDataMapper.extractWeaponSkillInfo(
        apiData.ja.data.page.modules
      );

      logger.debug("スキル情報抽出完了", {
        weaponId,
        hasSkillName: !!skillInfo.equipmentSkillName,
        hasSkillDesc: !!skillInfo.equipmentSkillDesc,
        skillNameLength: skillInfo.equipmentSkillName.length,
        skillDescLength: skillInfo.equipmentSkillDesc.length,
      });

      // 突破ステータスを抽出
      const attributesInfo = this.weaponDataMapper.extractWeaponAttributes(
        apiData.ja.data.page.modules
      );

      logger.debug("突破ステータス抽出完了", {
        weaponId,
        hasHpData: attributesInfo.hp.some((val) => val > 0),
        hasAtkData: attributesInfo.atk.some((val) => val > 0),
        hasDefData: attributesInfo.def.some((val) => val > 0),
      });

      // エージェント情報を抽出
      const agentInfo = this.weaponDataMapper.extractAgentInfo(
        apiData.ja.data.page.modules
      );

      logger.debug("エージェント情報抽出完了", {
        weaponId,
        hasAgentId: !!agentInfo.agentId,
        agentId: agentInfo.agentId,
      });

      // ProcessedWeaponDataを構築
      const processedData: ProcessedWeaponData = {
        basicInfo,
        skillInfo,
        attributesInfo,
        agentInfo,
      };

      // データ検証
      const validationResult = this.validateWeaponData(processedData);
      if (!validationResult.isValid) {
        logger.warn("音動機データ検証に失敗、グレースフル劣化を試行", {
          weaponId,
          validationErrors: validationResult.errors,
          degradationReason: "validation_failed",
        });

        const degradedData = await this.attemptGracefulDegradation(
          weaponEntry,
          new ParsingError(
            `データ検証失敗: ${validationResult.errors.join(", ")}`
          )
        );

        if (degradedData) {
          logger.info("グレースフル劣化による音動機データ回復成功", {
            weaponId,
            recoveryMethod: "graceful_degradation",
            processingTime: `${Date.now() - processingStartTime}ms`,
          });
          return degradedData;
        }

        throw new ParsingError(
          `音動機データの検証に失敗しました: ${validationResult.errors.join(
            ", "
          )}`
        );
      }

      const processingTime = Date.now() - processingStartTime;

      logger.info("音動機データ処理完了", {
        weaponId,
        processingTime: `${processingTime}ms`,
        hasBasicInfo: !!processedData.basicInfo,
        hasSkillInfo: !!processedData.skillInfo,
        hasAttributesInfo: !!processedData.attributesInfo,
        hasAgentInfo: !!processedData.agentInfo,
        success: true,
      });

      return processedData;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const processingTime = Date.now() - processingStartTime;

      logger.error("音動機データ処理中にエラーが発生", {
        weaponId,
        error: errorMessage,
        errorType:
          error instanceof Error ? error.constructor.name : typeof error,
        processingTime: `${processingTime}ms`,
      });

      // エラー回復を試行
      const recoveredData = await this.attemptGracefulDegradation(
        weaponEntry,
        error as Error
      );

      if (recoveredData) {
        logger.info("エラー回復による音動機データ処理成功", {
          weaponId,
          originalError: errorMessage,
          recoveryMethod: "error_recovery",
          processingTime: `${Date.now() - processingStartTime}ms`,
        });
        return recoveredData;
      }

      throw new ParsingError(
        `音動機データの処理に失敗しました (武器ID: ${weaponId})`,
        error as Error
      );
    }
  } /**
   *
 ProcessedWeaponDataの妥当性検証
   * 必須フィールドの存在確認と型チェック
   * 要件: 4.2
   */
  validateWeaponData(data: ProcessedWeaponData): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    logger.debug("音動機データ検証を開始", {
      weaponId: data.basicInfo?.id || "unknown",
      timestamp: new Date().toISOString(),
    });

    try {
      // 基本情報の検証
      if (!data.basicInfo) {
        errors.push("基本情報が存在しません");
      } else {
        if (!data.basicInfo.id || data.basicInfo.id.trim() === "") {
          errors.push("音動機IDが無効です");
        }

        if (!data.basicInfo.name || data.basicInfo.name.trim() === "") {
          errors.push("音動機名が無効です");
        }

        if (
          !data.basicInfo.rarity ||
          !["A", "S"].includes(data.basicInfo.rarity)
        ) {
          errors.push(`レア度が無効です: ${data.basicInfo.rarity}`);
        }

        // 特性は必須ではないが、存在する場合は検証
        if (
          data.basicInfo.specialty &&
          data.basicInfo.specialty.trim() === ""
        ) {
          errors.push("特性が空文字列です");
        }
      }

      // スキル情報の検証
      if (!data.skillInfo) {
        errors.push("スキル情報が存在しません");
      } else {
        // スキル名とスキル説明は空でも許可（一部の音動機にはスキルがない場合がある）
        if (typeof data.skillInfo.equipmentSkillName !== "string") {
          errors.push("スキル名の型が無効です");
        }

        if (typeof data.skillInfo.equipmentSkillDesc !== "string") {
          errors.push("スキル説明の型が無効です");
        }
      }

      // 属性情報の検証
      if (!data.attributesInfo) {
        errors.push("属性情報が存在しません");
      } else {
        const attributeKeys = [
          "hp",
          "atk",
          "def",
          "impact",
          "critRate",
          "critDmg",
          "anomalyMastery",
          "anomalyProficiency",
          "penRatio",
          "energy",
        ];

        for (const key of attributeKeys) {
          const value = (data.attributesInfo as any)[key];
          if (!Array.isArray(value)) {
            errors.push(`属性 ${key} が配列ではありません`);
          } else if (value.length !== 7) {
            errors.push(
              `属性 ${key} の配列長が7ではありません: ${value.length}`
            );
          } else {
            // 数値の検証
            for (let i = 0; i < value.length; i++) {
              if (typeof value[i] !== "number" || isNaN(value[i])) {
                errors.push(
                  `属性 ${key}[${i}] が有効な数値ではありません: ${value[i]}`
                );
              }
            }
          }
        }
      }

      // エージェント情報の検証（一時的に無効化）
      if (!data.agentInfo) {
        // エージェント情報が存在しない場合は警告のみ
        logger.debug("エージェント情報が存在しません", {
          weaponId: data.basicInfo?.id,
        });
      } else {
        // agentIdはオプショナルなので、存在する場合のみ検証
        if (data.agentInfo.agentId !== undefined) {
          if (
            typeof data.agentInfo.agentId !== "string" ||
            data.agentInfo.agentId.trim() === ""
          ) {
            // エージェントIDが空の場合は警告のみ（エラーにしない）
            logger.debug("エージェントIDが空です", {
              weaponId: data.basicInfo?.id,
              agentId: data.agentInfo.agentId,
            });
          }
        }
      }

      const isValid = errors.length === 0;

      logger.debug("音動機データ検証完了", {
        weaponId: data.basicInfo?.id || "unknown",
        isValid,
        errorCount: errors.length,
        errors: errors.length > 0 ? errors : undefined,
      });

      return {
        isValid,
        errors,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("音動機データ検証中にエラーが発生", {
        weaponId: data.basicInfo?.id || "unknown",
        error: errorMessage,
        errorType:
          error instanceof Error ? error.constructor.name : typeof error,
      });

      return {
        isValid: false,
        errors: [`検証処理中にエラーが発生: ${errorMessage}`],
      };
    }
  } /**

   * エラー時のフォールバック処理
   * 最小限の音動機データを作成
   * 部分的失敗でも処理を継続する機能
   * 要件: 4.3
   */
  async attemptGracefulDegradation(
    weaponEntry: WeaponEntry,
    error: Error
  ): Promise<ProcessedWeaponData | null> {
    const weaponId = weaponEntry.id;
    const degradationStartTime = Date.now();

    logger.info("音動機データのグレースフル劣化を開始", {
      weaponId,
      weaponName: weaponEntry.name,
      originalError: error.message,
      errorType: error.constructor.name,
      timestamp: new Date().toISOString(),
    });

    try {
      // レベル1: 部分的なAPIデータ取得を試行
      const partialApiData = await this.tryPartialApiDataRetrieval(weaponId);
      if (partialApiData) {
        logger.info("部分的APIデータ取得成功、データ抽出を試行", {
          weaponId,
          degradationLevel: "partial_api_data",
        });

        const partialProcessedData = await this.processPartialApiData(
          partialApiData,
          weaponEntry
        );

        if (partialProcessedData) {
          const degradationTime = Date.now() - degradationStartTime;
          logger.info("部分的APIデータからの音動機データ生成成功", {
            weaponId,
            degradationLevel: "partial_api_data",
            degradationTime: `${degradationTime}ms`,
            recoveryMethod: "partial_data_processing",
          });
          return partialProcessedData;
        }
      }

      // レベル2: 最小限のデータを生成
      logger.warn("部分的APIデータ処理も失敗、最小限データを生成", {
        weaponId,
        degradationLevel: "minimal_data",
        fallbackReason: "partial_processing_failed",
      });

      const minimalData = this.createMinimalWeaponData(weaponEntry);

      // 最小限データの検証
      const validationResult = this.validateWeaponData(minimalData);
      if (!validationResult.isValid) {
        logger.error("最小限データの検証に失敗", {
          weaponId,
          validationErrors: validationResult.errors,
          degradationResult: "failed",
        });
        return null;
      }

      const degradationTime = Date.now() - degradationStartTime;

      logger.info("最小限音動機データ生成成功", {
        weaponId,
        degradationLevel: "minimal_data",
        degradationTime: `${degradationTime}ms`,
        recoveryMethod: "minimal_data_generation",
        appliedDefaults: this.getAppliedDefaults(minimalData),
      });

      return minimalData;
    } catch (degradationError) {
      const degradationErrorMessage =
        degradationError instanceof Error
          ? degradationError.message
          : String(degradationError);
      const degradationTime = Date.now() - degradationStartTime;

      logger.error("グレースフル劣化処理中にエラーが発生", {
        weaponId,
        originalError: error.message,
        degradationError: degradationErrorMessage,
        degradationTime: `${degradationTime}ms`,
        degradationResult: "error",
      });

      return null;
    }
  } /**
   
* APIデータを取得（日本語優先、英語フォールバック）
   * 要件: 1.3, 1.4
   */
  private async fetchWeaponApiData(weaponId: string): Promise<{
    ja: ApiResponse;
    en?: ApiResponse;
  }> {
    const pageId = parseInt(weaponId, 10);

    if (isNaN(pageId)) {
      throw new ParsingError(`無効な音動機ID: ${weaponId}`);
    }

    logger.debug("音動機APIデータ取得を開始", {
      weaponId,
      pageId,
      primaryLanguage: "ja-jp",
      fallbackLanguage: "en-us",
    });

    try {
      // 日本語データを取得
      const jaData = await this.apiClient.fetchCharacterData(pageId, "ja-jp");

      logger.debug("日本語APIデータ取得成功", {
        weaponId,
        pageId,
        language: "ja-jp",
        hasPageData: !!jaData.data?.page,
        hasModules: !!jaData.data?.page?.modules,
      });

      // 英語データも取得を試行（オプショナル）
      let enData: ApiResponse | undefined;
      try {
        enData = await this.apiClient.fetchCharacterData(pageId, "en-us");
        logger.debug("英語APIデータ取得成功", {
          weaponId,
          pageId,
          language: "en-us",
          hasPageData: !!enData.data?.page,
        });
      } catch (enError) {
        logger.warn("英語APIデータ取得に失敗、日本語データのみ使用", {
          weaponId,
          pageId,
          enError: enError instanceof Error ? enError.message : String(enError),
        });
      }

      return {
        ja: jaData,
        en: enData,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("音動機APIデータ取得に失敗", {
        weaponId,
        pageId,
        error: errorMessage,
        errorType:
          error instanceof Error ? error.constructor.name : typeof error,
      });

      throw new ParsingError(
        `音動機APIデータの取得に失敗しました (武器ID: ${weaponId}, ページID: ${pageId})`,
        error as Error
      );
    }
  }

  /**
   * 部分的なAPIデータ取得を試行
   * 要件: 4.3
   */
  private async tryPartialApiDataRetrieval(
    weaponId: string
  ): Promise<ApiResponse | null> {
    try {
      logger.debug("部分的APIデータ取得を試行", {
        weaponId,
        retryMethod: "single_language_fallback",
      });

      const pageId = parseInt(weaponId, 10);
      if (isNaN(pageId)) {
        return null;
      }

      // エラー回復ハンドラーを使用してリトライ
      const apiData = await this.errorRecoveryHandler.retryApiRequest(
        () => this.apiClient.fetchCharacterData(pageId, "ja-jp"),
        weaponId,
        "weapon_api_data_retrieval"
      );

      return apiData;
    } catch (error) {
      logger.debug("部分的APIデータ取得に失敗", {
        weaponId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * 部分的なAPIデータから音動機データを処理
   * 要件: 4.3
   */
  private async processPartialApiData(
    apiData: ApiResponse,
    weaponEntry: WeaponEntry
  ): Promise<ProcessedWeaponData | null> {
    const weaponId = weaponEntry.id;

    try {
      logger.debug("部分的APIデータ処理を開始", {
        weaponId,
        hasPageData: !!apiData.data?.page,
        hasModules: !!apiData.data?.page?.modules,
      });

      // 基本情報を抽出（エラー時はデフォルト値を使用）
      let basicInfo: BasicWeaponInfo;
      try {
        basicInfo = this.weaponDataMapper.extractBasicWeaponInfo(
          apiData,
          weaponId
        );
      } catch (error) {
        logger.warn("基本情報抽出に失敗、デフォルト値を使用", {
          weaponId,
          error: error instanceof Error ? error.message : String(error),
        });
        basicInfo = this.createDefaultBasicInfo(weaponEntry);
      }

      // スキル情報を抽出（エラー時は空の値を使用）
      let skillInfo: WeaponSkillInfo;
      try {
        skillInfo = this.weaponDataMapper.extractWeaponSkillInfo(
          apiData.data.page.modules
        );
      } catch (error) {
        logger.warn("スキル情報抽出に失敗、空の値を使用", {
          weaponId,
          error: error instanceof Error ? error.message : String(error),
        });
        skillInfo = {
          equipmentSkillName: "",
          equipmentSkillDesc: "",
        };
      }

      // 属性情報を抽出（エラー時は空の配列を使用）
      let attributesInfo: WeaponAttributesInfo;
      try {
        attributesInfo = this.weaponDataMapper.extractWeaponAttributes(
          apiData.data.page.modules
        );
      } catch (error) {
        logger.warn("属性情報抽出に失敗、空の配列を使用", {
          weaponId,
          error: error instanceof Error ? error.message : String(error),
        });
        attributesInfo = this.createEmptyWeaponAttributes();
      }

      // エージェント情報を抽出（エラー時はundefinedを使用）
      let agentInfo: WeaponAgentInfo;
      try {
        agentInfo = this.weaponDataMapper.extractAgentInfo(
          apiData.data.page.modules
        );
      } catch (error) {
        logger.warn("エージェント情報抽出に失敗、undefinedを使用", {
          weaponId,
          error: error instanceof Error ? error.message : String(error),
        });
        agentInfo = { agentId: "" };
      }

      const partialData: ProcessedWeaponData = {
        basicInfo,
        skillInfo,
        attributesInfo,
        agentInfo,
      };

      logger.debug("部分的APIデータ処理完了", {
        weaponId,
        hasBasicInfo: !!basicInfo,
        hasSkillInfo: !!skillInfo,
        hasAttributesInfo: !!attributesInfo,
        hasAgentInfo: !!agentInfo,
      });

      return partialData;
    } catch (error) {
      logger.error("部分的APIデータ処理中にエラーが発生", {
        weaponId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * 最小限の音動機データを作成
   * 要件: 4.3
   */
  private createMinimalWeaponData(
    weaponEntry: WeaponEntry
  ): ProcessedWeaponData {
    const weaponId = weaponEntry.id;

    logger.debug("最小限音動機データを作成", {
      weaponId,
      weaponName: weaponEntry.name,
      rarity: weaponEntry.rarity,
      specialty: weaponEntry.specialty,
    });

    const basicInfo: BasicWeaponInfo = this.createDefaultBasicInfo(weaponEntry);

    const skillInfo: WeaponSkillInfo = {
      equipmentSkillName: "",
      equipmentSkillDesc: "",
    };

    const attributesInfo: WeaponAttributesInfo =
      this.createEmptyWeaponAttributes();

    const agentInfo: WeaponAgentInfo = {
      agentId: "",
    };

    return {
      basicInfo,
      skillInfo,
      attributesInfo,
      agentInfo,
    };
  }

  /**
   * デフォルトの基本情報を作成
   * 要件: 4.3
   */
  private createDefaultBasicInfo(weaponEntry: WeaponEntry): BasicWeaponInfo {
    return {
      id: weaponEntry.id,
      name: weaponEntry.name,
      rarity: weaponEntry.rarity,
      specialty: weaponEntry.specialty || "",
    };
  }

  /**
   * 空の音動機属性を作成
   * 要件: 4.3
   */
  private createEmptyWeaponAttributes(): WeaponAttributesInfo {
    return {
      hp: new Array(7).fill(0),
      atk: new Array(7).fill(0),
      def: new Array(7).fill(0),
      impact: new Array(7).fill(0),
      critRate: new Array(7).fill(0),
      critDmg: new Array(7).fill(0),
      anomalyMastery: new Array(7).fill(0),
      anomalyProficiency: new Array(7).fill(0),
      penRatio: new Array(7).fill(0),
      energy: new Array(7).fill(0),
    };
  }

  /**
   * 適用されたデフォルト値を取得
   * 要件: 4.3
   */
  private getAppliedDefaults(data: ProcessedWeaponData): string[] {
    const appliedDefaults: string[] = [];

    if (!data.basicInfo.specialty || data.basicInfo.specialty === "") {
      appliedDefaults.push("specialty");
    }

    if (
      !data.skillInfo.equipmentSkillName ||
      data.skillInfo.equipmentSkillName === ""
    ) {
      appliedDefaults.push("equipmentSkillName");
    }

    if (
      !data.skillInfo.equipmentSkillDesc ||
      data.skillInfo.equipmentSkillDesc === ""
    ) {
      appliedDefaults.push("equipmentSkillDesc");
    }

    if (data.attributesInfo.hp.every((val) => val === 0)) {
      appliedDefaults.push("attributes");
    }

    if (!data.agentInfo.agentId) {
      appliedDefaults.push("agentId");
    }

    return appliedDefaults;
  }
}
