import type { AnalysisState } from "@web/types";
import {
  ANALYSIS_WORKER_PROTOCOL_VERSION,
  type AnalysisLoadSource,
  type AnalysisWorkerRequest,
  type AnalysisWorkerResponse,
  type AnalysisWorkerTimings,
} from "../workers/analysisProtocol";
import { debug, markDebug, measureDebug } from "../debug";

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

type PendingRequest = {
  resolve: (value: AnalysisLoadResult) => void;
  reject: (reason?: unknown) => void;
  source: AnalysisLoadSource;
};

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
    };

    const promise = new Promise<AnalysisLoadResult>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject, source });
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

    if (payload.type === "analysis-error") {
      pending.reject(new Error(payload.message));
      return;
    }

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
  return getWorkerClient().loadAnalysis(manifestBytes, runResultsBytes, source);
}

export function resetAnalysisWorkerClientForTests() {
  workerClient?.terminate();
  workerClient = null;
}
