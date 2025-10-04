import { describe, it, expect, vi, beforeEach } from "vitest";
import { EnhancedApiClient } from "../../src/clients/EnhancedApiClient";
import { CharacterEntry } from "../../src/types";
import { BatchProcessingError } from "../../src/errors";

describe("EnhancedApiClient", () => {
  let client: EnhancedApiClient;

  beforeEach(() => {
    client = new EnhancedApiClient();
  });

  describe("fetchCharacterDataBatch", () => {
    it("空の配列を処理できる", async () => {
      const results = await client.fetchCharacterDataBatch([]);
      expect(results).toEqual([]);
    });

    it("バッチ処理オプションのデフォルト値を使用する", async () => {
      const mockEntries: CharacterEntry[] = [
        { id: "test", pageId: 1, wikiUrl: "http://test.com" },
      ];

      // fetchBothLanguagesメソッドをモック
      const mockFetchBothLanguages = vi.spyOn(client, "fetchBothLanguages");
      mockFetchBothLanguages.mockRejectedValue(new Error("Test error"));

      const results = await client.fetchCharacterDataBatch(mockEntries);

      expect(results).toHaveLength(1);
      expect(results[0].data).toBeNull();
      expect(results[0].error).toBe("Test error");

      mockFetchBothLanguages.mockRestore();
    });
  });

  describe("validateBatchResults", () => {
    it("成功率が基準を満たす場合は例外を投げない", () => {
      const results = [
        { entry: { id: "test1", pageId: 1, wikiUrl: "" }, data: {} as any },
        { entry: { id: "test2", pageId: 2, wikiUrl: "" }, data: {} as any },
        {
          entry: { id: "test3", pageId: 3, wikiUrl: "" },
          data: null,
          error: "error",
        },
      ];

      expect(() => client.validateBatchResults(results, 0.6)).not.toThrow();
    });

    it("成功率が基準を下回る場合は例外を投げる", () => {
      const results = [
        {
          entry: { id: "test1", pageId: 1, wikiUrl: "" },
          data: null,
          error: "error1",
        },
        {
          entry: { id: "test2", pageId: 2, wikiUrl: "" },
          data: null,
          error: "error2",
        },
        { entry: { id: "test3", pageId: 3, wikiUrl: "" }, data: {} as any },
      ];

      expect(() => client.validateBatchResults(results, 0.8)).toThrow(
        BatchProcessingError
      );
    });
  });

  describe("generateStatistics", () => {
    it("正しい統計情報を生成する", () => {
      const results = [
        { entry: { id: "test1", pageId: 1, wikiUrl: "" }, data: {} as any },
        {
          entry: { id: "test2", pageId: 2, wikiUrl: "" },
          data: null,
          error: "error",
        },
      ];

      const startTime = new Date("2024-01-01T00:00:00Z");
      const endTime = new Date("2024-01-01T00:01:00Z");

      const stats = client.generateStatistics(results, startTime, endTime);

      expect(stats.total).toBe(2);
      expect(stats.successful).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.processingTime).toBe(60000); // 1分
      expect(stats.startTime).toBe(startTime);
      expect(stats.endTime).toBe(endTime);
    });
  });

  describe("handleApiError", () => {
    const testEntry: CharacterEntry = { id: "test", pageId: 1, wikiUrl: "" };

    it("レート制限エラーを正しく処理する", () => {
      const error = new Error("429 rate limit exceeded");
      const result = client.handleApiError(error, testEntry, 1);

      expect(result.shouldRetry).toBe(true);
      expect(result.errorType).toBe("RATE_LIMIT");
      expect(result.waitTime).toBeGreaterThan(0);
    });

    it("404エラーはリトライしない", () => {
      const error = new Error("404 not found");
      const result = client.handleApiError(error, testEntry, 1);

      expect(result.shouldRetry).toBe(false);
      expect(result.errorType).toBe("NOT_FOUND");
      expect(result.waitTime).toBe(0);
    });

    it("サーバーエラーはリトライする", () => {
      const error = new Error("500 internal server error");
      const result = client.handleApiError(error, testEntry, 1);

      expect(result.shouldRetry).toBe(true);
      expect(result.errorType).toBe("SERVER_ERROR");
      expect(result.waitTime).toBeGreaterThan(0);
    });
  });
});
