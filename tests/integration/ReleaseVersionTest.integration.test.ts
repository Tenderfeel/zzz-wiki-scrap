import { describe, it, expect, beforeEach } from "vitest";
import { DataProcessor } from "../../src/processors/DataProcessor";
import { DataMapper } from "../../src/mappers/DataMapper";
import { NameResolver } from "../../src/mappers/NameResolver";
import { AssistTypeStatistics } from "../../src/utils/AssistTypeStatistics";
import { ReleaseVersionStatistics } from "../../src/utils/ReleaseVersionStatistics";
import * as fs from "fs";
import * as path from "path";

/**
 * 実装バージョンフィールドの統合テスト
 * 実際のAPIデータ（lycaon.json）を使用してreleaseVersionの抽出と処理を検証
 * 要件: 1.1, 2.1, 3.1
 */
describe("Release Version Integration Tests", () => {
  let dataProcessor: DataProcessor;
  let releaseVersionStatistics: ReleaseVersionStatistics;

  // 実際のlycaon.jsonファイルパス
  const lycaonJsonPath = path.join(
    process.cwd(),
    "json",
    "mock",
    "lycaon.json"
  );

  beforeEach(() => {
    // 統計オブジェクトを初期化
    const assistTypeStatistics = new AssistTypeStatistics();
    releaseVersionStatistics = new ReleaseVersionStatistics();

    // 実際の設定ファイルを使用
    const realConfigPath = path.join(
      process.cwd(),
      "src",
      "config",
      "name-mappings.json"
    );
    const nameResolver = new NameResolver(realConfigPath);
    const dataMapper = new DataMapper(nameResolver);

    // DataProcessorに統計オブジェクトを注入
    dataProcessor = new DataProcessor(
      dataMapper,
      assistTypeStatistics,
      releaseVersionStatistics
    );
  });

  describe("lycaon.jsonを使用した実際のAPIデータテスト", () => {
    it("lycaon.jsonから実装バージョンを正しく抽出できる", () => {
      // lycaon.jsonファイルの存在確認と読み込み
      expect(fs.existsSync(lycaonJsonPath)).toBe(true);

      const lycaonJsonContent = fs.readFileSync(lycaonJsonPath, "utf-8");
      const lycaonApiData = JSON.parse(lycaonJsonContent);

      // 基本的なAPIレスポンス構造の確認
      expect(lycaonApiData).toHaveProperty("retcode", 0);
      expect(lycaonApiData).toHaveProperty("message", "OK");
      expect(lycaonApiData).toHaveProperty("data");
      expect(lycaonApiData.data).toHaveProperty("page");

      // 実装バージョン抽出のテスト
      const releaseVersion = dataProcessor.extractReleaseVersion(lycaonApiData);

      // ライカンはVer.1.0で実装されたキャラクター
      expect(releaseVersion).toBe(1.0);

      // 統計情報の確認
      const stats = releaseVersionStatistics.getStatistics();
      expect(stats.total).toBe(1);
      expect(stats.successful).toBe(1);
      expect(stats.failed).toBe(0);
      expect(stats.defaultUsed).toBe(0);
    });

    it("lycaon.jsonの基本情報抽出でreleaseVersionが含まれる", () => {
      const lycaonJsonContent = fs.readFileSync(lycaonJsonPath, "utf-8");
      const lycaonApiData = JSON.parse(lycaonJsonContent);

      // 基本情報抽出のテスト
      const basicInfo = dataProcessor.extractBasicInfo(lycaonApiData);

      // releaseVersionフィールドが含まれることを確認
      expect(basicInfo).toHaveProperty("releaseVersion");
      expect(basicInfo.releaseVersion).toBe(1.0);

      // その他の基本情報も正しく抽出されることを確認（実際のlycaon.jsonの値に合わせる）
      expect(basicInfo.id).toBe("28");
      expect(basicInfo.name).toBe("フォン・ライカン");
      expect(basicInfo.specialty).toBe("撃破"); // lycaon.jsonの実際の値
      expect(basicInfo.stats).toBe("氷属性");
      expect(basicInfo.rarity).toBe("S");
    });

    it("lycaon.jsonでbaseInfoコンポーネントの詳細構造を確認", () => {
      const lycaonJsonContent = fs.readFileSync(lycaonJsonPath, "utf-8");
      const lycaonApiData = JSON.parse(lycaonJsonContent);

      // baseInfoコンポーネントの存在確認
      const modules = lycaonApiData.data.page.modules;
      expect(Array.isArray(modules)).toBe(true);

      const baseInfoModule = modules.find((module: any) =>
        module.components?.some((comp: any) => comp.component_id === "baseInfo")
      );
      expect(baseInfoModule).toBeDefined();

      const baseInfoComponent = baseInfoModule!.components.find(
        (comp: any) => comp.component_id === "baseInfo"
      );
      expect(baseInfoComponent).toBeDefined();
      expect(baseInfoComponent!.data).toBeDefined();

      // baseInfoデータの解析
      const baseInfoData = JSON.parse(baseInfoComponent!.data);
      expect(baseInfoData).toHaveProperty("list");
      expect(Array.isArray(baseInfoData.list)).toBe(true);

      // 実装バージョンキーの存在確認
      const versionItem = baseInfoData.list.find(
        (item: any) => item.key === "実装バージョン"
      );
      expect(versionItem).toBeDefined();
      expect(versionItem.value).toBeDefined();
      expect(Array.isArray(versionItem.value)).toBe(true);
      expect(versionItem.value.length).toBeGreaterThan(0);

      // 実装バージョンの値確認
      const versionString = versionItem.value[0];
      expect(typeof versionString).toBe("string");
      expect(versionString).toContain("Ver.1.0");
      expect(versionString).toContain("新エリー都へようこそ");

      // HTMLタグが含まれていることを確認
      expect(versionString).toMatch(/<[^>]*>/);
    });
  });

  describe("統計情報とログ出力の検証", () => {
    it("ReleaseVersionStatisticsの詳細機能確認", () => {
      // 複数のキャラクターでテスト
      const testData = [
        { id: "stat_test_1", version: 1.0, raw: "<p>Ver.1.0「テスト1」</p>" },
        { id: "stat_test_2", version: 1.1, raw: "<p>Ver.1.1「テスト2」</p>" },
        { id: "stat_test_3", version: 1.0, raw: "<p>Ver.1.0「テスト3」</p>" }, // 重複バージョン
        { id: "stat_test_4", version: 1.2, raw: "<p>Ver.1.2「テスト4」</p>" },
      ];

      testData.forEach((data) => {
        releaseVersionStatistics.recordSuccess(data.id, data.version, data.raw);
      });

      // 基本統計の確認
      const stats = releaseVersionStatistics.getStatistics();
      expect(stats.total).toBe(4);
      expect(stats.successful).toBe(4);
      expect(stats.failed).toBe(0);

      // バージョン分布の確認
      const distribution = stats.versionDistribution;
      expect(distribution["1"]).toBe(2); // Ver.1.0が2回
      expect(distribution["1.1"]).toBe(1);
      expect(distribution["1.2"]).toBe(1);

      // 成功したキャラクターの詳細確認
      const details = releaseVersionStatistics.getDetails();
      expect(details.successful).toHaveLength(4);
      expect(details.successful.map((s) => s.characterId)).toEqual([
        "stat_test_1",
        "stat_test_2",
        "stat_test_3",
        "stat_test_4",
      ]);
    });

    it("エラー統計の詳細確認", () => {
      // 意図的にエラーを発生させる
      releaseVersionStatistics.recordFailure(
        "error_test_1",
        "baseinfo_component_not_found"
      );
      releaseVersionStatistics.recordFailure(
        "error_test_2",
        "version_key_not_found"
      );
      releaseVersionStatistics.recordFailure(
        "error_test_3",
        "baseinfo_component_not_found"
      ); // 重複理由
      releaseVersionStatistics.recordDefaultUsed(
        "error_test_1",
        "baseinfo_component_not_found"
      );
      releaseVersionStatistics.recordDefaultUsed(
        "error_test_2",
        "version_key_not_found"
      );

      const stats = releaseVersionStatistics.getStatistics();
      expect(stats.failed).toBe(3);
      expect(stats.defaultUsed).toBe(2);

      const details = releaseVersionStatistics.getDetails();
      expect(details.failed).toHaveLength(3);
      expect(details.failed[0].reason).toBe("baseinfo_component_not_found");
      expect(details.failed[1].reason).toBe("version_key_not_found");
      expect(details.failed[2].reason).toBe("baseinfo_component_not_found");
    });
  });
});
