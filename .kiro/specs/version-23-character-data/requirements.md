# Requirements Document

## Introduction

バージョン 2.3 で追加される 3 体の新キャラクター（lucia, manato, yidhari）のデータを既存の ZZZ キャラクターデータ処理システムに統合する機能です。新キャラクターの API 情報を取得し、既存のデータ構造に適合させて、TypeScript ファイルとして出力します。yidhari については基本情報以外のデータ（突破、スキルなど）が欠損している既知の問題があります。

## Requirements

### Requirement 1

**User Story:** As a developer, I want to add version 2.3 character data to the existing system, so that the latest characters are available in the data exports.

#### Acceptance Criteria

1. WHEN the system processes version 2.3 character data THEN it SHALL retrieve character information from HoyoLab API using the established entry_page_id range
2. WHEN new character IDs are encountered THEN the system SHALL validate and process them according to existing data structure requirements
3. WHEN character data is processed THEN it SHALL follow the ja-jp primary, en-us fallback language pattern
4. WHEN character attributes are extracted THEN they SHALL conform to the 7-element array format for hp, atk, def and single values for other stats

### Requirement 2

**User Story:** As a developer, I want version 2.3 characters to use the same data mapping and validation rules, so that data consistency is maintained across all character versions.

#### Acceptance Criteria

1. WHEN specialty data is processed THEN it SHALL map Japanese terms to English equivalents using the established mapping rules
2. WHEN attribute data is processed THEN it SHALL map Japanese attribute names to English using the established mapping rules
3. WHEN attack type data is processed THEN it SHALL map Japanese attack types to English using the established mapping rules
4. WHEN character rarity is processed THEN it SHALL validate as either "A" or "S" rank

### Requirement 3

**User Story:** As a developer, I want version 2.3 character data to be integrated into existing output files, so that all characters are available in a single consolidated export.

#### Acceptance Criteria

1. WHEN version 2.3 characters are processed THEN they SHALL be added to the existing characters.ts export file
2. WHEN new factions are encountered THEN they SHALL be added to the existing factions.ts export file
3. WHEN data generation is complete THEN the output SHALL maintain the existing TypeScript export format
4. WHEN duplicate character IDs are detected THEN the system SHALL handle conflicts appropriately

### Requirement 4

**User Story:** As a developer, I want the version 2.3 character processing to follow existing error handling patterns, so that the system remains robust and maintainable.

#### Acceptance Criteria

1. WHEN API requests fail for individual characters THEN the system SHALL continue processing other characters
2. WHEN data mapping fails for specific fields THEN the system SHALL apply appropriate default values
3. WHEN network errors occur THEN the system SHALL implement proper retry logic with delays
4. WHEN processing completes THEN the system SHALL provide detailed logging of success and failure cases

### Requirement 5

**User Story:** As a developer, I want to process the specific version 2.3 characters (lucia, manato, yidhari), so that these new characters are available in the system.

#### Acceptance Criteria

1. WHEN lucia character data is processed THEN it SHALL use entry_page_id 907 and extract all required character information
2. WHEN manato character data is processed THEN it SHALL use entry_page_id 908 and extract all required character information
3. WHEN yidhari character data is processed THEN it SHALL use entry_page_id 909 and handle the known data deficiency gracefully
4. WHEN yidhari data extraction fails for non-status fields THEN the system SHALL provide appropriate default values or skip the character with proper logging

### Requirement 6

**User Story:** As a developer, I want the system to handle data deficiencies in yidhari gracefully, so that processing can continue for other characters even when some data is missing.

#### Acceptance Criteria

1. WHEN yidhari character processing encounters missing specialty data THEN it SHALL log the issue and apply a default value or skip the character
2. WHEN yidhari character processing encounters missing attack type data THEN it SHALL log the issue and apply a default value or skip the character
3. WHEN yidhari character processing encounters missing faction data THEN it SHALL log the issue and apply a default value or skip the character
4. WHEN yidhari status data is available THEN it SHALL be processed normally according to existing attribute extraction rules
