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

  it("空のカテゴリ配列でエラー", () => {
    const data: MasterData = { ...minimalData, assistTypes: [] };
    expect(() => validate(data)).toThrow(/assistTypes が空です/);
  });

  it("空のfactions配列でエラー", () => {
    const data: MasterData = { ...minimalData, factions: [] };
    expect(() => validate(data)).toThrow(/factions が空です/);
  });

  it("aliasesが空のエントリでエラー", () => {
    const data: MasterData = {
      ...minimalData,
      stats: [{ id: "ice", label: { ja: "氷", en: "Ice" }, aliases: [] }],
    };
    expect(() => validate(data)).toThrow(/aliases が空です/);
  });

  it("aliasesが欠落したエントリでエラー", () => {
    const data = {
      ...minimalData,
      stats: [{ id: "ice", label: { ja: "氷", en: "Ice" } }],
    } as unknown as MasterData;
    expect(() => validate(data)).toThrow(/aliases が空です/);
  });

  it("空のlabelでエラー", () => {
    const data: MasterData = {
      ...minimalData,
      specialties: [{ id: "attack", label: { ja: "", en: "Attack" }, aliases: ["強攻"] }],
    };
    expect(() => validate(data)).toThrow(/label が空です/);
  });

  it("空のfaction nameでエラー", () => {
    const data: MasterData = {
      ...minimalData,
      factions: [{ id: 1, name: { ja: "邪兎屋", en: "" } }],
    };
    expect(() => validate(data)).toThrow(/name が空です/);
  });

  it("識別子として不正なIDでエラー", () => {
    const data: MasterData = {
      ...minimalData,
      stats: [{ id: 'ice"x', label: { ja: "氷", en: "Ice" }, aliases: ["氷属性"] }],
    };
    expect(() => validate(data)).toThrow(/不正なID/);
  });

  it("アンダースコアを含むIDは許可する", () => {
    const data: MasterData = {
      ...minimalData,
      stats: [{ id: "test_element", label: { ja: "テスト", en: "Test" }, aliases: ["テスト属性"] }],
    };
    expect(() => validate(data)).not.toThrow();
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
