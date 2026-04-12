/**
 * Tests for run-report-action.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getTestResourcePath } from "dbt-artifacts-parser/test-utils";
import { runReportAction } from "./run-report-action";

describe("runReportAction", () => {
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

  it("outputs minimal execution summary without manifest when only run_results provided", async () => {
    const runResultsPath = getTestResourcePath(
      "run_results",
      "v6",
      "resources",
      "jaffle_shop",
      "run_results.json",
    );

    await runReportAction(
      runResultsPath,
      undefined,
      { json: true },
      handleError,
      isTTY,
    );

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed).toHaveProperty("total_execution_time");
    expect(parsed).toHaveProperty("total_nodes");
    expect(parsed).toHaveProperty("nodes_by_status");
    expect(parsed).toHaveProperty("node_executions");
    expect(Array.isArray(parsed.node_executions)).toBe(true);
    expect((parsed.node_executions as unknown[]).length).toBeGreaterThan(0);
  });

  it("outputs execution summary with manifest and run_results fixtures", async () => {
    const manifestPath = getTestResourcePath(
      "manifest",
      "v12",
      "resources",
      "jaffle_shop",
      "manifest_1.10.json",
    );
    const runResultsPath = getTestResourcePath(
      "run_results",
      "v6",
      "resources",
      "jaffle_shop",
      "run_results.json",
    );

    await runReportAction(runResultsPath, manifestPath, {}, handleError, isTTY);

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0][0] as string;
    expect(output).toContain("total_execution_time");
    expect(output).toContain("nodes_by_status");
    expect(output).toContain("node_executions");
  });

  it("outputs JSON when json option is set", async () => {
    const manifestPath = getTestResourcePath(
      "manifest",
      "v12",
      "resources",
      "jaffle_shop",
      "manifest_1.10.json",
    );
    const runResultsPath = getTestResourcePath(
      "run_results",
      "v6",
      "resources",
      "jaffle_shop",
      "run_results.json",
    );

    await runReportAction(
      runResultsPath,
      manifestPath,
      { json: true },
      handleError,
      isTTY,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed).toHaveProperty("total_execution_time");
    expect(parsed).toHaveProperty("total_nodes");
    expect(parsed).toHaveProperty("nodes_by_status");
    expect(parsed).toHaveProperty("node_executions");
  });

  it("includes bottlenecks when --bottlenecks option is set", async () => {
    const manifestPath = getTestResourcePath(
      "manifest",
      "v12",
      "resources",
      "jaffle_shop",
      "manifest_1.10.json",
    );
    const runResultsPath = getTestResourcePath(
      "run_results",
      "v6",
      "resources",
      "jaffle_shop",
      "run_results.json",
    );

    await runReportAction(
      runResultsPath,
      manifestPath,
      { bottlenecks: true, json: true },
      handleError,
      isTTY,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed).toHaveProperty("bottlenecks");
    const bottlenecks = parsed.bottlenecks as {
      nodes: Array<{ unique_id: string; execution_time: number }>;
    };
    expect(bottlenecks.nodes.length).toBeGreaterThan(0);
    expect(bottlenecks.nodes[0]).toHaveProperty("unique_id");
    expect(bottlenecks.nodes[0]).toHaveProperty("execution_time");
  });

  it("includes adapter_totals in JSON when --adapter-summary", async () => {
    const manifestPath = getTestResourcePath(
      "manifest",
      "v12",
      "resources",
      "jaffle_shop",
      "manifest_1.10.json",
    );
    const runResultsPath = getTestResourcePath(
      "run_results",
      "v6",
      "resources",
      "jaffle_shop",
      "run_results.json",
    );

    await runReportAction(
      runResultsPath,
      manifestPath,
      { adapterSummary: true, json: true },
      handleError,
      isTTY,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed).toHaveProperty("adapter_totals");
    const totals = parsed.adapter_totals as { nodesWithAdapterData: number };
    expect(totals.nodesWithAdapterData).toBeGreaterThan(0);
  });

  it("includes adapter_top in JSON when --adapter-top-by", async () => {
    const manifestPath = getTestResourcePath(
      "manifest",
      "v12",
      "resources",
      "jaffle_shop",
      "manifest_1.10.json",
    );
    const runResultsPath = getTestResourcePath(
      "run_results",
      "v6",
      "resources",
      "jaffle_shop",
      "run_results.json",
    );

    await runReportAction(
      runResultsPath,
      manifestPath,
      {
        adapterTopBy: "rows_affected",
        adapterTopN: 3,
        json: true,
      },
      handleError,
      isTTY,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed).toHaveProperty("adapter_top");
    const top = parsed.adapter_top as {
      nodes: Array<{ metric_value: number }>;
    };
    expect(top.nodes.length).toBeGreaterThan(0);
  });

  it("renders human adapter sections when adapter summary is enabled", async () => {
    const manifestPath = getTestResourcePath(
      "manifest",
      "v12",
      "resources",
      "jaffle_shop",
      "manifest_1.10.json",
    );
    const runResultsPath = getTestResourcePath(
      "run_results",
      "v6",
      "resources",
      "jaffle_shop",
      "run_results.json",
    );

    await runReportAction(
      runResultsPath,
      manifestPath,
      { adapterSummary: true, noJson: true },
      handleError,
      () => true,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    expect(output).toContain(
      "Adapter metrics (from run_results adapter_response):",
    );
    expect(output).toContain("Adapter-aware nodes:");
  });
});
