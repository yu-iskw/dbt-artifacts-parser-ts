import { describe, it, expect } from "vitest";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { parseManifest } from "dbt-artifacts-parser/manifest";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { parseRunResults } from "dbt-artifacts-parser/run_results";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import {
  loadTestManifest,
  loadTestRunResults,
} from "dbt-artifacts-parser/test-utils";
import { ManifestGraph } from "./manifest-graph";
import { analyzeBottlenecks } from "./bottleneck-analyzer";

function makeRunResults(
  results: Array<{
    unique_id: string;
    status?: string;
    execution_time?: number;
    timing?: unknown[];
  }>,
  adapterType?: string,
): ReturnType<typeof parseRunResults> {
  return parseRunResults({
    metadata: {
      dbt_schema_version: "https://schemas.getdbt.com/dbt/run-results/v6.json",
      ...(adapterType ? { adapter_type: adapterType } : {}),
    },
    results: results.map((r) => ({
      unique_id: r.unique_id,
      status: r.status ?? "success",
      execution_time: r.execution_time ?? 0,
      timing: r.timing ?? [],
    })),
  } as Record<string, unknown>);
}

describe("analyzeBottlenecks", () => {
  it("should return enriched bottleneck nodes with structural metadata", () => {
    const runResultsJson = loadTestRunResults("v6", "run_results.json");
    const runResults = parseRunResults(
      runResultsJson as Record<string, unknown>,
    );
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);

    const result = analyzeBottlenecks(runResults, graph, {
      mode: "top_n",
      top: 5,
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result.top_bottlenecks)).toBe(true);
    expect(result.top_bottlenecks.length).toBeLessThanOrEqual(5);
    expect(typeof result.total_execution_time).toBe("number");
    expect(result.criteria_used).toBe("top_n");
    expect(typeof result.total_nodes_analyzed).toBe("number");
  });

  it("should include structural enrichment fields on each node", () => {
    const runResultsJson = loadTestRunResults("v6", "run_results.json");
    const runResults = parseRunResults(
      runResultsJson as Record<string, unknown>,
    );
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);

    const result = analyzeBottlenecks(runResults, graph, {
      mode: "top_n",
      top: 10,
    });

    for (const node of result.top_bottlenecks) {
      expect(typeof node.downstream_count).toBe("number");
      expect(node.downstream_count).toBeGreaterThanOrEqual(0);
      expect(typeof node.fan_in).toBe("number");
      expect(typeof node.fan_out).toBe("number");
      expect(typeof node.structural_impact_score).toBe("number");
      expect(typeof node.is_on_critical_path).toBe("boolean");
    }
  });

  it("should rank nodes by structural_impact_score descending", () => {
    const runResultsJson = loadTestRunResults("v6", "run_results.json");
    const runResults = parseRunResults(
      runResultsJson as Record<string, unknown>,
    );
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);

    const result = analyzeBottlenecks(runResults, graph, {
      mode: "top_n",
      top: 10,
    });

    for (let i = 1; i < result.top_bottlenecks.length; i++) {
      expect(result.top_bottlenecks[i - 1].structural_impact_score).toBeGreaterThanOrEqual(
        result.top_bottlenecks[i].structural_impact_score,
      );
    }
  });

  it("should assign sequential ranks starting from 1", () => {
    const runResultsJson = loadTestRunResults("v6", "run_results.json");
    const runResults = parseRunResults(
      runResultsJson as Record<string, unknown>,
    );
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);

    const result = analyzeBottlenecks(runResults, graph, {
      mode: "top_n",
      top: 5,
    });

    for (let i = 0; i < result.top_bottlenecks.length; i++) {
      expect(result.top_bottlenecks[i].rank).toBe(i + 1);
    }
  });

  it("should extract adapter_type from run_results metadata", () => {
    const runResults = makeRunResults(
      [{ unique_id: "model.pkg.a", execution_time: 1 }],
      "bigquery",
    );
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);

    const result = analyzeBottlenecks(runResults, graph, {
      mode: "top_n",
      top: 5,
    });

    expect(result.adapter_type).toBe("bigquery");
  });

  it("should return null adapter_type when metadata has no adapter_type", () => {
    const runResults = makeRunResults([
      { unique_id: "model.pkg.a", execution_time: 1 },
    ]);
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);

    const result = analyzeBottlenecks(runResults, graph, {
      mode: "top_n",
      top: 5,
    });

    expect(result.adapter_type).toBeNull();
  });

  it("should support threshold mode", () => {
    const runResultsJson = loadTestRunResults("v6", "run_results.json");
    const runResults = parseRunResults(
      runResultsJson as Record<string, unknown>,
    );
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);

    const result = analyzeBottlenecks(runResults, graph, {
      mode: "threshold",
      min_seconds: 0,
    });

    expect(result.criteria_used).toBe("threshold");
    expect(Array.isArray(result.top_bottlenecks)).toBe(true);
  });

  it("should return empty bottlenecks when run_results is empty", () => {
    const runResults = makeRunResults([]);
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);

    const result = analyzeBottlenecks(runResults, graph, {
      mode: "top_n",
      top: 10,
    });

    expect(result.top_bottlenecks).toHaveLength(0);
    expect(result.total_execution_time).toBe(0);
    expect(result.total_nodes_analyzed).toBe(0);
  });

  it("structural_impact_score should be execution_time * (1 + downstream_count)", () => {
    const runResultsJson = loadTestRunResults("v6", "run_results.json");
    const runResults = parseRunResults(
      runResultsJson as Record<string, unknown>,
    );
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);

    const result = analyzeBottlenecks(runResults, graph, {
      mode: "top_n",
      top: 5,
    });

    for (const node of result.top_bottlenecks) {
      const expected = node.execution_time * (1 + node.downstream_count);
      expect(node.structural_impact_score).toBeCloseTo(expected, 1);
    }
  });

  it("top_n should select by structural impact score, not raw execution time", () => {
    // Node A (isolated): high raw execution_time (50s), 0 downstream
    //   → structural_impact_score = 50 × (1 + 0) = 50
    // Node B (high-downstream): lower raw execution_time (10s), 10+ downstream
    //   → structural_impact_score = 10 × (1 + 10+) = 110+
    //
    // A naive raw-time sort would pick A. Structural-impact sort must pick B.
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);
    const g = graph.getGraph();

    // Find two nodes: one with many transitive downstream nodes and one isolated
    let highDownstreamId: string | null = null;
    let highDownstreamCount = 0;
    let isolatedId: string | null = null;

    g.forEachNode((nodeId) => {
      const downstream = graph.getDownstream(nodeId);
      if (downstream.length > highDownstreamCount) {
        highDownstreamCount = downstream.length;
        highDownstreamId = nodeId;
      }
    });

    g.forEachNode((nodeId) => {
      if (nodeId === highDownstreamId) return;
      const downstream = graph.getDownstream(nodeId);
      if (downstream.length === 0 && isolatedId === null) {
        isolatedId = nodeId;
      }
    });

    if (highDownstreamId === null || isolatedId === null || highDownstreamCount < 5) {
      // Skip if the test manifest doesn't have suitable nodes
      return;
    }

    // isolated gets high raw execution time → wins on raw time alone
    // highDownstream gets lower raw time but compensates via downstream reach
    const highTimeIsolated = { unique_id: isolatedId, execution_time: 50 };
    const lowTimeHighImpact = { unique_id: highDownstreamId, execution_time: 10 };

    const runResults = makeRunResults([highTimeIsolated, lowTimeHighImpact]);
    const result = analyzeBottlenecks(runResults, graph, { mode: "top_n", top: 1 });

    // structural_impact for highDownstream = 10 × (1 + highDownstreamCount) >> 50
    expect(result.top_bottlenecks).toHaveLength(1);
    expect(result.top_bottlenecks[0].unique_id).toBe(highDownstreamId);
  });
});
