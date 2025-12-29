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
 * Parse run-results.json object and return appropriately typed run results based on version
 * @param runResults - Parsed run-results.json object
 * @returns Typed run results object
 * @throws Error if run results is invalid or version is unsupported
 */
export function parseRunResults(
  runResults: Record<string, unknown>,
): ParsedRunResults {
  // Validate input structure
  if (
    !runResults ||
    typeof runResults !== "object" ||
    !("metadata" in runResults)
  ) {
    throw new Error("Not a run-results.json");
  }

  const metadata = runResults.metadata;
  if (
    !metadata ||
    typeof metadata !== "object" ||
    !("dbt_schema_version" in metadata)
  ) {
    throw new Error("Not a run-results.json");
  }

  // Extract and parse version
  const dbtSchemaVersion = (metadata as any).dbt_schema_version;
  if (typeof dbtSchemaVersion !== "string") {
    throw new Error("Not a run-results.json");
  }

  const version = getRunResultsVersion(dbtSchemaVersion);

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
  const version = getRunResultsVersion(
    (runResults.metadata as any)?.dbt_schema_version,
  );
  if (version !== 1) {
    throw new Error("Not a run-results.json v1");
  }
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
  const version = getRunResultsVersion(
    (runResults.metadata as any)?.dbt_schema_version,
  );
  if (version !== 2) {
    throw new Error("Not a run-results.json v2");
  }
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
  const version = getRunResultsVersion(
    (runResults.metadata as any)?.dbt_schema_version,
  );
  if (version !== 3) {
    throw new Error("Not a run-results.json v3");
  }
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
  const version = getRunResultsVersion(
    (runResults.metadata as any)?.dbt_schema_version,
  );
  if (version !== 4) {
    throw new Error("Not a run-results.json v4");
  }
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
  const version = getRunResultsVersion(
    (runResults.metadata as any)?.dbt_schema_version,
  );
  if (version !== 5) {
    throw new Error("Not a run-results.json v5");
  }
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
  const version = getRunResultsVersion(
    (runResults.metadata as any)?.dbt_schema_version,
  );
  if (version !== 6) {
    throw new Error("Not a run-results.json v6");
  }
  return runResults as unknown as RunResultsV6Type;
}
