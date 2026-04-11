import { useEffect, useRef } from "react";
import {
  loadCurrentManagedArtifacts,
  type WorkspaceArtifactSource,
} from "../services/artifactApi";
import { debug } from "../debug";
import type { AnalysisState } from "@web/types";
import type { AnalysisLoadResult } from "../services/analysisLoader";

interface UseAnalysisPreloadParams {
  setPreloadLoading: (loading: boolean) => void;
  setAnalysis: (a: AnalysisState | null) => void;
  setAnalysisSource: (s: WorkspaceArtifactSource | null) => void;
  setCurrentRemoteRun: (
    run: Awaited<
      ReturnType<typeof loadCurrentManagedArtifacts>
    >["status"]["currentRun"],
  ) => void;
  setPendingRemoteRun: (
    run: Awaited<
      ReturnType<typeof loadCurrentManagedArtifacts>
    >["status"]["pendingRun"],
  ) => void;
  setRemotePollIntervalMs: (pollIntervalMs: number | null) => void;
  setError: (e: string | null) => void;
  setSelectedRemoteRunId: (runId: string | null) => void;
  pendingMetricsRef: { current: AnalysisLoadResult["metrics"] | null };
}

/**
 * Runs artifact preload once on mount. Fetches from /api/* and updates state.
 */
export function useAnalysisPreload({
  setPreloadLoading,
  setAnalysis,
  setAnalysisSource,
  setCurrentRemoteRun,
  setPendingRemoteRun,
  setRemotePollIntervalMs,
  setError,
  setSelectedRemoteRunId,
  pendingMetricsRef,
}: UseAnalysisPreloadParams) {
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    debug("Preload: fetching current managed artifacts");

    loadCurrentManagedArtifacts()
      .then(({ result, status }) => {
        setPreloadLoading(false);
        setCurrentRemoteRun(status.currentRun);
        setPendingRemoteRun(status.pendingRun);
        setRemotePollIntervalMs(status.pollIntervalMs);
        setSelectedRemoteRunId(status.currentRun?.runId ?? null);
        if (result) {
          debug("Preload: success, analysis loaded");
          pendingMetricsRef.current = result.metrics;
          setAnalysis(result.analysis);
          setAnalysisSource(status.currentSource);
          setError(null);
        } else {
          setAnalysisSource(status.currentSource);
        }
      })
      .catch((err) => {
        setPreloadLoading(false);
        debug("Preload: error", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load artifacts from server",
        );
      });
  }, [
    pendingMetricsRef,
    setPreloadLoading,
    setAnalysis,
    setAnalysisSource,
    setCurrentRemoteRun,
    setPendingRemoteRun,
    setRemotePollIntervalMs,
    setError,
    setSelectedRemoteRunId,
  ]);
}
