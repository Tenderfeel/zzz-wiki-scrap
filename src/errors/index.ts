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

// バッチ処理用エラークラス
export enum ProcessingStage {
  PARSING = "PARSING",
  API_FETCH = "API_FETCH",
  DATA_PROCESSING = "DATA_PROCESSING",
  VALIDATION = "VALIDATION",
  FILE_OUTPUT = "FILE_OUTPUT",
  BATCH_PROCESSING = "BATCH_PROCESSING",
}

export class AllCharactersError extends Error {
  constructor(
    public stage: ProcessingStage,
    public characterId: string | null,
    public details: string,
    public originalError?: Error
  ) {
    super(`${stage}${characterId ? ` (${characterId})` : ""}: ${details}`);
    this.name = "AllCharactersError";
  }
}

export class BatchProcessingError extends Error {
  constructor(
    public failedCharacters: string[],
    public totalCharacters: number,
    public details: string,
    public originalError?: Error
  ) {
    super(
      `バッチ処理エラー: ${failedCharacters.length}/${totalCharacters} キャラクターが失敗 - ${details}`
    );
    this.name = "BatchProcessingError";
  }
}

export class RateLimitError extends ApiError {
  constructor(
    public retryAfter: number,
    details: string = "レート制限に達しました",
    originalError?: Error
  ) {
    super(`${details} (${retryAfter}秒後にリトライ)`, originalError);
    this.name = "RateLimitError";
  }
}
