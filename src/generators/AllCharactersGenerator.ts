import { Character } from "../types";
import { ValidationResult } from "../types/processing";
import {
  CharacterResult,
  ProcessingResult,
} from "../processors/BatchProcessor";
import { ValidationError, ParsingError } from "../errors";
import * as fs from "fs";
import * as path from "path";

/**
 * 配列検証結果
 */
export interface ArrayValidationResult {
  isValid: boolean;
  duplicateIds: string[];
  invalidCharacters: { index: number; errors: string[] }[];
  totalCharacters: number;
}

/**
 * 全キャラクタージェネレーター
 * 全キャラクターのCharacterオブジェクト配列生成と出力を担当
 * 要件: 5.1, 5.2, 5.3, 5.4, 5.5
 */
export class AllCharactersGenerator {
  /**
   * Character オブジェクト配列生成機能を実装
   * 処理済み全キャラクターデータから Character 配列を構築
   * 多言語プロパティの適切な設定
   * faction プロパティの ID 参照設定
   * 要件: 5.1, 5.2, 5.3, 5.4
   */
  async generateAllCharacters(
    results: CharacterResult[],
  ): Promise<Character[]> {
    try {
      if (!results || results.length === 0) {
        throw new ValidationError("処理結果が空です");
      }

      console.log(`\n🔄 Character配列生成開始`);
      console.log(`対象キャラクター数: ${results.length}`);

      // Scraping.mdの順序でソート
      const sortedResults = await this.sortByScrapingOrder(results);

      const characters: Character[] = [];

      for (const result of sortedResults) {
        try {
          // 各CharacterResultからCharacterオブジェクトを取得
          const character = result.character;

          // 基本的な検証
          if (!character) {
            throw new ValidationError(
              `キャラクター "${result.entry.id}" のCharacterオブジェクトが存在しません`,
            );
          }

          // Character.idがScraping.mdのリンクテキストと一致することを確認
          if (character.id !== result.entry.id) {
            console.warn(
              `⚠️  Character.id (${character.id}) がエントリーID (${result.entry.id}) と一致しません。エントリーIDを使用します。`,
            );
            character.id = result.entry.id;
          }

          // 多言語プロパティの確認
          if (!character.name?.ja || !character.name?.en) {
            throw new ValidationError(
              `キャラクター "${character.id}" の多言語名が不完全です`,
            );
          }

          if (!character.fullName?.ja || !character.fullName?.en) {
            throw new ValidationError(
              `キャラクター "${character.id}" の多言語フルネームが不完全です`,
            );
          }

          // faction プロパティがID参照であることを確認
          if (typeof character.faction !== "number") {
            throw new ValidationError(
              `キャラクター "${character.id}" のfactionプロパティが数値IDではありません: ${character.faction}`,
            );
          }

          characters.push(character);
          console.log(`  ✓ ${character.id} (${character.name.ja}) 追加完了`);
        } catch (error) {
          console.error(
            `  ✗ ${result.entry.id} の処理中にエラー: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          throw error;
        }
      }

      console.log(`✅ Character配列生成完了: ${characters.length}キャラクター`);
      return characters;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(
        "Character配列の生成に失敗しました",
        error as Error,
      );
    }
  }

  /**
   * 配列検証機能を実装
   * 全キャラクターの必須フィールド存在確認
   * Character.id の重複チェック
   * 数値配列の長さ検証（HP、ATK、DEF が 7 要素）
   * 列挙値と多言語オブジェクトの妥当性確認
   * 要件: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
   */
  validateCharacterArray(characters: Character[]): ArrayValidationResult {
    console.log(`\n🔍 Character配列検証開始`);
    console.log(`検証対象: ${characters.length}キャラクター`);

    const duplicateIds: string[] = [];
    const invalidCharacters: { index: number; errors: string[] }[] = [];

    // Character.id の重複チェック
    const idCounts = new Map<string, number>();
    characters.forEach((character) => {
      const count = idCounts.get(character.id) || 0;
      idCounts.set(character.id, count + 1);
    });

    idCounts.forEach((count, id) => {
      if (count > 1) {
        duplicateIds.push(id);
      }
    });

    // 各キャラクターの詳細検証
    characters.forEach((character, index) => {
      const errors = this.validateSingleCharacter(character);
      if (errors.length > 0) {
        invalidCharacters.push({ index, errors });
      }
    });

    const isValid = duplicateIds.length === 0 && invalidCharacters.length === 0;

    // 検証結果の表示
    if (duplicateIds.length > 0) {
      duplicateIds.forEach((id) => {
        console.error(`❌ 重複ID検出: ${id}`);
      });
    }

    if (invalidCharacters.length > 0) {
      console.error(`❌ 無効なキャラクター: ${invalidCharacters.length}件`);
      invalidCharacters.forEach(({ index, errors }) => {
        const character = characters[index];
        console.error(`  - ${character.id} (インデックス: ${index}):`);
        errors.forEach((error) => {
          console.error(`    • ${error}`);
        });
      });
    }

    if (isValid) {
      console.log(`✅ Character配列検証完了: 全て有効`);
    } else {
      console.error(
        `❌ Character配列検証失敗: 重複ID ${duplicateIds.length}件, 無効キャラクター ${invalidCharacters.length}件`,
      );
    }

    return {
      isValid,
      duplicateIds,
      invalidCharacters,
      totalCharacters: characters.length,
    };
  }

  /**
   * 単一キャラクターの詳細検証
   * @param character 検証対象のキャラクター
   * @returns エラーメッセージの配列
   */
  private validateSingleCharacter(character: Character): string[] {
    const errors: string[] = [];

    // 必須フィールドの存在確認
    if (!character.id || character.id.trim() === "") {
      errors.push("id フィールドが空または存在しません");
    }

    if (!character.name) {
      errors.push("name フィールドが存在しません");
    } else {
      if (!character.name.ja || character.name.ja.trim() === "") {
        errors.push("name.ja が空または存在しません");
      }
      if (!character.name.en || character.name.en.trim() === "") {
        errors.push("name.en が空または存在しません");
      }
    }

    if (!character.fullName) {
      errors.push("fullName フィールドが存在しません");
    } else {
      if (!character.fullName.ja || character.fullName.ja.trim() === "") {
        errors.push("fullName.ja が空または存在しません");
      }
      if (!character.fullName.en || character.fullName.en.trim() === "") {
        errors.push("fullName.en が空または存在しません");
      }
    }

    if (!character.specialty) {
      errors.push("specialty フィールドが存在しません");
    }

    if (!character.stats) {
      errors.push("stats フィールドが存在しません");
    }

    if (character.faction === undefined || character.faction === null) {
      errors.push("faction フィールドが存在しません");
    }

    if (!character.rarity) {
      errors.push("rarity フィールドが存在しません");
    }

    if (!character.attr) {
      errors.push("attr フィールドが存在しません");
    }

    // 数値配列の長さ検証（HP、ATK、DEF が 7 要素）
    if (character.attr) {
      if (!Array.isArray(character.attr.hp) || character.attr.hp.length !== 7) {
        errors.push(
          `attr.hp 配列は正確に 7 つの値を含む必要があります (現在: ${
            character.attr.hp?.length || 0
          })`,
        );
      }
      if (
        !Array.isArray(character.attr.atk) ||
        character.attr.atk.length !== 7
      ) {
        errors.push(
          `attr.atk 配列は正確に 7 つの値を含む必要があります (現在: ${
            character.attr.atk?.length || 0
          })`,
        );
      }
      if (
        !Array.isArray(character.attr.def) ||
        character.attr.def.length !== 7
      ) {
        errors.push(
          `attr.def 配列は正確に 7 つの値を含む必要があります (現在: ${
            character.attr.def?.length || 0
          })`,
        );
      }

      // 固定ステータスの数値確認
      const fixedStats = [
        "impact",
        "critRate",
        "critDmg",
        "anomalyMastery",
        "anomalyProficiency",
        "penRatio",
        "energy",
      ];
      fixedStats.forEach((stat) => {
        const value = (character.attr as any)[stat];
        if (typeof value !== "number" || isNaN(value)) {
          errors.push(`attr.${stat} は有効な数値である必要があります`);
        }
      });
    }

    // 列挙値の妥当性確認
    const validSpecialties = [
      "attack",
      "stun",
      "anomaly",
      "support",
      "defense",
      "rupture",
      "armorer",
    ];
    if (
      character.specialty &&
      !validSpecialties.includes(character.specialty)
    ) {
      errors.push(
        `specialty "${character.specialty}" は有効な値ではありません`,
      );
    }

    const validStats = [
      "ether",
      "fire",
      "ice",
      "physical",
      "electric",
      "frost",
      "auricInk",
      "lumiflux",
      "honedEdge",
      "wind",
    ];
    if (character.stats) {
      if (!Array.isArray(character.stats) || character.stats.length === 0) {
        errors.push(`stats は空でない配列である必要があります`);
      } else {
        for (const stat of character.stats) {
          if (!validStats.includes(stat)) {
            errors.push(`stats "${stat}" は有効な値ではありません`);
          }
        }
      }
    }

    const validRarities = ["A", "S"];
    if (character.rarity && !validRarities.includes(character.rarity)) {
      errors.push(`rarity "${character.rarity}" は有効な値ではありません`);
    }

    // faction IDの妥当性確認（1-20の範囲）
    if (
      typeof character.faction !== "number" ||
      character.faction < 1 ||
      character.faction > 20
    ) {
      errors.push(
        `faction ID "${character.faction}" は1-20の範囲内である必要があります`,
      );
    }

    return errors;
  }

  /**
   * data/characters.ts ファイル出力機能を実装
   * Character 配列を TypeScript ファイル形式で出力
   * 適切な export 文と型注釈を含む
   * ファイル書き込みエラーの処理
   * 要件: 5.5
   */
  outputCharactersFile(
    characters: Character[],
    outputPath: string = "data/characters.ts",
  ): void {
    try {
      console.log(`\n📝 characters.tsファイル出力開始`);
      console.log(`出力先: ${outputPath}`);
      console.log(`キャラクター数: ${characters.length}`);

      if (!characters || characters.length === 0) {
        throw new ValidationError("出力するキャラクター配列が空です");
      }

      if (!outputPath || outputPath.trim() === "") {
        throw new ValidationError("出力ファイルパスが無効です");
      }

      // 出力ディレクトリを作成（存在しない場合）
      const outputDir = path.dirname(outputPath);
      if (outputDir && !fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`📁 ディレクトリ作成: ${outputDir}`);
      }

      // Character 配列を整形された TypeScript コードとして出力
      const charactersCode = this.formatCharactersArray(characters);

      // importパスを出力ファイルの位置に応じて調整
      const importPath = outputPath.startsWith("data/")
        ? "../src/types"
        : "./src/types";

      const fileContent = `import { Character } from "${importPath}";

export default [
${charactersCode}
] as Character[];
`;

      // ファイルに書き込み
      try {
        fs.writeFileSync(outputPath, fileContent, "utf-8");
        console.log(`✅ ファイル出力完了: ${outputPath}`);
        console.log(`📊 出力統計:`);
        console.log(`  - キャラクター数: ${characters.length}`);
        console.log(
          `  - ファイルサイズ: ${this.formatFileSize(fileContent.length)}`,
        );
      } catch (error) {
        throw new ParsingError(
          `ファイル "${outputPath}" の書き込みに失敗しました`,
          error as Error,
        );
      }
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ParsingError) {
        throw error;
      }
      throw new ParsingError("ファイル出力に失敗しました", error as Error);
    }
  }

  /**
   * Character 配列を整形された TypeScript コードとして出力
   * @param characters Character配列
   * @returns 整形されたTypeScriptコード
   */
  private formatCharactersArray(characters: Character[]): string {
    const formattedCharacters = characters.map((character, index) => {
      const isLast = index === characters.length - 1;
      return this.formatSingleCharacter(character, isLast);
    });

    return formattedCharacters.join("\n");
  }

  /**
   * 単一のCharacterオブジェクトを整形
   * @param character Characterオブジェクト
   * @param isLast 配列の最後の要素かどうか
   * @returns 整形されたTypeScriptコード
   */
  private formatSingleCharacter(
    character: Character,
    isLast: boolean = false,
  ): string {
    const indent = "  ";
    const comma = isLast ? "" : ",";

    // assistTypeフィールドの条件付き出力
    const assistTypeField = character.assistType
      ? `${indent}  assistType: "${character.assistType}",\n`
      : "";

    // stats配列を適切にフォーマット
    const statsArray = Array.isArray(character.stats)
      ? `[${character.stats.map((stat) => `"${stat}"`).join(", ")}]`
      : `["${character.stats}"]`; // 後方互換性のため

    return `${indent}{
${indent}  id: "${character.id}",
${indent}  name: { ja: "${this.escapeString(
      character.name.ja,
    )}", en: "${this.escapeString(character.name.en)}" },
${indent}  fullName: { ja: "${this.escapeString(
      character.fullName.ja,
    )}", en: "${this.escapeString(character.fullName.en)}" },
${indent}  specialty: "${character.specialty}",
${indent}  stats: ${statsArray},
${assistTypeField}${indent}  faction: ${character.faction},
${indent}  rarity: "${character.rarity}",
${indent}  releaseVersion: ${character.releaseVersion || 0},
${indent}  attr: {
${indent}    hp: [${character.attr.hp.join(", ")}],
${indent}    atk: [${character.attr.atk.join(", ")}],
${indent}    def: [${character.attr.def.join(", ")}],
${indent}    impact: ${character.attr.impact},
${indent}    critRate: ${character.attr.critRate},
${indent}    critDmg: ${character.attr.critDmg},
${indent}    anomalyMastery: ${character.attr.anomalyMastery},
${indent}    anomalyProficiency: ${character.attr.anomalyProficiency},
${indent}    penRatio: ${character.attr.penRatio},
${indent}    energy: ${character.attr.energy},
${indent}  },
${indent}}${comma}`;
  }

  /**
   * 文字列内のダブルクォートをエスケープ
   */
  private escapeString(str: string): string {
    return str.replace(/"/g, '\\"');
  }

  /**
   * ファイルサイズを人間が読みやすい形式にフォーマット
   * @param bytes バイト数
   * @returns フォーマットされたファイルサイズ
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} bytes`;
    } else if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)} KB`;
    } else {
      return `${Math.round(bytes / (1024 * 1024))} MB`;
    }
  }

  /**
   * 処理結果から統計レポートを生成
   * @param result 処理結果
   * @returns 統計レポート文字列
   */
  generateProcessingReport(result: ProcessingResult): string {
    const { statistics, successful, failed } = result;
    const successRate = (statistics.successful / statistics.total) * 100;

    let report = `# 全キャラクター処理レポート\n\n`;
    report += `## 処理概要\n`;
    report += `- 処理開始時刻: ${statistics.startTime.toLocaleString()}\n`;
    report += `- 処理終了時刻: ${statistics.endTime?.toLocaleString()}\n`;
    report += `- 総処理時間: ${this.formatDuration(
      statistics.processingTime,
    )}\n`;
    report += `- 総キャラクター数: ${statistics.total}\n`;
    report += `- 成功: ${statistics.successful}\n`;
    report += `- 失敗: ${statistics.failed}\n`;
    report += `- 成功率: ${Math.round(successRate)}%\n\n`;

    if (successful.length > 0) {
      report += `## 成功したキャラクター (${successful.length})\n`;
      successful.forEach((s, index) => {
        report += `${index + 1}. ${s.character.id} (${s.character.name.ja})\n`;
      });
      report += `\n`;
    }

    if (failed.length > 0) {
      report += `## 失敗したキャラクター (${failed.length})\n`;
      failed.forEach((f, index) => {
        report += `${index + 1}. ${f.entry.id} - ${f.stage}: ${f.error}\n`;
      });
      report += `\n`;
    }

    return report;
  }

  /**
   * Scraping.mdの順序でCharacterResultをソート
   * @param results CharacterResultの配列
   * @returns ソートされたCharacterResultの配列
   */
  private async sortByScrapingOrder(
    results: CharacterResult[],
  ): Promise<CharacterResult[]> {
    try {
      console.log(`📋 Scraping.mdから順序を動的に取得中...`);

      // Scraping.mdから順序を動的に取得
      const scrapingOrder = await this.getScrapingOrder();

      console.log(
        `✅ Scraping.mdから${scrapingOrder.length}個のキャラクター順序を取得`,
      );

      // 順序のインデックスマップを作成
      const orderMap = new Map<string, number>();
      scrapingOrder.forEach((id, index) => {
        orderMap.set(id, index);
      });

      // ソート実行
      const sortedResults = results.sort((a, b) => {
        const orderA = orderMap.get(a.entry.id) ?? Number.MAX_SAFE_INTEGER;
        const orderB = orderMap.get(b.entry.id) ?? Number.MAX_SAFE_INTEGER;
        return orderA - orderB;
      });

      console.log(`🔄 キャラクター順序をScraping.mdに基づいてソート完了`);
      return sortedResults;
    } catch (error) {
      console.warn(
        `⚠️  Scraping.mdからの順序取得に失敗。元の順序を維持します:`,
        error,
      );
      return results;
    }
  }

  /**
   * Scraping.mdファイルからキャラクター順序を動的に取得
   * @returns キャラクターIDの配列（Scraping.mdの順序）
   */
  private async getScrapingOrder(): Promise<string[]> {
    try {
      const fs = await import("fs");
      const path = await import("path");

      // Scraping.mdファイルのパスを解決
      const scrapingPath = path.resolve(process.cwd(), "Scraping.md");

      if (!fs.existsSync(scrapingPath)) {
        throw new Error(`Scraping.mdファイルが見つかりません: ${scrapingPath}`);
      }

      // ファイル内容を読み取り
      const content = fs.readFileSync(scrapingPath, "utf-8");

      // キャラクターリンクを抽出（正規表現でマッチング）
      const linkPattern = /- \[([^\]]+)\]\([^)]+\) - pageId: \d+/g;
      const characterIds: string[] = [];
      let match;

      while ((match = linkPattern.exec(content)) !== null) {
        const characterId = match[1];
        if (characterId && characterId !== "hoyoLab wiki") {
          characterIds.push(characterId);
        }
      }

      if (characterIds.length === 0) {
        throw new Error("Scraping.mdからキャラクターIDを抽出できませんでした");
      }

      console.log(
        `📋 抽出されたキャラクター順序: ${characterIds
          .slice(0, 5)
          .join(", ")}... (${characterIds.length}個)`,
      );
      return characterIds;
    } catch (error) {
      throw new Error(
        `Scraping.mdの解析に失敗しました: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * 時間を人間が読みやすい形式にフォーマット
   * @param ms ミリ秒
   * @returns フォーマットされた時間文字列
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}時間${minutes % 60}分${seconds % 60}秒`;
    } else if (minutes > 0) {
      return `${minutes}分${seconds % 60}秒`;
    } else {
      return `${seconds}秒`;
    }
  }
}
