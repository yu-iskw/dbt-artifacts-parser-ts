/**
 * Postgres adapter response parser.
 *
 * Postgres uses the base AdapterResponse contract:
 * - _message: from cursor.statusmessage
 * - rows_affected: from cursor.rowcount
 * - code: status message with numeric tokens removed
 * - May also include other generic fields like query_id.
 */

import type { AdapterResponseMetrics } from "../../adapter-response-metrics";
import type { AdapterResponseParser } from "../types";
import { isPlainObject } from "../../adapter-response-metrics";
import { extractBaseFields } from "./base";

export const postgresAdapterResponseParser: AdapterResponseParser = {
  name: "postgres",

  parse(input: unknown): AdapterResponseMetrics {
    if (!isPlainObject(input)) {
      return { rawKeys: [] };
    }

    const rawKeys = Object.keys(input).filter((k) => typeof k === "string");

    // Extract generic/base fields (includes _message, code, rows_affected, query_id, etc.)
    const baseFields = extractBaseFields(input);

    return {
      ...baseFields,
      rawKeys,
    };
  },

  // Postgres has no distinctive heuristic keys beyond base fields
  // Let exact type match handle it
};
