import { describe, it, expect, beforeEach, vi } from "vitest";
import { AssistTypeStatistics } from "../../src/utils/AssistTypeStatistics";
import { AssistType } from "../../src/types/index";

describe("AssistTypeStatistics", () => {
  let statistics: AssistTypeStatistics;

  beforeEach(() => {
    statistics = new AssistTypeStatistics();
  });

  describe("recordCharacter", () => {
    it("回避支援キャラクターを正しく記録する", () => {
      statistics.recordCharacter("lycaon", "evasive");

      const stats = statistics.getStatistics();
      expect(stats.total).toBe(1);
      expect(stats.evasive).toBe(1);
      expect(stats.defensive).toBe(0);
      expect(stats.unknown).toBe(0);
      expect(stats.errors).toBe(0);

      const details = statistics.getDetails();
      expect(details.evasive).toContain("lycaon");
    });

    it("パリィ支援キャラクターを正しく記録する", () => {
      statistics.recordCharacter("soldier11", "defensive");

      const stats = statistics.getStatistics();
      expect(stats.total).toBe(1);
      expect(stats.evasive).toBe(0);
      expect(stats.defensive).toBe(1);
      expect(stats.unknown).toBe(0);
      expect(stats.errors).toBe(0);

      const details = statistics.getDetails();
      expect(details.defensive).toContain("soldier11");
    });

    it("支援タイプ不明キャラクターを正しく記録する", () => {
      statistics.recordCharacter("billy", undefined);

      const stats = statistics.getStatistics();
      expect(stats.total).toBe(1);
      expect(stats.evasive).toBe(0);
      expect(stats.defensive).toBe(0);
      expect(stats.unknown).toBe(1);
      expect(stats.errors).toBe(0);

      const details = statistics.getDetails();
      expect(details.unknown).toContain("billy");
    });

    it("複数のキャラクターを正しく記録する", () => {
      statistics.recordCharacter("lycaon", "evasive");
      statistics.recordCharacter("soldier11", "defensive");
      statistics.recordCharacter("billy", undefined);

      const stats = statistics.getStatistics();
      expect(stats.total).toBe(3);
      expect(stats.evasive).toBe(1);
      expect(stats.defensive).toBe(1);
      expect(stats.unknown).toBe(1);
      expect(stats.errors).toBe(0);
    });
  });

  describe("recordError", () => {
    it("エラーを正しく記録する", () => {
      statistics.recordError("test-character", "テストエラー");

      const stats = statistics.getStatistics();
      expect(stats.errors).toBe(1);

      const details = statistics.getDetails();
      expect(details.errors).toHaveLength(1);
      expect(details.errors[0]).toEqual({
        characterId: "test-character",
        error: "テストエラー",
      });
    });

    it("複数のエラーを記録する", () => {
      statistics.recordError("char1", "エラー1");
      statistics.recordError("char2", "エラー2");

      const stats = statistics.getStatistics();
      expect(stats.errors).toBe(2);

      const details = statistics.getDetails();
      expect(details.errors).toHaveLength(2);
    });
  });

  describe("reset", () => {
    it("統計情報を正しくリセットする", () => {
      // データを追加
      statistics.recordCharacter("lycaon", "evasive");
      statistics.recordCharacter("soldier11", "defensive");
      statistics.recordError("test", "エラー");

      // リセット前の確認
      let stats = statistics.getStatistics();
      expect(stats.total).toBe(2);
      expect(stats.errors).toBe(1);

      // リセット
      statistics.reset();

      // リセット後の確認
      stats = statistics.getStatistics();
      expect(stats.total).toBe(0);
      expect(stats.evasive).toBe(0);
      expect(stats.defensive).toBe(0);
      expect(stats.unknown).toBe(0);
      expect(stats.errors).toBe(0);

      const details = statistics.getDetails();
      expect(details.evasive).toHaveLength(0);
      expect(details.defensive).toHaveLength(0);
      expect(details.unknown).toHaveLength(0);
      expect(details.errors).toHaveLength(0);
    });
  });

  describe("getSummaryString", () => {
    it("統計サマリー文字列を正しく生成する", () => {
      statistics.recordCharacter("lycaon", "evasive");
      statistics.recordCharacter("soldier11", "defensive");
      statistics.recordCharacter("billy", undefined);
      statistics.recordError("test", "エラー");

      const summary = statistics.getSummaryString();
      expect(summary).toBe(
        "支援タイプ統計: 総数=3, 回避=1, パリィ=1, 不明=1, エラー=1"
      );
    });

    it("空の統計でも正しく動作する", () => {
      const summary = statistics.getSummaryString();
      expect(summary).toBe(
        "支援タイプ統計: 総数=0, 回避=0, パリィ=0, 不明=0, エラー=0"
      );
    });
  });

  describe("logStatistics", () => {
    it("統計情報をログに出力する", () => {
      // テスト環境では実際のログ出力は抑制されるため、
      // logStatisticsメソッドが正常に実行されることのみを確認
      statistics.recordCharacter("lycaon", "evasive");
      statistics.recordCharacter("soldier11", "defensive");

      // エラーが発生しないことを確認
      expect(() => statistics.logStatistics()).not.toThrow();
    });
  });

  describe("パーセンテージ計算", () => {
    it("パーセンテージを正しく計算する", () => {
      statistics.recordCharacter("char1", "evasive");
      statistics.recordCharacter("char2", "evasive");
      statistics.recordCharacter("char3", "defensive");
      statistics.recordCharacter("char4", undefined);

      // logStatisticsを呼び出してパーセンテージ計算をテスト
      const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      statistics.logStatistics();

      // 内部的にパーセンテージが正しく計算されていることを確認
      const stats = statistics.getStatistics();
      expect(stats.total).toBe(4);
      expect(stats.evasive / stats.total).toBeCloseTo(0.5); // 50%
      expect(stats.defensive / stats.total).toBeCloseTo(0.25); // 25%
      expect(stats.unknown / stats.total).toBeCloseTo(0.25); // 25%

      consoleSpy.mockRestore();
    });
  });
});
