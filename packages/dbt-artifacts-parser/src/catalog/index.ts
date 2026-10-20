// Export latest version by default
// To use a specific version, import directly: import { Type } from './v1'
export * from "./v1";
import type { ParseOptions } from "../parseOptions";
import type { CatalogArtifact } from "./v1";
import {
  identityCast,
  parseByVersion,
  slot,
  versionTable,
} from "../versionTable";

/**
 * Union type of all supported catalog versions
 */
export type ParsedCatalog = CatalogArtifact;

export type { ParseOptions } from "../parseOptions";

const CATALOG_SCHEMA = /\/catalog\/v(\d+)\.json$/;

const CATALOG = versionTable<ParsedCatalog>([
  slot({
    version: 1,
    exactFragment: "/catalog/v1.json",
    mismatch: "Not a catalog.json v1",
    cast: identityCast<CatalogArtifact>(),
  }),
]);

export const parseCatalogV1 = CATALOG.exact(1);

export function parseCatalog(
  parsed: Record<string, unknown>,
  options?: ParseOptions,
): ParsedCatalog {
  return parseByVersion({
    table: CATALOG,
    schemaPattern: CATALOG_SCHEMA,
    notArtifactMessage: "Not a catalog.json",
    unsupportedLabel: "catalog",
    parsed,
    options,
  });
}
