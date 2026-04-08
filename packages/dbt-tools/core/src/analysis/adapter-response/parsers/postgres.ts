import type { AdapterResponseParser } from "../types";
import { parseBaseMetrics } from "../types";

export const postgresAdapterResponseParser: AdapterResponseParser = {
  id: "postgres",
  adapterTypes: ["postgres"],
  canParse: () => false,
  parse: parseBaseMetrics,
};
