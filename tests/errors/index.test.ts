import { describe, it, expect } from "vitest";
import {
  ApiError,
  ParsingError,
  MappingError,
  ValidationError,
  LycanDataGeneratorError,
} from "../../src/errors";

describe("Error Classes", () => {
  describe("ApiError", () => {
    it("メッセージのみで作成できる", () => {
      const error = new ApiError("API request failed");

      expect(error.message).toBe("API: API request failed");
      expect(error.name).toBe("LycanDataGeneratorError");
      expect(error.type).toBe("API");
      expect(error.details).toBe("API request failed");
      expect(error.originalError).toBeUndefined();
      expect(error instanceof Error).toBe(true);
      expect(error instanceof ApiError).toBe(true);
      expect(error instanceof LycanDataGeneratorError).toBe(true);
    });

    it("メッセージと元のエラーで作成できる", () => {
      const originalError = new Error("Network error");
      const error = new ApiError("API request failed", originalError);

      expect(error.message).toBe("API: API request failed");
      expect(error.details).toBe("API request failed");
      expect(error.originalError).toBe(originalError);
    });
  });

  describe("ParsingError", () => {
    it("メッセージのみで作成できる", () => {
      const error = new ParsingError("JSON parsing failed");

      expect(error.message).toBe("PARSING: JSON parsing failed");
      expect(error.name).toBe("LycanDataGeneratorError");
      expect(error.type).toBe("PARSING");
      expect(error.details).toBe("JSON parsing failed");
      expect(error.originalError).toBeUndefined();
      expect(error instanceof Error).toBe(true);
      expect(error instanceof ParsingError).toBe(true);
      expect(error instanceof LycanDataGeneratorError).toBe(true);
    });

    it("メッセージと元のエラーで作成できる", () => {
      const originalError = new SyntaxError("Unexpected token");
      const error = new ParsingError("JSON parsing failed", originalError);

      expect(error.message).toBe("PARSING: JSON parsing failed");
      expect(error.details).toBe("JSON parsing failed");
      expect(error.originalError).toBe(originalError);
    });
  });

  describe("MappingError", () => {
    it("メッセージのみで作成できる", () => {
      const error = new MappingError("Unknown value mapping");

      expect(error.message).toBe("MAPPING: Unknown value mapping");
      expect(error.name).toBe("LycanDataGeneratorError");
      expect(error.type).toBe("MAPPING");
      expect(error.details).toBe("Unknown value mapping");
      expect(error.originalError).toBeUndefined();
      expect(error instanceof Error).toBe(true);
      expect(error instanceof MappingError).toBe(true);
      expect(error instanceof LycanDataGeneratorError).toBe(true);
    });

    it("メッセージと元のエラーで作成できる", () => {
      const originalError = new Error("Mapping failed");
      const error = new MappingError("Unknown value mapping", originalError);

      expect(error.message).toBe("MAPPING: Unknown value mapping");
      expect(error.details).toBe("Unknown value mapping");
      expect(error.originalError).toBe(originalError);
    });
  });

  describe("ValidationError", () => {
    it("メッセージのみで作成できる", () => {
      const error = new ValidationError("Validation failed");

      expect(error.message).toBe("VALIDATION: Validation failed");
      expect(error.name).toBe("LycanDataGeneratorError");
      expect(error.type).toBe("VALIDATION");
      expect(error.details).toBe("Validation failed");
      expect(error.originalError).toBeUndefined();
      expect(error instanceof Error).toBe(true);
      expect(error instanceof ValidationError).toBe(true);
      expect(error instanceof LycanDataGeneratorError).toBe(true);
    });

    it("メッセージと元のエラーで作成できる", () => {
      const originalError = new Error("Invalid data");
      const error = new ValidationError("Validation failed", originalError);

      expect(error.message).toBe("VALIDATION: Validation failed");
      expect(error.details).toBe("Validation failed");
      expect(error.originalError).toBe(originalError);
    });
  });

  describe("Error inheritance", () => {
    it("すべてのカスタムエラーがErrorを継承している", () => {
      const apiError = new ApiError("test");
      const parsingError = new ParsingError("test");
      const mappingError = new MappingError("test");
      const validationError = new ValidationError("test");

      expect(apiError instanceof Error).toBe(true);
      expect(parsingError instanceof Error).toBe(true);
      expect(mappingError instanceof Error).toBe(true);
      expect(validationError instanceof Error).toBe(true);
    });

    it("各エラーが正しい名前とタイプを持っている", () => {
      const apiError = new ApiError("test");
      const parsingError = new ParsingError("test");
      const mappingError = new MappingError("test");
      const validationError = new ValidationError("test");

      expect(apiError.name).toBe("LycanDataGeneratorError");
      expect(parsingError.name).toBe("LycanDataGeneratorError");
      expect(mappingError.name).toBe("LycanDataGeneratorError");
      expect(validationError.name).toBe("LycanDataGeneratorError");

      expect(apiError.type).toBe("API");
      expect(parsingError.type).toBe("PARSING");
      expect(mappingError.type).toBe("MAPPING");
      expect(validationError.type).toBe("VALIDATION");
    });
  });
});
