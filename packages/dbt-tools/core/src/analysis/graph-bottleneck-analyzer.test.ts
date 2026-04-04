import { describe, it, expect } from "vitest";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { parseManifest } from "dbt-artifacts-parser/manifest";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { loadTestManifest } from "dbt-artifacts-parser/test-utils";
import { ManifestGraph } from "./manifest-graph";
import { GraphBottleneckAnalyzer } from "./graph-bottleneck-analyzer";
import type { NodeExecution } from "./execution-analyzer";

function buildToyGraph(): ManifestGraph {
  const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
  const manifest = parseManifest(manifestJson as Record<string, unknown>);
  const graph = new ManifestGraph(manifest);
  const g = graph.getGraph();

  g.clear();

  const mkNode = (id: string, name: string) => ({
    unique_id: id,
    name,
    package_name: "pkg",
    resource_type: "model" as const,
  });

  g.addNode("model.pkg.a", mkNode("model.pkg.a", "a"));
  g.addNode("model.pkg.b", mkNode("model.pkg.b", "b"));
  g.addNode("model.pkg.c", mkNode("model.pkg.c", "c"));
  g.addNode("model.pkg.d", mkNode("model.pkg.d", "d"));
  g.addNode("model.pkg.e", mkNode("model.pkg.e", "e"));

  g.addEdge("model.pkg.a", "model.pkg.b", { dependency_type: "node" });
  g.addEdge("model.pkg.a", "model.pkg.c", { dependency_type: "node" });
  g.addEdge("model.pkg.b", "model.pkg.d", { dependency_type: "node" });
  g.addEdge("model.pkg.c", "model.pkg.d", { dependency_type: "node" });
  g.addEdge("model.pkg.d", "model.pkg.e", { dependency_type: "node" });

  return graph;
}

describe("GraphBottleneckAnalyzer", () => {
  it("computes weighted critical path and ranks nodes with graph metrics", () => {
    const graph = buildToyGraph();
    const executions: NodeExecution[] = [
      { unique_id: "model.pkg.a", execution_time: 1, status: "success" },
      { unique_id: "model.pkg.b", execution_time: 1, status: "success" },
      { unique_id: "model.pkg.c", execution_time: 10, status: "success" },
      { unique_id: "model.pkg.d", execution_time: 1, status: "success" },
      { unique_id: "model.pkg.e", execution_time: 1, status: "success" },
    ];

    const report = new GraphBottleneckAnalyzer(graph, executions).analyze({
      topN: 3,
    });

    expect(report.critical_path?.path).toEqual([
      "model.pkg.a",
      "model.pkg.c",
      "model.pkg.d",
      "model.pkg.e",
    ]);
    expect(report.critical_path?.total_time).toBe(13);

    expect(report.ranked_nodes).toHaveLength(3);
    const topNodeIds = report.ranked_nodes.map((node) => node.unique_id);
    expect(topNodeIds).toContain("model.pkg.c");
    expect(report.ranked_nodes.some((node) => node.on_critical_path)).toBe(
      true,
    );
    expect(report.ranked_nodes[0]?.reasons.length).toBeGreaterThan(0);
  });

  it("still produces structural ranking without execution data", () => {
    const graph = buildToyGraph();

    const report = new GraphBottleneckAnalyzer(graph).analyze();

    expect(report.summary.executed_nodes).toBe(0);
    expect(report.critical_path).toBeUndefined();
    expect(report.ranked_nodes.length).toBe(5);
    expect(report.ranked_nodes[0]?.downstream_count).toBeGreaterThanOrEqual(
      report.ranked_nodes[1]?.downstream_count ?? 0,
    );
  });
});
