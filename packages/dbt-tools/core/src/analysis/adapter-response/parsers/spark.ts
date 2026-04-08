/**
 * Spark adapter response parser.
 *
 * Spark returns a minimal response:
 * - _message: typically "OK"
 * - No explicit code, rows_affected, or query_id in current implementation
 */

import type { AdapterResponseMetrics } from "../../adapter-response-metrics";
import type { AdapterResponseParser } from "../types";
import {
  readNonEmptyString,
  isPlainObject,
} from "../../adapter-response-metrics";

export const sparkAdapterResponseParser: AdapterResponseParser = {
  name: "spark",

  parse(input: unknown): AdapterResponseMetrics {
    if (!isPlainObject(input)) {
      return { rawKeys: [] };
    }

    const rawKeys = Object.keys(input).filter((k) => typeof k === "string");

    // Minimal response: just message in most cases
    const adapterMessage = readNonEmptyString(input, "_message");

    return {
      ...(adapterMessage !== undefined ? { adapterMessage } : {}),
      rawKeys,
    };
  },

  // Spark has no distinctive heuristic keys
  // Let exact type match handle it
};
