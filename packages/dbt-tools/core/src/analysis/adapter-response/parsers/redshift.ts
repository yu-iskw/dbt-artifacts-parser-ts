import type { AdapterResponseParser } from "../types";
import { parseBaseMetrics } from "../types";

export const redshiftAdapterResponseParser: AdapterResponseParser = {
  id: "redshift",
  adapterTypes: ["redshift"],
  canParse: () => false,
  parse: parseBaseMetrics,
};
