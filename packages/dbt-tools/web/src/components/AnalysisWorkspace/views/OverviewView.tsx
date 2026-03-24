import {
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useDeferredValue,
  useMemo,
  useState,
} from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { EmptyState } from "../../EmptyState";
import type {
  AnalysisState,
  ExecutionRow,
  GraphSnapshot,
  ResourceNode,
  StatusBreakdownItem,
  StatusTone,
} from "@web/types";
import {
  PILL_ACTIVE,
  PILL_BASE,
  PRIMARY_PROJECT_SUMMARY_GROUPS,
  STATUS_COLORS,
  TEST_RESOURCE_TYPES,
} from "@web/lib/analysis-workspace/constants";
import type {
  DashboardStatusFilter,
  OverviewFilterState,
} from "@web/lib/analysis-workspace/types";
import {
  buildOverviewDerivedState,
  buildStatusBreakdownForRows,
  type OverviewDerivedState,
  type TypeStatusBreakdown,
} from "@web/lib/analysis-workspace/overviewState";
import {
  formatSeconds,
  formatRunStartedAt,
  getInvocationTimestamp,
  hasOverviewFilters,
  isMainProjectResource,
} from "@web/lib/analysis-workspace/utils";
import { formatResourceTypeLabel } from "../shared";

type HealthViewMode = "status" | "type";

const TOGGLE_WRAPPER_STYLE = {
  display: "flex",
  justifyContent: "flex-end",
  marginBottom: "0.75rem",
} as const;

export function OverviewPanel({
  title,
  subtitle,
  children,
  accent = "muted",
  headerRight,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  accent?: "muted" | "analysis" | "structure";
  headerRight?: ReactNode;
}) {
  return (
    <section className={`overview-panel overview-panel--${accent}`}>
      <div className="overview-panel__header">
        <div>
          <p className="eyebrow">{title}</p>
          {subtitle && <p className="overview-panel__subtitle">{subtitle}</p>}
        </div>
        {headerRight}
      </div>
      {children}
    </section>
  );
}

export function OverviewScopeBadge({ label }: { label: string }) {
  return <span className="overview-scope-badge">{label}</span>;
}

interface OverviewSummaryChip {
  label: string;
  value: string;
  detail?: string;
}

function buildResourceSummaryChip(
  label: string,
  resources: ResourceNode[],
  executions: ExecutionRow[],
): OverviewSummaryChip | null {
  if (resources.length === 0 && executions.length === 0) return null;
  const attentionCount = executions.filter(
    (row) => row.statusTone === "danger" || row.statusTone === "warning",
  ).length;
  return {
    label,
    value: `${resources.length} total`,
    detail: [
      `${executions.length} executed`,
      attentionCount > 0 ? `${attentionCount} attention` : null,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" · "),
  };
}

function buildOverviewBannerModel(
  analysis: AnalysisState,
  projectName: string | null,
  analysisSource: "preload" | "upload" | null,
  derived: OverviewDerivedState,
  filtered: boolean,
) {
  const mainProjectResources = analysis.resources.filter((resource) =>
    isMainProjectResource(resource, projectName),
  );
  const mainProjectExecutions = analysis.executions.filter((row) =>
    isMainProjectResource(row, projectName),
  );
  const groupedResources = new Map<string, ResourceNode[]>();
  const groupedExecutions = new Map<string, ExecutionRow[]>();

  for (const resource of mainProjectResources) {
    const groupKey = TEST_RESOURCE_TYPES.has(resource.resourceType)
      ? "tests"
      : resource.resourceType;
    const current = groupedResources.get(groupKey) ?? [];
    current.push(resource);
    groupedResources.set(groupKey, current);
  }

  for (const row of mainProjectExecutions) {
    const groupKey = TEST_RESOURCE_TYPES.has(row.resourceType)
      ? "tests"
      : row.resourceType;
    const current = groupedExecutions.get(groupKey) ?? [];
    current.push(row);
    groupedExecutions.set(groupKey, current);
  }

  const runtimeChip: OverviewSummaryChip = {
    label: "Run time",
    value: filtered
      ? formatSeconds(derived.filteredExecutionTime)
      : formatSeconds(analysis.summary.total_execution_time),
  };
  const resourceChips = PRIMARY_PROJECT_SUMMARY_GROUPS.map(({ key, label }) => {
    return buildResourceSummaryChip(
      label,
      groupedResources.get(key) ?? [],
      groupedExecutions.get(key) ?? [],
    );
  }).filter((value): value is OverviewSummaryChip => value != null);

  let tone: StatusTone = "positive";
  let title = "Healthy run";
  let summary = filtered
    ? "No failing nodes match the current dashboard filters."
    : "No failing nodes surfaced in the latest run.";
  if (derived.failingNodes > 0) {
    tone = "danger";
    title = `${derived.failingNodes} failing node${derived.failingNodes === 1 ? "" : "s"} require attention`;
    summary = "Prioritize failing nodes before reviewing downstream impact.";
  } else if (derived.warningNodes > 0) {
    tone = "warning";
    title = `${derived.warningNodes} warning node${derived.warningNodes === 1 ? "" : "s"} need review`;
    summary =
      "Warnings surfaced in this run. Review tests and runtime hotspots next.";
  }

  return {
    tone,
    title,
    summary,
    sourceLabel:
      analysisSource === "preload"
        ? "DBT_TARGET"
        : analysisSource === "upload"
          ? "UPLOADED"
          : "ARTIFACTS",
    summaryBits: [
      projectName ?? "Workspace",
      `${analysis.graphSummary.totalNodes} graph nodes`,
      `${analysis.summary.total_nodes} executions`,
      analysis.invocationId != null
        ? `invocation ${analysis.invocationId}`
        : null,
      getInvocationTimestamp(analysis) != null
        ? `invocation started ${formatRunStartedAt(getInvocationTimestamp(analysis)!)}`
        : null,
    ].filter((value): value is string => Boolean(value)),
    chips: [runtimeChip, ...resourceChips],
  };
}

export function OverviewStatusBanner({
  analysis,
  projectName,
  analysisSource,
  derived,
  filtered,
  embedded = false,
}: {
  analysis: AnalysisState;
  projectName: string | null;
  analysisSource: "preload" | "upload" | null;
  derived: OverviewDerivedState;
  filtered: boolean;
  embedded?: boolean;
}) {
  const banner = buildOverviewBannerModel(
    analysis,
    projectName,
    analysisSource,
    derived,
    filtered,
  );

  return (
    <section
      className={`overview-banner overview-banner--${banner.tone}${embedded ? " overview-banner--embedded" : ""}`}
    >
      <div className="overview-banner__topline">
        <p className="eyebrow">Workspace overview</p>
        <span className="overview-banner__source">{banner.sourceLabel}</span>
      </div>

      <p className="overview-banner__summary">
        {banner.summaryBits.join(" · ")}
      </p>

      <div className="overview-banner__body">
        <div className="overview-banner__copy">
          <h3>{banner.title}</h3>
          <p>{banner.summary}</p>
        </div>

        <div className="overview-banner__chips">
          {banner.chips.map((chip) => (
            <div key={chip.label} className="overview-chip">
              <span>{chip.label}</span>
              <strong>{chip.value}</strong>
              {chip.detail && <small>{chip.detail}</small>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function OverviewAttentionCard({
  derived,
}: {
  derived: OverviewDerivedState;
}) {
  const tone: StatusTone =
    derived.failingNodes > 0
      ? "danger"
      : derived.warningNodes > 0
        ? "warning"
        : "positive";
  const followup =
    derived.failingNodes > 0
      ? `${derived.failedModels} failed model${derived.failedModels === 1 ? "" : "s"} block downstream investigation.`
      : derived.warningNodes > 0
        ? "Warnings surfaced. Review tests and freshness signals next."
        : "No immediate triage items.";

  return (
    <section
      className={`overview-module overview-module--attention overview-module--${tone}`}
    >
      <div className="overview-module__header">
        <h3>Attention</h3>
        <p>Immediate run posture and next step.</p>
      </div>
      <div className={`attention-card attention-card--${tone}`}>
        <div className="attention-card__metrics">
          <div className="attention-card__metric">
            <span>Failing</span>
            <strong>{derived.failingNodes}</strong>
          </div>
          <div className="attention-card__metric">
            <span>Warnings</span>
            <strong>{derived.warningNodes}</strong>
          </div>
        </div>
        <p>{followup}</p>
      </div>
    </section>
  );
}

export function OverviewActionListCard({
  derived,
  title = "Bottlenecks",
  subtitle = "Longest-running nodes in the filtered execution slice.",
  embedded = false,
}: {
  derived: OverviewDerivedState;
  title?: string;
  subtitle?: string;
  embedded?: boolean;
}) {
  const topRows = derived.topBottlenecks;

  return (
    <section
      className={`overview-module overview-module--bottlenecks${embedded ? " overview-module--embedded" : ""}`}
    >
      {!embedded && (
        <div className="overview-module__header">
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      )}
      {topRows.length > 0 ? (
        <div className="action-list">
          {topRows.map((row, index) => (
            <div key={row.uniqueId} className="action-list__row">
              <div className="action-list__body">
                <strong>{`${index + 1}. ${row.name}`}</strong>
                <span>
                  {`${(
                    (row.executionTime /
                      Math.max(derived.filteredExecutionTime, 0.0001)) *
                    100
                  ).toFixed(1)}% of filtered run`}
                </span>
              </div>
              <div className="action-list__metric">
                <strong>{formatSeconds(row.executionTime)}</strong>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="⚡"
          headline="No matching bottlenecks"
          subtext="No executions match the current dashboard filters."
        />
      )}
    </section>
  );
}

export function OverviewCriticalPathCard({
  analysis,
  filtered,
}: {
  analysis: AnalysisState;
  filtered: boolean;
}) {
  const criticalPathLength = analysis.summary.critical_path?.path.length ?? 0;

  return (
    <section className="overview-module overview-module--critical">
      <div className="overview-module__header">
        <div>
          <h3>Critical path</h3>
          <p>Dependency pressure and scheduling risk.</p>
        </div>
        {filtered && <OverviewScopeBadge label="Workspace-wide" />}
      </div>
      <div className="critical-path-card">
        <div className="critical-path-card__headline">
          <strong>{criticalPathLength} nodes</strong>
          <span>
            {analysis.graphSummary.hasCycles
              ? "Cycles detected in the dependency graph."
              : "No cycles detected in the dependency graph."}
          </span>
        </div>
        <div className="critical-path-card__detail">
          <span>Graph edges</span>
          <strong>{analysis.graphSummary.totalEdges}</strong>
        </div>
      </div>
    </section>
  );
}

export function OverviewCoverageCard({
  analysis,
  filtered,
}: {
  analysis: AnalysisState;
  filtered: boolean;
}) {
  const documentedResources = analysis.resources.filter((resource) =>
    Boolean(resource.description?.trim()),
  ).length;
  const documentationCoverage =
    analysis.resources.length > 0
      ? Math.round((documentedResources / analysis.resources.length) * 100)
      : 0;
  const undocumentedResources = Math.max(
    analysis.resources.length - documentedResources,
    0,
  );
  const modelResources = analysis.resources.filter(
    (resource) => resource.resourceType === "model",
  ).length;

  return (
    <section className="overview-module overview-module--coverage">
      <div className="overview-module__header">
        <div>
          <h3>Coverage</h3>
          <p>Structural health of metadata and discovery quality.</p>
        </div>
        {filtered && <OverviewScopeBadge label="Workspace-wide" />}
      </div>
      <div className="coverage-card">
        <div className="coverage-card__headline">
          <strong>{documentationCoverage}%</strong>
          <span>Metadata coverage</span>
        </div>
        <div className="coverage-card__stats">
          <div>
            <span>Documented</span>
            <strong>
              {documentedResources} / {analysis.resources.length}
            </strong>
          </div>
          <div>
            <span>Missing descriptions</span>
            <strong>{undocumentedResources}</strong>
          </div>
        </div>
        <p>
          {modelResources > 0
            ? "Next improvement: document core models first to improve catalog-style discovery."
            : "Add descriptions to core resources to improve catalog-style discovery."}
        </p>
      </div>
    </section>
  );
}

function buildTypeStatusBreakdowns(
  executions: ExecutionRow[],
): TypeStatusBreakdown[] {
  const rowsByType = new Map<string, ExecutionRow[]>();
  for (const row of executions) {
    const current = rowsByType.get(row.resourceType) ?? [];
    current.push(row);
    rowsByType.set(row.resourceType, current);
  }

  return [...rowsByType.entries()]
    .map(([resourceType, rows]) => ({
      resourceType,
      count: rows.length,
      duration: rows.reduce((sum, row) => sum + row.executionTime, 0),
      statusBreakdown: buildStatusBreakdownForRows(rows),
    }))
    .sort((a, b) => b.count - a.count);
}

export function TypeStatusDonutCard({ group }: { group: TypeStatusBreakdown }) {
  const statusData = group.statusBreakdown.map((entry) => ({
    name: entry.status,
    value: entry.count,
    tone: entry.tone,
  }));
  const accentTone = group.statusBreakdown[0]?.tone ?? "neutral";

  return (
    <article
      className="type-donut-card"
      style={{ "--type-accent": STATUS_COLORS[accentTone] } as CSSProperties}
    >
      <div className="type-donut-card__title">
        <strong>{formatResourceTypeLabel(group.resourceType)}</strong>
        <span className="type-donut-card__count">{group.count} runs</span>
      </div>
      <div className="type-donut-card__meta">
        <span>{formatSeconds(group.duration)} runtime</span>
      </div>
      <div className="type-donut-card__chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={statusData}
              dataKey="value"
              nameKey="name"
              innerRadius={26}
              outerRadius={42}
              paddingAngle={2}
              strokeWidth={0}
            >
              {statusData.map((entry) => (
                <Cell
                  key={`${group.resourceType}-${entry.name}`}
                  fill={STATUS_COLORS[entry.tone as StatusTone]}
                />
              ))}
            </Pie>
            <RechartsTooltip
              formatter={(value: number) => [`${value} runs`, "Count"]}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid rgba(35, 42, 52, 0.12)",
                boxShadow: "0 20px 40px rgba(26, 34, 43, 0.14)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="type-donut-card__legend">
        {group.statusBreakdown.map((entry) => (
          <div
            key={`${group.resourceType}-${entry.status}`}
            className="type-donut-card__legend-row"
          >
            <div className="type-donut-card__legend-label">
              <span
                className="legend-row__swatch"
                style={{ background: STATUS_COLORS[entry.tone] }}
              />
              <span>{entry.status}</span>
            </div>
            <div className="type-donut-card__legend-metric">
              <strong>{entry.count}</strong>
              <span>{(entry.share * 100).toFixed(0)}%</span>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

export function TypeStatusDonutGrid({
  executions,
}: {
  executions: ExecutionRow[];
}) {
  const groups = buildTypeStatusBreakdowns(executions);

  if (groups.length === 0) {
    return <div className="empty-state">No execution data.</div>;
  }

  return (
    <div className="type-donut-grid">
      {groups.map((group) => (
        <TypeStatusDonutCard key={group.resourceType} group={group} />
      ))}
    </div>
  );
}

export function StatusDonutChart({
  statusData,
  statusBreakdown,
}: {
  statusData: Array<{ name: string; value: number; tone: string }>;
  statusBreakdown: StatusBreakdownItem[];
}) {
  const renderStatusLabel = ({
    cx,
    cy,
    midAngle,
    outerRadius,
    percent,
    name,
  }: {
    cx?: number;
    cy?: number;
    midAngle?: number;
    outerRadius?: number;
    percent?: number;
    name?: string;
  }) => {
    if (
      cx == null ||
      cy == null ||
      midAngle == null ||
      outerRadius == null ||
      percent == null ||
      name == null ||
      percent < 0.08
    ) {
      return null;
    }
    const radians = Math.PI / 180;
    const lineStartRadius = outerRadius + 6;
    const lineEndRadius = outerRadius + 18;
    const x1 = cx + lineStartRadius * Math.cos(-midAngle * radians);
    const y1 = cy + lineStartRadius * Math.sin(-midAngle * radians);
    const x2 = cx + lineEndRadius * Math.cos(-midAngle * radians);
    const y2 = cy + lineEndRadius * Math.sin(-midAngle * radians);
    const toRight = x2 >= cx;
    const x3 = x2 + (toRight ? 12 : -12);

    return (
      <g className="status-donut__callout">
        <path d={`M${x1},${y1} L${x2},${y2} L${x3},${y2}`} />
        <text
          x={x3 + (toRight ? 4 : -4)}
          y={y2}
          textAnchor={toRight ? "start" : "end"}
          dominantBaseline="central"
        >
          {name}
        </text>
      </g>
    );
  };

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
              labelLine={false}
              label={renderStatusLabel}
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
        {statusBreakdown.map((entry) => (
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

export function StatusDonutWithData({
  statusBreakdown,
  executions,
}: {
  statusBreakdown: StatusBreakdownItem[];
  executions: ExecutionRow[];
}) {
  const [viewMode, setViewMode] = useState<HealthViewMode>("status");

  const statusData = statusBreakdown.map((entry) => ({
    name: entry.status,
    value: entry.count,
    tone: entry.tone,
  }));

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
        <TypeStatusDonutGrid executions={executions} />
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
      <StatusDonutChart
        statusData={statusData}
        statusBreakdown={statusBreakdown}
      />
    </div>
  );
}

export function OverviewFilterBar({
  filters,
  setFilters,
  availableTypes,
  resultCount,
}: {
  filters: OverviewFilterState;
  setFilters: Dispatch<SetStateAction<OverviewFilterState>>;
  availableTypes: string[];
  resultCount: number;
}) {
  const activeCount =
    (filters.status !== "all" ? 1 : 0) +
    filters.resourceTypes.size +
    (filters.query.trim() ? 1 : 0);

  function toggleType(resourceType: string) {
    setFilters((current) => {
      const next = new Set(current.resourceTypes);
      if (next.has(resourceType)) next.delete(resourceType);
      else next.add(resourceType);
      return { ...current, resourceTypes: next };
    });
  }

  return (
    <div className="overview-filter-bar">
      <div className="overview-filter-bar__topline">
        <div className="overview-filter-bar__title">
          <span>Dashboard filters</span>
          <strong>{resultCount} matching runs</strong>
        </div>
        {activeCount > 0 && (
          <button
            type="button"
            className={PILL_BASE}
            onClick={() =>
              setFilters({
                status: "all",
                resourceTypes: new Set(),
                query: "",
              })
            }
          >
            Clear all ({activeCount})
          </button>
        )}
      </div>

      <div className="overview-filter-bar__controls">
        <div className="pill-row">
          {[
            { value: "all", label: "All" },
            { value: "positive", label: "Healthy" },
            { value: "warning", label: "Warnings" },
            { value: "danger", label: "Errors" },
          ].map((filter) => (
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

        {availableTypes.length > 0 && (
          <div className="pill-row">
            {availableTypes.map((type) => {
              const active = filters.resourceTypes.has(type);
              return (
                <button
                  key={type}
                  type="button"
                  className={active ? PILL_ACTIVE : PILL_BASE}
                  onClick={() => toggleType(type)}
                >
                  {type.replace("_", " ")}
                  {active && " ✓"}
                </button>
              );
            })}
          </div>
        )}

        <label className="workspace-search workspace-search--compact overview-filter-bar__search">
          <span>Search executions</span>
          <div className="workspace-search__input-row">
            <input
              value={filters.query}
              onChange={(e) =>
                setFilters((current) => ({
                  ...current,
                  query: e.target.value,
                }))
              }
              placeholder="Filter by name, path, status, or thread…"
            />
            {filters.query && (
              <button
                type="button"
                className="workspace-search__clear"
                aria-label="Clear dashboard search"
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    query: "",
                  }))
                }
              >
                ✕
              </button>
            )}
          </div>
        </label>
      </div>
    </div>
  );
}

export function GraphCompositionCard({
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

export function OverviewView({
  analysis,
  projectName,
  analysisSource,
  filters,
  setFilters,
}: {
  analysis: AnalysisState;
  projectName: string | null;
  analysisSource: "preload" | "upload" | null;
  filters: OverviewFilterState;
  setFilters: Dispatch<SetStateAction<OverviewFilterState>>;
}) {
  const deferredQuery = useDeferredValue(filters.query);
  const derived = useMemo(
    () =>
      buildOverviewDerivedState(analysis, {
        ...filters,
        query: deferredQuery,
      }),
    [analysis, deferredQuery, filters],
  );
  const filtered = hasOverviewFilters(filters);
  const workerThreadCount =
    derived.threadCount || derived.filteredThreadStats.length;
  const criticalPathLength = analysis.summary.critical_path?.path.length ?? 0;
  const modelsCount = derived.filteredExecutions.filter(
    (row) => row.resourceType === "model",
  ).length;
  const testsCount = derived.filteredExecutions.filter((row) =>
    TEST_RESOURCE_TYPES.has(row.resourceType),
  ).length;
  const availableTypes = useMemo(
    () =>
      Array.from(
        new Set(analysis.executions.map((row) => row.resourceType)),
      ).sort(),
    [analysis.executions],
  );

  return (
    <div className="workspace-view">
      <div className="overview-stack">
        <OverviewPanel
          title="Workspace overview"
          subtitle="Primary run-health view for the current execution slice."
          accent="analysis"
          headerRight={
            filtered ? (
              <OverviewScopeBadge label="Health-first filters" />
            ) : null
          }
        >
          <OverviewStatusBanner
            analysis={analysis}
            projectName={projectName}
            analysisSource={analysisSource}
            derived={derived}
            filtered={filtered}
            embedded
          />
          <OverviewFilterBar
            filters={filters}
            setFilters={setFilters}
            availableTypes={availableTypes}
            resultCount={derived.filteredExecutions.length}
          />
          <section className="overview-health-surface">
            <StatusDonutWithData
              statusBreakdown={derived.filteredStatusBreakdown}
              executions={derived.filteredExecutions}
            />
            {derived.filteredExecutions.length === 0 && (
              <EmptyState
                icon="◌"
                headline="No matching executions"
                subtext="Try clearing the dashboard filters or broadening your search."
              />
            )}
          </section>
        </OverviewPanel>

        <OverviewPanel
          title="Run analysis"
          subtitle="Immediate posture and dependency pressure after health review."
          accent="analysis"
        >
          <div className="overview-band overview-band--triage">
            <OverviewAttentionCard derived={derived} />
            <OverviewCriticalPathCard analysis={analysis} filtered={filtered} />
          </div>
          <OverviewActionListCard derived={derived} />
        </OverviewPanel>

        <OverviewPanel
          title="Execution context"
          subtitle="Supporting context for worker pressure and filtered footprint."
          headerRight={
            filtered ? <OverviewScopeBadge label="Filtered" /> : null
          }
        >
          <div className="overview-band overview-band--context">
            <section className="overview-module overview-module--threads">
              <div className="overview-module__header">
                <h3>Thread distribution</h3>
                <p>The busiest worker lanes in the current execution slice.</p>
              </div>
              {derived.filteredThreadStats.length > 0 ? (
                <div className="thread-list">
                  {derived.filteredThreadStats.slice(0, 6).map((entry) => (
                    <div key={entry.threadId} className="thread-list__row">
                      <div>
                        <strong>{entry.threadId}</strong>
                        <span>{entry.count} nodes</span>
                      </div>
                      <div>{formatSeconds(entry.totalExecutionTime)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon="⋯"
                  headline="No thread data in slice"
                  subtext="No matching executions were found for the current dashboard filters."
                />
              )}
            </section>

            <section className="overview-module overview-module--footprint">
              <div className="overview-module__header">
                <h3>Footprint</h3>
                <p>Filtered execution volume, duration, and worker scale.</p>
              </div>
              <div className="footprint-card">
                <div className="footprint-card__stats">
                  <div className="footprint-card__stat">
                    <span>Executed</span>
                    <strong>{derived.filteredExecutions.length}</strong>
                  </div>
                  <div className="footprint-card__stat">
                    <span>Runtime</span>
                    <strong>
                      {formatSeconds(derived.filteredExecutionTime)}
                    </strong>
                  </div>
                  <div className="footprint-card__stat">
                    <span>Worker lanes</span>
                    <strong>{workerThreadCount}</strong>
                  </div>
                  <div className="footprint-card__stat">
                    <span>Models</span>
                    <strong>{modelsCount}</strong>
                  </div>
                  <div className="footprint-card__stat">
                    <span>Tests</span>
                    <strong>{testsCount}</strong>
                  </div>
                </div>
                <p className="footprint-card__detail">
                  Graph totals remain workspace-wide:{" "}
                  {analysis.graphSummary.totalNodes} nodes,{" "}
                  {analysis.graphSummary.totalEdges} edges, {criticalPathLength}{" "}
                  critical-path nodes.
                </p>
              </div>
            </section>
          </div>
        </OverviewPanel>

        <OverviewPanel
          title="Structural health"
          subtitle="Coverage and graph shape across the workspace."
          accent="structure"
        >
          <div className="overview-band overview-band--structure">
            <OverviewCoverageCard analysis={analysis} filtered={filtered} />
            <section className="overview-module overview-module--composition">
              <div className="overview-module__header">
                <div>
                  <h3>Graph composition</h3>
                  <p>Node type breakdown in the manifest graph.</p>
                </div>
                {filtered && <OverviewScopeBadge label="Workspace-wide" />}
              </div>
              <GraphCompositionCard graphSummary={analysis.graphSummary} />
            </section>
          </div>
        </OverviewPanel>
      </div>
    </div>
  );
}
