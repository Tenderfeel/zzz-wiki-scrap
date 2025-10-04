import { ApiResponse, Module, Component } from "../types/api";
import {
  BasicCharacterInfo,
  FactionInfo,
  AttributesInfo,
} from "../types/processing";
import factions from "../../data/factions";
import { ParsingError, MappingError } from "../errors";

/**
 * データプロセッサー - API レスポンスからキャラクター情報を抽出
 */
export class DataProcessor {
  /**
   * 基本キャラクター情報を抽出
   * 要件: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
   */
  extractBasicInfo(apiData: ApiResponse): BasicCharacterInfo {
    try {
      const page = apiData.data.page;

      if (!page) {
        throw new ParsingError("APIレスポンスにpageデータが存在しません");
      }

      // filter_valuesからデータを抽出
      const filterValues = (page as any).filter_values;

      if (!filterValues) {
        throw new ParsingError("APIレスポンスにfilter_valuesが存在しません");
      }

      // 必須フィールドの存在確認
      const specialty = filterValues?.agent_specialties?.values?.[0];
      const stats = filterValues?.agent_stats?.values?.[0];
      // 攻撃タイプは複数の場合があるため、全ての値を取得
      const attackTypeValues = filterValues?.agent_attack_type?.values;
      const rarity = filterValues?.agent_rarity?.values?.[0];

      if (!specialty) {
        throw new ParsingError("特性データ(agent_specialties)が見つかりません");
      }
      if (!stats) {
        throw new ParsingError("属性データ(agent_stats)が見つかりません");
      }
      if (!attackTypeValues || attackTypeValues.length === 0) {
        // デバッグ情報を追加
        console.warn(
          `攻撃タイプデータが見つかりません。利用可能なfilter_values:`,
          Object.keys(filterValues)
        );

        // 代替手段として、他の場所から攻撃タイプを探す
        const alternativeAttackType = this.findAlternativeAttackType(apiData);
        if (!alternativeAttackType) {
          throw new ParsingError(
            "攻撃タイプデータ(agent_attack_type)が見つかりません"
          );
        }
        return {
          id: page.id,
          name: page.name,
          specialty,
          stats,
          attackType: [alternativeAttackType], // 配列として返す
          rarity,
        };
      }
      if (!rarity) {
        throw new ParsingError("レア度データ(agent_rarity)が見つかりません");
      }

      return {
        id: page.id,
        name: page.name,
        specialty,
        stats,
        attackType: attackTypeValues, // 複数の攻撃タイプを配列として返す
        rarity,
      };
    } catch (error) {
      if (error instanceof ParsingError) {
        throw error;
      }
      throw new ParsingError(
        "基本キャラクター情報の抽出に失敗しました",
        error as Error
      );
    }
  }

  /**
   * 陣営情報を抽出
   * 要件: 3.1, 3.2, 3.3
   */
  extractFactionInfo(apiData: ApiResponse): FactionInfo {
    try {
      const page = apiData.data.page;

      if (!page) {
        throw new ParsingError("APIレスポンスにpageデータが存在しません");
      }

      // filter_valuesから陣営名を取得
      const filterValues = (page as any).filter_values;

      if (!filterValues) {
        throw new ParsingError("APIレスポンスにfilter_valuesが存在しません");
      }

      const factionName = filterValues?.agent_faction?.values?.[0];

      if (!factionName) {
        throw new ParsingError("陣営情報(agent_faction)が見つかりません");
      }

      // 陣営名からIDを解決
      const factionId = this.resolveFactionId(factionName);

      return {
        id: factionId,
        name: factionName,
      };
    } catch (error) {
      if (error instanceof ParsingError || error instanceof MappingError) {
        throw error;
      }
      throw new ParsingError("陣営情報の抽出に失敗しました", error as Error);
    }
  }

  /**
   * 属性データを抽出
   * 要件: 4.1, 4.2
   */
  extractAttributes(apiData: ApiResponse): AttributesInfo {
    try {
      const page = apiData.data.page;

      if (!page) {
        throw new ParsingError("APIレスポンスにpageデータが存在しません");
      }

      if (!page.modules || !Array.isArray(page.modules)) {
        throw new ParsingError(
          "APIレスポンスにmodulesが存在しないか、配列ではありません"
        );
      }

      // ascensionコンポーネントを特定
      const ascensionComponent = this.findComponent(page.modules, "ascension");
      if (!ascensionComponent) {
        throw new ParsingError("ascensionコンポーネントが見つかりません");
      }

      if (!ascensionComponent.data) {
        throw new ParsingError("ascensionコンポーネントにdataが存在しません");
      }

      return {
        ascensionData: ascensionComponent.data,
      };
    } catch (error) {
      if (error instanceof ParsingError) {
        throw error;
      }
      throw new ParsingError("属性データの抽出に失敗しました", error as Error);
    }
  }

  /**
   * 陣営名から/data/factions.tsのIDにマッピング
   */
  resolveFactionId(factionName: string): number {
    try {
      const faction = factions.find((f) => f.name.ja === factionName);
      if (!faction) {
        const availableFactions = factions.map((f) => f.name.ja).join(", ");
        throw new MappingError(
          `未知の陣営名: "${factionName}". 利用可能な陣営: ${availableFactions}`
        );
      }
      return faction.id;
    } catch (error) {
      if (error instanceof MappingError) {
        throw error;
      }
      throw new MappingError("陣営IDの解決に失敗しました", error as Error);
    }
  }

  /**
   * 代替手段で攻撃タイプを検索
   */
  private findAlternativeAttackType(apiData: ApiResponse): string | null {
    try {
      const page = apiData.data.page;

      // 1. modulesから攻撃タイプ情報を探す
      if (page.modules && Array.isArray(page.modules)) {
        for (const module of page.modules) {
          if (module.components && Array.isArray(module.components)) {
            for (const component of module.components) {
              if (component.data) {
                try {
                  const componentData = JSON.parse(component.data);
                  // 攻撃タイプに関連する可能性のあるフィールドを探す
                  if (componentData.attack_type || componentData.attackType) {
                    return (
                      componentData.attack_type || componentData.attackType
                    );
                  }
                } catch (e) {
                  // JSON解析に失敗した場合は無視
                }
              }
            }
          }
        }
      }

      // 2. デフォルト値を返す（最後の手段）
      console.warn(
        `攻撃タイプが見つからないため、デフォルト値 "strike" を使用します`
      );
      return "strike"; // デフォルトとして打撃を使用
    } catch (error) {
      console.warn(`代替攻撃タイプ検索中にエラー:`, error);
      return "strike"; // エラー時もデフォルト値
    }
  }

  /**
   * モジュールから指定されたコンポーネントを検索
   */
  private findComponent(
    modules: Module[],
    componentId: string
  ): Component | null {
    for (const module of modules) {
      const component = module.components.find(
        (c) => c.component_id === componentId
      );
      if (component) {
        return component;
      }
    }
    return null;
  }
}
