import type { Dispatch, SetStateAction } from "react";
import { useDeferredValue, useMemo } from "react";
import type { AnalysisState } from "@web/types";
import { TEST_RESOURCE_TYPES } from "@web/lib/analysis-workspace/constants";
import type {
  AssetTab,
  OverviewFilterState,
  WorkspaceSignal,
  WorkspaceView,
} from "@web/lib/analysis-workspace/types";
import { buildOverviewDerivedState } from "@web/lib/analysis-workspace/overviewState";
import { hasOverviewFilters } from "@web/lib/analysis-workspace/utils";
import { EmptyState } from "../../EmptyState";
import { RunSummaryStrip } from "./overview/OverviewBanner";
import {
  OverviewActionListCard,
  OverviewAttentionCard,
  OverviewCoverageCard,
  OverviewCriticalPathCard,
} from "./overview/OverviewCards";
import { StatusDonutWithData } from "./overview/OverviewDonuts";
import { OverviewFilterBar } from "./overview/OverviewFilterBar";
import { GraphCompositionCard } from "./overview/GraphCompositionCard";
import { OverviewExecutionContextBand } from "./overview/OverviewExecutionContextBand";

/**
 * Health — four-band triage-first layout.
 *
 *   Band 1 — Compact lens header    (title, desc)
 *   Band 2 — Run summary strip      (posture, runtime, source, per-type counts)
 *   Band 3 — Triage band            (Attention | Bottlenecks | Critical path)
 *                                    each with embedded contextual navigation CTAs
 *   Band 4 — Supporting evidence    (filters → execution breakdown → context → structure)
 *
 * Navigation strategy: contextual "Open X" actions live inside the module that
 * motivates that drilldown. No standalone quick-nav button rows.
 */
export function HealthView({
  analysis,
  projectName,
  analysisSource,
  filters,
  setFilters,
  workspaceSignals: _workspaceSignals,
  onNavigateTo,
}: {
  analysis: AnalysisState;
  projectName: string | null;
  analysisSource: "preload" | "upload" | null;
  filters: OverviewFilterState;
  setFilters: Dispatch<SetStateAction<OverviewFilterState>>;
  workspaceSignals: WorkspaceSignal[];
  onNavigateTo: (
    view: WorkspaceView,
    options?: {
      resourceId?: string;
      executionId?: string;
      rootResourceId?: string;
      assetTab?: AssetTab;
    },
  ) => void;
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
    <div className="workspace-view health-view">
      {/* ── Band 1: Compact lens header ── */}
      <div className="lens-header">
        <div className="lens-header__title">
          <h2>Health</h2>
          <p className="lens-header__desc">
            Run posture, critical issues, and dependency pressure at a glance.
          </p>
        </div>
        {filtered && <span className="lens-header__badge">Filtered view</span>}
      </div>

      {/* ── Band 2: Run summary strip ── */}
      <RunSummaryStrip
        analysis={analysis}
        projectName={projectName}
        analysisSource={analysisSource}
        derived={derived}
        filtered={filtered}
      />

      {/* ── Band 3: Triage band — the primary decision row ── */}
      <section className="health-grid" aria-label="Run triage">
        <div className="health-grid__col health-grid__col--attention">
          <OverviewAttentionCard
            derived={derived}
            onNavigateTo={onNavigateTo}
          />
        </div>
        <div className="health-grid__col health-grid__col--bottlenecks">
          <OverviewActionListCard
            derived={derived}
            onNavigateTo={onNavigateTo}
          />
        </div>
        <div className="health-grid__col health-grid__col--critical">
          <OverviewCriticalPathCard
            analysis={analysis}
            filtered={filtered}
            onNavigateTo={onNavigateTo}
          />
        </div>
      </section>

      {/* ── Band 4: Supporting evidence ── */}

      {/* 4a — Filter controls */}
      <section className="health-section health-section--filters">
        <OverviewFilterBar
          filters={filters}
          setFilters={setFilters}
          availableTypes={availableTypes}
          resultCount={derived.filteredExecutions.length}
        />
      </section>

      {/* 4b — Execution breakdown */}
      <section className="health-section health-section--execution">
        <div className="health-section__header">
          <h3>Execution breakdown</h3>
          <p>Status distribution across the filtered execution slice.</p>
        </div>
        {derived.filteredExecutions.length > 0 ? (
          <StatusDonutWithData
            statusBreakdown={derived.filteredStatusBreakdown}
            executions={derived.filteredExecutions}
          />
        ) : (
          <EmptyState
            icon="◌"
            headline="No matching executions"
            subtext="Try clearing the dashboard filters or broadening your search."
          />
        )}
      </section>

      {/* 4c — Execution context */}
      <section className="health-section health-section--context">
        <div className="health-section__header">
          <h3>Execution context</h3>
          <p>Worker pressure and run footprint for the current slice.</p>
        </div>
        <OverviewExecutionContextBand
          derived={derived}
          analysis={analysis}
          workerThreadCount={workerThreadCount}
          modelsCount={modelsCount}
          testsCount={testsCount}
        />
      </section>

      {/* 4d — Structural health */}
      <section className="health-section health-section--structure">
        <div className="health-section__header">
          <h3>Structural health</h3>
          <p>Coverage and graph shape across the workspace.</p>
        </div>
        <div className="health-structure-band">
          <OverviewCoverageCard analysis={analysis} filtered={filtered} />
          <div className="health-structure-composition">
            <div className="overview-module__header">
              <h3>Graph composition</h3>
              <p>Node type breakdown in the manifest graph.</p>
            </div>
            <GraphCompositionCard graphSummary={analysis.graphSummary} />
          </div>
        </div>
      </section>
    </div>
  );
}
