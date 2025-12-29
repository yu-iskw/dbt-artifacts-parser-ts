// Export latest version by default
export * from "./v1";

// Versioned exports
export type { CatalogArtifact as CatalogArtifactV1 } from "./v1";

// Import types for union
import type { CatalogArtifact as CatalogArtifactV1Type } from "./v1";

// Union type for all catalog versions
export type ParsedCatalog = CatalogArtifactV1Type;

/**
 * Extract version number from dbt schema version string
 * @param dbtSchemaVersion - Schema version string like "https://schemas.getdbt.com/dbt/catalog/v1.json"
 * @returns Version number as integer
 * @throws Error if version cannot be extracted
 */
function getCatalogVersion(dbtSchemaVersion: string): number {
  const match = dbtSchemaVersion.match(/\/catalog\/v(\d+)\.json$/);
  if (!match) {
    throw new Error(`Invalid dbt schema version format: ${dbtSchemaVersion}`);
  }
  return parseInt(match[1], 10);
}

/**
 * Parse catalog.json object and return appropriately typed catalog based on version
 * @param catalog - Parsed catalog.json object
 * @returns Typed catalog object
 * @throws Error if catalog is invalid or version is unsupported
 */
export function parseCatalog(catalog: Record<string, unknown>): ParsedCatalog {
  // Validate input structure
  if (!catalog || typeof catalog !== "object" || !("metadata" in catalog)) {
    throw new Error("Not a catalog.json");
  }

  const metadata = catalog.metadata;
  if (
    !metadata ||
    typeof metadata !== "object" ||
    !("dbt_schema_version" in metadata)
  ) {
    throw new Error("Not a catalog.json");
  }

  // Extract and parse version
  const dbtSchemaVersion = (metadata as any).dbt_schema_version;
  if (typeof dbtSchemaVersion !== "string") {
    throw new Error("Not a catalog.json");
  }

  const version = getCatalogVersion(dbtSchemaVersion);

  // Return appropriately typed catalog based on version
  switch (version) {
    case 1:
      return catalog as unknown as CatalogArtifactV1Type;
    default:
      throw new Error(`Unsupported catalog version: ${version}`);
  }
}

/**
 * Parse catalog.json v1
 * @param catalog - Parsed catalog.json object
 * @returns CatalogArtifactV1
 */
export function parseCatalogV1(
  catalog: Record<string, unknown>,
): CatalogArtifactV1Type {
  const version = getCatalogVersion(
    (catalog.metadata as any)?.dbt_schema_version,
  );
  if (version !== 1) {
    throw new Error("Not a catalog.json v1");
  }
  return catalog as unknown as CatalogArtifactV1Type;
}
