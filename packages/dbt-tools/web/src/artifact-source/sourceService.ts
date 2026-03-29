import fs from "node:fs/promises";
import path from "node:path";
import {
  getDbtToolsRemoteSourceConfigFromEnv,
  getDbtToolsTargetDirFromEnv,
  isDbtToolsDebugEnabled,
  type DbtToolsRemoteSourceConfig,
} from "@dbt-tools/core";
import {
  discoverLatestArtifactRuns,
  MANIFEST_JSON,
  RUN_RESULTS_JSON,
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
        fs.readFile(path.join(this.targetDir, MANIFEST_JSON)),
        fs.readFile(path.join(this.targetDir, RUN_RESULTS_JSON)),
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

    const [manifestBytes, runResultsBytes] = await Promise.all([
      this.client.readObjectBytes(this.config.bucket, currentRun.manifestKey),
      this.client.readObjectBytes(this.config.bucket, currentRun.runResultsKey),
    ]);

    return {
      source: "remote",
      manifestBytes,
      runResultsBytes,
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
}
