import type {
  AnalysisState,
  ExecutionRow,
  ResourceNode,
  StatusTone,
} from "@web/types";
import {
  PRIMARY_PROJECT_SUMMARY_GROUPS,
  TEST_RESOURCE_TYPES,
} from "@web/lib/analysis-workspace/constants";
import type { OverviewDerivedState } from "@web/lib/analysis-workspace/overviewState";
import {
  formatRunStartedAt,
  getInvocationTimestamp,
  formatSeconds,
  isMainProjectResource,
} from "@web/lib/analysis-workspace/utils";

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

/**
 * RunSummaryStrip — Band 2 of the Health page.
 *
 * A single compact horizontal band that replaces:
 *   - the health-hero-strip (workspace signal cards)
 *   - the OverviewStatusBanner (run title + summary chips)
 *
 * Reads as one coherent run summary:
 *   [Posture] | [Runtime] | [Mode] | [Models] | [Tests] | …
 */
export function RunSummaryStrip({
  analysis,
  projectName,
  analysisSource,
  derived,
  filtered,
}: {
  analysis: AnalysisState;
  projectName: string | null;
  analysisSource: "preload" | "upload" | null;
  derived: OverviewDerivedState;
  filtered: boolean;
}) {
  const banner = buildOverviewBannerModel(
    analysis,
    projectName,
    analysisSource,
    derived,
    filtered,
  );

  const modeLabel =
    analysisSource === "preload"
      ? "Live target"
      : analysisSource === "upload"
        ? "Local upload"
        : "Artifacts";

  return (
    <div
      className={`run-summary-strip run-summary-strip--${banner.tone}`}
      aria-label="Run summary"
    >
      {/* Posture — leftmost, tone-prominent */}
      <div className="run-summary-strip__item run-summary-strip__item--posture">
        <span>{banner.title}</span>
      </div>

      {/* Runtime */}
      <div className="run-summary-strip__item">
        <span className="run-summary-strip__label">Runtime</span>
        <span className="run-summary-strip__value">
          {formatSeconds(
            filtered
              ? derived.filteredExecutionTime
              : analysis.summary.total_execution_time,
          )}
        </span>
      </div>

      {/* Source / mode */}
      <div className="run-summary-strip__item">
        <span className="run-summary-strip__label">Source</span>
        <span className="run-summary-strip__value">{modeLabel}</span>
      </div>

      {/* Per-type resource chips */}
      {banner.chips.slice(1).map((chip) => (
        <div key={chip.label} className="run-summary-strip__item">
          <span className="run-summary-strip__label">{chip.label}</span>
          <span className="run-summary-strip__value">{chip.value}</span>
          {chip.detail && (
            <span className="run-summary-strip__detail">{chip.detail}</span>
          )}
        </div>
      ))}
    </div>
  );
}
