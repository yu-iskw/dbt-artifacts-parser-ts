import type { AdapterResponseMetrics } from "../adapter-response-metrics";
import { selectAdapterResponseParser } from "./dispatch";
import { normalizeGenericAdapterResponse } from "./generic";
import type { AdapterResponseParseContext } from "./types";
import { isPlainObject } from "./types";

export function normalizeAdapterResponseWithContext(
  adapterResponse: unknown,
  context: AdapterResponseParseContext,
): AdapterResponseMetrics {
  if (!isPlainObject(adapterResponse)) {
    return { rawKeys: [] };
  }

  const parser = selectAdapterResponseParser(
    context.adapterType,
    adapterResponse,
  );
  return parser.parse(adapterResponse);
}

export function normalizeAdapterResponse(
  adapterResponse: unknown,
): AdapterResponseMetrics {
  return normalizeAdapterResponseWithContext(adapterResponse, {});
}

export { normalizeGenericAdapterResponse };
