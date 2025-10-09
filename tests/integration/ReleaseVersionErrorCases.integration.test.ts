import { describe, it, expect, beforeEach } from "vitest";
import { DataProcessor } from "../../src/processors/DataProcessor";
import { DataMapper } from "../../src/mappers/DataMapper";
import { NameResolver } from "../../src/mappers/NameResolver";
import { AssistTypeStatistics } from "../../src/utils/AssistTypeStatistics";
import { ReleaseVersionStatistics } from "../../src/utils/ReleaseVersionStatistics";
import * as path from "path";

/**
 * 実装バージョンフィールドのエラーケース統合テスト
 * 不完全なAPIデータと異常なバージョン形式での処理を検証
 * 要件: 2.3 - エラーハンドリングとデフォルト値の設定
 */
describe("Release Version Error Cases Integration Tests", () => {
  let dataProcessor: DataProcessor;
  let releaseVersionStatistics: ReleaseVersionStatistics;

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

  describe("不完全なAPIデータでのテスト", () => {
    it("pageデータが存在しない場合にデフォルト値0を返す", () => {
      const incompleteApiData = {
        retcode: 0,
        message: "OK",
        data: {
          // pageデータが存在しない
        },
      };

      const releaseVersion =
        dataProcessor.extractReleaseVersion(incompleteApiData);

      expect(releaseVersion).toBe(0);

      // 統計情報の確認
      const stats = releaseVersionStatistics.getStatistics();
      expect(stats.failed).toBe(1);
      expect(stats.defaultUsed).toBe(1);

      const details = releaseVersionStatistics.getDetails();
      expect(details.failed[0].reason).toBe("missing_page_data");
    });

    it("modulesが存在しない場合にデフォルト値0を返す", () => {
      const incompleteApiData = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "test_character",
            name: "テストキャラクター",
            // modulesが存在しない
          },
        },
      };

      const releaseVersion =
        dataProcessor.extractReleaseVersion(incompleteApiData);

      expect(releaseVersion).toBe(0);

      // 統計情報の確認
      const stats = releaseVersionStatistics.getStatistics();
      expect(stats.failed).toBe(1);
      expect(stats.defaultUsed).toBe(1);

      const details = releaseVersionStatistics.getDetails();
      expect(details.failed[0].reason).toBe("missing_modules_array");
    });

    it("modulesが配列でない場合にデフォルト値0を返す", () => {
      const incompleteApiData = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "test_character",
            name: "テストキャラクター",
            modules: "invalid_modules", // 配列ではない
          },
        },
      };

      const releaseVersion =
        dataProcessor.extractReleaseVersion(incompleteApiData);

      expect(releaseVersion).toBe(0);

      // 統計情報の確認
      const stats = releaseVersionStatistics.getStatistics();
      expect(stats.failed).toBe(1);
      expect(stats.defaultUsed).toBe(1);

      const details = releaseVersionStatistics.getDetails();
      expect(details.failed[0].reason).toBe("missing_modules_array");
    });

    it("baseInfoコンポーネントが存在しない場合にデフォルト値0を返す", () => {
      const incompleteApiData = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "test_character",
            name: "テストキャラクター",
            modules: [
              {
                components: [
                  {
                    component_id: "other_component", // baseInfoではない
                    data: JSON.stringify({ some: "data" }),
                  },
                ],
              },
            ],
          },
        },
      };

      const releaseVersion =
        dataProcessor.extractReleaseVersion(incompleteApiData);

      expect(releaseVersion).toBe(0);

      // 統計情報の確認
      const stats = releaseVersionStatistics.getStatistics();
      expect(stats.failed).toBe(1);
      expect(stats.defaultUsed).toBe(1);

      const details = releaseVersionStatistics.getDetails();
      expect(details.failed[0].reason).toBe("baseinfo_component_not_found");
    });

    it("baseInfoコンポーネントのdataが無効なJSON文字列の場合にデフォルト値0を返す", () => {
      const incompleteApiData = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "test_character",
            name: "テストキャラクター",
            modules: [
              {
                components: [
                  {
                    component_id: "baseInfo",
                    data: "invalid json string", // 無効なJSON
                  },
                ],
              },
            ],
          },
        },
      };

      const releaseVersion =
        dataProcessor.extractReleaseVersion(incompleteApiData);

      expect(releaseVersion).toBe(0);

      // 統計情報の確認
      const stats = releaseVersionStatistics.getStatistics();
      expect(stats.failed).toBe(1);
      expect(stats.defaultUsed).toBe(1);

      const details = releaseVersionStatistics.getDetails();
      expect(details.failed[0].reason).toBe("json_parse_error");
    });

    it("baseInfoデータにlistが存在しない場合にデフォルト値0を返す", () => {
      const incompleteApiData = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "test_character",
            name: "テストキャラクター",
            modules: [
              {
                components: [
                  {
                    component_id: "baseInfo",
                    data: JSON.stringify({
                      // listが存在しない
                      other: "data",
                    }),
                  },
                ],
              },
            ],
          },
        },
      };

      const releaseVersion =
        dataProcessor.extractReleaseVersion(incompleteApiData);

      expect(releaseVersion).toBe(0);

      // 統計情報の確認
      const stats = releaseVersionStatistics.getStatistics();
      expect(stats.failed).toBe(1);
      expect(stats.defaultUsed).toBe(1);

      const details = releaseVersionStatistics.getDetails();
      expect(details.failed[0].reason).toBe("baseinfo_list_missing");
    });

    it("実装バージョンキーが存在しない場合にデフォルト値0を返す", () => {
      const incompleteApiData = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "test_character",
            name: "テストキャラクター",
            modules: [
              {
                components: [
                  {
                    component_id: "baseInfo",
                    data: JSON.stringify({
                      list: [
                        {
                          key: "その他の情報",
                          value: ["何かの値"],
                        },
                        // 実装バージョンキーが存在しない
                      ],
                    }),
                  },
                ],
              },
            ],
          },
        },
      };

      const releaseVersion =
        dataProcessor.extractReleaseVersion(incompleteApiData);

      expect(releaseVersion).toBe(0);

      // 統計情報の確認
      const stats = releaseVersionStatistics.getStatistics();
      expect(stats.failed).toBe(1);
      expect(stats.defaultUsed).toBe(1);

      const details = releaseVersionStatistics.getDetails();
      expect(details.failed[0].reason).toBe("version_key_not_found");
    });
  });

  describe("異常なバージョン形式でのテスト", () => {
    it("valueが配列でない場合にデフォルト値0を返す", () => {
      const invalidVersionData = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "test_character",
            name: "テストキャラクター",
            modules: [
              {
                components: [
                  {
                    component_id: "baseInfo",
                    data: JSON.stringify({
                      list: [
                        {
                          key: "実装バージョン",
                          value: "Ver.1.0「テスト」", // 配列ではない
                        },
                      ],
                    }),
                  },
                ],
              },
            ],
          },
        },
      };

      const releaseVersion =
        dataProcessor.extractReleaseVersion(invalidVersionData);

      expect(releaseVersion).toBe(0);

      // 統計情報の確認
      const stats = releaseVersionStatistics.getStatistics();
      expect(stats.failed).toBe(1);
      expect(stats.defaultUsed).toBe(1);

      const details = releaseVersionStatistics.getDetails();
      expect(details.failed[0].reason).toBe("invalid_version_value");
    });

    it("value配列が空の場合にデフォルト値0を返す", () => {
      const invalidVersionData = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "test_character",
            name: "テストキャラクター",
            modules: [
              {
                components: [
                  {
                    component_id: "baseInfo",
                    data: JSON.stringify({
                      list: [
                        {
                          key: "実装バージョン",
                          value: [], // 空の配列
                        },
                      ],
                    }),
                  },
                ],
              },
            ],
          },
        },
      };

      const releaseVersion =
        dataProcessor.extractReleaseVersion(invalidVersionData);

      expect(releaseVersion).toBe(0);

      // 統計情報の確認
      const stats = releaseVersionStatistics.getStatistics();
      expect(stats.failed).toBe(1);
      expect(stats.defaultUsed).toBe(1);

      const details = releaseVersionStatistics.getDetails();
      expect(details.failed[0].reason).toBe("invalid_version_value");
    });

    it("バージョン文字列にVer.パターンが含まれない場合にデフォルト値0を返す", () => {
      const invalidVersionData = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "test_character",
            name: "テストキャラクター",
            modules: [
              {
                components: [
                  {
                    component_id: "baseInfo",
                    data: JSON.stringify({
                      list: [
                        {
                          key: "実装バージョン",
                          value: ["<p>バージョン1.0「テスト」</p>"], // Ver.パターンなし
                        },
                      ],
                    }),
                  },
                ],
              },
            ],
          },
        },
      };

      const releaseVersion =
        dataProcessor.extractReleaseVersion(invalidVersionData);

      expect(releaseVersion).toBe(0);

      // 統計情報の確認
      const stats = releaseVersionStatistics.getStatistics();
      expect(stats.failed).toBe(1);
      expect(stats.defaultUsed).toBe(1);

      const details = releaseVersionStatistics.getDetails();
      expect(details.failed[0].reason).toBe("parse_returned_zero");
    });

    it("バージョン番号が数値に変換できない場合にデフォルト値0を返す", () => {
      const invalidVersionData = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "test_character",
            name: "テストキャラクター",
            modules: [
              {
                components: [
                  {
                    component_id: "baseInfo",
                    data: JSON.stringify({
                      list: [
                        {
                          key: "実装バージョン",
                          value: ["<p>Ver.invalid「テスト」</p>"], // 無効な数値
                        },
                      ],
                    }),
                  },
                ],
              },
            ],
          },
        },
      };

      const releaseVersion =
        dataProcessor.extractReleaseVersion(invalidVersionData);

      expect(releaseVersion).toBe(0);

      // 統計情報の確認
      const stats = releaseVersionStatistics.getStatistics();
      expect(stats.failed).toBe(1);
      expect(stats.defaultUsed).toBe(1);

      const details = releaseVersionStatistics.getDetails();
      expect(details.failed[0].reason).toBe("parse_returned_zero");
    });

    it("複雑なHTMLタグが含まれるバージョン文字列でも正しく処理される", () => {
      const complexVersionData = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "test_character",
            name: "テストキャラクター",
            modules: [
              {
                components: [
                  {
                    component_id: "baseInfo",
                    data: JSON.stringify({
                      list: [
                        {
                          key: "実装バージョン",
                          value: [
                            '<div class="version"><p><strong>Ver.1.5</strong>「<em>複雑なテスト</em>」</p></div>',
                          ],
                        },
                      ],
                    }),
                  },
                ],
              },
            ],
          },
        },
      };

      const releaseVersion =
        dataProcessor.extractReleaseVersion(complexVersionData);

      expect(releaseVersion).toBe(1.5);

      // 統計情報の確認
      const stats = releaseVersionStatistics.getStatistics();
      expect(stats.successful).toBe(1);
      expect(stats.failed).toBe(0);
    });

    it("特殊文字が含まれるバージョン文字列でも正しく処理される", () => {
      const specialCharVersionData = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "test_character",
            name: "テストキャラクター",
            modules: [
              {
                components: [
                  {
                    component_id: "baseInfo",
                    data: JSON.stringify({
                      list: [
                        {
                          key: "実装バージョン",
                          value: [
                            "<p>Ver.2.1「特殊文字テスト！@#$%^&*()」</p>",
                          ],
                        },
                      ],
                    }),
                  },
                ],
              },
            ],
          },
        },
      };

      const releaseVersion = dataProcessor.extractReleaseVersion(
        specialCharVersionData
      );

      expect(releaseVersion).toBe(2.1);

      // 統計情報の確認
      const stats = releaseVersionStatistics.getStatistics();
      expect(stats.successful).toBe(1);
      expect(stats.failed).toBe(0);
    });

    it("マイナーバージョンが0の場合も正しく処理される", () => {
      const minorZeroVersionData = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "test_character",
            name: "テストキャラクター",
            modules: [
              {
                components: [
                  {
                    component_id: "baseInfo",
                    data: JSON.stringify({
                      list: [
                        {
                          key: "実装バージョン",
                          value: ["<p>Ver.3.0「メジャーバージョンテスト」</p>"],
                        },
                      ],
                    }),
                  },
                ],
              },
            ],
          },
        },
      };

      const releaseVersion =
        dataProcessor.extractReleaseVersion(minorZeroVersionData);

      expect(releaseVersion).toBe(3.0);

      // 統計情報の確認
      const stats = releaseVersionStatistics.getStatistics();
      expect(stats.successful).toBe(1);
      expect(stats.failed).toBe(0);
    });
  });

  describe("複合エラーケースでのテスト", () => {
    it("複数のキャラクターで一部が失敗する場合の統計情報確認", () => {
      const testCases = [
        // 成功ケース
        {
          retcode: 0,
          message: "OK",
          data: {
            page: {
              id: "success_character",
              name: "成功キャラクター",
              modules: [
                {
                  components: [
                    {
                      component_id: "baseInfo",
                      data: JSON.stringify({
                        list: [
                          {
                            key: "実装バージョン",
                            value: ["<p>Ver.1.0「成功テスト」</p>"],
                          },
                        ],
                      }),
                    },
                  ],
                },
              ],
            },
          },
        },
        // 失敗ケース1: baseInfoコンポーネントなし
        {
          retcode: 0,
          message: "OK",
          data: {
            page: {
              id: "fail_character_1",
              name: "失敗キャラクター1",
              modules: [
                {
                  components: [
                    {
                      component_id: "other_component",
                      data: JSON.stringify({ some: "data" }),
                    },
                  ],
                },
              ],
            },
          },
        },
        // 失敗ケース2: バージョンキーなし
        {
          retcode: 0,
          message: "OK",
          data: {
            page: {
              id: "fail_character_2",
              name: "失敗キャラクター2",
              modules: [
                {
                  components: [
                    {
                      component_id: "baseInfo",
                      data: JSON.stringify({
                        list: [
                          {
                            key: "その他の情報",
                            value: ["何かの値"],
                          },
                        ],
                      }),
                    },
                  ],
                },
              ],
            },
          },
        },
      ];

      // 各テストケースを実行
      const results = testCases.map((testCase) =>
        dataProcessor.extractReleaseVersion(testCase)
      );

      // 結果の確認
      expect(results[0]).toBe(1.0); // 成功
      expect(results[1]).toBe(0); // 失敗1
      expect(results[2]).toBe(0); // 失敗2

      // 統計情報の確認
      const stats = releaseVersionStatistics.getStatistics();
      expect(stats.total).toBe(3);
      expect(stats.successful).toBe(1);
      expect(stats.failed).toBe(2);
      expect(stats.defaultUsed).toBe(2);

      const details = releaseVersionStatistics.getDetails();
      expect(details.successful).toHaveLength(1);
      expect(details.failed).toHaveLength(2);
      expect(details.failed[0].reason).toBe("baseinfo_component_not_found");
      expect(details.failed[1].reason).toBe("version_key_not_found");
    });

    it("extractBasicInfoメソッドでreleaseVersionエラーが発生しても他の情報は正常に抽出される", () => {
      const mixedApiData = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "mixed_test_character",
            name: "混合テストキャラクター",
            filter_values: {
              agent_specialties: { values: ["撃破"] },
              agent_stats: { values: ["電気属性"] },
              agent_rarity: { values: ["A"] },
            },
            modules: [
              {
                components: [
                  // baseInfoコンポーネントが存在しない（releaseVersionエラー）
                  {
                    component_id: "other_component",
                    data: JSON.stringify({ some: "data" }),
                  },
                ],
              },
            ],
          },
        },
      };

      const basicInfo = dataProcessor.extractBasicInfo(mixedApiData);

      // 基本情報は正常に抽出される
      expect(basicInfo.id).toBe("mixed_test_character");
      expect(basicInfo.name).toBe("混合テストキャラクター");
      expect(basicInfo.specialty).toBe("撃破");
      expect(basicInfo.stats).toBe("電気属性");
      expect(basicInfo.rarity).toBe("A");

      // releaseVersionはデフォルト値0が設定される
      expect(basicInfo.releaseVersion).toBe(0);

      // 統計情報でエラーが記録される
      const stats = releaseVersionStatistics.getStatistics();
      expect(stats.failed).toBe(1);
      expect(stats.defaultUsed).toBe(1);
    });
  });
});
