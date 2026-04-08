/**
 * Postgres adapter response parser.
 *
 * Postgres uses the base AdapterResponse contract:
 * - _message: from cursor.statusmessage
 * - rows_affected: from cursor.rowcount
 * - code: status message with numeric tokens removed
 * - No special adapter-specific fields beyond the base contract.
 */

import type { AdapterResponseMetrics } from "../../adapter-response-metrics";
import type { AdapterResponseParser } from "../types";
import {
  readFiniteNumber,
  readNonEmptyString,
  isPlainObject,
} from "../../adapter-response-metrics";

export const postgresAdapterResponseParser: AdapterResponseParser = {
  name: "postgres",

  parse(input: unknown): AdapterResponseMetrics {
    if (!isPlainObject(input)) {
      return { rawKeys: [] };
    }

    const rawKeys = Object.keys(input).filter((k) => typeof k === "string");

    // Base response fields only
    const rowsAffected = readFiniteNumber(input, "rows_affected");
    const adapterCode = readNonEmptyString(input, "code");
    const adapterMessage = readNonEmptyString(input, "_message");

    return {
      ...(rowsAffected !== undefined ? { rowsAffected } : {}),
      ...(adapterCode !== undefined ? { adapterCode } : {}),
      ...(adapterMessage !== undefined ? { adapterMessage } : {}),
      rawKeys,
    };
  },

  // Postgres has no distinctive heuristic keys beyond base fields
  // Let exact type match handle it
};
