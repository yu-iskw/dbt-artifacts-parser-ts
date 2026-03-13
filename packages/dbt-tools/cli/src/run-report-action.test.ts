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

  it("outputs minimal execution summary without manifest when only run_results provided", () => {
    const runResultsPath = getTestResourcePath(
      "run_results",
      "v6",
      "resources",
      "jaffle_shop",
      "run_results.json",
    );

    runReportAction(
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
    expect((parsed.node_executions as unknown[]).length).toBe(0);
  });

  it("outputs execution summary with manifest and run_results fixtures", () => {
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

    runReportAction(runResultsPath, manifestPath, {}, handleError, isTTY);

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0][0] as string;
    expect(output).toContain("total_execution_time");
    expect(output).toContain("nodes_by_status");
    expect(output).toContain("node_executions");
  });

  it("outputs JSON when json option is set", () => {
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

    runReportAction(
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

  it("includes bottlenecks when --bottlenecks option is set", () => {
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

    runReportAction(
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
});
