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

const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

export function validate(data: MasterData): void {
  for (const category of ["stats", "specialties", "assistTypes"] as const) {
    const entries = data[category] as MasterDataEntry[];
    if (!entries?.length) {
      throw new Error(`${category} が空です`);
    }
    for (const entry of entries) {
      if (!ID_PATTERN.test(entry.id)) {
        throw new Error(`${category} に不正なIDがあります: ${JSON.stringify(entry.id)}`);
      }
      if (!entry.label?.ja || !entry.label?.en) {
        throw new Error(`${category} の "${entry.id}" の label が空です`);
      }
      if (!entry.aliases?.length) {
        throw new Error(`${category} の "${entry.id}" の aliases が空です`);
      }
    }
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
  if (!data.factions?.length) {
    throw new Error("factions が空です");
  }
  for (const faction of data.factions) {
    if (!faction.name?.ja || !faction.name?.en) {
      throw new Error(`factions の ${faction.id} の name が空です`);
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
