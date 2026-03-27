import type { AnalysisSnapshot } from "@dbt-tools/core/browser";

export const ANALYSIS_WORKER_PROTOCOL_VERSION = 1;

export type AnalysisLoadSource = "preload" | "upload";

export interface AnalysisWorkerTimings {
  decodeMs: number;
  parseMs: number;
  graphBuildMs: number;
  snapshotBuildMs: number;
  totalWorkerMs: number;
}

export interface LoadAnalysisMessage {
  type: "load-analysis";
  protocolVersion: typeof ANALYSIS_WORKER_PROTOCOL_VERSION;
  requestId: number;
  manifestBytes: ArrayBuffer;
  runResultsBytes: ArrayBuffer;
  source: AnalysisLoadSource;
}

export interface AnalysisReadyMessage {
  type: "analysis-ready";
  protocolVersion: typeof ANALYSIS_WORKER_PROTOCOL_VERSION;
  requestId: number;
  analysis: AnalysisSnapshot;
  timings: AnalysisWorkerTimings;
}

export interface AnalysisErrorMessage {
  type: "analysis-error";
  protocolVersion: typeof ANALYSIS_WORKER_PROTOCOL_VERSION;
  requestId: number;
  message: string;
}

export type AnalysisWorkerRequest = LoadAnalysisMessage;
export type AnalysisWorkerResponse =
  | AnalysisReadyMessage
  | AnalysisErrorMessage;
