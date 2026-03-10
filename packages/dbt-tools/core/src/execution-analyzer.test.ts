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
import { ExecutionAnalyzer } from "./execution-analyzer";

describe("ExecutionAnalyzer", () => {
  describe("constructor", () => {
    it("should create an analyzer with run_results and graph", () => {
      const runResultsJson = loadTestRunResults("v6", "run_results.json");
      const runResults = parseRunResults(
        runResultsJson as Record<string, unknown>,
      );

      const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const analyzer = new ExecutionAnalyzer(runResults, graph);
      expect(analyzer).toBeDefined();
    });
  });

  describe("getNodeExecutions", () => {
    it("should extract execution information for each node", () => {
      const runResultsJson = loadTestRunResults("v6", "run_results.json");
      const runResults = parseRunResults(
        runResultsJson as Record<string, unknown>,
      );

      const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const analyzer = new ExecutionAnalyzer(runResults, graph);
      const executions = analyzer.getNodeExecutions();

      expect(Array.isArray(executions)).toBe(true);
      expect(executions.length).toBeGreaterThan(0);

      // Verify structure of execution objects
      for (const exec of executions) {
        expect(exec.unique_id).toBeDefined();
        expect(exec.status).toBeDefined();
        expect(typeof exec.execution_time).toBe("number");
      }
    });

    it("should handle run_results with no results", () => {
      const runResultsJson = {
        metadata: {
          dbt_schema_version:
            "https://schemas.getdbt.com/dbt/run-results/v6.json",
        },
        results: [],
      };
      const runResults = parseRunResults(
        runResultsJson as Record<string, unknown>,
      );

      const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const analyzer = new ExecutionAnalyzer(runResults, graph);
      const executions = analyzer.getNodeExecutions();

      expect(executions).toEqual([]);
    });
  });

  describe("getSummary", () => {
    it("should generate execution summary with statistics", () => {
      const runResultsJson = loadTestRunResults("v6", "run_results.json");
      const runResults = parseRunResults(
        runResultsJson as Record<string, unknown>,
      );

      const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const analyzer = new ExecutionAnalyzer(runResults, graph);
      const summary = analyzer.getSummary();

      expect(summary.total_execution_time).toBeGreaterThanOrEqual(0);
      expect(summary.total_nodes).toBeGreaterThan(0);
      expect(summary.nodes_by_status).toBeDefined();
      expect(Array.isArray(summary.node_executions)).toBe(true);
    });

    it("should calculate total execution time correctly", () => {
      const runResultsJson = loadTestRunResults("v6", "run_results.json");
      const runResults = parseRunResults(
        runResultsJson as Record<string, unknown>,
      );

      const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const analyzer = new ExecutionAnalyzer(runResults, graph);
      const summary = analyzer.getSummary();

      // Total execution time should be sum of individual execution times
      const calculatedTotal = summary.node_executions.reduce(
        (sum, exec) => sum + (exec.execution_time || 0),
        0,
      );
      expect(summary.total_execution_time).toBeCloseTo(calculatedTotal, 2);
    });

    it("should count nodes by status correctly", () => {
      const runResultsJson = loadTestRunResults("v6", "run_results.json");
      const runResults = parseRunResults(
        runResultsJson as Record<string, unknown>,
      );

      const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const analyzer = new ExecutionAnalyzer(runResults, graph);
      const summary = analyzer.getSummary();

      // Sum of nodes_by_status should equal total_nodes
      const sumByStatus = Object.values(summary.nodes_by_status).reduce(
        (sum, count) => sum + count,
        0,
      );
      expect(sumByStatus).toBe(summary.total_nodes);
    });
  });

  describe("calculateCriticalPath", () => {
    it("should calculate critical path when nodes exist", () => {
      const runResultsJson = loadTestRunResults("v6", "run_results.json");
      const runResults = parseRunResults(
        runResultsJson as Record<string, unknown>,
      );

      const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const analyzer = new ExecutionAnalyzer(runResults, graph);
      const summary = analyzer.getSummary();

      // Critical path may or may not exist depending on graph structure
      if (summary.critical_path) {
        expect(summary.critical_path.path.length).toBeGreaterThan(0);
        expect(summary.critical_path.total_time).toBeGreaterThanOrEqual(0);

        // Verify all nodes in path exist in the graph
        const graphologyGraph = graph.getGraph();
        for (const nodeId of summary.critical_path.path) {
          expect(graphologyGraph.hasNode(nodeId)).toBe(true);
        }
      }
    });

    it("should return undefined when no leaf nodes exist", () => {
      // Create a minimal run_results with no matching nodes in graph
      const runResultsJson = {
        metadata: {
          dbt_schema_version:
            "https://schemas.getdbt.com/dbt/run-results/v6.json",
        },
        results: [
          {
            unique_id: "non.existent.node",
            status: "success",
            execution_time: 1.0,
            timing: [],
          },
        ],
      };
      const runResults = parseRunResults(
        runResultsJson as Record<string, unknown>,
      );

      const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const analyzer = new ExecutionAnalyzer(runResults, graph);
      const summary = analyzer.getSummary();

      // Critical path should be undefined if no leaf nodes match
      // (This depends on implementation - may return undefined or empty path)
      expect(summary.critical_path).toBeUndefined();
    });
  });

  describe("getGanttData", () => {
    it("should generate Gantt chart data when timestamps are available", () => {
      const runResultsJson = loadTestRunResults("v6", "run_results.json");
      const runResults = parseRunResults(
        runResultsJson as Record<string, unknown>,
      );

      const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const analyzer = new ExecutionAnalyzer(runResults, graph);
      const ganttData = analyzer.getGanttData();

      // Gantt data may be empty if no timestamps are available
      if (ganttData.length > 0) {
        for (const item of ganttData) {
          expect(item.unique_id).toBeDefined();
          expect(item.name).toBeDefined();
          expect(typeof item.start).toBe("number");
          expect(typeof item.end).toBe("number");
          expect(typeof item.duration).toBe("number");
          expect(item.status).toBeDefined();
          expect(item.end).toBeGreaterThanOrEqual(item.start);
          expect(item.duration).toBe(item.end - item.start);
        }

        // Verify start times are relative (first item should start at 0 or close to it)
        if (ganttData.length > 0) {
          const minStart = Math.min(...ganttData.map((d) => d.start));
          expect(minStart).toBe(0);
        }
      }
    });

    it("should return empty array when no timestamps are available", () => {
      const runResultsJson = {
        metadata: {
          dbt_schema_version:
            "https://schemas.getdbt.com/dbt/run-results/v6.json",
        },
        results: [
          {
            unique_id: "test.node",
            status: "success",
            execution_time: 1.0,
            timing: [],
          },
        ],
      };
      const runResults = parseRunResults(
        runResultsJson as Record<string, unknown>,
      );

      const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const analyzer = new ExecutionAnalyzer(runResults, graph);
      const ganttData = analyzer.getGanttData();

      expect(ganttData).toEqual([]);
    });
  });
});
