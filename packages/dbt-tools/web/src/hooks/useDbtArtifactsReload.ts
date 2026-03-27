import { useEffect } from "react";
import { refetchFromApi } from "../services/artifactApi";
import { debug } from "../debug";
import type { AnalysisState } from "@web/types";
import type { AnalysisLoadResult } from "../services/analysisLoader";

const ARTIFACTS_CHANGED_EVENT = "dbt-artifacts-changed";

/**
 * Subscribes to dbt-artifacts-changed when analysis came from preload.
 *
 * Transport selection is done at runtime (not compile time) so the production
 * bundle always includes both paths:
 *  - Serve mode: the CLI injects `window.__DBT_SERVE_MODE__ = true` via a
 *    <script> tag before index.html is served; we open a WebSocket to /ws.
 *  - Vite dev mode: `window.__DBT_SERVE_MODE__` is undefined; fall back to HMR.
 */
export function useDbtArtifactsReload(
  analysisSource: "preload" | "upload" | null,
  setAnalysis: (a: AnalysisState | null) => void,
  setError: (e: string | null) => void,
  pendingMetricsRef: { current: AnalysisLoadResult["metrics"] | null },
) {
  useEffect(() => {
    if (analysisSource !== "preload") return;

    const handler = () => {
      debug(`Reload: ${ARTIFACTS_CHANGED_EVENT} received, refetching`);
      refetchFromApi()
        .then((result) => {
          if (result) {
            pendingMetricsRef.current = result.metrics;
            setAnalysis(result.analysis);
            setError(null);
            debug("Reload: success");
          }
        })
        .catch((err) => {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to reload artifacts from server",
          );
        });
    };

    // Runtime check — survives Vite tree-shaking because `window` is a
    // dynamic lookup, not a compile-time define substitution.
    const isServeMode =
      typeof window !== "undefined" &&
      (window as unknown as Record<string, unknown>).__DBT_SERVE_MODE__ ===
        true;

    if (isServeMode) {
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);
      ws.addEventListener("message", (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string) as { type?: string };
          if (msg.type === ARTIFACTS_CHANGED_EVENT) handler();
        } catch {
          // ignore malformed messages
        }
      });
      return () => ws.close();
    }

    // Vite dev mode: use HMR events
    if (!import.meta.hot) return;
    import.meta.hot.on(ARTIFACTS_CHANGED_EVENT, handler);
    return () => import.meta.hot?.off(ARTIFACTS_CHANGED_EVENT, handler);
  }, [analysisSource, pendingMetricsRef, setAnalysis, setError]);
}
