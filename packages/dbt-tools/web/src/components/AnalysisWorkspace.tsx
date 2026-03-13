import { type ReactNode, useEffect, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { GanttChart } from "./GanttChart";
import type {
  AnalysisState,
  ExecutionRow,
  ResourceNode,
  StatusTone,
} from "../types";

export type WorkspaceView = "overview" | "assets" | "results" | "timeline";

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

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="workspace-card">
      <div className="workspace-card__header">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
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

function StatusDonut({ analysis }: { analysis: AnalysisState }) {
  const data = analysis.statusBreakdown.map((entry) => ({
    name: entry.status,
    value: entry.count,
    tone: entry.tone,
  }));

  if (data.length === 0) {
    return (
      <div className="empty-state">No execution statuses were recorded.</div>
    );
  }

  return (
    <div className="status-donut">
      <div className="status-donut__chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={56}
              outerRadius={82}
              paddingAngle={3}
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={STATUS_COLORS[entry.tone as StatusTone]}
                />
              ))}
            </Pie>
            <Tooltip
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

function ResourceSpotlight({
  resource,
  analysis,
}: {
  resource: ResourceNode | null;
  analysis: AnalysisState;
}) {
  if (!resource) {
    return (
      <div className="empty-state">
        Choose a resource in the explorer to inspect it.
      </div>
    );
  }

  const dependencySummary = analysis.dependencyIndex[resource.uniqueId];

  return (
    <div className="resource-spotlight">
      <div className="resource-spotlight__header">
        <div>
          <p className="eyebrow">{resource.resourceType}</p>
          <h4>{resource.name}</h4>
        </div>
        {resource.status && (
          <span className={badgeClassName(resource.statusTone)}>
            {resource.status}
          </span>
        )}
      </div>
      <div className="resource-spotlight__meta">
        <span>{resource.packageName || "workspace"}</span>
        <span>
          {resource.originalFilePath ?? resource.path ?? "No file path"}
        </span>
      </div>
      <div className="resource-spotlight__metrics">
        <div>
          <strong>{formatSeconds(resource.executionTime)}</strong>
          <span>Execution time</span>
        </div>
        <div>
          <strong>{dependencySummary?.upstreamCount ?? 0}</strong>
          <span>Upstream nodes</span>
        </div>
        <div>
          <strong>{dependencySummary?.downstreamCount ?? 0}</strong>
          <span>Downstream nodes</span>
        </div>
      </div>
      {resource.description && (
        <p className="resource-spotlight__description">
          {resource.description}
        </p>
      )}
    </div>
  );
}

function OverviewView({
  analysis,
  selectedResource,
}: {
  analysis: AnalysisState;
  selectedResource: ResourceNode | null;
}) {
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
          title="Selected asset"
          subtitle="A quick readout for the currently focused resource."
        >
          <ResourceSpotlight resource={selectedResource} analysis={analysis} />
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
            <div className="empty-state">
              No bottleneck candidates were detected.
            </div>
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
        <div className="empty-state">
          No resource matches the current explorer filters.
        </div>
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
                    <span>{entry.uniqueId}</span>
                  </div>
                  <span className="dependency-list__depth">
                    Depth {entry.depth}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              This resource has no upstream dependencies.
            </div>
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
                    <span>{entry.uniqueId}</span>
                  </div>
                  <span className="dependency-list__depth">
                    Depth {entry.depth}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              This resource has no downstream dependents.
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function ResultsView({
  rows,
  statusFilter,
  onStatusFilterChange,
}: {
  rows: ExecutionRow[];
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
}) {
  const filterLabels = [
    { value: "all", label: `All (${rows.length})` },
    {
      value: "positive",
      label: `Healthy (${rows.filter((row) => row.statusTone === "positive").length})`,
    },
    {
      value: "warning",
      label: `Warnings (${rows.filter((row) => row.statusTone === "warning").length})`,
    },
    {
      value: "danger",
      label: `Errors (${rows.filter((row) => row.statusTone === "danger").length})`,
    },
  ];

  const filteredRows =
    statusFilter === "all"
      ? rows
      : rows.filter((row) => row.statusTone === statusFilter);

  return (
    <div className="workspace-view">
      <SectionCard
        title="Run results"
        subtitle="Searchable execution log sorted by longest duration first."
      >
        <div className="pill-row">
          {filterLabels.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={
                statusFilter === filter.value
                  ? "workspace-pill workspace-pill--active"
                  : "workspace-pill"
              }
              onClick={() => onStatusFilterChange(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="results-table">
          <div className="results-table__header">
            <span>Node</span>
            <span>Type</span>
            <span>Status</span>
            <span>Duration</span>
            <span>Thread</span>
          </div>
          <div className="results-table__body">
            {filteredRows.map((row) => (
              <div key={row.uniqueId} className="results-table__row">
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
            ))}
            {filteredRows.length === 0 && (
              <div className="empty-state">
                No rows match the current results filters.
              </div>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function TimelineView({ analysis }: { analysis: AnalysisState }) {
  return (
    <div className="workspace-view">
      <SectionCard
        title="Execution timeline"
        subtitle="Relative start and duration for each executed node."
      >
        <GanttChart data={analysis.ganttData} />
      </SectionCard>
    </div>
  );
}

export function AnalysisWorkspace({
  analysis,
  activeView,
}: AnalysisWorkspaceProps) {
  const [groupFilter, setGroupFilter] = useState("all");
  const [resourceQuery, setResourceQuery] = useState("");
  const [resultsQuery, setResultsQuery] = useState("");
  const [resultsStatusFilter, setResultsStatusFilter] = useState("all");
  const [selectedResourceId, setSelectedResourceId] = useState(
    analysis.selectedResourceId,
  );

  useEffect(() => {
    setGroupFilter("all");
    setResourceQuery("");
    setResultsQuery("");
    setResultsStatusFilter("all");
    setSelectedResourceId(analysis.selectedResourceId);
  }, [analysis.selectedResourceId, analysis.summary.total_nodes]);

  const explorerResources = analysis.resources
    .filter((resource) => {
      if (groupFilter === "all") return true;
      return resource.resourceType === groupFilter;
    })
    .filter((resource) => matchesResource(resource, resourceQuery));

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

  const resultRows = analysis.executions.filter((row) =>
    matchesExecution(row, resultsQuery),
  );

  return (
    <div className="workspace-layout">
      <aside className="explorer-pane">
        <div className="explorer-pane__header">
          <div>
            <p className="eyebrow">Asset explorer</p>
            <h2>Workspace inventory</h2>
          </div>
          <div className="explorer-pane__count">
            {analysis.resources.length}
          </div>
        </div>

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
            className={
              groupFilter === "all"
                ? "group-chip group-chip--active"
                : "group-chip"
            }
            onClick={() => setGroupFilter("all")}
          >
            All <span>{analysis.resources.length}</span>
          </button>
          {analysis.resourceGroups.map((group) => (
            <button
              key={group.resourceType}
              type="button"
              className={
                groupFilter === group.resourceType
                  ? "group-chip group-chip--active"
                  : "group-chip"
              }
              onClick={() => setGroupFilter(group.resourceType)}
            >
              {group.label} <span>{group.count}</span>
            </button>
          ))}
        </div>

        <div className="explorer-list">
          {explorerResources.map((resource) => (
            <button
              key={resource.uniqueId}
              type="button"
              className={
                resource.uniqueId === selectedResourceId
                  ? "explorer-item explorer-item--active"
                  : "explorer-item"
              }
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
                <span>
                  {resource.originalFilePath ??
                    resource.path ??
                    resource.uniqueId}
                </span>
              </div>
            </button>
          ))}
          {explorerResources.length === 0 && (
            <div className="empty-state">
              No resources match the explorer filters.
            </div>
          )}
        </div>
      </aside>

      <div className="workspace-main-panel">
        <div className="workspace-toolbar">
          <div>
            <p className="eyebrow">Analysis workspace</p>
            <h2>
              {activeView === "overview" && "Run overview"}
              {activeView === "assets" && "Resource deep dive"}
              {activeView === "results" && "Execution results"}
              {activeView === "timeline" && "Timeline view"}
            </h2>
          </div>

          <label className="workspace-search workspace-search--compact">
            <span>Search results</span>
            <input
              value={resultsQuery}
              onChange={(event) => setResultsQuery(event.target.value)}
              placeholder="Filter the execution log"
            />
          </label>
        </div>

        {activeView === "overview" && (
          <OverviewView
            analysis={analysis}
            selectedResource={selectedResource}
          />
        )}
        {activeView === "assets" && (
          <AssetsView analysis={analysis} resource={selectedResource} />
        )}
        {activeView === "results" && (
          <ResultsView
            rows={resultRows}
            statusFilter={resultsStatusFilter}
            onStatusFilterChange={setResultsStatusFilter}
          />
        )}
        {activeView === "timeline" && <TimelineView analysis={analysis} />}
      </div>
    </div>
  );
}
