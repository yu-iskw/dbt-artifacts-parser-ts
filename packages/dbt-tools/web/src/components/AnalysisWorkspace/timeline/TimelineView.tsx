import {
  type Dispatch,
  type SetStateAction,
  useDeferredValue,
  useMemo,
} from "react";
import { GanttChart } from "./GanttChart";
import { GanttLegend } from "./GanttLegend";
import type { AnalysisState, GanttItem } from "@web/types";
import type { TimelineFilterState } from "@web/lib/analysis-workspace/types";
import { buildOverviewDerivedState } from "@web/lib/analysis-workspace/overviewState";
import {
  deriveProjectName,
  isDefaultTimelineResource,
  isDefaultTimelineExecution,
} from "@web/lib/analysis-workspace/utils";
import { SectionCard } from "../shared";
import { OverviewActionListCard } from "../views/OverviewView";
import { TimelineSearchControls } from "../views/ResultsView";

function getDefaultTimelineActiveTypes(presentTypes: string[]): Set<string> {
  // Exclude macros and test types from the default view
  const preferredTypes = presentTypes.filter(
    (type) => type !== "macro" && type !== "test" && type !== "unit_test",
  );
  return new Set(preferredTypes);
}

function setsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

/** Self-contained timeline view with status + resource-type + name filters. */
export function TimelineView({
  analysis,
  filters,
  setFilters,
}: {
  analysis: AnalysisState;
  filters: TimelineFilterState;
  setFilters: Dispatch<SetStateAction<TimelineFilterState>>;
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
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return { ...current, activeStatuses: next };
    });
  }

  function toggleType(type: string) {
    setFilters((current) => {
      const next = new Set(
        current.activeTypes.size > 0 ? current.activeTypes : defaultActiveTypes,
      );
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
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
      filters.activeStatuses,
      filters.activeTypes,
      deferredQuery,
      effectiveActiveTypes,
      projectName,
    ],
  );

  const filteredExecutionRows = useMemo(
    () =>
      analysis.executions.filter((row) => {
        if (
          filters.activeTypes.size === 0 &&
          !isDefaultTimelineExecution(row, projectName)
        ) {
          return false;
        }
        if (
          filters.activeStatuses.size > 0 &&
          !filters.activeStatuses.has(row.status.toLowerCase())
        ) {
          return false;
        }
        if (
          effectiveActiveTypes.size > 0 &&
          !effectiveActiveTypes.has(row.resourceType)
        ) {
          return false;
        }
        if (deferredQuery) {
          const q = deferredQuery.trim().toLowerCase();
          if (
            q &&
            !row.name.toLowerCase().includes(q) &&
            !row.uniqueId.toLowerCase().includes(q)
          ) {
            return false;
          }
        }
        return true;
      }),
    [
      analysis.executions,
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

  // Counts per status/type (unfiltered) — shared by legend and filter pills.
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of analysis.ganttData.filter((entry) =>
      isDefaultTimelineResource(entry, projectName),
    )) {
      const s = item.status.toLowerCase();
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  }, [analysis.ganttData, projectName]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of analysis.ganttData.filter((entry) =>
      isDefaultTimelineResource(entry, projectName),
    )) {
      if (item.resourceType) {
        counts[item.resourceType] = (counts[item.resourceType] ?? 0) + 1;
      }
    }
    return counts;
  }, [analysis.ganttData, projectName]);

  const hasTypeOverride = !setsEqual(effectiveActiveTypes, defaultActiveTypes);
  const hasActiveFilters =
    filters.activeStatuses.size > 0 ||
    hasTypeOverride ||
    filters.query.length > 0;
  return (
    <div className="workspace-view">
      <SectionCard
        title="Execution timeline"
        subtitle="Relative start and duration for each executed node."
      >
        <OverviewActionListCard
          derived={{
            ...buildOverviewDerivedState(analysis, {
              status: "all",
              resourceTypes: new Set(),
              query: "",
            }),
            filteredExecutions: filteredExecutionRows,
            filteredExecutionTime: filteredExecutionRows.reduce(
              (sum, row) => sum + row.executionTime,
              0,
            ),
            topBottlenecks: [...filteredExecutionRows]
              .sort((a, b) => b.executionTime - a.executionTime)
              .slice(0, 5),
          }}
          title="Bottlenecks"
          subtitle="Independent runtime hotspots in the current timeline slice."
        />

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
        />
      </SectionCard>
    </div>
  );
}
