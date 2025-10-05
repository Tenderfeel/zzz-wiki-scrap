---
inclusion: always
---

# Data Mapping & Type Definitions

## Core Data Transformation Rules

### API Response → TypeScript Object Mapping

When processing HoyoLab API responses, extract data using these exact paths:

- **Character ID**: `data.page.id` (convert to number)
- **Names**: `data.page.name` (preserve as multilingual object)
- **Specialty**: `data.page.agent_specialties.values[0]` (map Japanese → English enum)
- **Element**: `data.page.agent_stats.values[0]` (map Japanese → English enum)
- **Attack Type**: `data.page.agent_attack_type.values[0]` (map Japanese → English enum)
- **Faction**: `data.page.agent_faction.values[0]` (reference faction ID)
- **Rarity**: `data.page.agent_rarity.values[0]` (use as-is: "A" or "S")

### Required Japanese → English Enum Mappings

**Specialty Mappings** (agent_specialties):

```
"撃破" → "stun"
"強攻" → "attack"
"異常" → "anomaly"
"支援" → "support"
"防護" → "defense"
"命破" → "rupture"
```

**Element Mappings** (agent_stats):

```
"氷属性" → "ice"
"炎属性" → "fire"
"電気属性" → "electric"
"物理属性" → "physical"
"エーテル属性" → "ether"
```

**Attack Type Mappings** (agent_attack_type):

```
"打撃" → "strike"
"斬撃" → "slash"
"刺突" → "pierce"
```

## Character Attributes Extraction

### Data Location & Processing

Extract attributes from: `data.page.modules` → find `ascension` component → parse `data` (JSON string)

### Attribute Processing Rules

**Level-Based Arrays** (7 levels: 1,10,20,30,40,50,60):

- `hp[]`, `atk[]`, `def[]` - extract from `combatList` → `values[1]` (enhanced values)

**Fixed Values** (level 1 only):

- `impact`, `critRate`, `critDmg`, `anomalyMastery`, `anomalyProficiency`, `penRatio`, `energy`

**Value Conversion Rules**:

- `"-"` → `0` (missing/null values)
- `"50%"` → `50` (remove percentage symbols)
- Always use `values[1]` from combatList (enhanced stats, not base)

## Required TypeScript Types

Use these exact type definitions when working with character data:

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
  hp: number[]; // 7-element array [lv1,10,20,30,40,50,60]
  atk: number[]; // 7-element array [lv1,10,20,30,40,50,60]
  def: number[]; // 7-element array [lv1,10,20,30,40,50,60]
  impact: number;
  critRate: number; // percentage as number (no % symbol)
  critDmg: number; // percentage as number (no % symbol)
  anomalyMastery: number;
  anomalyProficiency: number;
  penRatio: number; // percentage as number (no % symbol)
  energy: number;
};

type Faction = {
  id: number;
  name: { [key in Lang]: string };
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
```

## Output File Requirements

Generate these exact files with proper TypeScript exports:

- **`data/characters.ts`**: `export default Character[]` (array of all characters)
- **`data/factions.ts`**: `export default Faction[]` (array of all factions)

## Critical Processing Rules

**Language Priority**: Always request Japanese (`ja-jp`) first, fallback to English (`en-us`) if needed

**Data Validation**:

- Convert `"-"` strings to `0` for numeric fields
- Remove `%` symbols from percentage values
- Ensure all arrays have exactly 7 elements for level-based stats
- Validate all enum mappings exist before assignment

**Type Safety**: All generated data must strictly conform to the TypeScript types above

**Error Handling**: Log missing mappings but continue processing with fallback values
