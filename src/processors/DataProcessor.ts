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
      const attackType = filterValues?.agent_attack_type?.values?.[0];
      const rarity = filterValues?.agent_rarity?.values?.[0];

      if (!specialty) {
        throw new ParsingError("特性データ(agent_specialties)が見つかりません");
      }
      if (!stats) {
        throw new ParsingError("属性データ(agent_stats)が見つかりません");
      }
      if (!attackType) {
        throw new ParsingError(
          "攻撃タイプデータ(agent_attack_type)が見つかりません"
        );
      }
      if (!rarity) {
        throw new ParsingError("レア度データ(agent_rarity)が見つかりません");
      }

      return {
        id: page.id,
        name: page.name,
        specialty,
        stats,
        attackType,
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
