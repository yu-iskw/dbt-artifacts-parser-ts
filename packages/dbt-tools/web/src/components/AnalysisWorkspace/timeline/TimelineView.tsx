import {
  type Dispatch,
  type SetStateAction,
  useDeferredValue,
  useMemo,
} from "react";
import { GanttChart } from "./GanttChart";
import { GanttLegend } from "./GanttLegend";
import { TimelineDependencyControls } from "./TimelineDependencyControls";
import { TIMELINE_BUNDLE_COUNT_WARNING } from "./gantt/constants";
import { formatMs, isPositiveStatus } from "./gantt/formatting";
import {
  type TimelineNeighborhoodUi,
  useTimelineNeighborhoodRows,
} from "./useTimelineNeighborhoodRows";
import type { AnalysisState, GanttItem } from "@web/types";
import type {
  InvestigationSelectionState,
  TimelineFilterState,
} from "@web/lib/analysis-workspace/types";
import { TEST_RESOURCE_TYPES } from "@web/lib/analysis-workspace/constants";
import {
  countTimelineTestResources,
  deriveProjectName,
  getDefaultTimelineActiveTypes,
  isDefaultTimelineResource,
  timelineGanttHasCompileExecutePhases,
} from "@web/lib/analysis-workspace/utils";
import { buildResourceTestStats } from "@web/lib/analysis-workspace/explorerTree";
import { SectionCard, WorkspaceScaffold } from "../shared";
import {
  TimelineSearchControls,
  type TimelineTypeFilterHint,
} from "./TimelineSearchControls";

function setsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

function parentHasFailureSignal(
  item: GanttItem,
  childTests: GanttItem[],
  testStatsById: ReturnType<typeof buildResourceTestStats>,
): boolean {
  const stats = testStatsById.get(item.unique_id);
  const hasTestFail = stats
    ? stats.error + stats.warn > 0
    : childTests.some((t) => !isPositiveStatus(t.status));
  return !isPositiveStatus(item.status) || hasTestFail;
}

function TimelineSurface({
  analysis,
  filters,
  effectiveActiveTypes,
  filteredData,
  bundleRowCount,
  neighborhoodUi,
  statusCounts,
  typeCounts,
  materializationCounts,
  testsLegendCount,
  hasActiveFilters,
  typeFilterHint,
  testStatsById,
  setFilters,
  toggleStatus,
  toggleType,
  onInvestigationSelectionChange,
}: {
  analysis: AnalysisState;
  filters: TimelineFilterState;
  effectiveActiveTypes: Set<string>;
  filteredData: GanttItem[];
  bundleRowCount: number;
  neighborhoodUi: TimelineNeighborhoodUi | null;
  statusCounts: Record<string, number>;
  typeCounts: Record<string, number>;
  materializationCounts: Record<string, number>;
  testsLegendCount: number;
  hasActiveFilters: boolean;
  typeFilterHint: TimelineTypeFilterHint | null;
  testStatsById: ReturnType<typeof buildResourceTestStats>;
  setFilters: Dispatch<SetStateAction<TimelineFilterState>>;
  toggleStatus: (status: string) => void;
  toggleType: (type: string) => void;
  onInvestigationSelectionChange: Dispatch<
    SetStateAction<InvestigationSelectionState>
  >;
}) {
  const showCompileExecuteLegend = useMemo(
    () => timelineGanttHasCompileExecutePhases(analysis.ganttData),
    [analysis.ganttData],
  );

  const { timeWindow } = filters;

  return (
    <SectionCard
      title="Execution timeline"
      subtitle="Relative start and duration for each executed node."
    >
      <GanttLegend
        statusCounts={statusCounts}
        typeCounts={typeCounts}
        testsLegendCount={testsLegendCount}
        materializationCounts={materializationCounts}
        activeStatuses={filters.activeStatuses}
        activeTypes={effectiveActiveTypes}
        onToggleStatus={toggleStatus}
        onToggleType={toggleType}
        showTests={filters.showTests}
        onToggleShowTests={() =>
          setFilters((c) => ({ ...c, showTests: !c.showTests }))
        }
        failuresOnly={filters.failuresOnly}
        onToggleFailuresOnly={() =>
          setFilters((c) => ({ ...c, failuresOnly: !c.failuresOnly }))
        }
        showCompileExecuteLegend={showCompileExecuteLegend}
      />
      <TimelineDependencyControls filters={filters} setFilters={setFilters} />
      <TimelineSearchControls
        filters={filters}
        hasActiveFilters={hasActiveFilters}
        typeFilterHint={typeFilterHint}
        setFilters={setFilters}
      />
      {timeWindow != null && (
        <p className="timeline-zoom-active" role="status">
          Zoomed to {formatMs(timeWindow.end - timeWindow.start)} window
          {" — "}
          <button
            type="button"
            className="timeline-zoom-clear"
            onClick={() => setFilters((c) => ({ ...c, timeWindow: null }))}
          >
            Clear zoom ×
          </button>
        </p>
      )}
      {neighborhoodUi != null && (
        <p className="timeline-neighborhood-active" role="status">
          {neighborhoodUi.mode === "narrowed" ? (
            <>
              Showing {neighborhoodUi.shown.toLocaleString()} of{" "}
              {neighborhoodUi.total.toLocaleString()} timeline rows (dependency
              neighborhood)
              {" — "}
              <button
                type="button"
                className="timeline-neighborhood-action"
                onClick={() =>
                  setFilters((c) => ({ ...c, neighborhoodRowsShowAll: true }))
                }
              >
                Show all rows
              </button>
            </>
          ) : (
            <>
              Showing all {neighborhoodUi.total.toLocaleString()} timeline rows
              {" — "}
              <button
                type="button"
                className="timeline-neighborhood-action"
                onClick={() =>
                  setFilters((c) => ({ ...c, neighborhoodRowsShowAll: false }))
                }
              >
                Neighborhood only (
                {neighborhoodUi.narrowedCount.toLocaleString()} rows)
              </button>
            </>
          )}
        </p>
      )}
      {bundleRowCount >= TIMELINE_BUNDLE_COUNT_WARNING ? (
        <p className="timeline-large-dataset-hint" role="status">
          Showing {bundleRowCount.toLocaleString()} timeline rows. Use search or
          type and status filters to narrow the list.
        </p>
      ) : null}
      <GanttChart
        data={filteredData}
        runStartedAt={analysis.runStartedAt}
        timelineAdjacency={analysis.timelineAdjacency}
        testStatsById={testStatsById}
        showTests={filters.showTests}
        dependencyDirection={filters.dependencyDirection}
        dependencyDepthHops={filters.dependencyDepthHops}
        selectedId={filters.selectedExecutionId}
        timeWindow={timeWindow}
        onTimeWindowChange={(tw) =>
          setFilters((c) => ({ ...c, timeWindow: tw }))
        }
        onSelect={(id) => {
          setFilters((current) => {
            const selCleared = id == null;
            const selChanged = id !== current.selectedExecutionId;
            const neighborhoodRowsShowAll = selCleared
              ? false
              : selChanged
                ? false
                : current.neighborhoodRowsShowAll;
            return {
              ...current,
              selectedExecutionId: id,
              neighborhoodRowsShowAll,
            };
          });
          onInvestigationSelectionChange((current) => ({
            ...current,
            selectedExecutionId: id,
            selectedResourceId:
              id == null
                ? current.selectedResourceId
                : (analysis.resources.find(
                    (resource) => resource.uniqueId === id,
                  )?.uniqueId ?? current.selectedResourceId),
            sourceLens: "timeline",
          }));
        }}
      />
    </SectionCard>
  );
}

export function TimelineView({
  analysis,
  filters,
  setFilters,
  onInvestigationSelectionChange,
}: {
  analysis: AnalysisState;
  filters: TimelineFilterState;
  setFilters: Dispatch<SetStateAction<TimelineFilterState>>;
  onInvestigationSelectionChange: Dispatch<
    SetStateAction<InvestigationSelectionState>
  >;
}) {
  const deferredQuery = useDeferredValue(filters.query);
  const projectName =
    analysis.projectName ?? deriveProjectName(analysis.executions);

  const presentTypes = useMemo(
    () =>
      Array.from(
        new Set(
          analysis.ganttData
            .filter((d) => isDefaultTimelineResource(d, projectName))
            .map((d) => d.resourceType)
            .filter((t): t is string => Boolean(t)),
        ),
      ).sort(),
    [analysis.ganttData, projectName],
  );
  const defaultActiveTypes = useMemo(
    () => getDefaultTimelineActiveTypes(presentTypes),
    [presentTypes],
  );
  const effectiveActiveTypes =
    filters.activeTypes.size > 0 ? filters.activeTypes : defaultActiveTypes;

  function toggleStatus(status: string) {
    setFilters((current) => {
      const next = new Set(current.activeStatuses);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return { ...current, activeStatuses: next };
    });
  }

  function toggleType(type: string) {
    setFilters((current) => {
      const next = new Set(
        current.activeTypes.size > 0 ? current.activeTypes : defaultActiveTypes,
      );
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return { ...current, activeTypes: next };
    });
  }

  const testStatsById = useMemo(
    () => buildResourceTestStats(analysis.resources, analysis.dependencyIndex),
    [analysis.dependencyIndex, analysis.resources],
  );

  const testsByParentId = useMemo(() => {
    const m = new Map<string, GanttItem[]>();
    for (const item of analysis.ganttData) {
      if (
        !TEST_RESOURCE_TYPES.has(item.resourceType) ||
        item.parentId == null
      ) {
        continue;
      }
      const list = m.get(item.parentId) ?? [];
      list.push(item);
      m.set(item.parentId, list);
    }
    return m;
  }, [analysis.ganttData]);

  const filteredParents: GanttItem[] = useMemo(
    () =>
      analysis.ganttData.filter((item) => {
        if (TEST_RESOURCE_TYPES.has(item.resourceType)) return false;

        if (
          filters.activeTypes.size === 0 &&
          !isDefaultTimelineResource(item, projectName)
        ) {
          return false;
        }
        if (
          filters.activeStatuses.size > 0 &&
          !filters.activeStatuses.has(item.status.toLowerCase())
        ) {
          return false;
        }
        if (
          effectiveActiveTypes.size > 0 &&
          !effectiveActiveTypes.has(item.resourceType ?? "")
        ) {
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
        if (filters.failuresOnly) {
          const childTests = testsByParentId.get(item.unique_id) ?? [];
          if (!parentHasFailureSignal(item, childTests, testStatsById)) {
            return false;
          }
        }
        return true;
      }),
    [
      analysis.ganttData,
      deferredQuery,
      effectiveActiveTypes,
      filters.activeStatuses,
      filters.failuresOnly,
      filters.activeTypes.size,
      projectName,
      testStatsById,
      testsByParentId,
    ],
  );

  const { displayedParents, neighborhoodUi } = useTimelineNeighborhoodRows(
    analysis,
    filters,
    filteredParents,
  );

  const parentIdSet = useMemo(
    () => new Set(displayedParents.map((i) => i.unique_id)),
    [displayedParents],
  );

  const filteredTests: GanttItem[] = useMemo(
    () =>
      filters.showTests
        ? analysis.ganttData.filter(
            (item) =>
              TEST_RESOURCE_TYPES.has(item.resourceType) &&
              item.parentId != null &&
              parentIdSet.has(item.parentId),
          )
        : [],
    [analysis.ganttData, filters.showTests, parentIdSet],
  );

  const filteredData: GanttItem[] = useMemo(
    () => [...displayedParents, ...filteredTests],
    [displayedParents, filteredTests],
  );

  const materializationCounts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const item of filteredData) {
      const k = item.semantics?.materialization ?? "unknown";
      acc[k] = (acc[k] ?? 0) + 1;
    }
    return acc;
  }, [filteredData]);

  const { statusCounts, typeCounts } = useMemo(() => {
    const nextStatus: Record<string, number> = {};
    const nextType: Record<string, number> = {};
    for (const item of analysis.ganttData) {
      if (!isDefaultTimelineResource(item, projectName)) continue;
      const status = item.status.toLowerCase();
      nextStatus[status] = (nextStatus[status] ?? 0) + 1;
      const rt = item.resourceType;
      nextType[rt] = (nextType[rt] ?? 0) + 1;
    }
    return { statusCounts: nextStatus, typeCounts: nextType };
  }, [analysis.ganttData, projectName]);

  const testsLegendCount = useMemo(
    () => countTimelineTestResources(analysis.ganttData, projectName),
    [analysis.ganttData, projectName],
  );

  const hasTypeOverride = !setsEqual(effectiveActiveTypes, defaultActiveTypes);
  const typeFilterHint = useMemo(() => {
    if (!hasTypeOverride) return null;

    const shown = [...effectiveActiveTypes]
      .filter((type) => defaultActiveTypes.has(type))
      .sort();
    const hidden = [...defaultActiveTypes]
      .filter((type) => !effectiveActiveTypes.has(type))
      .sort()
      .map((type) => ({
        type,
        count: typeCounts[type] ?? 0,
      }));

    if (hidden.length === 0) return null;

    return { shown, hidden };
  }, [defaultActiveTypes, effectiveActiveTypes, hasTypeOverride, typeCounts]);
  const hasActiveFilters =
    filters.activeStatuses.size > 0 ||
    hasTypeOverride ||
    filters.query.length > 0;

  return (
    <WorkspaceScaffold
      title="Timeline"
      description="Runtime timing, concurrency, bottlenecks, and execution order."
      className="timeline-view"
    >
      <TimelineSurface
        analysis={analysis}
        filters={filters}
        effectiveActiveTypes={effectiveActiveTypes}
        filteredData={filteredData}
        bundleRowCount={displayedParents.length}
        neighborhoodUi={neighborhoodUi}
        statusCounts={statusCounts}
        typeCounts={typeCounts}
        materializationCounts={materializationCounts}
        testsLegendCount={testsLegendCount}
        hasActiveFilters={hasActiveFilters}
        typeFilterHint={typeFilterHint}
        testStatsById={testStatsById}
        setFilters={setFilters}
        toggleStatus={toggleStatus}
        toggleType={toggleType}
        onInvestigationSelectionChange={onInvestigationSelectionChange}
      />
    </WorkspaceScaffold>
  );
}
