import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { getTestResourcePath } from "dbt-artifacts-parser/test-utils";
import {
  timelineAction,
  formatTimeline,
  formatTimelineCsv,
} from "./timeline-action";

describe("timelineAction", () => {
  const runResultsPath = getTestResourcePath(
    "run_results",
    "v6",
    "resources",
    "jaffle_shop",
    "run_results.json",
  );
  const manifestPath = getTestResourcePath(
    "manifest",
    "v12",
    "resources",
    "jaffle_shop",
    "manifest_1.10.json",
  );

  const handleError = (error: unknown) => {
    throw error;
  };
  const isTTY = () => false;

  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("outputs JSON timeline with required fields", () => {
    timelineAction(
      runResultsPath,
      undefined,
      { json: true },
      handleError,
      isTTY,
    );

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      total: number;
      entries: Array<{
        unique_id: string;
        status: string;
        execution_time: number;
      }>;
    };
    expect(parsed).toHaveProperty("total");
    expect(parsed).toHaveProperty("entries");
    expect(parsed.total).toBeGreaterThan(0);

    const first = parsed.entries[0];
    expect(first).toHaveProperty("unique_id");
    expect(first).toHaveProperty("status");
    expect(first).toHaveProperty("execution_time");
  });

  it("is sorted by duration descending by default", () => {
    timelineAction(
      runResultsPath,
      undefined,
      { json: true },
      handleError,
      isTTY,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      entries: Array<{ execution_time: number }>;
    };
    const times = parsed.entries.map((e) => e.execution_time);
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeLessThanOrEqual(times[i - 1]);
    }
  });

  it("respects --top option", () => {
    timelineAction(
      runResultsPath,
      undefined,
      { top: 3, json: true },
      handleError,
      isTTY,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as { entries: unknown[] };
    expect(parsed.entries.length).toBeLessThanOrEqual(3);
  });

  it("enriches entries with name and type when manifest is provided", () => {
    timelineAction(
      runResultsPath,
      manifestPath,
      { json: true },
      handleError,
      isTTY,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      entries: Array<{ name?: string; resource_type?: string }>;
    };
    const enriched = parsed.entries.filter((e) => e.name !== undefined);
    expect(enriched.length).toBeGreaterThan(0);
  });

  it("filters by --failed-only", () => {
    timelineAction(
      runResultsPath,
      undefined,
      { failedOnly: true, json: true },
      handleError,
      isTTY,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      entries: Array<{ status: string }>;
    };
    expect(
      parsed.entries.every(
        (e) => e.status !== "success" && e.status !== "pass",
      ),
    ).toBe(true);
  });

  it("outputs human-readable table in TTY mode", () => {
    timelineAction(
      runResultsPath,
      undefined,
      { noJson: true },
      handleError,
      () => true,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    expect(output).toContain("dbt Execution Timeline");
    expect(output).toContain("Status");
  });

  it("outputs CSV when --format csv", () => {
    timelineAction(
      runResultsPath,
      undefined,
      { format: "csv" },
      handleError,
      isTTY,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    expect(output).toContain(
      "unique_id,name,resource_type,status,execution_time",
    );
    const lines = output.split("\n");
    expect(lines.length).toBeGreaterThan(1);
  });

  it("throws for invalid sort option", () => {
    expect(() =>
      timelineAction(
        runResultsPath,
        undefined,
        { sort: "invalid_sort" },
        handleError,
        isTTY,
      ),
    ).toThrow(/--sort must be one of/);
  });

  it("throws when run_results not found", () => {
    expect(() =>
      timelineAction(
        "/nonexistent/run_results.json",
        undefined,
        {},
        handleError,
        isTTY,
      ),
    ).toThrow(/not found/);
  });
});

describe("formatTimeline", () => {
  it("formats empty result gracefully", () => {
    const result = { total: 0, entries: [] };
    const output = formatTimeline(result);
    expect(output).toContain("dbt Execution Timeline");
    expect(output).toContain("Total entries: 0");
    expect(output).toContain("(no matching executions)");
  });

  it("includes all entries in table rows", () => {
    const result = {
      total: 2,
      entries: [
        {
          unique_id: "model.p.a",
          status: "success",
          execution_time: 1.5,
        },
        {
          unique_id: "model.p.b",
          status: "error",
          execution_time: 0.3,
        },
      ],
    };
    const output = formatTimeline(result);
    expect(output).toContain("model.p.a");
    expect(output).toContain("model.p.b");
    expect(output).toContain("success");
    expect(output).toContain("error");
  });
});

describe("formatTimelineCsv", () => {
  it("generates CSV with header and rows", () => {
    const entries = [
      {
        unique_id: "model.p.a",
        status: "success",
        execution_time: 1.5,
      },
    ];
    const csv = formatTimelineCsv(entries);
    expect(csv).toContain("unique_id,name,resource_type");
    expect(csv).toContain("model.p.a");
    expect(csv).toContain("success");
  });

  it("escapes commas in values", () => {
    const entries = [
      {
        unique_id: "model.p.a",
        status: "success",
        execution_time: 1.0,
        message: "completed, with info",
      },
    ];
    const csv = formatTimelineCsv(entries);
    expect(csv).toContain('"completed, with info"');
  });
});
