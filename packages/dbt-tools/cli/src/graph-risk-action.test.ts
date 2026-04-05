import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTestResourcePath } from "dbt-artifacts-parser/test-utils";
import { graphRiskAction } from "./graph-risk-action";

describe("graphRiskAction", () => {
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

  it("outputs manifest-only JSON report", () => {
    const manifestPath = getTestResourcePath(
      "manifest",
      "v12",
      "resources",
      "jaffle_shop",
      "manifest_1.10.json",
    );

    graphRiskAction(manifestPath, { json: true }, handleError, isTTY);

    const output = consoleLogSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed).toHaveProperty("totalNodes");
    expect(parsed).toHaveProperty("analyzedNodes");
    expect(parsed).toHaveProperty("topBottlenecks");
    expect(parsed).toHaveProperty("selected_metric", "overallRiskScore");
    expect(parsed).toHaveProperty("top_by_metric");
    expect(parsed).not.toHaveProperty("executionCoveragePct");
  });

  it("outputs execution-aware JSON report when run_results is supplied", () => {
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

    graphRiskAction(
      manifestPath,
      { runResults: runResultsPath, json: true, top: 5 },
      handleError,
      isTTY,
    );

    const output = consoleLogSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed).toHaveProperty("executionCoveragePct");
    expect(parsed).toHaveProperty("top_by_metric");
    expect((parsed.top_by_metric as unknown[]).length).toBeLessThanOrEqual(5);
  });

  it("formats human-readable output with all ranking sections", () => {
    const manifestPath = getTestResourcePath(
      "manifest",
      "v12",
      "resources",
      "jaffle_shop",
      "manifest_1.10.json",
    );

    graphRiskAction(
      manifestPath,
      { json: false, noJson: true, top: 3 },
      handleError,
      isTTY,
    );

    const output = consoleLogSpy.mock.calls[0]?.[0] as string;
    expect(output).toContain("dbt Graph Risk Report");
    expect(output).toContain("Top overall risk nodes:");
    expect(output).toContain("Top bottlenecks:");
    expect(output).toContain("Top fragile nodes:");
    expect(output).toContain("Top blast-radius nodes:");
  });

  it("supports custom ranking metric and resource type filters", () => {
    const manifestPath = getTestResourcePath(
      "manifest",
      "v12",
      "resources",
      "jaffle_shop",
      "manifest_1.10.json",
    );

    graphRiskAction(
      manifestPath,
      {
        json: true,
        metric: "blastRadiusScore",
        resourceTypes: ["model", "source"],
      },
      handleError,
      isTTY,
    );

    const output = consoleLogSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed).toHaveProperty("selected_metric", "blastRadiusScore");
    expect(parsed).toHaveProperty("resourceTypes");
    expect(parsed.resourceTypes).toEqual(["model", "source"]);
  });
});
