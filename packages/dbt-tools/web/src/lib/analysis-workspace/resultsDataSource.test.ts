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
    ...overrides,
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

  it("counts issues facet as danger plus warning rows", () => {
    const index = createRunsResultsIndex([
      makeExecution({ uniqueId: "a", statusTone: "positive" }),
      makeExecution({ uniqueId: "b", statusTone: "danger" }),
      makeExecution({ uniqueId: "c", statusTone: "warning" }),
    ]);
    expect(index.summary.facets.issues).toBe(2);
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

  it("issues status matches danger and warning rows", () => {
    const index = createRunsResultsIndex([
      makeExecution({ uniqueId: "ok", statusTone: "positive" }),
      makeExecution({
        uniqueId: "bad",
        statusTone: "danger",
        status: "error",
      }),
      makeExecution({
        uniqueId: "warned",
        statusTone: "warning",
        status: "warn",
      }),
    ]);

    const matches = filterRunsResultsIndex(index, {
      kind: "all",
      status: "issues",
      query: "",
      resourceTypes: [],
      threadIds: [],
      durationBand: "all",
    });

    expect(matches.map((m) => m.row.uniqueId).sort()).toEqual([
      "bad",
      "warned",
    ]);
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

  it("sorts adapter-backed numeric columns descending with missing values last", () => {
    const index = createRunsResultsIndex([
      makeExecution({
        uniqueId: "model_a",
        adapterResponseFields: [
          {
            key: "warehouse.bytes_processed",
            label: "warehouse.bytes_processed",
            kind: "number",
            displayValue: "20",
            isScalar: true,
            sortValue: 20,
          },
        ],
      }),
      makeExecution({
        uniqueId: "model_b",
        adapterResponseFields: [
          {
            key: "warehouse.bytes_processed",
            label: "warehouse.bytes_processed",
            kind: "number",
            displayValue: "200",
            isScalar: true,
            sortValue: 200,
          },
        ],
      }),
      makeExecution({
        uniqueId: "model_c",
        adapterResponseFields: [],
      }),
    ]);

    const result = queryRunsResultsIndex(index, {
      kind: "all",
      status: "all",
      query: "",
      resourceTypes: [],
      threadIds: [],
      durationBand: "all",
      sortBy: "adapter:warehouse.bytes_processed",
      limit: 20,
    });

    expect(result.rows.map((row) => row.uniqueId)).toEqual([
      "model_b",
      "model_a",
      "model_c",
    ]);
  });

  it("sorts adapter-backed text columns ascending with missing values last", () => {
    const index = createRunsResultsIndex([
      makeExecution({
        uniqueId: "model_a",
        adapterResponseFields: [
          {
            key: "warehouse.job_id",
            label: "warehouse.job_id",
            kind: "string",
            displayValue: "job-20",
            isScalar: true,
            sortValue: "job-20",
          },
        ],
      }),
      makeExecution({
        uniqueId: "model_b",
        adapterResponseFields: [
          {
            key: "warehouse.job_id",
            label: "warehouse.job_id",
            kind: "string",
            displayValue: "job-3",
            isScalar: true,
            sortValue: "job-3",
          },
        ],
      }),
      makeExecution({
        uniqueId: "model_c",
        adapterResponseFields: [],
      }),
    ]);

    const result = queryRunsResultsIndex(index, {
      kind: "all",
      status: "all",
      query: "",
      resourceTypes: [],
      threadIds: [],
      durationBand: "all",
      sortBy: "adapter:warehouse.job_id",
      limit: 20,
    });

    expect(result.rows.map((row) => row.uniqueId)).toEqual([
      "model_b",
      "model_a",
      "model_c",
    ]);
  });

  it("indexes adapter field keys and values in search text", () => {
    const index = createRunsResultsIndex([
      makeExecution({
        uniqueId: "duck_model",
        adapterResponseFields: [
          {
            key: "profiling.stage",
            label: "profiling.stage",
            kind: "string",
            displayValue: "scan",
            isScalar: true,
            sortValue: "scan",
          },
        ],
      }),
    ]);

    const matches = filterRunsResultsIndex(index, {
      kind: "all",
      status: "all",
      query: "profiling.stage scan",
      resourceTypes: [],
      threadIds: [],
      durationBand: "all",
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]?.row.uniqueId).toBe("duck_model");
  });
});
