# Implementation Plan

- [x] 1. Update type definitions for stats array support

  - Modify Character type in src/types/index.ts to change stats field from Stats to Stats[]
  - Modify Bomp type in src/types/index.ts to change stats field from Stats to Stats[]
  - Update related interface types in src/types/processing.ts and src/types/api.ts
  - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2_

- [x] 2. Create stats array mapping utility

  - Create utility function to convert single stats values to appropriate arrays
  - Implement special mapping for frost → ["ice", "frost"] and auricInk → ["ether", "auricInk"]
  - Add mapping for all other stats values to single-element arrays
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. Update data mappers for array handling

  - Modify DataMapper.ts to return Stats[] instead of Stats from mapStats method
  - Update BompDataMapper.ts to handle stats as array in extractBasicInfo method
  - Update EnhancedDataProcessor.ts mapStats method to return Stats[]
  - _Requirements: 1.1, 1.2, 3.3_

- [x] 4. Update data generators for array output

  - Modify CharacterGenerator.ts to output stats as array format in generated TypeScript
  - Update AllCharactersGenerator.ts to handle stats array in character data generation
  - Update BompGenerator.ts to output stats as array format for bomp data
  - _Requirements: 1.1, 1.2, 4.3_

- [x] 5. Migrate existing character data

  - Update data/characters.ts to convert all existing stats values to arrays
  - Apply special mapping for miyabi (frost → ["ice", "frost"]) and yixuan (auricInk → ["ether", "auricInk"])
  - Convert all other character stats to single-element arrays
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 6. Update validation logic for array stats

  - Modify validation functions in EnhancedDataProcessor.ts to check Stats[] instead of Stats
  - Update error messages to handle array validation
  - Ensure validation accepts non-empty arrays with valid Stats values
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 7. Update unit tests for stats array changes

  - Modify tests in tests/types/ to test new Stats[] type definitions
  - Update tests in tests/mappers/ to verify array mapping functionality
  - Update tests in tests/generators/ to verify array output generation
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 8. Update integration tests for array compatibility
  - Modify integration tests to use stats arrays in mock data
  - Update test expectations to check for array format in generated output
  - Verify end-to-end functionality with new array format
  - _Requirements: 4.1, 4.2, 4.3_
