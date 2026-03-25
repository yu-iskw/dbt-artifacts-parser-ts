import type { Dispatch, SetStateAction } from "react";
import { useDeferredValue, useMemo } from "react";
import type { AnalysisState } from "@web/types";
import { TEST_RESOURCE_TYPES } from "@web/lib/analysis-workspace/constants";
import type {
  OverviewFilterState,
  WorkspaceSignal,
  WorkspaceView,
} from "@web/lib/analysis-workspace/types";
import { buildOverviewDerivedState } from "@web/lib/analysis-workspace/overviewState";
import { hasOverviewFilters } from "@web/lib/analysis-workspace/utils";
import { EmptyState } from "../../EmptyState";
import { OverviewStatusBanner } from "./overview/OverviewBanner";
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
 * Health — the primary "what needs attention now?" lens.
 *
 * This replaces the old Overview page with a cleaner information hierarchy:
 *   1. Hero strip   — workspace-level posture signals (moved from App shell)
 *   2. Run status   — banner with health title and filter controls
 *   3. Primary grid — Attention | Bottlenecks | Critical Path
 *   4. Status chart — execution donut (supporting context)
 *   5. Structural   — Coverage + graph composition (passive/bottom)
 */
export function HealthView({
  analysis,
  projectName,
  analysisSource,
  filters,
  setFilters,
  workspaceSignals,
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
      {/* ── Layer B: Lens header ── */}
      <div className="lens-header">
        <div className="lens-header__title">
          <p className="eyebrow">Workspace lens</p>
          <h2>Health</h2>
          <p className="lens-header__desc">
            Run posture, critical issues, and dependency pressure at a glance.
          </p>
        </div>
        {filtered && <span className="lens-header__badge">Filtered view</span>}
      </div>

      {/* ── Hero strip: workspace-level signals ── */}
      {workspaceSignals.length > 0 && (
        <section className="health-hero-strip" aria-label="Workspace signals">
          {workspaceSignals.map((signal) => (
            <article
              key={signal.label}
              className={`signal-card signal-card--${signal.tone}`}
            >
              <p className="signal-card__label">{signal.label}</p>
              <strong>{signal.value}</strong>
              <span>{signal.detail}</span>
            </article>
          ))}
        </section>
      )}

      {/* ── Run status banner + filters ── */}
      <section className="health-section health-section--status">
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
      </section>

      {/* ── Primary 3-column triage grid ── */}
      <section className="health-grid" aria-label="Run triage">
        <div className="health-grid__col health-grid__col--attention">
          <OverviewAttentionCard derived={derived} />
        </div>
        <div className="health-grid__col health-grid__col--bottlenecks">
          <OverviewActionListCard derived={derived} />
        </div>
        <div className="health-grid__col health-grid__col--critical">
          <OverviewCriticalPathCard analysis={analysis} filtered={filtered} />
        </div>
      </section>

      <section className="health-section health-section--actions">
        <div className="workspace-pill-row">
          <button
            type="button"
            className="workspace-pill"
            onClick={() => onNavigateTo("runs")}
          >
            Open Runs
          </button>
          <button
            type="button"
            className="workspace-pill"
            onClick={() => onNavigateTo("timeline")}
          >
            Open Timeline
          </button>
          <button
            type="button"
            className="workspace-pill"
            onClick={() => onNavigateTo("inventory")}
          >
            Browse Inventory
          </button>
          <button
            type="button"
            className="workspace-pill"
            onClick={() => onNavigateTo("lineage")}
          >
            Open Lineage
          </button>
        </div>
      </section>

      {/* ── Execution donut (supporting context) ── */}
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

      {/* ── Execution context band ── */}
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

      {/* ── Structural health (passive, bottom band) ── */}
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
