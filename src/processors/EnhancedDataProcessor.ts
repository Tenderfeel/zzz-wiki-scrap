import { ApiResponse } from "../types/api";
import {
  Character,
  CharacterEntry,
  Lang,
  Specialty,
  Stats,
  AttackType,
  AttackTypes,
  Rarity,
  Attributes,
} from "../types";
import { BilingualApiData, ValidationResult } from "../types/processing";
import { DataProcessor } from "./DataProcessor";
import factions from "../../data/factions";
import { ParsingError, MappingError } from "../errors";

/**
 * 拡張データプロセッサー - 複数キャラクターのデータ処理と陣営解決
 * 要件: 2.1-2.7, 3.1-3.5, 4.1-4.7
 */
export class EnhancedDataProcessor extends DataProcessor {
  /**
   * 複数キャラクターの基本情報抽出機能を拡張
   * 要件: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
   */
  processCharacterData(
    jaData: ApiResponse,
    enData: ApiResponse,
    entry: CharacterEntry
  ): Character {
    try {
      // 基本情報を日本語データから抽出
      const basicInfo = this.extractBasicInfo(jaData);

      // 英語データから名前を抽出
      const enBasicInfo = this.extractBasicInfo(enData);

      // 陣営情報を抽出
      const factionInfo = this.extractFactionInfo(jaData);

      // 属性データを抽出
      const attributesInfo = this.extractAttributes(jaData);
      const processedAttributes = this.processAttributesData(
        attributesInfo.ascensionData
      );

      // Character.idはScraping.mdのリンクテキストを使用
      const character: Character = {
        id: entry.id, // Scraping.mdのリンクテキスト
        name: {
          ja: basicInfo.name,
          en: enBasicInfo.name,
        },
        fullName: {
          ja: basicInfo.name, // 基本的に同じ値
          en: enBasicInfo.name,
        },
        specialty: this.mapSpecialty(basicInfo.specialty),
        stats: this.mapStats(basicInfo.stats),
        attackType: this.mapAttackType(basicInfo.attackType),
        faction: factionInfo.id,
        rarity: this.mapRarity(basicInfo.rarity),
        attr: processedAttributes,
      };

      return character;
    } catch (error) {
      if (error instanceof ParsingError || error instanceof MappingError) {
        throw error;
      }
      throw new ParsingError(
        `キャラクター "${entry.id}" のデータ処理に失敗しました`,
        error as Error
      );
    }
  }

  /**
   * specialty（特性）のマッピング
   * 要件: 2.4
   */
  private mapSpecialty(specialty: string): Specialty {
    const specialtyMap: Record<string, Specialty> = {
      // 基本バージョン
      撃破: "stun",
      強攻: "attack",
      異常: "anomaly",
      支援: "support",
      防護: "defense",
      命破: "rupture",
      // 英語バージョン（念のため）
      stun: "stun",
      attack: "attack",
      anomaly: "anomaly",
      support: "support",
      defense: "defense",
      rupture: "rupture",
    };

    const mapped = specialtyMap[specialty];
    if (!mapped) {
      throw new MappingError(
        `未知の特性: "${specialty}". 利用可能な特性: ${Object.keys(
          specialtyMap
        ).join(", ")}`
      );
    }
    return mapped;
  }

  /**
   * stats（属性）のマッピング
   * 要件: 2.5
   */
  private mapStats(stats: string): Stats {
    const statsMap: Record<string, Stats> = {
      // 「属性」付きバージョン
      氷属性: "ice",
      炎属性: "fire",
      電気属性: "electric",
      物理属性: "physical",
      エーテル属性: "ether",
      霜烈属性: "frostAttribute",
      玄墨属性: "auricInk",
      // 「属性」なしバージョン
      氷: "ice",
      炎: "fire",
      電気: "electric",
      物理: "physical",
      エーテル: "ether",
      霜烈: "frostAttribute",
      玄墨: "auricInk",
    };

    const mapped = statsMap[stats];
    if (!mapped) {
      throw new MappingError(
        `未知の属性: "${stats}". 利用可能な属性: ${Object.keys(statsMap).join(
          ", "
        )}`
      );
    }
    return mapped;
  }

  /**
   * attackType（攻撃タイプ）のマッピング（複数対応）
   * 要件: 2.6
   */
  private mapAttackType(attackType: string | string[]): AttackTypes {
    const attackTypeMap: Record<string, AttackType> = {
      // 日本語バージョン
      打撃: "strike",
      斬撃: "slash",
      刺突: "pierce",
      // 英語バージョン（念のため）
      strike: "strike",
      slash: "slash",
      pierce: "pierce",
    };

    // 単一の攻撃タイプの場合
    if (typeof attackType === "string") {
      const mapped = attackTypeMap[attackType];
      if (!mapped) {
        throw new MappingError(
          `未知の攻撃タイプ: "${attackType}". 利用可能な攻撃タイプ: ${Object.keys(
            attackTypeMap
          ).join(", ")}`
        );
      }
      return [mapped];
    }

    // 複数の攻撃タイプの場合
    const mappedTypes: AttackType[] = [];
    for (const type of attackType) {
      const mapped = attackTypeMap[type];
      if (!mapped) {
        throw new MappingError(
          `未知の攻撃タイプ: "${type}". 利用可能な攻撃タイプ: ${Object.keys(
            attackTypeMap
          ).join(", ")}`
        );
      }
      mappedTypes.push(mapped);
    }

    return mappedTypes;
  }

  /**
   * rarity（レア度）のマッピング
   * 要件: 2.7
   */
  private mapRarity(rarity: string): Rarity {
    if (rarity === "S" || rarity === "A") {
      return rarity as Rarity;
    }
    throw new MappingError(`未知のレア度: "${rarity}". 利用可能なレア度: S, A`);
  }
  /**

   * 属性データ処理機能を拡張
   * 要件: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
   */
  private processAttributesData(ascensionData: string): Attributes {
    try {
      const parsedData = JSON.parse(ascensionData);

      if (!parsedData.list || !Array.isArray(parsedData.list)) {
        throw new ParsingError("昇格データのlist配列が見つかりません");
      }

      const attributes: Attributes = {
        hp: [],
        atk: [],
        def: [],
        impact: 0,
        critRate: 0,
        critDmg: 0,
        anomalyMastery: 0,
        anomalyProficiency: 0,
        penRatio: 0,
        energy: 0,
      };

      // レベル別データを処理（1, 10, 20, 30, 40, 50, 60）
      const expectedLevels = ["1", "10", "20", "30", "40", "50", "60"];

      for (const levelData of parsedData.list) {
        const level = levelData.key;
        const combatList = levelData.combatList;

        if (!combatList || !Array.isArray(combatList)) {
          continue;
        }

        for (const stat of combatList) {
          const statName = stat.key;
          const value = stat.values?.[1]; // 強化後の値を使用

          if (value === undefined) {
            continue;
          }

          switch (statName) {
            case "HP":
              const hpValue = this.parseNumericValue(value);
              attributes.hp.push(hpValue);
              break;
            case "攻撃力":
              const atkValue = this.parseNumericValue(value);
              attributes.atk.push(atkValue);
              break;
            case "防御力":
              const defValue = this.parseNumericValue(value);
              attributes.def.push(defValue);
              break;
            case "衝撃力":
              if (level === "1") {
                attributes.impact = this.parseNumericValue(value);
              }
              break;
            case "会心率":
              if (level === "1") {
                attributes.critRate = this.parsePercentageValue(value);
              }
              break;
            case "会心ダメージ":
              if (level === "1") {
                attributes.critDmg = this.parsePercentageValue(value);
              }
              break;
            case "異常マスタリー":
              if (level === "1") {
                attributes.anomalyMastery = this.parseNumericValue(value);
              }
              break;
            case "異常掌握":
              if (level === "1") {
                attributes.anomalyProficiency = this.parseNumericValue(value);
              }
              break;
            case "貫通率":
              if (level === "1") {
                attributes.penRatio = this.parsePercentageValue(value);
              }
              break;
            case "エネルギー自動回復":
              if (level === "1") {
                attributes.energy = this.parseFloatValue(value);
              }
              break;
          }
        }
      }

      // 配列の長さを検証（HP、ATK、DEFは7要素である必要がある）
      if (attributes.hp.length !== 7) {
        throw new ParsingError(
          `HP配列の長さが不正です。期待値: 7, 実際: ${attributes.hp.length}`
        );
      }
      if (attributes.atk.length !== 7) {
        throw new ParsingError(
          `ATK配列の長さが不正です。期待値: 7, 実際: ${attributes.atk.length}`
        );
      }
      if (attributes.def.length !== 7) {
        throw new ParsingError(
          `DEF配列の長さが不正です。期待値: 7, 実際: ${attributes.def.length}`
        );
      }

      return attributes;
    } catch (error) {
      if (error instanceof ParsingError) {
        throw error;
      }
      throw new ParsingError("属性データの処理に失敗しました", error as Error);
    }
  }

  /**
   * 数値文字列を数値に変換（"-"は0に変換）
   */
  private parseNumericValue(value: string): number {
    if (
      value === "-" ||
      value === "" ||
      value === null ||
      value === undefined
    ) {
      return 0;
    }
    const parsed = parseInt(value.toString(), 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * パーセンテージ文字列を数値に変換（"%"記号を除去）
   */
  private parsePercentageValue(value: string): number {
    if (
      value === "-" ||
      value === "" ||
      value === null ||
      value === undefined
    ) {
      return 0;
    }
    const cleanValue = value.toString().replace("%", "");
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * 浮動小数点数文字列を数値に変換
   */
  private parseFloatValue(value: string): number {
    if (
      value === "-" ||
      value === "" ||
      value === null ||
      value === undefined
    ) {
      return 0;
    }
    const parsed = parseFloat(value.toString());
    return isNaN(parsed) ? 0 : parsed;
  } /**

   * 陣営解決機能を実装
   * 要件: 3.1, 3.2, 3.3, 3.4, 3.5
   */
  resolveFactionFromData(apiData: ApiResponse): number {
    try {
      // 既存のextractFactionInfoメソッドを使用
      const factionInfo = this.extractFactionInfo(apiData);
      return factionInfo.id;
    } catch (error) {
      if (error instanceof ParsingError || error instanceof MappingError) {
        throw error;
      }
      throw new ParsingError("陣営データの解決に失敗しました", error as Error);
    }
  }

  /**
   * 陣営名から ID へのマッピング辞書作成
   * 要件: 3.2, 3.4
   */
  private createFactionNameToIdMap(): Record<string, number> {
    const factionMap: Record<string, number> = {};

    for (const faction of factions) {
      // 日本語名でマッピング
      factionMap[faction.name.ja] = faction.id;
      // 英語名でもマッピング（多言語対応）
      factionMap[faction.name.en] = faction.id;
    }

    return factionMap;
  }

  /**
   * 多言語陣営名の処理
   * 要件: 3.3, 3.4
   */
  private resolveFactionByName(
    factionName: string,
    language: Lang = "ja"
  ): number {
    const factionMap = this.createFactionNameToIdMap();

    const factionId = factionMap[factionName];
    if (factionId === undefined) {
      const availableFactions = Object.keys(factionMap).join(", ");
      throw new MappingError(
        `未知の陣営名: "${factionName}" (言語: ${language}). 利用可能な陣営: ${availableFactions}`
      );
    }

    return factionId;
  }

  /**
   * 処理済みデータの検証
   * 要件: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
   */
  validateProcessedData(character: Character): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 必須フィールドの存在確認
    if (!character.id || character.id.trim() === "") {
      errors.push("Character.id が空です");
    }

    if (!character.name?.ja || character.name.ja.trim() === "") {
      errors.push("Character.name.ja が空です");
    }

    if (!character.name?.en || character.name.en.trim() === "") {
      errors.push("Character.name.en が空です");
    }

    if (!character.fullName?.ja || character.fullName.ja.trim() === "") {
      errors.push("Character.fullName.ja が空です");
    }

    if (!character.fullName?.en || character.fullName.en.trim() === "") {
      errors.push("Character.fullName.en が空です");
    }

    // 列挙値の検証
    const validSpecialties: Specialty[] = [
      "attack",
      "stun",
      "anomaly",
      "support",
      "defense",
      "rupture",
    ];
    if (!validSpecialties.includes(character.specialty)) {
      errors.push(`無効な specialty: ${character.specialty}`);
    }

    const validStats: Stats[] = [
      "ether",
      "fire",
      "ice",
      "physical",
      "electric",
      "frostAttribute",
      "auricInk",
    ];
    if (!validStats.includes(character.stats)) {
      errors.push(`無効な stats: ${character.stats}`);
    }

    const validAttackTypes: AttackType[] = ["slash", "pierce", "strike"];
    // 攻撃タイプ配列の検証
    if (
      !Array.isArray(character.attackType) ||
      character.attackType.length === 0
    ) {
      errors.push(`attackType は空でない配列である必要があります`);
    } else {
      for (const attackType of character.attackType) {
        if (!validAttackTypes.includes(attackType)) {
          errors.push(`無効な attackType: ${attackType}`);
        }
      }
    }

    const validRarities: Rarity[] = ["A", "S"];
    if (!validRarities.includes(character.rarity)) {
      errors.push(`無効な rarity: ${character.rarity}`);
    }

    // 陣営IDの検証
    const validFactionIds = factions.map((f) => f.id);
    if (!validFactionIds.includes(character.faction)) {
      errors.push(`無効な faction ID: ${character.faction}`);
    }

    // 数値配列の長さ検証
    if (!character.attr.hp || character.attr.hp.length !== 7) {
      errors.push(
        `HP配列の長さが不正です。期待値: 7, 実際: ${
          character.attr.hp?.length || 0
        }`
      );
    }

    if (!character.attr.atk || character.attr.atk.length !== 7) {
      errors.push(
        `ATK配列の長さが不正です。期待値: 7, 実際: ${
          character.attr.atk?.length || 0
        }`
      );
    }

    if (!character.attr.def || character.attr.def.length !== 7) {
      errors.push(
        `DEF配列の長さが不正です。期待値: 7, 実際: ${
          character.attr.def?.length || 0
        }`
      );
    }

    // 数値の妥当性確認
    if (character.attr.hp && character.attr.hp.some((val) => val < 0)) {
      warnings.push("HP配列に負の値が含まれています");
    }

    if (character.attr.atk && character.attr.atk.some((val) => val < 0)) {
      warnings.push("ATK配列に負の値が含まれています");
    }

    if (character.attr.def && character.attr.def.some((val) => val < 0)) {
      warnings.push("DEF配列に負の値が含まれています");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
