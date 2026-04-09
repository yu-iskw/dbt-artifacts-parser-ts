import type { ExecutionRow } from "@web/types";
import { adapterMetricsHasData } from "@dbt-tools/core/browser";
import {
  getRunsAdapterField,
  type RunsAdapterColumn,
} from "@web/lib/analysis-workspace/runsAdapterColumns";
import { EntityInspector, formatResourceTypeLabel } from "../../shared";
import { formatSeconds, formatBytes } from "@web/lib/analysis-workspace/utils";

function formatInspectorFields(
  row: ExecutionRow,
  columns: RunsAdapterColumn[],
): string {
  const lines = columns.map((column) => {
    const field = getRunsAdapterField(row, column.key);
    return `${column.label}: ${field?.displayValue ?? "—"}`;
  });
  return lines.join("\n");
}

function formatAdapterMetrics(row: ExecutionRow): string {
  const metrics = row.adapterMetrics;
  if (!metrics || !adapterMetricsHasData(metrics)) {
    return "No normalized adapter metrics available";
  }

  const lines: string[] = [];

  // Message and code
  if (metrics.adapterMessage) {
    lines.push(`Message: ${metrics.adapterMessage}`);
  }
  if (metrics.adapterCode) {
    lines.push(`Code: ${metrics.adapterCode}`);
  }

  // Query ID
  if (metrics.queryId) {
    lines.push(`Query ID: ${metrics.queryId}`);
  }

  // Rows affected
  if (metrics.rowsAffected !== undefined) {
    lines.push(`Rows affected: ${metrics.rowsAffected.toLocaleString()}`);
  }

  // Bytes processed / billed
  if (metrics.bytesProcessed !== undefined) {
    lines.push(`Bytes processed: ${formatBytes(metrics.bytesProcessed)}`);
  }
  if (metrics.bytesBilled !== undefined) {
    lines.push(`Bytes billed: ${formatBytes(metrics.bytesBilled)}`);
  }

  // Slot milliseconds
  if (metrics.slotMs !== undefined) {
    lines.push(`Slot ms: ${metrics.slotMs.toLocaleString()}`);
  }

  // Project and location (BigQuery)
  if (metrics.projectId) {
    lines.push(`Project: ${metrics.projectId}`);
  }
  if (metrics.location) {
    lines.push(`Location: ${metrics.location}`);
  }

  // Snowflake DML stats
  if (metrics.rowsInserted !== undefined) {
    lines.push(`Rows inserted: ${metrics.rowsInserted.toLocaleString()}`);
  }
  if (metrics.rowsDeleted !== undefined) {
    lines.push(`Rows deleted: ${metrics.rowsDeleted.toLocaleString()}`);
  }
  if (metrics.rowsUpdated !== undefined) {
    lines.push(`Rows updated: ${metrics.rowsUpdated.toLocaleString()}`);
  }
  if (metrics.rowsDuplicated !== undefined) {
    lines.push(`Rows duplicated: ${metrics.rowsDuplicated.toLocaleString()}`);
  }

  return lines.length > 0 ? lines.join("\n") : "No normalized adapter metrics available";
}

export function RunsAdapterInspector({
  row,
  visibleColumns,
  overflowColumns,
  onNavigateTo,
}: {
  row: ExecutionRow | null;
  visibleColumns: RunsAdapterColumn[];
  overflowColumns: RunsAdapterColumn[];
  onNavigateTo: (
    view: "inventory" | "timeline",
    options?: {
      resourceId?: string;
      executionId?: string;
      assetTab?: "summary" | "lineage";
      rootResourceId?: string;
    },
  ) => void;
}) {
  if (!row) return null;

  const adapterFieldCount = row.adapterResponseFields?.length ?? 0;
  const hasNormalizedMetrics =
    row.adapterMetrics && adapterMetricsHasData(row.adapterMetrics);

  const sections = [
    ...(hasNormalizedMetrics
      ? [
          {
            label: "Normalized adapter metrics",
            value: formatAdapterMetrics(row),
          },
        ]
      : []),
    ...(adapterFieldCount > 0
      ? [
          ...(visibleColumns.length > 0
            ? [
                {
                  label: "Visible adapter fields",
                  value: formatInspectorFields(row, visibleColumns),
                },
              ]
            : []),
          ...(overflowColumns.length > 0
            ? [
                {
                  label: "Overflow adapter fields",
                  value: formatInspectorFields(row, overflowColumns),
                },
              ]
            : []),
        ]
      : []),
    ...(adapterFieldCount === 0 && !hasNormalizedMetrics
      ? [
          {
            label: "Adapter response",
            value: "This row has no adapter_response fields.",
          },
        ]
      : []),
  ];

  return (
    <EntityInspector
      eyebrow="Selected run item"
      title={row.name}
      typeLabel={formatResourceTypeLabel(row.resourceType)}
      stats={[
        { label: "Status", value: row.status },
        { label: "Duration", value: formatSeconds(row.executionTime) },
        { label: "Thread", value: row.threadId ?? "n/a" },
        { label: "Adapter fields", value: String(adapterFieldCount) },
      ]}
      sections={sections}
      actions={[
        {
          label: "Open in Timeline",
          onClick: () =>
            onNavigateTo("timeline", {
              resourceId: row.uniqueId,
              executionId: row.uniqueId,
            }),
        },
        {
          label: "Open in Inventory",
          onClick: () =>
            onNavigateTo("inventory", {
              resourceId: row.uniqueId,
              assetTab: "summary",
            }),
        },
        {
          label: "Open in Lineage",
          onClick: () =>
            onNavigateTo("inventory", {
              resourceId: row.uniqueId,
              assetTab: "lineage",
              rootResourceId: row.uniqueId,
            }),
        },
      ]}
    />
  );
}
