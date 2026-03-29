import {
  loadAnalysisFromBuffers,
  type AnalysisLoadResult,
} from "./analysisLoader";
import type { WorkspaceArtifactSource } from "@web/lib/artifactSourceKind";

export type { WorkspaceArtifactSource };
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

const LEGACY_ARTIFACT_MANIFEST_RUN_RESULTS: readonly [string, string] = [
  "/api/manifest.json",
  "/api/run_results.json",
];

/** Precedence: current managed paths, then legacy single-target paths. */
const ARTIFACT_MANIFEST_RUN_RESULTS_URLS: ReadonlyArray<
  readonly [manifestPath: string, runResultsPath: string]
> = [
  [
    "/api/artifacts/current/manifest.json",
    "/api/artifacts/current/run_results.json",
  ],
  LEGACY_ARTIFACT_MANIFEST_RUN_RESULTS,
];

function emptyManagedArtifactStatusFields(): Pick<
  ArtifactSourceStatus,
  | "checkedAtMs"
  | "remoteProvider"
  | "remoteLocation"
  | "pollIntervalMs"
  | "currentRun"
  | "pendingRun"
  | "supportsSwitch"
> {
  return {
    checkedAtMs: Date.now(),
    remoteProvider: null,
    remoteLocation: null,
    pollIntervalMs: null,
    currentRun: null,
    pendingRun: null,
    supportsSwitch: false,
  };
}

function buildManagedArtifactStatus(
  mode: ManagedArtifactSourceMode,
  currentSource: Exclude<WorkspaceArtifactSource, "upload"> | null,
  label: string,
): ArtifactSourceStatus {
  return {
    mode,
    currentSource,
    label,
    ...emptyManagedArtifactStatusFields(),
  };
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

async function fetchFirstArtifactPair(
  attempts: ReadonlyArray<
    readonly [string, string]
  > = ARTIFACT_MANIFEST_RUN_RESULTS_URLS,
): Promise<{
  manifestBytes: ArrayBuffer;
  runResultsBytes: ArrayBuffer;
} | null> {
  for (const [manifestPath, runResultsPath] of attempts) {
    const pair = await fetchArtifactPair(manifestPath, runResultsPath);
    if (pair != null) return pair;
  }
  return null;
}

async function loadFromLegacyApi(): Promise<AnalysisLoadResult | null> {
  const legacyPair = await fetchFirstArtifactPair([
    LEGACY_ARTIFACT_MANIFEST_RUN_RESULTS,
  ]);
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
  const currentPair = await fetchFirstArtifactPair();

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
      status: buildManagedArtifactStatus(
        fallbackResult == null ? "none" : "preload",
        fallbackResult == null ? null : "preload",
        fallbackResult == null ? "Waiting for artifacts" : "Live target",
      ),
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
