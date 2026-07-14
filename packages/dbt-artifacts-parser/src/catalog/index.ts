// Export latest version by default
// To use a specific version, import directly: import { Type } from './v1'
export * from "./v1";
import { tryFallbackToLatest, type ParseOptions } from "../parseOptions";
import type { CatalogArtifact } from "./v1";

/**
 * Union type of all supported catalog versions
 */
export type ParsedCatalog = CatalogArtifact;

export type { ParseOptions } from "../parseOptions";

const ERR_NOT_CATALOG = "Not a catalog.json";

/**
 * Extract version number from dbt_schema_version URL
 */
function extractVersion(schemaVersion: string | undefined): number | null {
  if (!schemaVersion) {
    return null;
  }
  const match = schemaVersion.match(/\/catalog\/v(\d+)\.json$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Parse catalog.json v1
 * @param parsed - Parsed JSON object
 * @returns CatalogArtifact v1
 * @throws Error if not a catalog.json v1
 */
export function parseCatalogV1(
  parsed: Record<string, unknown>,
): CatalogArtifact {
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    throw new Error("Not a catalog.json v1");
  }

  const schemaVersion = metadata.dbt_schema_version as string | undefined;
  if (!schemaVersion || !schemaVersion.includes("/catalog/v1.json")) {
    throw new Error("Not a catalog.json v1");
  }

  return parsed as unknown as CatalogArtifact;
}

const CATALOG_PARSERS = [parseCatalogV1] as const;

/**
 * Parse catalog.json with automatic version detection
 * @param parsed - Parsed JSON object
 * @returns ParsedCatalog (union type of all supported versions)
 * @throws Error if not a catalog.json or unsupported version
 */
export function parseCatalog(
  parsed: Record<string, unknown>,
  options?: ParseOptions,
): ParsedCatalog {
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    throw new Error(ERR_NOT_CATALOG);
  }

  const schemaVersion = metadata.dbt_schema_version as string | undefined;
  if (!schemaVersion || !schemaVersion.includes("/catalog/v")) {
    throw new Error(ERR_NOT_CATALOG);
  }

  const version = extractVersion(schemaVersion);
  if (version === null) {
    throw new Error(ERR_NOT_CATALOG);
  }

  const parser = CATALOG_PARSERS[version - 1];
  if (parser) {
    return parser(parsed);
  }
  const fallback = tryFallbackToLatest(
    options,
    version,
    CATALOG_PARSERS.length,
    schemaVersion,
    parsed as unknown as CatalogArtifact,
  );
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(`Unsupported catalog version: ${version}`);
}
