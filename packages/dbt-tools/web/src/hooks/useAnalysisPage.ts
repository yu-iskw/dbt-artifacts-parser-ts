import { useEffect, useRef, useState } from "react";
import { useAnalysisPreload } from "./useAnalysisPreload";
import { useDbtArtifactsReload } from "./useDbtArtifactsReload";
import type { AnalysisState } from "@web/types";
import type { AnalysisLoadResult } from "../services/analysisLoader";
import { debug, markDebug, measureDebug } from "../debug";

export interface UseAnalysisPageResult {
  analysis: AnalysisState | null;
  analysisSource: "preload" | "upload" | null;
  error: string | null;
  preloadLoading: boolean;
  onLoadDifferent: () => void;
  onAnalysis: (result: AnalysisLoadResult) => void;
  onError: (error: string | null) => void;
}

/**
 * Composes preload and reload hooks. Exposes page state and handlers for the view.
 */
export function useAnalysisPage(): UseAnalysisPageResult {
  const [analysis, setAnalysis] = useState<AnalysisState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisSource, setAnalysisSource] = useState<
    "preload" | "upload" | null
  >(null);
  const [preloadLoading, setPreloadLoading] = useState(true);
  const pendingMetricsRef = useRef<AnalysisLoadResult["metrics"] | null>(null);

  useAnalysisPreload({
    setPreloadLoading,
    setAnalysis,
    setAnalysisSource,
    setError,
    pendingMetricsRef,
  });

  useDbtArtifactsReload(
    analysisSource,
    setAnalysis,
    setError,
    pendingMetricsRef,
  );

  useEffect(() => {
    if (analysis == null || pendingMetricsRef.current == null) return;
    const metrics = pendingMetricsRef.current;
    pendingMetricsRef.current = null;

    requestAnimationFrame(() => {
      const interactiveMarkName = `analysis-load:${metrics.requestId}:interactive`;
      const interactiveMeasureName = `analysis-load:${metrics.requestId}:first-interactive-frame`;
      markDebug(interactiveMarkName);
      measureDebug(
        interactiveMeasureName,
        metrics.dispatchMarkName,
        interactiveMarkName,
      );
      debug("Analysis load metrics", {
        requestId: metrics.requestId,
        source: metrics.source,
        timings: metrics.timings,
      });
    });
  }, [analysis]);

  return {
    analysis,
    analysisSource,
    error,
    preloadLoading,
    onLoadDifferent: () => {
      setAnalysis(null);
      setAnalysisSource(null);
      setError(null);
    },
    onAnalysis: (result) => {
      pendingMetricsRef.current = result.metrics;
      setAnalysisSource("upload");
      setAnalysis(result.analysis);
    },
    onError: setError,
  };
}
