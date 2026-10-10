import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  applyDataCorrections,
  DataCorrections,
} from "../../src/utils/DataCorrections";
import defaultCorrections from "../../json/data-corrections.json";
import bomps from "../../data/bomps";
import characters from "../../data/characters";
import weapons from "../../data/weapons";
import { logger } from "../../src/utils/Logger";

describe("applyDataCorrections", () => {
  const corrections: DataCorrections = {
    bomps: [
      {
        id: "robin",
        path: "attr.atk.6",
        from: 8261,
        to: 8621,
        reason: "テスト用",
      },
    ],
  };

  const createRobin = (atk60: number) => ({
    id: "robin",
    attr: { atk: [70, 450, 1060, 2059, 4030, 8270, atk60] },
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("元データが from と一致する場合は to で上書きする", () => {
    const result = applyDataCorrections("bomps", "robin", createRobin(8261), corrections);

    expect(result.attr.atk[6]).toBe(8621);
  });

  it("元のオブジェクトは変更しない", () => {
    const original = createRobin(8261);

    applyDataCorrections("bomps", "robin", original, corrections);

    expect(original.attr.atk[6]).toBe(8261);
  });

  it("ID が一致しない場合は何もしない", () => {
    const other = { ...createRobin(8261), id: "other" };

    const result = applyDataCorrections("bomps", "other", other, corrections);

    expect(result.attr.atk[6]).toBe(8261);
  });

  it("元データが修正済み（to と一致）の場合は上書きせず、補正が不要になったことを通知する", () => {
    const infoSpy = vi.spyOn(logger, "info");

    const result = applyDataCorrections("bomps", "robin", createRobin(8621), corrections);

    expect(result.attr.atk[6]).toBe(8621);
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining("不要"),
      expect.objectContaining({ id: "robin", path: "attr.atk.6" })
    );
  });

  it("元データが from とも to とも異なる場合は上書きせず警告する", () => {
    const warnSpy = vi.spyOn(logger, "warn");

    const result = applyDataCorrections("bomps", "robin", createRobin(9000), corrections);

    expect(result.attr.atk[6]).toBe(9000);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("スキップ"),
      expect.objectContaining({ id: "robin", actual: 9000 })
    );
  });

  it("パスが存在しない場合は上書きせず警告する", () => {
    const warnSpy = vi.spyOn(logger, "warn");

    const result = applyDataCorrections(
      "bomps",
      "robin",
      { id: "robin", attr: {} },
      corrections
    );

    expect(result).toEqual({ id: "robin", attr: {} });
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe("json/data-corrections.json", () => {
  const dataByCategory: Record<string, { id: string | number }[]> = {
    characters,
    weapons,
    bomps,
  };

  it("補正カテゴリはすべて既知のデータファイルに対応している", () => {
    expect(Object.keys(defaultCorrections).sort()).toEqual(
      Object.keys(dataByCategory).sort()
    );
  });

  it.each(Object.keys(dataByCategory))(
    "%s の補正がすべて data/ に反映済みである",
    (category) => {
      const corrections = (defaultCorrections as DataCorrections)[category];
      for (const correction of corrections) {
        const item = dataByCategory[category].find(
          (d) => String(d.id) === correction.id
        );
        expect(item, `${correction.id} が data/ に存在しない`).toBeDefined();

        const value = correction.path
          .split(".")
          .reduce<any>((obj, key) => obj?.[key], item);
        expect(value, `${correction.id} ${correction.path}`).toBe(correction.to);
      }
    }
  );
});
