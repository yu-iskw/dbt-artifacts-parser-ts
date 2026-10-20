// Export latest version by default
// To use a specific version, import directly: import { Type } from './v3'
export * from "./v3";
import type { Sources as SourcesV1 } from "./v1";
import type { HttpsSchemasGetdbtComDbtSourcesV2Json as SourcesV2 } from "./v2";
import type { ParseOptions } from "../parseOptions";
import type { FreshnessExecutionResultArtifact as SourcesV3 } from "./v3";
import {
  identityCast,
  parseByVersion,
  slot,
  typedExact,
  versionTable,
} from "../versionTable";

/**
 * Union type of all supported sources versions
 */
export type ParsedSources = SourcesV1 | SourcesV2 | SourcesV3;

export type { ParseOptions } from "../parseOptions";

const SOURCES_SCHEMA = /\/sources\/v(\d+)\.json$/;

const SOURCE_V3_STATUS_REWRITE: ReadonlyMap<string, "pass" | "warn" | "error"> =
  new Map([
    ["Pass", "pass"],
    ["Warn", "warn"],
    ["Error", "error"],
  ]);

function sourcesSlot<T>(
  version: number,
  cast: (parsed: Record<string, unknown>) => T,
) {
  return slot({
    version,
    exactFragment: `/sources/v${version}.json`,
    mismatch: `Not a sources.json v${version}`,
    cast,
  });
}

function rowWithSourcesV3Status(row: unknown): unknown {
  if (typeof row !== "object" || row === null || Array.isArray(row)) {
    return row;
  }
  const record = row as Record<string, unknown>;
  const status = record.status;
  if (typeof status !== "string") {
    return row;
  }
  const rewritten = SOURCE_V3_STATUS_REWRITE.get(status);
  if (rewritten === undefined) {
    return row;
  }
  return { ...record, status: rewritten };
}

function copyRewrittenResults(results: unknown[]): unknown[] | undefined {
  let copied: unknown[] | undefined;
  for (let index = 0; index < results.length; index += 1) {
    const row = results[index];
    const next = rowWithSourcesV3Status(row);
    if (next === row) {
      copied?.push(row);
      continue;
    }
    if (copied === undefined) {
      copied = results.slice(0, index);
    }
    copied.push(next);
  }
  return copied;
}

function castSourcesV3(parsed: Record<string, unknown>): SourcesV3 {
  const results = parsed.results;
  if (!Array.isArray(results)) {
    return parsed as unknown as SourcesV3;
  }
  const copied = copyRewrittenResults(results);
  if (copied === undefined) {
    return parsed as unknown as SourcesV3;
  }
  return { ...parsed, results: copied } as unknown as SourcesV3;
}

const SOURCES = versionTable<ParsedSources>([
  sourcesSlot(1, identityCast<SourcesV1>()),
  sourcesSlot(2, identityCast<SourcesV2>()),
  sourcesSlot(3, castSourcesV3),
]);

export const parseSourcesV1 = typedExact<SourcesV1, ParsedSources>(SOURCES, 1);
export const parseSourcesV2 = typedExact<SourcesV2, ParsedSources>(SOURCES, 2);
export const parseSourcesV3 = typedExact<SourcesV3, ParsedSources>(SOURCES, 3);

export function parseSources(
  parsed: Record<string, unknown>,
  options?: ParseOptions,
): ParsedSources {
  return parseByVersion({
    table: SOURCES,
    schemaPattern: SOURCES_SCHEMA,
    notArtifactMessage: "Not a sources.json",
    unsupportedLabel: "sources",
    parsed,
    options,
  });
}
