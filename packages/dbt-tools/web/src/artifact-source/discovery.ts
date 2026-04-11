import path from "node:path";
import {
  DBT_CATALOG_JSON,
  DBT_MANIFEST_JSON,
  DBT_RUN_RESULTS_JSON,
  DBT_SOURCES_JSON,
} from "@dbt-tools/core";
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

function runIdForKey(relativeKey: string): string {
  const dir = path.posix.dirname(relativeKey);
  return dir === "." ? "current" : dir;
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

export function discoverLatestArtifactRuns(
  objects: RemoteObjectMetadata[],
  prefix: string,
): ResolvedArtifactRun[] {
  const grouped = new Map<
    string,
    {
      manifest?: RemoteObjectMetadata;
      runResults?: RemoteObjectMetadata;
      catalog?: RemoteObjectMetadata;
      sources?: RemoteObjectMetadata;
    }
  >();

  for (const object of objects) {
    const relativeKey = toRelativeKey(object.key, prefix);
    if (relativeKey == null) continue;

    const fileName = path.posix.basename(relativeKey);
    if (
      fileName !== DBT_MANIFEST_JSON &&
      fileName !== DBT_RUN_RESULTS_JSON &&
      fileName !== DBT_CATALOG_JSON &&
      fileName !== DBT_SOURCES_JSON
    )
      continue;

    const runId = runIdForKey(relativeKey);
    const current = grouped.get(runId) ?? {};

    if (fileName === DBT_MANIFEST_JSON) current.manifest = object;
    if (fileName === DBT_RUN_RESULTS_JSON) current.runResults = object;
    if (fileName === DBT_CATALOG_JSON) current.catalog = object;
    if (fileName === DBT_SOURCES_JSON) current.sources = object;

    grouped.set(runId, current);
  }

  return [...grouped.entries()]
    .flatMap(([runId, parts]) => {
      if (parts.manifest == null || parts.runResults == null) return [];
      return [
        {
          runId,
          manifestKey: parts.manifest.key,
          runResultsKey: parts.runResults.key,
          ...(parts.catalog != null ? { catalogKey: parts.catalog.key } : {}),
          ...(parts.sources != null ? { sourcesKey: parts.sources.key } : {}),
          updatedAtMs: Math.max(
            parts.manifest.updatedAtMs,
            parts.runResults.updatedAtMs,
          ),
          versionToken: versionTokenForKeys(
            [
              parts.manifest,
              parts.runResults,
              parts.catalog,
              parts.sources,
            ].filter((part): part is RemoteObjectMetadata => part != null),
          ),
        },
      ];
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
