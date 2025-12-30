// Export latest version by default
export * from "./v6";

// Versioned exports
export type { RunResults as RunResultsV1 } from "./v1";
export type { RunResults as RunResultsV2 } from "./v2";
export type { HttpsSchemasGetdbtComDbtRunResultsV3Json as RunResultsV3 } from "./v3";
export type { HttpsSchemasGetdbtComDbtRunResultsV4Json as RunResultsV4 } from "./v4";
export type { RunResultsArtifact as RunResultsArtifactV5 } from "./v5";
export type { RunResultsArtifact as RunResultsArtifactV6 } from "./v6";

// Import types for union
import type { RunResults as RunResultsV1Type } from "./v1";
import type { RunResults as RunResultsV2Type } from "./v2";
import type { HttpsSchemasGetdbtComDbtRunResultsV3Json as RunResultsV3Type } from "./v3";
import type { HttpsSchemasGetdbtComDbtRunResultsV4Json as RunResultsV4Type } from "./v4";
import type { RunResultsArtifact as RunResultsV5Type } from "./v5";
import type { RunResultsArtifact as RunResultsV6Type } from "./v6";

// Union type for all run_results versions
export type ParsedRunResults =
  | RunResultsV1Type
  | RunResultsV2Type
  | RunResultsV3Type
  | RunResultsV4Type
  | RunResultsV5Type
  | RunResultsV6Type;

/**
 * Extract version number from dbt schema version string
 * @param dbtSchemaVersion - Schema version string like "https://schemas.getdbt.com/dbt/run-results/v6.json"
 * @returns Version number as integer
 * @throws Error if version cannot be extracted
 */
function getRunResultsVersion(dbtSchemaVersion: string): number {
  const match = dbtSchemaVersion.match(/\/run-results\/v(\d+)\.json$/);
  if (!match) {
    throw new Error(`Invalid dbt schema version format: ${dbtSchemaVersion}`);
  }
  return parseInt(match[1], 10);
}

/**
 * Validate run results structure and extract version
 * @param runResults - Parsed run-results.json object
 * @param expectedVersion - Optional expected version for version-specific parsers
 * @returns Version number as integer
 * @throws Error if run results is invalid or version doesn't match expected
 */
function validateRunResultsAndGetVersion(
  runResults: Record<string, unknown>,
  expectedVersion?: number,
): number {
  if (
    !runResults ||
    typeof runResults !== "object" ||
    !("metadata" in runResults)
  ) {
    throw new Error("Not a run-results.json");
  }

  const metadata = runResults.metadata as any;
  if (
    !metadata ||
    typeof metadata !== "object" ||
    typeof metadata.dbt_schema_version !== "string"
  ) {
    throw new Error("Not a run-results.json");
  }

  const version = getRunResultsVersion(metadata.dbt_schema_version);
  if (expectedVersion !== undefined && version !== expectedVersion) {
    throw new Error(`Not a run-results.json v${expectedVersion}`);
  }
  return version;
}

/**
 * Parse run-results.json object and return appropriately typed run results based on version
 * @param runResults - Parsed run-results.json object
 * @returns Typed run results object
 * @throws Error if run results is invalid or version is unsupported
 */
export function parseRunResults(
  runResults: Record<string, unknown>,
): ParsedRunResults {
  const version = validateRunResultsAndGetVersion(runResults);

  // Return appropriately typed run results based on version
  switch (version) {
    case 1:
      return runResults as unknown as RunResultsV1Type;
    case 2:
      return runResults as unknown as RunResultsV2Type;
    case 3:
      return runResults as unknown as RunResultsV3Type;
    case 4:
      return runResults as unknown as RunResultsV4Type;
    case 5:
      return runResults as unknown as RunResultsV5Type;
    case 6:
      return runResults as unknown as RunResultsV6Type;
    default:
      throw new Error(`Unsupported run-results version: ${version}`);
  }
}

/**
 * Parse run-results.json v1
 * @param runResults - Parsed run-results.json object
 * @returns RunResultsV1
 */
export function parseRunResultsV1(
  runResults: Record<string, unknown>,
): RunResultsV1Type {
  validateRunResultsAndGetVersion(runResults, 1);
  return runResults as unknown as RunResultsV1Type;
}

/**
 * Parse run-results.json v2
 * @param runResults - Parsed run-results.json object
 * @returns RunResultsV2
 */
export function parseRunResultsV2(
  runResults: Record<string, unknown>,
): RunResultsV2Type {
  validateRunResultsAndGetVersion(runResults, 2);
  return runResults as unknown as RunResultsV2Type;
}

/**
 * Parse run-results.json v3
 * @param runResults - Parsed run-results.json object
 * @returns RunResultsV3
 */
export function parseRunResultsV3(
  runResults: Record<string, unknown>,
): RunResultsV3Type {
  validateRunResultsAndGetVersion(runResults, 3);
  return runResults as unknown as RunResultsV3Type;
}

/**
 * Parse run-results.json v4
 * @param runResults - Parsed run-results.json object
 * @returns RunResultsV4
 */
export function parseRunResultsV4(
  runResults: Record<string, unknown>,
): RunResultsV4Type {
  validateRunResultsAndGetVersion(runResults, 4);
  return runResults as unknown as RunResultsV4Type;
}

/**
 * Parse run-results.json v5
 * @param runResults - Parsed run-results.json object
 * @returns RunResultsArtifactV5
 */
export function parseRunResultsV5(
  runResults: Record<string, unknown>,
): RunResultsV5Type {
  validateRunResultsAndGetVersion(runResults, 5);
  return runResults as unknown as RunResultsV5Type;
}

/**
 * Parse run-results.json v6
 * @param runResults - Parsed run-results.json object
 * @returns RunResultsArtifactV6
 */
export function parseRunResultsV6(
  runResults: Record<string, unknown>,
): RunResultsV6Type {
  validateRunResultsAndGetVersion(runResults, 6);
  return runResults as unknown as RunResultsV6Type;
}
