import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { ExecutionRow } from "@web/types";
import type {
  DashboardStatusFilter,
  ResultsFilterState,
  RunsKind,
} from "@web/lib/analysis-workspace/types";
import type { ResultsStatusCounts } from "@web/lib/analysis-workspace/resultsDataSource";

const RESULTS_BATCH_SIZE = 100;

type WorkerReadyMessage = {
  type: "ready";
  summary: {
    models: ResultsStatusCounts;
    tests: ResultsStatusCounts;
  };
};

type WorkerQueryResultMessage = {
  type: "query-result";
  requestId: number;
  rows: ExecutionRow[];
  totalMatches: number;
  summary: ResultsStatusCounts;
};

type WorkerErrorMessage = {
  type: "error";
  message: string;
};

type WorkerResponse =
  | WorkerReadyMessage
  | WorkerQueryResultMessage
  | WorkerErrorMessage;

function emptyCounts(): ResultsStatusCounts {
  return {
    all: 0,
    positive: 0,
    warning: 0,
    danger: 0,
  };
}

export interface RunsResultsSourceState {
  rows: ExecutionRow[];
  totalMatches: number;
  totalVisible: number;
  counts: ResultsStatusCounts;
  hasMore: boolean;
  isIndexing: boolean;
  isLoading: boolean;
  error: string | null;
  loadMore: () => void;
}

export function useRunsResultsSource(
  allRows: ExecutionRow[],
  tab: RunsKind,
  filters: ResultsFilterState,
  enabled = true,
): RunsResultsSourceState {
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [revealedCount, setRevealedCount] = useState(RESULTS_BATCH_SIZE);
  const [rows, setRows] = useState<ExecutionRow[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [counts, setCounts] = useState<ResultsStatusCounts>(emptyCounts);
  const [isIndexing, setIsIndexing] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(filters.query);

  useEffect(() => {
    setRevealedCount(RESULTS_BATCH_SIZE);
    setRows([]);
    setTotalMatches(0);
  }, [tab, filters.status, deferredQuery, allRows]);

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      setIsIndexing(false);
      setIsLoading(false);
      setRows([]);
      setTotalMatches(0);
      setCounts(emptyCounts());
      setError(null);
      return;
    }
    const worker = new Worker(
      new URL("../workers/resultsQuery.worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;
    setReady(false);
    setIsIndexing(true);
    setIsLoading(false);
    setRows([]);
    setTotalMatches(0);
    setError(null);

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const payload = event.data;
      if (payload.type === "ready") {
        setReady(true);
        setIsIndexing(false);
        setCounts(payload.summary[tab]);
        return;
      }
      if (payload.type === "query-result") {
        if (payload.requestId !== requestIdRef.current) return;
        setRows(payload.rows);
        setTotalMatches(payload.totalMatches);
        setCounts(payload.summary);
        setIsLoading(false);
        return;
      }
      setError(payload.message);
      setIsIndexing(false);
      setIsLoading(false);
    };

    worker.postMessage({
      type: "init",
      rows: allRows,
    });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [allRows, enabled, tab]);

  useEffect(() => {
    if (!enabled || !ready || workerRef.current == null) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);
    setError(null);
    workerRef.current.postMessage({
      type: "query",
      requestId,
      tab,
      status: filters.status as DashboardStatusFilter,
      query: deferredQuery,
      limit: revealedCount,
    });
  }, [deferredQuery, enabled, filters.status, ready, revealedCount, tab]);

  return useMemo(
    () => ({
      rows,
      totalMatches,
      totalVisible: rows.length,
      counts,
      hasMore: rows.length < totalMatches,
      isIndexing,
      isLoading,
      error,
      loadMore: () => {
        setRevealedCount((current) => current + RESULTS_BATCH_SIZE);
      },
    }),
    [rows, totalMatches, counts, isIndexing, isLoading, error],
  );
}
