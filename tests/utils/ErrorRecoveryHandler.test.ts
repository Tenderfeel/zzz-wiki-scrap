import { describe, it, expect, vi, beforeEach } from "vitest";
import { ErrorRecoveryHandler } from "../../src/utils/ErrorRecoveryHandler";
import { PartialDataHandler } from "../../src/utils/PartialDataHandler";
import { ApiResponse } from "../../src/types/api";

describe("ErrorRecoveryHandler", () => {
  let errorRecoveryHandler: ErrorRecoveryHandler;
  let mockPartialDataHandler: PartialDataHandler;

  beforeEach(() => {
    mockPartialDataHandler = new PartialDataHandler();
    errorRecoveryHandler = new ErrorRecoveryHandler(mockPartialDataHandler);
  });

  describe("classifyErrorAndDetermineStrategy", () => {
    it("should classify network errors correctly", () => {
      const networkError = new Error("Network timeout occurred");
      const strategy = errorRecoveryHandler.classifyErrorAndDetermineStrategy(
        networkError,
        "test-character"
      );

      expect(strategy.errorType).toBe("network");
      expect(strategy.severity).toBe("moderate");
      expect(strategy.recoveryStrategy).toBe("retry_with_backoff");
      expect(strategy.shouldRetry).toBe(true);
      expect(strategy.shouldContinue).toBe(true);
    });

    it("should classify API not found errors correctly", () => {
      const notFoundError = new Error("404 Not Found");
      const strategy = errorRecoveryHandler.classifyErrorAndDetermineStrategy(
        notFoundError,
        "test-character"
      );

      expect(strategy.errorType).toBe("api_not_found");
      expect(strategy.severity).toBe("low");
      expect(strategy.recoveryStrategy).toBe("skip_character");
      expect(strategy.shouldRetry).toBe(false);
      expect(strategy.shouldContinue).toBe(true);
    });

    it("should classify data structure errors correctly", () => {
      const dataError = new Error("JSON parsing failed");
      const strategy = errorRecoveryHandler.classifyErrorAndDetermineStrategy(
        dataError,
        "test-character"
      );

      expect(strategy.errorType).toBe("data_structure");
      expect(strategy.severity).toBe("moderate");
      expect(strategy.recoveryStrategy).toBe("partial_data_processing");
      expect(strategy.shouldRetry).toBe(false);
      expect(strategy.shouldContinue).toBe(true);
    });

    it("should classify system errors correctly", () => {
      const systemError = new Error("Fatal system error");
      const strategy = errorRecoveryHandler.classifyErrorAndDetermineStrategy(
        systemError,
        "test-character"
      );

      expect(strategy.errorType).toBe("system");
      expect(strategy.severity).toBe("critical");
      expect(strategy.recoveryStrategy).toBe("abort_processing");
      expect(strategy.shouldRetry).toBe(false);
      expect(strategy.shouldContinue).toBe(false);
    });

    it("should classify unknown errors with default strategy", () => {
      const unknownError = new Error("Some unknown error");
      const strategy = errorRecoveryHandler.classifyErrorAndDetermineStrategy(
        unknownError,
        "test-character"
      );

      expect(strategy.errorType).toBe("unknown");
      expect(strategy.severity).toBe("moderate");
      expect(strategy.recoveryStrategy).toBe("retry_once_then_skip");
      expect(strategy.shouldRetry).toBe(true);
      expect(strategy.shouldContinue).toBe(true);
    });
  });

  describe("handleIndividualCharacterFailure", () => {
    it("should handle individual character failure and continue processing", () => {
      const error = new Error("Character processing failed");
      const processingContext = {
        totalCharacters: 10,
        processedCount: 5,
        successCount: 4,
        failureCount: 1,
      };

      // Should not throw for acceptable failure rate
      expect(() => {
        errorRecoveryHandler.handleIndividualCharacterFailure(
          "test-character",
          error,
          processingContext
        );
      }).not.toThrow();
    });

    it("should abort processing when failure rate is too high", () => {
      const error = new Error("Character processing failed");
      const processingContext = {
        totalCharacters: 10,
        processedCount: 4,
        successCount: 1,
        failureCount: 3, // 75% failure rate
      };

      // Should throw for high failure rate
      expect(() => {
        errorRecoveryHandler.handleIndividualCharacterFailure(
          "test-character",
          error,
          processingContext
        );
      }).toThrow("処理失敗率が許容範囲を超えました");
    });
  });

  describe("retryApiRequest", () => {
    it("should succeed on first attempt", async () => {
      const mockApiCall = vi.fn().mockResolvedValue("success");

      const result = await errorRecoveryHandler.retryApiRequest(
        mockApiCall,
        "test-character",
        "test-operation"
      );

      expect(result).toBe("success");
      expect(mockApiCall).toHaveBeenCalledTimes(1);
    });

    it("should retry on failure and eventually succeed", async () => {
      const mockApiCall = vi
        .fn()
        .mockRejectedValueOnce(new Error("First failure"))
        .mockResolvedValue("success");

      const result = await errorRecoveryHandler.retryApiRequest(
        mockApiCall,
        "test-character",
        "test-operation"
      );

      expect(result).toBe("success");
      expect(mockApiCall).toHaveBeenCalledTimes(2);
    });

    it("should return null after max retries", async () => {
      const mockApiCall = vi
        .fn()
        .mockRejectedValue(new Error("Persistent failure"));

      const result = await errorRecoveryHandler.retryApiRequest(
        mockApiCall,
        "test-character",
        "test-operation"
      );

      expect(result).toBeNull();
      expect(mockApiCall).toHaveBeenCalledTimes(3); // max retry attempts
    });
  });

  describe("handlePartialProcessingFailure", () => {
    it("should handle partial processing failure with valid data", async () => {
      const mockApiData: ApiResponse = {
        data: {
          page: {
            id: "test-character",
            name: "Test Character",
            modules: [],
          },
        },
      };

      const originalError = new Error("Original processing failed");

      // Mock the partial data handler methods
      vi.spyOn(mockPartialDataHandler, "detectMissingFields").mockReturnValue([
        "specialty",
      ]);
      vi.spyOn(mockPartialDataHandler, "handlePartialData").mockReturnValue({
        basicInfo: {
          id: "test-character",
          name: "Test Character",
          specialty: "",
          stats: "",
          rarity: "",
          releaseVersion: 2.4,
        },
        factionInfo: { id: 0, name: "不明" },
        attributesInfo: { ascensionData: JSON.stringify({ list: [] }) },
        assistType: undefined,
      });
      vi.spyOn(mockPartialDataHandler, "validatePartialData").mockReturnValue(
        true
      );

      const result = await errorRecoveryHandler.handlePartialProcessingFailure(
        mockApiData,
        originalError,
        "test-character"
      );

      expect(result).not.toBeNull();
      expect(result?.basicInfo?.id).toBe("test-character");
    });

    it("should return null when processing is impossible", async () => {
      const mockApiData: ApiResponse = {
        data: {
          page: {
            id: "test-character",
            name: "Test Character",
            modules: [],
          },
        },
      };

      const originalError = new Error("Original processing failed");

      // Mock impossible processing scenario
      vi.spyOn(mockPartialDataHandler, "detectMissingFields").mockReturnValue([
        "page",
        "filter_values",
      ]);

      const result = await errorRecoveryHandler.handlePartialProcessingFailure(
        mockApiData,
        originalError,
        "test-character"
      );

      expect(result).toBeNull();
    });
  });
});
