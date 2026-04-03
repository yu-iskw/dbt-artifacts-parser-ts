/** Posts to the analysis Web Worker and normalizes load / search / code responses. */
import type { AnalysisState } from "@web/types";
import {
  ANALYSIS_WORKER_PROTOCOL_VERSION,
  type AnalysisLoadSource,
  type AnalysisWorkerRequest,
  type AnalysisWorkerResponse,
  type AnalysisWorkerTimings,
} from "../workers/analysisProtocol";
import { debug, markDebug, measureDebug } from "../debug";
import { SpanStatusCode } from "@opentelemetry/api";
import { getWebTracer } from "@web/telemetry/tracer";
import { getActiveTraceCarrier } from "@web/telemetry/context";

const ERR_UNEXPECTED_ANALYSIS_RESPONSE = "Unexpected analysis worker response";
const ERR_UNEXPECTED_RESOURCE_CODE_RESPONSE =
  "Unexpected resource-code worker response";
const ERR_UNEXPECTED_SEARCH_RESPONSE =
  "Unexpected search-resources worker response";

/** Matches {@link AnalysisWorkerRequest} `search-resources` and pending map kind. */
const WORKER_MSG_SEARCH_RESOURCES = "search-resources" as const;

export interface AnalysisLoadMetrics {
  requestId: number;
  source: AnalysisLoadSource;
  dispatchMarkName: string;
  readyMarkName: string;
  analysisReadyMeasureName: string;
  timings: AnalysisWorkerTimings;
}

export interface AnalysisLoadResult {
  analysis: AnalysisState;
  metrics: AnalysisLoadMetrics;
}

export interface ResourceCodePayload {
  compiledCode: string | null;
  rawCode: string | null;
}

type PendingLoad = {
  kind: "load";
  resolve: (value: AnalysisLoadResult) => void;
  reject: (reason?: unknown) => void;
  source: AnalysisLoadSource;
};

type PendingResourceCode = {
  kind: "resource-code";
  resolve: (value: ResourceCodePayload) => void;
  reject: (reason?: unknown) => void;
};

type PendingSearchResources = {
  kind: typeof WORKER_MSG_SEARCH_RESOURCES;
  resolve: (value: AnalysisState["resources"]) => void;
  reject: (reason?: unknown) => void;
};

type PendingRequest =
  | PendingLoad
  | PendingResourceCode
  | PendingSearchResources;

class AnalysisWorkerClient {
  private worker: Worker;
  private requestId = 0;
  private pending = new Map<number, PendingRequest>();

  constructor() {
    this.worker = new Worker(
      new URL("../workers/analysis.worker.ts", import.meta.url),
      { type: "module" },
    );
    this.worker.onmessage = (event: MessageEvent<AnalysisWorkerResponse>) => {
      this.handleMessage(event.data);
    };
    this.worker.onerror = (event) => {
      const message = event.message || "Analysis worker failed";
      for (const pending of this.pending.values()) {
        pending.reject(new Error(message));
      }
      this.pending.clear();
    };
  }

  async loadAnalysis(
    manifestBytes: ArrayBuffer,
    runResultsBytes: ArrayBuffer,
    source: AnalysisLoadSource,
  ): Promise<AnalysisLoadResult> {
    const requestId = this.requestId + 1;
    this.requestId = requestId;

    const dispatchMarkName = `analysis-load:${requestId}:dispatch`;
    const readyMarkName = `analysis-load:${requestId}:ready`;
    const analysisReadyMeasureName = `analysis-load:${requestId}:analysis-ready`;

    markDebug(dispatchMarkName);

    const request: AnalysisWorkerRequest = {
      type: "load-analysis",
      protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
      requestId,
      manifestBytes,
      runResultsBytes,
      source,
      telemetry: getActiveTraceCarrier() ?? undefined,
    };

    const promise = new Promise<AnalysisLoadResult>((resolve, reject) => {
      this.pending.set(requestId, { kind: "load", resolve, reject, source });
    });

    this.worker.postMessage(request, [manifestBytes, runResultsBytes]);

    return promise.then((result) => {
      markDebug(readyMarkName);
      measureDebug(analysisReadyMeasureName, dispatchMarkName, readyMarkName);
      debug("Analysis worker ready", {
        requestId,
        source,
        timings: result.metrics.timings,
      });
      return {
        ...result,
        metrics: {
          ...result.metrics,
          dispatchMarkName,
          readyMarkName,
          analysisReadyMeasureName,
        },
      };
    });
  }

  async requestResourceCode(uniqueId: string): Promise<ResourceCodePayload> {
    const requestId = this.requestId + 1;
    this.requestId = requestId;

    const request: AnalysisWorkerRequest = {
      type: "get-resource-code",
      protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
      requestId,
      uniqueId,
      telemetry: getActiveTraceCarrier() ?? undefined,
    };

    const promise = new Promise<ResourceCodePayload>((resolve, reject) => {
      this.pending.set(requestId, { kind: "resource-code", resolve, reject });
    });

    this.worker.postMessage(request);
    return promise;
  }

  async searchResources(query: string): Promise<AnalysisState["resources"]> {
    const requestId = this.requestId + 1;
    this.requestId = requestId;

    const request: AnalysisWorkerRequest = {
      type: WORKER_MSG_SEARCH_RESOURCES,
      protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
      requestId,
      query,
      telemetry: getActiveTraceCarrier() ?? undefined,
    };

    const promise = new Promise<AnalysisState["resources"]>(
      (resolve, reject) => {
        this.pending.set(requestId, {
          kind: WORKER_MSG_SEARCH_RESOURCES,
          resolve,
          reject,
        });
      },
    );

    this.worker.postMessage(request);
    return promise;
  }

  terminate() {
    this.worker.terminate();
    for (const pending of this.pending.values()) {
      pending.reject(new Error("Analysis worker terminated"));
    }
    this.pending.clear();
  }

  private handleMessage(payload: AnalysisWorkerResponse) {
    const pending = this.pending.get(payload.requestId);
    if (!pending) return;
    this.pending.delete(payload.requestId);

    if (pending.kind === "load") {
      if (payload.type === "analysis-error") {
        pending.reject(new Error(payload.message));
        return;
      }
      if (payload.type === "analysis-ready") {
        pending.resolve({
          analysis: payload.analysis,
          metrics: {
            requestId: payload.requestId,
            source: pending.source,
            dispatchMarkName: "",
            readyMarkName: "",
            analysisReadyMeasureName: "",
            timings: payload.timings,
          },
        });
        return;
      }
      pending.reject(new Error(ERR_UNEXPECTED_ANALYSIS_RESPONSE));
      return;
    }

    if (pending.kind === "resource-code") {
      if (payload.type === "resource-code-error") {
        pending.reject(new Error(payload.message));
        return;
      }
      if (payload.type === "resource-code-ready") {
        pending.resolve({
          compiledCode: payload.compiledCode,
          rawCode: payload.rawCode,
        });
        return;
      }
      pending.reject(new Error(ERR_UNEXPECTED_RESOURCE_CODE_RESPONSE));
      return;
    }

    if (pending.kind === WORKER_MSG_SEARCH_RESOURCES) {
      if (payload.type === "search-resources-error") {
        pending.reject(new Error(payload.message));
        return;
      }
      if (payload.type === "search-resources-ready") {
        pending.resolve(payload.resources);
        return;
      }
      pending.reject(new Error(ERR_UNEXPECTED_SEARCH_RESPONSE));
    }
  }
}

let workerClient: AnalysisWorkerClient | null = null;

function getWorkerClient(): AnalysisWorkerClient {
  workerClient ??= new AnalysisWorkerClient();
  return workerClient;
}

export async function loadAnalysisFromBuffers(
  manifestBytes: ArrayBuffer,
  runResultsBytes: ArrayBuffer,
  source: AnalysisLoadSource,
): Promise<AnalysisLoadResult> {
  return getWebTracer().startActiveSpan("ui.analysis.load", async (span) => {
    span.setAttribute("dbt.source", source);
    span.setAttribute("dbt.manifest.bytes", manifestBytes.byteLength);
    span.setAttribute("dbt.run_results.bytes", runResultsBytes.byteLength);

    try {
      const result = await getWorkerClient().loadAnalysis(
        manifestBytes,
        runResultsBytes,
        source,
      );
      span.setAttribute("dbt.worker.decode_ms", result.metrics.timings.decodeMs);
      span.setAttribute("dbt.worker.parse_ms", result.metrics.timings.parseMs);
      span.setAttribute(
        "dbt.worker.graph_build_ms",
        result.metrics.timings.graphBuildMs,
      );
      span.setAttribute(
        "dbt.worker.snapshot_build_ms",
        result.metrics.timings.snapshotBuildMs,
      );
      span.setAttribute(
        "dbt.worker.total_ms",
        result.metrics.timings.totalWorkerMs,
      );
      return result;
    } catch (error) {
      span.recordException(
        error instanceof Error ? error : new Error(String(error)),
      );
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}

export async function requestResourceCodeFromWorker(
  uniqueId: string,
): Promise<ResourceCodePayload> {
  return getWorkerClient().requestResourceCode(uniqueId);
}

export async function searchResourcesFromWorker(
  query: string,
): Promise<AnalysisState["resources"]> {
  return getWorkerClient().searchResources(query);
}

export function resetAnalysisWorkerClientForTests() {
  workerClient?.terminate();
  workerClient = null;
}
