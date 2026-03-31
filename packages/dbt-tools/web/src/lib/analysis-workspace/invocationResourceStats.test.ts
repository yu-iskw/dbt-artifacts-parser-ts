import { describe, it, expect } from "vitest";
import { buildInvocationResourceComparison } from "./invocationResourceStats";
import type { AnalysisState } from "@web/types";

function minimalAnalysis(
  overrides: Partial<AnalysisState> & Pick<AnalysisState, "graphSummary">,
): AnalysisState {
  return {
    summary: {
      total_execution_time: 0,
      total_nodes: 0,
      nodes_by_status: {},
    },
    projectName: "pkg",
    warehouseType: null,
    runStartedAt: null,
    ganttData: [],
    bottlenecks: undefined,
    graphSummary: overrides.graphSummary,
    resources: [],
    resourceGroups: [],
    executions: [],
    statusBreakdown: [],
    threadStats: [],
    dependencyIndex: {},
    timelineAdjacency: {},
    selectedResourceId: null,
    invocationId: null,
    ...overrides,
  };
}

describe("buildInvocationResourceComparison", () => {
  it("counts graph, run, and timeline per type with package filter on executions", () => {
    const analysis = minimalAnalysis({
      graphSummary: {
        totalNodes: 10,
        totalEdges: 0,
        hasCycles: false,
        nodesByType: { model: 5, source: 3, seed: 1 },
      },
      executions: [
        {
          uniqueId: "model.pkg.a",
          name: "a",
          resourceType: "model",
          packageName: "pkg",
          path: null,
          status: "success",
          statusTone: "positive",
          executionTime: 1,
          threadId: null,
          start: 0,
          end: 1,
        },
        {
          uniqueId: "model.other.b",
          name: "b",
          resourceType: "model",
          packageName: "other",
          path: null,
          status: "success",
          statusTone: "positive",
          executionTime: 1,
          threadId: null,
          start: 0,
          end: 1,
        },
      ],
      ganttData: [
        {
          unique_id: "model.pkg.a",
          name: "a",
          start: 0,
          end: 1,
          duration: 1,
          status: "success",
          resourceType: "model",
          packageName: "pkg",
          path: null,
          parentId: null,
          compileStart: null,
          compileEnd: null,
          executeStart: null,
          executeEnd: null,
          materialized: null,
        },
      ],
    });

    const rows = buildInvocationResourceComparison(analysis, "pkg");
    const model = rows.find((r) => r.resourceType === "model");
    const source = rows.find((r) => r.resourceType === "source");

    expect(model).toEqual({
      resourceType: "model",
      graphCount: 5,
      runCount: 1,
      timelineCount: 1,
    });
    expect(source).toMatchObject({
      resourceType: "source",
      graphCount: 3,
      runCount: 0,
      timelineCount: 0,
    });
  });

  it("includes pinned types when other columns are zero", () => {
    const analysis = minimalAnalysis({
      graphSummary: {
        totalNodes: 1,
        totalEdges: 0,
        hasCycles: false,
        nodesByType: { model: 1 },
      },
    });
    const rows = buildInvocationResourceComparison(analysis, null);
    expect(rows.some((r) => r.resourceType === "source")).toBe(true);
    expect(rows.some((r) => r.resourceType === "seed")).toBe(true);
  });
});
