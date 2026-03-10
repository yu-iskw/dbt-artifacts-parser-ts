// Export latest version by default
// To use a specific version, import directly: import { Type } from './v6'
export * from "./v6";
import { RunResults as RunResultsV1 } from "./v1";
import { RunResults as RunResultsV2 } from "./v2";
import { HttpsSchemasGetdbtComDbtRunResultsV3Json as RunResultsV3 } from "./v3";
import { HttpsSchemasGetdbtComDbtRunResultsV4Json as RunResultsV4 } from "./v4";
import { RunResultsArtifact as RunResultsV5 } from "./v5";
import { RunResultsArtifact as RunResultsV6 } from "./v6";

/**
 * Union type of all supported run_results versions
 */
export type ParsedRunResults =
  | RunResultsV1
  | RunResultsV2
  | RunResultsV3
  | RunResultsV4
  | RunResultsV5
  | RunResultsV6;

/**
 * Extract version number from dbt_schema_version URL
 */
function extractVersion(schemaVersion: string | undefined): number | null {
  if (!schemaVersion) {
    return null;
  }
  const match = schemaVersion.match(/\/run-results\/v(\d+)\.json$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Parse run-results.json v1
 */
export function parseRunResultsV1(
  parsed: Record<string, unknown>,
): RunResultsV1 {
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    throw new Error("Not a run-results.json v1");
  }

  const schemaVersion = metadata.dbt_schema_version as string | undefined;
  if (!schemaVersion || !schemaVersion.includes("/run-results/v1.json")) {
    throw new Error("Not a run-results.json v1");
  }

  return parsed as unknown as RunResultsV1;
}

/**
 * Parse run-results.json v2
 */
export function parseRunResultsV2(
  parsed: Record<string, unknown>,
): RunResultsV2 {
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    throw new Error("Not a run-results.json v2");
  }

  const schemaVersion = metadata.dbt_schema_version as string | undefined;
  if (!schemaVersion || !schemaVersion.includes("/run-results/v2.json")) {
    throw new Error("Not a run-results.json v2");
  }

  return parsed as unknown as RunResultsV2;
}

/**
 * Parse run-results.json v3
 */
export function parseRunResultsV3(
  parsed: Record<string, unknown>,
): RunResultsV3 {
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    throw new Error("Not a run-results.json v3");
  }

  const schemaVersion = metadata.dbt_schema_version as string | undefined;
  if (!schemaVersion || !schemaVersion.includes("/run-results/v3.json")) {
    throw new Error("Not a run-results.json v3");
  }

  return parsed as unknown as RunResultsV3;
}

/**
 * Parse run-results.json v4
 */
export function parseRunResultsV4(
  parsed: Record<string, unknown>,
): RunResultsV4 {
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    throw new Error("Not a run-results.json v4");
  }

  const schemaVersion = metadata.dbt_schema_version as string | undefined;
  if (!schemaVersion || !schemaVersion.includes("/run-results/v4.json")) {
    throw new Error("Not a run-results.json v4");
  }

  return parsed as unknown as RunResultsV4;
}

/**
 * Parse run-results.json v5
 */
export function parseRunResultsV5(
  parsed: Record<string, unknown>,
): RunResultsV5 {
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    throw new Error("Not a run-results.json v5");
  }

  const schemaVersion = metadata.dbt_schema_version as string | undefined;
  if (!schemaVersion || !schemaVersion.includes("/run-results/v5.json")) {
    throw new Error("Not a run-results.json v5");
  }

  return parsed as unknown as RunResultsV5;
}

/**
 * Parse run-results.json v6
 */
export function parseRunResultsV6(
  parsed: Record<string, unknown>,
): RunResultsV6 {
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    throw new Error("Not a run-results.json v6");
  }

  const schemaVersion = metadata.dbt_schema_version as string | undefined;
  if (!schemaVersion || !schemaVersion.includes("/run-results/v6.json")) {
    throw new Error("Not a run-results.json v6");
  }

  return parsed as unknown as RunResultsV6;
}

/**
 * Parse run-results.json with automatic version detection
 */
export function parseRunResults(
  parsed: Record<string, unknown>,
): ParsedRunResults {
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    throw new Error("Not a run-results.json");
  }

  const schemaVersion = metadata.dbt_schema_version as string | undefined;
  if (!schemaVersion || !schemaVersion.includes("/run-results/v")) {
    throw new Error("Not a run-results.json");
  }

  const version = extractVersion(schemaVersion);
  if (version === null) {
    throw new Error("Not a run-results.json");
  }

  switch (version) {
    case 1:
      return parseRunResultsV1(parsed);
    case 2:
      return parseRunResultsV2(parsed);
    case 3:
      return parseRunResultsV3(parsed);
    case 4:
      return parseRunResultsV4(parsed);
    case 5:
      return parseRunResultsV5(parsed);
    case 6:
      return parseRunResultsV6(parsed);
    default:
      throw new Error(`Unsupported run-results version: ${version}`);
  }
}
