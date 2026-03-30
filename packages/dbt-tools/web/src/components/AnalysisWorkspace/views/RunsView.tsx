import {
  type CSSProperties,
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { AnalysisState, ExecutionRow } from "@web/types";
import type {
  InvestigationSelectionState,
  RunsViewState,
} from "@web/lib/analysis-workspace/types";
import { useRunsResultsSource } from "@web/hooks/useRunsResultsSource";
import {
  badgeClassName,
  formatSeconds,
} from "@web/lib/analysis-workspace/utils";
import {
  getRunsAdapterColumnLayout,
  getRunsAdapterField,
  isRunsAdapterSortBy,
  type RunsAdapterColumn,
  type RunsAdapterColumnLayout,
} from "@web/lib/analysis-workspace/runsAdapterColumns";
import {
  EntityInspector,
  formatResourceTypeLabel,
  WorkspaceScaffold,
} from "../shared";

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
  { status: "warning", label: "Warnings", countKey: "warnings" },
  { status: "danger", label: "Errors", countKey: "errors" },
];

type RunsResultsState = ReturnType<typeof useRunsResultsSource>;

function facetKeyMap(summary: RunsResultsState["summary"]) {
  return summary.facets;
}

function getRunsTableTemplate(adapterColumns: RunsAdapterColumn[]): string {
  const baseColumns = [
    "minmax(280px, 2.5fr)",
    "minmax(108px, 0.85fr)",
    "minmax(132px, 0.95fr)",
    "minmax(96px, 0.72fr)",
  ];
  const adapterColumnTemplate = adapterColumns.map((column) =>
    column.align === "end" ? "minmax(120px, 0.95fr)" : "minmax(148px, 1.1fr)",
  );
  return [...baseColumns, ...adapterColumnTemplate, "minmax(160px, 1fr)"].join(
    " ",
  );
}

function getAdapterCellValue(
  row: ExecutionRow,
  column: RunsAdapterColumn,
): string {
  return getRunsAdapterField(row, column.key)?.displayValue ?? "—";
}

function formatInspectorFields(
  row: ExecutionRow,
  columns: RunsAdapterColumn[],
): string {
  const lines = columns.map((column) => {
    const field = getRunsAdapterField(row, column.key);
    return `${column.label}: ${field?.displayValue ?? "—"}`;
  });
  return lines.join("\n");
}

function RunsToolbar({
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

function RunsResultsTable({
  analysis,
  runsResults,
  runsViewState,
  resultsBodyRef,
  virtualizer,
  adapterColumns,
  onRunsViewStateChange,
  onInvestigationSelectionChange,
}: {
  analysis: AnalysisState;
  runsResults: RunsResultsState;
  runsViewState: RunsViewState;
  resultsBodyRef: RefObject<HTMLDivElement | null>;
  virtualizer: ReturnType<typeof useVirtualizer<HTMLDivElement, Element>>;
  adapterColumns: RunsAdapterColumn[];
  onRunsViewStateChange: Dispatch<SetStateAction<RunsViewState>>;
  onInvestigationSelectionChange: Dispatch<
    SetStateAction<InvestigationSelectionState>
  >;
}) {
  const tableStyle = {
    "--results-table-columns": getRunsTableTemplate(adapterColumns),
  } as CSSProperties;

  return (
    <div className="results-table" style={tableStyle}>
      <div className="results-table__header">
        <div className="results-table__cell results-table__cell--item">
          Item
        </div>
        <div className="results-table__cell">Type</div>
        <div className="results-table__cell">Status</div>
        <div className="results-table__cell results-table__cell--align-end">
          Duration
        </div>
        {adapterColumns.map((column) => (
          <div
            key={column.id}
            className={`results-table__cell${column.align === "end" ? " results-table__cell--align-end" : ""}`}
            title={column.label}
          >
            {column.label}
          </div>
        ))}
        <div className="results-table__cell">Thread</div>
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
            const isActive = row.uniqueId === runsViewState.selectedExecutionId;
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
                    selectedResourceId: nextResource?.uniqueId ?? row.uniqueId,
                    sourceLens: "runs",
                  }));
                }}
              >
                <div
                  className="results-table__cell results-table__cell--item"
                  data-label="Item"
                  title={row.name}
                >
                  <strong>{row.name}</strong>
                </div>
                <div
                  className="results-table__cell"
                  data-label="Type"
                  title={row.resourceType}
                >
                  {row.resourceType}
                </div>
                <div className="results-table__cell" data-label="Status">
                  <span className={badgeClassName(row.statusTone)}>
                    {row.status}
                  </span>
                </div>
                <div
                  className="results-table__cell results-table__cell--align-end"
                  data-label="Duration"
                >
                  {formatSeconds(row.executionTime)}
                </div>
                {adapterColumns.map((column) => {
                  const value = getAdapterCellValue(row, column);
                  return (
                    <div
                      key={column.id}
                      className={`results-table__cell${column.align === "end" ? " results-table__cell--align-end" : ""}`}
                      data-label={column.label}
                      title={value}
                    >
                      {value}
                    </div>
                  );
                })}
                <div
                  className="results-table__cell"
                  data-label="Thread"
                  title={row.threadId ?? "n/a"}
                >
                  {row.threadId ?? "n/a"}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RunsAdapterInspector({
  row,
  visibleColumns,
  overflowColumns,
  onNavigateTo,
}: {
  row: ExecutionRow | null;
  visibleColumns: RunsAdapterColumn[];
  overflowColumns: RunsAdapterColumn[];
  onNavigateTo: (
    view: "inventory" | "timeline",
    options?: {
      resourceId?: string;
      executionId?: string;
      assetTab?: "summary" | "lineage";
      rootResourceId?: string;
    },
  ) => void;
}) {
  if (!row) return null;

  const adapterFieldCount = row.adapterResponseFields?.length ?? 0;
  const sections =
    adapterFieldCount > 0
      ? [
          ...(visibleColumns.length > 0
            ? [
                {
                  label: "Visible adapter fields",
                  value: formatInspectorFields(row, visibleColumns),
                },
              ]
            : []),
          ...(overflowColumns.length > 0
            ? [
                {
                  label: "Overflow adapter fields",
                  value: formatInspectorFields(row, overflowColumns),
                },
              ]
            : []),
          ...(visibleColumns.length === 0 && overflowColumns.length === 0
            ? [
                {
                  label: "Adapter response",
                  value: "This row has no adapter_response fields.",
                },
              ]
            : []),
        ]
      : [
          {
            label: "Adapter response",
            value: "This row has no adapter_response fields.",
          },
        ];

  return (
    <EntityInspector
      eyebrow="Selected run item"
      title={row.name}
      typeLabel={formatResourceTypeLabel(row.resourceType)}
      stats={[
        { label: "Status", value: row.status },
        { label: "Duration", value: formatSeconds(row.executionTime) },
        { label: "Thread", value: row.threadId ?? "n/a" },
        { label: "Adapter fields", value: String(adapterFieldCount) },
      ]}
      sections={sections}
      actions={[
        {
          label: "Open in Timeline",
          onClick: () =>
            onNavigateTo("timeline", {
              resourceId: row.uniqueId,
              executionId: row.uniqueId,
            }),
        },
        {
          label: "Open in Inventory",
          onClick: () =>
            onNavigateTo("inventory", {
              resourceId: row.uniqueId,
              assetTab: "summary",
            }),
        },
        {
          label: "Open in Lineage",
          onClick: () =>
            onNavigateTo("inventory", {
              resourceId: row.uniqueId,
              assetTab: "lineage",
              rootResourceId: row.uniqueId,
            }),
        },
      ]}
    />
  );
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
    view: "inventory" | "timeline",
    options?: {
      resourceId?: string;
      executionId?: string;
      assetTab?: "summary" | "lineage";
      rootResourceId?: string;
    },
  ) => void;
}) {
  const resultsBodyRef = useRef<HTMLDivElement>(null);
  const adapterColumnLayout = useMemo(
    () => getRunsAdapterColumnLayout(analysis.executions),
    [analysis.executions],
  );
  const adapterMetricsAvailable = adapterColumnLayout.allColumns.length > 0;
  const visibleAdapterColumns = useMemo(
    () =>
      runsViewState.showAdapterMetrics && adapterMetricsAvailable
        ? adapterColumnLayout.visibleColumns
        : [],
    [
      adapterColumnLayout.visibleColumns,
      adapterMetricsAvailable,
      runsViewState.showAdapterMetrics,
    ],
  );
  const overflowAdapterColumns = useMemo(
    () =>
      runsViewState.showAdapterMetrics && adapterMetricsAvailable
        ? adapterColumnLayout.overflowColumns
        : [],
    [
      adapterColumnLayout.overflowColumns,
      adapterMetricsAvailable,
      runsViewState.showAdapterMetrics,
    ],
  );

  useEffect(() => {
    const sortBy = runsViewState.sortBy;
    if (
      isRunsAdapterSortBy(sortBy) &&
      !visibleAdapterColumns.some(
        (column) => column.id === sortBy && column.isScalar,
      )
    ) {
      onRunsViewStateChange((current) => ({ ...current, sortBy: "attention" }));
    }
  }, [onRunsViewStateChange, runsViewState.sortBy, visibleAdapterColumns]);

  const runsResults = useRunsResultsSource(
    analysis.executions,
    runsViewState,
    true,
  );
  const selectedRow =
    analysis.executions.find(
      (row) => row.uniqueId === runsViewState.selectedExecutionId,
    ) ?? null;

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

  return (
    <WorkspaceScaffold
      title="Runs"
      description="Execution and quality evidence across models, tests, seeds, snapshots, and operations."
      toolbar={
        <RunsToolbar
          runsViewState={runsViewState}
          runsResults={runsResults}
          adapterColumnLayout={adapterColumnLayout}
          adapterMetricsAvailable={adapterMetricsAvailable}
          onRunsViewStateChange={onRunsViewStateChange}
        />
      }
      inspector={
        selectedRow ? (
          <RunsAdapterInspector
            row={selectedRow}
            visibleColumns={visibleAdapterColumns}
            overflowColumns={overflowAdapterColumns}
            onNavigateTo={onNavigateTo}
          />
        ) : null
      }
      className="runs-view"
    >
      <RunsResultsTable
        analysis={analysis}
        runsResults={runsResults}
        runsViewState={runsViewState}
        resultsBodyRef={resultsBodyRef}
        virtualizer={virtualizer}
        adapterColumns={visibleAdapterColumns}
        onRunsViewStateChange={onRunsViewStateChange}
        onInvestigationSelectionChange={onInvestigationSelectionChange}
      />
    </WorkspaceScaffold>
  );
}
