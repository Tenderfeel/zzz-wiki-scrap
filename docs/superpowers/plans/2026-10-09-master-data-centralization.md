# Master Data Centralization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `json/master-data.json` を唯一の編集対象とし、Stats・Specialty・AssistType・Faction の型定義・マッピング辞書・表示データを自動生成に切り替える。

**Architecture:** 生成スクリプト `scripts/generate-master.ts` が `json/master-data.json` を読み込み、`src/types/master-types.ts`（union型）、`src/mappers/MasterMappings.ts`（マッピング辞書）、`data/stats.ts`・`data/specialties.ts`・`data/factions.ts`（表示データ）を出力する。既存の `DataMapper.ts` と `AttributeMapper.ts` はハードコード辞書を捨てて生成済み定数をインポートする形に差し替える。

**Tech Stack:** TypeScript, tsx, Vitest

**Spec:** `docs/superpowers/specs/2026-10-09-master-data-centralization-design.md`

## Global Constraints

- `tsx` でスクリプト実行（`ts-node` ではない）
- Vitest でテスト実行（`npm test`）
- 生成ファイルには先頭に `// このファイルは自動生成です。編集は json/master-data.json で行ってください。` コメントを必ず入れる
- 既存テストは全て通過し続けること
- `src/types/index.ts` の import パスを破壊しないこと（re-export で吸収する）

---

## File Map

| ファイル | 操作 | 責務 |
|---|---|---|
| `json/master-data.json` | 新規作成 | 唯一の手動編集対象 |
| `scripts/generate-master.ts` | 新規作成 | JSON → TS ファイル生成スクリプト |
| `tests/scripts/generate-master.test.ts` | 新規作成 | 生成ロジックのユニットテスト |
| `src/types/master-types.ts` | 新規作成（生成） | Stats / Specialty / AssistType union型 |
| `src/mappers/MasterMappings.ts` | 新規作成（生成） | マッピング辞書定数 |
| `data/stats.ts` | 上書き（生成） | 属性表示ラベル |
| `data/specialties.ts` | 上書き（生成） | 特性表示ラベル |
| `data/factions.ts` | 上書き（生成） | 陣営表示データ |
| `src/types/index.ts` | 修正 | Stats/Specialty/AssistType をmaster-typesからre-export |
| `src/mappers/DataMapper.ts` | 修正 | ハードコード辞書をMasterMappingsインポートに差し替え |
| `src/mappers/AttributeMapper.ts` | 修正 | ATTRIBUTE_MAPPINGをMasterMappingsインポートに差し替え |
| `package.json` | 修正 | `generate:master` スクリプト追加 |

---

### Task 1: `json/master-data.json` を作成する

**Files:**
- Create: `json/master-data.json`

**Interfaces:**
- Produces: `MasterData` 型に準拠したJSON（Task 2のgeneratorが消費する）

- [ ] **Step 1: ファイルを作成**

`json/master-data.json` を作成し、以下の内容を書く:

```json
{
  "stats": [
    { "id": "ether",     "label": { "ja": "エーテル", "en": "Ether" },      "aliases": ["エーテル属性", "ether", "Ether"] },
    { "id": "fire",      "label": { "ja": "炎",       "en": "Fire" },       "aliases": ["炎属性", "fire", "Fire"] },
    { "id": "ice",       "label": { "ja": "氷",       "en": "Ice" },        "aliases": ["氷属性", "ice", "Ice"] },
    { "id": "physical",  "label": { "ja": "物理",     "en": "Physical" },   "aliases": ["物理属性", "physical", "Physical"] },
    { "id": "electric",  "label": { "ja": "電気",     "en": "Electric" },   "aliases": ["電気属性", "electric", "Electric"] },
    { "id": "wind",      "label": { "ja": "風",       "en": "Wind" },       "aliases": ["風属性", "wind", "Wind"] },
    { "id": "frost",     "label": { "ja": "霜烈",     "en": "Frost" },      "aliases": ["霜烈属性", "frost", "Frost", "Frost Attribute"] },
    { "id": "auricInk",  "label": { "ja": "玄墨",     "en": "Auric Ink" },  "aliases": ["玄墨属性", "auricInk", "Auric Ink"] },
    { "id": "lumiflux",  "label": { "ja": "流明",     "en": "Lumiflux" },   "aliases": ["流明属性", "lumiflux", "Lumiflux"] },
    { "id": "honedEdge", "label": { "ja": "凛刃",     "en": "Honed Edge" }, "aliases": ["凛刃属性", "honedEdge", "Honed Edge"] }
  ],
  "specialties": [
    { "id": "attack",  "label": { "ja": "強攻", "en": "Attack" },  "aliases": ["強攻", "Attack"] },
    { "id": "stun",    "label": { "ja": "撃破", "en": "Stun" },    "aliases": ["撃破", "Stun"] },
    { "id": "anomaly", "label": { "ja": "異常", "en": "Anomaly" }, "aliases": ["異常", "Anomaly"] },
    { "id": "support", "label": { "ja": "支援", "en": "Support" }, "aliases": ["支援", "Support"] },
    { "id": "defense", "label": { "ja": "防護", "en": "Defense" }, "aliases": ["防護", "Defense"] },
    { "id": "rupture", "label": { "ja": "命破", "en": "Rupture" }, "aliases": ["命破", "Rupture"] },
    { "id": "armorer", "label": { "ja": "鋭御", "en": "Armorer" }, "aliases": ["鋭御", "Armorer"] }
  ],
  "factions": [
    { "id":  1, "name": { "ja": "邪兎屋",             "en": "Cunning Hares" } },
    { "id":  2, "name": { "ja": "ヴィクトリア家政",   "en": "Victoria Housekeeping Co." } },
    { "id":  3, "name": { "ja": "白祇重工",           "en": "Belobog Heavy Industries" } },
    { "id":  4, "name": { "ja": "防衛軍・オボルス小隊", "en": "Defense Force - Obol Squad" } },
    { "id":  5, "name": { "ja": "対ホロウ特別行動部第六課", "en": "Hollow Special Operations Section 6" } },
    { "id":  6, "name": { "ja": "治安局・特務捜査班", "en": "Criminal Investigation Special Response Team" } },
    { "id":  7, "name": { "ja": "カリュドーンの子",   "en": "Sons of Calydon" } },
    { "id":  8, "name": { "ja": "スターズ・オブ・リラ", "en": "Stars of Lyra" } },
    { "id":  9, "name": { "ja": "防衛軍・シルバー小隊", "en": "Defense Force - Silver Squad" } },
    { "id": 10, "name": { "ja": "モッキンバード",     "en": "Mockingbird" } },
    { "id": 11, "name": { "ja": "雲嶽山",             "en": "Yunkui Summit" } },
    { "id": 12, "name": { "ja": "怪啖屋",             "en": "Spook Shack" } },
    { "id": 13, "name": { "ja": "クランプスの黒枝",   "en": "Krampus Compliance Authority" } },
    { "id": 14, "name": { "ja": "妄想エンジェル",     "en": "Angels of Delusion" } },
    { "id": 15, "name": { "ja": "治安局・都市秩序部", "en": "Public Security: Metropolitan Order Division" } },
    { "id": 16, "name": { "ja": "パエトーン",         "en": "Phaethon" } },
    { "id": 17, "name": { "ja": "外務計策局",         "en": "External Strategy Department" } },
    { "id": 18, "name": { "ja": "ダアト結社",         "en": "Covenant of Dayat" } },
    { "id": 19, "name": { "ja": "空域巡警局",         "en": "Airspace Patrol Department" } },
    { "id": 20, "name": { "ja": "フリンツ工房",       "en": "Flint Workshop" } }
  ],
  "assistTypes": [
    { "id": "evasive",   "label": { "ja": "回避支援",   "en": "Evasive Assist" },   "aliases": ["回避支援", "Evasive Assist"] },
    { "id": "defensive", "label": { "ja": "パリィ支援", "en": "Defensive Assist" }, "aliases": ["パリィ支援", "Defensive Assist"] }
  ]
}
```

- [ ] **Step 2: JSONが正しいかチェック**

```bash
node -e "JSON.parse(require('fs').readFileSync('json/master-data.json','utf-8')); console.log('JSON valid')"
```

期待値: `JSON valid`

- [ ] **Step 3: コミット**

```bash
git add json/master-data.json
git commit -m "feat: add master-data.json as single source of truth for stats/specialties/factions/assistTypes"
```

---

### Task 2: `scripts/generate-master.ts` を作成してテストする

**Files:**
- Create: `scripts/generate-master.ts`
- Create: `tests/scripts/generate-master.test.ts`

**Interfaces:**
- Consumes: `json/master-data.json`（Task 1）
- Produces:
  - `export type MasterDataEntry`, `export type FactionEntry`, `export type MasterData`
  - `export function validate(data: MasterData): void`
  - `export function generateMasterTypes(data: MasterData): string`
  - `export function generateMasterMappings(data: MasterData): string`
  - `export function generateStatsData(data: MasterData): string`
  - `export function generateSpecialtiesData(data: MasterData): string`
  - `export function generateFactionsData(data: MasterData): string`

- [ ] **Step 1: テストファイルを作成**

`tests/scripts/generate-master.test.ts` を作成:

```typescript
import { describe, it, expect } from "vitest";
import {
  validate,
  generateMasterTypes,
  generateMasterMappings,
  generateStatsData,
  generateSpecialtiesData,
  generateFactionsData,
  type MasterData,
} from "../../scripts/generate-master";

const minimalData: MasterData = {
  stats: [
    { id: "ice", label: { ja: "氷", en: "Ice" }, aliases: ["氷属性", "ice", "Ice"] },
  ],
  specialties: [
    { id: "attack", label: { ja: "強攻", en: "Attack" }, aliases: ["強攻"] },
  ],
  factions: [
    { id: 1, name: { ja: "邪兎屋", en: "Cunning Hares" } },
  ],
  assistTypes: [
    { id: "evasive", label: { ja: "回避支援", en: "Evasive Assist" }, aliases: ["回避支援"] },
  ],
};

describe("validate", () => {
  it("有効なデータは例外を投げない", () => {
    expect(() => validate(minimalData)).not.toThrow();
  });

  it("stats内の重複IDでエラー", () => {
    const data: MasterData = {
      ...minimalData,
      stats: [
        { id: "ice", label: { ja: "氷", en: "Ice" }, aliases: ["氷属性"] },
        { id: "ice", label: { ja: "氷2", en: "Ice2" }, aliases: ["氷2属性"] },
      ],
    };
    expect(() => validate(data)).toThrow(/重複ID/);
  });

  it("stats内の重複エイリアスでエラー", () => {
    const data: MasterData = {
      ...minimalData,
      stats: [
        { id: "ice", label: { ja: "氷", en: "Ice" }, aliases: ["共通エイリアス"] },
        { id: "fire", label: { ja: "炎", en: "Fire" }, aliases: ["共通エイリアス"] },
      ],
    };
    expect(() => validate(data)).toThrow(/重複エイリアス/);
  });

  it("factions内の重複IDでエラー", () => {
    const data: MasterData = {
      ...minimalData,
      factions: [
        { id: 1, name: { ja: "陣営A", en: "Faction A" } },
        { id: 1, name: { ja: "陣営B", en: "Faction B" } },
      ],
    };
    expect(() => validate(data)).toThrow(/重複ID/);
  });

  it("specialties内の重複IDでエラー", () => {
    const data: MasterData = {
      ...minimalData,
      specialties: [
        { id: "attack", label: { ja: "強攻", en: "Attack" }, aliases: ["強攻"] },
        { id: "attack", label: { ja: "強攻2", en: "Attack2" }, aliases: ["強攻2"] },
      ],
    };
    expect(() => validate(data)).toThrow(/重複ID/);
  });

  it("assistTypes内の重複エイリアスでエラー", () => {
    const data: MasterData = {
      ...minimalData,
      assistTypes: [
        { id: "evasive", label: { ja: "回避支援", en: "Evasive" }, aliases: ["共通"] },
        { id: "defensive", label: { ja: "防御支援", en: "Defensive" }, aliases: ["共通"] },
      ],
    };
    expect(() => validate(data)).toThrow(/重複エイリアス/);
  });
});

describe("generateMasterTypes", () => {
  it("自動生成コメントを含む", () => {
    const result = generateMasterTypes(minimalData);
    expect(result).toContain("自動生成");
  });

  it("Stats union型を正しく生成する", () => {
    const result = generateMasterTypes(minimalData);
    expect(result).toContain('export type Stats = "ice";');
  });

  it("Specialty union型を正しく生成する", () => {
    const result = generateMasterTypes(minimalData);
    expect(result).toContain('export type Specialty = "attack";');
  });

  it("AssistType union型を正しく生成する", () => {
    const result = generateMasterTypes(minimalData);
    expect(result).toContain('export type AssistType = "evasive";');
  });

  it("複数IDはパイプ区切りで生成する", () => {
    const data: MasterData = {
      ...minimalData,
      stats: [
        { id: "ice", label: { ja: "氷", en: "Ice" }, aliases: ["ice"] },
        { id: "fire", label: { ja: "炎", en: "Fire" }, aliases: ["fire"] },
      ],
    };
    const result = generateMasterTypes(data);
    expect(result).toContain('"ice" | "fire"');
  });
});

describe("generateMasterMappings", () => {
  it("自動生成コメントを含む", () => {
    const result = generateMasterMappings(minimalData);
    expect(result).toContain("自動生成");
  });

  it("STATS_MAPPINGに全エイリアスを含む", () => {
    const result = generateMasterMappings(minimalData);
    expect(result).toContain('"氷属性": "ice"');
    expect(result).toContain('"ice": "ice"');
    expect(result).toContain('"Ice": "ice"');
  });

  it("SPECIALTY_MAPPINGにエイリアスを含む", () => {
    const result = generateMasterMappings(minimalData);
    expect(result).toContain('"強攻": "attack"');
  });

  it("ASSIST_TYPE_MAPPINGにエイリアスを含む", () => {
    const result = generateMasterMappings(minimalData);
    expect(result).toContain('"回避支援": "evasive"');
  });

  it("型インポートを含む", () => {
    const result = generateMasterMappings(minimalData);
    expect(result).toContain('import type { Stats, Specialty, AssistType }');
  });
});

describe("generateStatsData", () => {
  it("自動生成コメントを含む", () => {
    const result = generateStatsData(minimalData);
    expect(result).toContain("自動生成");
  });

  it("StatsDataとしてexportされる", () => {
    const result = generateStatsData(minimalData);
    expect(result).toContain("StatsData");
    expect(result).toContain("export default");
  });

  it("idとlabelを含む", () => {
    const result = generateStatsData(minimalData);
    expect(result).toContain('"ice"');
    expect(result).toContain('"氷"');
    expect(result).toContain('"Ice"');
  });
});

describe("generateSpecialtiesData", () => {
  it("SpecialtyDataとしてexportされる", () => {
    const result = generateSpecialtiesData(minimalData);
    expect(result).toContain("SpecialtyData");
    expect(result).toContain("export default");
  });

  it("idとlabelを含む", () => {
    const result = generateSpecialtiesData(minimalData);
    expect(result).toContain('"attack"');
    expect(result).toContain('"強攻"');
  });
});

describe("generateFactionsData", () => {
  it("Faction[]としてexportされる", () => {
    const result = generateFactionsData(minimalData);
    expect(result).toContain("Faction[]");
    expect(result).toContain("export default factions");
  });

  it("数値IDとname jaEnを含む", () => {
    const result = generateFactionsData(minimalData);
    expect(result).toContain("id: 1");
    expect(result).toContain('"邪兎屋"');
    expect(result).toContain('"Cunning Hares"');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx vitest --run tests/scripts/generate-master.test.ts
```

期待値: FAIL（`scripts/generate-master.ts` がまだ存在しない）

- [ ] **Step 3: `scripts/generate-master.ts` を実装**

```typescript
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

export type MasterDataEntry = {
  id: string;
  label: { ja: string; en: string };
  aliases: string[];
};

export type FactionEntry = {
  id: number;
  name: { ja: string; en: string };
};

export type MasterData = {
  stats: MasterDataEntry[];
  specialties: MasterDataEntry[];
  factions: FactionEntry[];
  assistTypes: MasterDataEntry[];
};

export function validate(data: MasterData): void {
  for (const category of ["stats", "specialties", "assistTypes"] as const) {
    const entries = data[category] as MasterDataEntry[];
    const ids = entries.map((e) => e.id);
    const dupId = ids.find((id, i) => ids.indexOf(id) !== i);
    if (dupId) {
      throw new Error(`${category} に重複IDがあります: "${dupId}"`);
    }
    const seen = new Set<string>();
    for (const entry of entries) {
      for (const alias of entry.aliases) {
        if (seen.has(alias)) {
          throw new Error(
            `${category} に重複エイリアスがあります: "${alias}"`
          );
        }
        seen.add(alias);
      }
    }
  }
  const factionIds = data.factions.map((f) => f.id);
  const dupFactionId = factionIds.find((id, i) => factionIds.indexOf(id) !== i);
  if (dupFactionId) {
    throw new Error(`factions に重複IDがあります: "${dupFactionId}"`);
  }
}

export function generateMasterTypes(data: MasterData): string {
  const statsType = data.stats.map((e) => `"${e.id}"`).join(" | ");
  const specialtyType = data.specialties.map((e) => `"${e.id}"`).join(" | ");
  const assistTypeType = data.assistTypes.map((e) => `"${e.id}"`).join(" | ");
  return [
    "// このファイルは自動生成です。編集は json/master-data.json で行ってください。",
    "",
    `export type Stats = ${statsType};`,
    "",
    `export type Specialty = ${specialtyType};`,
    "",
    `export type AssistType = ${assistTypeType};`,
    "",
  ].join("\n");
}

export function generateMasterMappings(data: MasterData): string {
  const toEntries = (entries: MasterDataEntry[]): string =>
    entries
      .flatMap((e) =>
        e.aliases.map((alias) => `  ${JSON.stringify(alias)}: ${JSON.stringify(e.id)}`)
      )
      .join(",\n");

  return [
    "// このファイルは自動生成です。編集は json/master-data.json で行ってください。",
    `import type { Stats, Specialty, AssistType } from "../types";`,
    "",
    `export const STATS_MAPPING: Record<string, Stats> = {`,
    toEntries(data.stats),
    `};`,
    "",
    `export const SPECIALTY_MAPPING: Record<string, Specialty> = {`,
    toEntries(data.specialties),
    `};`,
    "",
    `export const ASSIST_TYPE_MAPPING: Record<string, AssistType> = {`,
    toEntries(data.assistTypes),
    `};`,
    "",
  ].join("\n");
}

export function generateStatsData(data: MasterData): string {
  const entries = data.stats
    .map(
      (e) =>
        `  { id: ${JSON.stringify(e.id)}, label: { ja: ${JSON.stringify(e.label.ja)}, en: ${JSON.stringify(e.label.en)} } }`
    )
    .join(",\n");
  return [
    "// このファイルは自動生成です。編集は json/master-data.json で行ってください。",
    `import { StatsData } from "../src/types";`,
    "",
    `export default [`,
    entries,
    `] as StatsData[];`,
    "",
  ].join("\n");
}

export function generateSpecialtiesData(data: MasterData): string {
  const entries = data.specialties
    .map(
      (e) =>
        `  { id: ${JSON.stringify(e.id)}, label: { ja: ${JSON.stringify(e.label.ja)}, en: ${JSON.stringify(e.label.en)} } }`
    )
    .join(",\n");
  return [
    "// このファイルは自動生成です。編集は json/master-data.json で行ってください。",
    `import { SpecialtyData } from "../src/types";`,
    "",
    `export default [`,
    entries,
    `] as SpecialtyData[];`,
    "",
  ].join("\n");
}

export function generateFactionsData(data: MasterData): string {
  const entries = data.factions
    .map(
      (e) =>
        `  { id: ${e.id}, name: { ja: ${JSON.stringify(e.name.ja)}, en: ${JSON.stringify(e.name.en)} } }`
    )
    .join(",\n");
  return [
    "// このファイルは自動生成です。編集は json/master-data.json で行ってください。",
    `import type { Faction } from "../src/types";`,
    "",
    `const factions: Faction[] = [`,
    entries,
    `];`,
    "",
    `export default factions;`,
    "",
  ].join("\n");
}

// エントリーポイント（直接実行時のみ）
if (process.argv[1] === __filename) {
  const masterDataPath = join(ROOT, "json", "master-data.json");
  const raw = readFileSync(masterDataPath, "utf-8");
  const data: MasterData = JSON.parse(raw);

  validate(data);

  writeFileSync(join(ROOT, "src", "types", "master-types.ts"), generateMasterTypes(data));
  writeFileSync(join(ROOT, "src", "mappers", "MasterMappings.ts"), generateMasterMappings(data));
  writeFileSync(join(ROOT, "data", "stats.ts"), generateStatsData(data));
  writeFileSync(join(ROOT, "data", "specialties.ts"), generateSpecialtiesData(data));
  writeFileSync(join(ROOT, "data", "factions.ts"), generateFactionsData(data));

  console.log("✅ Master data generation complete:");
  console.log("  src/types/master-types.ts");
  console.log("  src/mappers/MasterMappings.ts");
  console.log("  data/stats.ts");
  console.log("  data/specialties.ts");
  console.log("  data/factions.ts");
}
```

- [ ] **Step 4: テストを実行してパスを確認**

```bash
npx vitest --run tests/scripts/generate-master.test.ts
```

期待値: 全テスト PASS

- [ ] **Step 5: `package.json` に `generate:master` を追加**

`package.json` の `scripts` に以下を追加（既存スクリプトの末尾）:

```json
"generate:master": "tsx scripts/generate-master.ts"
```

- [ ] **Step 6: 生成スクリプトを実行してファイルを生成**

```bash
npm run generate:master
```

期待値:
```
✅ Master data generation complete:
  src/types/master-types.ts
  src/mappers/MasterMappings.ts
  data/stats.ts
  data/specialties.ts
  data/factions.ts
```

- [ ] **Step 7: 生成されたファイルの内容を確認**

以下のコマンドで各ファイルの先頭数行を確認する:

```bash
head -5 src/types/master-types.ts
head -5 src/mappers/MasterMappings.ts
head -5 data/stats.ts
```

期待値（`master-types.ts`の例）:
```
// このファイルは自動生成です。編集は json/master-data.json で行ってください。

export type Stats = "ether" | "fire" | "ice" | "physical" | "electric" | "wind" | "frost" | "auricInk" | "lumiflux" | "honedEdge";

export type Specialty = "attack" | "stun" | "anomaly" | "support" | "defense" | "rupture" | "armorer";
```

- [ ] **Step 8: コミット**

```bash
git add scripts/generate-master.ts tests/scripts/generate-master.test.ts \
        src/types/master-types.ts src/mappers/MasterMappings.ts \
        data/stats.ts data/specialties.ts data/factions.ts \
        package.json
git commit -m "feat: add generate-master script and generate initial master type/mapping files"
```

---

### Task 3: `src/types/index.ts` を更新して生成型をre-exportする

**Files:**
- Modify: `src/types/index.ts`

**Interfaces:**
- Consumes: `src/types/master-types.ts`（Task 2 で生成済み）
- Produces: `Stats`, `Specialty`, `AssistType` を `master-types.ts` 経由でre-exportする（外部からの import パスは不変）

- [ ] **Step 1: 現在のテストが通ることを確認**

```bash
npm test
```

期待値: 全テスト PASS（ベースラインの確認）

- [ ] **Step 2: `src/types/index.ts` を編集**

ファイル先頭に以下を追加し、既存の `Stats`・`Specialty`・`AssistType` のunion型定義を削除する。

**追加（ファイル最上部に挿入）:**

```typescript
export type { Stats, Specialty, AssistType } from "./master-types";
```

**削除するブロック（この3つのunion型定義を丸ごと削除）:**

```typescript
// 特性
export type Specialty =
  | "attack" // 強攻
  | "stun" // 撃破
  | "anomaly" // 異常
  | "support" // 支援
  | "defense" // 防護
  | "rupture" // 命破
  | "armorer"; // 鋭御
```

```typescript
// 属性
export type Stats =
  | "ether" // エーテル
  | "fire" // 炎
  | "ice" // 氷
  | "physical" // 物理
  | "electric" // 電気
  | "frost" // 霜烈
  | "auricInk" // 玄墨
  | "lumiflux" // 流明
  | "wind" // 風
  | "honedEdge"; // 凛刃
```

（注: `AssistType` はこのファイルに定義されていないが、`master-types.ts` からのre-exportで追加される）

- [ ] **Step 3: テストを実行してすべてパスすることを確認**

```bash
npm test
```

期待値: 全テスト PASS（re-exportなので外部からの型参照に変化なし）

- [ ] **Step 4: コミット**

```bash
git add src/types/index.ts
git commit -m "refactor(types): re-export Stats/Specialty/AssistType from generated master-types"
```

---

### Task 4: `DataMapper.ts` のハードコード辞書を `MasterMappings` に差し替える

**Files:**
- Modify: `src/mappers/DataMapper.ts`

**Interfaces:**
- Consumes: `src/mappers/MasterMappings.ts`（Task 2 で生成済み）の `STATS_MAPPING`, `SPECIALTY_MAPPING`, `ASSIST_TYPE_MAPPING`

- [ ] **Step 1: テストが通ることを確認（差し替え前のベースライン）**

```bash
npx vitest --run tests/mappers/DataMapper.test.ts
```

期待値: PASS

- [ ] **Step 2: `DataMapper.ts` を編集**

**インポートを追加（ファイル先頭付近の既存 import の後）:**

```typescript
import { STATS_MAPPING, SPECIALTY_MAPPING, ASSIST_TYPE_MAPPING } from "./MasterMappings";
```

**削除する static readonly ブロック（3つ全て削除）:**

```typescript
// 特性マッピング
private static readonly SPECIALTY_MAPPING: Record<string, Specialty> = {
  撃破: "stun",
  強攻: "attack",
  異常: "anomaly",
  支援: "support",
  防護: "defense",
  命破: "rupture",
  鋭御: "armorer",
  // 英語特性名（APIから直接返される場合）
  Armorer: "armorer",
};
```

```typescript
// 属性マッピング
private static readonly STATS_MAPPING: Record<string, Stats> = {
  // 日本語属性名
  氷属性: "ice",
  炎属性: "fire",
  電気属性: "electric",
  物理属性: "physical",
  エーテル属性: "ether",
  霜烈属性: "frost",
  玄墨属性: "auricInk",
  凛刃属性: "honedEdge",
  流明属性: "lumiflux",
  風属性: "wind",
  // 英語属性名（APIから直接返される場合）
  ice: "ice",
  fire: "fire",
  electric: "electric",
  physical: "physical",
  ether: "ether",
  frost: "frost",
  auricInk: "auricInk",
  honedEdge: "honedEdge",
  lumiflux: "lumiflux",
  wind: "wind",
  // 英語属性名（大文字）
  Ice: "ice",
  Fire: "fire",
  Electric: "electric",
  Physical: "physical",
  Ether: "ether",
  Frost: "frost",
  "Auric Ink": "auricInk",
  "Frost Attribute": "frost",
  "Honed Edge": "honedEdge",
  Lumiflux: "lumiflux",
  Wind: "wind",
};
```

```typescript
// 支援タイプマッピング
private static readonly ASSIST_TYPE_MAPPING: Record<string, AssistType> = {
  回避支援: "evasive",
  パリィ支援: "defensive",
  "Evasive Assist": "evasive",
  "Defensive Assist": "defensive",
};
```

**各メソッド内の参照を差し替える（`DataMapper.XXX_MAPPING` → インポートした定数）:**

`mapSpecialty` メソッド内:
```typescript
// 変更前
const mapped = DataMapper.SPECIALTY_MAPPING[rawSpecialty];
// 変更後
const mapped = SPECIALTY_MAPPING[rawSpecialty];
```

`mapStats` メソッド内:
```typescript
// 変更前
const mapped = DataMapper.STATS_MAPPING[rawStats];
// 変更後
const mapped = STATS_MAPPING[rawStats];
```

`mapAssistType` メソッド内:
```typescript
// 変更前
const mapped = DataMapper.ASSIST_TYPE_MAPPING[trimmedValue];
// 変更後
const mapped = ASSIST_TYPE_MAPPING[trimmedValue];
```

`getAvailableMappings` static メソッド内:
```typescript
// 変更前
return {
  specialty: Object.keys(DataMapper.SPECIALTY_MAPPING),
  stats: Object.keys(DataMapper.STATS_MAPPING),
  rarity: Object.keys(DataMapper.RARITY_MAPPING),
  assistType: Object.keys(DataMapper.ASSIST_TYPE_MAPPING),
};
// 変更後
return {
  specialty: Object.keys(SPECIALTY_MAPPING),
  stats: Object.keys(STATS_MAPPING),
  rarity: Object.keys(DataMapper.RARITY_MAPPING),
  assistType: Object.keys(ASSIST_TYPE_MAPPING),
};
```

（注: `RARITY_MAPPING` は `master-data.json` の対象外なので `DataMapper.RARITY_MAPPING` のままにする）

- [ ] **Step 3: `Stats`・`Specialty`・`AssistType` の import が不要になっていれば削除**

`DataMapper.ts` の既存 import 行:
```typescript
import { Specialty, Stats, Rarity, Lang, AssistType } from "../types/index";
```
`Rarity` と `Lang` は引き続き使うが、`Specialty`・`Stats`・`AssistType` は `MasterMappings.ts` がすでに型付けているので削除可能。ただしTypeScriptコンパイルが通るかどうか確認してから判断すること。

- [ ] **Step 4: テストを実行してすべてパスすることを確認**

```bash
npx vitest --run tests/mappers/DataMapper.test.ts
```

期待値: PASS

- [ ] **Step 5: 全テストを実行**

```bash
npm test
```

期待値: PASS

- [ ] **Step 6: コミット**

```bash
git add src/mappers/DataMapper.ts
git commit -m "refactor(DataMapper): replace hardcoded mapping dicts with MasterMappings imports"
```

---

### Task 5: `AttributeMapper.ts` のハードコード辞書を `MasterMappings` に差し替える

**Files:**
- Modify: `src/mappers/AttributeMapper.ts`

**Interfaces:**
- Consumes: `STATS_MAPPING` from `src/mappers/MasterMappings.ts`（Task 2 で生成済み）

- [ ] **Step 1: テストが通ることを確認（差し替え前のベースライン）**

```bash
npx vitest --run tests/mappers/AttributeMapper.test.ts
```

期待値: PASS

- [ ] **Step 2: `AttributeMapper.ts` を編集**

**インポートを追加（ファイル先頭の既存 import の後）:**

```typescript
import { STATS_MAPPING } from "./MasterMappings";
```

**削除する static readonly ブロック:**

```typescript
private static readonly ATTRIBUTE_MAPPING: Record<string, Stats> = {
  炎属性: "fire",
  氷属性: "ice",
  電気属性: "electric",
  物理属性: "physical",
  エーテル属性: "ether",
  霜烈属性: "frost",
  玄墨属性: "auricInk",
  凛刃属性: "honedEdge",
  流明属性: "lumiflux",
  風属性: "wind",
};
```

**`mapToEnglish` メソッド内の参照を差し替え:**

```typescript
// 変更前
const result = this.ATTRIBUTE_MAPPING[trimmedAttribute] || null;
// 変更後
const result = STATS_MAPPING[trimmedAttribute] ?? null;
```

**`isValidAttribute` メソッド内の参照を差し替え:**

```typescript
// 変更前
return Object.values(this.ATTRIBUTE_MAPPING).includes(attribute as Stats);
// 変更後
return Object.values(STATS_MAPPING).includes(attribute as Stats);
```

**`getAttributeMapping` メソッド内の参照を差し替え:**

```typescript
// 変更前
return { ...this.ATTRIBUTE_MAPPING };
// 変更後
return { ...STATS_MAPPING };
```

**`getSupportedJapaneseAttributes` メソッド内の参照を差し替え:**

```typescript
// 変更前
return Object.keys(this.ATTRIBUTE_MAPPING);
// 変更後
return Object.keys(STATS_MAPPING);
```

**`getSupportedEnglishAttributes` メソッド内の参照を差し替え:**

```typescript
// 変更前
return Object.values(this.ATTRIBUTE_MAPPING);
// 変更後
return [...new Set(Object.values(STATS_MAPPING))];
```

（注: `STATS_MAPPING` は英語エイリアスも含むので重複排除が必要）

- [ ] **Step 3: テストを実行してすべてパスすることを確認**

```bash
npx vitest --run tests/mappers/AttributeMapper.test.ts
```

期待値: PASS

- [ ] **Step 4: 全テストを実行**

```bash
npm test
```

期待値: PASS

- [ ] **Step 5: コミット**

```bash
git add src/mappers/AttributeMapper.ts
git commit -m "refactor(AttributeMapper): replace ATTRIBUTE_MAPPING with STATS_MAPPING from MasterMappings"
```

---

### Task 6: 動作確認と `generate:master` の最終確認

- [ ] **Step 1: 全テストを実行**

```bash
npm test
```

期待値: 全テスト PASS

- [ ] **Step 2: 生成スクリプトを再実行してべき等性を確認**

```bash
npm run generate:master
```

期待値: エラーなし。ファイル内容が変わらないこと（再実行しても同じ出力）。

- [ ] **Step 3: 新ゲームデータ追加の動作確認**

`json/master-data.json` に仮の新属性を追加してスクリプトが正しく動くか確認する:

```bash
# master-data.json の stats 配列に以下を一時追加（後で削除する）:
# { "id": "test_element", "label": { "ja": "テスト", "en": "Test" }, "aliases": ["テスト属性"] }

npm run generate:master
grep "test_element" src/types/master-types.ts  # union型に含まれているか
grep "テスト属性" src/mappers/MasterMappings.ts  # マッピングに含まれているか
grep "テスト" data/stats.ts  # 表示データに含まれているか
```

期待値: 各ファイルに `test_element` / `テスト属性` / `テスト` が含まれている

- [ ] **Step 4: 一時追加した仮データを削除してスクリプトを再実行**

```bash
# master-data.json から test_element エントリを削除
npm run generate:master
npm test
```

期待値: 元に戻り全テストがPASS

- [ ] **Step 5: 最終コミット**

```bash
git add -A
git commit -m "chore: verify master data centralization e2e workflow"
```
