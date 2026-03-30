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
import { sourceBadgeLabel } from "@web/lib/artifactSource";
import type { WorkspaceArtifactSource } from "@web/services/artifactSourceApi";

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

function groupKeyForResourceType(resourceType: string): string {
  return TEST_RESOURCE_TYPES.has(resourceType) ? "tests" : resourceType;
}

function groupResourcesByType(
  resources: ResourceNode[],
): Map<string, ResourceNode[]> {
  const grouped = new Map<string, ResourceNode[]>();
  for (const resource of resources) {
    const groupKey = groupKeyForResourceType(resource.resourceType);
    const current = grouped.get(groupKey) ?? [];
    current.push(resource);
    grouped.set(groupKey, current);
  }
  return grouped;
}

function groupExecutionsByType(
  executions: ExecutionRow[],
): Map<string, ExecutionRow[]> {
  const grouped = new Map<string, ExecutionRow[]>();
  for (const row of executions) {
    const groupKey = groupKeyForResourceType(row.resourceType);
    const current = grouped.get(groupKey) ?? [];
    current.push(row);
    grouped.set(groupKey, current);
  }
  return grouped;
}

function buildAdapterSummaryChip(
  adapterTotals: NonNullable<AnalysisState["adapterTotals"]>,
): OverviewSummaryChip {
  return {
    label: "Warehouse metrics",
    value: `${adapterTotals.nodesWithAdapterData} nodes`,
    detail: [
      adapterTotals.totalBytesProcessed != null
        ? `${adapterTotals.totalBytesProcessed.toLocaleString()} bytes processed`
        : null,
      adapterTotals.totalSlotMs != null
        ? `${adapterTotals.totalSlotMs.toLocaleString()} slot-ms`
        : null,
      adapterTotals.totalRowsAffected != null
        ? `${adapterTotals.totalRowsAffected.toLocaleString()} rows affected`
        : null,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" · "),
  };
}

function overviewBannerHeadline(
  derived: OverviewDerivedState,
  filtered: boolean,
): { tone: StatusTone; title: string; summary: string } {
  if (derived.failingNodes > 0) {
    return {
      tone: "danger",
      title: `${derived.failingNodes} failing node${derived.failingNodes === 1 ? "" : "s"} require attention`,
      summary: "Prioritize failing nodes before reviewing downstream impact.",
    };
  }
  if (derived.warningNodes > 0) {
    return {
      tone: "warning",
      title: `${derived.warningNodes} warning node${derived.warningNodes === 1 ? "" : "s"} need review`,
      summary:
        "Warnings surfaced in this run. Review tests and runtime hotspots next.",
    };
  }
  return {
    tone: "positive",
    title: "Healthy run",
    summary: filtered
      ? "No failing nodes match the current dashboard filters."
      : "No failing nodes surfaced in the latest run.",
  };
}

function buildOverviewSummaryBits(
  analysis: AnalysisState,
  projectName: string | null,
): string[] {
  const startedAt = getInvocationTimestamp(analysis);
  return [
    projectName ?? "Workspace",
    `${analysis.graphSummary.totalNodes} graph nodes`,
    `${analysis.summary.total_nodes} executions`,
    analysis.invocationId != null
      ? `invocation ${analysis.invocationId}`
      : null,
    startedAt != null
      ? `invocation started ${formatRunStartedAt(startedAt)}`
      : null,
  ].filter((value): value is string => Boolean(value));
}

function buildOverviewBannerModel(
  analysis: AnalysisState,
  projectName: string | null,
  analysisSource: WorkspaceArtifactSource | null,
  derived: OverviewDerivedState,
  filtered: boolean,
) {
  const mainProjectResources = analysis.resources.filter((resource) =>
    isMainProjectResource(resource, projectName),
  );
  const mainProjectExecutions = analysis.executions.filter((row) =>
    isMainProjectResource(row, projectName),
  );
  const groupedResources = groupResourcesByType(mainProjectResources);
  const groupedExecutions = groupExecutionsByType(mainProjectExecutions);

  const runtimeChip: OverviewSummaryChip = {
    label: "Run time",
    value: filtered
      ? formatSeconds(derived.filteredExecutionTime)
      : formatSeconds(analysis.summary.total_execution_time),
  };

  const adapterTotals = analysis.adapterTotals;
  const adapterChip: OverviewSummaryChip | null =
    adapterTotals != null ? buildAdapterSummaryChip(adapterTotals) : null;

  const resourceChips = PRIMARY_PROJECT_SUMMARY_GROUPS.map(({ key, label }) => {
    return buildResourceSummaryChip(
      label,
      groupedResources.get(key) ?? [],
      groupedExecutions.get(key) ?? [],
    );
  }).filter((value): value is OverviewSummaryChip => value != null);

  const { tone, title, summary } = overviewBannerHeadline(derived, filtered);

  return {
    tone,
    title,
    summary,
    sourceLabel: sourceBadgeLabel(analysisSource),
    summaryBits: buildOverviewSummaryBits(analysis, projectName),
    chips: [
      runtimeChip,
      ...(adapterChip != null ? [adapterChip] : []),
      ...resourceChips,
    ],
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
  analysisSource: WorkspaceArtifactSource | null;
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
