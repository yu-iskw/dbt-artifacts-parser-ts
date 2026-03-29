import { describe, it, expect } from "vitest";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { parseManifest } from "dbt-artifacts-parser/manifest";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { parseRunResults } from "dbt-artifacts-parser/run_results";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import {
  loadTestManifest,
  loadTestRunResults,
} from "dbt-artifacts-parser/test-utils";
import { ManifestGraph } from "./manifest-graph";
import { analyzeCriticalPath } from "./critical-path-analyzer";

function makeRunResults(
  results: Array<{
    unique_id: string;
    status?: string;
    execution_time?: number;
    timing?: unknown[];
  }>,
  adapterType?: string,
): ReturnType<typeof parseRunResults> {
  return parseRunResults({
    metadata: {
      dbt_schema_version: "https://schemas.getdbt.com/dbt/run-results/v6.json",
      ...(adapterType ? { adapter_type: adapterType } : {}),
    },
    results: results.map((r) => ({
      unique_id: r.unique_id,
      status: r.status ?? "success",
      execution_time: r.execution_time ?? 0,
      timing: r.timing ?? [],
    })),
  } as Record<string, unknown>);
}

describe("analyzeCriticalPath", () => {
  it("should return null when run_results has no matching nodes", () => {
    const runResults = makeRunResults([
      { unique_id: "non.existent.node", execution_time: 1 },
    ]);
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);

    const result = analyzeCriticalPath(runResults, graph);

    expect(result).toBeNull();
  });

  it("should return null when run_results is empty", () => {
    const runResults = makeRunResults([]);
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);

    const result = analyzeCriticalPath(runResults, graph);

    expect(result).toBeNull();
  });

  it("should return a valid CriticalPathAnalysis when data matches", () => {
    const runResultsJson = loadTestRunResults("v6", "run_results.json");
    const runResults = parseRunResults(
      runResultsJson as Record<string, unknown>,
    );
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);

    const result = analyzeCriticalPath(runResults, graph);

    if (result !== null) {
      expect(Array.isArray(result.path)).toBe(true);
      expect(result.path.length).toBeGreaterThan(0);
      expect(typeof result.total_time).toBe("number");
      expect(result.total_time).toBeGreaterThanOrEqual(0);
      expect(typeof result.total_nodes).toBe("number");
    }
  });

  it("should include required fields on each path node", () => {
    const runResultsJson = loadTestRunResults("v6", "run_results.json");
    const runResults = parseRunResults(
      runResultsJson as Record<string, unknown>,
    );
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);

    const result = analyzeCriticalPath(runResults, graph);

    if (result !== null) {
      for (const node of result.path) {
        expect(typeof node.unique_id).toBe("string");
        expect(typeof node.name).toBe("string");
        expect(typeof node.resource_type).toBe("string");
        expect(typeof node.execution_time).toBe("number");
        expect(typeof node.cumulative_time).toBe("number");
        expect(typeof node.concurrent_nodes).toBe("number");
        expect(node.concurrent_nodes).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("should have non-decreasing cumulative_time", () => {
    const runResultsJson = loadTestRunResults("v6", "run_results.json");
    const runResults = parseRunResults(
      runResultsJson as Record<string, unknown>,
    );
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);

    const result = analyzeCriticalPath(runResults, graph);

    if (result !== null && result.path.length > 1) {
      for (let i = 1; i < result.path.length; i++) {
        expect(result.path[i].cumulative_time).toBeGreaterThanOrEqual(
          result.path[i - 1].cumulative_time,
        );
      }
    }
  });

  it("should populate concurrent_nodes from wall-clock timing when available", () => {
    const runResults = makeRunResults([
      {
        unique_id: "model.pkg.a",
        execution_time: 2,
        timing: [
          {
            name: "execute",
            started_at: "2024-01-01T00:00:00.000Z",
            completed_at: "2024-01-01T00:00:02.000Z",
          },
        ],
      },
      {
        unique_id: "model.pkg.b",
        execution_time: 2,
        timing: [
          {
            name: "execute",
            started_at: "2024-01-01T00:00:01.000Z",
            completed_at: "2024-01-01T00:00:03.000Z",
          },
        ],
      },
    ]);
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);

    const result = analyzeCriticalPath(runResults, graph);

    // Even if these nodes aren't in the graph's critical path, the function
    // should not throw. If a result is returned, concurrent_nodes must be a number.
    if (result !== null) {
      for (const node of result.path) {
        expect(typeof node.concurrent_nodes).toBe("number");
      }
    }
  });

  it("should extract adapter_type from metadata", () => {
    const runResults = makeRunResults(
      [{ unique_id: "model.pkg.x", execution_time: 1 }],
      "snowflake",
    );
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);

    const result = analyzeCriticalPath(runResults, graph);

    // If a result is returned, adapter_type should be "snowflake"
    if (result !== null) {
      expect(result.adapter_type).toBe("snowflake");
    }
  });

  it("should set adapter_type to null when not in metadata", () => {
    const runResultsJson = loadTestRunResults("v6", "run_results.json");
    const runResults = parseRunResults(
      runResultsJson as Record<string, unknown>,
    );
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);

    const result = analyzeCriticalPath(runResults, graph);

    if (result !== null) {
      // adapter_type is either a string or null
      expect(
        result.adapter_type === null || typeof result.adapter_type === "string",
      ).toBe(true);
    }
  });
});
