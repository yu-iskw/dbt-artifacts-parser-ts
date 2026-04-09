/**
 * Generic adapter response parser.
 * Falls back to existing best-effort normalization when adapter type is unknown or unavailable.
 * This is the safety net that ensures backward compatibility.
 */

import type { AdapterResponseMetrics } from "../adapter-response-metrics";
import type { AdapterResponseParser } from "./types";
import { isPlainObject } from "../adapter-response-metrics";
import { extractBaseFields } from "./parsers/base";

/**
 * Generic fallback parser: normalizes keys common across all adapters.
 * Inspects actual keys present in adapter_response and normalizes them
 * to the canonical AdapterResponseMetrics shape.
 */
export const genericAdapterResponseParser: AdapterResponseParser = {
  name: "generic",

  parse(input: unknown): AdapterResponseMetrics {
    if (!isPlainObject(input)) {
      return { rawKeys: [] };
    }

    const rawKeys = Object.keys(input).filter((k) => typeof k === "string");

    // Extract generic/base fields using shared utility
    const baseFields = extractBaseFields(input);

    return {
      ...baseFields,
      rawKeys,
    };
  },

  // Generic parser has no heuristic; rely on exact type match or other parsers
};
