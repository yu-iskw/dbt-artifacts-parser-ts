import {
  type Dispatch,
  type SetStateAction,
  useDeferredValue,
  useRef,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { EmptyState } from "../../EmptyState";
import type { ExecutionRow } from "@web/types";
import {
  PILL_ACTIVE,
  PILL_BASE,
  TEST_RESOURCE_TYPES,
} from "@web/lib/analysis-workspace/constants";
import type {
  DashboardStatusFilter,
  ResultsFilterState,
  TimelineFilterState,
  RunsKind,
} from "@web/lib/analysis-workspace/types";
import {
  matchesExecution,
  formatSeconds,
  badgeClassName,
} from "@web/lib/analysis-workspace/utils";
import { SectionCard } from "../shared";

export type ResultTab = "models" | "tests";

/** Self-contained results view for a single tab — driven by the nav view. */
export function ResultsView({
  allRows,
  tab,
  filters,
  setFilters,
  onTabChange,
}: {
  allRows: ExecutionRow[];
  tab: RunsKind;
  filters: ResultsFilterState;
  setFilters: Dispatch<SetStateAction<ResultsFilterState>>;
  onTabChange?: (tab: RunsKind) => void;
}) {
  const deferredQuery = useDeferredValue(filters.query);
  const resultsBodyRef = useRef<HTMLDivElement>(null);

  const tabRows = allRows.filter((row) =>
    tab === "tests"
      ? TEST_RESOURCE_TYPES.has(row.resourceType)
      : !TEST_RESOURCE_TYPES.has(row.resourceType),
  );

  const filteredRows = tabRows
    .filter(
      (row) => filters.status === "all" || row.statusTone === filters.status,
    )
    .filter((row) => matchesExecution(row, deferredQuery));

  // TanStack Virtual exposes functions that React Compiler cannot memoize safely; upstream pattern.
  // eslint-disable-next-line react-hooks/incompatible-library -- @tanstack/react-virtual useVirtualizer
  const virtualizer = useVirtualizer({
    count: filteredRows.length,
    getScrollElement: () => resultsBodyRef.current,
    estimateSize: () => 76,
    overscan: 10,
  });

  const filterLabels = [
    { value: "all", label: `All (${tabRows.length})` },
    {
      value: "positive",
      label: `Healthy (${tabRows.filter((r) => r.statusTone === "positive").length})`,
    },
    {
      value: "warning",
      label: `Warnings (${tabRows.filter((r) => r.statusTone === "warning").length})`,
    },
    {
      value: "danger",
      label: `Errors (${tabRows.filter((r) => r.statusTone === "danger").length})`,
    },
  ];

  const isTestTab = tab === "tests";

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
              height: Math.min(560, Math.max(120, filteredRows.length * 76)),
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
                const row = filteredRows[virtualRow.index];
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

            {filteredRows.length === 0 &&
              (tabRows.length === 0 ? (
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
              ) : (
                <EmptyState
                  icon="✓"
                  headline="No matching rows"
                  subtext="Try clearing the status filter or adjusting your search query."
                />
              ))}
          </div>
        </div>
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
              setFilters({
                query: "",
                activeStatuses: new Set(),
                activeTypes: new Set(defaultActiveTypes),
              });
            }}
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
