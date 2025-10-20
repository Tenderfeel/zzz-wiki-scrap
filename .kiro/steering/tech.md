---
inclusion: always
---

# ZZZ Character Data Processing Guidelines

## Project Overview

TypeScript-based data scraping system for Zenless Zone Zero (ZZZ) character information from HoyoLab API. Emphasizes type safety, error resilience, and maintainable architecture.

**Communication**: Use Japanese for chat and documentation when working with domain-specific content.

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Testing**: Vitest with `--run` flag (watch mode prohibited)
- **Build**: TypeScript Compiler (`tsc`)
- **Package Manager**: npm

## Architecture (Strict Adherence Required)

Follow layered data flow strictly:

```
src/
├── clients/     # API communication (HoyoLab only)
├── parsers/     # JSON parsing & structuring
├── mappers/     # API response → internal type conversion
├── processors/  # Data transformation & business logic
├── generators/  # TypeScript file output
├── services/    # Orchestration layer
└── utils/       # Shared utilities
```

**Data Flow**: Client → Parser → Mapper → Processor → Generator

**Rules**:

- Never skip layers in the data flow
- Each layer has single responsibility
- Use dependency injection between layers

## HoyoLab API Specification (Critical)

### API Constraints

- **Base URL**: `https://sg-wiki-api-static.hoyolab.com/hoyowiki/zzz/wapi/entry_page`
- **Authentication**: None required (public API)
- **Rate Limiting**: Mandatory delays between requests
- **Parameters**: `entry_page_id` (2-902), `lang` (`ja-jp`/`en-us`)

### Request Pattern (Critical)

1. **Request `ja-jp` first** - Primary data source
2. **Fallback to `en-us`** - Only on Japanese failure
3. **Continue on partial failures** - Don't abort entire process
4. **Implement delays** - Avoid API rate limits

### Data Extraction Paths (Exact)

```typescript
// API response extraction paths
data.page.id → Character ID (convert to number)
data.page.name → Multi-language name object
data.page.agent_specialties.values[0] → Specialty (requires mapping)
data.page.agent_stats.values[0] → Attribute (requires mapping)
data.page.agent_attack_type.values[0] → Attack type (requires mapping)
data.page.agent_faction.values[0] → Faction reference
data.page.agent_rarity.values[0] → Rarity ("A" or "S")
```

## Japanese → English Mappings (Required)

**Critical**: These mappings are exact and must not be modified.

```typescript
// Specialties (agent_specialties)
"撃破" → "stun"
"強攻" → "attack"
"異常" → "anomaly"
"支援" → "support"
"防護" → "defense"
"命破" → "rupture"

// Attributes (agent_stats)
"氷属性" → "ice"
"炎属性" → "fire"
"電気属性" → "electric"
"物理属性" → "physical"
"エーテル属性" → "ether"

// Attack Types (agent_attack_type)
"打撃" → "strike"
"斬撃" → "slash"
"刺突" → "pierce"
```

## Character Attributes Processing

**Location**: `data.page.modules` → `ascension` component → parse `data` (JSON string)

### Level Arrays (7 Elements Required)

Levels: 1, 10, 20, 30, 40, 50, 60

- Extract `hp[]`, `atk[]`, `def[]` from `combatList`
- **Always use `values[1]`** (enhanced stats, not base)

### Single Values (Level 1 Only)

`impact`, `critRate`, `critDmg`, `anomalyMastery`, `anomalyProficiency`, `penRatio`, `energy`

### Value Conversion (Required)

- `"-"` → `0` (null/missing value handling)
- `"50%"` → `50` (remove percentage symbol)
- Proper string to number conversion

## TypeScript 型定義（厳格遵守）

```typescript
type Lang = "en" | "ja";
type Specialty =
  | "attack"
  | "stun"
  | "anomaly"
  | "support"
  | "defense"
  | "rupture";
type Stats = "ether" | "fire" | "ice" | "physical" | "electric";
type AttackType = "slash" | "pierce" | "strike";
type Rarity = "A" | "S";

type Attributes = {
  hp: number[]; // 7要素配列
  atk: number[]; // 7要素配列
  def: number[]; // 7要素配列
  impact: number;
  critRate: number;
  critDmg: number;
  anomalyMastery: number;
  anomalyProficiency: number;
  penRatio: number;
  energy: number;
};

type Character = {
  id: number;
  name: { [key in Lang]: string };
  fullName: { [key in Lang]: string };
  specialty: Specialty;
  stats: Stats;
  attackType: AttackType;
  faction: Faction;
  rarity: Rarity;
  attr: Attributes;
};

type Faction = {
  id: number;
  name: { [key in Lang]: string };
};
```

## Output Requirements (Exact Files)

**Required Generated Files**:

- `data/characters.ts` → `export default Character[]`
- `data/factions.ts` → `export default Faction[]`

## Coding Conventions

### Naming Rules (Strict)

- **Files**: `PascalCase.ts` (e.g., `CharacterGenerator.ts`)
- **Classes**: `PascalCase` (e.g., `DataProcessor`)
- **Functions**: `camelCase` (e.g., `processCharacterData`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `API_BASE_URL`)
- **Character IDs**: lowercase, preserve symbols (e.g., `lycaon`, `soldier11`)

### Language Usage Rules

- **Code/Variables**: English only
- **Comments**: Japanese preferred for domain context
- **API Requests**: `ja-jp` priority, `en-us` fallback

## Error Handling

- **Custom Error Classes**: Use `src/errors/` directory
- **Detailed Logging**: Log all processing steps
- **Graceful Degradation**: Continue on partial failures
- **Input Validation**: Provide appropriate defaults

## Type Safety (Non-Negotiable)

- **Strict TypeScript Mode**: No loose configurations
- **No `any` Types**: Explicit typing required
- **Interface Compliance**: All data must conform to defined types
- **Runtime Validation**: Validate data structures at boundaries

## Configuration Management

- **External Config Files**: Use `processing-config.json`
- **Environment Support**: Different configs for different environments
- **Validation Required**: Check config values, provide defaults

## Development Guidelines

### Testing

- Use Vitest with `--run` flag only (no watch mode)
- Place tests in `tests/` directory matching source structure
- Focus on integration tests for data processing pipelines

### File Organization

- Follow the layered architecture strictly
- Use index files for clean exports
- Keep related functionality grouped by layer
