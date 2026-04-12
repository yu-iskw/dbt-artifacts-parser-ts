/** Node (Vite dev) service: local target dir vs remote S3/GCS; drives middleware routes. */
import fs from "node:fs/promises";
import path from "node:path";
import {
  DBT_CATALOG_JSON,
  DBT_MANIFEST_JSON,
  DBT_RUN_RESULTS_JSON,
  DBT_SOURCES_JSON,
} from "../../../core/src/io/artifact-filenames";
import {
  discoverArtifactCandidateSets,
  discoverLocalArtifactFiles,
  selectArtifactCandidate,
  type ArtifactCandidateSet,
  validateRequiredArtifacts,
} from "../../../core/src/io/artifact-discovery";
import {
  getDbtToolsRemoteSourceConfigFromEnv,
  getDbtToolsTargetDirFromEnv,
  isDbtToolsDebugEnabled,
  type DbtToolsRemoteSourceConfig,
} from "../../../core/src/config/dbt-tools-env";
import {
  discoverLatestArtifactRuns,
  toRemoteArtifactRun,
  type RemoteObjectMetadata,
  type ResolvedArtifactRun,
} from "./discovery";
import { normalizeArtifactPrefix } from "./prefix";
import {
  createRemoteObjectStoreClient,
  type RemoteObjectStoreClient,
} from "./remoteObjectStore";
import { resolveLocalArtifactTargetDirFromEnv } from "./resolveLocalTargetDir";
import type {
  ArtifactDiscoveryResponse,
  ArtifactSourceStatus,
  DiscoverSourceType,
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

function parseRemoteLocation(input: {
  sourceType: DiscoverSourceType;
  location: string;
}): { bucket: string; prefix: string } {
  const value = input.location.trim();
  const expectedPrefix = `${input.sourceType}://`;
  if (!value.startsWith(expectedPrefix)) {
    throw new Error(
      `${input.sourceType} locations must use ${expectedPrefix}<bucket>/<prefix> format.`,
    );
  }

  const withoutScheme = value.slice(expectedPrefix.length);
  const [bucket, ...rest] = withoutScheme.split("/");
  if (bucket.trim() === "") {
    throw new Error(`Missing bucket name in ${input.sourceType} location.`);
  }

  return {
    bucket,
    prefix: rest.join("/").replace(/^\/+|\/+$/g, ""),
  };
}

async function readOptionalLocalBytes(
  filePath: string,
): Promise<Uint8Array | null> {
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

class LocalArtifactSourceAdapter implements ArtifactSourceAdapter {
  constructor(private readonly targetDir: string) {}

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
          readOptionalLocalBytes(path.join(this.targetDir, DBT_CATALOG_JSON)),
          readOptionalLocalBytes(path.join(this.targetDir, DBT_SOURCES_JSON)),
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

interface ManualSelection {
  sourceType: DiscoverSourceType;
  location: string;
  candidateId: string;
  current: CurrentArtifactPayload;
}

export class ArtifactSourceService {
  private adapter: ArtifactSourceAdapter | null;
  private manualSelection: ManualSelection | null = null;

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

  private async discoverRemoteCandidates(
    sourceType: Exclude<DiscoverSourceType, "local">,
    location: string,
  ): Promise<{
    candidates: ArtifactCandidateSet[];
    objects: RemoteObjectMetadata[];
    bucket: string;
    prefix: string;
  }> {
    const parsed = parseRemoteLocation({ sourceType, location });
    const remoteConfig: DbtToolsRemoteSourceConfig =
      sourceType === "s3"
        ? { provider: "s3", bucket: parsed.bucket, prefix: parsed.prefix }
        : { provider: "gcs", bucket: parsed.bucket, prefix: parsed.prefix };
    const client = createRemoteObjectStoreClient(remoteConfig);
    const objects = await client.listObjects(parsed.bucket, parsed.prefix);

    const files = objects
      .map((object) => {
        const key = object.key.replace(/^\/+/, "");
        const fullPrefix = normalizeArtifactPrefix(parsed.prefix);
        if (fullPrefix && !key.startsWith(`${fullPrefix}/`)) return null;
        const relativePath = fullPrefix
          ? key.slice(fullPrefix.length + 1)
          : key;
        if (relativePath === "") return null;
        const filename = path.posix.basename(relativePath);
        if (
          filename !== DBT_MANIFEST_JSON &&
          filename !== DBT_RUN_RESULTS_JSON &&
          filename !== DBT_CATALOG_JSON &&
          filename !== DBT_SOURCES_JSON
        ) {
          return null;
        }
        return { relativePath, filename, updatedAtMs: object.updatedAtMs };
      })
      .filter(
        (
          value,
        ): value is {
          relativePath: string;
          filename:
            | typeof DBT_MANIFEST_JSON
            | typeof DBT_RUN_RESULTS_JSON
            | typeof DBT_CATALOG_JSON
            | typeof DBT_SOURCES_JSON;
          updatedAtMs: number;
        } => value != null,
      );

    return {
      candidates: discoverArtifactCandidateSets(files),
      objects,
      bucket: parsed.bucket,
      prefix: parsed.prefix,
    };
  }

  async discover(input: {
    sourceType: DiscoverSourceType;
    location: string;
  }): Promise<ArtifactDiscoveryResponse> {
    const location = input.location.trim();
    if (location === "") {
      throw new Error("Location is required.");
    }

    const candidates =
      input.sourceType === "local"
        ? discoverArtifactCandidateSets(
            await discoverLocalArtifactFiles(location),
          )
        : (await this.discoverRemoteCandidates(input.sourceType, location))
            .candidates;

    return {
      sourceType: input.sourceType,
      location,
      candidates: candidates.map((candidate) => ({
        candidateId: candidate.candidateId,
        label: candidate.label,
        missingRequired: candidate.missingRequired,
        missingOptional: candidate.missingOptional,
        warnings: candidate.warnings,
        features: candidate.features,
        isLoadable: candidate.isLoadable,
      })),
    };
  }

  private async loadLocalCandidate(input: {
    location: string;
    candidateId: string;
    sourceType: "local";
  }): Promise<void> {
    const baseDir =
      input.candidateId === "current"
        ? input.location
        : path.join(input.location, input.candidateId);
    const [manifestBytes, runResultsBytes, catalogBytes, sourcesBytes] =
      await Promise.all([
        fs.readFile(path.join(baseDir, DBT_MANIFEST_JSON)),
        fs.readFile(path.join(baseDir, DBT_RUN_RESULTS_JSON)),
        readOptionalLocalBytes(path.join(baseDir, DBT_CATALOG_JSON)),
        readOptionalLocalBytes(path.join(baseDir, DBT_SOURCES_JSON)),
      ]);

    this.manualSelection = {
      sourceType: input.sourceType,
      location: input.location,
      candidateId: input.candidateId,
      current: {
        source: "preload",
        manifestBytes,
        runResultsBytes,
        ...(catalogBytes != null ? { catalogBytes } : {}),
        ...(sourcesBytes != null ? { sourcesBytes } : {}),
      },
    };
  }

  private async loadRemoteCandidate(input: {
    location: string;
    candidateId: string;
    sourceType: "s3" | "gcs";
  }): Promise<void> {
    const remote = await this.discoverRemoteCandidates(
      input.sourceType,
      input.location,
    );
    const runs = discoverLatestArtifactRuns(remote.objects, remote.prefix);
    const run = runs.find((candidate) => candidate.runId === input.candidateId);
    if (run == null) {
      throw new Error(`Unknown artifact candidate: ${input.candidateId}`);
    }

    const remoteConfig: DbtToolsRemoteSourceConfig =
      input.sourceType === "s3"
        ? { provider: "s3", bucket: remote.bucket, prefix: remote.prefix }
        : { provider: "gcs", bucket: remote.bucket, prefix: remote.prefix };
    const client = createRemoteObjectStoreClient(remoteConfig);
    const [manifestBytes, runResultsBytes, catalogBytes, sourcesBytes] =
      await Promise.all([
        client.readObjectBytes(remote.bucket, run.manifestKey),
        client.readObjectBytes(remote.bucket, run.runResultsKey),
        run.catalogKey
          ? client.readObjectBytes(remote.bucket, run.catalogKey)
          : Promise.resolve(null),
        run.sourcesKey
          ? client.readObjectBytes(remote.bucket, run.sourcesKey)
          : Promise.resolve(null),
      ]);

    this.manualSelection = {
      sourceType: input.sourceType,
      location: input.location,
      candidateId: input.candidateId,
      current: {
        source: "remote",
        manifestBytes,
        runResultsBytes,
        ...(catalogBytes != null ? { catalogBytes } : {}),
        ...(sourcesBytes != null ? { sourcesBytes } : {}),
      },
    };
  }

  async loadCandidate(input: {
    sourceType: DiscoverSourceType;
    location: string;
    candidateId: string;
  }): Promise<ArtifactSourceStatus> {
    const discovery = await this.discover({
      sourceType: input.sourceType,
      location: input.location,
    });

    const candidates = discovery.candidates.map((candidate) => ({
      ...candidate,
      artifacts: {},
    })) as ArtifactCandidateSet[];
    const selected = selectArtifactCandidate(candidates, input.candidateId);
    validateRequiredArtifacts(selected);

    if (input.sourceType === "local") {
      await this.loadLocalCandidate(input);
    } else {
      await this.loadRemoteCandidate(input);
    }

    return this.getStatus();
  }

  async getStatus(): Promise<ArtifactSourceStatus> {
    if (this.manualSelection != null) {
      return toArtifactSourceStatus({
        mode:
          this.manualSelection.sourceType === "local" ? "preload" : "remote",
        currentSource: this.manualSelection.current.source,
        label: "Selected source",
        remoteProvider:
          this.manualSelection.sourceType === "local"
            ? null
            : this.manualSelection.sourceType,
        remoteLocation:
          this.manualSelection.sourceType === "local"
            ? this.manualSelection.location
            : this.manualSelection.location,
        pollIntervalMs: null,
        currentRun: {
          runId: this.manualSelection.candidateId,
          label: this.manualSelection.candidateId,
          updatedAtMs: Date.now(),
          versionToken: `${this.manualSelection.sourceType}:${this.manualSelection.location}:${this.manualSelection.candidateId}`,
        },
        pendingRun: null,
        supportsSwitch: false,
      });
    }

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
    if (this.manualSelection != null) return this.manualSelection.current;
    return this.adapter?.getCurrentArtifacts() ?? null;
  }

  async switchToRun(runId?: string): Promise<ArtifactSourceStatus> {
    if (this.adapter == null) return this.getStatus();
    return this.adapter.switchToRun(runId);
  }
}
