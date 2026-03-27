import { useEffect } from "react";
import { refetchFromApi } from "../services/artifactApi";
import { debug } from "../debug";
import type { AnalysisState } from "@web/types";

declare const __DBT_SERVE_MODE__: boolean;

/**
 * Subscribes to dbt-artifacts-changed when analysis came from preload.
 * In serve mode (dbt-tools serve), connects to the WebSocket at /ws.
 * In Vite dev mode, listens to HMR events (existing behavior).
 * Refetches from /api/* and updates state on file change.
 */
export function useDbtArtifactsReload(
  analysisSource: "preload" | "upload" | null,
  setAnalysis: (a: AnalysisState | null) => void,
  setError: (e: string | null) => void,
) {
  useEffect(() => {
    if (analysisSource !== "preload") return;

    const handler = () => {
      debug("Reload: dbt-artifacts-changed received, refetching");
      refetchFromApi()
        .then((result) => {
          if (result) {
            setAnalysis(result);
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

    // Serve mode: connect to the CLI's WebSocket server
    if (typeof __DBT_SERVE_MODE__ !== "undefined" && __DBT_SERVE_MODE__) {
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);
      ws.addEventListener("message", (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string) as { type?: string };
          if (msg.type === "dbt-artifacts-changed") handler();
        } catch {
          // ignore malformed messages
        }
      });
      return () => ws.close();
    }

    // Vite dev mode: use HMR events
    if (!import.meta.hot) return;
    import.meta.hot.on("dbt-artifacts-changed", handler);
    return () => import.meta.hot?.off("dbt-artifacts-changed", handler);
  }, [analysisSource, setAnalysis, setError]);
}
