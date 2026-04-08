/**
 * BigQuery adapter response parser.
 *
 * BigQueryAdapterResponse extends AdapterResponse with:
 * - bytes_processed: data scanned in bytes
 * - bytes_billed: billable data in bytes
 * - slot_ms: slot-milliseconds consumed
 * - project_id: GCP project ID
 * - location: dataset location
 * - job_id: BigQuery job ID (maps to canonical queryId)
 */

import type { AdapterResponseMetrics } from "../../adapter-response-metrics";
import type { AdapterResponseParser } from "../types";
import {
  readFiniteNumber,
  readNonEmptyString,
  isPlainObject,
} from "../../adapter-response-metrics";

export const bigqueryAdapterResponseParser: AdapterResponseParser = {
  name: "bigquery",

  parse(input: unknown): AdapterResponseMetrics {
    if (!isPlainObject(input)) {
      return { rawKeys: [] };
    }

    const rawKeys = Object.keys(input).filter((k) => typeof k === "string");

    // BigQuery-specific fields
    const bytesProcessed = readFiniteNumber(input, "bytes_processed");
    const bytesBilled = readFiniteNumber(input, "bytes_billed");
    const slotMs = readFiniteNumber(input, "slot_ms");
    const projectId = readNonEmptyString(input, "project_id");
    const location = readNonEmptyString(input, "location");

    // BigQuery uses job_id as primary identifier; map to canonical queryId
    // but also check for query_id as fallback
    const queryId =
      readNonEmptyString(input, "query_id") ??
      readNonEmptyString(input, "job_id");

    // Base response fields (still present in BigQuery)
    const rowsAffected = readFiniteNumber(input, "rows_affected");
    const adapterCode = readNonEmptyString(input, "code");
    const adapterMessage = readNonEmptyString(input, "_message");

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

  canParse(input: unknown): boolean {
    // BigQuery typically has bytes_processed, bytes_billed, or job_id
    if (!isPlainObject(input)) return false;
    return (
      "bytes_processed" in input ||
      "bytes_billed" in input ||
      "slot_ms" in input ||
      "job_id" in input ||
      "location" in input
    );
  },
};
