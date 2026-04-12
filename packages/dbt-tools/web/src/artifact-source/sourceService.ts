/** Node (Vite dev) service: local target dir vs remote S3/GCS; drives middleware routes. */
import fs from "node:fs/promises";
import path from "node:path";
import {
  DBT_CATALOG_JSON,
  DBT_MANIFEST_JSON,
  DBT_RUN_RESULTS_JSON,
  DBT_SOURCES_JSON,
  discoverLocalArtifactRuns,
  getDbtToolsRemoteSourceConfigFromEnv,
  getDbtToolsTargetDirFromEnv,
  isDbtToolsDebugEnabled,
  validateSafePath,
  type DbtToolsRemoteSourceConfig,
  type LocalArtifactRun,
} from "@dbt-tools/core";
import {
  discoverLatestArtifactRuns,
  toRemoteArtifactRun,
  type ResolvedArtifactRun,
} from "./discovery";
import {
  type ActivateArtifactRequest,
  type ArtifactCandidateSummary,
  type DiscoverArtifactsRequest,
  type DiscoverArtifactsResponse,
} from "./discoveryContract";
import { normalizeArtifactPrefix } from "./prefix";
import {
  createRemoteObjectStoreClient,
  type RemoteObjectStoreClient,
} from "./remoteObjectStore";
import { resolveLocalArtifactTargetDirFromEnv } from "./resolveLocalTargetDir";
import type {
  ArtifactSourceStatus,
  RemoteArtifactProvider,
  WorkspaceArtifactSource,
} from "../services/artifactSourceApi";

export type { RemoteObjectStoreClient };

interface CurrentArtifactPayload {
  source: Exclude<WorkspaceArtifactSource, "upload">;
  manifestBytes: Uint8Array;
  runResultsBytes: Uint8Array;
  catalogBytes?: Uint8Array;
  sourcesBytes?: Uint8Array;
}

export interface ArtifactSourceAdapter {
  getStatus(): Promise<ArtifactSourceStatus>;
  getCurrentArtifacts(): Promise<CurrentArtifactPayload | null>;
  switchToRun(runId?: string): Promise<ArtifactSourceStatus>;
}

export interface ArtifactSourceServiceOptions {
  remoteConfig?: DbtToolsRemoteSourceConfig | null;
  remoteClient?: RemoteObjectStoreClient;
  targetDir?: string | null;
  adapter?: ArtifactSourceAdapter | null;
}

function debugLog(...args: unknown[]) {
  if (isDbtToolsDebugEnabled()) {
    console.log("[artifact-source]", ...args);
  }
}

function toLocationLabel(
  provider: RemoteArtifactProvider,
  bucket: string,
  prefix: string,
) {
  return `${provider.toUpperCase()} ${bucket}/${prefix}`;
}

function toArtifactSourceStatus(
  status: Omit<ArtifactSourceStatus, "checkedAtMs">,
): ArtifactSourceStatus {
  return {
    ...status,
    checkedAtMs: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Local adapter
// ---------------------------------------------------------------------------

class LocalArtifactSourceAdapter implements ArtifactSourceAdapter {
  constructor(private readonly targetDir: string) {}

  private async readOptionalBytes(
    filePath: string,
  ): Promise<Uint8Array | null> {
    try {
      return await fs.readFile(filePath);
    } catch {
      return null;
    }
  }

  async getStatus(): Promise<ArtifactSourceStatus> {
    return toArtifactSourceStatus({
      mode: "preload",
      currentSource: "preload",
      label: "Live target",
      remoteProvider: null,
      remoteLocation: null,
      pollIntervalMs: null,
      currentRun: null,
      pendingRun: null,
      supportsSwitch: false,
    });
  }

  async getCurrentArtifacts(): Promise<CurrentArtifactPayload | null> {
    try {
      const [manifestBytes, runResultsBytes, catalogBytes, sourcesBytes] =
        await Promise.all([
          fs.readFile(path.join(this.targetDir, DBT_MANIFEST_JSON)),
          fs.readFile(path.join(this.targetDir, DBT_RUN_RESULTS_JSON)),
          this.readOptionalBytes(path.join(this.targetDir, DBT_CATALOG_JSON)),
          this.readOptionalBytes(path.join(this.targetDir, DBT_SOURCES_JSON)),
        ]);

      return {
        source: "preload",
        manifestBytes,
        runResultsBytes,
        ...(catalogBytes != null ? { catalogBytes } : {}),
        ...(sourcesBytes != null ? { sourcesBytes } : {}),
      };
    } catch {
      return null;
    }
  }

  async switchToRun(): Promise<ArtifactSourceStatus> {
    return this.getStatus();
  }
}

// ---------------------------------------------------------------------------
// Remote adapter
// ---------------------------------------------------------------------------

class RemoteArtifactSourceAdapter implements ArtifactSourceAdapter {
  private currentRunId: string | null = null;

  constructor(
    private readonly config: DbtToolsRemoteSourceConfig,
    private readonly client: RemoteObjectStoreClient,
  ) {}

  private async resolveRuns(): Promise<ResolvedArtifactRun[]> {
    const objects = await this.client.listObjects(
      this.config.bucket,
      normalizeArtifactPrefix(this.config.prefix),
    );
    return discoverLatestArtifactRuns(objects, this.config.prefix);
  }

  private chooseCurrentRun(
    runs: ResolvedArtifactRun[],
  ): ResolvedArtifactRun | null {
    if (runs.length === 0) return null;
    if (this.currentRunId == null) {
      this.currentRunId = runs[0].runId;
      return runs[0];
    }

    const current = runs.find((run) => run.runId === this.currentRunId);
    if (current) return current;

    this.currentRunId = runs[0].runId;
    return runs[0];
  }

  private async readOptionalObjectBytes(
    key: string | undefined,
  ): Promise<Uint8Array | null> {
    if (key == null) return null;
    try {
      return await this.client.readObjectBytes(this.config.bucket, key);
    } catch {
      return null;
    }
  }

  async getStatus(): Promise<ArtifactSourceStatus> {
    const runs = await this.resolveRuns();
    const currentRun = this.chooseCurrentRun(runs);
    const latestRun = runs[0] ?? null;
    const pendingRun =
      latestRun != null &&
      currentRun != null &&
      latestRun.runId !== currentRun.runId
        ? latestRun
        : null;

    return toArtifactSourceStatus({
      mode: "remote",
      currentSource: currentRun == null ? null : "remote",
      label: "Remote source",
      remoteProvider: this.config.provider,
      remoteLocation: toLocationLabel(
        this.config.provider,
        this.config.bucket,
        normalizeArtifactPrefix(this.config.prefix),
      ),
      pollIntervalMs: this.config.pollIntervalMs,
      currentRun:
        currentRun == null
          ? null
          : toRemoteArtifactRun(this.config.provider, currentRun),
      pendingRun:
        pendingRun == null
          ? null
          : toRemoteArtifactRun(this.config.provider, pendingRun),
      supportsSwitch: pendingRun != null,
    });
  }

  async getCurrentArtifacts(): Promise<CurrentArtifactPayload | null> {
    const runs = await this.resolveRuns();
    const currentRun = this.chooseCurrentRun(runs);
    if (currentRun == null) return null;

    const [manifestBytes, runResultsBytes, catalogBytes, sourcesBytes] =
      await Promise.all([
        this.client.readObjectBytes(this.config.bucket, currentRun.manifestKey),
        this.client.readObjectBytes(
          this.config.bucket,
          currentRun.runResultsKey,
        ),
        this.readOptionalObjectBytes(currentRun.catalogKey),
        this.readOptionalObjectBytes(currentRun.sourcesKey),
      ]);

    return {
      source: "remote",
      manifestBytes,
      runResultsBytes,
      ...(catalogBytes != null ? { catalogBytes } : {}),
      ...(sourcesBytes != null ? { sourcesBytes } : {}),
    };
  }

  async switchToRun(runId?: string): Promise<ArtifactSourceStatus> {
    const runs = await this.resolveRuns();
    const target =
      runId == null
        ? runs[0]
        : runs.find((candidate) => candidate.runId === runId);
    if (target != null) {
      this.currentRunId = target.runId;
      debugLog("Switched remote artifact run", this.currentRunId);
    }
    return this.getStatus();
  }
}

// ---------------------------------------------------------------------------
// Discovery helpers
// ---------------------------------------------------------------------------

function localRunToCandidate(run: LocalArtifactRun): ArtifactCandidateSummary {
  const missingOptional: string[] = [];
  if (run.catalogPath == null) missingOptional.push(DBT_CATALOG_JSON);
  if (run.sourcesPath == null) missingOptional.push(DBT_SOURCES_JSON);

  return {
    candidateId: run.runId,
    label:
      run.runId === "current" ? "Current artifacts" : `Run: ${run.runId}`,
    updatedAtMs: run.updatedAtMs,
    hasManifest: true,
    hasRunResults: true,
    hasCatalog: run.catalogPath != null,
    hasSources: run.sourcesPath != null,
    missingOptional,
  };
}

function remoteRunToCandidate(
  provider: RemoteArtifactProvider,
  run: ResolvedArtifactRun,
): ArtifactCandidateSummary {
  const missingOptional: string[] = [];
  if (run.catalogKey == null) missingOptional.push(DBT_CATALOG_JSON);
  if (run.sourcesKey == null) missingOptional.push(DBT_SOURCES_JSON);

  return {
    candidateId: run.runId,
    label: toRemoteArtifactRun(provider, run).label,
    updatedAtMs: run.updatedAtMs,
    hasManifest: true,
    hasRunResults: true,
    hasCatalog: run.catalogKey != null,
    hasSources: run.sourcesKey != null,
    missingOptional,
  };
}

/**
 * Parse a "bucket/prefix" location string into its components.
 * Everything before the first "/" is the bucket; the rest is the prefix.
 */
function parseBucketPrefix(location: string): {
  bucket: string;
  prefix: string;
} {
  const slashIndex = location.indexOf("/");
  if (slashIndex === -1) {
    return { bucket: location, prefix: "" };
  }
  return {
    bucket: location.slice(0, slashIndex),
    prefix: location.slice(slashIndex + 1),
  };
}

/**
 * Build a DbtToolsRemoteSourceConfig for an ad-hoc discover/activate request,
 * using the server-configured credentials (from DBT_TOOLS_REMOTE_SOURCE) with
 * the user-supplied bucket/prefix.
 */
function buildAdHocRemoteConfig(
  provider: "s3" | "gcs",
  bucket: string,
  prefix: string,
): DbtToolsRemoteSourceConfig {
  const envConfig = getDbtToolsRemoteSourceConfigFromEnv();
  return {
    provider,
    bucket,
    prefix,
    pollIntervalMs: envConfig?.pollIntervalMs ?? 30_000,
    region: envConfig?.provider === provider ? envConfig.region : undefined,
    endpoint:
      envConfig?.provider === provider ? envConfig.endpoint : undefined,
    forcePathStyle:
      envConfig?.provider === provider
        ? envConfig.forcePathStyle
        : undefined,
    projectId:
      envConfig?.provider === provider ? envConfig.projectId : undefined,
  };
}

// ---------------------------------------------------------------------------
// Main service
// ---------------------------------------------------------------------------

export class ArtifactSourceService {
  private adapter: ArtifactSourceAdapter | null;

  constructor(options: ArtifactSourceServiceOptions = {}) {
    if (options.adapter !== undefined) {
      this.adapter = options.adapter;
      return;
    }

    const remoteConfig =
      options.remoteConfig === undefined
        ? getDbtToolsRemoteSourceConfigFromEnv()
        : options.remoteConfig;
    if (remoteConfig != null) {
      debugLog(
        "Configured remote artifact source",
        remoteConfig.provider,
        remoteConfig.bucket,
        remoteConfig.prefix,
      );
      this.adapter = new RemoteArtifactSourceAdapter(
        remoteConfig,
        options.remoteClient ?? createRemoteObjectStoreClient(remoteConfig),
      );
      return;
    }

    const targetDir =
      options.targetDir === undefined
        ? getDbtToolsTargetDirFromEnv()
        : options.targetDir;
    if (targetDir == null) {
      this.adapter = null;
      return;
    }

    this.adapter = new LocalArtifactSourceAdapter(
      resolveLocalArtifactTargetDirFromEnv(process.cwd(), targetDir),
    );
  }

  /** Replace the active adapter with one supplied at runtime. */
  setRuntimeAdapter(adapter: ArtifactSourceAdapter | null): void {
    this.adapter = adapter;
  }

  async getStatus(): Promise<ArtifactSourceStatus> {
    if (this.adapter == null) {
      return toArtifactSourceStatus({
        mode: "none",
        currentSource: null,
        label: "Waiting for artifacts",
        remoteProvider: null,
        remoteLocation: null,
        pollIntervalMs: null,
        currentRun: null,
        pendingRun: null,
        supportsSwitch: false,
      });
    }
    return this.adapter.getStatus();
  }

  async getCurrentArtifacts(): Promise<CurrentArtifactPayload | null> {
    return this.adapter?.getCurrentArtifacts() ?? null;
  }

  async switchToRun(runId?: string): Promise<ArtifactSourceStatus> {
    if (this.adapter == null) return this.getStatus();
    return this.adapter.switchToRun(runId);
  }

  /**
   * Discover artifact candidates at the given location without changing the
   * active adapter. Returns a list of candidates the caller can present to the
   * user for explicit selection.
   */
  async discover(
    request: DiscoverArtifactsRequest,
  ): Promise<DiscoverArtifactsResponse> {
    const { sourceType, location } = request;

    try {
      if (sourceType === "local") {
        validateSafePath(location);
        const runs = discoverLocalArtifactRuns(location);
        const candidates = runs.map(localRunToCandidate);

        if (candidates.length === 0) {
          return {
            sourceType,
            location,
            candidates: [],
            error: `No complete artifact pair found at "${location}". Both manifest.json and run_results.json are required.`,
          };
        }

        return { sourceType, location, candidates };
      }

      // S3 or GCS
      const provider = sourceType; // "s3" | "gcs"
      const { bucket, prefix } = parseBucketPrefix(location);

      if (!bucket) {
        return {
          sourceType,
          location,
          candidates: [],
          error: `Invalid location "${location}". Expected format: "bucket/prefix".`,
        };
      }

      const config = buildAdHocRemoteConfig(provider, bucket, prefix);
      const client = createRemoteObjectStoreClient(config);

      const objects = await client.listObjects(
        bucket,
        normalizeArtifactPrefix(prefix),
      );
      const runs = discoverLatestArtifactRuns(objects, prefix);
      const candidates = runs.map((run) =>
        remoteRunToCandidate(provider, run),
      );

      if (candidates.length === 0) {
        return {
          sourceType,
          location,
          candidates: [],
          error: `No complete artifact pair found at "${location}". Both manifest.json and run_results.json are required.`,
        };
      }

      return { sourceType, location, candidates };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        sourceType,
        location,
        candidates: [],
        error: message,
      };
    }
  }

  /**
   * Discover candidates at the given location, select the one matching
   * `candidateId`, create the appropriate adapter, and replace the active
   * adapter. Returns the new status.
   *
   * @throws {Error} when candidateId is not found or no candidates exist.
   */
  async activate(request: ActivateArtifactRequest): Promise<ArtifactSourceStatus> {
    const { sourceType, location, candidateId } = request;

    const discovery = await this.discover({ sourceType, location });

    if (discovery.error != null && discovery.candidates.length === 0) {
      throw new Error(discovery.error);
    }

    const candidate = discovery.candidates.find(
      (c) => c.candidateId === candidateId,
    );
    if (candidate == null) {
      throw new Error(
        `Candidate "${candidateId}" not found at "${location}".`,
      );
    }

    if (sourceType === "local") {
      // Point the local adapter at the correct directory.
      // "current" → root location; otherwise → subdirectory with the run name.
      validateSafePath(location);
      const resolvedBase = path.resolve(location);
      const targetDir =
        candidateId === "current"
          ? resolvedBase
          : path.join(resolvedBase, candidateId);

      const newAdapter = new LocalArtifactSourceAdapter(targetDir);
      this.setRuntimeAdapter(newAdapter);
      debugLog("Activated local artifact source", targetDir);
      return this.getStatus();
    }

    // S3 or GCS
    const provider = sourceType; // "s3" | "gcs"
    const { bucket, prefix } = parseBucketPrefix(location);
    const config = buildAdHocRemoteConfig(provider, bucket, prefix);
    const client = createRemoteObjectStoreClient(config);
    const newAdapter = new RemoteArtifactSourceAdapter(config, client);

    this.setRuntimeAdapter(newAdapter);
    debugLog("Activated remote artifact source", provider, bucket, prefix);

    return newAdapter.switchToRun(candidateId);
  }
}
