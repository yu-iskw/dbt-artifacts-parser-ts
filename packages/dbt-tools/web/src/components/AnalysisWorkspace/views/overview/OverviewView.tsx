import type { Dispatch, SetStateAction } from "react";
import { useDeferredValue, useMemo } from "react";
import type { AnalysisState } from "@web/types";
import { TEST_RESOURCE_TYPES } from "@web/lib/analysis-workspace/constants";
import type { OverviewFilterState } from "@web/lib/analysis-workspace/types";
import { buildOverviewDerivedState } from "@web/lib/analysis-workspace/overviewState";
import { hasOverviewFilters } from "@web/lib/analysis-workspace/utils";
import { EmptyState } from "../../../EmptyState";
import { OverviewStatusBanner } from "./OverviewBanner";
import {
  OverviewActionListCard,
  OverviewAttentionCard,
  OverviewCoverageCard,
  OverviewCriticalPathCard,
} from "./OverviewCards";
import { StatusDonutWithData } from "./OverviewDonuts";
import { OverviewFilterBar } from "./OverviewFilterBar";
import { GraphCompositionCard } from "./GraphCompositionCard";
import { OverviewExecutionContextBand } from "./OverviewExecutionContextBand";
import { OverviewPanel, OverviewScopeBadge } from "./OverviewPanel";

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
          <OverviewExecutionContextBand
            derived={derived}
            analysis={analysis}
            workerThreadCount={workerThreadCount}
            modelsCount={modelsCount}
            testsCount={testsCount}
          />
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
