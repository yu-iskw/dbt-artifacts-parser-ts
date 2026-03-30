import type {
  AdapterResponseField,
  AdapterResponseFieldKind,
} from "@dbt-tools/core/browser";
import type { ExecutionRow } from "@web/types";
import type { RunsAdapterColumnId, RunsSortBy } from "./types";

export const MAX_VISIBLE_RUNS_ADAPTER_COLUMNS = 6;

export interface RunsAdapterColumn {
  id: RunsAdapterColumnId;
  key: string;
  label: string;
  kind: AdapterResponseFieldKind;
  align: "start" | "end";
  isScalar: boolean;
  presenceCount: number;
}

export interface RunsAdapterColumnLayout {
  visibleColumns: RunsAdapterColumn[];
  overflowColumns: RunsAdapterColumn[];
  allColumns: RunsAdapterColumn[];
}

function getFieldPriority(
  field: Pick<AdapterResponseField, "isScalar">,
): number {
  return field.isScalar ? 0 : 1;
}

function findField(
  row: ExecutionRow,
  key: string,
): AdapterResponseField | undefined {
  return row.adapterResponseFields?.find((field) => field.key === key);
}

export function getRunsAdapterColumnId(key: string): RunsAdapterColumnId {
  return `adapter:${key}`;
}

export function getRunsAdapterColumnKey(id: RunsAdapterColumnId): string {
  return id.slice("adapter:".length);
}

export function isRunsAdapterSortBy(
  sortBy: RunsSortBy,
): sortBy is RunsAdapterColumnId {
  return sortBy.startsWith("adapter:");
}

export function getRunsAdapterField(
  row: ExecutionRow,
  key: string,
): AdapterResponseField | undefined {
  return findField(row, key);
}

export function getRunsAdapterColumnLayout(
  rows: ExecutionRow[],
): RunsAdapterColumnLayout {
  const counts = new Map<
    string,
    { field: AdapterResponseField; presenceCount: number }
  >();

  for (const row of rows) {
    const seen = new Set<string>();
    for (const field of row.adapterResponseFields ?? []) {
      if (seen.has(field.key)) continue;
      seen.add(field.key);
      const current = counts.get(field.key);
      if (current) {
        current.presenceCount += 1;
      } else {
        counts.set(field.key, { field, presenceCount: 1 });
      }
    }
  }

  const allColumns = [...counts.entries()]
    .map(
      ([key, value]): RunsAdapterColumn => ({
        id: getRunsAdapterColumnId(key),
        key,
        label: value.field.label,
        kind: value.field.kind,
        align: value.field.kind === "number" ? "end" : "start",
        isScalar: value.field.isScalar,
        presenceCount: value.presenceCount,
      }),
    )
    .sort((left, right) => {
      if (getFieldPriority(left) !== getFieldPriority(right)) {
        return getFieldPriority(left) - getFieldPriority(right);
      }
      if (left.presenceCount !== right.presenceCount) {
        return right.presenceCount - left.presenceCount;
      }
      return left.key.localeCompare(right.key);
    });

  return {
    allColumns,
    visibleColumns: allColumns.slice(0, MAX_VISIBLE_RUNS_ADAPTER_COLUMNS),
    overflowColumns: allColumns.slice(MAX_VISIBLE_RUNS_ADAPTER_COLUMNS),
  };
}
