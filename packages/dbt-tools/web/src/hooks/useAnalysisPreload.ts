import { useEffect, useRef } from "react";
import { refetchFromApi } from "../services/artifactApi";
import { debug } from "../debug";
import type { AnalysisState } from "@web/types";
import type { AnalysisLoadResult } from "../services/analysisLoader";

interface UseAnalysisPreloadParams {
  setPreloadLoading: (loading: boolean) => void;
  setAnalysis: (a: AnalysisState | null) => void;
  setAnalysisSource: (s: "preload" | "upload" | null) => void;
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
  setError,
  pendingMetricsRef,
}: UseAnalysisPreloadParams) {
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    debug("Preload: fetching /api/manifest.json and /api/run_results.json");

    refetchFromApi()
      .then((result) => {
        setPreloadLoading(false);
        if (result) {
          debug("Preload: success, analysis loaded");
          pendingMetricsRef.current = result.metrics;
          setAnalysis(result.analysis);
          setAnalysisSource("preload");
          setError(null);
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
    setError,
  ]);
}
