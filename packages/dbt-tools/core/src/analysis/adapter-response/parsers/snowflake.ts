import type { AdapterResponseParser } from "../types";
import { parseBaseMetrics, readFiniteNumber } from "../types";

export const snowflakeAdapterResponseParser: AdapterResponseParser = {
  id: "snowflake",
  adapterTypes: ["snowflake"],
  canParse(adapterResponse) {
    return (
      "rows_inserted" in adapterResponse ||
      "rows_deleted" in adapterResponse ||
      "rows_updated" in adapterResponse ||
      "rows_duplicates" in adapterResponse
    );
  },
  parse(adapterResponse) {
    const base = parseBaseMetrics(adapterResponse);
    const rowsInserted = readFiniteNumber(adapterResponse, "rows_inserted");
    const rowsDeleted = readFiniteNumber(adapterResponse, "rows_deleted");
    const rowsUpdated = readFiniteNumber(adapterResponse, "rows_updated");
    const rowsDuplicates = readFiniteNumber(adapterResponse, "rows_duplicates");

    return {
      ...base,
      ...(rowsInserted !== undefined ? { rowsInserted } : {}),
      ...(rowsDeleted !== undefined ? { rowsDeleted } : {}),
      ...(rowsUpdated !== undefined ? { rowsUpdated } : {}),
      ...(rowsDuplicates !== undefined ? { rowsDuplicates } : {}),
    };
  },
};
