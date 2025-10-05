---
inclusion: always
---

# Technical Standards & Development Guidelines

## Project Overview

TypeScript-based data scraping system for Zenless Zone Zero (ZZZ) character information from HoyoLab API.

## Technology Stack

- **Language**: TypeScript (Node.js runtime)
- **Testing**: Vitest framework
- **Build**: TypeScript Compiler (tsc)
- **Package Manager**: npm

## API Integration Rules

### HoyoLab API Specifications

- **Base URL**: `https://sg-wiki-api-static.hoyolab.com/hoyowiki/zzz/wapi/entry_page`
- **Authentication**: None required
- **Rate Limiting**: MUST implement delays between requests
- **Required Parameters**:
  - `entry_page_id`: Character page ID (range: 2-902)
  - `lang`: Language code (`ja-jp` or `en-us`)

### Request Pattern Requirements

1. **Primary Request**: Always use `ja-jp` (Japanese) first
2. **Fallback Request**: Use `en-us` (English) if Japanese fails
3. **Error Handling**: Continue processing on partial failures
4. **Rate Limiting**: Implement appropriate delays between API calls

## Code Style & Conventions

### Naming Standards

- **Files**: `PascalCase.ts` (e.g., `CharacterGenerator.ts`)
- **Classes**: `PascalCase` (e.g., `DataProcessor`)
- **Functions**: `camelCase` (e.g., `processCharacterData`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `API_BASE_URL`)
- **Character IDs**: lowercase (e.g., `lycaon`, `soldier11`)

### Language Usage

- **Code Comments**: Japanese preferred
- **Documentation**: Japanese
- **Variable/Function Names**: English only
- **API Language Codes**: `ja-jp` (primary), `en-us` (fallback)

## Data Processing Requirements

### Mandatory Processing Pipeline

1. **API Request**: Japanese → English fallback
2. **JSON Parsing**: Handle nested JSON strings within responses
3. **Value Mapping**: Japanese text → English enum values
4. **Data Conversion**: `"-"` → `0`, `"50%"` → `50`
5. **Type Validation**: Ensure TypeScript type compliance

### Error Handling Standards

- **Custom Errors**: Use classes from `src/errors/`
- **Logging**: Detailed process status and error information
- **Graceful Degradation**: Continue processing despite partial failures
- **Validation**: Check required fields, provide default values

## Quality Assurance

### Type Safety Requirements

- **Strict TypeScript**: All code must use strict type definitions
- **No `any` Types**: Avoid implicit or explicit `any` usage
- **Interface Compliance**: All data must conform to defined interfaces

### Testing Standards

- **Unit Tests**: Test individual functions and classes
- **Integration Tests**: Test complete data processing workflows
- **Performance Tests**: Validate processing speed and memory usage
- **Coverage**: Maintain comprehensive test coverage

### Configuration Management

- **External Config**: Use `processing-config.json` for parameters
- **Environment Support**: Support different configuration environments
- **Validation**: Validate configuration values with defaults
