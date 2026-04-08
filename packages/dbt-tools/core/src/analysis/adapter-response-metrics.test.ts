import { describe, expect, it } from "vitest";
import {
  adapterMetricsHasData,
  buildAdapterTotals,
  coerceAdapterResponseInput,
  extractAdapterResponseFields,
  isAdapterResponseObject,
  normalizeAdapterResponse,
  normalizeAdapterResponseWithContext,
} from "./adapter-response-metrics";

describe("normalizeAdapterResponse generic fallback", () => {
  it("returns empty rawKeys for null and non-objects", () => {
    expect(normalizeAdapterResponse(null).rawKeys).toEqual([]);
    expect(normalizeAdapterResponse(undefined).rawKeys).toEqual([]);
    expect(normalizeAdapterResponse("x").rawKeys).toEqual([]);
    expect(normalizeAdapterResponse([]).rawKeys).toEqual([]);
  });

  it("normalizes stringified JSON after coercion", () => {
    const raw = coerceAdapterResponseInput(
      JSON.stringify({ rows_affected: 3, _message: "OK" }),
    );
    const m = normalizeAdapterResponse(raw);
    expect(m.rowsAffected).toBe(3);
    expect(m.adapterMessage).toBe("OK");
  });

  it("treats empty object as no normalized fields but lists rawKeys", () => {
    const m = normalizeAdapterResponse({});
    expect(m.rawKeys).toEqual([]);
    expect(adapterMetricsHasData(m)).toBe(false);
  });
});

describe("normalizeAdapterResponseWithContext adapter parsers", () => {
  it("normalizes BigQuery response including job_id fallback for queryId", () => {
    const m = normalizeAdapterResponseWithContext(
      {
        _message: "CREATE VIEW (0 processed)",
        code: "CREATE VIEW",
        bytes_processed: 100,
        bytes_billed: 200,
        location: "us-central1",
        project_id: "your-project",
        job_id: "job-123",
        slot_ms: 77,
      },
      { adapterType: "bigquery" },
    );

    expect(m.bytesProcessed).toBe(100);
    expect(m.bytesBilled).toBe(200);
    expect(m.slotMs).toBe(77);
    expect(m.adapterCode).toBe("CREATE VIEW");
    expect(m.adapterMessage).toBe("CREATE VIEW (0 processed)");
    expect(m.queryId).toBe("job-123");
    expect(m.projectId).toBe("your-project");
    expect(m.location).toBe("us-central1");
  });

  it("normalizes Snowflake base fields plus DML detail", () => {
    const m = normalizeAdapterResponseWithContext(
      {
        _message: "SUCCESS 4",
        rows_affected: 4,
        code: "SUCCESS",
        query_id: "sfqid-1",
        rows_inserted: 3,
        rows_deleted: 1,
        rows_updated: 0,
        rows_duplicates: 2,
      },
      { adapterType: "snowflake" },
    );

    expect(m.rowsAffected).toBe(4);
    expect(m.queryId).toBe("sfqid-1");
    expect(m.rowsInserted).toBe(3);
    expect(m.rowsDeleted).toBe(1);
    expect(m.rowsUpdated).toBe(0);
    expect(m.rowsDuplicates).toBe(2);
  });

  it("normalizes Athena data_scanned_in_bytes as bytesProcessed", () => {
    const m = normalizeAdapterResponseWithContext(
      {
        _message: "OK 5",
        code: "OK",
        rows_affected: 5,
        data_scanned_in_bytes: 12345,
      },
      { adapterType: "athena" },
    );

    expect(m.bytesProcessed).toBe(12345);
    expect(m.rowsAffected).toBe(5);
    expect(m.adapterCode).toBe("OK");
    expect(m.adapterMessage).toBe("OK 5");
  });

  it("normalizes Postgres base response", () => {
    const m = normalizeAdapterResponseWithContext(
      {
        _message: "INSERT 0 3",
        code: "INSERT",
        rows_affected: 3,
      },
      { adapterType: "postgres" },
    );
    expect(m.rowsAffected).toBe(3);
    expect(m.adapterCode).toBe("INSERT");
    expect(m.adapterMessage).toBe("INSERT 0 3");
  });

  it("normalizes Redshift minimal response", () => {
    const m = normalizeAdapterResponseWithContext(
      {
        _message: "SUCCESS",
        rows_affected: 11,
      },
      { adapterType: "redshift" },
    );
    expect(m.rowsAffected).toBe(11);
    expect(m.adapterMessage).toBe("SUCCESS");
  });

  it("normalizes Spark minimal response", () => {
    const m = normalizeAdapterResponseWithContext(
      {
        _message: "OK",
      },
      { adapterType: "spark" },
    );
    expect(m.adapterMessage).toBe("OK");
    expect(m.rowsAffected).toBeUndefined();
  });
});

describe("adapter parser dispatch", () => {
  it("uses heuristic parsing when adapter type is missing", () => {
    const m = normalizeAdapterResponseWithContext(
      {
        data_scanned_in_bytes: 42,
      },
      {},
    );
    expect(m.bytesProcessed).toBe(42);
  });

  it("still yields useful metrics when adapter type is wrong", () => {
    const m = normalizeAdapterResponseWithContext(
      {
        bytes_processed: 55,
        job_id: "bq-job-1",
      },
      { adapterType: "snowflake" },
    );
    expect(m.bytesProcessed).toBe(55);
    expect(m.queryId).toBe("bq-job-1");
  });

  it("keeps empty objects safe even with adapter type context", () => {
    const m = normalizeAdapterResponseWithContext(
      {},
      { adapterType: "athena" },
    );
    expect(m).toEqual({ rawKeys: [] });
  });
});

describe("coerceAdapterResponseInput", () => {
  it("parses JSON object strings into plain objects", () => {
    const raw = JSON.stringify({ job_id: "abc", bytes_processed: 9 });
    expect(coerceAdapterResponseInput(raw)).toEqual({
      job_id: "abc",
      bytes_processed: 9,
    });
  });

  it("returns primitive strings that are not JSON objects unchanged", () => {
    expect(coerceAdapterResponseInput("not-json")).toBe("not-json");
  });

  it("treats empty trimmed string as null", () => {
    expect(coerceAdapterResponseInput("  ")).toBeNull();
  });
});

describe("extractAdapterResponseFields", () => {
  it("returns no fields for null and non-objects", () => {
    expect(extractAdapterResponseFields(null)).toEqual([]);
    expect(extractAdapterResponseFields("x")).toEqual([]);
    expect(extractAdapterResponseFields([])).toEqual([]);
    expect(isAdapterResponseObject(null)).toBe(false);
  });

  it("preserves arbitrary scalar keys from unknown warehouses", () => {
    const fields = extractAdapterResponseFields({
      custom_metric: 12,
      warehouse_name: "duckdb",
      uses_cache: true,
    });
    expect(fields.map((field) => field.key)).toEqual([
      "custom_metric",
      "uses_cache",
      "warehouse_name",
    ]);
    expect(fields[0]).toMatchObject({
      key: "custom_metric",
      kind: "number",
      displayValue: "12",
      sortValue: 12,
      isScalar: true,
    });
  });

  it("flattens shallow objects and stringifies deep values", () => {
    const fields = extractAdapterResponseFields({
      stats: {
        rows: 4,
        meta: { phase: "scan" },
      },
      batches: [1, 2, { ok: true }],
    });
    expect(fields.map((field) => field.key)).toEqual([
      "batches",
      "stats.meta",
      "stats.rows",
    ]);
    expect(fields[1]).toMatchObject({
      key: "stats.meta",
      kind: "object",
      displayValue: '{"phase":scan}',
      isScalar: false,
    });
    expect(fields[2]).toMatchObject({
      key: "stats.rows",
      kind: "number",
      sortValue: 4,
      isScalar: true,
    });
  });

  it("preserves empty objects as valid empty payloads", () => {
    expect(isAdapterResponseObject({})).toBe(true);
    expect(extractAdapterResponseFields({})).toEqual([]);
  });
});

describe("buildAdapterTotals", () => {
  it("returns undefined when no rows have data", () => {
    expect(buildAdapterTotals([undefined, { rawKeys: [] }])).toBeUndefined();
  });

  it("sums metrics across rows", () => {
    const a = normalizeAdapterResponse({ bytes_processed: 100, slot_ms: 10 });
    const b = normalizeAdapterResponse({
      bytes_processed: 50,
      rows_affected: 3,
    });
    const t = buildAdapterTotals([a, b]);
    expect(t?.nodesWithAdapterData).toBe(2);
    expect(t?.totalBytesProcessed).toBe(150);
    expect(t?.totalSlotMs).toBe(10);
    expect(t?.totalRowsAffected).toBe(3);
  });
});
