import { describe, it, expect } from "vitest";
import {
  buildStatusBreakdownForRows,
  buildThreadStatsForRows,
  buildOverviewDerivedState,
} from "./overviewState";
import type { AnalysisState, ExecutionRow } from "@web/types";

function makeExecution(
  overrides: Partial<ExecutionRow> & Pick<ExecutionRow, "uniqueId">,
): ExecutionRow {
  return {
    name: "m",
    resourceType: "model",
    packageName: "p",
    path: null,
    status: "success",
    statusTone: "positive",
    executionTime: 1,
    threadId: "t1",
    start: null,
    end: null,
    ...overrides,
  };
}

describe("buildStatusBreakdownForRows", () => {
  it("returns empty for no rows", () => {
    expect(buildStatusBreakdownForRows([])).toHaveLength(0);
  });

  it("aggregates by status", () => {
    const rows = [
      makeExecution({ uniqueId: "a", status: "ok", statusTone: "positive" }),
      makeExecution({ uniqueId: "b", status: "ok", statusTone: "positive" }),
      makeExecution({
        uniqueId: "c",
        status: "fail",
        statusTone: "danger",
        executionTime: 5,
      }),
    ];
    const breakdown = buildStatusBreakdownForRows(rows);
    expect(breakdown.find((b) => b.status === "ok")?.count).toBe(2);
    expect(breakdown.find((b) => b.status === "fail")?.count).toBe(1);
  });
});

describe("buildThreadStatsForRows", () => {
  it("groups by threadId", () => {
    const rows = [
      makeExecution({ uniqueId: "a", threadId: "t1", executionTime: 2 }),
      makeExecution({ uniqueId: "b", threadId: "t1", executionTime: 3 }),
      makeExecution({ uniqueId: "c", threadId: "t2", executionTime: 1 }),
    ];
    const stats = buildThreadStatsForRows(rows);
    const t1 = stats.find((s) => s.threadId === "t1");
    expect(t1?.count).toBe(2);
    expect(t1?.totalExecutionTime).toBe(5);
  });
});

describe("buildOverviewDerivedState", () => {
  it("applies status filter", () => {
    const analysis = {
      executions: [
        makeExecution({ uniqueId: "a", statusTone: "positive" }),
        makeExecution({
          uniqueId: "b",
          statusTone: "danger",
          resourceType: "model",
        }),
      ],
    } as AnalysisState;
    const state = buildOverviewDerivedState(analysis, {
      status: "danger",
      resourceTypes: new Set(),
      query: "",
    });
    expect(state.filteredExecutions).toHaveLength(1);
    expect(state.filteredExecutions[0]?.uniqueId).toBe("b");
    expect(state.failingNodes).toBe(1);
  });

  it("applies resource type filter", () => {
    const analysis = {
      executions: [
        makeExecution({ uniqueId: "a", resourceType: "model" }),
        makeExecution({
          uniqueId: "b",
          resourceType: "test",
          statusTone: "positive",
        }),
      ],
    } as AnalysisState;
    const state = buildOverviewDerivedState(analysis, {
      status: "all",
      resourceTypes: new Set(["test"]),
      query: "",
    });
    expect(state.filteredExecutions).toHaveLength(1);
    expect(state.filteredExecutions[0]?.resourceType).toBe("test");
  });

  it("default filters include all rows", () => {
    const analysis = {
      executions: [
        makeExecution({ uniqueId: "a" }),
        makeExecution({ uniqueId: "b", statusTone: "warning" }),
      ],
    } as AnalysisState;
    const state = buildOverviewDerivedState(analysis, {
      status: "all",
      resourceTypes: new Set(),
      query: "",
    });
    expect(state.filteredExecutions).toHaveLength(2);
    expect(state.warningNodes).toBe(1);
  });
});
