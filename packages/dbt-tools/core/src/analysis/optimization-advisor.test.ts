import { describe, expect, it } from "vitest";
// @ts-expect-error workspace package
import { parseManifest } from "dbt-artifacts-parser/manifest";
// @ts-expect-error workspace package
import { parseRunResults } from "dbt-artifacts-parser/run_results";
// @ts-expect-error workspace package
import { loadTestManifest, loadTestRunResults } from "dbt-artifacts-parser/test-utils";
import { ManifestGraph } from "./manifest-graph";
import { ExecutionAnalyzer } from "./execution-analyzer";
import { buildOptimizationReport } from "./optimization-advisor";

describe("buildOptimizationReport", () => {
  it("returns ranked candidates with requested top N", () => {
    const manifest = parseManifest(
      loadTestManifest("v12", "manifest_1.10.json") as Record<string, unknown>,
    );
    const runResults = parseRunResults(
      loadTestRunResults("v6", "run_results.json") as Record<string, unknown>,
    );

    const graph = new ManifestGraph(manifest);
    const analyzer = new ExecutionAnalyzer(runResults, graph);
    const summary = analyzer.getSummary();

    const report = buildOptimizationReport(summary.node_executions, graph, {
      topN: 3,
      criticalPath: summary.critical_path?.path,
      adapterType: "snowflake",
    });

    expect(report.top_n).toBe(3);
    expect(report.candidates.length).toBeLessThanOrEqual(3);
    expect(report.total_execution_time_seconds).toBeGreaterThanOrEqual(0);

    if (report.candidates.length > 0) {
      const first = report.candidates[0];
      expect(first).toHaveProperty("unique_id");
      expect(first).toHaveProperty("impact_score");
      expect(first).toHaveProperty("bridge_score");
      expect(first).toHaveProperty("recommendations");
      expect(first.recommendations.length).toBeGreaterThan(0);
    }
  });

  it("returns empty candidates when no execution nodes map to graph", () => {
    const manifest = parseManifest(
      loadTestManifest("v12", "manifest_1.10.json") as Record<string, unknown>,
    );
    const graph = new ManifestGraph(manifest);

    const report = buildOptimizationReport(
      [
        {
          unique_id: "model.unknown.missing",
          status: "success",
          execution_time: 12,
        },
      ],
      graph,
      { topN: 5 },
    );

    expect(report.candidates).toEqual([]);
    expect(report.top_n).toBe(5);
    expect(report.total_execution_time_seconds).toBe(12);
  });
});
