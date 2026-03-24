// Export latest version by default
// To use a specific version, import directly: import { Type } from './v12'
export * from "./v12";
import type { Manifest as ManifestV1 } from "./v1";
import type { Manifest as ManifestV2 } from "./v2";
import type { HttpsSchemasGetdbtComDbtManifestV3Json as ManifestV3 } from "./v3";
import type { HttpsSchemasGetdbtComDbtManifestV4Json as ManifestV4 } from "./v4";
import type { HttpsSchemasGetdbtComDbtManifestV5Json as ManifestV5 } from "./v5";
import type { HttpsSchemasGetdbtComDbtManifestV6Json as ManifestV6 } from "./v6";
import type { HttpsSchemasGetdbtComDbtManifestV7Json as ManifestV7 } from "./v7";
import type { HttpsSchemasGetdbtComDbtManifestV8Json as ManifestV8 } from "./v8";
import type { HttpsSchemasGetdbtComDbtManifestV9Json as ManifestV9 } from "./v9";
import type { HttpsSchemasGetdbtComDbtManifestV10Json as ManifestV10 } from "./v10";
import type { WritableManifest as ManifestV11 } from "./v11";
import type { WritableManifest as ManifestV12 } from "./v12";

/**
 * Union type of all supported manifest versions
 */
export type ParsedManifest =
  | ManifestV1
  | ManifestV2
  | ManifestV3
  | ManifestV4
  | ManifestV5
  | ManifestV6
  | ManifestV7
  | ManifestV8
  | ManifestV9
  | ManifestV10
  | ManifestV11
  | ManifestV12;

const ERR_NOT_MANIFEST = "Not a manifest.json";

/**
 * Extract version number from dbt_schema_version URL
 */
function extractVersion(schemaVersion: string | undefined): number | null {
  if (!schemaVersion) {
    return null;
  }
  const match = schemaVersion.match(/\/manifest\/v(\d+)\.json$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Parse manifest.json v1
 */
export function parseManifestV1(parsed: Record<string, unknown>): ManifestV1 {
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    throw new Error("Not a manifest.json v1");
  }

  const schemaVersion = metadata.dbt_schema_version as string | undefined;
  if (!schemaVersion || !schemaVersion.includes("/manifest/v1.json")) {
    throw new Error("Not a manifest.json v1");
  }

  return parsed as unknown as ManifestV1;
}

/**
 * Parse manifest.json v2
 */
export function parseManifestV2(parsed: Record<string, unknown>): ManifestV2 {
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    throw new Error("Not a manifest.json v2");
  }

  const schemaVersion = metadata.dbt_schema_version as string | undefined;
  if (!schemaVersion || !schemaVersion.includes("/manifest/v2.json")) {
    throw new Error("Not a manifest.json v2");
  }

  return parsed as unknown as ManifestV2;
}

/**
 * Parse manifest.json v3
 */
export function parseManifestV3(parsed: Record<string, unknown>): ManifestV3 {
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    throw new Error("Not a manifest.json v3");
  }

  const schemaVersion = metadata.dbt_schema_version as string | undefined;
  if (!schemaVersion || !schemaVersion.includes("/manifest/v3.json")) {
    throw new Error("Not a manifest.json v3");
  }

  return parsed as unknown as ManifestV3;
}

/**
 * Parse manifest.json v4
 */
export function parseManifestV4(parsed: Record<string, unknown>): ManifestV4 {
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    throw new Error("Not a manifest.json v4");
  }

  const schemaVersion = metadata.dbt_schema_version as string | undefined;
  if (!schemaVersion || !schemaVersion.includes("/manifest/v4.json")) {
    throw new Error("Not a manifest.json v4");
  }

  return parsed as unknown as ManifestV4;
}

/**
 * Parse manifest.json v5
 */
export function parseManifestV5(parsed: Record<string, unknown>): ManifestV5 {
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    throw new Error("Not a manifest.json v5");
  }

  const schemaVersion = metadata.dbt_schema_version as string | undefined;
  if (!schemaVersion || !schemaVersion.includes("/manifest/v5.json")) {
    throw new Error("Not a manifest.json v5");
  }

  return parsed as unknown as ManifestV5;
}

/**
 * Parse manifest.json v6
 */
export function parseManifestV6(parsed: Record<string, unknown>): ManifestV6 {
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    throw new Error("Not a manifest.json v6");
  }

  const schemaVersion = metadata.dbt_schema_version as string | undefined;
  if (!schemaVersion || !schemaVersion.includes("/manifest/v6.json")) {
    throw new Error("Not a manifest.json v6");
  }

  return parsed as unknown as ManifestV6;
}

/**
 * Parse manifest.json v7
 */
export function parseManifestV7(parsed: Record<string, unknown>): ManifestV7 {
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    throw new Error("Not a manifest.json v7");
  }

  const schemaVersion = metadata.dbt_schema_version as string | undefined;
  if (!schemaVersion || !schemaVersion.includes("/manifest/v7.json")) {
    throw new Error("Not a manifest.json v7");
  }

  return parsed as unknown as ManifestV7;
}

/**
 * Parse manifest.json v8
 */
export function parseManifestV8(parsed: Record<string, unknown>): ManifestV8 {
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    throw new Error("Not a manifest.json v8");
  }

  const schemaVersion = metadata.dbt_schema_version as string | undefined;
  if (!schemaVersion || !schemaVersion.includes("/manifest/v8.json")) {
    throw new Error("Not a manifest.json v8");
  }

  return parsed as unknown as ManifestV8;
}

/**
 * Parse manifest.json v9
 */
export function parseManifestV9(parsed: Record<string, unknown>): ManifestV9 {
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    throw new Error("Not a manifest.json v9");
  }

  const schemaVersion = metadata.dbt_schema_version as string | undefined;
  if (!schemaVersion || !schemaVersion.includes("/manifest/v9.json")) {
    throw new Error("Not a manifest.json v9");
  }

  return parsed as unknown as ManifestV9;
}

/**
 * Parse manifest.json v10
 */
export function parseManifestV10(parsed: Record<string, unknown>): ManifestV10 {
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    throw new Error("Not a manifest.json v10");
  }

  const schemaVersion = metadata.dbt_schema_version as string | undefined;
  if (!schemaVersion || !schemaVersion.includes("/manifest/v10.json")) {
    throw new Error("Not a manifest.json v10");
  }

  return parsed as unknown as ManifestV10;
}

/**
 * Parse manifest.json v11
 */
export function parseManifestV11(parsed: Record<string, unknown>): ManifestV11 {
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    throw new Error("Not a manifest.json v11");
  }

  const schemaVersion = metadata.dbt_schema_version as string | undefined;
  if (!schemaVersion || !schemaVersion.includes("/manifest/v11.json")) {
    throw new Error("Not a manifest.json v11");
  }

  return parsed as unknown as ManifestV11;
}

/**
 * Parse manifest.json v12
 */
export function parseManifestV12(parsed: Record<string, unknown>): ManifestV12 {
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    throw new Error("Not a manifest.json v12");
  }

  const schemaVersion = metadata.dbt_schema_version as string | undefined;
  if (!schemaVersion || !schemaVersion.includes("/manifest/v12.json")) {
    throw new Error("Not a manifest.json v12");
  }

  return parsed as unknown as ManifestV12;
}

const MANIFEST_PARSERS = [
  parseManifestV1,
  parseManifestV2,
  parseManifestV3,
  parseManifestV4,
  parseManifestV5,
  parseManifestV6,
  parseManifestV7,
  parseManifestV8,
  parseManifestV9,
  parseManifestV10,
  parseManifestV11,
  parseManifestV12,
] as const;

/**
 * Parse manifest.json with automatic version detection
 */
export function parseManifest(parsed: Record<string, unknown>): ParsedManifest {
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata) throw new Error(ERR_NOT_MANIFEST);
  const schemaVersion = metadata.dbt_schema_version as string | undefined;
  if (!schemaVersion || !schemaVersion.includes("/manifest/v"))
    throw new Error(ERR_NOT_MANIFEST);
  const version = extractVersion(schemaVersion);
  if (version === null) throw new Error(ERR_NOT_MANIFEST);
  const parser = MANIFEST_PARSERS[version - 1];
  if (!parser) throw new Error(`Unsupported manifest version: ${version}`);
  return parser(parsed);
}
