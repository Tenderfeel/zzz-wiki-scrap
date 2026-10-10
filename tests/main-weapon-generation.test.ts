import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { main, WeaponDataPipeline } from "../src/main-weapon-generation";

describe("main-weapon-generation main()", () => {
  let tmpDir: string;
  let executedConfig: any;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "weapon-config-"));
    executedConfig = undefined;
    vi.spyOn(process, "exit").mockImplementation((() => undefined) as any);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    // 実際の API 呼び出しとファイル出力をせず、渡された設定だけを記録する
    vi.spyOn(WeaponDataPipeline.prototype, "execute").mockImplementation(
      async function (this: any) {
        executedConfig = this.config;
        throw new Error("stop after config check");
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("--config で指定した設定ファイルを使う", async () => {
    const configPath = path.join(tmpDir, "custom-config.json");
    const outputPath = path.join(tmpDir, "weapons.ts");
    fs.writeFileSync(
      configPath,
      JSON.stringify({ weaponProcessing: { outputPath } })
    );

    await main(configPath);

    expect(executedConfig.outputPath).toBe(outputPath);
  });

  it("指定した設定ファイルが存在しない場合は処理を始めずに失敗する", async () => {
    await main(path.join(tmpDir, "missing-config.json"));

    expect(WeaponDataPipeline.prototype.execute).not.toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
