import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it, expect } from "vitest";
import {
  assertArtifactCliOptions,
  resolveCliArtifactPaths,
} from "./cli-artifact-resolve";

describe("cli-artifact-resolve", () => {
  it("assertArtifactCliOptions rejects partial flags", () => {
    expect(() => assertArtifactCliOptions("local", undefined)).toThrow(
      /both --source and --location/,
    );
    expect(() => assertArtifactCliOptions(undefined, "/tmp/x")).toThrow(
      /both --source and --location/,
    );
  });

  it("resolveCliArtifactPaths rejects --run-id without source mode", async () => {
    await expect(
      resolveCliArtifactPaths({ targetDir: "./target" }, { runId: "current" }),
    ).rejects.toThrow(/--run-id is only valid/);
  });

  it("resolveCliArtifactPaths loads a local pair from a temp directory", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dbt-cli-artifact-"));
    await fs.writeFile(path.join(dir, "manifest.json"), "{}");
    await fs.writeFile(path.join(dir, "run_results.json"), "{}");
    const paths = await resolveCliArtifactPaths(
      {},
      { source: "local", location: dir },
    );
    expect(paths.manifest).toBe(path.join(dir, "manifest.json"));
    expect(paths.runResults).toBe(path.join(dir, "run_results.json"));
  });

  it("resolveCliArtifactPaths rejects mixing source mode with manifest path", async () => {
    await expect(
      resolveCliArtifactPaths(
        { manifestPath: "/tmp/m.json" },
        { source: "local", location: "/tmp" },
      ),
    ).rejects.toThrow(/Do not combine --source/);
  });

  it("resolveCliArtifactPaths picks run when --run-id has surrounding whitespace", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dbt-cli-artifact-"));
    for (const run of ["runAlpha", "runBeta"]) {
      const sub = path.join(dir, run);
      await fs.mkdir(sub, { recursive: true });
      await fs.writeFile(path.join(sub, "manifest.json"), "{}");
      await fs.writeFile(path.join(sub, "run_results.json"), "{}");
    }
    const paths = await resolveCliArtifactPaths(
      {},
      { source: "local", location: dir, runId: "  runAlpha  " },
    );
    expect(paths.manifest).toBe(path.join(dir, "runAlpha", "manifest.json"));
    expect(paths.runResults).toBe(
      path.join(dir, "runAlpha", "run_results.json"),
    );
  });

  it("resolveCliArtifactPaths ignores whitespace-only legacy catalog/sources in source mode", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dbt-cli-artifact-"));
    await fs.writeFile(path.join(dir, "manifest.json"), "{}");
    await fs.writeFile(path.join(dir, "run_results.json"), "{}");
    const paths = await resolveCliArtifactPaths(
      { catalogPath: "   ", sourcesPath: "\t" },
      { source: "local", location: dir },
    );
    expect(paths.manifest).toBe(path.join(dir, "manifest.json"));
    expect(paths.runResults).toBe(path.join(dir, "run_results.json"));
  });
});
