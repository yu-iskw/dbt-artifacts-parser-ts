// Export latest version by default
export * from "./v3";

// Versioned exports
export type { Sources as SourcesV1 } from "./v1";
export type { HttpsSchemasGetdbtComDbtSourcesV2Json as SourcesV2 } from "./v2";
export type { FreshnessExecutionResultArtifact as SourceV3 } from "./v3";

// Import types for union
import type { Sources as SourcesV1Type } from "./v1";
import type { HttpsSchemasGetdbtComDbtSourcesV2Json as SourcesV2Type } from "./v2";
import type { FreshnessExecutionResultArtifact as SourceV3Type } from "./v3";

// Union type for all sources versions
export type ParsedSources = SourcesV1Type | SourcesV2Type | SourceV3Type;

/**
 * Extract version number from dbt schema version string
 * @param dbtSchemaVersion - Schema version string like "https://schemas.getdbt.com/dbt/sources/v3.json"
 * @returns Version number as integer
 * @throws Error if version cannot be extracted
 */
function getSourcesVersion(dbtSchemaVersion: string): number {
  const match = dbtSchemaVersion.match(/\/sources\/v(\d+)\.json$/);
  if (!match) {
    throw new Error(`Invalid dbt schema version format: ${dbtSchemaVersion}`);
  }
  return parseInt(match[1], 10);
}

/**
 * Validate sources structure and extract version
 * @param sources - Parsed sources.json object
 * @param expectedVersion - Optional expected version for version-specific parsers
 * @returns Version number as integer
 * @throws Error if sources is invalid or version doesn't match expected
 */
function validateSourcesAndGetVersion(
  sources: Record<string, unknown>,
  expectedVersion?: number,
): number {
  if (!sources || typeof sources !== "object" || !("metadata" in sources)) {
    throw new Error("Not a sources.json");
  }

  const metadata = sources.metadata as any;
  if (
    !metadata ||
    typeof metadata !== "object" ||
    typeof metadata.dbt_schema_version !== "string"
  ) {
    throw new Error("Not a sources.json");
  }

  const version = getSourcesVersion(metadata.dbt_schema_version);
  if (expectedVersion !== undefined && version !== expectedVersion) {
    throw new Error(`Not a sources.json v${expectedVersion}`);
  }
  return version;
}

/**
 * Parse sources.json object and return appropriately typed sources based on version
 * @param sources - Parsed sources.json object
 * @returns Typed sources object
 * @throws Error if sources is invalid or version is unsupported
 */
export function parseSources(sources: Record<string, unknown>): ParsedSources {
  const version = validateSourcesAndGetVersion(sources);

  // Return appropriately typed sources based on version
  switch (version) {
    case 1:
      return sources as unknown as SourcesV1Type;
    case 2:
      return sources as unknown as SourcesV2Type;
    case 3:
      return sources as unknown as SourceV3Type;
    default:
      throw new Error(`Unsupported sources version: ${version}`);
  }
}

/**
 * Parse sources.json v1
 * @param sources - Parsed sources.json object
 * @returns SourcesV1
 */
export function parseSourcesV1(
  sources: Record<string, unknown>,
): SourcesV1Type {
  validateSourcesAndGetVersion(sources, 1);
  return sources as unknown as SourcesV1Type;
}

/**
 * Parse sources.json v2
 * @param sources - Parsed sources.json object
 * @returns SourcesV2
 */
export function parseSourcesV2(
  sources: Record<string, unknown>,
): SourcesV2Type {
  validateSourcesAndGetVersion(sources, 2);
  return sources as unknown as SourcesV2Type;
}

/**
 * Parse sources.json v3
 * @param sources - Parsed sources.json object
 * @returns FreshnessExecutionResultArtifactV3
 */
export function parseSourcesV3(sources: Record<string, unknown>): SourceV3Type {
  validateSourcesAndGetVersion(sources, 3);
  return sources as unknown as SourceV3Type;
}
