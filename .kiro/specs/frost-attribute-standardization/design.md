# Design Document

## Overview

This design outlines the systematic change from `frostAttribute` to `frost` in the ZZZ character data processing system. The change affects the Stats type definition and all related mappings, validations, and data processing logic. The goal is to standardize the naming convention to match other attributes like `ice`, `fire`, `electric`, etc.

## Architecture

The change impacts multiple layers of the application:

1. **Type Definitions** (`src/types/index.ts`) - Core Stats type
2. **Data Mapping** (`src/mappers/DataMapper.ts`, `src/processors/EnhancedDataProcessor.ts`) - Japanese to English mapping
3. **Generators** (`src/generators/`) - Output file generation and validation
4. **Tests** (`tests/`) - Type compatibility and integration tests
5. **Data Files** (`data/characters.ts`) - Existing character data
6. **Documentation** (`docs/API.md`, `Scraping.md`) - API documentation

## Components and Interfaces

### Core Type System Changes

**Stats Type Definition**

```typescript
// Before
export type Stats =
  | "ether"
  | "fire"
  | "ice"
  | "physical"
  | "electric"
  | "frostAttribute" // 霜烈
  | "auricInk";

// After
export type Stats =
  | "ether"
  | "fire"
  | "ice"
  | "physical"
  | "electric"
  | "frost" // 霜烈
  | "auricInk";
```

### Data Mapping Updates

**Japanese to English Mapping**

- `霜烈属性` → `frost` (instead of `frostAttribute`)
- `霜烈` → `frost` (instead of `frostAttribute`)

**Affected Mapping Files:**

- `src/mappers/DataMapper.ts` - Primary mapping logic
- `src/processors/EnhancedDataProcessor.ts` - Enhanced processing with fallback mappings
- `scripts/generate-characters.js` - Legacy generation script

### Validation Logic Updates

**Stats Validation Arrays**
All validation arrays that include `frostAttribute` need to be updated to use `frost`:

- Generator validation in `src/generators/`
- Test validation in `tests/`
- Integration test validation

## Data Models

### Character Data Structure

The Character type remains unchanged structurally, but the Stats union type values change:

```typescript
type Character = {
  id: string;
  name: { [key in Lang]: string };
  fullName: { [key in Lang]: string };
  specialty: Specialty;
  stats: Stats; // This field's possible values change
  assistType?: AssistType;
  faction: number;
  rarity: Rarity;
  attr: Attributes;
  releaseVersion?: number;
};
```

### Existing Data Migration

Current character data in `data/characters.ts` contains one character with `frostAttribute`:

- Hoshimi Miyabi (星見雅) currently has `stats: "frostAttribute"`
- This needs to be updated to `stats: "frost"`

## Error Handling

### Type Safety Preservation

- TypeScript compiler will catch any missed references to `frostAttribute`
- Runtime validation will ensure only valid Stats values are accepted
- Tests will verify the mapping continues to work correctly

### Backward Compatibility Considerations

- This is a breaking change for any external consumers of the types
- All internal references must be updated simultaneously
- No gradual migration path is possible due to type system constraints

### Validation Strategy

1. **Compile-time validation**: TypeScript will enforce the new type constraints
2. **Runtime validation**: Existing validation logic will accept `frost` instead of `frostAttribute`
3. **Test validation**: All tests will be updated to expect the new naming

## Testing Strategy

### Unit Tests

- **DataMapper tests**: Update expected mapping results from `frostAttribute` to `frost`
- **Generator tests**: Update validation test cases to use `frost`
- **Type compatibility tests**: Update Stats type validation arrays

### Integration Tests

- **Character data integrity**: Update valid Stats values list
- **All characters generation**: Update Stats validation in integration tests
- **Bomp generation**: Update Stats validation for bomp processing

### Test Data Updates

- Update mock data and test fixtures that reference `frostAttribute`
- Ensure all test scenarios continue to pass with the new naming

## Implementation Approach

### Phase 1: Core Type Definition

1. Update `Stats` type in `src/types/index.ts`
2. Update Japanese mapping in `src/mappers/DataMapper.ts`
3. Update enhanced processor mapping in `src/processors/EnhancedDataProcessor.ts`

### Phase 2: Validation and Generation Logic

1. Update validation arrays in all generator files
2. Update validation logic in processor files
3. Update legacy generation script

### Phase 3: Data and Tests

1. Update existing character data in `data/characters.ts`
2. Update all test files with new expected values
3. Update test validation arrays

### Phase 4: Documentation

1. Update API documentation in `docs/API.md`
2. Update type documentation in `Scraping.md`
3. Update any other documentation references

## Risk Mitigation

### Comprehensive Search and Replace

- Use systematic search to find all occurrences of `frostAttribute`
- Verify each replacement is contextually appropriate
- Run full test suite after each phase

### Type System Validation

- Leverage TypeScript's strict type checking to catch missed references
- Ensure all validation arrays are updated consistently
- Verify runtime behavior matches compile-time expectations
