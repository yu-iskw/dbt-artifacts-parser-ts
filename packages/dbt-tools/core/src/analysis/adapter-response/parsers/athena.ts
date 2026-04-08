/**
 * Athena adapter response parser.
 *
 * AthenaAdapterResponse extends AdapterResponse with:
 * - data_scanned_in_bytes: amount of data scanned (maps to canonical bytesProcessed)
 */

import type { AdapterResponseMetrics } from "../../adapter-response-metrics";
import type { AdapterResponseParser } from "../types";
import {
  readFiniteNumber,
  readNonEmptyString,
  isPlainObject,
} from "../../adapter-response-metrics";

export const athenaAdapterResponseParser: AdapterResponseParser = {
  name: "athena",

  parse(input: unknown): AdapterResponseMetrics {
    if (!isPlainObject(input)) {
      return { rawKeys: [] };
    }

    const rawKeys = Object.keys(input).filter((k) => typeof k === "string");

    // Base response fields
    const rowsAffected = readFiniteNumber(input, "rows_affected");
    const adapterCode = readNonEmptyString(input, "code");
    const adapterMessage = readNonEmptyString(input, "_message");

    // Athena-specific: data_scanned_in_bytes maps to canonical bytesProcessed
    const bytesProcessed = readFiniteNumber(input, "data_scanned_in_bytes");

    return {
      ...(bytesProcessed !== undefined ? { bytesProcessed } : {}),
      ...(rowsAffected !== undefined ? { rowsAffected } : {}),
      ...(adapterCode !== undefined ? { adapterCode } : {}),
      ...(adapterMessage !== undefined ? { adapterMessage } : {}),
      rawKeys,
    };
  },

  canParse(input: unknown): boolean {
    // Athena typically has data_scanned_in_bytes
    if (!isPlainObject(input)) return false;
    return "data_scanned_in_bytes" in input;
  },
};
