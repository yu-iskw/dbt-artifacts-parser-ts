import type { ParsedRunResults } from "dbt-artifacts-parser/run_results";
import type {
  AnalysisNode,
  ExecutionAnalysis,
  ExecutionSnapshot,
  ResolvedOptions,
} from "./graph-risk-analysis-types";
import { buildNodeExecutionsFromRunResults } from "./execution-analyzer";
import { normalizeSparseArray, roundNumber } from "./graph-risk-math";

function buildExecutionMap(
  runResults: ParsedRunResults | undefined,
  nodes: AnalysisNode[],
): Map<string, ExecutionSnapshot> {
  if (!runResults) {
    return new Map();
  }

  const allowedIds = new Set(nodes.map((node) => node.uniqueId));
  const snapshots = new Map<string, ExecutionSnapshot>();

  for (const execution of buildNodeExecutionsFromRunResults(runResults)) {
    if (!allowedIds.has(execution.unique_id)) {
      continue;
    }
    snapshots.set(execution.unique_id, {
      durationMs: Math.max(
        0,
        Math.round((execution.execution_time ?? 0) * 1000),
      ),
      status: execution.status || "unknown",
      threadId: execution.thread_id,
    });
  }

  return snapshots;
}

/** Max without spreading; empty input yields -Infinity (same as `Math.max()`). */
function maxOverNumbers(values: readonly number[]): number {
  let max = Number.NEGATIVE_INFINITY;
  for (const v of values) {
    max = Math.max(max, v);
  }
  return max;
}

export function createEmptyExecutionAnalysis(
  nodeCount: number,
): ExecutionAnalysis {
  return {
    durations: new Array<number | undefined>(nodeCount).fill(undefined),
    durationScores: new Array<number | undefined>(nodeCount).fill(undefined),
    weightedImpactScores: new Array<number | undefined>(nodeCount).fill(
      undefined,
    ),
    criticalPath: new Array<boolean>(nodeCount).fill(false),
    slackMs: new Array<number | undefined>(nodeCount).fill(undefined),
    statuses: new Array<string | undefined>(nodeCount).fill(undefined),
    threadIds: new Array<string | undefined>(nodeCount).fill(undefined),
  };
}

export function computeExecutionAnalysis(
  nodes: AnalysisNode[],
  topoOrder: number[],
  options: ResolvedOptions,
  runResults: ParsedRunResults | undefined,
  blastRadiusScores: number[],
  pathConcentrationScores: number[],
): ExecutionAnalysis {
  if (!options.includeExecution || !runResults) {
    return createEmptyExecutionAnalysis(nodes.length);
  }

  const executionMap = buildExecutionMap(runResults, nodes);
  if (executionMap.size === 0) {
    return {
      ...createEmptyExecutionAnalysis(nodes.length),
      executionCoveragePct:
        nodes.length === 0 ? undefined : roundNumber((0 / nodes.length) * 100),
    };
  }

  const result = createEmptyExecutionAnalysis(nodes.length);
  const {
    durations,
    durationScores,
    weightedImpactScores,
    criticalPath,
    slackMs,
    statuses,
    threadIds,
  } = result;
  const weightedImpactRaw = new Array<number | undefined>(nodes.length).fill(
    undefined,
  );
  const executed = new Array<boolean>(nodes.length).fill(false);

  for (const node of nodes) {
    const snapshot = executionMap.get(node.uniqueId);
    if (!snapshot) {
      continue;
    }
    executed[node.index] = true;
    durations[node.index] = snapshot.durationMs;
    statuses[node.index] = snapshot.status;
    threadIds[node.index] = snapshot.threadId;
  }

  const earliestStart = new Array<number>(nodes.length).fill(0);
  const earliestFinish = new Array<number>(nodes.length).fill(0);
  const latestStart = new Array<number>(nodes.length).fill(0);
  const latestFinish = new Array<number>(nodes.length).fill(0);

  for (const nodeIndex of topoOrder) {
    if (!executed[nodeIndex]) {
      continue;
    }
    const node = nodes[nodeIndex]!;
    const executedParents = node.parents.filter(
      (parentIndex) => executed[parentIndex],
    );
    earliestStart[nodeIndex] =
      executedParents.length === 0
        ? 0
        : Math.max(
            ...executedParents.map(
              (parentIndex) => earliestFinish[parentIndex]!,
            ),
          );
    earliestFinish[nodeIndex] =
      earliestStart[nodeIndex]! + (durations[nodeIndex] ?? 0);
  }

  const projectDuration = maxOverNumbers(earliestFinish);
  for (let position = topoOrder.length - 1; position >= 0; position--) {
    const nodeIndex = topoOrder[position]!;
    if (!executed[nodeIndex]) {
      continue;
    }
    const node = nodes[nodeIndex]!;
    const executedChildren = node.children.filter(
      (childIndex) => executed[childIndex],
    );
    latestFinish[nodeIndex] =
      executedChildren.length === 0
        ? projectDuration
        : Math.min(
            ...executedChildren.map((childIndex) => latestStart[childIndex]!),
          );
    latestStart[nodeIndex] =
      latestFinish[nodeIndex]! - (durations[nodeIndex] ?? 0);
    const slack = Math.max(
      0,
      latestStart[nodeIndex]! - earliestStart[nodeIndex]!,
    );
    slackMs[nodeIndex] = Math.round(slack);
    criticalPath[nodeIndex] = slack <= options.thresholds.criticalSlackMs;
    weightedImpactRaw[nodeIndex] =
      (durations[nodeIndex] ?? 0) *
      (1 +
        (blastRadiusScores[nodeIndex] ?? 0) / 100 +
        (pathConcentrationScores[nodeIndex] ?? 0) / 100);
  }

  const normalizedDurations = normalizeSparseArray(durations);
  const normalizedWeightedImpact = normalizeSparseArray(weightedImpactRaw);

  for (let index = 0; index < nodes.length; index++) {
    durationScores[index] = normalizedDurations[index];
    weightedImpactScores[index] = normalizedWeightedImpact[index];
  }

  result.executionCoveragePct = roundNumber(
    (executionMap.size / nodes.length) * 100,
  );
  return result;
}
