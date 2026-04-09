import type {
  AdapterResponseMetrics,
  AdapterTotalsSnapshot,
} from "./adapter-response-metrics";

export type AdapterMetricKey =
  | "queryId"
  | "adapterCode"
  | "adapterMessage"
  | "bytesProcessed"
  | "bytesBilled"
  | "slotMs"
  | "rowsAffected"
  | "projectId"
  | "location"
  | "rowsInserted"
  | "rowsUpdated"
  | "rowsDeleted"
  | "rowsDuplicated";

export type AdapterMetricValue = number | string | undefined;

export interface AdapterMetricDescriptor {
  key: AdapterMetricKey;
  label: string;
  shortLabel: string;
  kind: "number" | "string";
  humanSortKey?: AdapterMetricSortKey;
  summaryTotalKey?: keyof AdapterTotalsSnapshot;
}

export type AdapterMetricSortKey =
  | "query_id"
  | "adapter_code"
  | "adapter_message"
  | "bytes_processed"
  | "bytes_billed"
  | "slot_ms"
  | "rows_affected"
  | "project_id"
  | "location"
  | "rows_inserted"
  | "rows_updated"
  | "rows_deleted"
  | "rows_duplicated";

export const ADAPTER_METRIC_DESCRIPTORS: AdapterMetricDescriptor[] = [
  {
    key: "queryId",
    label: "Query ID",
    shortLabel: "Query ID",
    kind: "string",
    humanSortKey: "query_id",
  },
  {
    key: "adapterCode",
    label: "Adapter code",
    shortLabel: "Code",
    kind: "string",
    humanSortKey: "adapter_code",
  },
  {
    key: "adapterMessage",
    label: "Adapter message",
    shortLabel: "Message",
    kind: "string",
    humanSortKey: "adapter_message",
  },
  {
    key: "bytesProcessed",
    label: "Bytes processed",
    shortLabel: "Bytes processed",
    kind: "number",
    humanSortKey: "bytes_processed",
    summaryTotalKey: "totalBytesProcessed",
  },
  {
    key: "bytesBilled",
    label: "Bytes billed",
    shortLabel: "Bytes billed",
    kind: "number",
    humanSortKey: "bytes_billed",
    summaryTotalKey: "totalBytesBilled",
  },
  {
    key: "slotMs",
    label: "Slot ms",
    shortLabel: "Slot ms",
    kind: "number",
    humanSortKey: "slot_ms",
    summaryTotalKey: "totalSlotMs",
  },
  {
    key: "rowsAffected",
    label: "Rows affected",
    shortLabel: "Rows",
    kind: "number",
    humanSortKey: "rows_affected",
    summaryTotalKey: "totalRowsAffected",
  },
  {
    key: "projectId",
    label: "Project ID",
    shortLabel: "Project",
    kind: "string",
    humanSortKey: "project_id",
  },
  {
    key: "location",
    label: "Location",
    shortLabel: "Location",
    kind: "string",
    humanSortKey: "location",
  },
  {
    key: "rowsInserted",
    label: "Rows inserted",
    shortLabel: "Inserted",
    kind: "number",
    humanSortKey: "rows_inserted",
    summaryTotalKey: "totalRowsInserted",
  },
  {
    key: "rowsUpdated",
    label: "Rows updated",
    shortLabel: "Updated",
    kind: "number",
    humanSortKey: "rows_updated",
    summaryTotalKey: "totalRowsUpdated",
  },
  {
    key: "rowsDeleted",
    label: "Rows deleted",
    shortLabel: "Deleted",
    kind: "number",
    humanSortKey: "rows_deleted",
    summaryTotalKey: "totalRowsDeleted",
  },
  {
    key: "rowsDuplicated",
    label: "Rows duplicated",
    shortLabel: "Duplicated",
    kind: "number",
    humanSortKey: "rows_duplicated",
    summaryTotalKey: "totalRowsDuplicated",
  },
];

export function getAdapterMetricValue(
  metrics: AdapterResponseMetrics | undefined,
  key: AdapterMetricKey,
): AdapterMetricValue {
  if (metrics == null) return undefined;
  return metrics[key];
}

export function formatAdapterMetricValue(
  descriptor: AdapterMetricDescriptor,
  value: AdapterMetricValue,
): string {
  if (value === undefined) return "—";
  if (descriptor.kind === "number" && typeof value === "number") {
    return value.toLocaleString("en-US");
  }
  return String(value);
}

export function getPresentAdapterMetricDescriptors(
  metricsList: Array<AdapterResponseMetrics | undefined>,
): AdapterMetricDescriptor[] {
  return ADAPTER_METRIC_DESCRIPTORS.filter((descriptor) =>
    metricsList.some(
      (metrics) => getAdapterMetricValue(metrics, descriptor.key) !== undefined,
    ),
  );
}

export function getPresentAdapterTotalDescriptors(
  totals: AdapterTotalsSnapshot | undefined,
): AdapterMetricDescriptor[] {
  if (totals == null) return [];
  return ADAPTER_METRIC_DESCRIPTORS.filter((descriptor) => {
    if (descriptor.summaryTotalKey == null) return false;
    return totals[descriptor.summaryTotalKey] !== undefined;
  });
}
