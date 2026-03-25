import { type Dispatch, type SetStateAction, useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { AnalysisState } from "@web/types";
import type {
  InvestigationSelectionState,
  RunsKind,
  RunsViewState,
  WorkspaceView,
} from "@web/lib/analysis-workspace/types";
import { useRunsResultsSource } from "@web/hooks/useRunsResultsSource";
import {
  badgeClassName,
  formatSeconds,
} from "@web/lib/analysis-workspace/utils";
import { EntityInspector, WorkspaceScaffold } from "../shared";

const FACETS: {
  kind?: RunsKind;
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
  { status: "warning", label: "Warnings", countKey: "warnings" },
  { status: "danger", label: "Errors", countKey: "errors" },
];

function facetKeyMap(
  summary: ReturnType<typeof useRunsResultsSource>["summary"],
) {
  return summary.facets;
}

export function RunsView({
  analysis,
  runsViewState,
  onRunsViewStateChange,
  onInvestigationSelectionChange,
  onNavigateTo,
}: {
  analysis: AnalysisState;
  runsViewState: RunsViewState;
  onRunsViewStateChange: Dispatch<SetStateAction<RunsViewState>>;
  onInvestigationSelectionChange: Dispatch<
    SetStateAction<InvestigationSelectionState>
  >;
  onNavigateTo: (
    view: WorkspaceView,
    options?: {
      resourceId?: string;
      executionId?: string;
      assetTab?: "summary" | "lineage" | "sql" | "runtime" | "tests";
      rootResourceId?: string;
    },
  ) => void;
}) {
  const resultsBodyRef = useRef<HTMLDivElement>(null);
  const runsResults = useRunsResultsSource(
    analysis.executions,
    runsViewState,
    true,
  );
  const selectedRow =
    runsResults.rows.find(
      (row) => row.uniqueId === runsViewState.selectedExecutionId,
    ) ??
    analysis.executions.find(
      (row) => row.uniqueId === runsViewState.selectedExecutionId,
    ) ??
    null;

  const relatedResource =
    selectedRow != null
      ? (analysis.resources.find(
          (resource) => resource.uniqueId === selectedRow.uniqueId,
        ) ?? null)
      : null;

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

  const inspector = (
    <EntityInspector
      title={selectedRow?.name ?? null}
      typeLabel={selectedRow?.resourceType ?? null}
      status={
        selectedRow ? (
          <span className={badgeClassName(selectedRow.statusTone)}>
            {selectedRow.status}
          </span>
        ) : undefined
      }
      stats={[
        {
          label: "Duration",
          value: selectedRow ? formatSeconds(selectedRow.executionTime) : "n/a",
        },
        { label: "Thread", value: selectedRow?.threadId ?? "n/a" },
        { label: "Status", value: selectedRow?.status ?? "n/a" },
      ]}
      sections={[
        { label: "Path", value: selectedRow?.path ?? "n/a" },
        { label: "Unique ID", value: selectedRow?.uniqueId ?? "n/a" },
      ]}
      actions={
        selectedRow
          ? [
              {
                label: "Open in Inventory",
                onClick: () =>
                  onNavigateTo("inventory", {
                    resourceId:
                      relatedResource?.uniqueId ?? selectedRow.uniqueId,
                    assetTab: "summary",
                  }),
                disabled: !relatedResource,
              },
              {
                label: "Open in Timeline",
                onClick: () =>
                  onNavigateTo("timeline", {
                    resourceId:
                      relatedResource?.uniqueId ?? selectedRow.uniqueId,
                    executionId: selectedRow.uniqueId,
                  }),
              },
              {
                label: "Open in Lineage",
                onClick: () =>
                  onNavigateTo("lineage", {
                    resourceId:
                      relatedResource?.uniqueId ?? selectedRow.uniqueId,
                    rootResourceId:
                      relatedResource?.uniqueId ?? selectedRow.uniqueId,
                  }),
                disabled: !relatedResource,
              },
            ]
          : undefined
      }
      emptyMessage="Select a run item to inspect"
    />
  );

  const toolbar = (
    <div className="runs-toolbar">
      <label className="workspace-search workspace-search--compact">
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
      <label className="workspace-search workspace-search--compact">
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
        </select>
      </label>
    </div>
  );

  const leadingPane = (
    <div className="runs-facets">
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
  );

  return (
    <WorkspaceScaffold
      title="Runs"
      description="Execution and quality evidence across models, tests, seeds, snapshots, and operations."
      toolbar={toolbar}
      leadingPane={leadingPane}
      inspector={inspector}
      className="runs-view"
    >
      <div className="results-table">
        <div className="results-table__header">
          <span>Item</span>
          <span>Type</span>
          <span>Status</span>
          <span>Duration</span>
          <span>Thread</span>
        </div>
        <div
          ref={resultsBodyRef}
          className="results-table__body"
          style={{
            height: Math.min(560, Math.max(120, runsResults.rows.length * 76)),
            overflowY: "auto",
            position: "relative",
          }}
        >
          <div
            style={{ height: virtualizer.getTotalSize(), position: "relative" }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = runsResults.rows[virtualRow.index];
              if (!row) return null;
              const isActive =
                row.uniqueId === runsViewState.selectedExecutionId;
              return (
                <button
                  key={row.uniqueId}
                  type="button"
                  className={`results-table__row${isActive ? " results-table__row--active" : ""}`}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onClick={() => {
                    const nextResource =
                      analysis.resources.find(
                        (resource) => resource.uniqueId === row.uniqueId,
                      ) ?? null;
                    onRunsViewStateChange((current) => ({
                      ...current,
                      selectedExecutionId: row.uniqueId,
                    }));
                    onInvestigationSelectionChange((current) => ({
                      ...current,
                      selectedExecutionId: row.uniqueId,
                      selectedResourceId:
                        nextResource?.uniqueId ?? row.uniqueId,
                      sourceLens: "runs",
                    }));
                  }}
                >
                  <span>
                    <strong>{row.name}</strong>
                  </span>
                  <span>{row.resourceType}</span>
                  <span>
                    <span className={badgeClassName(row.statusTone)}>
                      {row.status}
                    </span>
                  </span>
                  <span>{formatSeconds(row.executionTime)}</span>
                  <span>{row.threadId ?? "n/a"}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </WorkspaceScaffold>
  );
}
