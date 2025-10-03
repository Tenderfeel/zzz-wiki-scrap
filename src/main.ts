import { HoyoLabApiClient } from "./clients/HoyoLabApiClient";
import { DataProcessor } from "./processors/DataProcessor";
import { CharacterGenerator } from "./generators/CharacterGenerator";
import { ProcessedData } from "./types/processing";
import { LycanDataGeneratorError } from "./errors";

/**
 * メイン処理フロー
 * HoyoLab Wiki API からライカンのデータを取得し、全処理ステップを順次実行し、character.ts ファイルを生成
 * 要件: 1.1, 1.3, 5.5, 1.4, 6.5
 */
export class LycanDataGenerator {
  private apiClient: HoyoLabApiClient;
  private dataProcessor: DataProcessor;
  private characterGenerator: CharacterGenerator;
  private readonly lycaonPageId = 28; // ライカンのページID

  constructor() {
    this.apiClient = new HoyoLabApiClient();
    this.dataProcessor = new DataProcessor();
    this.characterGenerator = new CharacterGenerator();
  }

  /**
   * メイン処理を実行
   * 各処理段階でのエラーキャッチと適切なメッセージ表示
   * @param outputFilePath 出力ファイルのパス（デフォルト: "characters.ts"）
   */
  async execute(outputFilePath: string = "data/characters.ts"): Promise<void> {
    try {
      console.log("🚀 ライカンキャラクターデータ生成を開始します...");

      // 出力パラメータの検証
      if (!outputFilePath || outputFilePath.trim() === "") {
        throw new LycanDataGeneratorError(
          "VALIDATION",
          "出力ファイルパスが無効です"
        );
      }

      // ステップ1: HoyoLab Wiki API からライカンのデータを取得
      console.log(
        `🌐 HoyoLab Wiki API からライカンのデータを取得中... (ページID: ${this.lycaonPageId})`
      );
      let jaApiData, enApiData;
      try {
        const bothLanguageData =
          await this.apiClient.fetchCharacterDataBothLanguages(
            this.lycaonPageId
          );
        jaApiData = bothLanguageData.ja;
        enApiData = bothLanguageData.en;
        console.log("✅ API データ取得完了");
      } catch (error) {
        throw new LycanDataGeneratorError(
          "API",
          `API データの取得に失敗しました: ページID ${this.lycaonPageId}`,
          error as Error
        );
      }

      // ステップ2: データ処理 - 基本情報、陣営情報、属性情報を抽出（日本語データから）
      console.log("🔍 データ処理中...");
      let basicInfo, factionInfo, attributesInfo;

      try {
        basicInfo = this.dataProcessor.extractBasicInfo(jaApiData);
      } catch (error) {
        throw new LycanDataGeneratorError(
          "PARSING",
          "基本キャラクター情報の抽出に失敗しました",
          error as Error
        );
      }

      try {
        factionInfo = this.dataProcessor.extractFactionInfo(jaApiData);
      } catch (error) {
        throw new LycanDataGeneratorError(
          "PARSING",
          "陣営情報の抽出に失敗しました",
          error as Error
        );
      }

      try {
        attributesInfo = this.dataProcessor.extractAttributes(jaApiData);
      } catch (error) {
        throw new LycanDataGeneratorError(
          "PARSING",
          "属性情報の抽出に失敗しました",
          error as Error
        );
      }

      // 処理済みデータをまとめる（日本語）
      const jaProcessedData: ProcessedData = {
        basicInfo,
        factionInfo,
        attributesInfo,
      };

      // 英語データの処理
      let enBasicInfo;
      try {
        enBasicInfo = this.dataProcessor.extractBasicInfo(enApiData);
      } catch (error) {
        throw new LycanDataGeneratorError(
          "PARSING",
          "英語基本キャラクター情報の抽出に失敗しました",
          error as Error
        );
      }

      const enProcessedData: ProcessedData = {
        basicInfo: enBasicInfo,
        factionInfo, // 陣営情報は日本語データを使用
        attributesInfo, // 属性情報は日本語データを使用
      };

      console.log("✅ データ処理完了");
      console.log(`   - キャラクター名（日本語）: ${basicInfo.name}`);
      console.log(`   - キャラクター名（英語）: ${enBasicInfo.name}`);
      console.log(`   - 特性: ${basicInfo.specialty}`);
      console.log(`   - 属性: ${basicInfo.stats}`);
      console.log(`   - 陣営: ${factionInfo.name} (ID: ${factionInfo.id})`);

      // ステップ3: Characterオブジェクト生成
      console.log("🏗️  Characterオブジェクト生成中...");

      let character;
      try {
        // 日本語と英語の両方のデータを使用
        character = this.characterGenerator.generateCharacter(
          jaProcessedData,
          enProcessedData
        );
        console.log("✅ Characterオブジェクト生成完了");
      } catch (error) {
        throw new LycanDataGeneratorError(
          "MAPPING",
          "Characterオブジェクトの生成に失敗しました",
          error as Error
        );
      }

      // ステップ4: データ検証
      console.log("🔍 データ検証中...");
      let validationResult;
      try {
        validationResult = this.characterGenerator.validateCharacter(character);
      } catch (error) {
        throw new LycanDataGeneratorError(
          "VALIDATION",
          "データ検証処理に失敗しました",
          error as Error
        );
      }

      if (!validationResult.isValid) {
        throw new LycanDataGeneratorError(
          "VALIDATION",
          `データ検証に失敗しました: ${validationResult.errors.join(", ")}`
        );
      }

      console.log("✅ データ検証完了");

      // ステップ5: character.tsファイル生成
      console.log(`📝 ${outputFilePath}ファイル生成中...`);
      try {
        this.characterGenerator.outputCharacterFile(character, outputFilePath);
        console.log(`✅ ${outputFilePath} ファイル生成完了`);
      } catch (error) {
        throw new LycanDataGeneratorError(
          "PARSING",
          `ファイル出力に失敗しました: ${outputFilePath}`,
          error as Error
        );
      }

      console.log("🎉 ライカンキャラクターデータ生成が正常に完了しました！");
    } catch (error) {
      // 包括的エラーハンドリング - 各処理段階でのエラーキャッチと適切なメッセージ表示
      if (error instanceof LycanDataGeneratorError) {
        console.error(`❌ ${error.type}エラー: ${error.details}`);
        if (error.originalError) {
          console.error(`   原因: ${error.originalError.message}`);
          if (error.originalError.stack) {
            console.error(`   スタックトレース: ${error.originalError.stack}`);
          }
        }
      } else {
        console.error(`❌ 予期しないエラーが発生しました: ${error}`);
        if (error instanceof Error && error.stack) {
          console.error(`   スタックトレース: ${error.stack}`);
        }
      }
      throw error;
    }
  }
}

/**
 * スクリプトとして直接実行された場合のエントリーポイント
 */
if (require.main === module) {
  const generator = new LycanDataGenerator();

  generator
    .execute()
    .then(() => {
      console.log("処理が正常に完了しました。");
      process.exit(0);
    })
    .catch((error) => {
      console.error("処理中にエラーが発生しました:", error);
      process.exit(1);
    });
}
