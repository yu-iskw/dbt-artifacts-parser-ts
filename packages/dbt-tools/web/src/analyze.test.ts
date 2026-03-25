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
    expect(result.graphSummary.totalNodes).toBeGreaterThan(0);
    expect(result.resources.length).toBeGreaterThan(0);
    expect(result.resourceGroups.length).toBeGreaterThan(0);
    expect(result.executions.length).toBe(result.summary.total_nodes);
    expect(result.statusBreakdown.length).toBeGreaterThan(0);
    expect(result.threadStats.length).toBeGreaterThan(0);
    expect(result.selectedResourceId).not.toBeNull();
    expect(result.dependencyIndex[result.selectedResourceId!]).toBeDefined();
    expect(result.timelineAdjacency).toBeDefined();
    expect(Object.keys(result.timelineAdjacency).length).toBeGreaterThan(0);
    for (const row of result.ganttData) {
      expect(result.timelineAdjacency[row.unique_id]).toBeDefined();
      expect(
        Array.isArray(result.timelineAdjacency[row.unique_id]!.inbound),
      ).toBe(true);
      expect(
        Array.isArray(result.timelineAdjacency[row.unique_id]!.outbound),
      ).toBe(true);
    }
    const anyInbound = result.ganttData.some(
      (g) => (result.timelineAdjacency[g.unique_id]?.inbound.length ?? 0) > 0,
    );
    expect(anyInbound).toBe(true);
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
