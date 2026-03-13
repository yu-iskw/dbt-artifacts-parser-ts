import { describe, it, expect } from "vitest";
import {
  loadTestManifest,
  loadTestRunResults,
} from "dbt-artifacts-parser/test-utils";
import { analyzeArtifacts } from "./services/analyze";

describe("analyzeArtifacts", () => {
  it("returns AnalysisState for valid manifest and run_results", async () => {
    const manifestJson = loadTestManifest(
      "v12",
      "manifest_1.10.json",
    ) as Record<string, unknown>;
    const runResultsJson = loadTestRunResults(
      "v6",
      "run_results.json",
    ) as Record<string, unknown>;

    const result = await analyzeArtifacts(manifestJson, runResultsJson);

    expect(result).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.ganttData).toBeDefined();
    expect(Array.isArray(result.ganttData)).toBe(true);
    expect(result.bottlenecks).toBeDefined();
    expect(result.summary.total_execution_time).toBeGreaterThanOrEqual(0);
    expect(result.summary.total_nodes).toBeGreaterThanOrEqual(0);
  });

  it("throws for invalid manifest JSON", async () => {
    const invalidManifest = { not: "a manifest" };
    const runResultsJson = loadTestRunResults(
      "v6",
      "run_results.json",
    ) as Record<string, unknown>;

    await expect(
      analyzeArtifacts(invalidManifest, runResultsJson),
    ).rejects.toThrow();
  });

  it("throws for invalid run_results JSON", async () => {
    const manifestJson = loadTestManifest(
      "v12",
      "manifest_1.10.json",
    ) as Record<string, unknown>;
    const invalidRunResults = { not: "run_results" };

    await expect(
      analyzeArtifacts(manifestJson, invalidRunResults),
    ).rejects.toThrow();
  });
});
