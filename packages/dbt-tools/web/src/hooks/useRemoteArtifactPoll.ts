import { useEffect } from "react";
import { debug } from "../debug";
import { fetchArtifactSourceStatus } from "../services/artifactApi";
import type { WorkspaceArtifactSource } from "@web/lib/artifactSourceKind";
import type { RemoteArtifactRun } from "../services/artifactSourceApi";

/**
 * Polls `/api/artifact-source` while the workspace is in remote mode so the UI
 * can surface `pendingRun` when a newer complete pair appears on the bucket.
 */
export function useRemoteArtifactPoll(
  analysisSource: WorkspaceArtifactSource | null,
  selectedRemoteRunId: string | null,
  setCurrentRemoteRun: (run: RemoteArtifactRun | null) => void,
  setPendingRemoteRun: (run: RemoteArtifactRun | null) => void,
  setRemotePollIntervalMs: (ms: number | null) => void,
  setSelectedRemoteRunId: (runId: string | null) => void,
  remotePollIntervalMs: number | null,
): void {
  useEffect(() => {
    if (analysisSource !== "remote") {
      setCurrentRemoteRun(null);
      setPendingRemoteRun(null);
      setRemotePollIntervalMs(null);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const status = await fetchArtifactSourceStatus(
          selectedRemoteRunId ?? undefined,
        );
        if (!cancelled) {
          setCurrentRemoteRun(status.currentRun);
          setPendingRemoteRun(status.pendingRun);
          setRemotePollIntervalMs(status.pollIntervalMs);
          setSelectedRemoteRunId(status.currentRun?.runId ?? null);
        }
      } catch (pollError) {
        debug("Artifact source poll failed", pollError);
      }
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, remotePollIntervalMs ?? 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    analysisSource,
    selectedRemoteRunId,
    setCurrentRemoteRun,
    remotePollIntervalMs,
    setPendingRemoteRun,
    setRemotePollIntervalMs,
    setSelectedRemoteRunId,
  ]);
}
