import { Stats } from "../types";

/**
 * 属性パターンの定義
 */
export interface AttributePattern {
  attribute: string; // 日本語属性名
  patterns: RegExp[]; // マッチングパターン
}

/**
 * 属性パターンユーティリティクラス
 * 武器のスキル説明から属性情報を抽出するための正規表現パターンを管理
 */
export class AttributePatterns {
  /**
   * 属性パターンの定義
   * 各属性に対して複数のパターンを定義し、様々な表現に対応
   */
  private static readonly PATTERNS: AttributePattern[] = [
    {
      attribute: "炎属性",
      patterns: [
        /炎属性ダメージ/g,
        /炎属性の/g,
        /炎属性を与え/g,
        /炎属性で/g,
        /炎属性による/g,
      ],
    },
    {
      attribute: "氷属性",
      patterns: [
        /氷属性ダメージ/g,
        /氷属性の/g,
        /氷属性を与え/g,
        /氷属性で/g,
        /氷属性による/g,
      ],
    },
    {
      attribute: "電気属性",
      patterns: [
        /電気属性ダメージ/g,
        /電気属性の/g,
        /電気属性を与え/g,
        /電気属性で/g,
        /電気属性による/g,
      ],
    },
    {
      attribute: "物理属性",
      patterns: [
        /物理属性ダメージ/g,
        /物理属性の/g,
        /物理属性を与え/g,
        /物理属性で/g,
        /物理属性による/g,
      ],
    },
    {
      attribute: "エーテル属性",
      patterns: [
        /エーテル属性ダメージ/g,
        /エーテル属性の/g,
        /エーテル属性を与え/g,
        /エーテル属性で/g,
        /エーテル属性による/g,
        /エーテル透徹ダメージ/g, // エーテル特有の表現
      ],
    },
  ];

  /**
   * テキストから属性パターンを検索し、マッチした属性名を返す
   * @param text 検索対象のテキスト
   * @returns マッチした日本語属性名の配列（重複なし）
   */
  static findAttributePatterns(text: string): string[] {
    const foundAttributes = new Set<string>();

    for (const attributePattern of this.PATTERNS) {
      for (const pattern of attributePattern.patterns) {
        // 正規表現をリセット（グローバルフラグ対応）
        pattern.lastIndex = 0;

        if (pattern.test(text)) {
          foundAttributes.add(attributePattern.attribute);
          break; // 同じ属性で複数パターンがマッチしても1つだけ記録
        }
      }
    }

    return Array.from(foundAttributes);
  }

  /**
   * 特定の属性パターンがテキストに存在するかチェック
   * @param text 検索対象のテキスト
   * @param attribute 検索する日本語属性名
   * @returns 属性パターンが存在する場合true
   */
  static hasAttributePattern(text: string, attribute: string): boolean {
    const attributePattern = this.PATTERNS.find(
      (pattern) => pattern.attribute === attribute
    );

    if (!attributePattern) {
      return false;
    }

    return attributePattern.patterns.some((pattern) => {
      pattern.lastIndex = 0; // 正規表現をリセット
      return pattern.test(text);
    });
  }

  /**
   * 利用可能な属性パターンの一覧を取得
   * @returns 日本語属性名の配列
   */
  static getAvailableAttributes(): string[] {
    return this.PATTERNS.map((pattern) => pattern.attribute);
  }

  /**
   * 特定の属性に対応するパターンを取得
   * @param attribute 日本語属性名
   * @returns 正規表現パターンの配列
   */
  static getPatterns(attribute: string): RegExp[] {
    const attributePattern = this.PATTERNS.find(
      (pattern) => pattern.attribute === attribute
    );
    return attributePattern ? [...attributePattern.patterns] : [];
  }

  /**
   * 全ての属性パターンを取得
   * @returns 属性パターンの配列
   */
  static getAllPatterns(): AttributePattern[] {
    return [...this.PATTERNS];
  }

  /**
   * テキスト内の属性パターンマッチの詳細情報を取得
   * @param text 検索対象のテキスト
   * @param attribute 検索する日本語属性名
   * @returns マッチした位置と回数の詳細情報
   */
  static getMatchDetails(
    text: string,
    attribute: string
  ): { matchCount: number; positions: number[]; matchedPatterns: string[] } {
    const attributePattern = this.PATTERNS.find(
      (pattern) => pattern.attribute === attribute
    );

    if (!attributePattern) {
      return { matchCount: 0, positions: [], matchedPatterns: [] };
    }

    let totalMatchCount = 0;
    const allPositions: number[] = [];
    const matchedPatterns: string[] = [];

    for (const pattern of attributePattern.patterns) {
      const globalPattern = new RegExp(pattern.source, "g");
      let match;

      while ((match = globalPattern.exec(text)) !== null) {
        totalMatchCount++;
        allPositions.push(match.index);

        if (!matchedPatterns.includes(pattern.source)) {
          matchedPatterns.push(pattern.source);
        }
      }
    }

    return {
      matchCount: totalMatchCount,
      positions: allPositions.sort((a, b) => a - b),
      matchedPatterns,
    };
  }
}
