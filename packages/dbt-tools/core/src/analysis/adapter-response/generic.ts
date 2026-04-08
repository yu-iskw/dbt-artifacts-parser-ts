/**
 * Generic adapter response parser.
 * Falls back to existing best-effort normalization when adapter type is unknown or unavailable.
 * This is the safety net that ensures backward compatibility.
 */

import type { AdapterResponseMetrics } from "../adapter-response-metrics";
import type { AdapterResponseParser } from "./types";
import {
  readFiniteNumber,
  readNonEmptyString,
  isPlainObject,
} from "../adapter-response-metrics";

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

    // Base fields present in all adapters
    const bytesProcessed = readFiniteNumber(input, "bytes_processed");
    const bytesBilled = readFiniteNumber(input, "bytes_billed");
    const slotMs = readFiniteNumber(input, "slot_ms");
    const rowsAffected = readFiniteNumber(input, "rows_affected");

    const adapterCode = readNonEmptyString(input, "code");
    const adapterMessage = readNonEmptyString(input, "_message");

    // Query/job ID: prefer query_id but fall back to job_id (BigQuery pattern)
    const queryId =
      readNonEmptyString(input, "query_id") ??
      readNonEmptyString(input, "job_id");

    const projectId = readNonEmptyString(input, "project_id");
    const location = readNonEmptyString(input, "location");

    return {
      ...(bytesProcessed !== undefined ? { bytesProcessed } : {}),
      ...(bytesBilled !== undefined ? { bytesBilled } : {}),
      ...(slotMs !== undefined ? { slotMs } : {}),
      ...(rowsAffected !== undefined ? { rowsAffected } : {}),
      ...(adapterCode !== undefined ? { adapterCode } : {}),
      ...(adapterMessage !== undefined ? { adapterMessage } : {}),
      ...(queryId !== undefined ? { queryId } : {}),
      ...(projectId !== undefined ? { projectId } : {}),
      ...(location !== undefined ? { location } : {}),
      rawKeys,
    };
  },

  // Generic parser has no heuristic; rely on exact type match or other parsers
};
