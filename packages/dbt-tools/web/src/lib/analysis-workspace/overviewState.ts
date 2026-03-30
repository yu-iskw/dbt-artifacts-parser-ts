import type {
  AnalysisState,
  ExecutionRow,
  StatusBreakdownItem,
  StatusTone,
  ThreadStat,
} from "@web/types";
import type { OverviewFilterState } from "./types";
import { TEST_RESOURCE_TYPES } from "./constants";
import { isFailedModelExecution, matchesExecution } from "./utils";

export interface OverviewDerivedState {
  filteredExecutions: ExecutionRow[];
  filteredStatusBreakdown: StatusBreakdownItem[];
  filteredThreadStats: ThreadStat[];
  filteredTypes: string[];
  failingNodes: number;
  warningNodes: number;
  failedModels: number;
  passingTests: number;
  failingTests: number;
  threadCount: number;
  filteredExecutionTime: number;
  topFailures: ExecutionRow[];
  topBottlenecks: ExecutionRow[];
}

export interface TypeStatusBreakdown {
  resourceType: string;
  count: number;
  duration: number;
  statusBreakdown: StatusBreakdownItem[];
}

export function buildStatusBreakdownForRows(
  executions: ExecutionRow[],
): StatusBreakdownItem[] {
  const byStatus = new Map<
    string,
    { count: number; duration: number; tone: StatusTone }
  >();
  for (const row of executions) {
    const current = byStatus.get(row.status) ?? {
      count: 0,
      duration: 0,
      tone: row.statusTone,
    };
    current.count += 1;
    current.duration += row.executionTime;
    byStatus.set(row.status, current);
  }
  return [...byStatus.entries()]
    .map(([status, value]) => ({
      status,
      count: value.count,
      duration: value.duration,
      share: executions.length > 0 ? value.count / executions.length : 0,
      tone: value.tone,
    }))
    .sort((a, b) => b.count - a.count);
}

export function buildThreadStatsForRows(
  executions: ExecutionRow[],
): ThreadStat[] {
  const byThread = new Map<
    string,
    { count: number; totalExecutionTime: number }
  >();
  for (const row of executions) {
    const threadId = row.threadId ?? "unknown";
    const current = byThread.get(threadId) ?? {
      count: 0,
      totalExecutionTime: 0,
    };
    current.count += 1;
    current.totalExecutionTime += row.executionTime;
    byThread.set(threadId, current);
  }
  return [...byThread.entries()]
    .map(([threadId, value]) => ({
      threadId,
      count: value.count,
      totalExecutionTime: value.totalExecutionTime,
    }))
    .sort((a, b) => b.totalExecutionTime - a.totalExecutionTime);
}

export function buildOverviewDerivedState(
  analysis: AnalysisState,
  filters: OverviewFilterState,
): OverviewDerivedState {
  const filteredExecutions = analysis.executions.filter((row) => {
    if (filters.status !== "all" && row.statusTone !== filters.status) {
      return false;
    }
    if (
      filters.resourceTypes.size > 0 &&
      !filters.resourceTypes.has(row.resourceType)
    ) {
      return false;
    }
    return matchesExecution(row, filters.query);
  });

  const testRows = filteredExecutions.filter((row) =>
    TEST_RESOURCE_TYPES.has(row.resourceType),
  );
  const filteredThreadStats = buildThreadStatsForRows(filteredExecutions);

  return {
    filteredExecutions,
    filteredStatusBreakdown: buildStatusBreakdownForRows(filteredExecutions),
    filteredThreadStats,
    filteredTypes: Array.from(
      new Set(filteredExecutions.map((row) => row.resourceType)),
    ).sort(),
    failingNodes: filteredExecutions.filter(
      (row) => row.statusTone === "danger",
    ).length,
    warningNodes: filteredExecutions.filter(
      (row) => row.statusTone === "warning",
    ).length,
    failedModels: filteredExecutions.filter(isFailedModelExecution).length,
    passingTests: testRows.filter((row) => row.statusTone === "positive")
      .length,
    failingTests: testRows.filter((row) => row.statusTone === "danger").length,
    threadCount: filteredThreadStats.filter((row) => row.threadId !== "unknown")
      .length,
    filteredExecutionTime: filteredExecutions.reduce(
      (sum, row) => sum + row.executionTime,
      0,
    ),
    topFailures: filteredExecutions
      .filter((row) => row.statusTone === "danger")
      .slice(0, 3),
    topBottlenecks: [...filteredExecutions]
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 3),
  };
}
