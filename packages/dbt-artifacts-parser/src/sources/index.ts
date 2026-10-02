// Export latest version by default
// To use a specific version, import directly: import { Type } from './v3'
export * from "./v3";
import type { Sources as SourcesV1 } from "./v1";
import type { HttpsSchemasGetdbtComDbtSourcesV2Json as SourcesV2 } from "./v2";
import { normalizeSourcesV3 } from "../compatibility/sources";
import { tryFallbackToLatest, type ParseOptions } from "../parseOptions";
import type { FreshnessExecutionResultArtifact as SourcesV3 } from "./v3";

/**
 * Union type of all supported sources versions
 */
export type ParsedSources = SourcesV1 | SourcesV2 | SourcesV3;

export type { ParseOptions } from "../parseOptions";

const ERR_NOT_SOURCES = "Not a sources.json";

/**
 * Extract version number from dbt_schema_version URL
 */
function extractVersion(schemaVersion: string | undefined): number | null {
  if (!schemaVersion) {
    return null;
  }
  const match = schemaVersion.match(/\/sources\/v(\d+)\.json$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Parse sources.json v1
 */
export function parseSourcesV1(parsed: Record<string, unknown>): SourcesV1 {
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    throw new Error("Not a sources.json v1");
  }

  const schemaVersion = metadata.dbt_schema_version as string | undefined;
  if (!schemaVersion || !schemaVersion.includes("/sources/v1.json")) {
    throw new Error("Not a sources.json v1");
  }

  return parsed as unknown as SourcesV1;
}

/**
 * Parse sources.json v2
 */
export function parseSourcesV2(parsed: Record<string, unknown>): SourcesV2 {
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    throw new Error("Not a sources.json v2");
  }

  const schemaVersion = metadata.dbt_schema_version as string | undefined;
  if (!schemaVersion || !schemaVersion.includes("/sources/v2.json")) {
    throw new Error("Not a sources.json v2");
  }

  return parsed as unknown as SourcesV2;
}

/**
 * Parse sources.json v3
 */
export function parseSourcesV3(parsed: Record<string, unknown>): SourcesV3 {
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    throw new Error("Not a sources.json v3");
  }

  const schemaVersion = metadata.dbt_schema_version as string | undefined;
  if (!schemaVersion || !schemaVersion.includes("/sources/v3.json")) {
    throw new Error("Not a sources.json v3");
  }

  return normalizeSourcesV3(parsed) as unknown as SourcesV3;
}

const SOURCES_PARSERS = [
  parseSourcesV1,
  parseSourcesV2,
  parseSourcesV3,
] as const;

/**
 * Parse sources.json with automatic version detection
 */
export function parseSources(
  parsed: Record<string, unknown>,
  options?: ParseOptions,
): ParsedSources {
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata) throw new Error(ERR_NOT_SOURCES);
  const schemaVersion = metadata.dbt_schema_version as string | undefined;
  if (!schemaVersion || !schemaVersion.includes("/sources/v"))
    throw new Error(ERR_NOT_SOURCES);
  const version = extractVersion(schemaVersion);
  if (version === null) throw new Error(ERR_NOT_SOURCES);
  const parser = SOURCES_PARSERS[version - 1];
  if (parser) {
    return parser(parsed);
  }
  const fallback = tryFallbackToLatest(
    options,
    version,
    SOURCES_PARSERS.length,
    schemaVersion,
    parsed as unknown as SourcesV3,
  );
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(`Unsupported sources version: ${version}`);
}
