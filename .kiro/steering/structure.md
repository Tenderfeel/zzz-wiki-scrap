---
inclusion: always
---

# Architecture & Code Structure Guidelines

## Layered Architecture (STRICT)

Follow this exact layer hierarchy. **Never bypass layers** - data must flow through each step:

```
src/
├── clients/     # API communication (HoyoLab requests only)
├── parsers/     # JSON parsing and initial structuring
├── mappers/     # API response → internal type conversion
├── processors/  # Data transformation and business logic
├── generators/  # TypeScript file output generation
├── services/    # Orchestration and coordination
└── utils/       # Shared utilities and helpers
```

**Data Flow Rule**: Client → Parser → Mapper → Processor → Generator

## Required File Structure

### Output Files (MANDATORY)

These exact files must be generated:

- `data/characters.ts` → `export default Character[]`
- `data/factions.ts` → `export default Faction[]`

### Intermediate Files (for debugging)

- `json/data/list.json` → processed character list
- `json/filters/` → language-specific configurations

## Processing Pipeline (ENFORCE ORDER)

1. **Client Layer** - Fetch from HoyoLab API (`ja-jp` → `en-us` fallback)
2. **Parser Layer** - Parse JSON, handle nested JSON strings
3. **Mapper Layer** - Apply Japanese → English mappings
4. **Processor Layer** - Transform values (`"-"` → `0`, `"50%"` → `50`)
5. **Generator Layer** - Output TypeScript files with proper exports

## Layer Responsibilities

### Clients (`src/clients/`)

- API communication only
- Handle request/response cycles
- Implement rate limiting and retries

### Parsers (`src/parsers/`)

- JSON parsing and validation
- Handle nested JSON strings in API responses
- Initial data structure creation

### Mappers (`src/mappers/`)

- Japanese → English value conversion
- Apply predefined mappings
- Type conversion (string → enum)

### Processors (`src/processors/`)

- Data transformation logic
- Value normalization (`"-"` → `0`)
- Business rule application

### Generators (`src/generators/`)

- TypeScript file generation
- Export statement creation
- File system operations

## Error Handling Strategy

- **Layer-specific errors** - Use custom error classes from `src/errors/`
- **Graceful degradation** - Continue processing on partial failures
- **Detailed logging** - Log at each layer boundary
- **Validation gates** - Validate data between layers

## Configuration Management

- **Single source**: `processing-config.json`
- **Layer-agnostic**: All layers read from same config
- **Validation required**: Check config at startup
