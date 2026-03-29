import { describe, expect, it } from "vitest";
import {
  loadTestManifest,
  loadTestRunResults,
} from "dbt-artifacts-parser/test-utils";
import { handleAnalysisWorkerRequest } from "./analysis.worker";
import { ANALYSIS_WORKER_PROTOCOL_VERSION } from "./analysisProtocol";

function encodeJson(value: Record<string, unknown>) {
  return new TextEncoder().encode(JSON.stringify(value)).buffer;
}

describe("analysis worker contract", () => {
  it("returns a full analysis snapshot for valid artifacts", async () => {
    const manifestJson = loadTestManifest(
      "v12",
      "manifest_1.10.json",
    ) as Record<string, unknown>;
    const runResultsJson = loadTestRunResults(
      "v6",
      "run_results.json",
    ) as Record<string, unknown>;

    const response = await handleAnalysisWorkerRequest({
      type: "load-analysis",
      protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
      requestId: 1,
      manifestBytes: encodeJson(manifestJson),
      runResultsBytes: encodeJson(runResultsJson),
      source: "upload",
    });

    expect(response.type).toBe("analysis-ready");
    if (response.type !== "analysis-ready") return;
    expect(response.analysis.summary.total_nodes).toBeGreaterThan(0);
    expect(response.timings.totalWorkerMs).toBeGreaterThanOrEqual(0);
    expect(response.timings.graphBuildMs).toBeGreaterThanOrEqual(0);
    expect(response.timings.snapshotBuildMs).toBeGreaterThanOrEqual(0);
  });

  it("returns a protocol error for malformed JSON bytes", async () => {
    const invalidBytes = new TextEncoder().encode("{bad json").buffer;

    const response = await handleAnalysisWorkerRequest({
      type: "load-analysis",
      protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
      requestId: 2,
      manifestBytes: invalidBytes,
      runResultsBytes: invalidBytes,
      source: "preload",
    });

    expect(response.type).toBe("analysis-error");
    if (response.type !== "analysis-error") return;
    expect(response.message).toContain("JSON");
  });

  it("returns an unsupported-artifact error for old manifest versions", async () => {
    const manifestJson = loadTestManifest("v1", "manifest.json") as Record<
      string,
      unknown
    >;
    const runResultsJson = loadTestRunResults(
      "v6",
      "run_results.json",
    ) as Record<string, unknown>;

    const response = await handleAnalysisWorkerRequest({
      type: "load-analysis",
      protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
      requestId: 3,
      manifestBytes: encodeJson(manifestJson),
      runResultsBytes: encodeJson(runResultsJson),
      source: "upload",
    });

    expect(response.type).toBe("analysis-error");
    if (response.type !== "analysis-error") return;
    expect(response.message).toContain("Unsupported dbt version");
  });

  it("returns resource SQL after a successful load", async () => {
    const manifestJson = loadTestManifest(
      "v12",
      "manifest_1.10.json",
    ) as Record<string, unknown>;
    const runResultsJson = loadTestRunResults(
      "v6",
      "run_results.json",
    ) as Record<string, unknown>;

    const loadResponse = await handleAnalysisWorkerRequest({
      type: "load-analysis",
      protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
      requestId: 10,
      manifestBytes: encodeJson(manifestJson),
      runResultsBytes: encodeJson(runResultsJson),
      source: "upload",
    });

    expect(loadResponse.type).toBe("analysis-ready");
    if (loadResponse.type !== "analysis-ready") return;

    const modelId = loadResponse.analysis.resources.find(
      (r) => r.resourceType === "model",
    )?.uniqueId;
    expect(modelId).toBeDefined();

    const codeResponse = await handleAnalysisWorkerRequest({
      type: "get-resource-code",
      protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
      requestId: 11,
      uniqueId: modelId!,
    });

    expect(codeResponse.type).toBe("resource-code-ready");
    if (codeResponse.type !== "resource-code-ready") return;
    const hasSql =
      (codeResponse.compiledCode?.length ?? 0) > 0 ||
      (codeResponse.rawCode?.length ?? 0) > 0;
    expect(hasSql).toBe(true);
  });

  it("returns search hits after a successful load", async () => {
    const manifestJson = loadTestManifest(
      "v12",
      "manifest_1.10.json",
    ) as Record<string, unknown>;
    const runResultsJson = loadTestRunResults(
      "v6",
      "run_results.json",
    ) as Record<string, unknown>;

    await handleAnalysisWorkerRequest({
      type: "load-analysis",
      protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
      requestId: 20,
      manifestBytes: encodeJson(manifestJson),
      runResultsBytes: encodeJson(runResultsJson),
      source: "upload",
    });

    const searchResponse = await handleAnalysisWorkerRequest({
      type: "search-resources",
      protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
      requestId: 21,
      query: "model",
    });

    expect(searchResponse.type).toBe("search-resources-ready");
    if (searchResponse.type !== "search-resources-ready") return;
    expect(searchResponse.resources.length).toBeGreaterThan(0);
    expect(searchResponse.resources.length).toBeLessThanOrEqual(8);
  });
});
