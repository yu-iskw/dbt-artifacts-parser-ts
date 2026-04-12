import path from "node:path";
import {
  DBT_CATALOG_JSON,
  DBT_MANIFEST_JSON,
  DBT_RUN_RESULTS_JSON,
  DBT_SOURCES_JSON,
} from "../../../core/src/io/artifact-filenames";
import {
  discoverArtifactCandidateSets,
  type ArtifactCandidateSet,
  type DiscoveredArtifactFile,
} from "../../../core/src/io/artifact-discovery";
import type {
  RemoteArtifactProvider,
  RemoteArtifactRun,
} from "../services/artifactSourceApi";
import { normalizeArtifactPrefix } from "./prefix";

export interface RemoteObjectMetadata {
  key: string;
  updatedAtMs: number;
  etag?: string;
  generation?: string;
}

export interface ResolvedArtifactRun {
  runId: string;
  manifestKey: string;
  runResultsKey: string;
  catalogKey?: string;
  sourcesKey?: string;
  updatedAtMs: number;
  versionToken: string;
  missingOptional: string[];
}

function toRelativeKey(key: string, prefix: string): string | null {
  const normalizedKey = key.replace(/^\/+/, "");
  const normalizedPrefix = normalizeArtifactPrefix(prefix);
  if (normalizedPrefix === "") return normalizedKey;
  if (normalizedKey === normalizedPrefix) return "";
  if (normalizedKey.startsWith(`${normalizedPrefix}/`)) {
    return normalizedKey.slice(normalizedPrefix.length + 1);
  }
  return null;
}

function versionTokenForKeys(parts: RemoteObjectMetadata[]): string {
  return parts
    .map((part) =>
      [part.key, part.updatedAtMs, part.etag ?? "", part.generation ?? ""].join(
        ":",
      ),
    )
    .join("|");
}

function toDiscoveredFiles(
  objects: RemoteObjectMetadata[],
  prefix: string,
): DiscoveredArtifactFile[] {
  const files: DiscoveredArtifactFile[] = [];

  for (const object of objects) {
    const relativeKey = toRelativeKey(object.key, prefix);
    if (relativeKey == null || relativeKey === "") continue;
    const fileName = path.posix.basename(relativeKey);
    if (
      fileName !== DBT_MANIFEST_JSON &&
      fileName !== DBT_RUN_RESULTS_JSON &&
      fileName !== DBT_CATALOG_JSON &&
      fileName !== DBT_SOURCES_JSON
    ) {
      continue;
    }

    files.push({
      relativePath: relativeKey,
      filename: fileName,
      updatedAtMs: object.updatedAtMs,
    });
  }

  return files;
}

function candidateToResolvedRun(
  candidate: ArtifactCandidateSet,
  byPath: Map<string, RemoteObjectMetadata>,
  prefix: string,
): ResolvedArtifactRun | null {
  const manifestRelative = candidate.artifacts[DBT_MANIFEST_JSON]?.relativePath;
  const runResultsRelative =
    candidate.artifacts[DBT_RUN_RESULTS_JSON]?.relativePath;
  if (manifestRelative == null || runResultsRelative == null) return null;

  const manifestKey =
    prefix.trim() === ""
      ? manifestRelative
      : `${normalizeArtifactPrefix(prefix)}/${manifestRelative}`;
  const runResultsKey =
    prefix.trim() === ""
      ? runResultsRelative
      : `${normalizeArtifactPrefix(prefix)}/${runResultsRelative}`;

  const manifestObj = byPath.get(manifestRelative);
  const runObj = byPath.get(runResultsRelative);
  if (manifestObj == null || runObj == null) return null;

  const catalogRelative = candidate.artifacts[DBT_CATALOG_JSON]?.relativePath;
  const sourcesRelative = candidate.artifacts[DBT_SOURCES_JSON]?.relativePath;
  const catalogObj = catalogRelative ? byPath.get(catalogRelative) : undefined;
  const sourcesObj = sourcesRelative ? byPath.get(sourcesRelative) : undefined;

  return {
    runId: candidate.candidateId,
    manifestKey,
    runResultsKey,
    ...(catalogRelative
      ? {
          catalogKey:
            prefix.trim() === ""
              ? catalogRelative
              : `${normalizeArtifactPrefix(prefix)}/${catalogRelative}`,
        }
      : {}),
    ...(sourcesRelative
      ? {
          sourcesKey:
            prefix.trim() === ""
              ? sourcesRelative
              : `${normalizeArtifactPrefix(prefix)}/${sourcesRelative}`,
        }
      : {}),
    updatedAtMs: Math.max(manifestObj.updatedAtMs, runObj.updatedAtMs),
    versionToken: versionTokenForKeys(
      [manifestObj, runObj, catalogObj, sourcesObj].filter(
        (part): part is RemoteObjectMetadata => part != null,
      ),
    ),
    missingOptional: candidate.missingOptional,
  };
}

export function discoverLatestArtifactRuns(
  objects: RemoteObjectMetadata[],
  prefix: string,
): ResolvedArtifactRun[] {
  const discoveredFiles = toDiscoveredFiles(objects, prefix);
  const candidates = discoverArtifactCandidateSets(discoveredFiles);
  const byRelativePath = new Map<string, RemoteObjectMetadata>();

  for (const object of objects) {
    const relativeKey = toRelativeKey(object.key, prefix);
    if (relativeKey != null && relativeKey !== "") {
      byRelativePath.set(relativeKey, object);
    }
  }

  return candidates
    .flatMap((candidate) => {
      if (!candidate.isLoadable) return [];
      const run = candidateToResolvedRun(candidate, byRelativePath, prefix);
      return run == null ? [] : [run];
    })
    .sort((left, right) => {
      if (right.updatedAtMs !== left.updatedAtMs) {
        return right.updatedAtMs - left.updatedAtMs;
      }
      return right.runId.localeCompare(left.runId);
    });
}

export function toRemoteArtifactRun(
  provider: RemoteArtifactProvider,
  run: ResolvedArtifactRun,
): RemoteArtifactRun {
  return {
    runId: run.runId,
    label:
      run.runId === "current"
        ? `${provider.toUpperCase()} current`
        : `${provider.toUpperCase()} ${run.runId}`,
    updatedAtMs: run.updatedAtMs,
    versionToken: run.versionToken,
  };
}
