import { HoyoLabApiClient } from "../../src/clients/HoyoLabApiClient";
import { WeaponDataMapper } from "../../src/mappers/WeaponDataMapper";
import { logger } from "../../src/utils/Logger";
import { ApiResponse } from "../../src/types/api";

/**
 * エージェント抽出デバッグ情報の型定義
 */
export interface AgentExtractionDebugInfo {
  step: string;
  success: boolean;
  data?: any;
  error?: string;
  agentValue?: string;
  extractedName?: string;
  mappedId?: string;
  timestamp: number;
  duration?: number;
}

/**
 * エージェント抽出デバッグ結果の型定義
 */
export interface AgentExtractionDebugResult {
  weaponId: string;
  success: boolean;
  finalAgentId: string;
  steps: AgentExtractionDebugInfo[];
  totalDuration: number;
  error?: string;
}

/**
 * 複数武器のデバッグ結果の型定義
 */
export interface MultipleWeaponDebugResult {
  totalWeapons: number;
  successfulExtractions: number;
  failedExtractions: number;
  results: Map<string, AgentExtractionDebugResult>;
  summary: {
    successRate: number;
    averageDuration: number;
    commonErrors: Map<string, number>;
    extractedAgents: Map<string, number>;
  };
}

/**
 * エージェント抽出プロセスをデバッグするためのクラス
 * 実際のAPIデータを使用してagentId抽出の各ステップを監視・記録する
 */
export class AgentExtractionDebugger {
  private apiClient: HoyoLabApiClient;
  private weaponMapper: WeaponDataMapper;

  constructor() {
    this.apiClient = new HoyoLabApiClient();
    this.weaponMapper = new WeaponDataMapper();
  }

  /**
   * 単一武器のエージェント抽出をテストし、詳細なデバッグ情報を収集
   * @param weaponId 武器ID（entry_page_id）
   * @returns デバッグ結果
   */
  async testSpecificWeapon(
    weaponId: string
  ): Promise<AgentExtractionDebugResult> {
    const startTime = Date.now();
    const steps: AgentExtractionDebugInfo[] = [];
    let finalAgentId = "";
    let success = false;
    let error: string | undefined;

    try {
      // ステップ1: API データ取得
      const apiStep = this.createDebugStep("API データ取得");
      let apiResponse: ApiResponse;

      try {
        apiResponse = await this.apiClient.fetchCharacterData(
          parseInt(weaponId),
          "ja-jp"
        );
        apiStep.success = true;
        apiStep.data = {
          hasData: !!apiResponse.data,
          hasPage: !!apiResponse.data?.page,
          hasModules: !!apiResponse.data?.page?.modules,
          moduleCount: apiResponse.data?.page?.modules?.length || 0,
        };
        this.completeDebugStep(apiStep);
      } catch (apiError) {
        apiStep.success = false;
        apiStep.error =
          apiError instanceof Error ? apiError.message : String(apiError);
        this.completeDebugStep(apiStep);
        steps.push(apiStep);
        throw apiError;
      }
      steps.push(apiStep);

      // ステップ2: baseInfo コンポーネント検索
      const baseInfoStep = this.createDebugStep("baseInfo コンポーネント検索");
      let baseInfoComponent;

      try {
        const modules = apiResponse.data.page.modules;
        baseInfoComponent = this.findComponentByType(modules, "baseInfo");

        baseInfoStep.success = !!baseInfoComponent;
        baseInfoStep.data = {
          totalModules: modules.length,
          foundBaseInfo: !!baseInfoComponent,
          availableComponents: modules.flatMap((m) =>
            m.components.map((c) => c.component_id)
          ),
        };

        if (!baseInfoComponent) {
          baseInfoStep.error = "baseInfo コンポーネントが見つかりません";
        }
        this.completeDebugStep(baseInfoStep);
      } catch (baseInfoError) {
        baseInfoStep.success = false;
        baseInfoStep.error =
          baseInfoError instanceof Error
            ? baseInfoError.message
            : String(baseInfoError);
        this.completeDebugStep(baseInfoStep);
      }
      steps.push(baseInfoStep);

      if (!baseInfoComponent) {
        return {
          weaponId,
          success: false,
          finalAgentId: "",
          steps,
          totalDuration: Date.now() - startTime,
          error: "baseInfo コンポーネントが見つかりません",
        };
      }

      // ステップ3: baseInfo データ解析
      const parseStep = this.createDebugStep("baseInfo データ解析");
      let baseInfoData;

      try {
        baseInfoData = JSON.parse(baseInfoComponent.data);
        parseStep.success = true;
        parseStep.data = {
          hasData: !!baseInfoData,
          hasList: !!baseInfoData.list,
          itemCount: baseInfoData.list?.length || 0,
          availableKeys: baseInfoData.list?.map((item: any) => item.key) || [],
        };
        this.completeDebugStep(parseStep);
      } catch (parseError) {
        parseStep.success = false;
        parseStep.error =
          parseError instanceof Error ? parseError.message : String(parseError);
        this.completeDebugStep(parseStep);
        steps.push(parseStep);
        throw parseError;
      }
      steps.push(parseStep);

      // ステップ4: 該当エージェント項目検索
      const agentSearchStep = this.createDebugStep("該当エージェント項目検索");
      let agentItem;

      try {
        agentItem = baseInfoData.list.find(
          (item: any) => item.key === "該当エージェント"
        );

        agentSearchStep.success = !!agentItem;
        agentSearchStep.data = {
          foundAgentItem: !!agentItem,
          agentItemStructure: agentItem
            ? {
                hasKey: !!agentItem.key,
                hasValue: !!agentItem.value,
                hasValues: !!agentItem.values,
                valueType: agentItem.value ? typeof agentItem.value : undefined,
                valuesType: agentItem.values
                  ? typeof agentItem.values
                  : undefined,
              }
            : null,
        };

        if (!agentItem) {
          agentSearchStep.error = "該当エージェント項目が見つかりません";
        }
        this.completeDebugStep(agentSearchStep);
      } catch (searchError) {
        agentSearchStep.success = false;
        agentSearchStep.error =
          searchError instanceof Error
            ? searchError.message
            : String(searchError);
        this.completeDebugStep(agentSearchStep);
      }
      steps.push(agentSearchStep);

      if (!agentItem) {
        return {
          weaponId,
          success: false,
          finalAgentId: "",
          steps,
          totalDuration: Date.now() - startTime,
          error: "該当エージェント項目が見つかりません",
        };
      }

      // ステップ5: value 配列検証
      const valueValidationStep = this.createDebugStep("value 配列検証");
      let agentValues;

      try {
        agentValues = agentItem.value || agentItem.values;

        const isValidArray =
          Array.isArray(agentValues) && agentValues.length > 0;
        valueValidationStep.success = isValidArray;
        valueValidationStep.data = {
          hasValue: !!agentItem.value,
          hasValues: !!agentItem.values,
          isArray: Array.isArray(agentValues),
          arrayLength: Array.isArray(agentValues) ? agentValues.length : 0,
          firstValuePreview:
            Array.isArray(agentValues) && agentValues.length > 0
              ? agentValues[0].substring(0, 100) + "..."
              : null,
        };

        if (!isValidArray) {
          valueValidationStep.error = "有効な value 配列が存在しません";
        }
        this.completeDebugStep(valueValidationStep);
      } catch (validationError) {
        valueValidationStep.success = false;
        valueValidationStep.error =
          validationError instanceof Error
            ? validationError.message
            : String(validationError);
        this.completeDebugStep(valueValidationStep);
      }
      steps.push(valueValidationStep);

      if (!Array.isArray(agentValues) || agentValues.length === 0) {
        return {
          weaponId,
          success: false,
          finalAgentId: "",
          steps,
          totalDuration: Date.now() - startTime,
          error: "有効な value 配列が存在しません",
        };
      }

      // ステップ6: エージェント名抽出
      const nameExtractionStep = this.createDebugStep("エージェント名抽出");
      let extractedName = "";

      try {
        const agentValue = agentValues[0];
        nameExtractionStep.agentValue = agentValue.substring(0, 200) + "...";

        // WeaponDataMapperの抽出ロジックを使用
        extractedName = (this.weaponMapper as any).extractAgentNameFromValue(
          agentValue
        );

        nameExtractionStep.success = !!extractedName;
        nameExtractionStep.extractedName = extractedName;
        nameExtractionStep.data = {
          agentValueLength: agentValue.length,
          extractedName,
          hasJsonMatch: /\$\[(.*?)\]\$/.test(agentValue),
        };

        if (!extractedName) {
          nameExtractionStep.error = "エージェント名の抽出に失敗しました";
        }
        this.completeDebugStep(nameExtractionStep);
      } catch (extractionError) {
        nameExtractionStep.success = false;
        nameExtractionStep.error =
          extractionError instanceof Error
            ? extractionError.message
            : String(extractionError);
        this.completeDebugStep(nameExtractionStep);
      }
      steps.push(nameExtractionStep);

      // ステップ7: agentId マッピング
      const mappingStep = this.createDebugStep("agentId マッピング");

      try {
        const { getAgentIdByName } = await import(
          "../../src/utils/AgentMapping"
        );
        finalAgentId = getAgentIdByName(extractedName);

        mappingStep.success = !!finalAgentId;
        mappingStep.extractedName = extractedName;
        mappingStep.mappedId = finalAgentId;
        mappingStep.data = {
          inputName: extractedName,
          outputId: finalAgentId,
        };

        if (!finalAgentId) {
          mappingStep.error =
            "エージェント名からIDへのマッピングに失敗しました";
        }
        this.completeDebugStep(mappingStep);
      } catch (mappingError) {
        mappingStep.success = false;
        mappingStep.error =
          mappingError instanceof Error
            ? mappingError.message
            : String(mappingError);
        this.completeDebugStep(mappingStep);
      }
      steps.push(mappingStep);

      success = !!finalAgentId;
    } catch (overallError) {
      error =
        overallError instanceof Error
          ? overallError.message
          : String(overallError);
      logger.error("エージェント抽出デバッグ中にエラーが発生しました", {
        weaponId,
        error,
      });
    }

    return {
      weaponId,
      success,
      finalAgentId,
      steps,
      totalDuration: Date.now() - startTime,
      error,
    };
  }

  /**
   * 複数武器のエージェント抽出を一括テストし、統計情報を収集
   * @param weaponIds 武器IDの配列
   * @returns 複数武器のデバッグ結果
   */
  async testMultipleWeapons(
    weaponIds: string[]
  ): Promise<MultipleWeaponDebugResult> {
    const results = new Map<string, AgentExtractionDebugResult>();
    const commonErrors = new Map<string, number>();
    const extractedAgents = new Map<string, number>();
    let successfulExtractions = 0;
    let totalDuration = 0;

    logger.info("複数武器のエージェント抽出テストを開始", {
      totalWeapons: weaponIds.length,
    });

    for (let i = 0; i < weaponIds.length; i++) {
      const weaponId = weaponIds[i];

      try {
        logger.debug(`武器 ${i + 1}/${weaponIds.length} のテスト開始`, {
          weaponId,
        });

        const result = await this.testSpecificWeapon(weaponId);
        results.set(weaponId, result);
        totalDuration += result.totalDuration;

        if (result.success) {
          successfulExtractions++;
          const count = extractedAgents.get(result.finalAgentId) || 0;
          extractedAgents.set(result.finalAgentId, count + 1);
        } else if (result.error) {
          const count = commonErrors.get(result.error) || 0;
          commonErrors.set(result.error, count + 1);
        }

        // API レート制限を避けるための遅延
        if (i < weaponIds.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error("武器テスト中にエラーが発生しました", {
          weaponId,
          error: errorMessage,
        });

        const count = commonErrors.get(errorMessage) || 0;
        commonErrors.set(errorMessage, count + 1);

        results.set(weaponId, {
          weaponId,
          success: false,
          finalAgentId: "",
          steps: [],
          totalDuration: 0,
          error: errorMessage,
        });
      }
    }

    const failedExtractions = weaponIds.length - successfulExtractions;
    const successRate = (successfulExtractions / weaponIds.length) * 100;
    const averageDuration = totalDuration / weaponIds.length;

    logger.info("複数武器のエージェント抽出テスト完了", {
      totalWeapons: weaponIds.length,
      successful: successfulExtractions,
      failed: failedExtractions,
      successRate: `${successRate.toFixed(2)}%`,
      averageDuration: `${averageDuration.toFixed(2)}ms`,
    });

    return {
      totalWeapons: weaponIds.length,
      successfulExtractions,
      failedExtractions,
      results,
      summary: {
        successRate,
        averageDuration,
        commonErrors,
        extractedAgents,
      },
    };
  }

  /**
   * デバッグ結果を詳細に表示
   * @param result 単一武器のデバッグ結果
   */
  displayDetailedResult(result: AgentExtractionDebugResult): void {
    console.log(
      `\n=== 武器 ${result.weaponId} のエージェント抽出デバッグ結果 ===`
    );
    console.log(`最終結果: ${result.success ? "成功" : "失敗"}`);
    console.log(`抽出されたエージェントID: ${result.finalAgentId || "なし"}`);
    console.log(`総処理時間: ${result.totalDuration}ms`);

    if (result.error) {
      console.log(`エラー: ${result.error}`);
    }

    console.log(`\n--- 処理ステップ詳細 ---`);
    result.steps.forEach((step, index) => {
      console.log(
        `${index + 1}. ${step.step}: ${step.success ? "✓" : "✗"} (${
          step.duration || 0
        }ms)`
      );

      if (step.error) {
        console.log(`   エラー: ${step.error}`);
      }

      if (step.extractedName) {
        console.log(`   抽出名: ${step.extractedName}`);
      }

      if (step.mappedId) {
        console.log(`   マッピングID: ${step.mappedId}`);
      }

      if (step.data) {
        console.log(`   データ: ${JSON.stringify(step.data, null, 2)}`);
      }
    });
  }

  /**
   * 複数武器のデバッグ結果サマリーを表示
   * @param result 複数武器のデバッグ結果
   */
  displaySummary(result: MultipleWeaponDebugResult): void {
    console.log(`\n=== 複数武器エージェント抽出テスト サマリー ===`);
    console.log(`総武器数: ${result.totalWeapons}`);
    console.log(
      `成功: ${
        result.successfulExtractions
      } (${result.summary.successRate.toFixed(2)}%)`
    );
    console.log(`失敗: ${result.failedExtractions}`);
    console.log(`平均処理時間: ${result.summary.averageDuration.toFixed(2)}ms`);

    if (result.summary.extractedAgents.size > 0) {
      console.log(`\n--- 抽出されたエージェント ---`);
      Array.from(result.summary.extractedAgents.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([agentId, count]) => {
          console.log(`${agentId}: ${count}件`);
        });
    }

    if (result.summary.commonErrors.size > 0) {
      console.log(`\n--- よくあるエラー ---`);
      Array.from(result.summary.commonErrors.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([error, count]) => {
          console.log(`${error}: ${count}件`);
        });
    }
  }

  // プライベートヘルパーメソッド

  private createDebugStep(stepName: string): AgentExtractionDebugInfo {
    return {
      step: stepName,
      success: false,
      timestamp: Date.now(),
    };
  }

  private completeDebugStep(step: AgentExtractionDebugInfo): void {
    step.duration = Date.now() - step.timestamp;
  }

  private findComponentByType(
    modules: any[],
    componentType: string
  ): any | null {
    for (const module of modules) {
      const component = module.components.find(
        (comp: any) => comp.component_id === componentType
      );
      if (component) {
        return component;
      }
    }
    return null;
  }
}

/**
 * デバッグスクリプトの使用例
 * 実際のAPIデータを使用してエージェント抽出をテストする
 */
export async function runDebugExample(): Promise<void> {
  const agentDebugger = new AgentExtractionDebugger();

  // 単一武器のテスト例
  console.log("=== 単一武器テスト例 ===");
  try {
    // 例: リュシアの武器をテスト（実際のweaponIdに置き換えてください）
    const singleResult = await agentDebugger.testSpecificWeapon("1234");
    agentDebugger.displayDetailedResult(singleResult);
  } catch (error) {
    console.error("単一武器テストでエラーが発生しました:", error);
  }

  // 複数武器のテスト例
  console.log("\n=== 複数武器テスト例 ===");
  try {
    // 例: 複数のS級武器をテスト（実際のweaponIdに置き換えてください）
    const multipleResult = await agentDebugger.testMultipleWeapons([
      "1234",
      "1235",
      "1236",
    ]);
    agentDebugger.displaySummary(multipleResult);
  } catch (error) {
    console.error("複数武器テストでエラーが発生しました:", error);
  }
}

// スクリプトが直接実行された場合のエントリーポイント
if (require.main === module) {
  runDebugExample().catch(console.error);
}
