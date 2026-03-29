import {
  loadAnalysisFromBuffers,
  type AnalysisLoadResult,
} from "./analysisLoader";

export type WorkspaceArtifactSource = "preload" | "remote" | "upload";
export type ManagedArtifactSourceMode = "none" | "preload" | "remote";
export type RemoteArtifactProvider = "s3" | "gcs";

export interface RemoteArtifactRun {
  runId: string;
  label: string;
  updatedAtMs: number;
  versionToken: string;
}

export interface ArtifactSourceStatus {
  mode: ManagedArtifactSourceMode;
  currentSource: Exclude<WorkspaceArtifactSource, "upload"> | null;
  label: string;
  checkedAtMs: number;
  remoteProvider: RemoteArtifactProvider | null;
  remoteLocation: string | null;
  pollIntervalMs: number | null;
  currentRun: RemoteArtifactRun | null;
  pendingRun: RemoteArtifactRun | null;
  supportsSwitch: boolean;
}

async function fetchArrayBufferOrNull(
  pathname: string,
): Promise<ArrayBuffer | null> {
  const response = await fetch(pathname);
  if (!response.ok) return null;
  return response.arrayBuffer();
}

async function fetchArtifactPair(
  manifestPath: string,
  runResultsPath: string,
): Promise<{
  manifestBytes: ArrayBuffer;
  runResultsBytes: ArrayBuffer;
} | null> {
  const [manifestBytes, runResultsBytes] = await Promise.all([
    fetchArrayBufferOrNull(manifestPath),
    fetchArrayBufferOrNull(runResultsPath),
  ]);

  if (manifestBytes == null || runResultsBytes == null) return null;
  return { manifestBytes, runResultsBytes };
}

async function loadFromLegacyApi(): Promise<AnalysisLoadResult | null> {
  const legacyPair = await fetchArtifactPair(
    "/api/manifest.json",
    "/api/run_results.json",
  );
  if (legacyPair == null) return null;
  return loadAnalysisFromBuffers(
    legacyPair.manifestBytes,
    legacyPair.runResultsBytes,
    "preload",
  );
}

export async function fetchArtifactSourceStatus(): Promise<ArtifactSourceStatus> {
  const response = await fetch("/api/artifact-source");
  if (!response.ok) {
    throw new Error("Failed to load artifact source status");
  }
  return (await response.json()) as ArtifactSourceStatus;
}

export async function refetchFromApi(
  source: Exclude<WorkspaceArtifactSource, "upload"> = "preload",
): Promise<AnalysisLoadResult | null> {
  const currentPair =
    (await fetchArtifactPair(
      "/api/artifacts/current/manifest.json",
      "/api/artifacts/current/run_results.json",
    )) ??
    (await fetchArtifactPair("/api/manifest.json", "/api/run_results.json"));

  if (currentPair == null) return null;
  return loadAnalysisFromBuffers(
    currentPair.manifestBytes,
    currentPair.runResultsBytes,
    source,
  );
}

export async function loadCurrentManagedArtifacts(): Promise<{
  status: ArtifactSourceStatus;
  result: AnalysisLoadResult | null;
}> {
  let status: ArtifactSourceStatus;
  try {
    status = await fetchArtifactSourceStatus();
  } catch {
    const fallbackResult = await loadFromLegacyApi();
    return {
      status: {
        mode: fallbackResult == null ? "none" : "preload",
        currentSource: fallbackResult == null ? null : "preload",
        label: fallbackResult == null ? "Waiting for artifacts" : "Live target",
        checkedAtMs: Date.now(),
        remoteProvider: null,
        remoteLocation: null,
        pollIntervalMs: null,
        currentRun: null,
        pendingRun: null,
        supportsSwitch: false,
      },
      result: fallbackResult,
    };
  }
  if (status.currentSource == null) {
    return { status, result: null };
  }

  return {
    status,
    result: await refetchFromApi(status.currentSource),
  };
}

export async function switchToArtifactRun(
  runId?: string,
): Promise<ArtifactSourceStatus> {
  const response = await fetch("/api/artifact-source/switch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(runId ? { runId } : {}),
  });

  if (!response.ok) {
    throw new Error("Failed to switch artifact source run");
  }

  return (await response.json()) as ArtifactSourceStatus;
}
