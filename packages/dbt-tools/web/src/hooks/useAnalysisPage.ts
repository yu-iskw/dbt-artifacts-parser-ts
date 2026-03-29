import { useEffect, useRef, useState } from "react";
import { useAnalysisPreload } from "./useAnalysisPreload";
import { useDbtArtifactsReload } from "./useDbtArtifactsReload";
import { useRemoteArtifactPoll } from "./useRemoteArtifactPoll";
import type { AnalysisState } from "@web/types";
import type { AnalysisLoadResult } from "../services/analysisLoader";
import { debug, markDebug, measureDebug } from "../debug";
import {
  refetchFromApi,
  switchToArtifactRun,
  type RemoteArtifactRun,
  type WorkspaceArtifactSource,
} from "../services/artifactApi";

export interface UseAnalysisPageResult {
  analysis: AnalysisState | null;
  analysisSource: WorkspaceArtifactSource | null;
  error: string | null;
  preloadLoading: boolean;
  pendingRemoteRun: RemoteArtifactRun | null;
  acceptingRemoteRun: boolean;
  onLoadDifferent: () => void;
  onAnalysis: (result: AnalysisLoadResult) => void;
  onError: (error: string | null) => void;
  onAcceptPendingRemoteRun: () => Promise<void>;
}

/**
 * Composes preload and reload hooks. Exposes page state and handlers for the view.
 */
export function useAnalysisPage(): UseAnalysisPageResult {
  const [analysis, setAnalysis] = useState<AnalysisState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisSource, setAnalysisSource] =
    useState<WorkspaceArtifactSource | null>(null);
  const [preloadLoading, setPreloadLoading] = useState(true);
  const [pendingRemoteRun, setPendingRemoteRun] =
    useState<RemoteArtifactRun | null>(null);
  const [acceptingRemoteRun, setAcceptingRemoteRun] = useState(false);
  const [remotePollIntervalMs, setRemotePollIntervalMs] = useState<
    number | null
  >(null);
  const pendingMetricsRef = useRef<AnalysisLoadResult["metrics"] | null>(null);

  useAnalysisPreload({
    setPreloadLoading,
    setAnalysis,
    setAnalysisSource,
    setPendingRemoteRun,
    setRemotePollIntervalMs,
    setError,
    pendingMetricsRef,
  });

  useDbtArtifactsReload(
    analysisSource,
    setAnalysis,
    setError,
    pendingMetricsRef,
  );

  useRemoteArtifactPoll(
    analysisSource,
    setPendingRemoteRun,
    setRemotePollIntervalMs,
    remotePollIntervalMs,
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
    pendingRemoteRun,
    acceptingRemoteRun,
    onLoadDifferent: () => {
      setAnalysis(null);
      setAnalysisSource(null);
      setPendingRemoteRun(null);
      setRemotePollIntervalMs(null);
      setError(null);
    },
    onAnalysis: (result) => {
      pendingMetricsRef.current = result.metrics;
      setAnalysisSource("upload");
      setPendingRemoteRun(null);
      setAnalysis(result.analysis);
    },
    onError: setError,
    onAcceptPendingRemoteRun: async () => {
      if (pendingRemoteRun == null) return;

      setAcceptingRemoteRun(true);
      try {
        const status = await switchToArtifactRun(pendingRemoteRun.runId);
        const result = await refetchFromApi("remote");
        if (result != null) {
          pendingMetricsRef.current = result.metrics;
          setAnalysis(result.analysis);
          setAnalysisSource(status.currentSource);
          setRemotePollIntervalMs(status.pollIntervalMs);
          setError(null);
        }
        setPendingRemoteRun(status.pendingRun);
      } catch (switchError) {
        setError(
          switchError instanceof Error
            ? switchError.message
            : "Failed to switch remote artifact run",
        );
      } finally {
        setAcceptingRemoteRun(false);
      }
    },
  };
}
