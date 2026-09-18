// Export latest version by default
// To use a specific version, import directly: import { Type } from './v0'
export * from "./v0";
import { tryFallbackToLatest, type ParseOptions } from "../parseOptions";
import type { FreshnessExecutionResultArtifact } from "./v0";

/**
 * Union type of all supported freshness.json versions
 */
export type ParsedFreshness = FreshnessExecutionResultArtifact;

export type { ParseOptions } from "../parseOptions";

const ERR_NOT_FRESHNESS = "Not a freshness.json";
const ERR_NOT_FRESHNESS_V0 = "Not a freshness.json v0";
const FRESHNESS_MAX_VERSION = 0;

/**
 * Extract version number from dbt_schema_version URL.
 * freshness.json is published as v0, so `0` is a valid version.
 */
function extractVersion(schemaVersion: string | undefined): number | null {
  if (!schemaVersion) {
    return null;
  }
  const match = schemaVersion.match(/\/freshness\/v(\d+)\.json$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Parse freshness.json v0
 * @param parsed - Parsed JSON object
 * @returns FreshnessExecutionResultArtifact v0
 * @throws Error if not a freshness.json v0
 */
export function parseFreshnessV0(
  parsed: Record<string, unknown>,
): FreshnessExecutionResultArtifact {
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    throw new Error(ERR_NOT_FRESHNESS_V0);
  }

  const schemaVersion = metadata.dbt_schema_version as string | undefined;
  if (!schemaVersion || !schemaVersion.includes("/freshness/v0.json")) {
    throw new Error(ERR_NOT_FRESHNESS_V0);
  }

  return parsed as unknown as FreshnessExecutionResultArtifact;
}

const FRESHNESS_PARSERS: Record<
  number,
  (parsed: Record<string, unknown>) => FreshnessExecutionResultArtifact
> = {
  0: parseFreshnessV0,
};

/**
 * Parse freshness.json with automatic version detection.
 * Status values stay in the published v0 enum (`Pass` | `Warn` | `Error`).
 */
export function parseFreshness(
  parsed: Record<string, unknown>,
  options?: ParseOptions,
): ParsedFreshness {
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    throw new Error(ERR_NOT_FRESHNESS);
  }

  const schemaVersion = metadata.dbt_schema_version as string | undefined;
  if (!schemaVersion || !schemaVersion.includes("/freshness/v")) {
    throw new Error(ERR_NOT_FRESHNESS);
  }

  const version = extractVersion(schemaVersion);
  if (version === null) {
    throw new Error(ERR_NOT_FRESHNESS);
  }

  const parser = FRESHNESS_PARSERS[version];
  if (parser) {
    return parser(parsed);
  }
  const fallback = tryFallbackToLatest(
    options,
    version,
    FRESHNESS_MAX_VERSION,
    schemaVersion,
    parsed as unknown as FreshnessExecutionResultArtifact,
  );
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(`Unsupported freshness version: ${version}`);
}
