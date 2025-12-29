// Export latest version by default
export * from "./v12";

// Versioned exports
export type { Manifest as ManifestV1 } from "./v1";
export type { Manifest as ManifestV2 } from "./v2";
export type { HttpsSchemasGetdbtComDbtManifestV3Json as ManifestV3 } from "./v3";
export type { HttpsSchemasGetdbtComDbtManifestV4Json as ManifestV4 } from "./v4";
export type { HttpsSchemasGetdbtComDbtManifestV5Json as ManifestV5 } from "./v5";
export type { HttpsSchemasGetdbtComDbtManifestV6Json as ManifestV6 } from "./v6";
export type { HttpsSchemasGetdbtComDbtManifestV7Json as ManifestV7 } from "./v7";
export type { HttpsSchemasGetdbtComDbtManifestV8Json as ManifestV8 } from "./v8";
export type { HttpsSchemasGetdbtComDbtManifestV9Json as ManifestV9 } from "./v9";
export type { HttpsSchemasGetdbtComDbtManifestV10Json as ManifestV10 } from "./v10";
export type { WritableManifest as ManifestV11 } from "./v11";
export type { WritableManifest as ManifestV12 } from "./v12";

// Import types for union
import type { Manifest as ManifestV1Type } from "./v1";
import type { Manifest as ManifestV2Type } from "./v2";
import type { HttpsSchemasGetdbtComDbtManifestV3Json as ManifestV3Type } from "./v3";
import type { HttpsSchemasGetdbtComDbtManifestV4Json as ManifestV4Type } from "./v4";
import type { HttpsSchemasGetdbtComDbtManifestV5Json as ManifestV5Type } from "./v5";
import type { HttpsSchemasGetdbtComDbtManifestV6Json as ManifestV6Type } from "./v6";
import type { HttpsSchemasGetdbtComDbtManifestV7Json as ManifestV7Type } from "./v7";
import type { HttpsSchemasGetdbtComDbtManifestV8Json as ManifestV8Type } from "./v8";
import type { HttpsSchemasGetdbtComDbtManifestV9Json as ManifestV9Type } from "./v9";
import type { HttpsSchemasGetdbtComDbtManifestV10Json as ManifestV10Type } from "./v10";
import type { WritableManifest as ManifestV11Type } from "./v11";
import type { WritableManifest as ManifestV12Type } from "./v12";

// Union type for all manifest versions
export type ParsedManifest =
  | ManifestV1Type
  | ManifestV2Type
  | ManifestV3Type
  | ManifestV4Type
  | ManifestV5Type
  | ManifestV6Type
  | ManifestV7Type
  | ManifestV8Type
  | ManifestV9Type
  | ManifestV10Type
  | ManifestV11Type
  | ManifestV12Type;

/**
 * Extract version number from dbt schema version string
 * @param dbtSchemaVersion - Schema version string like "https://schemas.getdbt.com/dbt/manifest/v12.json"
 * @returns Version number as integer
 * @throws Error if version cannot be extracted
 */
function getManifestVersion(dbtSchemaVersion: string): number {
  const match = dbtSchemaVersion.match(/\/manifest\/v(\d+)\.json$/);
  if (!match) {
    throw new Error(`Invalid dbt schema version format: ${dbtSchemaVersion}`);
  }
  return parseInt(match[1], 10);
}

/**
 * Parse manifest.json object and return appropriately typed manifest based on version
 * @param manifest - Parsed manifest.json object
 * @returns Typed manifest object
 * @throws Error if manifest is invalid or version is unsupported
 */
export function parseManifest(
  manifest: Record<string, unknown>,
): ParsedManifest {
  // Validate input structure
  if (!manifest || typeof manifest !== "object" || !("metadata" in manifest)) {
    throw new Error("Not a manifest.json");
  }

  const metadata = manifest.metadata;
  if (
    !metadata ||
    typeof metadata !== "object" ||
    !("dbt_schema_version" in metadata)
  ) {
    throw new Error("Not a manifest.json");
  }

  // Extract and parse version
  const dbtSchemaVersion = (metadata as any).dbt_schema_version;
  if (typeof dbtSchemaVersion !== "string") {
    throw new Error("Not a manifest.json");
  }

  const version = getManifestVersion(dbtSchemaVersion);

  // Return appropriately typed manifest based on version
  switch (version) {
    case 1:
      return manifest as unknown as ManifestV1Type;
    case 2:
      return manifest as unknown as ManifestV2Type;
    case 3:
      return manifest as unknown as ManifestV3Type;
    case 4:
      return manifest as unknown as ManifestV4Type;
    case 5:
      return manifest as unknown as ManifestV5Type;
    case 6:
      return manifest as unknown as ManifestV6Type;
    case 7:
      return manifest as unknown as ManifestV7Type;
    case 8:
      return manifest as unknown as ManifestV8Type;
    case 9:
      return manifest as unknown as ManifestV9Type;
    case 10:
      return manifest as unknown as ManifestV10Type;
    case 11:
      return manifest as unknown as ManifestV11Type;
    case 12:
      return manifest as unknown as ManifestV12Type;
    default:
      throw new Error(`Unsupported manifest version: ${version}`);
  }
}

/**
 * Parse manifest.json v1
 * @param manifest - Parsed manifest.json object
 * @returns ManifestV1
 */
export function parseManifestV1(
  manifest: Record<string, unknown>,
): ManifestV1Type {
  const version = getManifestVersion(
    (manifest.metadata as any)?.dbt_schema_version,
  );
  if (version !== 1) {
    throw new Error("Not a manifest.json v1");
  }
  return manifest as unknown as ManifestV1Type;
}

/**
 * Parse manifest.json v2
 * @param manifest - Parsed manifest.json object
 * @returns ManifestV2
 */
export function parseManifestV2(
  manifest: Record<string, unknown>,
): ManifestV2Type {
  const version = getManifestVersion(
    (manifest.metadata as any)?.dbt_schema_version,
  );
  if (version !== 2) {
    throw new Error("Not a manifest.json v2");
  }
  return manifest as unknown as ManifestV2Type;
}

/**
 * Parse manifest.json v3
 * @param manifest - Parsed manifest.json object
 * @returns ManifestV3
 */
export function parseManifestV3(
  manifest: Record<string, unknown>,
): ManifestV3Type {
  const version = getManifestVersion(
    (manifest.metadata as any)?.dbt_schema_version,
  );
  if (version !== 3) {
    throw new Error("Not a manifest.json v3");
  }
  return manifest as unknown as ManifestV3Type;
}

/**
 * Parse manifest.json v4
 * @param manifest - Parsed manifest.json object
 * @returns ManifestV4
 */
export function parseManifestV4(
  manifest: Record<string, unknown>,
): ManifestV4Type {
  const version = getManifestVersion(
    (manifest.metadata as any)?.dbt_schema_version,
  );
  if (version !== 4) {
    throw new Error("Not a manifest.json v4");
  }
  return manifest as unknown as ManifestV4Type;
}

/**
 * Parse manifest.json v5
 * @param manifest - Parsed manifest.json object
 * @returns ManifestV5
 */
export function parseManifestV5(
  manifest: Record<string, unknown>,
): ManifestV5Type {
  const version = getManifestVersion(
    (manifest.metadata as any)?.dbt_schema_version,
  );
  if (version !== 5) {
    throw new Error("Not a manifest.json v5");
  }
  return manifest as unknown as ManifestV5Type;
}

/**
 * Parse manifest.json v6
 * @param manifest - Parsed manifest.json object
 * @returns ManifestV6
 */
export function parseManifestV6(
  manifest: Record<string, unknown>,
): ManifestV6Type {
  const version = getManifestVersion(
    (manifest.metadata as any)?.dbt_schema_version,
  );
  if (version !== 6) {
    throw new Error("Not a manifest.json v6");
  }
  return manifest as unknown as ManifestV6Type;
}

/**
 * Parse manifest.json v7
 * @param manifest - Parsed manifest.json object
 * @returns ManifestV7
 */
export function parseManifestV7(
  manifest: Record<string, unknown>,
): ManifestV7Type {
  const version = getManifestVersion(
    (manifest.metadata as any)?.dbt_schema_version,
  );
  if (version !== 7) {
    throw new Error("Not a manifest.json v7");
  }
  return manifest as unknown as ManifestV7Type;
}

/**
 * Parse manifest.json v8
 * @param manifest - Parsed manifest.json object
 * @returns ManifestV8
 */
export function parseManifestV8(
  manifest: Record<string, unknown>,
): ManifestV8Type {
  const version = getManifestVersion(
    (manifest.metadata as any)?.dbt_schema_version,
  );
  if (version !== 8) {
    throw new Error("Not a manifest.json v8");
  }
  return manifest as unknown as ManifestV8Type;
}

/**
 * Parse manifest.json v9
 * @param manifest - Parsed manifest.json object
 * @returns ManifestV9
 */
export function parseManifestV9(
  manifest: Record<string, unknown>,
): ManifestV9Type {
  const version = getManifestVersion(
    (manifest.metadata as any)?.dbt_schema_version,
  );
  if (version !== 9) {
    throw new Error("Not a manifest.json v9");
  }
  return manifest as unknown as ManifestV9Type;
}

/**
 * Parse manifest.json v10
 * @param manifest - Parsed manifest.json object
 * @returns ManifestV10
 */
export function parseManifestV10(
  manifest: Record<string, unknown>,
): ManifestV10Type {
  const version = getManifestVersion(
    (manifest.metadata as any)?.dbt_schema_version,
  );
  if (version !== 10) {
    throw new Error("Not a manifest.json v10");
  }
  return manifest as unknown as ManifestV10Type;
}

/**
 * Parse manifest.json v11
 * @param manifest - Parsed manifest.json object
 * @returns WritableManifestV11
 */
export function parseManifestV11(
  manifest: Record<string, unknown>,
): ManifestV11Type {
  const version = getManifestVersion(
    (manifest.metadata as any)?.dbt_schema_version,
  );
  if (version !== 11) {
    throw new Error("Not a manifest.json v11");
  }
  return manifest as unknown as ManifestV11Type;
}

/**
 * Parse manifest.json v12
 * @param manifest - Parsed manifest.json object
 * @returns WritableManifestV12
 */
export function parseManifestV12(
  manifest: Record<string, unknown>,
): ManifestV12Type {
  const version = getManifestVersion(
    (manifest.metadata as any)?.dbt_schema_version,
  );
  if (version !== 12) {
    throw new Error("Not a manifest.json v12");
  }
  return manifest as unknown as ManifestV12Type;
}
