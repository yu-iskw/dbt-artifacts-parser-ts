import type { AdapterResponseParser } from "../types";
import { parseBaseMetrics } from "../types";

export const sparkAdapterResponseParser: AdapterResponseParser = {
  id: "spark",
  adapterTypes: ["spark"],
  canParse: () => false,
  parse: parseBaseMetrics,
};
