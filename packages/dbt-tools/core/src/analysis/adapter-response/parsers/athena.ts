/**
 * Athena adapter response parser.
 *
 * AthenaAdapterResponse extends AdapterResponse with:
 * - data_scanned_in_bytes: amount of data scanned (maps to canonical bytesProcessed)
 * - Generic fields via base field extraction
 */

import type { AdapterResponseMetrics } from "../../adapter-response-metrics";
import type { AdapterResponseParser } from "../types";
import {
  readFiniteNumber,
  isPlainObject,
} from "../../adapter-response-metrics";
import { extractBaseFields } from "./base";

export const athenaAdapterResponseParser: AdapterResponseParser = {
  name: "athena",

  parse(input: unknown): AdapterResponseMetrics {
    if (!isPlainObject(input)) {
      return { rawKeys: [] };
    }

    const rawKeys = Object.keys(input).filter((k) => typeof k === "string");

    // Extract generic/base fields first
    const baseFields = extractBaseFields(input);

    // Athena-specific: data_scanned_in_bytes maps to canonical bytesProcessed
    const bytesProcessed = readFiniteNumber(input, "data_scanned_in_bytes");

    return {
      ...baseFields,
      ...(bytesProcessed !== undefined ? { bytesProcessed } : {}),
      rawKeys,
    };
  },

  canParse(input: unknown): boolean {
    // Athena typically has data_scanned_in_bytes
    if (!isPlainObject(input)) return false;
    return "data_scanned_in_bytes" in input;
  },
};
