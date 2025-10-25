import {
  Weapon,
  ProcessedWeaponData,
  Lang,
  Specialty,
  Stats,
  Rarity,
  Attribute,
  WeaponAttributes,
  EnhancedWeapon,
} from "../types";
import { ValidationResult } from "../types/processing";
import { DataMapper } from "../mappers/DataMapper";
import { ValidationError, ParsingError } from "../errors";
import { WeaponAttributeProcessor } from "../processors/WeaponAttributeProcessor";
import { logger } from "../utils/Logger";
import * as fs from "fs";

/**
 * 音動機ジェネレーター - ProcessedWeaponDataからWeaponオブジェクトへの変換と出力
 * 属性抽出機能を統合し、拡張された武器データを生成
 * 要件: 3.1, 3.2, 4.4
 */
export class WeaponGenerator {
  private dataMapper: DataMapper;
  private attributeProcessor: WeaponAttributeProcessor;

  constructor(attributeProcessor?: WeaponAttributeProcessor) {
    this.dataMapper = new DataMapper();
    this.attributeProcessor =
      attributeProcessor || new WeaponAttributeProcessor();
  }

  /**
   * ProcessedWeaponDataからWeaponオブジェクトへの変換
   * 多言語データの統合と名前フォールバック処理
   * 要件: 3.1
   */
  generateWeapon(
    jaData: ProcessedWeaponData,
    enData: ProcessedWeaponData | null,
    weaponId: string
  ): Weapon {
    try {
      logger.debug("音動機オブジェクト生成を開始", { weaponId });

      // 入力データの検証
      if (!jaData) {
        throw new ValidationError("日本語データが存在しません");
      }
      if (!jaData.basicInfo) {
        throw new ValidationError("日本語の基本情報が存在しません");
      }
      if (!jaData.attributesInfo) {
        throw new ValidationError("属性情報が存在しません");
      }
      if (!weaponId || weaponId.trim() === "") {
        throw new ValidationError("音動機IDが指定されていません");
      }

      // 基本情報の取得
      const basicInfo = jaData.basicInfo;
      const skillInfo = jaData.skillInfo;
      const attributesInfo = jaData.attributesInfo;
      const agentInfo = jaData.agentInfo;

      // 多言語名の作成（英語データがない場合は日本語をフォールバック）
      const enName = enData?.basicInfo?.name || basicInfo.name;
      const name = this.dataMapper.createMultiLangName(basicInfo.name, enName);

      // 多言語スキル名の作成
      const enSkillName =
        enData?.skillInfo?.equipmentSkillName || skillInfo.equipmentSkillName;
      const equipmentSkillName = this.dataMapper.createMultiLangName(
        skillInfo.equipmentSkillName,
        enSkillName
      );

      // 多言語スキル説明の作成
      const enSkillDesc =
        enData?.skillInfo?.equipmentSkillDesc || skillInfo.equipmentSkillDesc;
      const equipmentSkillDesc = this.dataMapper.createMultiLangName(
        skillInfo.equipmentSkillDesc,
        enSkillDesc
      );

      // レア度マッピング
      let rarity: Rarity = "A"; // デフォルト値
      try {
        rarity = this.dataMapper.mapRarity(basicInfo.rarity);
        logger.debug("レア度マッピング成功", {
          weaponId,
          rawRarity: basicInfo.rarity,
          mappedRarity: rarity,
        });
      } catch (error) {
        logger.warn("レア度マッピングに失敗、デフォルト値を使用", {
          weaponId,
          rawRarity: basicInfo.rarity,
          defaultRarity: rarity,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // 特性マッピング
      let specialty: Specialty = "attack"; // デフォルト値
      try {
        if (basicInfo.specialty && basicInfo.specialty.trim() !== "") {
          specialty = this.dataMapper.mapSpecialty(basicInfo.specialty);
          logger.debug("特性マッピング成功", {
            weaponId,
            rawSpecialty: basicInfo.specialty,
            mappedSpecialty: specialty,
          });
        }
      } catch (error) {
        logger.warn("特性マッピングに失敗、デフォルト値を使用", {
          weaponId,
          rawSpecialty: basicInfo.specialty,
          defaultSpecialty: specialty,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // 属性配列の作成（抽出された属性のみを使用）
      let stats: Stats[] = [];

      // スキル説明から属性を抽出
      try {
        const extractedAttributes =
          this.extractAttributesFromSkillDesc(equipmentSkillDesc);

        if (extractedAttributes.length > 0) {
          // 抽出された属性をそのまま使用（重複を除去）
          stats = Array.from(new Set(extractedAttributes));

          logger.debug("属性抽出完了", {
            weaponId,
            extractedAttributes,
            finalStats: stats,
          });
        } else {
          logger.debug("属性が抽出されませんでした", {
            weaponId,
            finalStats: stats,
          });
        }
      } catch (error) {
        logger.warn("属性抽出に失敗", {
          weaponId,
          error: error instanceof Error ? error.message : String(error),
          finalStats: stats,
        });
      }

      // 音動機属性データの変換
      const attr: WeaponAttributes = {
        hp: attributesInfo.hp,
        atk: attributesInfo.atk,
        def: attributesInfo.def,
        impact: attributesInfo.impact,
        critRate: attributesInfo.critRate,
        critDmg: attributesInfo.critDmg,
        anomalyMastery: attributesInfo.anomalyMastery,
        anomalyProficiency: attributesInfo.anomalyProficiency,
        penRatio: attributesInfo.penRatio,
        energy: attributesInfo.energy,
      };

      // 基礎・上級ステータスの決定（デフォルト値）
      const baseAttr: Attribute = "atk"; // 基礎攻撃力がデフォルト
      const advancedAttr: Attribute = "critRate"; // 会心率がデフォルト

      // Weapon オブジェクトを構築
      const weapon: Weapon = {
        id: parseInt(weaponId, 10),
        name,
        equipmentSkillName,
        equipmentSkillDesc,
        rarity,
        attr,
        specialty,
        stats,
        agentId: agentInfo.agentId || "",
        baseAttr,
        advancedAttr,
      };

      logger.debug("音動機オブジェクト生成完了", {
        weaponId: weapon.id,
        hasSkillName: weapon.equipmentSkillName.ja.length > 0,
        hasSkillDesc: weapon.equipmentSkillDesc.ja.length > 0,
        hasAgentId: weapon.agentId.length > 0,
      });

      return weapon;
    } catch (error) {
      logger.error("音動機オブジェクト生成に失敗しました", {
        weaponId,
        error: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(
        "Weaponオブジェクトの生成に失敗しました",
        error as Error
      );
    }
  }

  /**
   * スキル説明から属性を抽出
   * @param skillDesc 多言語スキル説明
   * @returns 抽出された属性の配列
   */
  private extractAttributesFromSkillDesc(skillDesc: {
    [key in Lang]: string;
  }): Stats[] {
    try {
      // WeaponAttributeProcessorを使用して属性を抽出
      const tempWeapon: Weapon = {
        id: 0,
        name: { ja: "", en: "" },
        equipmentSkillName: { ja: "", en: "" },
        equipmentSkillDesc: skillDesc,
        rarity: "A",
        attr: {
          hp: [],
          atk: [],
          def: [],
          impact: [],
          critRate: [],
          critDmg: [],
          anomalyMastery: [],
          anomalyProficiency: [],
          penRatio: [],
          energy: [],
        },
        specialty: "attack",
        stats: ["physical"],
        agentId: "",
        baseAttr: "atk",
        advancedAttr: "critRate",
      };

      const enhancedWeapon = this.attributeProcessor.processWeapon(tempWeapon);
      return enhancedWeapon.extractedAttributes;
    } catch (error) {
      logger.debug("属性抽出処理でエラーが発生", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * 武器データに属性抽出を適用
   * @param weapon 基本武器データ
   * @returns 拡張された武器データ
   */
  enhanceWeaponWithAttributes(weapon: Weapon): EnhancedWeapon {
    try {
      logger.debug("武器データの属性拡張を開始", {
        weaponId: weapon.id,
        existingStats: weapon.stats,
      });

      const enhancedWeapon = this.attributeProcessor.processWeapon(weapon);

      logger.debug("武器データの属性拡張完了", {
        weaponId: weapon.id,
        originalStats: weapon.stats,
        extractedAttributes: enhancedWeapon.extractedAttributes,
      });

      return enhancedWeapon;
    } catch (error) {
      logger.error("武器データの属性拡張に失敗", {
        weaponId: weapon.id,
        error: error instanceof Error ? error.message : String(error),
      });

      // エラー時は元の武器データに空の抽出属性を追加
      return {
        ...weapon,
        extractedAttributes: [],
      };
    }
  }

  /**
   * ProcessedWeaponDataから拡張武器オブジェクトへの変換
   * 属性抽出を含む完全な武器データ生成
   * @param jaData 日本語武器データ
   * @param enData 英語武器データ（オプション）
   * @param weaponId 武器ID
   * @returns 拡張された武器データ
   */
  generateEnhancedWeapon(
    jaData: ProcessedWeaponData,
    enData: ProcessedWeaponData | null,
    weaponId: string
  ): EnhancedWeapon {
    try {
      logger.debug("拡張武器オブジェクト生成を開始", { weaponId });

      // 基本武器データを生成
      const weapon = this.generateWeapon(jaData, enData, weaponId);

      // 属性抽出を適用して拡張武器データを作成
      const enhancedWeapon = this.enhanceWeaponWithAttributes(weapon);

      logger.debug("拡張武器オブジェクト生成完了", {
        weaponId: enhancedWeapon.id,
        finalStats: enhancedWeapon.stats,
        extractedAttributes: enhancedWeapon.extractedAttributes,
      });

      return enhancedWeapon;
    } catch (error) {
      logger.error("拡張武器オブジェクト生成に失敗", {
        weaponId,
        error: error instanceof Error ? error.message : String(error),
      });

      // エラー時は基本武器データに空の抽出属性を追加
      const fallbackWeapon = this.generateWeapon(jaData, enData, weaponId);
      return {
        ...fallbackWeapon,
        extractedAttributes: [],
      };
    }
  }

  /**
   * 複数の武器データを一括で拡張武器データに変換
   * @param weaponDataPairs 武器データのペア配列
   * @returns 拡張武器データの配列
   */
  generateEnhancedWeapons(
    weaponDataPairs: Array<{
      jaData: ProcessedWeaponData;
      enData: ProcessedWeaponData | null;
      weaponId: string;
    }>
  ): EnhancedWeapon[] {
    const enhancedWeapons: EnhancedWeapon[] = [];

    logger.info("拡張武器データ一括生成を開始", {
      totalWeapons: weaponDataPairs.length,
    });

    for (const { jaData, enData, weaponId } of weaponDataPairs) {
      try {
        const enhancedWeapon = this.generateEnhancedWeapon(
          jaData,
          enData,
          weaponId
        );
        enhancedWeapons.push(enhancedWeapon);
      } catch (error) {
        logger.error("拡張武器データ生成に失敗、スキップ", {
          weaponId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info("拡張武器データ一括生成完了", {
      totalWeapons: weaponDataPairs.length,
      successfulWeapons: enhancedWeapons.length,
      failedWeapons: weaponDataPairs.length - enhancedWeapons.length,
    });

    return enhancedWeapons;
  }
  /**
   * 生成されたWeaponオブジェクトの完全性チェック
   * 必須フィールドと配列長の検証
   * 列挙値の妥当性確認
   * 要件: 4.4
   */
  validateWeapon(weapon: Weapon): ValidationResult {
    const errors: string[] = [];

    try {
      // 必須フィールドの存在確認
      if (typeof weapon.id !== "number" || isNaN(weapon.id) || weapon.id <= 0) {
        errors.push("id フィールドが無効な数値です");
      }

      if (!weapon.name) {
        errors.push("name フィールドが存在しません");
      }

      if (!weapon.equipmentSkillName) {
        errors.push("equipmentSkillName フィールドが存在しません");
      }

      if (!weapon.equipmentSkillDesc) {
        errors.push("equipmentSkillDesc フィールドが存在しません");
      }

      if (!weapon.rarity) {
        errors.push("rarity フィールドが存在しません");
      }

      if (!weapon.attr) {
        errors.push("attr フィールドが存在しません");
      }

      if (!weapon.specialty) {
        errors.push("specialty フィールドが存在しません");
      }

      if (!weapon.stats) {
        errors.push("stats フィールドが存在しません");
      }

      if (typeof weapon.agentId !== "string") {
        errors.push("agentId フィールドは文字列である必要があります");
      }

      if (!weapon.baseAttr) {
        errors.push("baseAttr フィールドが存在しません");
      }

      if (!weapon.advancedAttr) {
        errors.push("advancedAttr フィールドが存在しません");
      }

      // 多言語オブジェクトの完全性確認
      if (weapon.name) {
        if (!weapon.name.ja || weapon.name.ja.trim() === "") {
          errors.push("name.ja が空または存在しません");
        }
        if (!weapon.name.en || weapon.name.en.trim() === "") {
          errors.push("name.en が空または存在しません");
        }
      }

      if (weapon.equipmentSkillName) {
        if (typeof weapon.equipmentSkillName.ja !== "string") {
          errors.push("equipmentSkillName.ja は文字列である必要があります");
        }
        if (typeof weapon.equipmentSkillName.en !== "string") {
          errors.push("equipmentSkillName.en は文字列である必要があります");
        }
      }

      if (weapon.equipmentSkillDesc) {
        if (typeof weapon.equipmentSkillDesc.ja !== "string") {
          errors.push("equipmentSkillDesc.ja は文字列である必要があります");
        }
        if (typeof weapon.equipmentSkillDesc.en !== "string") {
          errors.push("equipmentSkillDesc.en は文字列である必要があります");
        }
      }

      // 音動機属性配列の長さ検証（7要素または空配列）
      if (weapon.attr) {
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
          const value = (weapon.attr as any)[key];
          if (!Array.isArray(value)) {
            errors.push(`attr.${key} は配列である必要があります`);
          } else if (value.length !== 0 && value.length !== 7) {
            errors.push(
              `attr.${key} 配列は0個または7個の値を含む必要があります（現在: ${value.length}）`
            );
          } else if (value.length > 0) {
            // 数値の検証（空配列でない場合のみ）
            for (let i = 0; i < value.length; i++) {
              if (typeof value[i] !== "number" || isNaN(value[i])) {
                errors.push(
                  `attr.${key}[${i}] は有効な数値である必要があります: ${value[i]}`
                );
              }
            }
          }
        }
      }

      // 列挙値の妥当性確認
      const validRarities: Rarity[] = ["A", "S"];
      if (weapon.rarity && !validRarities.includes(weapon.rarity)) {
        errors.push(
          `rarity "${weapon.rarity}" は有効な値ではありません（"A"または"S"である必要があります）`
        );
      }

      const validSpecialties: Specialty[] = [
        "attack",
        "stun",
        "anomaly",
        "support",
        "defense",
        "rupture",
      ];
      if (weapon.specialty && !validSpecialties.includes(weapon.specialty)) {
        errors.push(`specialty "${weapon.specialty}" は有効な値ではありません`);
      }

      const validStats: Stats[] = [
        "ether",
        "fire",
        "ice",
        "physical",
        "electric",
        "frost",
        "auricInk",
      ];
      if (weapon.stats) {
        if (!Array.isArray(weapon.stats)) {
          errors.push("stats は配列である必要があります");
        } else {
          for (const stat of weapon.stats) {
            if (!validStats.includes(stat)) {
              errors.push(`stats "${stat}" は有効な値ではありません`);
            }
          }
        }
      }

      const validAttributes: Attribute[] = [
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
      if (weapon.baseAttr && !validAttributes.includes(weapon.baseAttr)) {
        errors.push(`baseAttr "${weapon.baseAttr}" は有効な値ではありません`);
      }

      if (
        weapon.advancedAttr &&
        !validAttributes.includes(weapon.advancedAttr)
      ) {
        errors.push(
          `advancedAttr "${weapon.advancedAttr}" は有効な値ではありません`
        );
      }

      const result = {
        isValid: errors.length === 0,
        errors,
      };

      // 検証結果のログ記録
      if (!result.isValid) {
        logger.warn("Weapon検証エラー", {
          weaponId: weapon.id,
          errors,
        });
      } else {
        logger.debug("Weapon検証成功", {
          weaponId: weapon.id,
        });
      }

      return result;
    } catch (error) {
      let weaponId = "unknown";
      try {
        weaponId = weapon?.id?.toString() || "unknown";
      } catch {
        // Ignore errors when accessing weapon.id for logging
      }

      logger.error("Weapon検証中にエラーが発生しました", {
        weaponId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        isValid: false,
        errors: [
          "データ検証中にエラーが発生しました: " +
            (error instanceof Error ? error.message : String(error)),
        ],
      };
    }
  }

  /**
   * 拡張武器オブジェクトの完全性チェック
   * 基本武器データの検証に加えて、抽出された属性の検証も行う
   * @param enhancedWeapon 拡張武器データ
   * @returns バリデーション結果
   */
  validateEnhancedWeapon(enhancedWeapon: EnhancedWeapon): ValidationResult {
    try {
      // 基本武器データの検証を実行
      const baseValidation = this.validateWeapon(enhancedWeapon);
      const errors = [...baseValidation.errors];

      // 抽出された属性の検証
      if (!Array.isArray(enhancedWeapon.extractedAttributes)) {
        errors.push("extractedAttributes フィールドは配列である必要があります");
      } else {
        // 抽出された属性が有効なStats型かチェック
        const validStats: Stats[] = [
          "ether",
          "fire",
          "ice",
          "physical",
          "electric",
          "frost",
          "auricInk",
        ];

        for (const attr of enhancedWeapon.extractedAttributes) {
          if (!validStats.includes(attr)) {
            errors.push(
              `extractedAttributes に無効な属性が含まれています: "${attr}"`
            );
          }
        }

        // 重複チェック
        const uniqueAttributes = new Set(enhancedWeapon.extractedAttributes);
        if (
          uniqueAttributes.size !== enhancedWeapon.extractedAttributes.length
        ) {
          errors.push("extractedAttributes に重複した属性が含まれています");
        }
      }

      const result = {
        isValid: errors.length === 0,
        errors,
      };

      // 検証結果のログ記録
      if (!result.isValid) {
        logger.warn("EnhancedWeapon検証エラー", {
          weaponId: enhancedWeapon.id,
          errors,
        });
      } else {
        logger.debug("EnhancedWeapon検証成功", {
          weaponId: enhancedWeapon.id,
          extractedAttributesCount: enhancedWeapon.extractedAttributes.length,
        });
      }

      return result;
    } catch (error) {
      let weaponId = "unknown";
      try {
        weaponId = enhancedWeapon?.id?.toString() || "unknown";
      } catch {
        // Ignore errors when accessing weapon.id for logging
      }

      logger.error("EnhancedWeapon検証中にエラーが発生しました", {
        weaponId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        isValid: false,
        errors: [
          "拡張武器データ検証中にエラーが発生しました: " +
            (error instanceof Error ? error.message : String(error)),
        ],
      };
    }
  }

  /**
   * data/weapons.tsファイルの生成
   * 適切なimport文と型注釈を含むファイル構造
   * 音動機配列の整形されたTypeScriptコード出力
   * 要件: 3.1, 3.2
   */
  outputWeaponFile(
    weapons: Weapon[],
    outputPath: string = "data/weapons.ts"
  ): void {
    try {
      if (!weapons || !Array.isArray(weapons)) {
        throw new ValidationError(
          "出力するWeaponオブジェクト配列が存在しません"
        );
      }

      if (!outputPath || outputPath.trim() === "") {
        throw new ValidationError("出力ファイルパスが無効です");
      }

      // 出力ディレクトリを作成（存在しない場合）
      const outputDir = outputPath.substring(0, outputPath.lastIndexOf("/"));
      if (outputDir && !fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Weapon配列を整形されたTypeScriptコードとして出力
      const weaponArrayCode = this.formatWeaponArray(weapons);

      // importパスを出力ファイルの位置に応じて調整
      const importPath = outputPath.startsWith("data/")
        ? "../src/types"
        : "./src/types";

      const fileContent = `import { Weapon } from "${importPath}";

export default [
${weaponArrayCode}
] as Weapon[];
`;

      // ファイルに書き込み
      try {
        fs.writeFileSync(outputPath, fileContent, "utf-8");
        logger.info("音動機ファイル出力完了", {
          outputPath,
          weaponCount: weapons.length,
        });
      } catch (error) {
        throw new ParsingError(
          `ファイル "${outputPath}" の書き込みに失敗しました`,
          error as Error
        );
      }
    } catch (error) {
      logger.error("音動機ファイル出力に失敗しました", {
        outputPath,
        weaponCount: weapons?.length || 0,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof ValidationError || error instanceof ParsingError) {
        throw error;
      }
      throw new ParsingError("ファイル出力に失敗しました", error as Error);
    }
  }

  /**
   * 拡張武器データファイルの生成
   * EnhancedWeapon配列を含むTypeScriptファイルを出力
   * @param enhancedWeapons 拡張武器データの配列
   * @param outputPath 出力ファイルパス
   */
  outputEnhancedWeaponFile(
    enhancedWeapons: EnhancedWeapon[],
    outputPath: string = "data/enhanced-weapons.ts"
  ): void {
    try {
      if (!enhancedWeapons || !Array.isArray(enhancedWeapons)) {
        throw new ValidationError(
          "出力するEnhancedWeaponオブジェクト配列が存在しません"
        );
      }

      if (!outputPath || outputPath.trim() === "") {
        throw new ValidationError("出力ファイルパスが無効です");
      }

      // 出力ディレクトリを作成（存在しない場合）
      const outputDir = outputPath.substring(0, outputPath.lastIndexOf("/"));
      if (outputDir && !fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // EnhancedWeapon配列を整形されたTypeScriptコードとして出力
      const enhancedWeaponArrayCode =
        this.formatEnhancedWeaponArray(enhancedWeapons);

      // importパスを出力ファイルの位置に応じて調整
      const importPath = outputPath.startsWith("data/")
        ? "../src/types"
        : "./src/types";

      const fileContent = `import { EnhancedWeapon } from "${importPath}";

export default [
${enhancedWeaponArrayCode}
] as EnhancedWeapon[];
`;

      // ファイルに書き込み
      try {
        fs.writeFileSync(outputPath, fileContent, "utf-8");
        logger.info("拡張武器ファイル出力完了", {
          outputPath,
          weaponCount: enhancedWeapons.length,
        });
      } catch (error) {
        throw new ParsingError(
          `ファイル "${outputPath}" の書き込みに失敗しました`,
          error as Error
        );
      }
    } catch (error) {
      logger.error("拡張武器ファイル出力に失敗しました", {
        outputPath,
        weaponCount: enhancedWeapons?.length || 0,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof ValidationError || error instanceof ParsingError) {
        throw error;
      }
      throw new ParsingError(
        "拡張武器ファイル出力に失敗しました",
        error as Error
      );
    }
  }

  /**
   * Weapon配列を整形されたTypeScriptコードとして出力
   */
  private formatWeaponArray(weapons: Weapon[]): string {
    if (!weapons || weapons.length === 0) {
      return "";
    }

    return weapons.map((weapon) => this.formatWeaponObject(weapon)).join(",\n");
  }

  /**
   * EnhancedWeapon配列を整形されたTypeScriptコードとして出力
   */
  private formatEnhancedWeaponArray(enhancedWeapons: EnhancedWeapon[]): string {
    if (!enhancedWeapons || enhancedWeapons.length === 0) {
      return "";
    }

    return enhancedWeapons
      .map((weapon) => this.formatEnhancedWeaponObject(weapon))
      .join(",\n");
  }

  /**
   * Weaponオブジェクトを整形されたTypeScriptコードとして出力
   */
  private formatWeaponObject(weapon: Weapon): string {
    const indent = "  ";

    // stats配列を適切にフォーマット
    const statsArray = Array.isArray(weapon.stats)
      ? `[${weapon.stats.map((stat) => `"${stat}"`).join(", ")}]`
      : `["${weapon.stats}"]`; // 後方互換性のため

    return `${indent}{
${indent}  id: ${weapon.id},
${indent}  name: { ja: "${this.escapeString(
      weapon.name.ja
    )}", en: "${this.escapeString(weapon.name.en)}" },
${indent}  equipmentSkillName: { ja: "${this.escapeString(
      weapon.equipmentSkillName.ja
    )}", en: "${this.escapeString(weapon.equipmentSkillName.en)}" },
${indent}  equipmentSkillDesc: { ja: "${this.escapeString(
      weapon.equipmentSkillDesc.ja
    )}", en: "${this.escapeString(weapon.equipmentSkillDesc.en)}" },
${indent}  rarity: "${weapon.rarity}",
${indent}  attr: {
${indent}    hp: [${weapon.attr.hp.join(", ")}],
${indent}    atk: [${weapon.attr.atk.join(", ")}],
${indent}    def: [${weapon.attr.def.join(", ")}],
${indent}    impact: [${weapon.attr.impact.join(", ")}],
${indent}    critRate: [${weapon.attr.critRate.join(", ")}],
${indent}    critDmg: [${weapon.attr.critDmg.join(", ")}],
${indent}    anomalyMastery: [${weapon.attr.anomalyMastery.join(", ")}],
${indent}    anomalyProficiency: [${weapon.attr.anomalyProficiency.join(", ")}],
${indent}    penRatio: [${weapon.attr.penRatio.join(", ")}],
${indent}    energy: [${weapon.attr.energy.join(", ")}],
${indent}  },
${indent}  specialty: "${weapon.specialty}",
${indent}  stats: ${statsArray},
${indent}  agentId: "${this.escapeString(weapon.agentId)}",
${indent}  baseAttr: "${weapon.baseAttr}",
${indent}  advancedAttr: "${weapon.advancedAttr}",
${indent}}`;
  }

  /**
   * EnhancedWeaponオブジェクトを整形されたTypeScriptコードとして出力
   */
  private formatEnhancedWeaponObject(enhancedWeapon: EnhancedWeapon): string {
    const indent = "  ";

    // stats配列を適切にフォーマット
    const statsArray = Array.isArray(enhancedWeapon.stats)
      ? `[${enhancedWeapon.stats.map((stat) => `"${stat}"`).join(", ")}]`
      : `["${enhancedWeapon.stats}"]`; // 後方互換性のため

    // extractedAttributes配列をフォーマット
    const extractedAttributesArray = Array.isArray(
      enhancedWeapon.extractedAttributes
    )
      ? `[${enhancedWeapon.extractedAttributes
          .map((attr) => `"${attr}"`)
          .join(", ")}]`
      : "[]";

    return `${indent}{
${indent}  id: ${enhancedWeapon.id},
${indent}  name: { ja: "${this.escapeString(
      enhancedWeapon.name.ja
    )}", en: "${this.escapeString(enhancedWeapon.name.en)}" },
${indent}  equipmentSkillName: { ja: "${this.escapeString(
      enhancedWeapon.equipmentSkillName.ja
    )}", en: "${this.escapeString(enhancedWeapon.equipmentSkillName.en)}" },
${indent}  equipmentSkillDesc: { ja: "${this.escapeString(
      enhancedWeapon.equipmentSkillDesc.ja
    )}", en: "${this.escapeString(enhancedWeapon.equipmentSkillDesc.en)}" },
${indent}  rarity: "${enhancedWeapon.rarity}",
${indent}  attr: {
${indent}    hp: [${enhancedWeapon.attr.hp.join(", ")}],
${indent}    atk: [${enhancedWeapon.attr.atk.join(", ")}],
${indent}    def: [${enhancedWeapon.attr.def.join(", ")}],
${indent}    impact: [${enhancedWeapon.attr.impact.join(", ")}],
${indent}    critRate: [${enhancedWeapon.attr.critRate.join(", ")}],
${indent}    critDmg: [${enhancedWeapon.attr.critDmg.join(", ")}],
${indent}    anomalyMastery: [${enhancedWeapon.attr.anomalyMastery.join(", ")}],
${indent}    anomalyProficiency: [${enhancedWeapon.attr.anomalyProficiency.join(
      ", "
    )}],
${indent}    penRatio: [${enhancedWeapon.attr.penRatio.join(", ")}],
${indent}    energy: [${enhancedWeapon.attr.energy.join(", ")}],
${indent}  },
${indent}  specialty: "${enhancedWeapon.specialty}",
${indent}  stats: ${statsArray},
${indent}  agentId: "${this.escapeString(enhancedWeapon.agentId)}",
${indent}  baseAttr: "${enhancedWeapon.baseAttr}",
${indent}  advancedAttr: "${enhancedWeapon.advancedAttr}",
${indent}  extractedAttributes: ${extractedAttributesArray},
${indent}}`;
  }

  /**
   * 文字列内のダブルクォートをエスケープ
   */
  private escapeString(str: string): string {
    if (typeof str !== "string") {
      return "";
    }
    return str.replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
  }
}
