import type { AdapterResponseParser } from "../types";
import {
  parseBaseMetrics,
  readFiniteNumber,
  readNonEmptyString,
} from "../types";

export const bigqueryAdapterResponseParser: AdapterResponseParser = {
  id: "bigquery",
  adapterTypes: ["bigquery"],
  canParse(adapterResponse) {
    return (
      "bytes_processed" in adapterResponse ||
      "bytes_billed" in adapterResponse ||
      "slot_ms" in adapterResponse ||
      "job_id" in adapterResponse
    );
  },
  parse(adapterResponse) {
    const base = parseBaseMetrics(adapterResponse);
    const bytesProcessed = readFiniteNumber(adapterResponse, "bytes_processed");
    const bytesBilled = readFiniteNumber(adapterResponse, "bytes_billed");
    const slotMs = readFiniteNumber(adapterResponse, "slot_ms");
    const queryId =
      base.queryId ?? readNonEmptyString(adapterResponse, "job_id");
    const projectId = readNonEmptyString(adapterResponse, "project_id");
    const location = readNonEmptyString(adapterResponse, "location");

    return {
      ...base,
      ...(bytesProcessed !== undefined ? { bytesProcessed } : {}),
      ...(bytesBilled !== undefined ? { bytesBilled } : {}),
      ...(slotMs !== undefined ? { slotMs } : {}),
      ...(queryId !== undefined ? { queryId } : {}),
      ...(projectId !== undefined ? { projectId } : {}),
      ...(location !== undefined ? { location } : {}),
    };
  },
};
