import type { AnalysisState, StatusTone } from "@web/types";
import type { OverviewDerivedState } from "@web/lib/analysis-workspace/overviewState";
import type {
  AssetTab,
  WorkspaceView,
} from "@web/lib/analysis-workspace/types";
import { formatSeconds } from "@web/lib/analysis-workspace/utils";
import { EmptyState } from "../../../EmptyState";
import { OverviewScopeBadge } from "./OverviewPanel";

export function OverviewAttentionCard({
  derived,
  onNavigateTo,
}: {
  derived: OverviewDerivedState;
  onNavigateTo?: (view: WorkspaceView) => void;
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
      {onNavigateTo && (
        <div className="overview-module__footer">
          <button
            type="button"
            className="overview-module__cta"
            onClick={() => onNavigateTo("runs")}
          >
            Open Runs →
          </button>
        </div>
      )}
    </section>
  );
}

export function OverviewActionListCard({
  derived,
  title = "Bottlenecks",
  subtitle = "Longest-running nodes in the filtered execution slice.",
  embedded = false,
  onNavigateTo,
}: {
  derived: OverviewDerivedState;
  title?: string;
  subtitle?: string;
  embedded?: boolean;
  onNavigateTo?: (view: WorkspaceView) => void;
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
      {onNavigateTo && !embedded && (
        <div className="overview-module__footer">
          <button
            type="button"
            className="overview-module__cta"
            onClick={() => onNavigateTo("timeline")}
          >
            Open Timeline →
          </button>
        </div>
      )}
    </section>
  );
}

export function OverviewCriticalPathCard({
  analysis,
  filtered,
  onNavigateTo,
}: {
  analysis: AnalysisState;
  filtered: boolean;
  onNavigateTo?: (
    view: WorkspaceView,
    options?: { assetTab?: AssetTab },
  ) => void;
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
      {onNavigateTo && (
        <div className="overview-module__footer">
          <button
            type="button"
            className="overview-module__cta"
            onClick={() => onNavigateTo("inventory", { assetTab: "lineage" })}
          >
            Open Lineage →
          </button>
        </div>
      )}
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
