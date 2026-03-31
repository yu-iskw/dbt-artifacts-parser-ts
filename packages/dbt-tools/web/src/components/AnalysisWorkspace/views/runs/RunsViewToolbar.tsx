import { type Dispatch, type SetStateAction } from "react";
import type { RunsViewState } from "@web/lib/analysis-workspace/types";
import type { RunsResultsSourceState } from "@web/hooks/useRunsResultsSource";
import {
  isRunsAdapterSortBy,
  type RunsAdapterColumnLayout,
} from "@web/lib/analysis-workspace/runsAdapterColumns";

type RunsResultsState = RunsResultsSourceState;

const FACETS: {
  kind?: RunsViewState["kind"];
  status?: RunsViewState["status"];
  label: string;
  countKey: keyof ReturnType<typeof facetKeyMap>;
}[] = [
  { label: "All", countKey: "all" },
  { kind: "models", label: "Models", countKey: "models" },
  { kind: "tests", label: "Tests", countKey: "tests" },
  { kind: "seeds", label: "Seeds", countKey: "seeds" },
  { kind: "snapshots", label: "Snapshots", countKey: "snapshots" },
  { kind: "operations", label: "Operations", countKey: "operations" },
  { status: "positive", label: "Healthy", countKey: "healthy" },
  { status: "issues", label: "Issues", countKey: "issues" },
  { status: "warning", label: "Warnings", countKey: "warnings" },
  { status: "danger", label: "Errors", countKey: "errors" },
];

function facetKeyMap(summary: RunsResultsState["summary"]) {
  return summary.facets;
}

export function RunsToolbar({
  runsViewState,
  runsResults,
  adapterColumnLayout,
  adapterMetricsAvailable,
  onRunsViewStateChange,
}: {
  runsViewState: RunsViewState;
  runsResults: RunsResultsState;
  adapterColumnLayout: RunsAdapterColumnLayout;
  adapterMetricsAvailable: boolean;
  onRunsViewStateChange: Dispatch<SetStateAction<RunsViewState>>;
}) {
  const visibleSortableColumns = adapterColumnLayout.visibleColumns.filter(
    (column) => column.isScalar,
  );
  const showAdapterSortOptions =
    runsViewState.showAdapterMetrics && visibleSortableColumns.length > 0;

  return (
    <div className="runs-toolbar runs-toolbar--stacked">
      <div className="runs-toolbar__controls">
        <label className="workspace-search workspace-search--compact runs-toolbar__search">
          <span>Search</span>
          <input
            value={runsViewState.query}
            onChange={(e) =>
              onRunsViewStateChange((current) => ({
                ...current,
                query: e.target.value,
              }))
            }
            placeholder="Filter by name, type, status, thread…"
          />
        </label>
        <label className="workspace-search workspace-search--compact runs-toolbar__sort">
          <span>Sort</span>
          <select
            value={runsViewState.sortBy}
            onChange={(e) =>
              onRunsViewStateChange((current) => ({
                ...current,
                sortBy: e.target.value as RunsViewState["sortBy"],
              }))
            }
          >
            <option value="attention">Attention</option>
            <option value="duration">Duration</option>
            <option value="name">Name</option>
            <option value="status">Status</option>
            <option value="start">Start</option>
            {showAdapterSortOptions
              ? visibleSortableColumns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.label}
                  </option>
                ))
              : null}
          </select>
        </label>
        <label
          className="runs-toolbar__toggle"
          title={
            adapterMetricsAvailable
              ? "Show raw adapter_response columns derived from the current run"
              : "No adapter_response fields are available in this run"
          }
        >
          <input
            type="checkbox"
            checked={runsViewState.showAdapterMetrics}
            disabled={!adapterMetricsAvailable}
            onChange={(e) => {
              const showAdapterMetrics = e.target.checked;
              onRunsViewStateChange((current) => ({
                ...current,
                showAdapterMetrics,
                sortBy:
                  !showAdapterMetrics && isRunsAdapterSortBy(current.sortBy)
                    ? "attention"
                    : current.sortBy,
              }));
            }}
          />
          <span>Warehouse response</span>
        </label>
      </div>
      {runsViewState.showAdapterMetrics &&
      adapterColumnLayout.overflowColumns.length > 0 ? (
        <p className="runs-toolbar__meta">
          Showing {adapterColumnLayout.visibleColumns.length} of{" "}
          {adapterColumnLayout.allColumns.length} adapter fields. Select a row
          to inspect the remaining {adapterColumnLayout.overflowColumns.length}.
        </p>
      ) : null}
      <div className="runs-toolbar__facets">
        {FACETS.map((facet) => {
          const counts = facetKeyMap(runsResults.summary);
          const active =
            (facet.kind != null && runsViewState.kind === facet.kind) ||
            (facet.status != null && runsViewState.status === facet.status) ||
            (facet.kind == null &&
              facet.status == null &&
              runsViewState.kind === "all" &&
              runsViewState.status === "all");
          return (
            <button
              key={facet.label}
              type="button"
              className={
                active
                  ? "workspace-pill workspace-pill--active"
                  : "workspace-pill"
              }
              onClick={() =>
                onRunsViewStateChange((current) => ({
                  ...current,
                  kind: facet.kind ?? "all",
                  status: facet.status ?? "all",
                }))
              }
            >
              {facet.label} ({counts[facet.countKey]})
            </button>
          );
        })}
      </div>
    </div>
  );
}
