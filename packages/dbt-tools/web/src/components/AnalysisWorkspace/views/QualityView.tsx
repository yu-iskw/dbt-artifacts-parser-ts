import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { AnalysisState, ExecutionRow } from "@web/types";
import { PILL_ACTIVE, PILL_BASE } from "@web/lib/analysis-workspace/constants";
import type {
  DashboardStatusFilter,
  QualityFilterState,
} from "@web/lib/analysis-workspace/types";
import { useRunsResultsSource } from "@web/hooks/useRunsResultsSource";
import { formatSeconds, badgeClassName } from "@web/lib/analysis-workspace/utils";
import { EmptyState } from "../../EmptyState";

const STATUS_FILTERS: { value: DashboardStatusFilter | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "danger", label: "Failures" },
  { value: "warning", label: "Warnings" },
  { value: "positive", label: "Passing" },
];

function QualityInspector({ row }: { row: ExecutionRow | null }) {
  if (!row) {
    return (
      <aside className="entity-inspector entity-inspector--empty">
        <p className="entity-inspector__placeholder">
          Select a test result to inspect
        </p>
      </aside>
    );
  }

  const tone = row.statusTone ?? "neutral";

  return (
    <aside className="entity-inspector">
      <div className="entity-inspector__header">
        <span className="entity-inspector__type-badge">{row.resourceType}</span>
        <span className={`badge badge--${tone}`}>{row.status}</span>
      </div>

      <div className="entity-inspector__name">
        <strong>{row.name}</strong>
      </div>

      <dl className="entity-inspector__stats">
        <div className="entity-inspector__stat">
          <dt>Duration</dt>
          <dd>{formatSeconds(row.executionTime)}</dd>
        </div>
        <div className="entity-inspector__stat">
          <dt>Thread</dt>
          <dd>{row.threadId ?? "n/a"}</dd>
        </div>
        <div className="entity-inspector__stat">
          <dt>Status</dt>
          <dd>{row.status}</dd>
        </div>
      </dl>

      {row.path && (
        <div className="entity-inspector__section">
          <p className="entity-inspector__section-label">Path</p>
          <p className="entity-inspector__mono">{row.path}</p>
        </div>
      )}

      <div className="entity-inspector__section">
        <p className="entity-inspector__section-label">Unique ID</p>
        <p
          className="entity-inspector__mono entity-inspector__truncate"
          title={row.uniqueId}
        >
          {row.uniqueId}
        </p>
      </div>
    </aside>
  );
}

/**
 * Quality — the "what failed, what is risky, what is affected?" lens.
 *
 * Elevates test results from a flat list to a triage-first workspace:
 * - Failures sort to the top and are visually dominant
 * - Warnings secondary
 * - Passing tests visible but de-emphasized
 * - Right inspector shows selected test detail
 */
export function QualityView({
  analysis,
  filters,
  setFilters,
}: {
  analysis: AnalysisState;
  filters: QualityFilterState;
  setFilters: Dispatch<SetStateAction<QualityFilterState>>;
}) {
  const resultsBodyRef = useRef<HTMLDivElement>(null);
  const [inspectedRow, setInspectedRow] = useState<ExecutionRow | null>(null);

  const runsResults = useRunsResultsSource(
    analysis.executions,
    "tests",
    filters,
    true,
  );

  // TanStack Virtual
  // eslint-disable-next-line react-hooks/incompatible-library -- @tanstack/react-virtual useVirtualizer
  const virtualizer = useVirtualizer({
    count: runsResults.rows.length,
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
      if (
        remaining < 220 &&
        runsResults.hasMore &&
        !runsResults.isLoading &&
        !runsResults.isIndexing
      ) {
        runsResults.loadMore();
      }
    };
    scrollElement.addEventListener("scroll", maybeLoadMore);
    maybeLoadMore();
    return () => scrollElement.removeEventListener("scroll", maybeLoadMore);
  }, [runsResults]);

  const { counts } = runsResults;
  const failCount = counts.danger;
  const warnCount = counts.warning;
  const passCount = counts.positive;

  return (
    <div className="workspace-view quality-view">
      {/* ── Lens header ── */}
      <div className="lens-header">
        <div className="lens-header__title">
          <p className="eyebrow">Workspace lens</p>
          <h2>Quality</h2>
          <p className="lens-header__desc">
            Test triage — failures and warnings prioritized for investigation.
          </p>
        </div>

        {/* Quality posture summary */}
        <div className="quality-posture">
          {failCount > 0 && (
            <span className="quality-posture__chip quality-posture__chip--danger">
              {failCount} failing
            </span>
          )}
          {warnCount > 0 && (
            <span className="quality-posture__chip quality-posture__chip--warning">
              {warnCount} warnings
            </span>
          )}
          {failCount === 0 && warnCount === 0 && (
            <span className="quality-posture__chip quality-posture__chip--positive">
              {passCount} passing
            </span>
          )}
        </div>
      </div>

      {/* ── 3-pane quality layout ── */}
      <div className="quality-layout">
        {/* LEFT: Filters/facets */}
        <aside className="quality-layout__filters">
          <div className="quality-filters">
            <p className="quality-filters__heading">Status</p>
            <div className="quality-filters__group">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={
                    filters.status === f.value ? PILL_ACTIVE : PILL_BASE
                  }
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      status: f.value as DashboardStatusFilter,
                    }))
                  }
                >
                  <span>{f.label}</span>
                  {f.value === "danger" && (
                    <span className="quality-filters__count quality-filters__count--danger">
                      {counts.danger}
                    </span>
                  )}
                  {f.value === "warning" && (
                    <span className="quality-filters__count quality-filters__count--warning">
                      {counts.warning}
                    </span>
                  )}
                  {f.value === "positive" && (
                    <span className="quality-filters__count">
                      {counts.positive}
                    </span>
                  )}
                  {f.value === "all" && (
                    <span className="quality-filters__count">{counts.all}</span>
                  )}
                </button>
              ))}
            </div>

            <p className="quality-filters__heading">Search</p>
            <label className="workspace-search workspace-search--compact">
              <span>Search tests</span>
              <input
                value={filters.query}
                onChange={(e) =>
                  setFilters((current) => ({
                    ...current,
                    query: e.target.value,
                  }))
                }
                placeholder="Filter by name, id, thread…"
              />
            </label>

            {(filters.status !== "all" || filters.query) && (
              <button
                type="button"
                className={PILL_BASE}
                onClick={() => setFilters({ status: "all", query: "" })}
              >
                Clear filters
              </button>
            )}
          </div>
        </aside>

        {/* CENTER: Triage queue */}
        <div className="quality-layout__triage">
          <div className="quality-triage-header">
            <span>Test</span>
            <span>Status</span>
            <span>Duration</span>
            <span>Thread</span>
          </div>

          <div
            ref={resultsBodyRef}
            className="quality-triage-body"
            style={{
              height: Math.min(560, Math.max(120, runsResults.rows.length * 76)),
              overflowY: "auto",
              position: "relative",
            }}
          >
            {runsResults.rows.length === 0 ? (
              runsResults.isIndexing || runsResults.isLoading ? (
                <EmptyState
                  icon="⏳"
                  headline="Loading test results"
                  subtext="Preparing the current result slice."
                />
              ) : (
                <EmptyState
                  icon="🧪"
                  headline={
                    counts.all === 0 ? "No test results" : "No matching tests"
                  }
                  subtext={
                    counts.all === 0
                      ? "Run 'dbt test' to capture test results."
                      : "Try adjusting the status filter or search query."
                  }
                />
              )
            ) : (
              <div
                style={{
                  height: virtualizer.getTotalSize(),
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const row = runsResults.rows[virtualRow.index];
                  if (!row) return null;
                  const isSelected = inspectedRow?.uniqueId === row.uniqueId;
                  const tone = row.statusTone ?? "neutral";
                  return (
                    <button
                      key={row.uniqueId}
                      type="button"
                      className={[
                        "quality-triage-row",
                        `quality-triage-row--${tone}`,
                        isSelected ? "quality-triage-row--selected" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      onClick={() => setInspectedRow(row)}
                    >
                      <div className="quality-triage-row__name">
                        <strong>{row.name}</strong>
                        <span>{row.path ?? row.uniqueId}</span>
                      </div>
                      <div>
                        <span className={badgeClassName(tone)}>{row.status}</span>
                      </div>
                      <div>{formatSeconds(row.executionTime)}</div>
                      <div>{row.threadId ?? "n/a"}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <p className="results-table__progress">
            Showing {runsResults.totalVisible} of {runsResults.totalMatches}{" "}
            matching tests
            {runsResults.hasMore ? " · scroll to load more" : ""}
          </p>
        </div>

        {/* RIGHT: Inspector */}
        <QualityInspector row={inspectedRow} />
      </div>
    </div>
  );
}
