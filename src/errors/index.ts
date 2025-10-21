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

export class NameMappingError extends Error {
  public cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = "NameMappingError";
    this.cause = cause;
  }
}

// ボンプアイコンダウンロード専用エラークラス
export class BompIconError extends Error {
  constructor(
    public type: "DOWNLOAD" | "VALIDATION" | "FILESYSTEM" | "SECURITY",
    public bompId: string,
    public details: string,
    public originalError?: Error
  ) {
    super(`${type} (${bompId}): ${details}`);
    this.name = "BompIconError";
  }
}

export class BompIconDownloadError extends BompIconError {
  constructor(bompId: string, details: string, originalError?: Error) {
    super("DOWNLOAD", bompId, details, originalError);
  }
}

export class BompIconValidationError extends BompIconError {
  constructor(bompId: string, details: string, originalError?: Error) {
    super("VALIDATION", bompId, details, originalError);
  }
}

export class BompIconFileSystemError extends BompIconError {
  constructor(bompId: string, details: string, originalError?: Error) {
    super("FILESYSTEM", bompId, details, originalError);
  }
}

export class BompIconSecurityError extends BompIconError {
  constructor(bompId: string, details: string, originalError?: Error) {
    super("SECURITY", bompId, details, originalError);
  }
}

export class BompIconBatchError extends Error {
  constructor(
    public failedBomps: string[],
    public totalBomps: number,
    public details: string,
    public originalError?: Error
  ) {
    super(
      `ボンプアイコンバッチ処理エラー: ${failedBomps.length}/${totalBomps} 個が失敗 - ${details}`
    );
    this.name = "BompIconBatchError";
  }
}

// 武器アイコンダウンロード専用エラークラス
export class WeaponIconError extends Error {
  constructor(
    public type: "DOWNLOAD" | "VALIDATION" | "FILESYSTEM" | "SECURITY",
    public weaponId: string,
    public details: string,
    public originalError?: Error
  ) {
    super(`${type} (${weaponId}): ${details}`);
    this.name = "WeaponIconError";
  }
}

export class WeaponIconDownloadError extends WeaponIconError {
  constructor(weaponId: string, details: string, originalError?: Error) {
    super("DOWNLOAD", weaponId, details, originalError);
  }
}

export class WeaponIconValidationError extends WeaponIconError {
  constructor(weaponId: string, details: string, originalError?: Error) {
    super("VALIDATION", weaponId, details, originalError);
  }
}

export class WeaponIconFileSystemError extends WeaponIconError {
  constructor(weaponId: string, details: string, originalError?: Error) {
    super("FILESYSTEM", weaponId, details, originalError);
  }
}

export class WeaponIconSecurityError extends WeaponIconError {
  constructor(weaponId: string, details: string, originalError?: Error) {
    super("SECURITY", weaponId, details, originalError);
  }
}

export class WeaponIconBatchError extends Error {
  constructor(
    public failedWeapons: string[],
    public totalWeapons: number,
    public details: string,
    public originalError?: Error
  ) {
    super(
      `武器アイコンバッチ処理エラー: ${failedWeapons.length}/${totalWeapons} 個が失敗 - ${details}`
    );
    this.name = "WeaponIconBatchError";
  }
}
