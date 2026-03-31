import type { ExecutionRow } from "@web/types";
import { TEST_RESOURCE_TYPES } from "./constants";
import type { DashboardStatusFilter, RunsKind, RunsViewState } from "./types";
import { matchesExecutionRowDashboardStatus } from "./utils";
import {
  getRunsAdapterColumnKey,
  getRunsAdapterField,
  isRunsAdapterSortBy,
} from "./runsAdapterColumns";

export interface ResultsStatusCounts {
  all: number;
  positive: number;
  warning: number;
  danger: number;
}

export interface RunsFacetCounts {
  all: number;
  models: number;
  tests: number;
  seeds: number;
  snapshots: number;
  operations: number;
  healthy: number;
  warnings: number;
  errors: number;
  /** Rows with danger or warning execution tone (for Issues facet). */
  issues: number;
}

export interface RunsResultsSummary {
  status: ResultsStatusCounts;
  facets: RunsFacetCounts;
  resourceTypes: Record<string, number>;
  threadIds: Record<string, number>;
}

export interface RunsResultsQuery {
  kind: RunsKind;
  status: DashboardStatusFilter;
  query: string;
  resourceTypes: string[];
  threadIds: string[];
  durationBand: RunsViewState["durationBand"];
  sortBy: RunsViewState["sortBy"];
  limit: number;
}

export interface RunsResultsQueryResult {
  rows: ExecutionRow[];
  totalMatches: number;
  summary: RunsResultsSummary;
}

export interface RunsResultsIndexEntry {
  row: ExecutionRow;
  searchText: string;
}

export interface RunsResultsIndex {
  entries: RunsResultsIndexEntry[];
  summary: RunsResultsSummary;
}

function createEmptyCounts(): ResultsStatusCounts {
  return { all: 0, positive: 0, warning: 0, danger: 0 };
}

function createEmptyFacetCounts(): RunsFacetCounts {
  return {
    all: 0,
    models: 0,
    tests: 0,
    seeds: 0,
    snapshots: 0,
    operations: 0,
    healthy: 0,
    warnings: 0,
    errors: 0,
    issues: 0,
  };
}

function buildSearchText(row: ExecutionRow): string {
  const adapterBits = [
    ...(row.adapterResponseFields ?? []).flatMap((field) => [
      field.key,
      field.displayValue,
    ]),
    ...(row.adapterMetrics
      ? [
          row.adapterMetrics.adapterMessage ?? "",
          row.adapterMetrics.rawKeys.join(" "),
        ]
      : []),
  ];
  return [
    row.name,
    row.resourceType,
    row.packageName,
    row.path ?? "",
    row.uniqueId,
    row.status,
    row.threadId ?? "",
    ...adapterBits,
  ]
    .join(" ")
    .toLowerCase();
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function isStatusMatch(
  row: ExecutionRow,
  status: DashboardStatusFilter,
): boolean {
  return matchesExecutionRowDashboardStatus(row, status);
}

function getKindForRow(row: ExecutionRow): Exclude<RunsKind, "all"> {
  if (TEST_RESOURCE_TYPES.has(row.resourceType)) return "tests";
  if (row.resourceType === "seed") return "seeds";
  if (row.resourceType === "snapshot") return "snapshots";
  if (
    row.resourceType === "operation" ||
    row.resourceType === "sql_operation" ||
    row.resourceType === "macro"
  ) {
    return "operations";
  }
  return "models";
}

function isKindMatch(row: ExecutionRow, kind: RunsKind): boolean {
  return kind === "all" || getKindForRow(row) === kind;
}

function isDurationBandMatch(
  row: ExecutionRow,
  durationBand: RunsViewState["durationBand"],
): boolean {
  if (durationBand === "all") return true;
  if (durationBand === "fast") return row.executionTime < 1;
  if (durationBand === "medium")
    return row.executionTime >= 1 && row.executionTime < 5;
  return row.executionTime >= 5;
}

function compareAdapterValues(
  left: number | string | undefined,
  right: number | string | undefined,
): number {
  const leftMissing = left === undefined;
  const rightMissing = right === undefined;
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;
  if (typeof left === "number" && typeof right === "number") {
    return right - left;
  }
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function compareRows(
  left: ExecutionRow,
  right: ExecutionRow,
  sortBy: RunsViewState["sortBy"],
): number {
  switch (sortBy) {
    case "duration":
      return right.executionTime - left.executionTime;
    case "name":
      return left.name.localeCompare(right.name);
    case "status":
      return left.status.localeCompare(right.status);
    case "start":
      return (right.start ?? 0) - (left.start ?? 0);
    default:
      if (isRunsAdapterSortBy(sortBy)) {
        const key = getRunsAdapterColumnKey(sortBy);
        const leftField = getRunsAdapterField(left, key);
        const rightField = getRunsAdapterField(right, key);
        if (!leftField?.isScalar && !rightField?.isScalar) return 0;
        if (!leftField?.isScalar) return 1;
        if (!rightField?.isScalar) return -1;
        return compareAdapterValues(leftField.sortValue, rightField.sortValue);
      }
      {
        const rank = {
          danger: 0,
          warning: 1,
          positive: 2,
          skipped: 3,
          neutral: 4,
        } as const;
        const toneCompare = rank[left.statusTone] - rank[right.statusTone];
        if (toneCompare !== 0) return toneCompare;
        return right.executionTime - left.executionTime;
      }
    case "attention": {
      const rank = {
        danger: 0,
        warning: 1,
        positive: 2,
        skipped: 3,
        neutral: 4,
      } as const;
      const toneCompare = rank[left.statusTone] - rank[right.statusTone];
      if (toneCompare !== 0) return toneCompare;
      return right.executionTime - left.executionTime;
    }
  }
}

function summarize(entries: RunsResultsIndexEntry[]): RunsResultsSummary {
  const status = createEmptyCounts();
  const facets = createEmptyFacetCounts();
  const resourceTypes: Record<string, number> = {};
  const threadIds: Record<string, number> = {};

  status.all = entries.length;
  facets.all = entries.length;

  for (const entry of entries) {
    const { row } = entry;
    if (row.statusTone === "positive") {
      status.positive += 1;
      facets.healthy += 1;
    } else if (row.statusTone === "warning") {
      status.warning += 1;
      facets.warnings += 1;
      facets.issues += 1;
    } else if (row.statusTone === "danger") {
      status.danger += 1;
      facets.errors += 1;
      facets.issues += 1;
    }

    facets[getKindForRow(row)] += 1;
    resourceTypes[row.resourceType] =
      (resourceTypes[row.resourceType] ?? 0) + 1;
    if (row.threadId) {
      threadIds[row.threadId] = (threadIds[row.threadId] ?? 0) + 1;
    }
  }

  return { status, facets, resourceTypes, threadIds };
}

export function createRunsResultsIndex(rows: ExecutionRow[]): RunsResultsIndex {
  const entries = rows.map((row) => ({
    row,
    searchText: buildSearchText(row),
  }));
  return {
    entries,
    summary: summarize(entries),
  };
}

export function filterRunsResultsIndex(
  index: RunsResultsIndex,
  query: Omit<RunsResultsQuery, "limit" | "sortBy"> & {
    sortBy?: RunsViewState["sortBy"];
  },
): RunsResultsIndexEntry[] {
  const normalizedQuery = normalizeQuery(query.query);
  const activeResourceTypes = new Set(query.resourceTypes);
  const activeThreadIds = new Set(query.threadIds);

  const matches = index.entries.filter((entry) => {
    const { row } = entry;
    if (!isKindMatch(row, query.kind)) return false;
    if (!isStatusMatch(row, query.status)) return false;
    if (normalizedQuery !== "" && !entry.searchText.includes(normalizedQuery))
      return false;
    if (
      activeResourceTypes.size > 0 &&
      !activeResourceTypes.has(row.resourceType)
    )
      return false;
    if (activeThreadIds.size > 0 && !activeThreadIds.has(row.threadId ?? ""))
      return false;
    if (!isDurationBandMatch(row, query.durationBand)) return false;
    return true;
  });

  const sortBy = query.sortBy ?? "attention";
  return [...matches].sort((left, right) =>
    compareRows(left.row, right.row, sortBy),
  );
}

export function queryRunsResultsIndex(
  index: RunsResultsIndex,
  query: RunsResultsQuery,
): RunsResultsQueryResult {
  const matches = filterRunsResultsIndex(index, query);
  return {
    rows: matches.slice(0, query.limit).map((entry) => entry.row),
    totalMatches: matches.length,
    summary: summarize(matches),
  };
}
