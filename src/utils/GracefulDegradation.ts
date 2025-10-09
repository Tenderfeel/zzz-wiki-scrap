import { logger } from "./Logger";

/**
 * グレースフルデグラデーション（段階的縮退）のためのユーティリティクラス
 */
export class GracefulDegradation {
  /**
   * 実装バージョン抽出の段階的縮退処理
   */
  public static handleReleaseVersionDegradation(
    characterId: string,
    apiData: any,
    primaryFailureReason: string
  ): {
    version: number;
    degradationLevel: "none" | "fallback" | "default";
    method: string;
    success: boolean;
  } {
    logger.debug("実装バージョン抽出の段階的縮退処理を開始", {
      characterId,
      primaryFailureReason,
    });

    // レベル1: 代替パスでの抽出を試行
    const fallbackResult = this.tryFallbackVersionExtraction(
      characterId,
      apiData
    );
    if (fallbackResult.success) {
      logger.info("代替パスでの実装バージョン抽出に成功", {
        characterId,
        version: fallbackResult.version,
        method: fallbackResult.method,
        degradationLevel: "fallback",
      });
      return {
        version: fallbackResult.version!,
        degradationLevel: "fallback",
        method: fallbackResult.method!,
        success: true,
      };
    }

    // レベル2: キャラクターIDベースの推定
    const estimatedResult = this.estimateVersionFromCharacterId(characterId);
    if (estimatedResult.success) {
      logger.warn("キャラクターIDベースでの実装バージョン推定を使用", {
        characterId,
        estimatedVersion: estimatedResult.version,
        method: estimatedResult.method,
        degradationLevel: "fallback",
        confidence: estimatedResult.confidence,
      });
      return {
        version: estimatedResult.version!,
        degradationLevel: "fallback",
        method: estimatedResult.method!,
        success: true,
      };
    }

    // レベル3: デフォルト値を使用
    logger.warn("すべての代替手段が失敗、デフォルト値を使用", {
      characterId,
      primaryFailureReason,
      fallbackFailureReason: fallbackResult.reason,
      estimationFailureReason: estimatedResult.reason,
      defaultVersion: 0,
      degradationLevel: "default",
    });

    return {
      version: 0,
      degradationLevel: "default",
      method: "default_value",
      success: false,
    };
  }

  /**
   * 代替パスでの実装バージョン抽出を試行
   */
  private static tryFallbackVersionExtraction(
    characterId: string,
    apiData: any
  ): {
    success: boolean;
    version?: number;
    method?: string;
    reason?: string;
  } {
    try {
      // 代替1: 他のコンポーネントから実装バージョン情報を探す
      const alternativeComponents = ["characterInfo", "basicInfo", "profile"];

      for (const componentType of alternativeComponents) {
        const result = this.searchVersionInComponent(
          apiData,
          componentType,
          characterId
        );
        if (result.success) {
          return {
            success: true,
            version: result.version,
            method: `alternative_component_${componentType}`,
          };
        }
      }

      // 代替2: モジュール名やページタイトルから推定
      const titleResult = this.extractVersionFromPageTitle(
        apiData,
        characterId
      );
      if (titleResult.success) {
        return {
          success: true,
          version: titleResult.version,
          method: "page_title_extraction",
        };
      }

      // 代替3: メタデータから推定
      const metadataResult = this.extractVersionFromMetadata(
        apiData,
        characterId
      );
      if (metadataResult.success) {
        return {
          success: true,
          version: metadataResult.version,
          method: "metadata_extraction",
        };
      }

      return {
        success: false,
        reason: "all_fallback_methods_failed",
      };
    } catch (error) {
      logger.debug("代替パスでの実装バージョン抽出中にエラー", {
        characterId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        reason: "fallback_extraction_error",
      };
    }
  }

  /**
   * 指定されたコンポーネントタイプで実装バージョンを検索
   */
  private static searchVersionInComponent(
    apiData: any,
    componentType: string,
    characterId: string
  ): {
    success: boolean;
    version?: number;
    reason?: string;
  } {
    try {
      const page = apiData?.data?.page;
      if (!page?.modules) {
        return { success: false, reason: "no_modules" };
      }

      for (const module of page.modules) {
        if (!module.components) continue;

        const component = module.components.find(
          (c: any) => c.component_id === componentType
        );

        if (component?.data) {
          const versionResult = this.searchVersionInComponentData(
            component.data,
            characterId
          );
          if (versionResult.success) {
            return versionResult;
          }
        }
      }

      return { success: false, reason: "component_not_found" };
    } catch (error) {
      return { success: false, reason: "search_error" };
    }
  }

  /**
   * コンポーネントデータ内で実装バージョンを検索
   */
  private static searchVersionInComponentData(
    componentData: string,
    characterId: string
  ): {
    success: boolean;
    version?: number;
    reason?: string;
  } {
    try {
      const data = JSON.parse(componentData);

      // 様々なキーパターンで検索
      const versionKeys = [
        "実装バージョン",
        "リリースバージョン",
        "バージョン",
        "version",
        "release_version",
        "implementation_version",
      ];

      if (data.list && Array.isArray(data.list)) {
        for (const item of data.list) {
          if (versionKeys.includes(item.key) && item.value) {
            const versionString = Array.isArray(item.value)
              ? item.value[0]
              : item.value;
            const parsedVersion = this.parseVersionString(versionString);
            if (parsedVersion > 0) {
              logger.debug("代替コンポーネントで実装バージョンを発見", {
                characterId,
                key: item.key,
                versionString,
                parsedVersion,
              });
              return { success: true, version: parsedVersion };
            }
          }
        }
      }

      return { success: false, reason: "version_not_found_in_data" };
    } catch (error) {
      return { success: false, reason: "json_parse_error" };
    }
  }

  /**
   * ページタイトルから実装バージョンを抽出
   */
  private static extractVersionFromPageTitle(
    apiData: any,
    characterId: string
  ): {
    success: boolean;
    version?: number;
    reason?: string;
  } {
    try {
      const page = apiData?.data?.page;
      const title = page?.name || page?.title;

      if (typeof title === "string") {
        const parsedVersion = this.parseVersionString(title);
        if (parsedVersion > 0) {
          logger.debug("ページタイトルから実装バージョンを抽出", {
            characterId,
            title,
            parsedVersion,
          });
          return { success: true, version: parsedVersion };
        }
      }

      return { success: false, reason: "no_version_in_title" };
    } catch (error) {
      return { success: false, reason: "title_extraction_error" };
    }
  }

  /**
   * メタデータから実装バージョンを抽出
   */
  private static extractVersionFromMetadata(
    apiData: any,
    characterId: string
  ): {
    success: boolean;
    version?: number;
    reason?: string;
  } {
    try {
      const page = apiData?.data?.page;

      // メタデータの様々な場所を検索
      const metadataFields = [
        page?.meta,
        page?.properties,
        page?.attributes,
        page?.filter_values,
      ];

      for (const metadata of metadataFields) {
        if (metadata && typeof metadata === "object") {
          const versionResult = this.searchVersionInObject(
            metadata,
            characterId
          );
          if (versionResult.success) {
            return versionResult;
          }
        }
      }

      return { success: false, reason: "no_version_in_metadata" };
    } catch (error) {
      return { success: false, reason: "metadata_extraction_error" };
    }
  }

  /**
   * オブジェクト内で実装バージョンを検索
   */
  private static searchVersionInObject(
    obj: any,
    characterId: string
  ): {
    success: boolean;
    version?: number;
    reason?: string;
  } {
    try {
      const searchInValue = (value: any): number | null => {
        if (typeof value === "string") {
          return this.parseVersionString(value);
        } else if (Array.isArray(value)) {
          for (const item of value) {
            const result = searchInValue(item);
            if (result && result > 0) return result;
          }
        } else if (value && typeof value === "object") {
          for (const [key, val] of Object.entries(value)) {
            if (
              key.toLowerCase().includes("version") ||
              key.includes("バージョン")
            ) {
              const result = searchInValue(val);
              if (result && result > 0) return result;
            }
          }
        }
        return null;
      };

      const version = searchInValue(obj);
      if (version && version > 0) {
        logger.debug("オブジェクト内で実装バージョンを発見", {
          characterId,
          version,
        });
        return { success: true, version };
      }

      return { success: false, reason: "version_not_found_in_object" };
    } catch (error) {
      return { success: false, reason: "object_search_error" };
    }
  }

  /**
   * キャラクターIDから実装バージョンを推定
   */
  private static estimateVersionFromCharacterId(characterId: string): {
    success: boolean;
    version?: number;
    method?: string;
    confidence?: string;
    reason?: string;
  } {
    try {
      // 既知のキャラクターIDパターンから推定
      const knownVersionMappings: Record<
        string,
        { version: number; confidence: string }
      > = {
        // Ver.1.0 キャラクター（初期リリース）
        anby: { version: 1.0, confidence: "high" },
        billy: { version: 1.0, confidence: "high" },
        nicole: { version: 1.0, confidence: "high" },
        nekomiya: { version: 1.0, confidence: "high" },
        corin: { version: 1.0, confidence: "high" },
        anton: { version: 1.0, confidence: "high" },
        ben: { version: 1.0, confidence: "high" },
        lycaon: { version: 1.0, confidence: "high" },
        koleda: { version: 1.0, confidence: "high" },
        soldier11: { version: 1.0, confidence: "high" },
        ellen: { version: 1.0, confidence: "high" },

        // Ver.1.1 キャラクター（推定）
        zhu_yuan: { version: 1.1, confidence: "medium" },
        qingyi: { version: 1.1, confidence: "medium" },

        // Ver.1.2 キャラクター（推定）
        jane: { version: 1.2, confidence: "medium" },
        seth: { version: 1.2, confidence: "medium" },
      };

      const normalizedId = characterId.toLowerCase().trim();
      const mapping = knownVersionMappings[normalizedId];

      if (mapping) {
        logger.debug("キャラクターIDベースでの実装バージョン推定成功", {
          characterId,
          normalizedId,
          estimatedVersion: mapping.version,
          confidence: mapping.confidence,
        });
        return {
          success: true,
          version: mapping.version,
          method: "character_id_mapping",
          confidence: mapping.confidence,
        };
      }

      // パターンベースの推定
      if (normalizedId.includes("1.0") || normalizedId.includes("v10")) {
        return {
          success: true,
          version: 1.0,
          method: "id_pattern_matching",
          confidence: "low",
        };
      }

      if (normalizedId.includes("1.1") || normalizedId.includes("v11")) {
        return {
          success: true,
          version: 1.1,
          method: "id_pattern_matching",
          confidence: "low",
        };
      }

      return {
        success: false,
        reason: "no_estimation_possible",
      };
    } catch (error) {
      return {
        success: false,
        reason: "estimation_error",
      };
    }
  }

  /**
   * バージョン文字列を解析（簡易版）
   */
  private static parseVersionString(versionString: string): number {
    if (!versionString || typeof versionString !== "string") {
      return 0;
    }

    try {
      // HTMLタグを除去
      const cleanString = versionString.replace(/<[^>]*>/g, "");

      // Ver.X.Y パターンを抽出
      const patterns = [
        /Ver\.(\d+\.\d+)/,
        /version\s*(\d+\.\d+)/i,
        /v(\d+\.\d+)/i,
        /(\d+\.\d+)/,
      ];

      for (const pattern of patterns) {
        const match = cleanString.match(pattern);
        if (match && match[1]) {
          const version = parseFloat(match[1]);
          if (!isNaN(version) && version > 0) {
            return version;
          }
        }
      }

      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * エラー回復の試行
   */
  public static attemptErrorRecovery(
    characterId: string,
    error: Error,
    apiData?: any
  ): {
    recovered: boolean;
    version?: number;
    method?: string;
    suggestion?: string;
  } {
    logger.debug("エラー回復処理を開始", {
      characterId,
      errorMessage: error.message,
      errorType: error.constructor.name,
    });

    // APIデータが利用可能な場合、段階的縮退を試行
    if (apiData) {
      const degradationResult = this.handleReleaseVersionDegradation(
        characterId,
        apiData,
        error.message
      );

      if (degradationResult.success && degradationResult.version > 0) {
        return {
          recovered: true,
          version: degradationResult.version,
          method: degradationResult.method,
        };
      }
    }

    // キャラクターIDベースの推定のみ試行
    const estimationResult = this.estimateVersionFromCharacterId(characterId);
    if (estimationResult.success) {
      return {
        recovered: true,
        version: estimationResult.version,
        method: estimationResult.method,
      };
    }

    // 回復不可能
    return {
      recovered: false,
      suggestion: "手動でのバージョン情報確認を推奨します",
    };
  }
}
