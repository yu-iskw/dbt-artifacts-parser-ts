import {
  type Dispatch,
  type SetStateAction,
  useDeferredValue,
  useMemo,
} from "react";
import { GanttChart } from "./GanttChart";
import { GanttLegend } from "./GanttLegend";
import type { AnalysisState, GanttItem } from "@web/types";
import type {
  InvestigationSelectionState,
  TimelineFilterState,
} from "@web/lib/analysis-workspace/types";
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

function TimelineSurface({
  analysis,
  filters,
  defaultActiveTypes,
  effectiveActiveTypes,
  filteredData,
  statusCounts,
  typeCounts,
  hasActiveFilters,
  dataIndexById,
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
  statusCounts: Record<string, number>;
  typeCounts: Record<string, number>;
  hasActiveFilters: boolean;
  dataIndexById: Map<string, number>;
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
      />
      <TimelineSearchControls
        filters={filters}
        defaultActiveTypes={defaultActiveTypes}
        hasActiveFilters={hasActiveFilters}
        setFilters={setFilters}
      />
      <GanttChart
        data={filteredData}
        runStartedAt={analysis.runStartedAt}
        dataIndexById={dataIndexById}
        dependencyIndex={analysis.dependencyIndex}
        testStatsById={testStatsById}
        selectedId={filters.selectedExecutionId}
        onSelect={(id) => {
          setFilters((current) => ({ ...current, selectedExecutionId: id }));
          onInvestigationSelectionChange((current) => ({
            ...current,
            selectedExecutionId: id,
            selectedResourceId:
              analysis.resources.find((resource) => resource.uniqueId === id)
                ?.uniqueId ?? current.selectedResourceId,
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

  const filteredData: GanttItem[] = useMemo(
    () =>
      analysis.ganttData.filter((item) => {
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
        return true;
      }),
    [
      analysis.ganttData,
      deferredQuery,
      effectiveActiveTypes,
      filters.activeStatuses,
      filters.activeTypes.size,
      projectName,
    ],
  );

  const dataIndexById = useMemo(
    () => new Map(filteredData.map((item, i) => [item.unique_id, i])),
    [filteredData],
  );
  const testStatsById = useMemo(
    () => buildResourceTestStats(analysis.resources, analysis.dependencyIndex),
    [analysis.dependencyIndex, analysis.resources],
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
        statusCounts={statusCounts}
        typeCounts={typeCounts}
        hasActiveFilters={hasActiveFilters}
        dataIndexById={dataIndexById}
        testStatsById={testStatsById}
        setFilters={setFilters}
        toggleStatus={toggleStatus}
        toggleType={toggleType}
        onInvestigationSelectionChange={onInvestigationSelectionChange}
      />
    </WorkspaceScaffold>
  );
}
