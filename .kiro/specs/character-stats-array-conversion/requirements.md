# Requirements Document

## Introduction

キャラクターデータの属性（stats）フィールドを単一の文字列値から文字列配列に変更する機能です。現在のキャラクターデータでは各キャラクターが 1 つの属性のみを持っていますが、将来的に複数の属性を持つキャラクターに対応するため、データ構造を配列形式に変更します。

## Requirements

### Requirement 1

**User Story:** As a developer, I want to modify the character stats field from a single string to an array of strings, so that characters can support multiple attributes in the future.

#### Acceptance Criteria

1. WHEN the Character type is updated THEN the stats field SHALL be changed from `Stats` to `Stats[]`
2. WHEN existing character data is migrated THEN each character's single stats value SHALL be converted to an array containing that single value
3. WHEN the type definitions are updated THEN all related interfaces and types SHALL maintain compatibility with the new array structure

### Requirement 2

**User Story:** As a developer, I want all existing character data to be automatically migrated to the new array format with proper attribute mapping, so that characters with special attributes get the correct multiple values.

#### Acceptance Criteria

1. WHEN the migration is performed THEN all existing characters SHALL have their stats converted from string to string array
2. WHEN a character has stats value "electric" THEN it SHALL become ["electric"] in the new format
3. WHEN a character has stats value "frost" THEN it SHALL become ["ice", "frost"] in the new format
4. WHEN a character has stats value "auricInk" THEN it SHALL become ["ether", "auricInk"] in the new format
5. WHEN a character has any other stats value THEN it SHALL become an array containing that single value

### Requirement 3

**User Story:** As a developer, I want the type system to be updated consistently across all files, so that TypeScript compilation continues to work without errors.

#### Acceptance Criteria

1. WHEN the Character type is updated THEN the Stats type SHALL remain unchanged as the array element type
2. WHEN type definitions are modified THEN all imports and exports SHALL continue to work correctly
3. WHEN the changes are applied THEN there SHALL be no TypeScript compilation errors

### Requirement 4

**User Story:** As a developer, I want any code that processes character stats to be updated for array handling, so that the application continues to function correctly.

#### Acceptance Criteria

1. WHEN code accesses character stats THEN it SHALL handle the new array format appropriately
2. WHEN filtering or mapping operations use stats THEN they SHALL work with the array structure
3. WHEN the migration is complete THEN all existing functionality SHALL continue to work as expected
