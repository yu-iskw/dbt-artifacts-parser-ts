import type { ExecutionRow } from "@web/types";
import { TEST_RESOURCE_TYPES } from "./constants";
import type { DashboardStatusFilter, RunsKind } from "./types";

export interface ResultsStatusCounts {
  all: number;
  positive: number;
  warning: number;
  danger: number;
}

export interface RunsResultsSummary {
  models: ResultsStatusCounts;
  tests: ResultsStatusCounts;
}

export interface RunsResultsQuery {
  tab: RunsKind;
  status: DashboardStatusFilter;
  query: string;
  limit: number;
}

export interface RunsResultsQueryResult {
  rows: ExecutionRow[];
  totalMatches: number;
  summary: ResultsStatusCounts;
}

export interface RunsResultsIndexEntry {
  row: ExecutionRow;
  searchText: string;
}

export interface RunsResultsIndex {
  models: RunsResultsIndexEntry[];
  tests: RunsResultsIndexEntry[];
  summary: RunsResultsSummary;
}

function createEmptyCounts(): ResultsStatusCounts {
  return {
    all: 0,
    positive: 0,
    warning: 0,
    danger: 0,
  };
}

function buildSearchText(row: ExecutionRow): string {
  return [
    row.name,
    row.resourceType,
    row.packageName,
    row.path ?? "",
    row.uniqueId,
    row.status,
    row.threadId ?? "",
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
  return status === "all" || row.statusTone === status;
}

function isQueryMatch(entry: RunsResultsIndexEntry, query: string): boolean {
  return query === "" || entry.searchText.includes(query);
}

function summarize(entries: RunsResultsIndexEntry[]): ResultsStatusCounts {
  const counts = createEmptyCounts();
  counts.all = entries.length;
  for (const entry of entries) {
    if (entry.row.statusTone === "positive") counts.positive += 1;
    else if (entry.row.statusTone === "warning") counts.warning += 1;
    else if (entry.row.statusTone === "danger") counts.danger += 1;
  }
  return counts;
}

export function createRunsResultsIndex(rows: ExecutionRow[]): RunsResultsIndex {
  const models: RunsResultsIndexEntry[] = [];
  const tests: RunsResultsIndexEntry[] = [];

  for (const row of rows) {
    const entry = {
      row,
      searchText: buildSearchText(row),
    };
    if (TEST_RESOURCE_TYPES.has(row.resourceType)) {
      tests.push(entry);
    } else {
      models.push(entry);
    }
  }

  return {
    models,
    tests,
    summary: {
      models: summarize(models),
      tests: summarize(tests),
    },
  };
}

export function filterRunsResultsIndex(
  index: RunsResultsIndex,
  query: Omit<RunsResultsQuery, "limit">,
): RunsResultsIndexEntry[] {
  const source = query.tab === "tests" ? index.tests : index.models;
  const normalizedQuery = normalizeQuery(query.query);
  return source.filter(
    (entry) =>
      isStatusMatch(entry.row, query.status) &&
      isQueryMatch(entry, normalizedQuery),
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
    summary: query.tab === "tests" ? index.summary.tests : index.summary.models,
  };
}
