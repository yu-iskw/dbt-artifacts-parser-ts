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
  WorkspaceView,
} from "@web/lib/analysis-workspace/types";
import { buildOverviewDerivedState } from "@web/lib/analysis-workspace/overviewState";
import {
  deriveProjectName,
  formatSeconds,
  isDefaultTimelineExecution,
  isDefaultTimelineResource,
} from "@web/lib/analysis-workspace/utils";
import { buildResourceTestStats } from "@web/lib/analysis-workspace/explorerTree";
import { EntityInspector, SectionCard, WorkspaceScaffold } from "../shared";
import { OverviewActionListCard } from "../views/OverviewView";
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

export function TimelineView({
  analysis,
  filters,
  setFilters,
  onInvestigationSelectionChange,
  onNavigateTo,
}: {
  analysis: AnalysisState;
  filters: TimelineFilterState;
  setFilters: Dispatch<SetStateAction<TimelineFilterState>>;
  onInvestigationSelectionChange: Dispatch<
    SetStateAction<InvestigationSelectionState>
  >;
  onNavigateTo: (
    view: WorkspaceView,
    options?: {
      resourceId?: string;
      executionId?: string;
      assetTab?: "summary" | "lineage" | "sql" | "runtime" | "tests";
      rootResourceId?: string;
    },
  ) => void;
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

  const selectedRow =
    filteredExecutionRows.find(
      (row) => row.uniqueId === filters.selectedExecutionId,
    ) ??
    analysis.executions.find(
      (row) => row.uniqueId === filters.selectedExecutionId,
    ) ??
    null;
  const relatedResource =
    selectedRow != null
      ? (analysis.resources.find(
          (resource) => resource.uniqueId === selectedRow.uniqueId,
        ) ?? null)
      : null;

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

  const inspector = (
    <EntityInspector
      title={selectedRow?.name ?? null}
      typeLabel={selectedRow?.resourceType ?? null}
      status={
        selectedRow ? (
          <span className={`badge badge--${selectedRow.statusTone}`}>
            {selectedRow.status}
          </span>
        ) : undefined
      }
      stats={[
        {
          label: "Duration",
          value: selectedRow ? formatSeconds(selectedRow.executionTime) : "n/a",
        },
        { label: "Thread", value: selectedRow?.threadId ?? "n/a" },
        {
          label: "Start",
          value:
            selectedRow?.start != null
              ? `${selectedRow.start.toFixed(2)}s`
              : "n/a",
        },
      ]}
      sections={[
        { label: "Path", value: selectedRow?.path ?? "n/a" },
        { label: "Unique ID", value: selectedRow?.uniqueId ?? "n/a" },
      ]}
      actions={
        selectedRow
          ? [
              {
                label: "Open asset",
                onClick: () =>
                  onNavigateTo("inventory", {
                    resourceId:
                      relatedResource?.uniqueId ?? selectedRow.uniqueId,
                    assetTab: "summary",
                  }),
                disabled: !relatedResource,
              },
              {
                label: "Open in Runs",
                onClick: () =>
                  onNavigateTo("runs", {
                    resourceId:
                      relatedResource?.uniqueId ?? selectedRow.uniqueId,
                    executionId: selectedRow.uniqueId,
                  }),
              },
              {
                label: "Open in Lineage",
                onClick: () =>
                  onNavigateTo("lineage", {
                    resourceId:
                      relatedResource?.uniqueId ?? selectedRow.uniqueId,
                    rootResourceId:
                      relatedResource?.uniqueId ?? selectedRow.uniqueId,
                  }),
                disabled: !relatedResource,
              },
            ]
          : undefined
      }
      emptyMessage="Select a node to inspect runtime evidence"
    />
  );

  return (
    <WorkspaceScaffold
      title="Timeline"
      description="Runtime timing, concurrency, bottlenecks, and execution order."
      inspector={inspector}
      className="timeline-view"
    >
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
    </WorkspaceScaffold>
  );
}
