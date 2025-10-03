import { FileLoader } from "./loaders/FileLoader";
import { DataProcessor } from "./processors/DataProcessor";
import { CharacterGenerator } from "./generators/CharacterGenerator";
import { ProcessedData } from "./types/processing";
import { LycanDataGeneratorError } from "./errors";

/**
 * メイン処理フロー
 * json/mock/lycaon.json ファイルからデータを読み込み、全処理ステップを順次実行し、character.ts ファイルを生成
 * 要件: 1.1, 1.3, 5.5, 1.4, 6.5
 */
export class LycanDataGenerator {
  private fileLoader: FileLoader;
  private dataProcessor: DataProcessor;
  private characterGenerator: CharacterGenerator;

  constructor() {
    this.fileLoader = new FileLoader();
    this.dataProcessor = new DataProcessor();
    this.characterGenerator = new CharacterGenerator();
  }

  /**
   * メイン処理を実行
   * 各処理段階でのエラーキャッチと適切なメッセージ表示
   * @param inputFilePath lycaon.jsonファイルのパス（デフォルト: "json/mock/lycaon.json"）
   * @param outputFilePath 出力ファイルのパス（デフォルト: "characters.ts"）
   */
  async execute(
    inputFilePath: string = "json/mock/lycaon.json",
    outputFilePath: string = "data/characters.ts"
  ): Promise<void> {
    try {
      console.log("🚀 ライカンキャラクターデータ生成を開始します...");

      // 入力パラメータの検証
      if (!inputFilePath || inputFilePath.trim() === "") {
        throw new LycanDataGeneratorError(
          "VALIDATION",
          "入力ファイルパスが無効です"
        );
      }
      if (!outputFilePath || outputFilePath.trim() === "") {
        throw new LycanDataGeneratorError(
          "VALIDATION",
          "出力ファイルパスが無効です"
        );
      }

      // ステップ1: json/mock/lycaon.jsonファイルからデータを読み込み
      console.log(`📁 ${inputFilePath}ファイルを読み込み中...`);
      let apiData;
      try {
        apiData = await this.fileLoader.loadFromFile(inputFilePath);
        console.log("✅ ファイル読み込み完了");
      } catch (error) {
        throw new LycanDataGeneratorError(
          "PARSING",
          `ファイル読み込みに失敗しました: ${inputFilePath}`,
          error as Error
        );
      }

      // ステップ2: データ処理 - 基本情報、陣営情報、属性情報を抽出
      console.log("🔍 データ処理中...");
      let basicInfo, factionInfo, attributesInfo;

      try {
        basicInfo = this.dataProcessor.extractBasicInfo(apiData);
      } catch (error) {
        throw new LycanDataGeneratorError(
          "PARSING",
          "基本キャラクター情報の抽出に失敗しました",
          error as Error
        );
      }

      try {
        factionInfo = this.dataProcessor.extractFactionInfo(apiData);
      } catch (error) {
        throw new LycanDataGeneratorError(
          "PARSING",
          "陣営情報の抽出に失敗しました",
          error as Error
        );
      }

      try {
        attributesInfo = this.dataProcessor.extractAttributes(apiData);
      } catch (error) {
        throw new LycanDataGeneratorError(
          "PARSING",
          "属性情報の抽出に失敗しました",
          error as Error
        );
      }

      // 処理済みデータをまとめる
      const processedData: ProcessedData = {
        basicInfo,
        factionInfo,
        attributesInfo,
      };

      console.log("✅ データ処理完了");
      console.log(`   - キャラクター名: ${basicInfo.name}`);
      console.log(`   - 特性: ${basicInfo.specialty}`);
      console.log(`   - 属性: ${basicInfo.stats}`);
      console.log(`   - 陣営: ${factionInfo.name} (ID: ${factionInfo.id})`);

      // ステップ3: Characterオブジェクト生成
      console.log("🏗️  Characterオブジェクト生成中...");

      let character;
      try {
        // 日本語データのみを使用（json/mock/lycaon.jsonは日本語データ）
        // 英語データは同じデータを使用（実際のAPIでは別途取得が必要）
        character = this.characterGenerator.generateCharacter(
          processedData,
          processedData // 暫定的に同じデータを使用
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
