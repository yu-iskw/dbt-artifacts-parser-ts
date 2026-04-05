/**
 * Best-effort normalization of dbt run_results adapter_response objects.
 * Shapes vary by warehouse adapter. We keep stable normalized metrics for
 * aggregate/report use-cases and also preserve a browser-safe field model for
 * arbitrary UI rendering.
 */

export type AdapterResponseFieldKind =
  | "number"
  | "string"
  | "boolean"
  | "null"
  | "object"
  | "array";

export interface AdapterResponseField {
  key: string;
  label: string;
  kind: AdapterResponseFieldKind;
  displayValue: string;
  isScalar: boolean;
  sortValue?: number | string;
}

export interface AdapterResponseMetrics {
  bytesProcessed?: number;
  bytesBilled?: number;
  slotMs?: number;
  rowsAffected?: number;
  adapterCode?: string;
  adapterMessage?: string;
  /** BigQuery job id, Snowflake query id, etc. */
  queryId?: string;
  projectId?: string;
  location?: string;
  /** Top-level keys present on the raw object (for debugging). */
  rawKeys: string[];
}

export interface AdapterTotalsSnapshot {
  nodesWithAdapterData: number;
  totalBytesProcessed?: number;
  totalBytesBilled?: number;
  totalSlotMs?: number;
  totalRowsAffected?: number;
}

function readFiniteNumber(
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

function readNonEmptyString(
  obj: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = obj[key];
  if (typeof v === "string" && v.trim() !== "") {
    return v;
  }
  return undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stableStringify(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return value === "" ? '""' : value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(", ")}]`;
  }
  if (!isPlainObject(value)) {
    return String(value);
  }
  const sortedKeys = Object.keys(value).sort();
  return `{${sortedKeys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

function buildField(key: string, value: unknown): AdapterResponseField {
  if (typeof value === "number" && Number.isFinite(value)) {
    return {
      key,
      label: key,
      kind: "number",
      displayValue: value.toLocaleString(),
      isScalar: true,
      sortValue: value,
    };
  }
  if (typeof value === "string") {
    return {
      key,
      label: key,
      kind: "string",
      displayValue: value === "" ? '""' : value,
      isScalar: true,
      sortValue: value,
    };
  }
  if (typeof value === "boolean") {
    return {
      key,
      label: key,
      kind: "boolean",
      displayValue: value ? "true" : "false",
      isScalar: true,
      sortValue: value ? 1 : 0,
    };
  }
  if (value === null) {
    return {
      key,
      label: key,
      kind: "null",
      displayValue: "null",
      isScalar: false,
    };
  }
  if (Array.isArray(value)) {
    return {
      key,
      label: key,
      kind: "array",
      displayValue: stableStringify(value),
      isScalar: false,
    };
  }
  return {
    key,
    label: key,
    kind: "object",
    displayValue: stableStringify(value),
    isScalar: false,
  };
}

function flattenTopLevelEntry(
  key: string,
  value: unknown,
): AdapterResponseField[] {
  if (!isPlainObject(value)) {
    return [buildField(key, value)];
  }

  const nestedKeys = Object.keys(value).sort();
  if (nestedKeys.length === 0) {
    return [buildField(key, value)];
  }

  return nestedKeys.map((nestedKey) =>
    buildField(`${key}.${nestedKey}`, value[nestedKey]),
  );
}

/**
 * Returns true when any normalized field beyond rawKeys is present.
 */
export function adapterMetricsHasData(
  metrics: AdapterResponseMetrics,
): boolean {
  return (
    metrics.bytesProcessed !== undefined ||
    metrics.bytesBilled !== undefined ||
    metrics.slotMs !== undefined ||
    metrics.rowsAffected !== undefined ||
    metrics.adapterCode !== undefined ||
    metrics.adapterMessage !== undefined ||
    metrics.queryId !== undefined ||
    metrics.projectId !== undefined ||
    metrics.location !== undefined
  );
}

export function isAdapterResponseObject(
  adapterResponse: unknown,
): adapterResponse is Record<string, unknown> {
  return isPlainObject(adapterResponse);
}

/**
 * Some exports / loaders stringify `adapter_response` even though artifacts are
 * normally objects. Parse JSON object/array strings so we can extract fields.
 */
export function coerceAdapterResponseInput(raw: unknown): unknown {
  if (typeof raw !== "string") {
    return raw;
  }
  const t = raw.trim();
  if (t === "" || t === "null") {
    return null;
  }
  const first = t[0];
  if (first !== "{" && first !== "[") {
    return raw;
  }
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return raw;
  }
}

/**
 * Normalize adapter_response from a single run_results result row.
 */
export function normalizeAdapterResponse(
  adapterResponse: unknown,
): AdapterResponseMetrics {
  if (!isPlainObject(adapterResponse)) {
    return { rawKeys: [] };
  }

  const rawKeys = Object.keys(adapterResponse).filter(
    (k) => typeof k === "string",
  );

  const bytesProcessed = readFiniteNumber(adapterResponse, "bytes_processed");
  const bytesBilled = readFiniteNumber(adapterResponse, "bytes_billed");
  const slotMs = readFiniteNumber(adapterResponse, "slot_ms");
  const rowsAffected = readFiniteNumber(adapterResponse, "rows_affected");

  const adapterCode = readNonEmptyString(adapterResponse, "code");
  const adapterMessage = readNonEmptyString(adapterResponse, "_message");

  const queryId =
    readNonEmptyString(adapterResponse, "query_id") ??
    readNonEmptyString(adapterResponse, "job_id");
  const projectId = readNonEmptyString(adapterResponse, "project_id");
  const location = readNonEmptyString(adapterResponse, "location");

  return {
    ...(bytesProcessed !== undefined ? { bytesProcessed } : {}),
    ...(bytesBilled !== undefined ? { bytesBilled } : {}),
    ...(slotMs !== undefined ? { slotMs } : {}),
    ...(rowsAffected !== undefined ? { rowsAffected } : {}),
    ...(adapterCode !== undefined ? { adapterCode } : {}),
    ...(adapterMessage !== undefined ? { adapterMessage } : {}),
    ...(queryId !== undefined ? { queryId } : {}),
    ...(projectId !== undefined ? { projectId } : {}),
    ...(location !== undefined ? { location } : {}),
    rawKeys,
  };
}

/**
 * Preserve browser-safe raw adapter_response fields for arbitrary UI rendering.
 * Top-level objects are flattened one level deep; deeper arrays/objects are
 * stringified deterministically for display.
 */
export function extractAdapterResponseFields(
  adapterResponse: unknown,
): AdapterResponseField[] {
  if (!isPlainObject(adapterResponse)) {
    return [];
  }

  return Object.keys(adapterResponse)
    .sort()
    .flatMap((key) => flattenTopLevelEntry(key, adapterResponse[key]));
}

/**
 * Aggregate adapter metrics across node executions for snapshot-level summaries.
 */
export function buildAdapterTotals(
  metricsList: Array<AdapterResponseMetrics | undefined>,
): AdapterTotalsSnapshot | undefined {
  let nodesWithAdapterData = 0;
  let totalBytesProcessed = 0;
  let totalBytesBilled = 0;
  let totalSlotMs = 0;
  let totalRowsAffected = 0;
  let sawBytesProcessed = false;
  let sawBytesBilled = false;
  let sawSlotMs = false;
  let sawRowsAffected = false;

  for (const m of metricsList) {
    if (m == null || !adapterMetricsHasData(m)) continue;
    nodesWithAdapterData += 1;
    if (m.bytesProcessed !== undefined) {
      totalBytesProcessed += m.bytesProcessed;
      sawBytesProcessed = true;
    }
    if (m.bytesBilled !== undefined) {
      totalBytesBilled += m.bytesBilled;
      sawBytesBilled = true;
    }
    if (m.slotMs !== undefined) {
      totalSlotMs += m.slotMs;
      sawSlotMs = true;
    }
    if (m.rowsAffected !== undefined) {
      totalRowsAffected += m.rowsAffected;
      sawRowsAffected = true;
    }
  }

  if (nodesWithAdapterData === 0) {
    return undefined;
  }

  return {
    nodesWithAdapterData,
    ...(sawBytesProcessed ? { totalBytesProcessed } : {}),
    ...(sawBytesBilled ? { totalBytesBilled } : {}),
    ...(sawSlotMs ? { totalSlotMs } : {}),
    ...(sawRowsAffected ? { totalRowsAffected } : {}),
  };
}
