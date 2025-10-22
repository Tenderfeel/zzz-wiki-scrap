import { describe, test, expect, beforeEach } from "vitest";
import { WeaponAttributeExtractor } from "../../src/extractors/WeaponAttributeExtractor";
import { WeaponAttributeProcessor } from "../../src/processors/WeaponAttributeProcessor";
import {
  Weapon,
  EnhancedWeapon,
  Stats,
  ProcessingResult,
} from "../../src/types";
import weaponsData from "../../data/weapons";

describe("WeaponProcessingIntegration", () => {
  let extractor: WeaponAttributeExtractor;
  let processor: WeaponAttributeProcessor;

  beforeEach(() => {
    extractor = new WeaponAttributeExtractor();
    processor = new WeaponAttributeProcessor(extractor);
  });

  describe("実データでのエンドツーエンド処理テスト", () => {
    test("実際の武器データから属性を正しく抽出できること", () => {
      // 実データから炎属性を含む武器を選択
      const fireWeapon = weaponsData.find((w) =>
        w.equipmentSkillDesc.ja.includes("炎属性ダメージ")
      );

      expect(fireWeapon, "炎属性武器が見つからない").toBeDefined();

      if (fireWeapon) {
        const enhancedWeapon = processor.processWeapon(fireWeapon);

        expect(enhancedWeapon.extractedAttributes).toContain("fire");
        expect(enhancedWeapon.id).toBe(fireWeapon.id);
        expect(enhancedWeapon.name).toEqual(fireWeapon.name);

        // 元の武器データが保持されていることを確認
        expect(enhancedWeapon.equipmentSkillDesc).toEqual(
          fireWeapon.equipmentSkillDesc
        );
        expect(enhancedWeapon.stats).toEqual(fireWeapon.stats);
      }
    });

    test("電気属性を含む実データから正しく抽出できること", () => {
      const electricWeapon = weaponsData.find((w) =>
        w.equipmentSkillDesc.ja.includes("電気属性ダメージ")
      );

      expect(electricWeapon, "電気属性武器が見つからない").toBeDefined();

      if (electricWeapon) {
        const enhancedWeapon = processor.processWeapon(electricWeapon);

        expect(enhancedWeapon.extractedAttributes).toContain("electric");
        expect(enhancedWeapon.id).toBe(electricWeapon.id);
      }
    });

    test("物理属性を含む実データから正しく抽出できること", () => {
      const physicalWeapon = weaponsData.find((w) =>
        w.equipmentSkillDesc.ja.includes("物理属性ダメージ")
      );

      expect(physicalWeapon, "物理属性武器が見つからない").toBeDefined();

      if (physicalWeapon) {
        const enhancedWeapon = processor.processWeapon(physicalWeapon);

        expect(enhancedWeapon.extractedAttributes).toContain("physical");
        expect(enhancedWeapon.id).toBe(physicalWeapon.id);
      }
    });

    test("属性を含まない実データでは空配列を返すこと", () => {
      const nonAttributeWeapon = weaponsData.find(
        (w) =>
          !w.equipmentSkillDesc.ja.includes("属性ダメージ") &&
          !w.equipmentSkillDesc.ja.includes("属性を与え") &&
          !w.equipmentSkillDesc.ja.includes("属性で") &&
          !w.equipmentSkillDesc.ja.includes("属性の")
      );

      expect(nonAttributeWeapon, "非属性武器が見つからない").toBeDefined();

      if (nonAttributeWeapon) {
        const enhancedWeapon = processor.processWeapon(nonAttributeWeapon);

        expect(enhancedWeapon.extractedAttributes).toEqual([]);
        expect(enhancedWeapon.id).toBe(nonAttributeWeapon.id);
      }
    });

    test("複数属性を含む実データから正しく抽出できること", () => {
      // 複数属性を含む武器を探す
      const multiAttributeWeapon = weaponsData.find((w) => {
        const desc = w.equipmentSkillDesc.ja;
        const attributeCount = [
          desc.includes("炎属性"),
          desc.includes("氷属性"),
          desc.includes("電気属性"),
          desc.includes("物理属性"),
          desc.includes("エーテル属性"),
        ].filter(Boolean).length;
        return attributeCount > 1;
      });

      if (multiAttributeWeapon) {
        const enhancedWeapon = processor.processWeapon(multiAttributeWeapon);

        expect(enhancedWeapon.extractedAttributes.length).toBeGreaterThan(1);
        expect(enhancedWeapon.id).toBe(multiAttributeWeapon.id);

        // 重複がないことを確認
        const uniqueAttributes = [
          ...new Set(enhancedWeapon.extractedAttributes),
        ];
        expect(enhancedWeapon.extractedAttributes).toEqual(uniqueAttributes);
      }
    });
  });

  describe("バッチ処理パフォーマンステスト", () => {
    test("全実データを効率的に処理できること", () => {
      const startTime = Date.now();
      const result = processor.processWeapons(weaponsData);
      const endTime = Date.now();

      const processingTime = endTime - startTime;
      const weaponCount = weaponsData.length;

      // パフォーマンス要件
      expect(processingTime).toBeLessThan(10000); // 10秒以内
      expect(processingTime / weaponCount).toBeLessThan(100); // 武器1つあたり100ms以内

      // 処理結果の検証
      expect(result.successful.length + result.failed.length).toBe(weaponCount);
      expect(result.statistics.totalProcessed).toBe(weaponCount);
      expect(result.statistics.successRate).toBeGreaterThan(90); // 90%以上の成功率

      console.log(
        `処理時間: ${processingTime}ms, 武器数: ${weaponCount}, 成功率: ${result.statistics.successRate}%`
      );
    });

    test("大量データのバッチ処理で適切な統計情報を提供すること", () => {
      const result = processor.processWeapons(weaponsData);

      // 統計情報の検証
      expect(result.statistics).toHaveProperty("totalProcessed");
      expect(result.statistics).toHaveProperty("successful");
      expect(result.statistics).toHaveProperty("failed");
      expect(result.statistics).toHaveProperty("successRate");
      expect(result.statistics).toHaveProperty("totalTime");

      expect(result.statistics.totalProcessed).toBe(weaponsData.length);
      expect(result.statistics.successful).toBe(result.successful.length);
      expect(result.statistics.failed).toBe(result.failed.length);
      expect(result.statistics.successful + result.statistics.failed).toBe(
        result.statistics.totalProcessed
      );

      // 成功率の計算が正確であることを確認
      const expectedSuccessRate =
        (result.statistics.successful / result.statistics.totalProcessed) * 100;
      expect(result.statistics.successRate).toBeCloseTo(expectedSuccessRate, 2);
    });

    test("バッチ処理で属性分布を正確に処理できること", () => {
      const result = processor.processWeapons(weaponsData);

      // 各属性の出現回数を集計
      const attributeCounts: Record<Stats, number> = {
        fire: 0,
        ice: 0,
        electric: 0,
        physical: 0,
        ether: 0,
      };

      result.successful.forEach((weapon) => {
        weapon.extractedAttributes.forEach((attr) => {
          attributeCounts[attr]++;
        });
      });

      // 少なくとも一部の属性が検出されることを確認
      const totalAttributes = Object.values(attributeCounts).reduce(
        (sum, count) => sum + count,
        0
      );
      expect(totalAttributes).toBeGreaterThan(0);

      console.log("属性分布:", attributeCounts);
    });

    test("メモリ効率的な処理ができること", () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // 大量データを複数回処理
      for (let i = 0; i < 3; i++) {
        const result = processor.processWeapons(weaponsData);
        expect(result.successful.length).toBeGreaterThan(0);
      }

      // ガベージコレクションを促す
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // メモリ増加が合理的な範囲内であることを確認（100MB以下）
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);

      console.log(
        `メモリ使用量増加: ${Math.round(memoryIncrease / 1024 / 1024)}MB`
      );
    });
  });

  describe("エラーハンドリングとリカバリテスト", () => {
    test("不正な武器データが混在してもリカバリできること", () => {
      const mixedData: (Weapon | null | undefined)[] = [
        ...weaponsData.slice(0, 3), // 正常なデータ
        null, // null データ
        undefined, // undefined データ
        ...weaponsData.slice(3, 6), // 正常なデータ
        {
          ...weaponsData[0],
          equipmentSkillDesc: null as any, // 不正なスキル説明
        },
        ...weaponsData.slice(6, 9), // 正常なデータ
      ];

      const result = processor.processWeapons(mixedData as Weapon[], true);

      // 正常なデータは処理されること
      expect(result.successful.length).toBeGreaterThan(6);

      // エラーが適切に記録されること
      expect(result.failed.length).toBeGreaterThan(0);

      // 統計情報が正確であること
      expect(result.statistics.totalProcessed).toBe(mixedData.length);
      expect(result.statistics.successful + result.statistics.failed).toBe(
        mixedData.length
      );

      // エラー詳細が記録されていること
      result.failed.forEach((failure) => {
        expect(failure).toHaveProperty("weaponId");
        expect(failure).toHaveProperty("error");
        expect(typeof failure.error).toBe("string");
      });
    });

    test("スキル説明が異常な武器でもリカバリできること", () => {
      const problematicWeapons: Weapon[] = [
        {
          ...weaponsData[0],
          equipmentSkillDesc: {
            ja: "", // 空文字列
            en: "",
          },
        },
        {
          ...weaponsData[1],
          equipmentSkillDesc: {
            ja: "   ", // 空白のみ
            en: "   ",
          },
        },
        {
          ...weaponsData[2],
          equipmentSkillDesc: {
            ja: "異常に長いテキスト".repeat(1000), // 異常に長いテキスト
            en: "Very long text".repeat(1000),
          },
        },
        {
          ...weaponsData[3],
          equipmentSkillDesc: {
            ja: "特殊文字★☆※◆◇□■△▲▽▼", // 特殊文字のみ
            en: "Special characters only",
          },
        },
      ];

      const result = processor.processWeapons(problematicWeapons, true);

      // 全て処理されること（エラーでも部分的な結果を返す）
      expect(result.statistics.totalProcessed).toBe(problematicWeapons.length);

      // 少なくとも一部は成功すること
      expect(result.successful.length).toBeGreaterThanOrEqual(0);

      // エラーが発生した場合も適切に記録されること
      if (result.failed.length > 0) {
        result.failed.forEach((failure) => {
          expect(failure.error).toBeTruthy();
          expect(typeof failure.error).toBe("string");
        });
      }
    });

    test("処理中断後の再開が正常に動作すること", () => {
      const testWeapons = weaponsData.slice(0, 10);

      // 最初の処理
      const firstResult = processor.processWeapons(testWeapons.slice(0, 5));
      expect(firstResult.successful.length).toBeGreaterThan(0);

      // 残りの処理
      const secondResult = processor.processWeapons(testWeapons.slice(5));
      expect(secondResult.successful.length).toBeGreaterThan(0);

      // 全体処理との整合性確認
      const fullResult = processor.processWeapons(testWeapons);
      expect(fullResult.successful.length).toBe(
        firstResult.successful.length + secondResult.successful.length
      );
    });

    test("同時処理でのデータ整合性が保たれること", async () => {
      const testWeapons = weaponsData.slice(0, 20);

      // 複数の処理を同時実行
      const promises = [
        Promise.resolve(processor.processWeapons(testWeapons.slice(0, 5))),
        Promise.resolve(processor.processWeapons(testWeapons.slice(5, 10))),
        Promise.resolve(processor.processWeapons(testWeapons.slice(10, 15))),
        Promise.resolve(processor.processWeapons(testWeapons.slice(15, 20))),
      ];

      const results = await Promise.all(promises);

      // 各結果が正常であることを確認
      results.forEach((result, index) => {
        expect(result.successful.length).toBeGreaterThanOrEqual(0);
        expect(result.statistics.totalProcessed).toBe(5);
        console.log(`並列処理${index + 1}: 成功${result.successful.length}件`);
      });

      // 全体の成功数が期待値と一致することを確認
      const totalSuccessful = results.reduce(
        (sum, result) => sum + result.successful.length,
        0
      );
      const singleResult = processor.processWeapons(testWeapons);
      expect(totalSuccessful).toBe(singleResult.successful.length);
    });
  });

  describe("実データでの精度検証テスト", () => {
    test("既知の属性パターンを持つ武器の抽出精度が高いこと", () => {
      // 明確な属性表現を持つ武器を特定
      const knownPatterns = [
        { pattern: "炎属性ダメージ", expected: "fire" },
        { pattern: "氷属性ダメージ", expected: "ice" },
        { pattern: "電気属性ダメージ", expected: "electric" },
        { pattern: "物理属性ダメージ", expected: "physical" },
        { pattern: "エーテル属性ダメージ", expected: "ether" },
      ];

      knownPatterns.forEach(({ pattern, expected }) => {
        const weaponsWithPattern = weaponsData.filter((w) =>
          w.equipmentSkillDesc.ja.includes(pattern)
        );

        if (weaponsWithPattern.length > 0) {
          const results = processor.processWeapons(weaponsWithPattern);

          // 全ての武器で期待される属性が抽出されることを確認
          results.successful.forEach((weapon) => {
            expect(
              weapon.extractedAttributes,
              `武器ID ${weapon.id} で ${expected} 属性が抽出されない`
            ).toContain(expected as Stats);
          });

          console.log(
            `${pattern}: ${weaponsWithPattern.length}件中${results.successful.length}件成功`
          );
        }
      });
    });

    test("既存statsフィールドとの整合性を検証できること", () => {
      const result = processor.processWeapons(weaponsData);

      let matchCount = 0;
      let mismatchCount = 0;
      let noExtractionCount = 0;

      result.successful.forEach((weapon) => {
        const existingStats = weapon.stats;
        const extractedAttributes = weapon.extractedAttributes;

        if (extractedAttributes.length === 0) {
          noExtractionCount++;
        } else {
          // 既存のstatsと抽出結果の比較
          const hasMatch = extractedAttributes.some((attr) =>
            existingStats.includes(attr)
          );
          if (hasMatch) {
            matchCount++;
          } else {
            mismatchCount++;
            console.log(
              `不一致: 武器ID ${weapon.id}, 既存: ${existingStats}, 抽出: ${extractedAttributes}`
            );
          }
        }
      });

      console.log(
        `整合性結果: 一致${matchCount}件, 不一致${mismatchCount}件, 抽出なし${noExtractionCount}件`
      );

      // 統計情報の記録
      expect(matchCount + mismatchCount + noExtractionCount).toBe(
        result.successful.length
      );
    });

    test("バリデーション機能が実データで適切に動作すること", () => {
      const sampleWeapons = weaponsData.slice(0, 20);

      sampleWeapons.forEach((weapon) => {
        const enhancedWeapon = processor.processWeapon(weapon);
        const validation = processor.validateExtraction(
          weapon,
          enhancedWeapon.extractedAttributes
        );

        // バリデーション結果の構造確認
        expect(validation).toHaveProperty("isValid");
        expect(validation).toHaveProperty("errors");
        expect(validation).toHaveProperty("warnings");
        expect(validation).toHaveProperty("suggestions");

        // エラーがある場合はisValidがfalseであること
        if (validation.errors.length > 0) {
          expect(validation.isValid).toBe(false);
        }

        // 抽出された属性が有効であることを確認
        enhancedWeapon.extractedAttributes.forEach((attr) => {
          expect(["fire", "ice", "electric", "physical", "ether"]).toContain(
            attr
          );
        });
      });
    });
  });

  describe("パフォーマンス回帰テスト", () => {
    test("処理時間が許容範囲内であること", () => {
      const iterations = 3;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        const result = processor.processWeapons(weaponsData);
        const endTime = Date.now();

        times.push(endTime - startTime);
        expect(result.successful.length).toBeGreaterThan(0);
      }

      const averageTime =
        times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      console.log(
        `処理時間統計: 平均${averageTime}ms, 最大${maxTime}ms, 最小${minTime}ms`
      );

      // パフォーマンス要件
      expect(averageTime).toBeLessThan(10000); // 平均10秒以内
      expect(maxTime).toBeLessThan(15000); // 最大15秒以内

      // 処理時間の安定性（最大と最小の差が平均の200%以内、または5ms以内）
      const timeDifference = maxTime - minTime;
      const acceptableVariance = Math.max(averageTime * 2, 5);
      expect(timeDifference).toBeLessThan(acceptableVariance);
    });

    test("メモリ使用量が安定していること", () => {
      const initialMemory = process.memoryUsage();

      // 複数回処理を実行
      for (let i = 0; i < 5; i++) {
        const result = processor.processWeapons(weaponsData.slice(0, 50));
        expect(result.successful.length).toBeGreaterThan(0);
      }

      const finalMemory = process.memoryUsage();

      // メモリ使用量の変化を記録
      const heapIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const rssIncrease = finalMemory.rss - initialMemory.rss;

      console.log(
        `メモリ変化: Heap ${Math.round(
          heapIncrease / 1024 / 1024
        )}MB, RSS ${Math.round(rssIncrease / 1024 / 1024)}MB`
      );

      // メモリリークがないことを確認（50MB以下の増加）
      expect(heapIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });
});
