/**
 * Browser `fetch` calls to `/api/artifact-source/*` and artifact JSON routes.
 * Does not run in Node; pairing server logic is under `artifact-source/`.
 */
import {
  loadAnalysisFromBuffers,
  type AnalysisLoadResult,
} from "./analysisLoader";
import type { AnalysisArtifactBufferInputs } from "../workers/analysisProtocol";
import type { WorkspaceArtifactSource } from "@web/lib/artifactSourceKind";
import type {
  ActivateArtifactRequest,
  ArtifactCandidateSummary,
  ArtifactSourceType,
  DiscoverArtifactsRequest,
  DiscoverArtifactsResponse,
} from "../artifact-source/discoveryContract";

export type {
  ArtifactSourceType,
  DiscoverArtifactsRequest,
  DiscoverArtifactsResponse,
  ActivateArtifactRequest,
  ArtifactCandidateSummary,
};

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

type ArtifactUrlSet = {
  manifest: string;
  runResults: string;
  catalog: string;
  sources: string;
};

const LEGACY_ARTIFACT_URLS: ArtifactUrlSet = {
  manifest: "/api/manifest.json",
  runResults: "/api/run_results.json",
  catalog: "/api/catalog.json",
  sources: "/api/sources.json",
};

/** Precedence: current managed paths, then legacy single-target paths. */
const ARTIFACT_URL_SETS: ReadonlyArray<ArtifactUrlSet> = [
  {
    manifest: "/api/artifacts/current/manifest.json",
    runResults: "/api/artifacts/current/run_results.json",
    catalog: "/api/artifacts/current/catalog.json",
    sources: "/api/artifacts/current/sources.json",
  },
  LEGACY_ARTIFACT_URLS,
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
  const contentType = response.headers?.get?.("content-type")?.toLowerCase();
  if (contentType != null && !contentType.includes("application/json")) {
    return null;
  }
  return response.arrayBuffer();
}

async function fetchRequiredArtifactBytes(
  pathname: string,
): Promise<ArrayBuffer | null> {
  try {
    return await fetchArrayBufferOrNull(pathname);
  } catch {
    return null;
  }
}

async function fetchOptionalArtifactBytes(
  pathname: string,
): Promise<ArrayBuffer | null> {
  try {
    return await fetchArrayBufferOrNull(pathname);
  } catch {
    return null;
  }
}

async function fetchArtifactBufferSet(
  urls: ArtifactUrlSet,
): Promise<AnalysisArtifactBufferInputs | null> {
  const [manifestBytes, runResultsBytes, catalogBytes, sourcesBytes] =
    await Promise.all([
      fetchRequiredArtifactBytes(urls.manifest),
      fetchRequiredArtifactBytes(urls.runResults),
      fetchOptionalArtifactBytes(urls.catalog),
      fetchOptionalArtifactBytes(urls.sources),
    ]);

  if (manifestBytes == null || runResultsBytes == null) return null;
  return {
    manifestBytes,
    runResultsBytes,
    ...(catalogBytes != null ? { catalogBytes } : {}),
    ...(sourcesBytes != null ? { sourcesBytes } : {}),
  };
}

async function fetchFirstArtifactBufferSet(
  attempts: ReadonlyArray<ArtifactUrlSet> = ARTIFACT_URL_SETS,
): Promise<AnalysisArtifactBufferInputs | null> {
  for (const urls of attempts) {
    const bundle = await fetchArtifactBufferSet(urls);
    if (bundle != null) return bundle;
  }
  return null;
}

async function loadFromLegacyApi(): Promise<AnalysisLoadResult | null> {
  const legacyBuffers = await fetchFirstArtifactBufferSet([
    LEGACY_ARTIFACT_URLS,
  ]);
  if (legacyBuffers == null) return null;
  return loadAnalysisFromBuffers(legacyBuffers, "preload");
}

async function loadManagedArtifactsFallback(): Promise<{
  status: ArtifactSourceStatus;
  result: AnalysisLoadResult | null;
}> {
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
  const currentBuffers = await fetchFirstArtifactBufferSet();

  if (currentBuffers == null) return null;
  return loadAnalysisFromBuffers(currentBuffers, source);
}

export async function loadCurrentManagedArtifacts(): Promise<{
  status: ArtifactSourceStatus;
  result: AnalysisLoadResult | null;
}> {
  let response: Response;
  try {
    response = await fetch("/api/artifact-source");
  } catch {
    return loadManagedArtifactsFallback();
  }

  if (response.status === 404) {
    return loadManagedArtifactsFallback();
  }

  if (!response.ok) {
    return loadManagedArtifactsFallback();
  }

  let status: ArtifactSourceStatus;
  try {
    status = (await response.json()) as ArtifactSourceStatus;
  } catch {
    // Preview/static hosts often return 200 + index.html for unknown /api/* paths.
    return loadManagedArtifactsFallback();
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

/**
 * Ask the server to discover artifact candidates at the given location.
 * Does not change the active source.
 */
export async function discoverArtifactSource(
  req: DiscoverArtifactsRequest,
): Promise<DiscoverArtifactsResponse> {
  const response = await fetch("/api/artifact-source/discover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    let errorMessage = "Failed to discover artifact source";
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) errorMessage = body.message;
    } catch {
      // ignore parse failure
    }
    throw new Error(errorMessage);
  }

  return (await response.json()) as DiscoverArtifactsResponse;
}

/**
 * Ask the server to activate a specific artifact candidate.
 * After this succeeds, call refetchFromApi("runtime") to load the artifacts.
 */
export async function activateArtifactSource(
  req: ActivateArtifactRequest,
): Promise<ArtifactSourceStatus> {
  const response = await fetch("/api/artifact-source/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    let errorMessage = "Failed to activate artifact source";
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) errorMessage = body.message;
    } catch {
      // ignore parse failure
    }
    throw new Error(errorMessage);
  }

  return (await response.json()) as ArtifactSourceStatus;
}
