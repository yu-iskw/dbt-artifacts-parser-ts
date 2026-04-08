import type { AdapterResponseMetrics } from "../adapter-response-metrics";

export type AdapterResponseObject = Record<string, unknown>;

export type AdapterResponseParser = {
  readonly id: string;
  readonly adapterTypes: readonly string[];
  canParse(adapterResponse: AdapterResponseObject): boolean;
  parse(adapterResponse: AdapterResponseObject): AdapterResponseMetrics;
};

export type AdapterResponseParseContext = {
  adapterType?: string | null;
};

export function normalizeAdapterType(
  adapterType: string | null | undefined,
): string {
  return typeof adapterType === "string"
    ? adapterType.trim().toLowerCase()
    : "";
}

export function readFiniteNumber(
  obj: Record<string, unknown>,
  key: string,
): number | undefined {
  const v = obj[key];
  if (typeof v === "number" && Number.isFinite(v)) {
    return v;
  }
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return undefined;
}

export function readNonEmptyString(
  obj: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = obj[key];
  if (typeof v === "string" && v.trim() !== "") {
    return v;
  }
  return undefined;
}

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseBaseMetrics(
  adapterResponse: AdapterResponseObject,
): AdapterResponseMetrics {
  const rowsAffected = readFiniteNumber(adapterResponse, "rows_affected");
  const adapterCode = readNonEmptyString(adapterResponse, "code");
  const adapterMessage = readNonEmptyString(adapterResponse, "_message");
  const queryId = readNonEmptyString(adapterResponse, "query_id");

  return {
    ...(rowsAffected !== undefined ? { rowsAffected } : {}),
    ...(adapterCode !== undefined ? { adapterCode } : {}),
    ...(adapterMessage !== undefined ? { adapterMessage } : {}),
    ...(queryId !== undefined ? { queryId } : {}),
    rawKeys: Object.keys(adapterResponse),
  };
}
