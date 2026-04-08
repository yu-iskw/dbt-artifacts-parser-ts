import type { AdapterResponseMetrics } from "../adapter-response-metrics";
import { genericAdapterResponseParser } from "./parsers/generic";
import type { AdapterResponseObject } from "./types";

export function normalizeGenericAdapterResponse(
  adapterResponse: AdapterResponseObject,
): AdapterResponseMetrics {
  return genericAdapterResponseParser.parse(adapterResponse);
}
