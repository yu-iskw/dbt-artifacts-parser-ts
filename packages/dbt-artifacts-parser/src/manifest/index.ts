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
import type { ParseOptions } from "../parseOptions";
import type { WritableManifest as ManifestV12 } from "./v12";
import {
  identityCast,
  parseByVersion,
  slot,
  typedExact,
  versionTable,
} from "../versionTable";

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

export type { ParseOptions } from "../parseOptions";

const MANIFEST_SCHEMA = /\/manifest\/v(\d+)\.json$/;

function manifestSlot<T>(
  version: number,
  cast: (parsed: Record<string, unknown>) => T,
) {
  return slot({
    version,
    exactFragment: `/manifest/v${version}.json`,
    mismatch: `Not a manifest.json v${version}`,
    cast,
  });
}

const MANIFEST = versionTable<ParsedManifest>([
  manifestSlot(1, identityCast<ManifestV1>()),
  manifestSlot(2, identityCast<ManifestV2>()),
  manifestSlot(3, identityCast<ManifestV3>()),
  manifestSlot(4, identityCast<ManifestV4>()),
  manifestSlot(5, identityCast<ManifestV5>()),
  manifestSlot(6, identityCast<ManifestV6>()),
  manifestSlot(7, identityCast<ManifestV7>()),
  manifestSlot(8, identityCast<ManifestV8>()),
  manifestSlot(9, identityCast<ManifestV9>()),
  manifestSlot(10, identityCast<ManifestV10>()),
  manifestSlot(11, identityCast<ManifestV11>()),
  manifestSlot(12, identityCast<ManifestV12>()),
]);

export const parseManifestV1 = typedExact<ManifestV1, ParsedManifest>(
  MANIFEST,
  1,
);
export const parseManifestV2 = typedExact<ManifestV2, ParsedManifest>(
  MANIFEST,
  2,
);
export const parseManifestV3 = typedExact<ManifestV3, ParsedManifest>(
  MANIFEST,
  3,
);
export const parseManifestV4 = typedExact<ManifestV4, ParsedManifest>(
  MANIFEST,
  4,
);
export const parseManifestV5 = typedExact<ManifestV5, ParsedManifest>(
  MANIFEST,
  5,
);
export const parseManifestV6 = typedExact<ManifestV6, ParsedManifest>(
  MANIFEST,
  6,
);
export const parseManifestV7 = typedExact<ManifestV7, ParsedManifest>(
  MANIFEST,
  7,
);
export const parseManifestV8 = typedExact<ManifestV8, ParsedManifest>(
  MANIFEST,
  8,
);
export const parseManifestV9 = typedExact<ManifestV9, ParsedManifest>(
  MANIFEST,
  9,
);
export const parseManifestV10 = typedExact<ManifestV10, ParsedManifest>(
  MANIFEST,
  10,
);
export const parseManifestV11 = typedExact<ManifestV11, ParsedManifest>(
  MANIFEST,
  11,
);
export const parseManifestV12 = typedExact<ManifestV12, ParsedManifest>(
  MANIFEST,
  12,
);

export function parseManifest(
  parsed: Record<string, unknown>,
  options?: ParseOptions,
): ParsedManifest {
  return parseByVersion({
    table: MANIFEST,
    schemaPattern: MANIFEST_SCHEMA,
    notArtifactMessage: "Not a manifest.json",
    unsupportedLabel: "manifest",
    parsed,
    options,
  });
}
