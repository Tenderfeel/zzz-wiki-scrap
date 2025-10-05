---
inclusion: always
---

# ZZZ Character Data Processing Rules

## API Data Extraction (EXACT PATHS)

Extract from HoyoLab API responses using these precise JSON paths:

- `data.page.id` → Character ID (convert to number)
- `data.page.name` → Multilingual names object
- `data.page.agent_specialties.values[0]` → Specialty (requires mapping)
- `data.page.agent_stats.values[0]` → Element (requires mapping)
- `data.page.agent_attack_type.values[0]` → Attack type (requires mapping)
- `data.page.agent_faction.values[0]` → Faction reference
- `data.page.agent_rarity.values[0]` → Rarity ("A" or "S")

## Japanese → English Mappings (CRITICAL)

**These mappings are MANDATORY** - apply exactly when processing Japanese API responses:

```typescript
// Specialties (agent_specialties)
"撃破" → "stun"
"強攻" → "attack"
"異常" → "anomaly"
"支援" → "support"
"防護" → "defense"
"命破" → "rupture"

// Elements (agent_stats)
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

**Location**: `data.page.modules` → find `ascension` component → parse `data` (JSON string)

### Level Arrays (MUST be 7 elements)

Levels: 1, 10, 20, 30, 40, 50, 60

- Extract `hp[]`, `atk[]`, `def[]` from `combatList`
- **Always use `values[1]`** (enhanced stats, not base stats)

### Single Values (level 1 only)

- `impact`, `critRate`, `critDmg`, `anomalyMastery`, `anomalyProficiency`, `penRatio`, `energy`

### Value Transformations (MANDATORY)

- `"-"` → `0` (handle null/missing values)
- `"50%"` → `50` (strip percentage symbols)
- Ensure all numbers are properly converted from strings

## TypeScript Types (STRICT COMPLIANCE)

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
  hp: number[]; // 7-element array
  atk: number[]; // 7-element array
  def: number[]; // 7-element array
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
  name: { [key in Lang]: string }; // Scraping.md 短縮名リスト (name-mappings.json)を参照
  fullName: { [key in Lang]: string }; // Wikiを参照
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

## Output Requirements (EXACT FILES)

**MUST generate exactly these files**:

- `data/characters.ts` → `export default Character[]`
- `data/factions.ts` → `export default Faction[]`

## Validation Rules

- **Language Priority**: Always request `ja-jp` first, fallback to `en-us`
- **Array Validation**: Ensure hp/atk/def arrays have exactly 7 elements
- **Type Compliance**: All data must match TypeScript types above
- **Missing Data**: Log missing mappings, continue with fallbacks
- **Number Conversion**: Verify string → number conversions are correct
