import { athenaAdapterResponseParser } from "./parsers/athena";
import { bigqueryAdapterResponseParser } from "./parsers/bigquery";
import { genericAdapterResponseParser } from "./parsers/generic";
import { postgresAdapterResponseParser } from "./parsers/postgres";
import { redshiftAdapterResponseParser } from "./parsers/redshift";
import { snowflakeAdapterResponseParser } from "./parsers/snowflake";
import { sparkAdapterResponseParser } from "./parsers/spark";
import type { AdapterResponseObject, AdapterResponseParser } from "./types";
import { normalizeAdapterType } from "./types";

const ADAPTER_PARSERS: readonly AdapterResponseParser[] = [
  athenaAdapterResponseParser,
  bigqueryAdapterResponseParser,
  postgresAdapterResponseParser,
  redshiftAdapterResponseParser,
  snowflakeAdapterResponseParser,
  sparkAdapterResponseParser,
];

const PARSER_BY_TYPE = new Map<string, AdapterResponseParser>(
  ADAPTER_PARSERS.flatMap((parser) =>
    parser.adapterTypes.map((adapterType) => [normalizeAdapterType(adapterType), parser] as const),
  ),
);

/**
 * Hybrid dispatch: use adapter_type as a hint, but always fall back to
 * key-based detection and finally generic parsing for resilience.
 */
export function selectAdapterResponseParser(
  adapterType: string | null | undefined,
  adapterResponse: AdapterResponseObject,
): AdapterResponseParser {
  const normalizedType = normalizeAdapterType(adapterType);
  const typeParser = PARSER_BY_TYPE.get(normalizedType);
  if (typeParser && typeParser.canParse(adapterResponse)) {
    return typeParser;
  }

  const heuristicParser = ADAPTER_PARSERS.find((parser) =>
    parser.canParse(adapterResponse),
  );
  if (heuristicParser) {
    return heuristicParser;
  }

  if (typeParser) {
    return typeParser;
  }

  return genericAdapterResponseParser;
}
