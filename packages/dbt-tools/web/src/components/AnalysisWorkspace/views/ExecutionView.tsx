import { type Dispatch, type SetStateAction, useState } from "react";
import type { AnalysisState } from "@web/types";
import type {
  ExecutionViewState,
  ExecutionTab,
  ResultsFilterState,
  TimelineFilterState,
  RunsKind,
} from "@web/lib/analysis-workspace/types";
import { useRunsResultsSource } from "@web/hooks/useRunsResultsSource";
import { ResultsView } from "./ResultsView";
import { TimelineView } from "../timeline/TimelineView";

const EXECUTION_TABS: { id: ExecutionTab; label: string }[] = [
  { id: "results", label: "Results" },
  { id: "timeline", label: "Timeline" },
];

/**
 * Execution — the "what ran, when was there pressure, what was slow?" lens.
 *
 * Merges the old Models, Tests, and Timeline nav items into one unified
 * workspace with internal tabs. This prevents the page-hopping that was
 * required to move between run results and the Gantt timeline.
 */
export function ExecutionView({
  analysis,
  executionViewState,
  onExecutionViewStateChange,
  resultsFilters,
  onResultsFiltersChange,
  timelineFilters,
  onTimelineFiltersChange,
}: {
  analysis: AnalysisState;
  executionViewState: ExecutionViewState;
  onExecutionViewStateChange: Dispatch<SetStateAction<ExecutionViewState>>;
  resultsFilters: ResultsFilterState;
  onResultsFiltersChange: Dispatch<SetStateAction<ResultsFilterState>>;
  timelineFilters: TimelineFilterState;
  onTimelineFiltersChange: Dispatch<SetStateAction<TimelineFilterState>>;
}) {
  const activeTab = executionViewState.tab;
  // Local state for models/tests kind switcher within the Results tab.
  const [runsKind, setRunsKind] = useState<RunsKind>("models");

  const runsResults = useRunsResultsSource(
    analysis.executions,
    runsKind,
    resultsFilters,
    activeTab === "results",
  );

  const setTab = (tab: ExecutionTab) => {
    onExecutionViewStateChange((current) => ({ ...current, tab }));
  };

  return (
    <div className="workspace-view execution-view">
      {/* ── Lens header ── */}
      <div className="lens-header">
        <div className="lens-header__title">
          <p className="eyebrow">Workspace lens</p>
          <h2>Execution</h2>
          <p className="lens-header__desc">
            Run results, timing, and runtime pressure across all executed nodes.
          </p>
        </div>

        {/* Internal tab bar */}
        <div
          className="lens-tab-bar"
          role="tablist"
          aria-label="Execution views"
        >
          {EXECUTION_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              className={
                activeTab === t.id
                  ? "lens-tab lens-tab--active"
                  : "lens-tab"
              }
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="execution-view__content" role="tabpanel">
        {activeTab === "results" && (
          <ResultsView
            rows={runsResults.rows}
            tab={runsKind}
            filters={resultsFilters}
            setFilters={onResultsFiltersChange}
            counts={runsResults.counts}
            totalMatches={runsResults.totalMatches}
            totalVisible={runsResults.totalVisible}
            hasMore={runsResults.hasMore}
            isLoading={runsResults.isLoading}
            isIndexing={runsResults.isIndexing}
            error={runsResults.error}
            onLoadMore={runsResults.loadMore}
            onTabChange={setRunsKind}
          />
        )}
        {activeTab === "timeline" && (
          <TimelineView
            analysis={analysis}
            filters={timelineFilters}
            setFilters={onTimelineFiltersChange}
          />
        )}
      </div>
    </div>
  );
}
