import { tryFallbackToLatest, type ParseOptions } from "../parseOptions";
import type { FreshnessExecutionResultArtifact } from "./v0";

// Export latest version by default
// To use a specific version, import directly: import { Type } from './v0'
export * from "./v0";
export type { FreshnessExecutionResultArtifact as FreshnessArtifact } from "./v0";

/**
 * Union type of all supported freshness versions
 */
export type ParsedFreshness = FreshnessExecutionResultArtifact;

export type { ParseOptions } from "../parseOptions";

const ERR_NOT_FRESHNESS = "Not a freshness.json";

/**
 * Extract version number from dbt_schema_version URL.
 * Freshness starts at v0, so callers must treat `0` as a valid version.
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
 * @returns FreshnessArtifact v0
 * @throws Error if not a freshness.json v0
 */
export function parseFreshnessV0(
  parsed: Record<string, unknown>,
): FreshnessExecutionResultArtifact {
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    throw new Error("Not a freshness.json v0");
  }

  const schemaVersion = metadata.dbt_schema_version as string | undefined;
  if (!schemaVersion || !schemaVersion.includes("/freshness/v0.json")) {
    throw new Error("Not a freshness.json v0");
  }

  return parsed as unknown as FreshnessExecutionResultArtifact;
}

const FRESHNESS_PARSERS = {
  0: parseFreshnessV0,
} as const;

const FRESHNESS_MAX_VERSION = 0;

/**
 * Parse freshness.json with automatic version detection
 * @param parsed - Parsed JSON object
 * @returns ParsedFreshness (union type of all supported versions)
 * @throws Error if not a freshness.json or unsupported version
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

  const parser =
    version in FRESHNESS_PARSERS
      ? FRESHNESS_PARSERS[version as keyof typeof FRESHNESS_PARSERS]
      : undefined;
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
