// Export latest version by default
// To use a specific version, import directly: import { Type } from './v6'
export * from "./v6";
import type { RunResults as RunResultsV1 } from "./v1";
import type { RunResults as RunResultsV2 } from "./v2";
import type { HttpsSchemasGetdbtComDbtRunResultsV3Json as RunResultsV3 } from "./v3";
import type { HttpsSchemasGetdbtComDbtRunResultsV4Json as RunResultsV4 } from "./v4";
import type { RunResultsArtifact as RunResultsV5 } from "./v5";
import type { ParseOptions } from "../parseOptions";
import type { RunResultsArtifact as RunResultsV6 } from "./v6";
import {
  identityCast,
  parseByVersion,
  slot,
  typedExact,
  versionTable,
} from "../versionTable";

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

export type { ParseOptions } from "../parseOptions";

const RUN_RESULTS_SCHEMA = /\/run-results\/v(\d+)\.json$/;

function runResultsSlot<T>(
  version: number,
  cast: (parsed: Record<string, unknown>) => T,
) {
  return slot({
    version,
    exactFragment: `/run-results/v${version}.json`,
    mismatch: `Not a run-results.json v${version}`,
    cast,
  });
}

const RUN_RESULTS = versionTable<ParsedRunResults>([
  runResultsSlot(1, identityCast<RunResultsV1>()),
  runResultsSlot(2, identityCast<RunResultsV2>()),
  runResultsSlot(3, identityCast<RunResultsV3>()),
  runResultsSlot(4, identityCast<RunResultsV4>()),
  runResultsSlot(5, identityCast<RunResultsV5>()),
  runResultsSlot(6, identityCast<RunResultsV6>()),
]);

export const parseRunResultsV1 = typedExact<RunResultsV1, ParsedRunResults>(
  RUN_RESULTS,
  1,
);
export const parseRunResultsV2 = typedExact<RunResultsV2, ParsedRunResults>(
  RUN_RESULTS,
  2,
);
export const parseRunResultsV3 = typedExact<RunResultsV3, ParsedRunResults>(
  RUN_RESULTS,
  3,
);
export const parseRunResultsV4 = typedExact<RunResultsV4, ParsedRunResults>(
  RUN_RESULTS,
  4,
);
export const parseRunResultsV5 = typedExact<RunResultsV5, ParsedRunResults>(
  RUN_RESULTS,
  5,
);
export const parseRunResultsV6 = typedExact<RunResultsV6, ParsedRunResults>(
  RUN_RESULTS,
  6,
);

export function parseRunResults(
  parsed: Record<string, unknown>,
  options?: ParseOptions,
): ParsedRunResults {
  return parseByVersion({
    table: RUN_RESULTS,
    schemaPattern: RUN_RESULTS_SCHEMA,
    notArtifactMessage: "Not a run-results.json",
    unsupportedLabel: "run-results",
    parsed,
    options,
  });
}
