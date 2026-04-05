import { describe, expect, it } from "vitest";
import { parseRunResults } from "dbt-artifacts-parser/run_results";
import type {
  AnalysisNode,
  ResolvedOptions,
} from "./graph-risk-analysis-types";
import { computeExecutionAnalysis } from "./graph-risk-execution";

function modelId(i: number): string {
  return `model.pkg.node_${i}`;
}

function createChainNodes(count: number): AnalysisNode[] {
  const nodes: AnalysisNode[] = [];
  for (let i = 0; i < count; i++) {
    const id = modelId(i);
    nodes.push({
      index: i,
      uniqueId: id,
      attributes: {
        unique_id: id,
        resource_type: "model",
        name: `node_${i}`,
        package_name: "pkg",
      },
      parents: i === 0 ? [] : [i - 1],
      children: i === count - 1 ? [] : [i + 1],
    });
  }
  return nodes;
}

function chainRunResults(count: number) {
  const results: Array<{
    unique_id: string;
    status: string;
    execution_time: number;
    thread_id: string;
    timing: [];
  }> = [];
  for (let i = 0; i < count; i++) {
    results.push({
      unique_id: modelId(i),
      status: "success",
      execution_time: 0.001,
      thread_id: "Thread-1",
      timing: [],
    });
  }
  return parseRunResults({
    metadata: {
      dbt_schema_version: "https://schemas.getdbt.com/dbt/run-results/v6.json",
    },
    elapsed_time: count * 0.001,
    results,
  } as Record<string, unknown>);
}

const resolvedOptions: ResolvedOptions = {
  resourceTypes: ["model"],
  includeExecution: true,
  topN: 10,
  maxExactStructuralNodes: 5000,
  thresholds: {
    highScore: 70,
    moderateScore: 45,
    highFanIn: 4,
    criticalSlackMs: 1,
  },
};

describe("graph-risk-execution", () => {
  it("computes project duration over large earliestFinish without spread crashes", () => {
    const count = 20_000;
    const nodes = createChainNodes(count);
    const topoOrder = nodes.map((n) => n.index);
    const blastRadius = new Array<number>(count).fill(0);
    const pathConc = new Array<number>(count).fill(0);
    const runResults = chainRunResults(count);

    const result = computeExecutionAnalysis(
      nodes,
      topoOrder,
      resolvedOptions,
      runResults,
      blastRadius,
      pathConc,
    );

    expect(result.executionCoveragePct).toBe(100);
    const last = count - 1;
    expect(result.durations[last]).toBe(1);
    expect(result.criticalPath[last]).toBe(true);
  });
});
