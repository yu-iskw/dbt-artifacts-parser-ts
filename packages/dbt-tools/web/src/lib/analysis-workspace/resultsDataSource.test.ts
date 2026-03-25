import { describe, expect, it } from "vitest";
import type { ExecutionRow } from "@web/types";
import {
  createRunsResultsIndex,
  filterRunsResultsIndex,
  queryRunsResultsIndex,
} from "./resultsDataSource";

function makeExecution(
  overrides: Partial<ExecutionRow> & Pick<ExecutionRow, "uniqueId">,
): ExecutionRow {
  return {
    uniqueId: overrides.uniqueId,
    name: overrides.name ?? overrides.uniqueId,
    resourceType: overrides.resourceType ?? "model",
    packageName: overrides.packageName ?? "jaffle_shop",
    path: overrides.path ?? `models/${overrides.uniqueId}.sql`,
    status: overrides.status ?? "Success",
    statusTone: overrides.statusTone ?? "positive",
    executionTime: overrides.executionTime ?? 1,
    threadId: overrides.threadId ?? "Thread-1",
    start: null,
    end: null,
  };
}

describe("createRunsResultsIndex", () => {
  it("partitions rows into model and test tabs", () => {
    const index = createRunsResultsIndex([
      makeExecution({ uniqueId: "orders", resourceType: "model" }),
      makeExecution({ uniqueId: "not_null_orders", resourceType: "test" }),
    ]);

    expect(index.entries).toHaveLength(2);
    expect(index.summary.facets.models).toBe(1);
    expect(index.summary.facets.tests).toBe(1);
    expect(index.summary.status.all).toBe(2);
  });
});

describe("filterRunsResultsIndex", () => {
  it("filters against the full corpus by status and query", () => {
    const index = createRunsResultsIndex([
      makeExecution({ uniqueId: "orders", resourceType: "model" }),
      makeExecution({
        uniqueId: "customers",
        resourceType: "model",
        statusTone: "danger",
        status: "Error",
      }),
      makeExecution({ uniqueId: "not_null_orders", resourceType: "test" }),
    ]);

    const matches = filterRunsResultsIndex(index, {
      kind: "models",
      status: "danger",
      query: "cust",
      resourceTypes: [],
      threadIds: [],
      durationBand: "all",
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]?.row.uniqueId).toBe("customers");
  });
});

describe("queryRunsResultsIndex", () => {
  it("returns only the requested initial reveal slice", () => {
    const index = createRunsResultsIndex(
      Array.from({ length: 140 }, (_, idx) =>
        makeExecution({ uniqueId: `model_${idx}`, resourceType: "model" }),
      ),
    );

    const result = queryRunsResultsIndex(index, {
      kind: "models",
      status: "all",
      query: "",
      resourceTypes: [],
      threadIds: [],
      durationBand: "all",
      sortBy: "attention",
      limit: 100,
    });

    expect(result.summary.status.all).toBe(140);
    expect(result.totalMatches).toBe(140);
    expect(result.rows).toHaveLength(100);
    expect(result.rows[0]?.uniqueId).toBe("model_0");
    expect(result.rows[99]?.uniqueId).toBe("model_99");
  });
});
