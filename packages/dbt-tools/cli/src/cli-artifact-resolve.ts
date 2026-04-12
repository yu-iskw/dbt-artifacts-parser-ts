import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
  discoverArtifactCandidates,
  discoverLocalArtifactRunPaths,
  getDbtToolsRemoteSourceConfigFromEnv,
  joinObjectStorageKey,
  mergeRemoteSourceConfigWithParsedLocation,
  normalizeArtifactPrefix,
  parseArtifactSourceLocation,
  remoteKeysToListedArtifacts,
  resolveArtifactPaths,
  type ArtifactPaths,
  type ArtifactSourceKind,
} from "@dbt-tools/core";
import { createRemoteObjectStoreClient } from "@dbt-tools/core/artifact-io";

/** Shared CLI flags for directory / object-prefix artifact loading. */
export type ArtifactRootCliOptions = {
  source?: string;
  location?: string;
  runId?: string;
};

export type LegacyArtifactCliInput = {
  manifestPath?: string;
  runResultsPath?: string;
  targetDir?: string;
  catalogPath?: string;
  sourcesPath?: string;
};

interface PickableRun {
  runId: string;
}

function pickRun<T extends PickableRun>(
  runs: T[],
  runId: string | undefined,
): T {
  if (runs.length === 0) {
    throw new Error(
      "No complete manifest.json + run_results.json pairs found at this location.",
    );
  }
  if (runs.length > 1 && (runId == null || runId.trim() === "")) {
    throw new Error(
      `Multiple artifact sets found (${runs.length}). Re-run with --run-id <id>. Candidates: ${runs.map((r) => r.runId).join(", ")}`,
    );
  }
  if (runId != null && runId.trim() !== "") {
    const found = runs.find((r) => r.runId === runId);
    if (found == null) {
      throw new Error(
        `Unknown --run-id "${runId}". Candidates: ${runs.map((r) => r.runId).join(", ")}`,
      );
    }
    return found;
  }
  return runs[0]!;
}

interface RemoteResolvedRun extends PickableRun {
  manifestKey: string;
  runResultsKey: string;
  catalogKey?: string;
  sourcesKey?: string;
  updatedAtMs: number;
  versionToken: string;
}

async function writeRemoteBytesToTemp(
  bucket: string,
  client: ReturnType<typeof createRemoteObjectStoreClient>,
  run: RemoteResolvedRun,
): Promise<ArtifactPaths> {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), "dbt-tools-cli-artifacts-"),
  );
  const write = async (key: string, name: string) => {
    const bytes = await client.readObjectBytes(bucket, key);
    const filePath = path.join(dir, name);
    await fs.writeFile(filePath, bytes);
    return filePath;
  };

  const manifest = await write(run.manifestKey, "manifest.json");
  const runResults = await write(run.runResultsKey, "run_results.json");
  let catalog: string | undefined;
  let sources: string | undefined;
  if (run.catalogKey != null) {
    try {
      catalog = await write(run.catalogKey, "catalog.json");
    } catch {
      catalog = undefined;
    }
  }
  if (run.sourcesKey != null) {
    try {
      sources = await write(run.sourcesKey, "sources.json");
    } catch {
      sources = undefined;
    }
  }
  return {
    manifest,
    runResults,
    ...(catalog != null ? { catalog } : {}),
    ...(sources != null ? { sources } : {}),
  };
}

/**
 * Resolve artifact JSON paths using the same directory/prefix model as the web app.
 */
export async function resolveArtifactPathsFromSourceLocation(options: {
  source: ArtifactSourceKind;
  location: string;
  runId?: string;
  cwd?: string;
}): Promise<ArtifactPaths> {
  const cwd = options.cwd ?? process.cwd();
  const parsed = parseArtifactSourceLocation(
    options.source,
    options.location,
    cwd,
  );

  if (parsed.kind === "local") {
    const { discovery, runs } = await discoverLocalArtifactRunPaths(
      parsed.resolvedPath,
    );
    if (!discovery.ok) {
      throw new Error(discovery.failure.message);
    }
    const pick = pickRun(runs, options.runId);
    return {
      manifest: pick.manifestKey,
      runResults: pick.runResultsKey,
      ...(pick.catalogKey != null ? { catalog: pick.catalogKey } : {}),
      ...(pick.sourcesKey != null ? { sources: pick.sourcesKey } : {}),
    };
  }

  const env = getDbtToolsRemoteSourceConfigFromEnv();
  const merged = mergeRemoteSourceConfigWithParsedLocation(env, parsed);
  const client = createRemoteObjectStoreClient(merged);
  const prefixNorm = normalizeArtifactPrefix(merged.prefix);
  const objects = await client.listObjects(merged.bucket, prefixNorm);
  const listed = remoteKeysToListedArtifacts(objects, merged.prefix);
  const discovery = discoverArtifactCandidates(listed);
  if (!discovery.ok) {
    throw new Error(discovery.failure.message);
  }
  const runs: RemoteResolvedRun[] = discovery.candidates.map((c) => ({
    runId: c.runId,
    manifestKey: joinObjectStorageKey(prefixNorm, c.manifestRelative),
    runResultsKey: joinObjectStorageKey(prefixNorm, c.runResultsRelative),
    ...(c.catalogRelative != null
      ? { catalogKey: joinObjectStorageKey(prefixNorm, c.catalogRelative) }
      : {}),
    ...(c.sourcesRelative != null
      ? { sourcesKey: joinObjectStorageKey(prefixNorm, c.sourcesRelative) }
      : {}),
    updatedAtMs: c.updatedAtMs,
    versionToken: c.versionToken,
  }));
  const pick = pickRun(runs, options.runId);
  return writeRemoteBytesToTemp(merged.bucket, client, pick);
}

function assertNotMixedWithLegacyPaths(legacy: LegacyArtifactCliInput): void {
  const hasLegacy =
    (legacy.manifestPath != null && legacy.manifestPath.trim() !== "") ||
    (legacy.runResultsPath != null && legacy.runResultsPath.trim() !== "") ||
    (legacy.catalogPath != null && legacy.catalogPath !== "") ||
    (legacy.sourcesPath != null && legacy.sourcesPath !== "");
  if (hasLegacy) {
    throw new Error(
      "Do not combine --source/--location with manifest, run_results, catalog, or sources path arguments; use directory/prefix mode only.",
    );
  }
}

export function assertArtifactCliOptions(
  source: string | undefined,
  location: string | undefined,
): void {
  const hasSource = source === "local" || source === "s3" || source === "gcs";
  const hasLoc = location != null && location.trim() !== "";
  if (hasSource !== hasLoc) {
    throw new Error(
      "When using directory/prefix mode, pass both --source and --location together.",
    );
  }
}

/**
 * Resolve paths from `--source` / `--location` / `--run-id`, or fall back to
 * {@link resolveArtifactPaths} for legacy per-file and target-dir behavior.
 */
export async function resolveCliArtifactPaths(
  legacy: LegacyArtifactCliInput,
  roots: ArtifactRootCliOptions,
): Promise<ArtifactPaths> {
  assertArtifactCliOptions(roots.source, roots.location);

  const hasNew =
    roots.source === "local" || roots.source === "s3" || roots.source === "gcs";

  if (roots.runId != null && roots.runId !== "" && !hasNew) {
    throw new Error("--run-id is only valid with --source and --location.");
  }

  if (hasNew) {
    assertNotMixedWithLegacyPaths(legacy);
    return resolveArtifactPathsFromSourceLocation({
      source: roots.source as ArtifactSourceKind,
      location: roots.location!.trim(),
      runId: roots.runId,
    });
  }

  return resolveArtifactPaths(
    legacy.manifestPath,
    legacy.runResultsPath,
    legacy.targetDir,
    legacy.catalogPath,
    legacy.sourcesPath,
  );
}
