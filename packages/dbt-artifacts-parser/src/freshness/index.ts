import type { ParseOptions } from "../parseOptions";
import type { FreshnessExecutionResultArtifact } from "./v0";
import {
  identityCast,
  parseByVersion,
  slot,
  versionTable,
} from "../versionTable";

export type FreshnessArtifact = FreshnessExecutionResultArtifact;

export type ParsedFreshness = FreshnessArtifact;

export type { ParseOptions } from "../parseOptions";

const FRESHNESS_SCHEMA = /\/freshness\/v(\d+)\.json$/;

const FRESHNESS = versionTable<ParsedFreshness>([
  slot({
    version: 0,
    exactFragment: "/freshness/v0.json",
    mismatch: "Not a freshness.json v0",
    cast: identityCast<FreshnessArtifact>(),
  }),
]);

export const parseFreshnessV0 = FRESHNESS.exact(0);

export function parseFreshness(
  parsed: Record<string, unknown>,
  options?: ParseOptions,
): ParsedFreshness {
  return parseByVersion({
    table: FRESHNESS,
    schemaPattern: FRESHNESS_SCHEMA,
    notArtifactMessage: "Not a freshness.json",
    unsupportedLabel: "freshness",
    parsed,
    options,
  });
}
