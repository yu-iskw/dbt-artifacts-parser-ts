/// <reference lib="webworker" />

import { parseManifest } from "dbt-artifacts-parser/manifest";
import { parseRunResults } from "dbt-artifacts-parser/run_results";
import {
  buildAnalysisSnapshotFromParsedArtifacts,
  type AnalysisSnapshot,
} from "@dbt-tools/core/browser";
import {
  ANALYSIS_WORKER_PROTOCOL_VERSION,
  type AnalysisWorkerRequest,
  type AnalysisWorkerResponse,
  type AnalysisWorkerTimings,
} from "./analysisProtocol";

function now() {
  return performance.now();
}

function buildErrorResponse(
  requestId: number,
  message: string,
): AnalysisWorkerResponse {
  return {
    type: "analysis-error",
    protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
    requestId,
    message,
  };
}

function decodeJsonBytes(bytes: ArrayBuffer): Record<string, unknown> {
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text) as Record<string, unknown>;
}

export async function handleAnalysisWorkerRequest(
  payload: AnalysisWorkerRequest,
): Promise<AnalysisWorkerResponse> {
  if (payload.protocolVersion !== ANALYSIS_WORKER_PROTOCOL_VERSION) {
    return buildErrorResponse(
      payload.requestId,
      `Unsupported protocol version: ${payload.protocolVersion}`,
    );
  }

  try {
    const totalStart = now();
    const decodeStart = now();
    const manifestJson = decodeJsonBytes(payload.manifestBytes);
    const runResultsJson = decodeJsonBytes(payload.runResultsBytes);
    const decodeMs = now() - decodeStart;

    const parseStart = now();
    const manifest = parseManifest(manifestJson);
    const runResults = parseRunResults(runResultsJson);
    const parseMs = now() - parseStart;

    const {
      analysis,
      timings: snapshotTimings,
    }: {
      analysis: AnalysisSnapshot;
      timings: { graphBuildMs: number; snapshotBuildMs: number };
    } = buildAnalysisSnapshotFromParsedArtifacts(
      manifestJson,
      runResultsJson,
      manifest,
      runResults,
    );

    const timings: AnalysisWorkerTimings = {
      decodeMs,
      parseMs,
      graphBuildMs: snapshotTimings.graphBuildMs,
      snapshotBuildMs: snapshotTimings.snapshotBuildMs,
      totalWorkerMs: now() - totalStart,
    };

    return {
      type: "analysis-ready",
      protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
      requestId: payload.requestId,
      analysis,
      timings,
    };
  } catch (error) {
    return buildErrorResponse(
      payload.requestId,
      error instanceof Error ? error.message : "Failed to analyze artifacts",
    );
  }
}

if (typeof self !== "undefined") {
  self.onmessage = (event: MessageEvent<AnalysisWorkerRequest>) => {
    void handleAnalysisWorkerRequest(event.data).then((response) => {
      self.postMessage(response);
    });
  };
}
