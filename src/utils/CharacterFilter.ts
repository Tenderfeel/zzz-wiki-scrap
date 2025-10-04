import { CharacterEntry } from "../types";
import { CharacterFilter as FilterConfig } from "../config/ProcessingConfig";

/**
 * フィルタリング結果
 */
export interface FilteringResult {
  filtered: CharacterEntry[];
  excluded: CharacterEntry[];
  statistics: FilteringStatistics;
}

/**
 * フィルタリング統計
 */
export interface FilteringStatistics {
  originalCount: number;
  filteredCount: number;
  excludedCount: number;
  filteringRate: number; // 0-1
  appliedFilters: string[];
}

/**
 * キャラクターフィルタリングユーティリティ
 * 様々な条件でキャラクターをフィルタリング
 */
export class CharacterFilterUtil {
  /**
   * キャラクターエントリーをフィルタリング
   * @param entries 元のキャラクターエントリー配列
   * @param filterConfig フィルター設定
   * @returns フィルタリング結果
   */
  static filterCharacters(
    entries: CharacterEntry[],
    filterConfig: FilterConfig
  ): FilteringResult {
    console.log(`\n🔍 === キャラクターフィルタリング開始 ===`);
    console.log(`元のキャラクター数: ${entries.length}`);

    let filtered = [...entries];
    const excluded: CharacterEntry[] = [];
    const appliedFilters: string[] = [];

    // 1. 包含フィルター（指定されたキャラクターのみ）
    if (
      filterConfig.includeCharacterIds &&
      filterConfig.includeCharacterIds.length > 0
    ) {
      const beforeCount = filtered.length;
      const includeSet = new Set(filterConfig.includeCharacterIds);

      const { included, notIncluded } = this.partitionByCondition(
        filtered,
        (entry) => includeSet.has(entry.id)
      );

      filtered = included;
      excluded.push(...notIncluded);
      appliedFilters.push(
        `包含フィルター: ${filterConfig.includeCharacterIds.length}件指定`
      );

      console.log(`📋 包含フィルター適用: ${beforeCount} → ${filtered.length}`);
      console.log(`   対象: ${filterConfig.includeCharacterIds.join(", ")}`);
    }

    // 2. 除外フィルター
    if (
      filterConfig.excludeCharacterIds &&
      filterConfig.excludeCharacterIds.length > 0
    ) {
      const beforeCount = filtered.length;
      const excludeSet = new Set(filterConfig.excludeCharacterIds);

      const { included, notIncluded } = this.partitionByCondition(
        filtered,
        (entry) => !excludeSet.has(entry.id)
      );

      filtered = included;
      excluded.push(...notIncluded);
      appliedFilters.push(
        `除外フィルター: ${filterConfig.excludeCharacterIds.length}件指定`
      );

      console.log(`🚫 除外フィルター適用: ${beforeCount} → ${filtered.length}`);
      console.log(`   除外: ${filterConfig.excludeCharacterIds.join(", ")}`);
    }

    // 3. ページID包含フィルター
    if (filterConfig.includePageIds && filterConfig.includePageIds.length > 0) {
      const beforeCount = filtered.length;
      const includePageIdSet = new Set(filterConfig.includePageIds);

      const { included, notIncluded } = this.partitionByCondition(
        filtered,
        (entry) => includePageIdSet.has(entry.pageId)
      );

      filtered = included;
      excluded.push(...notIncluded);
      appliedFilters.push(
        `ページID包含フィルター: ${filterConfig.includePageIds.length}件指定`
      );

      console.log(
        `📄 ページID包含フィルター適用: ${beforeCount} → ${filtered.length}`
      );
    }

    // 4. ページID除外フィルター
    if (filterConfig.excludePageIds && filterConfig.excludePageIds.length > 0) {
      const beforeCount = filtered.length;
      const excludePageIdSet = new Set(filterConfig.excludePageIds);

      const { included, notIncluded } = this.partitionByCondition(
        filtered,
        (entry) => !excludePageIdSet.has(entry.pageId)
      );

      filtered = included;
      excluded.push(...notIncluded);
      appliedFilters.push(
        `ページID除外フィルター: ${filterConfig.excludePageIds.length}件指定`
      );

      console.log(
        `🚫 ページID除外フィルター適用: ${beforeCount} → ${filtered.length}`
      );
    }

    // 5. ページID範囲フィルター
    if (filterConfig.pageIdRange) {
      const beforeCount = filtered.length;
      const { min, max } = filterConfig.pageIdRange;

      const { included, notIncluded } = this.partitionByCondition(
        filtered,
        (entry) => entry.pageId >= min && entry.pageId <= max
      );

      filtered = included;
      excluded.push(...notIncluded);
      appliedFilters.push(`ページID範囲フィルター: ${min}-${max}`);

      console.log(
        `📊 ページID範囲フィルター適用: ${beforeCount} → ${filtered.length}`
      );
      console.log(`   範囲: ${min}-${max}`);
    }

    // 6. ランダムサンプリング
    if (
      filterConfig.randomSample?.enabled &&
      filterConfig.randomSample.count > 0
    ) {
      const beforeCount = filtered.length;
      const sampleCount = Math.min(
        filterConfig.randomSample.count,
        filtered.length
      );

      if (sampleCount < filtered.length) {
        const { sampled, notSampled } = this.randomSample(
          filtered,
          sampleCount,
          filterConfig.randomSample.seed
        );

        filtered = sampled;
        excluded.push(...notSampled);
        appliedFilters.push(`ランダムサンプリング: ${sampleCount}件`);

        console.log(
          `🎲 ランダムサンプリング適用: ${beforeCount} → ${filtered.length}`
        );
        console.log(`   サンプル数: ${sampleCount}`);
        if (filterConfig.randomSample.seed !== undefined) {
          console.log(`   シード値: ${filterConfig.randomSample.seed}`);
        }
      }
    }

    // 7. 最大処理数制限
    if (filterConfig.maxCharacters && filterConfig.maxCharacters > 0) {
      const beforeCount = filtered.length;
      const maxCount = Math.min(filterConfig.maxCharacters, filtered.length);

      if (maxCount < filtered.length) {
        const limited = filtered.slice(0, maxCount);
        const overflow = filtered.slice(maxCount);

        filtered = limited;
        excluded.push(...overflow);
        appliedFilters.push(`最大処理数制限: ${maxCount}件`);

        console.log(
          `🔢 最大処理数制限適用: ${beforeCount} → ${filtered.length}`
        );
        console.log(`   制限数: ${maxCount}`);
      }
    }

    // 統計情報を生成
    const statistics: FilteringStatistics = {
      originalCount: entries.length,
      filteredCount: filtered.length,
      excludedCount: excluded.length,
      filteringRate: entries.length > 0 ? filtered.length / entries.length : 0,
      appliedFilters,
    };

    console.log(`\n📊 フィルタリング結果:`);
    console.log(`  元のキャラクター数: ${statistics.originalCount}`);
    console.log(`  フィルタリング後: ${statistics.filteredCount}`);
    console.log(`  除外されたキャラクター: ${statistics.excludedCount}`);
    console.log(
      `  フィルタリング率: ${Math.round(statistics.filteringRate * 100)}%`
    );
    console.log(`  適用されたフィルター: ${appliedFilters.length}個`);
    appliedFilters.forEach((filter, index) => {
      console.log(`    ${index + 1}. ${filter}`);
    });
    console.log(`=====================================\n`);

    return {
      filtered,
      excluded,
      statistics,
    };
  }

  /**
   * 条件に基づいて配列を分割
   */
  private static partitionByCondition<T>(
    array: T[],
    condition: (item: T) => boolean
  ): { included: T[]; notIncluded: T[] } {
    const included: T[] = [];
    const notIncluded: T[] = [];

    array.forEach((item) => {
      if (condition(item)) {
        included.push(item);
      } else {
        notIncluded.push(item);
      }
    });

    return { included, notIncluded };
  }

  /**
   * ランダムサンプリング
   */
  private static randomSample<T>(
    array: T[],
    count: number,
    seed?: number
  ): { sampled: T[]; notSampled: T[] } {
    if (count >= array.length) {
      return { sampled: [...array], notSampled: [] };
    }

    // シード値が指定されている場合は決定的な疑似乱数を使用
    let random: () => number;
    if (seed !== undefined) {
      random = this.createSeededRandom(seed);
    } else {
      random = Math.random;
    }

    // Fisher-Yates シャッフルアルゴリズムを使用
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const sampled = shuffled.slice(0, count);
    const notSampled = shuffled.slice(count);

    return { sampled, notSampled };
  }

  /**
   * シード値を使用した疑似乱数生成器を作成
   */
  private static createSeededRandom(seed: number): () => number {
    let state = seed;
    return () => {
      // Linear Congruential Generator (LCG)
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }

  /**
   * フィルタリング結果のレポートを生成
   */
  static generateFilteringReport(result: FilteringResult): string {
    const { filtered, excluded, statistics } = result;

    let report = `# キャラクターフィルタリングレポート\n\n`;
    report += `生成日時: ${new Date().toLocaleString()}\n\n`;

    report += `## フィルタリング統計\n`;
    report += `- 元のキャラクター数: ${statistics.originalCount}\n`;
    report += `- フィルタリング後: ${statistics.filteredCount}\n`;
    report += `- 除外されたキャラクター: ${statistics.excludedCount}\n`;
    report += `- フィルタリング率: ${Math.round(
      statistics.filteringRate * 100
    )}%\n\n`;

    if (statistics.appliedFilters.length > 0) {
      report += `## 適用されたフィルター\n`;
      statistics.appliedFilters.forEach((filter, index) => {
        report += `${index + 1}. ${filter}\n`;
      });
      report += `\n`;
    }

    if (filtered.length > 0) {
      report += `## 処理対象キャラクター (${filtered.length})\n`;
      filtered.forEach((entry, index) => {
        report += `${index + 1}. ${entry.id} (ページID: ${entry.pageId})\n`;
      });
      report += `\n`;
    }

    if (excluded.length > 0) {
      report += `## 除外されたキャラクター (${excluded.length})\n`;
      excluded.forEach((entry, index) => {
        report += `${index + 1}. ${entry.id} (ページID: ${entry.pageId})\n`;
      });
      report += `\n`;
    }

    return report;
  }

  /**
   * フィルター設定の妥当性を検証
   */
  static validateFilterConfig(filterConfig: FilterConfig): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 包含と除外の競合チェック
    if (filterConfig.includeCharacterIds && filterConfig.excludeCharacterIds) {
      const includeSet = new Set(filterConfig.includeCharacterIds);
      const excludeSet = new Set(filterConfig.excludeCharacterIds);
      const conflicts = filterConfig.includeCharacterIds.filter((id) =>
        excludeSet.has(id)
      );

      if (conflicts.length > 0) {
        warnings.push(
          `包含と除外で競合するキャラクターID: ${conflicts.join(", ")}`
        );
      }
    }

    // ページID範囲の妥当性チェック
    if (filterConfig.pageIdRange) {
      if (filterConfig.pageIdRange.min >= filterConfig.pageIdRange.max) {
        errors.push("ページID範囲の最小値が最大値以上です");
      }
      if (filterConfig.pageIdRange.min < 1) {
        errors.push("ページID範囲の最小値は1以上である必要があります");
      }
    }

    // ランダムサンプリングの妥当性チェック
    if (filterConfig.randomSample?.enabled) {
      if (filterConfig.randomSample.count < 1) {
        errors.push("ランダムサンプリングの件数は1以上である必要があります");
      }
    }

    // 最大処理数の妥当性チェック
    if (filterConfig.maxCharacters && filterConfig.maxCharacters < 1) {
      errors.push("最大処理数は1以上である必要があります");
    }

    // 空の配列チェック
    if (filterConfig.includeCharacterIds?.length === 0) {
      warnings.push("包含キャラクターIDが空の配列です");
    }
    if (filterConfig.excludeCharacterIds?.length === 0) {
      warnings.push("除外キャラクターIDが空の配列です");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * フィルター設定のプレビューを生成
   */
  static previewFiltering(
    entries: CharacterEntry[],
    filterConfig: FilterConfig
  ): {
    estimatedCount: number;
    affectedCharacters: string[];
    filterDescription: string;
  } {
    // 実際のフィルタリングを実行せずに推定
    let estimatedCount = entries.length;
    const affectedCharacters: string[] = [];
    const descriptions: string[] = [];

    if (
      filterConfig.includeCharacterIds &&
      filterConfig.includeCharacterIds.length > 0
    ) {
      const includeSet = new Set(filterConfig.includeCharacterIds);
      estimatedCount = entries.filter((entry) =>
        includeSet.has(entry.id)
      ).length;
      affectedCharacters.push(...filterConfig.includeCharacterIds);
      descriptions.push(
        `包含フィルター: ${filterConfig.includeCharacterIds.length}件`
      );
    }

    if (
      filterConfig.excludeCharacterIds &&
      filterConfig.excludeCharacterIds.length > 0
    ) {
      const excludeSet = new Set(filterConfig.excludeCharacterIds);
      const excludeCount = entries.filter((entry) =>
        excludeSet.has(entry.id)
      ).length;
      estimatedCount = Math.max(0, estimatedCount - excludeCount);
      descriptions.push(
        `除外フィルター: ${filterConfig.excludeCharacterIds.length}件`
      );
    }

    if (filterConfig.pageIdRange) {
      const { min, max } = filterConfig.pageIdRange;
      const rangeCount = entries.filter(
        (entry) => entry.pageId >= min && entry.pageId <= max
      ).length;
      estimatedCount = Math.min(estimatedCount, rangeCount);
      descriptions.push(`ページID範囲: ${min}-${max}`);
    }

    if (filterConfig.maxCharacters && filterConfig.maxCharacters > 0) {
      estimatedCount = Math.min(estimatedCount, filterConfig.maxCharacters);
      descriptions.push(`最大処理数: ${filterConfig.maxCharacters}件`);
    }

    if (
      filterConfig.randomSample?.enabled &&
      filterConfig.randomSample.count > 0
    ) {
      estimatedCount = Math.min(
        estimatedCount,
        filterConfig.randomSample.count
      );
      descriptions.push(
        `ランダムサンプリング: ${filterConfig.randomSample.count}件`
      );
    }

    return {
      estimatedCount,
      affectedCharacters: [...new Set(affectedCharacters)],
      filterDescription: descriptions.join(", "),
    };
  }
}
