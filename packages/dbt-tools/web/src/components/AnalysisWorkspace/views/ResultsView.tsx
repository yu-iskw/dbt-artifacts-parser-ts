import { type Dispatch, type SetStateAction, useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { EmptyState } from "../../EmptyState";
import type { ExecutionRow } from "@web/types";
import { PILL_ACTIVE, PILL_BASE } from "@web/lib/analysis-workspace/constants";
import type {
  DashboardStatusFilter,
  ResultsFilterState,
  TimelineFilterState,
  RunsKind,
} from "@web/lib/analysis-workspace/types";
import type { ResultsStatusCounts } from "@web/lib/analysis-workspace/resultsDataSource";
import {
  formatSeconds,
  badgeClassName,
} from "@web/lib/analysis-workspace/utils";
import { SectionCard } from "../shared";

export type ResultTab = "models" | "tests";

function ResultsTableEmptyOverlay({
  error,
  isIndexing,
  isLoading,
  hasRowsInTab,
  isTestTab,
}: {
  error: string | null;
  isIndexing: boolean;
  isLoading: boolean;
  hasRowsInTab: boolean;
  isTestTab: boolean;
}) {
  if (error) {
    return (
      <EmptyState
        icon="⚠"
        headline="Could not load result rows"
        subtext={error}
      />
    );
  }
  if (isIndexing || isLoading) {
    return (
      <EmptyState
        icon="⏳"
        headline="Loading result rows"
        subtext="Preparing the current result slice."
      />
    );
  }
  if (!hasRowsInTab) {
    return (
      <EmptyState
        icon={isTestTab ? "🧪" : "📋"}
        headline={
          isTestTab
            ? "No test results in this artifact"
            : "No execution results"
        }
        subtext={
          isTestTab
            ? "Run 'dbt test' or 'dbt build' to capture test results in run_results.json."
            : "No model, seed, or snapshot executions were found in run_results.json."
        }
      />
    );
  }
  return (
    <EmptyState
      icon="✓"
      headline="No matching rows"
      subtext="Try clearing the status filter or adjusting your search query."
    />
  );
}

/** Self-contained results view for a single tab — driven by the nav view. */
export function ResultsView({
  rows,
  tab,
  filters,
  setFilters,
  counts,
  totalMatches,
  totalVisible,
  hasMore,
  isLoading,
  isIndexing,
  error,
  onLoadMore,
  onTabChange,
}: {
  rows: ExecutionRow[];
  tab: RunsKind;
  filters: ResultsFilterState;
  setFilters: Dispatch<SetStateAction<ResultsFilterState>>;
  counts: ResultsStatusCounts;
  totalMatches: number;
  totalVisible: number;
  hasMore: boolean;
  isLoading: boolean;
  isIndexing: boolean;
  error: string | null;
  onLoadMore: () => void;
  onTabChange?: (tab: RunsKind) => void;
}) {
  const resultsBodyRef = useRef<HTMLDivElement>(null);

  // TanStack Virtual exposes functions that React Compiler cannot memoize safely; upstream pattern.
  // eslint-disable-next-line react-hooks/incompatible-library -- @tanstack/react-virtual useVirtualizer
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => resultsBodyRef.current,
    estimateSize: () => 76,
    overscan: 10,
  });

  useEffect(() => {
    const scrollElement = resultsBodyRef.current;
    if (!scrollElement) return;
    const maybeLoadMore = () => {
      const remaining =
        scrollElement.scrollHeight -
        scrollElement.scrollTop -
        scrollElement.clientHeight;
      if (remaining < 220 && hasMore && !isLoading && !isIndexing) {
        onLoadMore();
      }
    };
    scrollElement.addEventListener("scroll", maybeLoadMore);
    maybeLoadMore();
    return () => scrollElement.removeEventListener("scroll", maybeLoadMore);
  }, [hasMore, isIndexing, isLoading, onLoadMore, rows.length]);

  const filterLabels = [
    { value: "all", label: `All (${counts.all})` },
    {
      value: "positive",
      label: `Healthy (${counts.positive})`,
    },
    {
      value: "warning",
      label: `Warnings (${counts.warning})`,
    },
    {
      value: "danger",
      label: `Errors (${counts.danger})`,
    },
  ];

  const isTestTab = tab === "tests";
  const hasRowsInTab = counts.all > 0;

  return (
    <div className="workspace-view">
      <SectionCard
        title={isTestTab ? "Test results" : "Model execution results"}
        subtitle={
          isTestTab
            ? "Test pass/fail results from the captured run."
            : "Model, snapshot, seed and operation execution log."
        }
      >
        <div className="results-controls">
          {onTabChange && (
            <div
              className="workspace-segmented-control"
              role="tablist"
              aria-label="Run result type"
            >
              {(["models", "tests"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  role="tab"
                  aria-selected={tab === kind}
                  className={
                    tab === kind
                      ? "workspace-segmented-control__button workspace-segmented-control__button--active"
                      : "workspace-segmented-control__button"
                  }
                  onClick={() => onTabChange(kind)}
                >
                  {kind === "models" ? "Models" : "Tests"}
                </button>
              ))}
            </div>
          )}

          <div className="pill-row">
            {filterLabels.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={
                  filters.status === filter.value ? PILL_ACTIVE : PILL_BASE
                }
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    status: filter.value as DashboardStatusFilter,
                  }))
                }
              >
                {filter.label}
              </button>
            ))}
          </div>

          <label className="workspace-search workspace-search--compact">
            <span>Search</span>
            <input
              value={filters.query}
              onChange={(e) =>
                setFilters((current) => ({ ...current, query: e.target.value }))
              }
              placeholder="Filter by name, type, status, thread…"
            />
          </label>
        </div>

        <div className="results-table">
          <div className="results-table__header">
            <span>Node</span>
            <span>Type</span>
            <span>Status</span>
            <span>Duration</span>
            <span>Thread</span>
          </div>

          {/* Virtualized body */}
          <div
            ref={resultsBodyRef}
            className="results-table__body"
            style={{
              height: Math.min(560, Math.max(120, rows.length * 76)),
              overflowY: "auto",
              position: "relative",
            }}
          >
            <div
              style={{
                height: virtualizer.getTotalSize(),
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index];
                if (!row) return null;
                return (
                  <div
                    key={row.uniqueId}
                    className="results-table__row"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div>
                      <strong>{row.name}</strong>
                      <span>{row.path ?? row.uniqueId}</span>
                    </div>
                    <div>{row.resourceType}</div>
                    <div>
                      <span className={badgeClassName(row.statusTone)}>
                        {row.status}
                      </span>
                    </div>
                    <div>{formatSeconds(row.executionTime)}</div>
                    <div>{row.threadId ?? "n/a"}</div>
                  </div>
                );
              })}
            </div>

            {rows.length === 0 && (
              <ResultsTableEmptyOverlay
                error={error}
                isIndexing={isIndexing}
                isLoading={isLoading}
                hasRowsInTab={hasRowsInTab}
                isTestTab={isTestTab}
              />
            )}
          </div>
        </div>
        <p className="results-table__progress">
          Showing {totalVisible} of {totalMatches} matching rows
          {hasMore ? " · scroll to load more" : ""}
        </p>
      </SectionCard>
    </div>
  );
}

export function TimelineSearchControls({
  filters,
  defaultActiveTypes,
  hasActiveFilters,
  setFilters,
}: {
  filters: TimelineFilterState;
  defaultActiveTypes: Set<string>;
  hasActiveFilters: boolean;
  setFilters: Dispatch<SetStateAction<TimelineFilterState>>;
}) {
  return (
    <div className="timeline-toolbar">
      <label className="workspace-search workspace-search--compact timeline-toolbar__search">
        <span>Search nodes</span>
        <div className="workspace-search__input-row">
          <input
            value={filters.query}
            onChange={(e) =>
              setFilters((current) => ({
                ...current,
                query: e.target.value,
              }))
            }
            placeholder="Filter by name or id…"
            aria-label="Search timeline nodes"
          />
          {filters.query && (
            <button
              type="button"
              className="workspace-search__clear"
              aria-label="Clear search"
              onClick={() =>
                setFilters((current) => ({ ...current, query: "" }))
              }
            >
              ✕
            </button>
          )}
        </div>
      </label>

      {hasActiveFilters && (
        <div className="timeline-toolbar__actions">
          <button
            type="button"
            className={PILL_BASE}
            onClick={() => {
              setFilters((current) => ({
                ...current,
                query: "",
                activeStatuses: new Set(),
                activeTypes: new Set(defaultActiveTypes),
                selectedExecutionId: null,
                showTimelineDependents: true,
                showAllTimelineUpstreamEdges: false,
                showAllTimelineDownstreamEdges: false,
                showTimelineExtendedDeps: false,
              }));
            }}
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
