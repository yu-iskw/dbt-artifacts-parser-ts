/// <reference lib="webworker" />

import type { ExecutionRow } from "@web/types";
import type {
  DashboardStatusFilter,
  RunsKind,
} from "@web/lib/analysis-workspace/types";
import {
  createRunsResultsIndex,
  filterRunsResultsIndex,
  type RunsResultsIndex,
  type RunsResultsSummary,
} from "@web/lib/analysis-workspace/resultsDataSource";

interface InitMessage {
  type: "init";
  rows: ExecutionRow[];
}

interface QueryMessage {
  type: "query";
  requestId: number;
  tab: RunsKind;
  status: DashboardStatusFilter;
  query: string;
  limit: number;
}

type WorkerMessage = InitMessage | QueryMessage;

interface ReadyMessage {
  type: "ready";
  summary: RunsResultsSummary;
}

interface QueryResultMessage {
  type: "query-result";
  requestId: number;
  rows: ExecutionRow[];
  totalMatches: number;
  summary: RunsResultsSummary[RunsKind];
}

interface ErrorMessage {
  type: "error";
  message: string;
}

let index: RunsResultsIndex | null = null;
let lastQueryKey: string | null = null;
let lastMatches: ReturnType<typeof filterRunsResultsIndex> = [];

function postError(message: string) {
  self.postMessage({
    type: "error",
    message,
  } satisfies ErrorMessage);
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const payload = event.data;

  if (payload.type === "init") {
    index = createRunsResultsIndex(payload.rows);
    lastQueryKey = null;
    lastMatches = [];
    self.postMessage({
      type: "ready",
      summary: index.summary,
    } satisfies ReadyMessage);
    return;
  }

  if (index == null) {
    postError("Results worker queried before initialization.");
    return;
  }

  const queryKey = [
    payload.tab,
    payload.status,
    payload.query.trim().toLowerCase(),
  ].join("::");

  if (queryKey !== lastQueryKey) {
    lastMatches = filterRunsResultsIndex(index, {
      tab: payload.tab,
      status: payload.status,
      query: payload.query,
    });
    lastQueryKey = queryKey;
  }

  self.postMessage({
    type: "query-result",
    requestId: payload.requestId,
    rows: lastMatches.slice(0, payload.limit).map((entry) => entry.row),
    totalMatches: lastMatches.length,
    summary:
      payload.tab === "tests" ? index.summary.tests : index.summary.models,
  } satisfies QueryResultMessage);
};
