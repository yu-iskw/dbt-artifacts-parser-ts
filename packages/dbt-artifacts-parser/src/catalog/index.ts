// Export latest version by default
// To use a specific version, import directly: import { Type } from './v1'
export * from "./v1";
import type { CatalogArtifact } from "./v1";

/**
 * Union type of all supported catalog versions
 */
export type ParsedCatalog = CatalogArtifact;

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

/**
 * Parse catalog.json with automatic version detection
 * @param parsed - Parsed JSON object
 * @returns ParsedCatalog (union type of all supported versions)
 * @throws Error if not a catalog.json or unsupported version
 */
export function parseCatalog(parsed: Record<string, unknown>): ParsedCatalog {
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

  switch (version) {
    case 1:
      return parseCatalogV1(parsed);
    default:
      throw new Error(`Unsupported catalog version: ${version}`);
  }
}
