import { DataMapper } from "./DataMapper";
import {
  ApiResponse,
  Module,
  Component,
  BaseInfoData,
  AscensionData,
} from "../types/api";
import {
  BasicWeaponInfo,
  WeaponSkillInfo,
  WeaponAttributesInfo,
  WeaponAgentInfo,
  Attribute,
  Lang,
} from "../types/index";
import { MappingError } from "../errors";
import { logger } from "../utils/Logger";

/**
 * 音動機データマッピング機能を提供するクラス
 * API応答から音動機データを抽出・変換する
 */
export class WeaponDataMapper extends DataMapper {
  /**
   * API応答から基本武器情報を抽出
   * @param apiResponse API応答データ
   * @param weaponId 音動機ID
   * @returns 基本武器情報
   */
  public extractBasicWeaponInfo(
    apiResponse: ApiResponse,
    weaponId: string
  ): BasicWeaponInfo {
    try {
      const pageData = apiResponse.data.page;

      // 基本情報の抽出
      const basicInfo: BasicWeaponInfo = {
        id: weaponId,
        name: pageData.name || "",
        rarity: "",
        specialty: undefined,
      };

      // レア度の抽出（filter_values.w_engine_rarity.values[0]）
      if (pageData.filter_values?.w_engine_rarity?.values?.[0]) {
        basicInfo.rarity = pageData.filter_values.w_engine_rarity.values[0];
      }

      // 特性の抽出（filter_values.filter_key_13.values[0]）
      if (pageData.filter_values?.filter_key_13?.values?.[0]) {
        basicInfo.specialty = pageData.filter_values.filter_key_13.values[0];
      }

      logger.debug("基本武器情報抽出成功", {
        weaponId,
        name: basicInfo.name,
        rarity: basicInfo.rarity,
        specialty: basicInfo.specialty,
      });

      return basicInfo;
    } catch (error) {
      logger.error("基本武器情報抽出中にエラーが発生しました", {
        weaponId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new MappingError(
        `基本武器情報の抽出に失敗しました (武器ID: ${weaponId})`,
        error as Error
      );
    }
  }

  /**
   * equipment_skillコンポーネントからスキル情報を抽出
   * @param modules モジュール配列
   * @returns スキル情報
   */
  public extractWeaponSkillInfo(modules: Module[]): WeaponSkillInfo {
    try {
      // equipment_skillコンポーネントを検索
      const equipmentSkillComponent = this.findComponentByType(
        modules,
        "equipment_skill"
      );

      if (!equipmentSkillComponent) {
        logger.warn("equipment_skillコンポーネントが見つかりません");
        return {
          equipmentSkillName: "",
          equipmentSkillDesc: "",
        };
      }

      const skillData = JSON.parse(equipmentSkillComponent.data);

      // HTMLタグを除去してテキストをクリーニング
      const skillName = this.cleanHtmlText(skillData.skill_name || "");
      const skillDesc = this.cleanHtmlText(skillData.skill_desc || "");

      logger.debug("スキル情報抽出成功", {
        skillName,
        skillDescLength: skillDesc.length,
      });

      return {
        equipmentSkillName: skillName,
        equipmentSkillDesc: skillDesc,
      };
    } catch (error) {
      logger.error("スキル情報抽出中にエラーが発生しました", {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        equipmentSkillName: "",
        equipmentSkillDesc: "",
      };
    }
  }

  /**
   * ascensionコンポーネントから突破ステータスを抽出
   * 7レベル分の「後」の値（配列インデックス1）のみを取得
   * @param modules モジュール配列
   * @returns 突破ステータス
   */
  public extractWeaponAttributes(modules: Module[]): WeaponAttributesInfo {
    try {
      // ascensionコンポーネントを検索
      const ascensionComponent = this.findComponentByType(modules, "ascension");

      if (!ascensionComponent) {
        logger.warn("ascensionコンポーネントが見つかりません");
        return this.createEmptyWeaponAttributes();
      }

      const ascensionData: AscensionData = JSON.parse(ascensionComponent.data);

      // 7レベル分のデータを初期化
      const attributes: WeaponAttributesInfo =
        this.createEmptyWeaponAttributes();

      // レベル順序（0, 10, 20, 30, 40, 50, 60）
      const levelOrder = ["0", "10", "20", "30", "40", "50", "60"];

      levelOrder.forEach((level, index) => {
        const levelData = ascensionData.list.find((item) => item.key === level);
        if (levelData && levelData.combatList) {
          // 各ステータスを処理
          levelData.combatList.forEach((combat) => {
            if (combat.key && combat.values && combat.values.length > 1) {
              const statName = combat.key;
              const afterValue = combat.values[1]; // 「後」の値

              // ステータス名を属性にマッピング
              const mappedAttribute = this.mapStatNameToAttribute(statName);
              if (mappedAttribute && afterValue !== "-") {
                const numericValue = this.parseNumericValue(afterValue);
                if (numericValue !== null) {
                  (attributes[mappedAttribute] as number[])[index] =
                    numericValue;
                }
              }
            }
          });
        }
      });

      logger.debug("突破ステータス抽出成功", {
        extractedLevels: levelOrder.length,
      });

      return attributes;
    } catch (error) {
      logger.error("突破ステータス抽出中にエラーが発生しました", {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.createEmptyWeaponAttributes();
    }
  }

  /**
   * baseInfoから該当エージェント情報を抽出
   * @param modules モジュール配列
   * @returns エージェント情報
   */
  public extractAgentInfo(modules: Module[]): WeaponAgentInfo {
    try {
      // baseInfoコンポーネントを検索
      const baseInfoComponent = this.findComponentByType(modules, "baseInfo");

      if (!baseInfoComponent) {
        logger.warn("baseInfoコンポーネントが見つかりません");
        return { agentId: undefined };
      }

      const baseInfoData: BaseInfoData = JSON.parse(baseInfoComponent.data);

      // 該当エージェント情報を検索
      const agentItem = baseInfoData.list.find(
        (item) => item.key === "該当エージェント"
      );

      if (!agentItem || !agentItem.values || agentItem.values.length === 0) {
        logger.debug("該当エージェント情報が見つかりません");
        return { agentId: undefined };
      }

      // エージェント情報からep_idを抽出
      const agentValue = agentItem.values[0];
      const epIdMatch = agentValue.match(/"ep_id":\s*(\d+)/);

      if (epIdMatch && epIdMatch[1]) {
        const agentId = epIdMatch[1];
        logger.debug("エージェント情報抽出成功", { agentId });
        return { agentId };
      }

      logger.debug("ep_idが見つかりません", { agentValue });
      return { agentId: undefined };
    } catch (error) {
      logger.error("エージェント情報抽出中にエラーが発生しました", {
        error: error instanceof Error ? error.message : String(error),
      });
      return { agentId: undefined };
    }
  }

  /**
   * 基礎・上級ステータス属性を判定
   * 「基礎」が付く項目から「基礎」を除いた属性名を抽出
   * @param modules モジュール配列
   * @returns 基礎・上級ステータス属性
   */
  public extractBaseAndAdvancedAttributes(modules: Module[]): {
    baseAttr: Attribute;
    advancedAttr: Attribute;
  } {
    try {
      // baseInfoコンポーネントを検索
      const baseInfoComponent = this.findComponentByType(modules, "baseInfo");

      if (!baseInfoComponent) {
        logger.warn("baseInfoコンポーネントが見つかりません");
        return this.getDefaultAttributes();
      }

      const baseInfoData: BaseInfoData = JSON.parse(baseInfoComponent.data);

      let baseAttr: Attribute = "atk"; // デフォルト値
      let advancedAttr: Attribute = "critRate"; // デフォルト値

      // 基礎ステータスを検索
      const baseStatItem = baseInfoData.list.find(
        (item) => item.key === "基礎ステータス"
      );
      if (
        baseStatItem &&
        baseStatItem.values &&
        baseStatItem.values.length > 0
      ) {
        const baseStatValue = this.cleanHtmlText(baseStatItem.values[0]);
        const mappedBaseAttr = this.mapBaseStatToAttribute(baseStatValue);
        if (mappedBaseAttr) {
          baseAttr = mappedBaseAttr;
        }
      }

      // 上級ステータスを検索
      const advancedStatItem = baseInfoData.list.find(
        (item) => item.key === "上級ステータス"
      );
      if (
        advancedStatItem &&
        advancedStatItem.values &&
        advancedStatItem.values.length > 0
      ) {
        const advancedStatValue = this.cleanHtmlText(
          advancedStatItem.values[0]
        );
        const mappedAdvancedAttr =
          this.mapStatNameToAttribute(advancedStatValue);
        if (mappedAdvancedAttr) {
          advancedAttr = mappedAdvancedAttr;
        }
      }

      logger.debug("基礎・上級ステータス抽出成功", {
        baseAttr,
        advancedAttr,
      });

      return { baseAttr, advancedAttr };
    } catch (error) {
      logger.error("基礎・上級ステータス抽出中にエラーが発生しました", {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.getDefaultAttributes();
    }
  }

  // プライベートヘルパーメソッド

  /**
   * 指定されたタイプのコンポーネントを検索
   */
  private findComponentByType(
    modules: Module[],
    componentType: string
  ): Component | null {
    for (const module of modules) {
      const component = module.components.find(
        (comp) => comp.component_id === componentType
      );
      if (component) {
        return component;
      }
    }
    return null;
  }

  /**
   * HTMLタグを除去してテキストをクリーニング
   */
  private cleanHtmlText(text: string): string {
    if (!text) return "";
    return text
      .replace(/<[^>]*>/g, "") // HTMLタグを除去
      .replace(/&nbsp;/g, " ") // &nbsp;をスペースに変換
      .replace(/&lt;/g, "<") // &lt;を<に変換
      .replace(/&gt;/g, ">") // &gt;を>に変換
      .replace(/&amp;/g, "&") // &amp;を&に変換
      .trim();
  }

  /**
   * 空の音動機属性オブジェクトを作成
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
   * ステータス名を属性にマッピング
   */
  private mapStatNameToAttribute(statName: string): Attribute | null {
    const mapping: Record<string, Attribute> = {
      HP: "hp",
      基礎攻撃力: "atk",
      攻撃力: "atk",
      防御力: "def",
      衝撃力: "impact",
      会心率: "critRate",
      会心ダメージ: "critDmg",
      異常マスタリー: "anomalyMastery",
      異常掌握: "anomalyProficiency",
      貫通率: "penRatio",
      エネルギー自動回復: "energy",
    };

    return mapping[statName] || null;
  }

  /**
   * 基礎ステータス名を属性にマッピング（「基礎」を除去）
   */
  private mapBaseStatToAttribute(baseStatName: string): Attribute | null {
    // 「基礎」を除去
    const cleanedName = baseStatName.replace(/^基礎/, "");
    return this.mapStatNameToAttribute(cleanedName);
  }

  /**
   * 数値文字列を数値に変換
   */
  private parseNumericValue(value: string): number | null {
    if (!value || value === "-") return null;

    // パーセント記号を除去
    const cleanedValue = value.replace(/%$/, "");

    const numericValue = parseFloat(cleanedValue);
    return isNaN(numericValue) ? null : numericValue;
  }

  /**
   * デフォルトの基礎・上級ステータス属性を取得
   */
  private getDefaultAttributes(): {
    baseAttr: Attribute;
    advancedAttr: Attribute;
  } {
    return {
      baseAttr: "atk",
      advancedAttr: "critRate",
    };
  }
}
