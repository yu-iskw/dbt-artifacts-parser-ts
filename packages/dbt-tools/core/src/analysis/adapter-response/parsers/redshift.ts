/**
 * Redshift adapter response parser.
 *
 * Redshift returns a minimal base-like response:
 * - _message: typically "SUCCESS"
 * - rows_affected: from cursor.rowcount
 * - May also include generic fields like query_id, code, etc.
 */

import type { AdapterResponseMetrics } from "../../adapter-response-metrics";
import type { AdapterResponseParser } from "../types";
import { isPlainObject } from "../../adapter-response-metrics";
import { extractBaseFields } from "./base";

export const redshiftAdapterResponseParser: AdapterResponseParser = {
  name: "redshift",

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

  // Redshift has no distinctive heuristic keys
  // Let exact type match handle it
};
