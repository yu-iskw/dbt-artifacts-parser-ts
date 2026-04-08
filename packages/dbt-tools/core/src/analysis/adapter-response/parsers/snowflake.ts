/**
 * Snowflake adapter response parser.
 *
 * SnowflakeAdapterResponse includes:
 * - Base AdapterResponse fields: _message, code, rows_affected, query_id
 * - DML stats: rows_inserted, rows_deleted, rows_updated, rows_duplicates
 */

import type { AdapterResponseMetrics } from "../../adapter-response-metrics";
import type { AdapterResponseParser } from "../types";
import {
  readFiniteNumber,
  readNonEmptyString,
  isPlainObject,
} from "../../adapter-response-metrics";

export const snowflakeAdapterResponseParser: AdapterResponseParser = {
  name: "snowflake",

  parse(input: unknown): AdapterResponseMetrics {
    if (!isPlainObject(input)) {
      return { rawKeys: [] };
    }

    const rawKeys = Object.keys(input).filter((k) => typeof k === "string");

    // Base response fields
    const rowsAffected = readFiniteNumber(input, "rows_affected");
    const adapterCode = readNonEmptyString(input, "code");
    const adapterMessage = readNonEmptyString(input, "_message");
    const queryId = readNonEmptyString(input, "query_id");

    // Snowflake-specific DML stats
    const rowsInserted = readFiniteNumber(input, "rows_inserted");
    const rowsDeleted = readFiniteNumber(input, "rows_deleted");
    const rowsUpdated = readFiniteNumber(input, "rows_updated");
    const rowsDuplicated = readFiniteNumber(input, "rows_duplicates");

    return {
      ...(rowsAffected !== undefined ? { rowsAffected } : {}),
      ...(adapterCode !== undefined ? { adapterCode } : {}),
      ...(adapterMessage !== undefined ? { adapterMessage } : {}),
      ...(queryId !== undefined ? { queryId } : {}),
      ...(rowsInserted !== undefined ? { rowsInserted } : {}),
      ...(rowsDeleted !== undefined ? { rowsDeleted } : {}),
      ...(rowsUpdated !== undefined ? { rowsUpdated } : {}),
      ...(rowsDuplicated !== undefined ? { rowsDuplicated } : {}),
      rawKeys,
    };
  },

  canParse(input: unknown): boolean {
    // Snowflake may have rows_inserted, rows_deleted, rows_updated, or rows_duplicates
    if (!isPlainObject(input)) return false;
    return (
      "rows_inserted" in input ||
      "rows_deleted" in input ||
      "rows_updated" in input ||
      "rows_duplicates" in input
    );
  },
};
