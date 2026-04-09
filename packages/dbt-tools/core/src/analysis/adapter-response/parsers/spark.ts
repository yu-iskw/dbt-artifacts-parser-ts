/**
 * Spark adapter response parser.
 *
 * Spark returns a minimal response:
 * - _message: typically "OK"
 * - May also include generic fields like code, rows_affected, query_id, etc.
 */

import type { AdapterResponseMetrics } from "../../adapter-response-metrics";
import type { AdapterResponseParser } from "../types";
import { isPlainObject } from "../../adapter-response-metrics";
import { extractBaseFields } from "./base";

export const sparkAdapterResponseParser: AdapterResponseParser = {
  name: "spark",

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

  // Spark has no distinctive heuristic keys
  // Let exact type match handle it
};
