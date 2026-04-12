import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  discoverArtifactCandidateSets,
  discoverLocalArtifactFiles,
  selectArtifactCandidate,
  validateRequiredArtifacts,
} from "./artifact-discovery";

describe("artifact-discovery", () => {
  it("supports local source with required pair only", () => {
    const candidates = discoverArtifactCandidateSets([
      { relativePath: "manifest.json", filename: "manifest.json" },
      { relativePath: "run_results.json", filename: "run_results.json" },
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.isLoadable).toBe(true);
    expect(candidates[0]?.missingOptional).toEqual([
      "catalog.json",
      "sources.json",
    ]);
  });

  it("requires explicit selection when multiple candidates exist", () => {
    const candidates = discoverArtifactCandidateSets([
      { relativePath: "a/manifest.json", filename: "manifest.json" },
      { relativePath: "a/run_results.json", filename: "run_results.json" },
      { relativePath: "b/manifest.json", filename: "manifest.json" },
      { relativePath: "b/run_results.json", filename: "run_results.json" },
    ]);

    expect(() => selectArtifactCandidate(candidates)).toThrow(
      /Select one explicitly/,
    );
    expect(selectArtifactCandidate(candidates, "a").candidateId).toBe("a");
  });

  it("fails when manifest.json is missing", () => {
    const candidate = discoverArtifactCandidateSets([
      { relativePath: "run_results.json", filename: "run_results.json" },
    ])[0]!;

    expect(() => validateRequiredArtifacts(candidate)).toThrow(/manifest.json/);
  });

  it("fails when run_results.json is missing", () => {
    const candidate = discoverArtifactCandidateSets([
      { relativePath: "manifest.json", filename: "manifest.json" },
    ])[0]!;

    expect(() => validateRequiredArtifacts(candidate)).toThrow(
      /run_results.json/,
    );
  });

  it("discovers local directory and direct child candidates", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "dbt-discovery-"));
    const nested = path.join(root, "run-1");
    await fs.mkdir(nested);
    await fs.writeFile(path.join(root, "manifest.json"), "{}");
    await fs.writeFile(path.join(root, "run_results.json"), "{}");
    await fs.writeFile(path.join(nested, "manifest.json"), "{}");
    await fs.writeFile(path.join(nested, "run_results.json"), "{}");

    const files = await discoverLocalArtifactFiles(root);
    expect(files.map((file) => file.relativePath).sort()).toEqual([
      "manifest.json",
      "run-1/manifest.json",
      "run-1/run_results.json",
      "run_results.json",
    ]);

    await fs.rm(root, { recursive: true, force: true });
  });
});
