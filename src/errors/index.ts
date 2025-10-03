// エラークラス定義

export class LycanDataGeneratorError extends Error {
  constructor(
    public type: "API" | "PARSING" | "MAPPING" | "VALIDATION",
    public details: string,
    public originalError?: Error
  ) {
    super(`${type}: ${details}`);
    this.name = "LycanDataGeneratorError";
  }
}

export class ApiError extends LycanDataGeneratorError {
  constructor(details: string, originalError?: Error) {
    super("API", details, originalError);
  }
}

export class ParsingError extends LycanDataGeneratorError {
  constructor(details: string, originalError?: Error) {
    super("PARSING", details, originalError);
  }
}

export class MappingError extends LycanDataGeneratorError {
  constructor(details: string, originalError?: Error) {
    super("MAPPING", details, originalError);
  }
}

export class ValidationError extends LycanDataGeneratorError {
  constructor(details: string, originalError?: Error) {
    super("VALIDATION", details, originalError);
  }
}
