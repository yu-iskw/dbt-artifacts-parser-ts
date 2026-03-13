import { useState } from "react";
import { useAnalysisPreload } from "./useAnalysisPreload";
import { useDbtArtifactsReload } from "./useDbtArtifactsReload";
import type { AnalysisState } from "../types";

export interface UseAnalysisPageResult {
  analysis: AnalysisState | null;
  error: string | null;
  preloadLoading: boolean;
  onLoadDifferent: () => void;
  onAnalysis: (analysis: AnalysisState) => void;
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

  useAnalysisPreload({
    setPreloadLoading,
    setAnalysis,
    setAnalysisSource,
    setError,
  });

  useDbtArtifactsReload(analysisSource, setAnalysis, setError);

  return {
    analysis,
    error,
    preloadLoading,
    onLoadDifferent: () => {
      setAnalysis(null);
      setAnalysisSource(null);
      setError(null);
    },
    onAnalysis: (a) => {
      setAnalysisSource("upload");
      setAnalysis(a);
    },
    onError: setError,
  };
}
