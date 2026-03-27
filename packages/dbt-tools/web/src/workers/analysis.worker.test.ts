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
});
