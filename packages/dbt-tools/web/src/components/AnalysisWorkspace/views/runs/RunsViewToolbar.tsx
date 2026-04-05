import { type Dispatch, type SetStateAction } from "react";
import type { RunsViewState } from "@web/lib/analysis-workspace/types";
import type { RunsResultsSourceState } from "@web/hooks/useRunsResultsSource";
import {
  isRunsAdapterSortBy,
  type RunsAdapterColumnLayout,
} from "@web/lib/analysis-workspace/runsAdapterColumns";
import type { MaterializationKind } from "@web/types";
import { MaterializationKindPillRow } from "../../MaterializationKindPillRow";

type RunsResultsState = RunsResultsSourceState;

type FacetConfig = {
  kind?: RunsViewState["kind"];
  status?: RunsViewState["status"];
  label: string;
  countKey: keyof ReturnType<typeof facetKeyMap>;
};

const RESOURCE_TYPE_FACETS: FacetConfig[] = [
  { label: "All", countKey: "all" },
  { kind: "models", label: "Models", countKey: "models" },
  { kind: "tests", label: "Tests", countKey: "tests" },
  { kind: "seeds", label: "Seeds", countKey: "seeds" },
  { kind: "snapshots", label: "Snapshots", countKey: "snapshots" },
  { kind: "operations", label: "Operations", countKey: "operations" },
];

const EXECUTION_STATUS_FACETS: FacetConfig[] = [
  { status: "positive", label: "Healthy", countKey: "healthy" },
  { status: "issues", label: "Issues", countKey: "issues" },
  { status: "warning", label: "Warnings", countKey: "warnings" },
  { status: "danger", label: "Errors", countKey: "errors" },
];

function facetKeyMap(summary: RunsResultsState["summary"]) {
  return summary.facets;
}

function FacetPillRow({
  facets,
  runsViewState,
  runsResults,
  onRunsViewStateChange,
}: {
  facets: FacetConfig[];
  runsViewState: RunsViewState;
  runsResults: RunsResultsState;
  onRunsViewStateChange: Dispatch<SetStateAction<RunsViewState>>;
}) {
  const counts = facetKeyMap(runsResults.summary);
  return (
    <div className="runs-toolbar__facets">
      {facets.map((facet) => {
        const active =
          (facet.kind != null && runsViewState.kind === facet.kind) ||
          (facet.status != null && runsViewState.status === facet.status) ||
          (facet.kind == null &&
            facet.status == null &&
            runsViewState.kind === "all" &&
            runsViewState.status === "all");
        return (
          <button
            key={`${facet.label}-${facet.countKey}`}
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
  );
}

export function RunsToolbar({
  runsViewState,
  runsResults,
  adapterColumnLayout,
  adapterMetricsAvailable,
  availableMaterializationKinds,
  onRunsViewStateChange,
}: {
  runsViewState: RunsViewState;
  runsResults: RunsResultsState;
  adapterColumnLayout: RunsAdapterColumnLayout;
  adapterMetricsAvailable: boolean;
  availableMaterializationKinds: MaterializationKind[];
  onRunsViewStateChange: Dispatch<SetStateAction<RunsViewState>>;
}) {
  return (
    <div className="runs-toolbar runs-toolbar--stacked">
      <div className="runs-toolbar__primary">
        <label className="workspace-search workspace-search--compact runs-toolbar__search">
          <span className="runs-toolbar__field-label">Filter runs</span>
          <input
            value={runsViewState.query}
            onChange={(e) =>
              onRunsViewStateChange((current) => ({
                ...current,
                query: e.target.value,
              }))
            }
            placeholder="Name, resource type, status, thread…"
            autoComplete="off"
          />
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
                ...(!showAdapterMetrics && isRunsAdapterSortBy(current.sortBy)
                  ? {
                      sortBy: "attention" as const,
                      sortDirection: "desc" as const,
                    }
                  : {}),
              }));
            }}
          />
          <span>Warehouse response</span>
        </label>
      </div>
      {!adapterMetricsAvailable ? (
        <p className="runs-toolbar__warehouse-hint" role="status">
          This run has no usable <code>adapter_response</code> fields (or they
          are empty on every node), so warehouse columns cannot be shown.
        </p>
      ) : null}
      {availableMaterializationKinds.length > 0 ? (
        <div
          className="runs-toolbar__mat-filters"
          role="group"
          aria-label="Filter by manifest materialization"
        >
          <div className="runs-toolbar__mat-filters-heading">
            <span className="runs-toolbar__mat-filters-label">
              Manifest materialization
            </span>
            <span className="runs-toolbar__mat-filters-hint">
              Narrow rows by normalized model materialization from the manifest.
            </span>
          </div>
          <MaterializationKindPillRow
            kinds={availableMaterializationKinds}
            activeKinds={runsViewState.materializationKinds}
            onToggleKind={(kind) =>
              onRunsViewStateChange((current) => {
                const next = new Set(current.materializationKinds);
                if (next.has(kind)) next.delete(kind);
                else next.add(kind);
                return { ...current, materializationKinds: next };
              })
            }
            buttonTitle="Filter run rows by normalized manifest materialization"
          />
        </div>
      ) : null}
      {runsViewState.showAdapterMetrics &&
      adapterColumnLayout.overflowColumns.length > 0 ? (
        <p className="runs-toolbar__meta">
          Showing {adapterColumnLayout.visibleColumns.length} of{" "}
          {adapterColumnLayout.allColumns.length} adapter fields. Select a row
          to inspect the remaining {adapterColumnLayout.overflowColumns.length}.
        </p>
      ) : null}
      <div className="runs-toolbar__facet-sections">
        <div
          className="runs-toolbar__facet-group"
          role="group"
          aria-labelledby="runs-facet-resource"
        >
          <span
            className="runs-toolbar__facet-group-label"
            id="runs-facet-resource"
          >
            Resource type
          </span>
          <FacetPillRow
            facets={RESOURCE_TYPE_FACETS}
            runsViewState={runsViewState}
            runsResults={runsResults}
            onRunsViewStateChange={onRunsViewStateChange}
          />
        </div>
        <div
          className="runs-toolbar__facet-group"
          role="group"
          aria-labelledby="runs-facet-exec-status"
        >
          <span
            className="runs-toolbar__facet-group-label"
            id="runs-facet-exec-status"
          >
            Execution quality
          </span>
          <FacetPillRow
            facets={EXECUTION_STATUS_FACETS}
            runsViewState={runsViewState}
            runsResults={runsResults}
            onRunsViewStateChange={onRunsViewStateChange}
          />
        </div>
      </div>
    </div>
  );
}
