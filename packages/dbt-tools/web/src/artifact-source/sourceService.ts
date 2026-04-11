/** Node (Vite dev) service: local target dir vs remote S3/GCS; drives middleware routes. */
import fs from "node:fs/promises";
import path from "node:path";
import {
  DBT_MANIFEST_JSON,
  DBT_RUN_RESULTS_JSON,
  getDbtToolsRemoteSourceConfigFromEnv,
  getDbtToolsTargetDirFromEnv,
  isDbtToolsDebugEnabled,
  type DbtToolsRemoteSourceConfig,
} from "@dbt-tools/core";
import {
  discoverLatestArtifactRuns,
  toRemoteArtifactRun,
  type ResolvedArtifactRun,
} from "./discovery";
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
}

export interface ArtifactSourceAdapter {
  getStatus(selectedRunId?: string): Promise<ArtifactSourceStatus>;
  getCurrentArtifacts(
    selectedRunId?: string,
  ): Promise<CurrentArtifactPayload | null>;
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
      const [manifestBytes, runResultsBytes] = await Promise.all([
        fs.readFile(path.join(this.targetDir, DBT_MANIFEST_JSON)),
        fs.readFile(path.join(this.targetDir, DBT_RUN_RESULTS_JSON)),
      ]);

      return {
        source: "preload",
        manifestBytes,
        runResultsBytes,
      };
    } catch {
      return null;
    }
  }
}

class RemoteArtifactSourceAdapter implements ArtifactSourceAdapter {
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

  private chooseRun(
    runs: ResolvedArtifactRun[],
    selectedRunId?: string,
  ): {
    selectedRun: ResolvedArtifactRun | null;
    pendingRun: ResolvedArtifactRun | null;
  } {
    const latestRun = runs[0] ?? null;
    if (latestRun == null) {
      return { selectedRun: null, pendingRun: null };
    }

    const selectedRun =
      selectedRunId == null
        ? latestRun
        : (runs.find((run) => run.runId === selectedRunId) ?? latestRun);
    const pendingRun = latestRun.runId === selectedRun.runId ? null : latestRun;

    return { selectedRun, pendingRun };
  }

  async getStatus(selectedRunId?: string): Promise<ArtifactSourceStatus> {
    const runs = await this.resolveRuns();
    const { selectedRun, pendingRun } = this.chooseRun(runs, selectedRunId);

    return toArtifactSourceStatus({
      mode: "remote",
      currentSource: selectedRun == null ? null : "remote",
      label: "Remote source",
      remoteProvider: this.config.provider,
      remoteLocation: toLocationLabel(
        this.config.provider,
        this.config.bucket,
        normalizeArtifactPrefix(this.config.prefix),
      ),
      pollIntervalMs: this.config.pollIntervalMs,
      currentRun:
        selectedRun == null
          ? null
          : toRemoteArtifactRun(this.config.provider, selectedRun),
      pendingRun:
        pendingRun == null
          ? null
          : toRemoteArtifactRun(this.config.provider, pendingRun),
      supportsSwitch: pendingRun != null,
    });
  }

  async getCurrentArtifacts(
    selectedRunId?: string,
  ): Promise<CurrentArtifactPayload | null> {
    const runs = await this.resolveRuns();
    const { selectedRun } = this.chooseRun(runs, selectedRunId);
    if (selectedRun == null) return null;

    const [manifestBytes, runResultsBytes] = await Promise.all([
      this.client.readObjectBytes(this.config.bucket, selectedRun.manifestKey),
      this.client.readObjectBytes(
        this.config.bucket,
        selectedRun.runResultsKey,
      ),
    ]);

    return {
      source: "remote",
      manifestBytes,
      runResultsBytes,
    };
  }
}

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

  async getStatus(selectedRunId?: string): Promise<ArtifactSourceStatus> {
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
    return this.adapter.getStatus(selectedRunId);
  }

  async getCurrentArtifacts(
    selectedRunId?: string,
  ): Promise<CurrentArtifactPayload | null> {
    return this.adapter?.getCurrentArtifacts(selectedRunId) ?? null;
  }
}
