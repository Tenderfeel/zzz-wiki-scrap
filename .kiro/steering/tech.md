---
inclusion: always
---

# Technical Standards & Development Guidelines

## Project Context

TypeScript-based data scraping system for Zenless Zone Zero (ZZZ) character information from HoyoLab API. Focus on type safety, error resilience, and maintainable architecture.

## Technology Stack

- **Runtime**: Node.js with TypeScript
- **Testing**: Vitest (use `--run` flag, never watch mode)
- **Build**: TypeScript Compiler (`tsc`)
- **Package Manager**: npm

## API Integration Requirements

### HoyoLab API Constraints

- **Base URL**: `https://sg-wiki-api-static.hoyolab.com/hoyowiki/zzz/wapi/entry_page`
- **No Authentication**: Public API, no keys required
- **Rate Limiting**: MANDATORY delays between requests to avoid blocking
- **Parameters**: `entry_page_id` (2-902), `lang` (`ja-jp`/`en-us`)

### Request Pattern (CRITICAL)

1. **Always request `ja-jp` first** - Primary data source
2. **Fallback to `en-us`** - Only if Japanese fails
3. **Continue on partial failures** - Don't abort entire process
4. **Implement delays** - Prevent API rate limiting

## Code Standards

### Naming Conventions (STRICT)

- **Files**: `PascalCase.ts` (e.g., `CharacterGenerator.ts`)
- **Classes**: `PascalCase` (e.g., `DataProcessor`)
- **Functions**: `camelCase` (e.g., `processCharacterData`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `API_BASE_URL`)
- **Character IDs**: lowercase with preserved symbols (e.g., `lycaon`, `soldier11`)

### Language Usage Rules

- **Code/Variables**: English only
- **Comments**: Japanese preferred for domain context
- **API Requests**: `ja-jp` primary, `en-us` fallback

## Data Processing Pipeline (MANDATORY)

1. **API Request** - Japanese → English fallback pattern
2. **JSON Parsing** - Handle nested JSON strings in responses
3. **Value Mapping** - Japanese text → English enums (see mappings)
4. **Data Conversion** - `"-"` → `0`, `"50%"` → `50`
5. **Type Validation** - Strict TypeScript compliance

## Error Handling Standards

- **Use custom error classes** from `src/errors/`
- **Log all processing steps** for debugging
- **Graceful degradation** - continue despite partial failures
- **Validate inputs** - provide sensible defaults

## Type Safety Requirements (NON-NEGOTIABLE)

- **Strict TypeScript mode** - no loose configurations
- **No `any` types** - explicit typing required
- **Interface compliance** - all data must match defined types
- **Runtime validation** - verify data structure at boundaries

## Configuration Management

- **External config file**: `processing-config.json` for all parameters
- **Environment support**: Different configs for different environments
- **Validation required**: Check config values, provide defaults
