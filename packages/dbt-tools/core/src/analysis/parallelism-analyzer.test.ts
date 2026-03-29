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
import { analyzeParallelism } from "./parallelism-analyzer";
import { ExecutionAnalyzer } from "./execution-analyzer";

describe("analyzeParallelism", () => {
  it("should return a valid ParallelismAnalysis from manifest alone", () => {
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);

    const result = analyzeParallelism(graph);

    expect(result).toBeDefined();
    expect(typeof result.total_waves).toBe("number");
    expect(typeof result.max_parallelism).toBe("number");
    expect(typeof result.avg_wave_width).toBe("number");
    expect(typeof result.recommended_threads).toBe("number");
    expect(typeof result.has_cycles).toBe("boolean");
    expect(Array.isArray(result.waves)).toBe(true);
    expect(Array.isArray(result.serialization_bottlenecks)).toBe(true);
  });

  it("should report has_cycles as false for a valid DAG manifest", () => {
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);

    const result = analyzeParallelism(graph);

    expect(result.has_cycles).toBe(false);
  });

  it("should produce waves with correct structure", () => {
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);

    const result = analyzeParallelism(graph);

    for (const wave of result.waves) {
      expect(typeof wave.wave_number).toBe("number");
      expect(typeof wave.width).toBe("number");
      expect(Array.isArray(wave.node_ids)).toBe(true);
      expect(wave.width).toBe(wave.node_ids.length);
      expect(wave.wave_number).toBeGreaterThanOrEqual(0);
    }
  });

  it("should have non-decreasing wave_numbers", () => {
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);

    const result = analyzeParallelism(graph);

    for (let i = 1; i < result.waves.length; i++) {
      expect(result.waves[i].wave_number).toBeGreaterThan(
        result.waves[i - 1].wave_number,
      );
    }
  });

  it("should have total_waves matching waves array length", () => {
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);

    const result = analyzeParallelism(graph);

    expect(result.total_waves).toBe(result.waves.length);
  });

  it("max_parallelism should equal the widest wave", () => {
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);

    const result = analyzeParallelism(graph);

    const computedMax =
      result.waves.length > 0
        ? Math.max(...result.waves.map((w) => w.width))
        : 0;
    expect(result.max_parallelism).toBe(computedMax);
  });

  it("should have recommended_threads of at least 1", () => {
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);

    const result = analyzeParallelism(graph);

    expect(result.recommended_threads).toBeGreaterThanOrEqual(1);
  });

  it("should annotate waves with estimated_time_s when nodeExecutions provided", () => {
    const runResultsJson = loadTestRunResults("v6", "run_results.json");
    const runResults = parseRunResults(
      runResultsJson as Record<string, unknown>,
    );
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);

    const analyzer = new ExecutionAnalyzer(runResults, graph);
    const nodeExecutions = analyzer.getNodeExecutions();

    const result = analyzeParallelism(graph, nodeExecutions);

    // Waves that contain executed nodes should have estimated_time_s
    let hasAtLeastOneEstimate = false;
    for (const wave of result.waves) {
      if (wave.estimated_time_s !== undefined) {
        hasAtLeastOneEstimate = true;
        expect(wave.estimated_time_s).toBeGreaterThanOrEqual(0);
      }
    }
    // Since we supplied executions, at least one wave should have timing
    expect(hasAtLeastOneEstimate).toBe(true);
  });

  it("should not include estimated_time_s when nodeExecutions is not provided", () => {
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);

    const result = analyzeParallelism(graph);

    for (const wave of result.waves) {
      expect(wave.estimated_time_s).toBeUndefined();
    }
  });

  it("serialization bottlenecks should only appear at wave width 1 following wider waves", () => {
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);

    const result = analyzeParallelism(graph);

    for (const bottleneck of result.serialization_bottlenecks) {
      const wave = result.waves.find(
        (w) => w.wave_number === bottleneck.wave_number,
      );
      expect(wave).toBeDefined();
      expect(wave!.width).toBe(1);

      const prevWave = result.waves.find(
        (w) => w.wave_number === bottleneck.wave_number - 1,
      );
      expect(prevWave).toBeDefined();
      expect(prevWave!.width).toBeGreaterThan(1);
    }
  });
});
