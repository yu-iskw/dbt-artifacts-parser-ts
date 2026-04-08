import type { AdapterResponseParser } from "../types";
import { parseBaseMetrics, readFiniteNumber } from "../types";

export const athenaAdapterResponseParser: AdapterResponseParser = {
  id: "athena",
  adapterTypes: ["athena"],
  canParse(adapterResponse) {
    return "data_scanned_in_bytes" in adapterResponse;
  },
  parse(adapterResponse) {
    const base = parseBaseMetrics(adapterResponse);
    const bytesProcessed = readFiniteNumber(
      adapterResponse,
      "data_scanned_in_bytes",
    );

    return {
      ...base,
      ...(bytesProcessed !== undefined ? { bytesProcessed } : {}),
    };
  },
};
