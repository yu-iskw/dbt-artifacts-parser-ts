import type { ExecutionRow } from "@web/types";
import {
  getRunsAdapterField,
  type RunsAdapterColumn,
} from "@web/lib/analysis-workspace/runsAdapterColumns";
import { EntityInspector, formatResourceTypeLabel } from "../shared";
import { formatSeconds } from "@web/lib/analysis-workspace/utils";

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
  const sections =
    adapterFieldCount > 0
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
          ...(visibleColumns.length === 0 && overflowColumns.length === 0
            ? [
                {
                  label: "Adapter response",
                  value: "This row has no adapter_response fields.",
                },
              ]
            : []),
        ]
      : [
          {
            label: "Adapter response",
            value: "This row has no adapter_response fields.",
          },
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
