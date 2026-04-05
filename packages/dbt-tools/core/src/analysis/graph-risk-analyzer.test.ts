import { describe, expect, it } from "vitest";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { parseRunResults } from "dbt-artifacts-parser/run_results";
import type { ParsedManifest } from "dbt-artifacts-parser/manifest";
import type { DbtResourceType } from "../types";
import {
  GraphRiskAnalyzer,
  type GraphRiskRankingMetric,
} from "./graph-risk-analyzer";

type NodeSpec = {
  uniqueId: string;
  parents?: string[];
  resourceType?: DbtResourceType;
};

function modelId(name: string): string {
  return `model.pkg.${name}`;
}

function sourceId(name: string): string {
  return `source.pkg.${name}`;
}

function createManifest(specs: NodeSpec[]): ParsedManifest {
  const nodes: Record<string, Record<string, unknown>> = {};
  const sources: Record<string, Record<string, unknown>> = {};
  const parentMap: Record<string, string[]> = {};

  for (const spec of specs) {
    const resourceType = spec.resourceType ?? "model";
    const entry = {
      unique_id: spec.uniqueId,
      resource_type: resourceType,
      name: spec.uniqueId.split(".").pop(),
      package_name: "pkg",
      depends_on: { nodes: spec.parents ?? [] },
    };

    if (resourceType === "source") {
      sources[spec.uniqueId] = entry;
    } else {
      nodes[spec.uniqueId] = entry;
    }
    parentMap[spec.uniqueId] = [...(spec.parents ?? [])];
  }

  return {
    metadata: {
      dbt_schema_version: "https://schemas.getdbt.com/dbt/manifest/v12.json",
      dbt_version: "1.10.0",
      adapter_type: "postgres",
    },
    nodes,
    sources,
    parent_map: parentMap,
  } as unknown as ParsedManifest;
}

function createRunResults(
  durationsSeconds: Record<string, number>,
  extraUniqueIds: string[] = [],
) {
  const results = Object.entries(durationsSeconds).map(
    ([uniqueId, duration]) => ({
      unique_id: uniqueId,
      status: "success",
      execution_time: duration,
      thread_id: "Thread-1",
      timing: [],
    }),
  );
  for (const uniqueId of extraUniqueIds) {
    results.push({
      unique_id: uniqueId,
      status: "success",
      execution_time: 3,
      thread_id: "Thread-2",
      timing: [],
    });
  }

  return parseRunResults({
    metadata: {
      dbt_schema_version: "https://schemas.getdbt.com/dbt/run-results/v6.json",
    },
    elapsed_time: Object.values(durationsSeconds).reduce(
      (sum, duration) => sum + duration,
      0,
    ),
    results,
  } as Record<string, unknown>);
}

function analyze(
  specs: NodeSpec[],
  args?: {
    durationsSeconds?: Record<string, number>;
    topN?: number;
    resourceTypes?: DbtResourceType[];
  },
): GraphRiskAnalyzer {
  return new GraphRiskAnalyzer({
    manifest: createManifest(specs),
    ...(args?.durationsSeconds
      ? { runResults: createRunResults(args.durationsSeconds) }
      : {}),
    options: {
      topN: args?.topN,
      resourceTypes: args?.resourceTypes,
    },
  });
}

function topIds(
  analyzer: GraphRiskAnalyzer,
  metric: GraphRiskRankingMetric,
): string[] {
  return analyzer
    .getTopNodes({ metric, limit: 10 })
    .map((node) => node.uniqueId);
}

describe("GraphRiskAnalyzer", () => {
  it("calculates degree, reachability, and depth metrics on a simple chain", () => {
    const chain = [
      { uniqueId: modelId("a") },
      { uniqueId: modelId("b"), parents: [modelId("a")] },
      { uniqueId: modelId("c"), parents: [modelId("b")] },
      { uniqueId: modelId("d"), parents: [modelId("c")] },
    ];
    const analyzer = analyze(chain);

    const a = analyzer.getNode(modelId("a"));
    const c = analyzer.getNode(modelId("c"));
    const d = analyzer.getNode(modelId("d"));

    expect(a?.structural.inDegree).toBe(0);
    expect(a?.structural.outDegree).toBe(1);
    expect(a?.structural.transitiveDownstreamCount).toBe(3);
    expect(a?.structural.longestDownstreamDepth).toBe(3);

    expect(c?.structural.inDegree).toBe(1);
    expect(c?.structural.outDegree).toBe(1);
    expect(c?.structural.transitiveUpstreamCount).toBe(2);
    expect(c?.structural.transitiveDownstreamCount).toBe(1);
    expect(c?.structural.longestUpstreamDepth).toBe(2);
    expect(c?.structural.longestDownstreamDepth).toBe(1);

    expect(d?.structural.transitiveUpstreamCount).toBe(3);
    expect(d?.structural.longestUpstreamDepth).toBe(3);
  });

  it("ranks wide fan-out roots highest for blast radius", () => {
    const specs = [
      { uniqueId: modelId("orders") },
      { uniqueId: modelId("orders_enriched"), parents: [modelId("orders")] },
      { uniqueId: modelId("orders_mart"), parents: [modelId("orders")] },
      { uniqueId: modelId("orders_inventory"), parents: [modelId("orders")] },
      { uniqueId: modelId("orders_finance"), parents: [modelId("orders")] },
    ];
    const analyzer = analyze(specs);

    expect(topIds(analyzer, "blastRadiusScore")[0]).toBe(modelId("orders"));
    expect(analyzer.getNode(modelId("orders"))?.findings).toContain(
      "High downstream blast radius: affects 4 descendants",
    );
  });

  it("ranks high fan-in join hubs highest for fragility", () => {
    const specs = [
      { uniqueId: modelId("stg_orders") },
      { uniqueId: modelId("stg_customers") },
      { uniqueId: modelId("stg_products") },
      { uniqueId: modelId("stg_payments") },
      {
        uniqueId: modelId("int_join_hub"),
        parents: [
          modelId("stg_orders"),
          modelId("stg_customers"),
          modelId("stg_products"),
          modelId("stg_payments"),
        ],
      },
      { uniqueId: modelId("fct_orders"), parents: [modelId("int_join_hub")] },
    ];
    const analyzer = analyze(specs);
    const hub = analyzer.getNode(modelId("int_join_hub"));

    expect(topIds(analyzer, "fragilityScore")[0]).toBe(modelId("int_join_hub"));
    expect(hub?.structural.inDegree).toBe(4);
    expect(hub?.findings).toContain("High fan-in: 4 direct parents");
  });

  it("gives reconvergent merges higher reconvergence scores than independent joins", () => {
    const specs = [
      { uniqueId: modelId("root") },
      { uniqueId: modelId("left_a"), parents: [modelId("root")] },
      { uniqueId: modelId("left_b"), parents: [modelId("left_a")] },
      { uniqueId: modelId("right_a"), parents: [modelId("root")] },
      { uniqueId: modelId("right_b"), parents: [modelId("right_a")] },
      {
        uniqueId: modelId("reconvergent_merge"),
        parents: [modelId("left_b"), modelId("right_b")],
      },
      { uniqueId: modelId("independent_root_a") },
      { uniqueId: modelId("independent_root_b") },
      {
        uniqueId: modelId("independent_join"),
        parents: [modelId("independent_root_a"), modelId("independent_root_b")],
      },
    ];
    const analyzer = analyze(specs);

    const reconvergent = analyzer.getNode(modelId("reconvergent_merge"));
    const independent = analyzer.getNode(modelId("independent_join"));

    expect(reconvergent?.structural.reconvergenceScore ?? 0).toBeGreaterThan(
      independent?.structural.reconvergenceScore ?? 0,
    );
  });

  it("uses path concentration to surface shared chokepoints", () => {
    const specs = [
      { uniqueId: modelId("raw_a") },
      { uniqueId: modelId("raw_b") },
      { uniqueId: modelId("stg_a"), parents: [modelId("raw_a")] },
      { uniqueId: modelId("stg_b"), parents: [modelId("raw_b")] },
      {
        uniqueId: modelId("shared_int"),
        parents: [modelId("stg_a"), modelId("stg_b")],
      },
      { uniqueId: modelId("mart_one"), parents: [modelId("shared_int")] },
      { uniqueId: modelId("mart_two"), parents: [modelId("shared_int")] },
      { uniqueId: modelId("mart_three"), parents: [modelId("shared_int")] },
    ];
    const analyzer = analyze(specs);
    const topPathNode = analyzer.getTopNodes({
      metric: "pathConcentrationScore",
      limit: 1,
    })[0];

    expect(topPathNode?.uniqueId).toBe(modelId("shared_int"));
    expect(
      topPathNode?.findings.some((finding) => finding.includes("chokepoint")),
    ).toBe(true);
  });

  it("computes execution-aware critical path, slack, and bottleneck scores", () => {
    const specs = [
      { uniqueId: modelId("root") },
      { uniqueId: modelId("slow_branch"), parents: [modelId("root")] },
      { uniqueId: modelId("fast_branch"), parents: [modelId("root")] },
      { uniqueId: modelId("slow_leaf"), parents: [modelId("slow_branch")] },
      { uniqueId: modelId("fast_leaf"), parents: [modelId("fast_branch")] },
    ];
    const analyzer = analyze(specs, {
      durationsSeconds: {
        [modelId("root")]: 1,
        [modelId("slow_branch")]: 9,
        [modelId("fast_branch")]: 2,
        [modelId("slow_leaf")]: 1,
        [modelId("fast_leaf")]: 1,
      },
    });

    const slowBranch = analyzer.getNode(modelId("slow_branch"));
    const fastBranch = analyzer.getNode(modelId("fast_branch"));
    const summary = analyzer.analyze();

    expect(summary.executionCoveragePct).toBe(100);
    expect(slowBranch?.execution?.criticalPath).toBe(true);
    expect(slowBranch?.execution?.slackMs).toBe(0);
    expect(fastBranch?.execution?.criticalPath).toBe(false);
    expect(fastBranch?.execution?.slackMs ?? 0).toBeGreaterThan(0);
    expect(topIds(analyzer, "bottleneckScore")[0]).toBe(modelId("slow_branch"));
    expect(slowBranch?.findings).toContain("On critical path with low slack");
  });

  it("reports partial execution coverage and leaves missing runtime metrics absent", () => {
    const specs = [
      { uniqueId: modelId("a") },
      { uniqueId: modelId("b"), parents: [modelId("a")] },
      { uniqueId: modelId("c"), parents: [modelId("b")] },
      { uniqueId: modelId("d"), parents: [modelId("c")] },
    ];
    const analyzer = analyze(specs, {
      durationsSeconds: {
        [modelId("a")]: 1,
        [modelId("b")]: 2,
      },
    });
    const summary = analyzer.analyze();

    expect(summary.executionCoveragePct).toBe(50);
    expect(analyzer.getNode(modelId("a"))?.execution?.durationMs).toBe(1000);
    expect(analyzer.getNode(modelId("d"))?.execution).toBeUndefined();
  });

  it("ignores run_results entries that do not exist in the analyzed graph", () => {
    const specs = [
      { uniqueId: modelId("a") },
      { uniqueId: modelId("b"), parents: [modelId("a")] },
    ];
    const analyzer = new GraphRiskAnalyzer({
      manifest: createManifest(specs),
      runResults: createRunResults(
        {
          [modelId("a")]: 1,
        },
        [modelId("outside_graph")],
      ),
    });
    const summary = analyzer.analyze();

    expect(summary.executionCoveragePct).toBe(50);
    expect(analyzer.getNode(modelId("b"))?.execution).toBeUndefined();
  });

  it("supports resource-type expansion beyond models", () => {
    const specs = [
      { uniqueId: sourceId("raw_orders"), resourceType: "source" },
      {
        uniqueId: modelId("stg_orders"),
        parents: [sourceId("raw_orders")],
      },
    ];
    const analyzer = analyze(specs, {
      resourceTypes: ["model", "source"],
    });
    const summary = analyzer.analyze();

    expect(summary.analyzedNodes).toBe(2);
    expect(analyzer.getNode(sourceId("raw_orders"))?.resourceType).toBe(
      "source",
    );
  });

  it("keeps large path-count graphs numerically stable", () => {
    const specs: NodeSpec[] = [{ uniqueId: modelId("root") }];
    const layers = 10;
    let previousLayer = [modelId("root")];

    for (let layer = 1; layer <= layers; layer++) {
      const left = modelId(`layer_${layer}_left`);
      const right = modelId(`layer_${layer}_right`);
      specs.push({ uniqueId: left, parents: [...previousLayer] });
      specs.push({ uniqueId: right, parents: [...previousLayer] });
      previousLayer = [left, right];
    }

    const analyzer = analyze(specs);
    const top = analyzer.getTopNodes({
      metric: "pathConcentrationScore",
      limit: 3,
    });

    expect(top.length).toBe(3);
    for (const node of top) {
      expect(
        Number.isFinite(node.structural.pathConcentrationScore ?? NaN),
      ).toBe(true);
    }
  });
});
