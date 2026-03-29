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
  setPendingRemoteRun: (
    run: Awaited<
      ReturnType<typeof loadCurrentManagedArtifacts>
    >["status"]["pendingRun"],
  ) => void;
  setRemotePollIntervalMs: (pollIntervalMs: number | null) => void;
  setError: (e: string | null) => void;
  pendingMetricsRef: { current: AnalysisLoadResult["metrics"] | null };
}

/**
 * Runs artifact preload once on mount. Fetches from /api/* and updates state.
 */
export function useAnalysisPreload({
  setPreloadLoading,
  setAnalysis,
  setAnalysisSource,
  setPendingRemoteRun,
  setRemotePollIntervalMs,
  setError,
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
        setPendingRemoteRun(status.pendingRun);
        setRemotePollIntervalMs(status.pollIntervalMs);
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
    setPendingRemoteRun,
    setRemotePollIntervalMs,
    setError,
  ]);
}
