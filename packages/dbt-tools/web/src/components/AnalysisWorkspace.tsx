import {
  type ReactNode,
  useEffect,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { EmptyState } from "./EmptyState";
import { GanttChart } from "./GanttChart";
import { Tooltip } from "./Tooltip";
import type {
  AnalysisState,
  ExecutionRow,
  GanttItem,
  GraphSnapshot,
  ResourceNode,
  StatusTone,
} from "../types";

export type WorkspaceView =
  | "overview"
  | "assets"
  | "models"
  | "tests"
  | "timeline";

interface AnalysisWorkspaceProps {
  analysis: AnalysisState;
  activeView: WorkspaceView;
}

const STATUS_COLORS: Record<StatusTone, string> = {
  positive: "#2bb673",
  warning: "#f2a44b",
  danger: "#d86066",
  neutral: "#8e97a6",
};

const PILL_ACTIVE = "workspace-pill workspace-pill--active";
const PILL_BASE = "workspace-pill";
const CHIP_ACTIVE = "group-chip group-chip--active";
const CHIP_BASE = "group-chip";

const COLOR_TEXT_SOFT = "var(--text-soft)";
const SOFT_TEXT_STYLE = {
  color: COLOR_TEXT_SOFT,
  fontSize: "0.85rem",
} as const;

// Resource types classified as "test" in the Results split
const TEST_RESOURCE_TYPES = new Set(["test", "unit_test"]);

function formatSeconds(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "n/a";
  if (value >= 10) return `${value.toFixed(1)}s`;
  return `${value.toFixed(2)}s`;
}

function badgeClassName(tone: StatusTone): string {
  return `tone-badge tone-badge--${tone}`;
}

function metricValueClassName(tone: StatusTone): string {
  return `metric-card__value metric-card__value--${tone}`;
}

function matchesResource(resource: ResourceNode, query: string): boolean {
  if (!query) return true;
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    resource.name,
    resource.resourceType,
    resource.packageName,
    resource.path ?? "",
    resource.originalFilePath ?? "",
    resource.uniqueId,
  ].some((value) => value.toLowerCase().includes(normalized));
}

function matchesExecution(row: ExecutionRow, query: string): boolean {
  if (!query) return true;
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    row.name,
    row.resourceType,
    row.packageName,
    row.path ?? "",
    row.uniqueId,
    row.status,
    row.threadId ?? "",
  ].some((value) => value.toLowerCase().includes(normalized));
}

/**
 * Derive the "home project" name from the most common packageName in
 * executions. Executed nodes are almost always from the user's project.
 */
function deriveProjectName(executions: ExecutionRow[]): string | null {
  if (executions.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const row of executions) {
    if (row.packageName) {
      counts[row.packageName] = (counts[row.packageName] ?? 0) + 1;
    }
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? null;
}

function SectionCard({
  title,
  subtitle,
  headerRight,
  children,
}: {
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="workspace-card">
      <div className="workspace-card__header">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {headerRight}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: StatusTone;
}) {
  return (
    <div className="metric-card">
      <div className="metric-card__label">{label}</div>
      <div className={metricValueClassName(tone)}>{value}</div>
      <div className="metric-card__detail">{detail}</div>
    </div>
  );
}

type HealthViewMode = "status" | "type";

const TOGGLE_WRAPPER_STYLE = {
  display: "flex",
  justifyContent: "flex-end",
  marginBottom: "0.75rem",
} as const;

function TypeBreakdownView({
  typeEntries,
  totalExecuted,
}: {
  typeEntries: [string, number][];
  totalExecuted: number;
}) {
  return (
    <div className="type-breakdown">
      {typeEntries.map(([type, count]) => {
        const pct = totalExecuted > 0 ? count / totalExecuted : 0;
        return (
          <div key={type} className="type-breakdown__row">
            <div>
              <strong style={{ textTransform: "capitalize" }}>
                {type.replace("_", " ")}
              </strong>
              <div className="type-breakdown__bar">
                <div
                  className="type-breakdown__fill"
                  style={{ width: `${pct * 100}%` }}
                />
              </div>
            </div>
            <span style={{ fontWeight: 700 }}>{count}</span>
            <span style={SOFT_TEXT_STYLE}>{(pct * 100).toFixed(0)}%</span>
          </div>
        );
      })}
      {typeEntries.length === 0 && (
        <div className="empty-state">No execution data.</div>
      )}
    </div>
  );
}

function StatusDonutChart({
  statusData,
  analysis,
}: {
  statusData: Array<{ name: string; value: number; tone: string }>;
  analysis: AnalysisState;
}) {
  return (
    <div className="status-donut">
      <div className="status-donut__chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={statusData}
              dataKey="value"
              nameKey="name"
              innerRadius={56}
              outerRadius={82}
              paddingAngle={3}
              strokeWidth={0}
            >
              {statusData.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={STATUS_COLORS[entry.tone as StatusTone]}
                />
              ))}
            </Pie>
            <RechartsTooltip
              formatter={(value: number) => [`${value} runs`, "Count"]}
              contentStyle={{
                borderRadius: 14,
                border: "1px solid rgba(35, 42, 52, 0.12)",
                boxShadow: "0 20px 40px rgba(26, 34, 43, 0.14)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="status-donut__legend">
        {analysis.statusBreakdown.map((entry) => (
          <div key={entry.status} className="legend-row">
            <div className="legend-row__label">
              <span
                className="legend-row__swatch"
                style={{ background: STATUS_COLORS[entry.tone] }}
              />
              {entry.status}
            </div>
            <div className="legend-row__value">
              {entry.count} · {formatSeconds(entry.duration)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusDonut({ analysis }: { analysis: AnalysisState }) {
  const [viewMode, setViewMode] = useState<HealthViewMode>("status");

  const statusData = analysis.statusBreakdown.map((entry) => ({
    name: entry.status,
    value: entry.count,
    tone: entry.tone,
  }));

  const typeBreakdown = analysis.executions.reduce<Record<string, number>>(
    (acc, row) => {
      acc[row.resourceType] = (acc[row.resourceType] ?? 0) + 1;
      return acc;
    },
    {},
  );
  const typeEntries = Object.entries(typeBreakdown).sort((a, b) => b[1] - a[1]);
  const totalExecuted = analysis.executions.length;

  const toggleButton = (
    <div className="health-toggle">
      <button
        type="button"
        className={viewMode === "status" ? "active" : ""}
        onClick={() => setViewMode("status")}
      >
        By status
      </button>
      <button
        type="button"
        className={viewMode === "type" ? "active" : ""}
        onClick={() => setViewMode("type")}
      >
        By type
      </button>
    </div>
  );

  if (viewMode === "type") {
    return (
      <div>
        <div style={TOGGLE_WRAPPER_STYLE}>{toggleButton}</div>
        <TypeBreakdownView
          typeEntries={typeEntries}
          totalExecuted={totalExecuted}
        />
      </div>
    );
  }

  if (statusData.length === 0) {
    return (
      <div>
        <div style={TOGGLE_WRAPPER_STYLE}>{toggleButton}</div>
        <div className="empty-state">No execution statuses were recorded.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={TOGGLE_WRAPPER_STYLE}>{toggleButton}</div>
      <StatusDonutChart statusData={statusData} analysis={analysis} />
    </div>
  );
}

/** Shows counts per resource type in the graph. */
function GraphCompositionCard({
  graphSummary,
}: {
  graphSummary: GraphSnapshot;
}) {
  const entries = Object.entries(graphSummary.nodesByType).sort(
    (a, b) => b[1] - a[1],
  );
  if (entries.length === 0) {
    return <div className="empty-state">No node-type breakdown available.</div>;
  }
  return (
    <div className="rank-list">
      {entries.map(([type, count]) => (
        <div key={type} className="rank-list__row">
          <div className="rank-list__body">
            <strong>{type}</strong>
          </div>
          <div className="rank-list__metric">
            <strong>{count}</strong>
            <span>
              {graphSummary.totalNodes > 0
                ? `${((count / graphSummary.totalNodes) * 100).toFixed(0)}% of graph`
                : ""}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function OverviewView({ analysis }: { analysis: AnalysisState }) {
  const workerThreadCount = analysis.threadStats.filter(
    (entry) => entry.threadId !== "unknown",
  ).length;
  const criticalPathLength = analysis.summary.critical_path?.path.length ?? 0;
  const modelsCount = analysis.graphSummary.nodesByType.model ?? 0;

  return (
    <div className="workspace-view">
      <div className="metric-grid">
        <MetricCard
          label="Run footprint"
          value={`${analysis.summary.total_nodes}`}
          detail={`${analysis.graphSummary.totalNodes} graph nodes in workspace`}
          tone="neutral"
        />
        <MetricCard
          label="Execution time"
          value={formatSeconds(analysis.summary.total_execution_time)}
          detail={`${analysis.graphSummary.totalEdges} dependency edges traversed`}
          tone="positive"
        />
        <MetricCard
          label="Worker lanes"
          value={`${workerThreadCount}`}
          detail={`${analysis.threadStats.length} threads recorded in artifacts`}
          tone="neutral"
        />
        <MetricCard
          label="Critical path"
          value={`${criticalPathLength}`}
          detail={`${modelsCount} models present in the manifest`}
          tone={analysis.graphSummary.hasCycles ? "danger" : "neutral"}
        />
      </div>

      <div className="workspace-split workspace-split--wide">
        <SectionCard
          title="Execution health"
          subtitle="Status mix across the analyzed run."
        >
          <StatusDonut analysis={analysis} />
        </SectionCard>

        <SectionCard
          title="Graph composition"
          subtitle="Node type breakdown in the manifest graph."
        >
          <GraphCompositionCard graphSummary={analysis.graphSummary} />
        </SectionCard>
      </div>

      <div className="workspace-split">
        <SectionCard
          title="Top bottlenecks"
          subtitle="Longest-running nodes by share of total execution time."
        >
          {analysis.bottlenecks && analysis.bottlenecks.nodes.length > 0 ? (
            <div className="rank-list">
              {analysis.bottlenecks.nodes.map((node) => (
                <div key={node.unique_id} className="rank-list__row">
                  <div className="rank-list__rank">{node.rank}</div>
                  <div className="rank-list__body">
                    <strong>{node.name ?? node.unique_id}</strong>
                    <span>{node.unique_id}</span>
                  </div>
                  <div className="rank-list__metric">
                    <strong>{formatSeconds(node.execution_time)}</strong>
                    <span>{node.pct_of_total}% of run</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="⚡"
              headline="No bottleneck candidates detected"
              subtext="All nodes finished within a similar time range — no single node dominated the run."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Thread distribution"
          subtitle="The busiest worker lanes in the captured run."
        >
          <div className="thread-list">
            {analysis.threadStats.slice(0, 6).map((entry) => (
              <div key={entry.threadId} className="thread-list__row">
                <div>
                  <strong>{entry.threadId}</strong>
                  <span>{entry.count} nodes</span>
                </div>
                <div>{formatSeconds(entry.totalExecutionTime)}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function AssetsView({
  resource,
  analysis,
}: {
  resource: ResourceNode | null;
  analysis: AnalysisState;
}) {
  if (!resource) {
    return (
      <div className="workspace-card">
        <EmptyState
          icon="🔍"
          headline="No resource selected"
          subtext="Adjust the explorer filters or search to find the resource you're looking for."
        />
      </div>
    );
  }

  const dependencySummary = analysis.dependencyIndex[resource.uniqueId];

  return (
    <div className="workspace-view">
      <SectionCard
        title={resource.name}
        subtitle={`${resource.resourceType} · ${resource.packageName || "workspace"}`}
      >
        <div className="detail-grid">
          <div className="detail-stat">
            <span>Status</span>
            <strong>{resource.status ?? "Not executed"}</strong>
          </div>
          <div className="detail-stat">
            <span>Execution time</span>
            <strong>{formatSeconds(resource.executionTime)}</strong>
          </div>
          <div className="detail-stat">
            <span>Thread</span>
            <strong>{resource.threadId ?? "n/a"}</strong>
          </div>
          <div className="detail-stat">
            <span>Path</span>
            <strong>
              {resource.originalFilePath ?? resource.path ?? "n/a"}
            </strong>
          </div>
        </div>
        {resource.description && (
          <p className="resource-spotlight__description">
            {resource.description}
          </p>
        )}
      </SectionCard>

      <div className="workspace-split">
        <SectionCard
          title={`Upstream dependencies (${dependencySummary?.upstreamCount ?? 0})`}
          subtitle="Resources this node depends on."
        >
          {dependencySummary && dependencySummary.upstream.length > 0 ? (
            <div className="dependency-list">
              {dependencySummary.upstream.map((entry) => (
                <div key={entry.uniqueId} className="dependency-list__row">
                  <div>
                    <strong>{entry.name}</strong>
                    <Tooltip content={entry.uniqueId}>
                      <span>{entry.uniqueId}</span>
                    </Tooltip>
                  </div>
                  <span className="dependency-list__depth">
                    Depth {entry.depth}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="↑"
              headline="No upstream dependencies"
              subtext="This resource does not depend on any other nodes in the graph."
            />
          )}
        </SectionCard>

        <SectionCard
          title={`Downstream dependents (${dependencySummary?.downstreamCount ?? 0})`}
          subtitle="Resources that depend on this node."
        >
          {dependencySummary && dependencySummary.downstream.length > 0 ? (
            <div className="dependency-list">
              {dependencySummary.downstream.map((entry) => (
                <div key={entry.uniqueId} className="dependency-list__row">
                  <div>
                    <strong>{entry.name}</strong>
                    <Tooltip content={entry.uniqueId}>
                      <span>{entry.uniqueId}</span>
                    </Tooltip>
                  </div>
                  <span className="dependency-list__depth">
                    Depth {entry.depth}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="↓"
              headline="No downstream dependents"
              subtext="No other nodes in the graph depend on this resource."
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}

type ResultTab = "models" | "tests";

/** Self-contained results view for a single tab — driven by the nav view. */
function ResultsView({
  allRows,
  tab,
}: {
  allRows: ExecutionRow[];
  tab: ResultTab;
}) {
  const [nameQuery, setNameQuery] = useState("");
  const deferredQuery = useDeferredValue(nameQuery);
  const [statusFilter, setStatusFilter] = useState("all");
  const resultsBodyRef = useRef<HTMLDivElement>(null);

  const tabRows = allRows.filter((row) =>
    tab === "tests"
      ? TEST_RESOURCE_TYPES.has(row.resourceType)
      : !TEST_RESOURCE_TYPES.has(row.resourceType),
  );

  const filteredRows = tabRows
    .filter((row) => statusFilter === "all" || row.statusTone === statusFilter)
    .filter((row) => matchesExecution(row, deferredQuery));

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
          <div className="pill-row">
            {filterLabels.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={
                  statusFilter === filter.value ? PILL_ACTIVE : PILL_BASE
                }
                onClick={() => setStatusFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <label className="workspace-search workspace-search--compact">
            <span>Search</span>
            <input
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
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
                const row = filteredRows[virtualRow.index]!;
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

            {filteredRows.length === 0 && (
              <EmptyState
                icon="✓"
                headline="No matching rows"
                subtext="Try clearing the status filter or adjusting your search query."
              />
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

/** Timeline status options for filter pills. */
const TIMELINE_STATUS_OPTIONS = [
  "success",
  "error",
  "skipped",
  "run error",
  "pass",
  "fail",
  "warn",
  "no op",
];

/** Self-contained timeline view with status + resource-type + name filters. */
function TimelineView({ analysis }: { analysis: AnalysisState }) {
  const [nameQuery, setNameQuery] = useState("");
  const deferredQuery = useDeferredValue(nameQuery);
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set());
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());

  function toggleStatus(status: string) {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }

  function toggleType(type: string) {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  // O(1) row lookup — available for future Phase B use (dependency edge scrolling).
  const _dataIndexById = useMemo(
    () => new Map(analysis.ganttData.map((item, i) => [item.unique_id, i])),
    [analysis.ganttData],
  );
  void _dataIndexById;

  const presentStatuses = useMemo(
    () =>
      Array.from(
        new Set(analysis.ganttData.map((d) => d.status.toLowerCase())),
      ).filter((s) => TIMELINE_STATUS_OPTIONS.includes(s)),
    [analysis.ganttData],
  );

  const presentTypes = useMemo(
    () =>
      Array.from(
        new Set(
          analysis.ganttData
            .map((d) => d.resourceType)
            .filter((t): t is string => Boolean(t)),
        ),
      ).sort(),
    [analysis.ganttData],
  );

  const filteredData: GanttItem[] = useMemo(
    () =>
      analysis.ganttData.filter((item) => {
        if (
          activeStatuses.size > 0 &&
          !activeStatuses.has(item.status.toLowerCase())
        ) {
          return false;
        }
        if (activeTypes.size > 0 && !activeTypes.has(item.resourceType ?? "")) {
          return false;
        }
        if (deferredQuery) {
          const q = deferredQuery.trim().toLowerCase();
          if (
            q &&
            !item.name.toLowerCase().includes(q) &&
            !item.unique_id.toLowerCase().includes(q)
          ) {
            return false;
          }
        }
        return true;
      }),
    [analysis.ganttData, activeStatuses, activeTypes, deferredQuery],
  );

  const hasActiveFilters =
    activeStatuses.size > 0 || activeTypes.size > 0 || nameQuery.length > 0;

  return (
    <div className="workspace-view">
      <SectionCard
        title="Execution timeline"
        subtitle="Relative start and duration for each executed node."
      >
        <div className="timeline-controls">
          {presentStatuses.length > 0 && (
            <div className="pill-row">
              {presentStatuses.map((status) => {
                const isActive = activeStatuses.has(status);
                return (
                  <button
                    key={status}
                    type="button"
                    className={isActive ? PILL_ACTIVE : PILL_BASE}
                    onClick={() => toggleStatus(status)}
                  >
                    {status}
                    {isActive && " ✓"}
                  </button>
                );
              })}
            </div>
          )}

          {presentTypes.length > 0 && (
            <div className="pill-row">
              {presentTypes.map((type) => {
                const isActive = activeTypes.has(type);
                return (
                  <button
                    key={type}
                    type="button"
                    className={isActive ? PILL_ACTIVE : PILL_BASE}
                    onClick={() => toggleType(type)}
                  >
                    {type}
                    {isActive && " ✓"}
                  </button>
                );
              })}
            </div>
          )}

          <label className="workspace-search workspace-search--compact">
            <span>Search nodes</span>
            <div className="workspace-search__input-row">
              <input
                value={nameQuery}
                onChange={(e) => setNameQuery(e.target.value)}
                placeholder="Filter by name or id…"
                aria-label="Search timeline nodes"
              />
              {nameQuery && (
                <button
                  type="button"
                  className="workspace-search__clear"
                  aria-label="Clear search"
                  onClick={() => setNameQuery("")}
                >
                  ✕
                </button>
              )}
            </div>
          </label>

          {hasActiveFilters && (
            <button
              type="button"
              className={PILL_BASE}
              onClick={() => {
                setActiveStatuses(new Set());
                setActiveTypes(new Set());
                setNameQuery("");
              }}
            >
              Clear all filters
            </button>
          )}
        </div>

        {filteredData.length < analysis.ganttData.length && (
          <p className="timeline-filter-note">
            Showing {filteredData.length} of {analysis.ganttData.length} nodes
          </p>
        )}

        <GanttChart data={filteredData} runStartedAt={analysis.runStartedAt} />
      </SectionCard>
    </div>
  );
}

const VIEW_TITLES: Record<WorkspaceView, string> = {
  overview: "Run overview",
  assets: "Resource deep dive",
  models: "Model execution log",
  tests: "Test results",
  timeline: "Timeline view",
};

interface WorkspaceContentProps {
  activeView: WorkspaceView;
  analysis: AnalysisState;
  selectedResource: ResourceNode | null;
}

function WorkspaceContent({
  activeView,
  analysis,
  selectedResource,
}: WorkspaceContentProps) {
  if (activeView === "overview") return <OverviewView analysis={analysis} />;
  if (activeView === "assets")
    return <AssetsView analysis={analysis} resource={selectedResource} />;
  if (activeView === "models")
    return <ResultsView allRows={analysis.executions} tab="models" />;
  if (activeView === "tests")
    return <ResultsView allRows={analysis.executions} tab="tests" />;
  return <TimelineView analysis={analysis} />;
}

export function AnalysisWorkspace({
  analysis,
  activeView,
}: AnalysisWorkspaceProps) {
  const [groupFilter, setGroupFilter] = useState("all");
  const [resourceQuery, setResourceQuery] = useState("");
  const deferredResourceQuery = useDeferredValue(resourceQuery);
  const [selectedResourceId, setSelectedResourceId] = useState(
    analysis.selectedResourceId,
  );
  // Project-scope filter: "all" shows everything, "project" shows only the
  // inferred main project's resources.
  const [scopeFilter, setScopeFilter] = useState<"project" | "all">("project");
  const explorerListRef = useRef<HTMLDivElement>(null);

  // Prefer the authoritative name from manifest metadata; fall back to the
  // heuristic (most-common packageName among executed nodes).
  const projectName =
    analysis.projectName ?? deriveProjectName(analysis.executions);

  useEffect(() => {
    setGroupFilter("all");
    setResourceQuery("");
    setSelectedResourceId(analysis.selectedResourceId);
    setScopeFilter("project");
  }, [analysis.selectedResourceId, analysis.summary.total_nodes]);

  const explorerResources = analysis.resources
    .filter((resource) => {
      // Project scope filter
      if (
        scopeFilter === "project" &&
        projectName &&
        resource.packageName !== projectName
      ) {
        return false;
      }
      // Resource type group filter
      if (groupFilter !== "all" && resource.resourceType !== groupFilter) {
        return false;
      }
      return true;
    })
    .filter((resource) => matchesResource(resource, deferredResourceQuery));

  useEffect(() => {
    if (explorerResources.length === 0) {
      setSelectedResourceId(null);
      return;
    }
    const exists = explorerResources.some(
      (resource) => resource.uniqueId === selectedResourceId,
    );
    if (!exists) {
      setSelectedResourceId(explorerResources[0]!.uniqueId);
    }
  }, [explorerResources, selectedResourceId]);

  const selectedResource =
    analysis.resources.find(
      (resource) => resource.uniqueId === selectedResourceId,
    ) ?? null;

  // Virtualizer for the explorer list
  const explorerVirtualizer = useVirtualizer({
    count: explorerResources.length,
    getScrollElement: () => explorerListRef.current,
    estimateSize: () => 96,
    overscan: 10,
  });

  const showExplorer = activeView === "assets";

  return (
    <div
      className={`workspace-layout${showExplorer ? "" : " workspace-layout--full"}`}
    >
      {/* Explorer pane — only visible on the Assets tab */}
      {showExplorer && (
        <aside className="explorer-pane">
          <div className="explorer-pane__header">
            <div>
              <p className="eyebrow">Asset explorer</p>
              <h2>Workspace inventory</h2>
            </div>
            <div className="explorer-pane__count">
              {explorerResources.length}
              {scopeFilter === "project" &&
                analysis.resources.length !== explorerResources.length && (
                  <span
                    style={{
                      fontSize: "0.72rem",
                      display: "block",
                      textAlign: "center",
                      color: COLOR_TEXT_SOFT,
                    }}
                  >
                    of {analysis.resources.length}
                  </span>
                )}
            </div>
          </div>

          {/* Scope filter */}
          {projectName && (
            <div className="group-chip-list">
              <button
                type="button"
                className={scopeFilter === "project" ? CHIP_ACTIVE : CHIP_BASE}
                onClick={() => setScopeFilter("project")}
                title={`Show only ${projectName} resources`}
              >
                {projectName}
              </button>
              <button
                type="button"
                className={scopeFilter === "all" ? CHIP_ACTIVE : CHIP_BASE}
                onClick={() => setScopeFilter("all")}
              >
                All packages
              </button>
            </div>
          )}

          <label className="workspace-search">
            <span>Search resources</span>
            <input
              value={resourceQuery}
              onChange={(event) => setResourceQuery(event.target.value)}
              placeholder="Filter by name, path, type, or id"
            />
          </label>

          <div className="group-chip-list">
            <button
              type="button"
              className={groupFilter === "all" ? CHIP_ACTIVE : CHIP_BASE}
              onClick={() => setGroupFilter("all")}
            >
              All <span>{explorerResources.length}</span>
            </button>
            {analysis.resourceGroups
              .filter(
                (group) =>
                  scopeFilter === "all" ||
                  !projectName ||
                  analysis.resources.some(
                    (r) =>
                      r.resourceType === group.resourceType &&
                      r.packageName === projectName,
                  ),
              )
              .map((group) => {
                const countInScope = explorerResources.filter(
                  (r) => r.resourceType === group.resourceType,
                ).length;
                if (countInScope === 0) return null;
                return (
                  <button
                    key={group.resourceType}
                    type="button"
                    className={
                      groupFilter === group.resourceType
                        ? CHIP_ACTIVE
                        : CHIP_BASE
                    }
                    onClick={() => setGroupFilter(group.resourceType)}
                  >
                    {group.label} <span>{countInScope}</span>
                  </button>
                );
              })}
          </div>

          {/* Virtualized explorer list */}
          <div className="explorer-list" ref={explorerListRef}>
            <div
              style={{
                height: explorerVirtualizer.getTotalSize(),
                position: "relative",
              }}
            >
              {explorerVirtualizer.getVirtualItems().map((virtualRow) => {
                const resource = explorerResources[virtualRow.index]!;
                return (
                  <div
                    key={resource.uniqueId}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                      paddingBottom: "0.7rem",
                    }}
                  >
                    <button
                      type="button"
                      className={
                        resource.uniqueId === selectedResourceId
                          ? "explorer-item explorer-item--active"
                          : "explorer-item"
                      }
                      style={{ width: "100%" }}
                      onClick={() => setSelectedResourceId(resource.uniqueId)}
                    >
                      <div className="explorer-item__title-row">
                        <strong>{resource.name}</strong>
                        {resource.status && (
                          <span className={badgeClassName(resource.statusTone)}>
                            {resource.status}
                          </span>
                        )}
                      </div>
                      <div className="explorer-item__meta">
                        <span>{resource.resourceType}</span>
                        <Tooltip content={resource.uniqueId}>
                          <span>
                            {resource.originalFilePath ??
                              resource.path ??
                              resource.uniqueId}
                          </span>
                        </Tooltip>
                      </div>
                      {resource.description && (
                        <div
                          style={{
                            marginTop: "0.4rem",
                            fontSize: "0.84rem",
                            color: COLOR_TEXT_SOFT,
                            lineHeight: 1.4,
                          }}
                        >
                          {resource.description.length > 80
                            ? `${resource.description.slice(0, 80)}…`
                            : resource.description}
                        </div>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {explorerResources.length === 0 && (
              <EmptyState
                icon="🔍"
                headline="No resources found"
                subtext="Adjust the search query, group filter, or scope to find what you're looking for."
              />
            )}
          </div>
        </aside>
      )}

      <div className="workspace-main-panel">
        <div className="workspace-toolbar">
          <div>
            <p className="eyebrow">Analysis workspace</p>
            <h2>{VIEW_TITLES[activeView]}</h2>
          </div>
        </div>

        <WorkspaceContent
          activeView={activeView}
          analysis={analysis}
          selectedResource={selectedResource}
        />
      </div>
    </div>
  );
}
