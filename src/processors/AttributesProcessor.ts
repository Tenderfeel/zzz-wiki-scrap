import { Attributes } from "../types";
import { LevelBasedStats, FixedStats } from "../types/processing";
import { ParsingError } from "../errors";

/**
 * 属性プロセッサー - 昇格データからステータス配列と固定値を抽出
 * 要件: 4.3, 4.4, 4.5, 4.6, 4.7
 */
export class AttributesProcessor {
  /**
   * 昇格データからAttributes オブジェクトを生成
   * 要件: 4.3, 4.4, 4.5, 4.6, 4.7
   */
  processAscensionData(jsonData: string): Attributes {
    try {
      if (!jsonData || jsonData.trim() === "") {
        throw new ParsingError("昇格データが空または存在しません");
      }

      let parsedData;
      try {
        parsedData = JSON.parse(jsonData);
      } catch (error) {
        throw new ParsingError(
          "昇格データのJSON解析に失敗しました",
          error as Error
        );
      }

      if (!parsedData || typeof parsedData !== "object") {
        throw new ParsingError("昇格データが無効なオブジェクトです");
      }

      if (!parsedData.list || !Array.isArray(parsedData.list)) {
        throw new ParsingError(
          "昇格データにlistが存在しないか、配列ではありません"
        );
      }

      // レベル別ステータス配列を生成
      const levelBasedStats = this.extractLevelBasedStats(parsedData.list);

      // 固定ステータス値を抽出
      const fixedStats = this.extractFixedStats(parsedData.list);

      return {
        ...levelBasedStats,
        ...fixedStats,
      };
    } catch (error) {
      if (error instanceof ParsingError) {
        throw error;
      }
      throw new ParsingError("昇格データの処理に失敗しました", error as Error);
    }
  }

  /**
   * レベル別ステータス配列生成機能を実装
   * HP、ATK、DEF の 7 レベル分の配列を作成
   * 文字列から数値への変換処理
   * 要件: 4.3, 4.5
   */
  extractLevelBasedStats(levelDataList: any[]): LevelBasedStats {
    try {
      const levels = ["1", "10", "20", "30", "40", "50", "60"];
      const hp: number[] = [];
      const atk: number[] = [];
      const def: number[] = [];

      levels.forEach((level) => {
        const levelData = levelDataList.find((data) => data.key === level);
        if (!levelData) {
          throw new ParsingError(`レベル ${level} のデータが見つかりません`);
        }

        if (!levelData.combatList || !Array.isArray(levelData.combatList)) {
          throw new ParsingError(
            `レベル ${level} のcombatListが存在しないか、配列ではありません`
          );
        }

        const combatList = levelData.combatList;

        // HP を抽出
        const hpStat = combatList.find((stat: any) => stat.key === "HP");
        if (hpStat) {
          if (
            !hpStat.values ||
            !Array.isArray(hpStat.values) ||
            hpStat.values.length < 2
          ) {
            throw new ParsingError(
              `レベル ${level} のHPデータの形式が不正です`
            );
          }
          const hpValue = this.parseStatValue(hpStat.values[1]); // values[1] は強化後の値
          hp.push(hpValue);
        } else {
          throw new ParsingError(
            `レベル ${level} の HP データが見つかりません`
          );
        }

        // 攻撃力を抽出
        const atkStat = combatList.find((stat: any) => stat.key === "攻撃力");
        if (atkStat) {
          if (
            !atkStat.values ||
            !Array.isArray(atkStat.values) ||
            atkStat.values.length < 2
          ) {
            throw new ParsingError(
              `レベル ${level} の攻撃力データの形式が不正です`
            );
          }
          const atkValue = this.parseStatValue(atkStat.values[1]);
          atk.push(atkValue);
        } else {
          throw new ParsingError(
            `レベル ${level} の攻撃力データが見つかりません`
          );
        }

        // 防御力を抽出
        const defStat = combatList.find((stat: any) => stat.key === "防御力");
        if (defStat) {
          if (
            !defStat.values ||
            !Array.isArray(defStat.values) ||
            defStat.values.length < 2
          ) {
            throw new ParsingError(
              `レベル ${level} の防御力データの形式が不正です`
            );
          }
          const defValue = this.parseStatValue(defStat.values[1]);
          def.push(defValue);
        } else {
          throw new ParsingError(
            `レベル ${level} の防御力データが見つかりません`
          );
        }
      });

      return { hp, atk, def };
    } catch (error) {
      if (error instanceof ParsingError) {
        throw error;
      }
      throw new ParsingError(
        "レベル別ステータスの抽出に失敗しました",
        error as Error
      );
    }
  }

  /**
   * 固定ステータス値抽出機能を実装
   * レベル 1 データから impact、critRate 等の固定値を抽出
   * パーセンテージ値の処理（%記号除去）
   * "-"値のデフォルト値変換
   * 要件: 4.4, 4.5, 4.6, 4.7
   */
  extractFixedStats(levelDataList: any[]): FixedStats {
    try {
      // レベル1のデータを取得
      const level1Data = levelDataList.find((data) => data.key === "1");
      if (!level1Data) {
        throw new ParsingError("レベル 1 のデータが見つかりません");
      }

      if (!level1Data.combatList || !Array.isArray(level1Data.combatList)) {
        throw new ParsingError(
          "レベル 1 のcombatListが存在しないか、配列ではありません"
        );
      }

      const combatList = level1Data.combatList;
      const fixedStats: FixedStats = {
        impact: 0,
        critRate: 0,
        critDmg: 0,
        anomalyMastery: 0,
        anomalyProficiency: 0,
        penRatio: 0,
        energy: 0,
      };

      // 各固定ステータスを抽出
      combatList.forEach((stat: any) => {
        if (
          !stat.values ||
          !Array.isArray(stat.values) ||
          stat.values.length < 2
        ) {
          // 値が存在しない場合はスキップ（警告のみ）
          console.warn(`ステータス "${stat.key}" の値が不正な形式です`);
          return;
        }

        const value = stat.values[1]; // 強化後の値を使用

        try {
          switch (stat.key) {
            case "衝撃力":
              fixedStats.impact = this.parseStatValue(value);
              break;
            case "会心率":
              fixedStats.critRate = this.parsePercentageValue(value);
              break;
            case "会心ダメージ":
              fixedStats.critDmg = this.parsePercentageValue(value);
              break;
            case "異常マスタリー":
              fixedStats.anomalyMastery = this.parseStatValue(value);
              break;
            case "異常掌握":
              fixedStats.anomalyProficiency = this.parseStatValue(value);
              break;
            case "貫通率":
              fixedStats.penRatio = this.parsePercentageValue(value);
              break;
            case "エネルギー自動回復":
              fixedStats.energy = this.parseFloatValue(value);
              break;
          }
        } catch (error) {
          throw new ParsingError(
            `ステータス "${stat.key}" の値 "${value}" の解析に失敗しました`,
            error as Error
          );
        }
      });

      return fixedStats;
    } catch (error) {
      if (error instanceof ParsingError) {
        throw error;
      }
      throw new ParsingError(
        "固定ステータスの抽出に失敗しました",
        error as Error
      );
    }
  }

  /**
   * 文字列値を数値に変換
   * "-" 値は 0 に変換
   */
  private parseStatValue(value: string): number {
    if (value === "-" || value === "" || value == null) {
      return 0;
    }
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * パーセンテージ値を処理（%記号除去）
   * "-" 値は 0 に変換
   */
  private parsePercentageValue(value: string): number {
    if (value === "-" || value === "" || value == null) {
      return 0;
    }
    const cleanValue = value.replace("%", "");
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * 浮動小数点値を処理
   * "-" 値は 0 に変換
   */
  private parseFloatValue(value: string): number {
    if (value === "-" || value === "" || value == null) {
      return 0;
    }
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
}
