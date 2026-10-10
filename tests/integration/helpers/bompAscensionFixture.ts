/**
 * Bomp integration test fixture helpers.
 *
 * Builds ascension component data in the real HoYoLAB API shape
 * (`{ list: [{ key, combatList: [{ key, values }] }] }`) that
 * AttributesProcessor.processAscensionData requires (levels 1..60, with
 * HP / 攻撃力 / 防御力 per level and fixed stats on level 1).
 */

import * as fs from "fs";
import * as path from "path";
import factions from "../../../data/factions";

const LEVELS = ["1", "10", "20", "30", "40", "50", "60"] as const;

export interface BompAscensionOptions {
  baseHp?: number;
  baseAtk?: number;
  baseDef?: number;
  /** Explicit per-level values (index 0..6 => levels 1..60). Override base*. */
  hp?: string[];
  atk?: string[];
  def?: string[];
  impact?: string;
  critRate?: string;
  critDmg?: string;
  anomalyMastery?: string;
  anomalyProficiency?: string;
  penRatio?: string;
  energy?: string;
}

export function createBompAscensionList(options: BompAscensionOptions = {}) {
  const {
    baseHp = 1000,
    baseAtk = 100,
    baseDef = 50,
    impact = "10",
    critRate = "5%",
    critDmg = "50%",
    anomalyMastery = "0",
    anomalyProficiency = "0",
    penRatio = "0%",
    energy = "1.2",
  } = options;

  return LEVELS.map((level, i) => {
    const hp = options.hp?.[i] ?? String(baseHp + i * 200);
    const atk = options.atk?.[i] ?? String(baseAtk + i * 20);
    const def = options.def?.[i] ?? String(baseDef + i * 10);
    const combatList: { key: string; values: string[] }[] = [
      { key: "HP", values: [hp, hp] },
      { key: "攻撃力", values: [atk, atk] },
      { key: "防御力", values: [def, def] },
    ];
    if (level === "1") {
      combatList.push(
        { key: "衝撃力", values: [impact, impact] },
        { key: "会心率", values: [critRate, critRate] },
        { key: "会心ダメージ", values: [critDmg, critDmg] },
        { key: "異常マスタリー", values: [anomalyMastery, anomalyMastery] },
        {
          key: "異常掌握",
          values: [anomalyProficiency, anomalyProficiency],
        },
        { key: "貫通率", values: [penRatio, penRatio] },
        { key: "エネルギー自動回復", values: [energy, energy] }
      );
    }
    return { key: level, combatList };
  });
}

/** JSON string suitable for an `ascension` component's `data` field. */
export function createBompAscensionData(
  options: BompAscensionOptions = {}
): string {
  return JSON.stringify({ list: createBompAscensionList(options) });
}

/**
 * Builds `page.filter_values` with agent_faction names for the given faction
 * IDs. BompDataProcessor.extractBompFactions reads faction names from
 * `filter_values.agent_faction.values` and resolves them to IDs.
 */
export function createBompFactionFilterValues(factionIds: number[]) {
  const names = factionIds
    .map((id) => factions.find((f) => f.id === id)?.name.ja)
    .filter((name): name is string => typeof name === "string");
  return { agent_faction: { values: names } };
}

let importCounter = 0;

/**
 * Imports a generated bomps.ts file without hitting the module cache.
 * Tests reuse the same output path, and Vitest caches modules by file id
 * (query-string cache busting is not honoured), so copy the file to a unique
 * sibling path before importing it.
 */
export async function importGeneratedBomps<T = unknown>(
  outputPath: string
): Promise<T[]> {
  const resolved = path.resolve(outputPath);
  const uniquePath = resolved.replace(
    /\.ts$/,
    `.import-${process.pid}-${++importCounter}.ts`
  );
  fs.copyFileSync(resolved, uniquePath);
  try {
    const mod = await import(uniquePath);
    return mod.default as T[];
  } finally {
    fs.rmSync(uniquePath, { force: true });
  }
}
