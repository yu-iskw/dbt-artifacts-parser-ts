/**
 * Redshift adapter response parser.
 *
 * Redshift returns a minimal base-like response:
 * - _message: typically "SUCCESS"
 * - rows_affected: from cursor.rowcount
 * - No explicit code or query_id in current implementation
 */

import type { AdapterResponseMetrics } from "../../adapter-response-metrics";
import type { AdapterResponseParser } from "../types";
import {
  readFiniteNumber,
  readNonEmptyString,
  isPlainObject,
} from "../../adapter-response-metrics";

export const redshiftAdapterResponseParser: AdapterResponseParser = {
  name: "redshift",

  parse(input: unknown): AdapterResponseMetrics {
    if (!isPlainObject(input)) {
      return { rawKeys: [] };
    }

    const rawKeys = Object.keys(input).filter((k) => typeof k === "string");

    // Base-like response fields
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

  // Redshift has no distinctive heuristic keys
  // Let exact type match handle it
};
