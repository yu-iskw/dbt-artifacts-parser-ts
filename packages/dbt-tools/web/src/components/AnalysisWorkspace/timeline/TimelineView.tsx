import {
  type Dispatch,
  type SetStateAction,
  useDeferredValue,
  useMemo,
} from "react";
import { GanttChart } from "./GanttChart";
import { GanttLegend } from "./GanttLegend";
import { TIMELINE_BUNDLE_COUNT_WARNING } from "./gantt/constants";
import { isPositiveStatus } from "./gantt/formatting";
import type { AnalysisState, GanttItem } from "@web/types";
import type {
  InvestigationSelectionState,
  TimelineFilterState,
} from "@web/lib/analysis-workspace/types";
import { TEST_RESOURCE_TYPES } from "@web/lib/analysis-workspace/constants";
import {
  deriveProjectName,
  isDefaultTimelineResource,
} from "@web/lib/analysis-workspace/utils";
import { buildResourceTestStats } from "@web/lib/analysis-workspace/explorerTree";
import { SectionCard, WorkspaceScaffold } from "../shared";
import { TimelineSearchControls } from "../views/ResultsView";

function getDefaultTimelineActiveTypes(presentTypes: string[]): Set<string> {
  return new Set(
    presentTypes.filter(
      (type) => type !== "macro" && type !== "test" && type !== "unit_test",
    ),
  );
}

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
    ? stats.fail + stats.error > 0
    : childTests.some((t) => !isPositiveStatus(t.status));
  return !isPositiveStatus(item.status) || hasTestFail;
}

function TimelineSurface({
  analysis,
  filters,
  defaultActiveTypes,
  effectiveActiveTypes,
  filteredData,
  bundleRowCount,
  statusCounts,
  typeCounts,
  hasActiveFilters,
  testStatsById,
  setFilters,
  toggleStatus,
  toggleType,
  onInvestigationSelectionChange,
}: {
  analysis: AnalysisState;
  filters: TimelineFilterState;
  defaultActiveTypes: Set<string>;
  effectiveActiveTypes: Set<string>;
  filteredData: GanttItem[];
  bundleRowCount: number;
  statusCounts: Record<string, number>;
  typeCounts: Record<string, number>;
  hasActiveFilters: boolean;
  testStatsById: ReturnType<typeof buildResourceTestStats>;
  setFilters: Dispatch<SetStateAction<TimelineFilterState>>;
  toggleStatus: (status: string) => void;
  toggleType: (type: string) => void;
  onInvestigationSelectionChange: Dispatch<
    SetStateAction<InvestigationSelectionState>
  >;
}) {
  return (
    <SectionCard
      title="Execution timeline"
      subtitle="Relative start and duration for each executed node."
    >
      <GanttLegend
        statusCounts={statusCounts}
        typeCounts={typeCounts}
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
        showTimelineDependents={filters.showTimelineDependents}
        onToggleShowTimelineDependents={() =>
          setFilters((c) => ({
            ...c,
            showTimelineDependents: !c.showTimelineDependents,
          }))
        }
      />
      <TimelineSearchControls
        filters={filters}
        defaultActiveTypes={defaultActiveTypes}
        hasActiveFilters={hasActiveFilters}
        setFilters={setFilters}
      />
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
        showDependents={filters.showTimelineDependents}
        selectedId={filters.selectedExecutionId}
        onSelect={(id) => {
          setFilters((current) => ({ ...current, selectedExecutionId: id }));
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

  // Filter parent (non-test) items
  const filteredParents: GanttItem[] = useMemo(
    () =>
      analysis.ganttData.filter((item) => {
        // Exclude test resources from parent list — they appear as chips
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

  // Include test items whose parent is in the visible parent set
  const parentIdSet = useMemo(
    () => new Set(filteredParents.map((i) => i.unique_id)),
    [filteredParents],
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
    () => [...filteredParents, ...filteredTests],
    [filteredParents, filteredTests],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of analysis.ganttData.filter((entry) =>
      isDefaultTimelineResource(entry, projectName),
    )) {
      const status = item.status.toLowerCase();
      counts[status] = (counts[status] ?? 0) + 1;
    }
    return counts;
  }, [analysis.ganttData, projectName]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of analysis.ganttData.filter((entry) =>
      isDefaultTimelineResource(entry, projectName),
    )) {
      counts[item.resourceType] = (counts[item.resourceType] ?? 0) + 1;
    }
    return counts;
  }, [analysis.ganttData, projectName]);

  const hasTypeOverride = !setsEqual(effectiveActiveTypes, defaultActiveTypes);
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
        defaultActiveTypes={defaultActiveTypes}
        effectiveActiveTypes={effectiveActiveTypes}
        filteredData={filteredData}
        bundleRowCount={filteredParents.length}
        statusCounts={statusCounts}
        typeCounts={typeCounts}
        hasActiveFilters={hasActiveFilters}
        testStatsById={testStatsById}
        setFilters={setFilters}
        toggleStatus={toggleStatus}
        toggleType={toggleType}
        onInvestigationSelectionChange={onInvestigationSelectionChange}
      />
    </WorkspaceScaffold>
  );
}
