import type { ExecutionRow } from "@web/types";
import { getAdapterResponseFieldsBeyondNormalized } from "@dbt-tools/core/browser";
import {
  getRunsAdapterField,
  type RunsAdapterColumn,
} from "@web/lib/analysis-workspace/runsAdapterColumns";
import { EntityInspector, formatResourceTypeLabel } from "../../shared";
import { formatSeconds } from "@web/lib/analysis-workspace/utils";
import { buildCrossViewNavigationTargets } from "@web/lib/analysis-workspace/crossViewNavigation";

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

const RAW_ADAPTER_RESPONSE_FIELDS_LABEL = "Raw adapter response fields";
const ADAPTER_METRICS_LABEL = "Adapter metrics";

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
  const extraAdapterRawFields = getAdapterResponseFieldsBeyondNormalized(
    row.adapterMetrics,
    row.adapterResponseFields,
  );
  const normalizedSections =
    visibleColumns.length > 0 || overflowColumns.length > 0
      ? [
          ...(visibleColumns.length > 0
            ? [
                {
                  label: ADAPTER_METRICS_LABEL,
                  value: formatInspectorFields(row, visibleColumns),
                },
              ]
            : []),
          ...(overflowColumns.length > 0
            ? [
                {
                  label: "More adapter metrics",
                  value: formatInspectorFields(row, overflowColumns),
                },
              ]
            : []),
        ]
      : row.adapterMetrics
        ? [
            {
              label: ADAPTER_METRICS_LABEL,
              value:
                "This row has normalized adapter metrics but none are configured as visible columns.",
            },
          ]
        : [];
  const rawFieldSection =
    adapterFieldCount === 0
      ? [
          {
            label: RAW_ADAPTER_RESPONSE_FIELDS_LABEL,
            value: "This row has no adapter_response fields.",
          },
        ]
      : extraAdapterRawFields.length > 0
        ? [
            {
              label: RAW_ADAPTER_RESPONSE_FIELDS_LABEL,
              value: extraAdapterRawFields
                .map((field) => `${field.label}: ${field.displayValue}`)
                .join("\n"),
            },
          ]
        : [];
  const sections = [...normalizedSections, ...rawFieldSection];
  const relatedTargets = buildCrossViewNavigationTargets({
    resourceId: row.uniqueId,
    executionId: row.uniqueId,
  });

  return (
    <EntityInspector
      eyebrow="Selected run item"
      title={row.name}
      typeLabel={formatResourceTypeLabel(row.resourceType)}
      stats={[
        { label: "Status", value: row.status },
        { label: "Duration", value: formatSeconds(row.executionTime) },
        { label: "Thread", value: row.threadId ?? "n/a" },
        {
          label: ADAPTER_METRICS_LABEL,
          value: String(visibleColumns.length + overflowColumns.length),
        },
        {
          label: "Extra raw fields",
          value: String(extraAdapterRawFields.length),
        },
      ]}
      sections={sections}
      actions={[
        ...(relatedTargets.timeline
          ? [
              {
                label: "Open in Timeline",
                onClick: () =>
                  onNavigateTo(
                    relatedTargets.timeline.view,
                    relatedTargets.timeline.options,
                  ),
              },
            ]
          : []),
        ...(relatedTargets.inventory
          ? [
              {
                label: "Open in Inventory",
                onClick: () =>
                  onNavigateTo(
                    relatedTargets.inventory.view,
                    relatedTargets.inventory.options,
                  ),
              },
            ]
          : []),
        ...(relatedTargets.lineage
          ? [
              {
                label: "Open in Lineage",
                onClick: () =>
                  onNavigateTo(
                    relatedTargets.lineage.view,
                    relatedTargets.lineage.options,
                  ),
              },
            ]
          : []),
        {
          label: "Open in Health",
          onClick: () =>
            onNavigateTo(relatedTargets.health.view, relatedTargets.health.options),
        },
      ]}
    />
  );
}
