import type { AdapterResponseParser } from "../types";
import {
  parseBaseMetrics,
  readFiniteNumber,
  readNonEmptyString,
} from "../types";

export const genericAdapterResponseParser: AdapterResponseParser = {
  id: "generic",
  adapterTypes: [],
  canParse: () => true,
  parse(adapterResponse) {
    const base = parseBaseMetrics(adapterResponse);
    const bytesProcessed =
      readFiniteNumber(adapterResponse, "bytes_processed") ??
      readFiniteNumber(adapterResponse, "data_scanned_in_bytes");
    const bytesBilled = readFiniteNumber(adapterResponse, "bytes_billed");
    const slotMs = readFiniteNumber(adapterResponse, "slot_ms");
    const queryId =
      base.queryId ??
      readNonEmptyString(adapterResponse, "job_id");
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
