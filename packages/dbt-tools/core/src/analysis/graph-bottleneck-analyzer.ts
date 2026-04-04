import { topologicalSort } from "graphology-dag";
import type { NodeExecution } from "./execution-analyzer";
import type { ManifestGraph } from "./manifest-graph";
import { calculateWeightedCriticalPath } from "./critical-path";

export interface BottleneckNodeScore {
  unique_id: string;
  name: string;
  resource_type: string;
  execution_time?: number;
  duration_zscore?: number;
  downstream_count: number;
  path_participation: number;
  on_critical_path: boolean;
  bottleneck_score: number;
  reasons: string[];
}

export interface BottleneckReport {
  summary: {
    graph_nodes: number;
    executed_nodes: number;
    critical_path_total_time?: number;
  };
  critical_path?: {
    path: string[];
    total_time: number;
  };
  ranked_nodes: BottleneckNodeScore[];
}

export interface BottleneckOptions {
  includeExecution?: boolean;
  topN?: number;
  weights?: Partial<{
    criticalPath: number;
    downstreamImpact: number;
    pathParticipation: number;
    duration: number;
  }>;
}

type ResolvedWeights = {
  criticalPath: number;
  downstreamImpact: number;
  pathParticipation: number;
  duration: number;
};

const DEFAULT_WEIGHTS: ResolvedWeights = {
  criticalPath: 0.3,
  downstreamImpact: 0.25,
  pathParticipation: 0.25,
  duration: 0.2,
};

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function normalizeWeight(value: number | undefined, fallback: number): number {
  if (value === undefined || Number.isNaN(value) || value < 0) {
    return fallback;
  }
  return value;
}

function capAdd(a: number, b: number): number {
  if (a >= Number.MAX_SAFE_INTEGER - b) {
    return Number.MAX_SAFE_INTEGER;
  }
  return a + b;
}

function capMultiply(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  if (a > Number.MAX_SAFE_INTEGER / b) {
    return Number.MAX_SAFE_INTEGER;
  }
  return a * b;
}

export class GraphBottleneckAnalyzer {
  private readonly graph: ManifestGraph;
  private readonly executionsById: Map<string, NodeExecution>;

  constructor(graph: ManifestGraph, executions?: NodeExecution[]) {
    this.graph = graph;
    this.executionsById = new Map(
      (executions ?? []).map((execution) => [execution.unique_id, execution]),
    );
  }

  analyze(options: BottleneckOptions = {}): BottleneckReport {
    const g = this.graph.getGraph();
    const order = topologicalSort(g);

    const weights: ResolvedWeights = {
      criticalPath: normalizeWeight(
        options.weights?.criticalPath,
        DEFAULT_WEIGHTS.criticalPath,
      ),
      downstreamImpact: normalizeWeight(
        options.weights?.downstreamImpact,
        DEFAULT_WEIGHTS.downstreamImpact,
      ),
      pathParticipation: normalizeWeight(
        options.weights?.pathParticipation,
        DEFAULT_WEIGHTS.pathParticipation,
      ),
      duration: normalizeWeight(options.weights?.duration, DEFAULT_WEIGHTS.duration),
    };

    const includeExecution = options.includeExecution !== false;
    const hasExecution = includeExecution && this.executionsById.size > 0;

    const downstreamCounts = this.computeDownstreamCounts(order);
    const { pathParticipationByNode } = this.computePathParticipation(order);

    const executionTimes = new Map<string, number>();
    if (hasExecution) {
      for (const [nodeId, execution] of this.executionsById) {
        if (g.hasNode(nodeId)) {
          executionTimes.set(nodeId, execution.execution_time ?? 0);
        }
      }
    }

    const criticalPath = hasExecution
      ? calculateWeightedCriticalPath(g, executionTimes, new Set(executionTimes.keys()))
      : undefined;
    const criticalPathSet = new Set(criticalPath?.path ?? []);

    const durationStats = this.computeDurationStats(
      Array.from(executionTimes.values()).filter((value) => value > 0),
    );

    const maxDownstream = Math.max(1, ...downstreamCounts.values());
    const activeWeightTotal =
      weights.criticalPath +
      weights.downstreamImpact +
      weights.pathParticipation +
      (hasExecution ? weights.duration : 0);

    const scored: BottleneckNodeScore[] = order.map((nodeId) => {
      const attrs = g.getNodeAttributes(nodeId);
      const executionTime = executionTimes.get(nodeId);
      const z =
        executionTime === undefined
          ? undefined
          : durationStats.stddev === 0
            ? 0
            : (executionTime - durationStats.mean) / durationStats.stddev;
      const durationSeverity = z === undefined ? 0 : clamp01((z + 1.5) / 3);

      const downstreamNorm = (downstreamCounts.get(nodeId) ?? 0) / maxDownstream;
      const participation = pathParticipationByNode.get(nodeId) ?? 0;
      const criticalPathMembership = criticalPathSet.has(nodeId) ? 1 : 0;

      const weightedRaw =
        weights.criticalPath * criticalPathMembership +
        weights.downstreamImpact * downstreamNorm +
        weights.pathParticipation * participation +
        (hasExecution ? weights.duration * durationSeverity : 0);
      const score =
        activeWeightTotal > 0 ? clamp01(weightedRaw / activeWeightTotal) : 0;

      const reasons: string[] = [];
      if (criticalPathMembership > 0) {
        reasons.push("on weighted critical path");
      }
      if (downstreamNorm >= 0.6) {
        reasons.push(`high downstream impact (${downstreamCounts.get(nodeId) ?? 0} dependents)`);
      }
      if (participation >= 0.2) {
        reasons.push(`high path participation (${(participation * 100).toFixed(1)}%)`);
      }
      if (z !== undefined && z >= 1) {
        reasons.push(`slow runtime (z=${z.toFixed(2)})`);
      }
      if (reasons.length === 0) {
        reasons.push("structural centrality contributes to rank");
      }

      return {
        unique_id: nodeId,
        name: attrs.name,
        resource_type: attrs.resource_type,
        ...(executionTime !== undefined ? { execution_time: executionTime } : {}),
        ...(z !== undefined ? { duration_zscore: z } : {}),
        downstream_count: downstreamCounts.get(nodeId) ?? 0,
        path_participation: participation,
        on_critical_path: criticalPathMembership === 1,
        bottleneck_score: Math.round(score * 1000) / 1000,
        reasons,
      };
    });

    scored.sort((a, b) => {
      if (b.bottleneck_score !== a.bottleneck_score) {
        return b.bottleneck_score - a.bottleneck_score;
      }
      return a.unique_id.localeCompare(b.unique_id);
    });

    const topN = options.topN;
    const rankedNodes = topN && topN > 0 ? scored.slice(0, topN) : scored;

    return {
      summary: {
        graph_nodes: g.order,
        executed_nodes: executionTimes.size,
        ...(criticalPath ? { critical_path_total_time: criticalPath.total_time } : {}),
      },
      ...(criticalPath
        ? { critical_path: { path: criticalPath.path, total_time: criticalPath.total_time } }
        : {}),
      ranked_nodes: rankedNodes,
    };
  }

  private computeDownstreamCounts(order: string[]): Map<string, number> {
    const g = this.graph.getGraph();
    const descendants = new Map<string, Set<string>>();
    const result = new Map<string, number>();

    for (let i = order.length - 1; i >= 0; i -= 1) {
      const nodeId = order[i]!;
      const aggregate = new Set<string>();
      for (const child of g.outboundNeighbors(nodeId)) {
        aggregate.add(child);
        const childDesc = descendants.get(child);
        if (!childDesc) {
          continue;
        }
        for (const transitive of childDesc) {
          aggregate.add(transitive);
        }
      }
      descendants.set(nodeId, aggregate);
      result.set(nodeId, aggregate.size);
    }

    return result;
  }

  private computePathParticipation(order: string[]): {
    pathParticipationByNode: Map<string, number>;
  } {
    const g = this.graph.getGraph();

    const fromRoots = new Map<string, number>();
    for (const nodeId of order) {
      const parents = g.inboundNeighbors(nodeId);
      if (parents.length === 0) {
        fromRoots.set(nodeId, 1);
      } else {
        let sum = 0;
        for (const parent of parents) {
          sum = capAdd(sum, fromRoots.get(parent) ?? 0);
        }
        fromRoots.set(nodeId, sum);
      }
    }

    const toLeaves = new Map<string, number>();
    for (let i = order.length - 1; i >= 0; i -= 1) {
      const nodeId = order[i]!;
      const children = g.outboundNeighbors(nodeId);
      if (children.length === 0) {
        toLeaves.set(nodeId, 1);
      } else {
        let sum = 0;
        for (const child of children) {
          sum = capAdd(sum, toLeaves.get(child) ?? 0);
        }
        toLeaves.set(nodeId, sum);
      }
    }

    let totalPaths = 0;
    for (const nodeId of order) {
      if (g.outDegree(nodeId) === 0) {
        totalPaths = capAdd(totalPaths, fromRoots.get(nodeId) ?? 0);
      }
    }

    const pathParticipationByNode = new Map<string, number>();
    for (const nodeId of order) {
      const through = capMultiply(fromRoots.get(nodeId) ?? 0, toLeaves.get(nodeId) ?? 0);
      const normalized = totalPaths > 0 ? through / totalPaths : 0;
      pathParticipationByNode.set(nodeId, clamp01(normalized));
    }

    return { pathParticipationByNode };
  }

  private computeDurationStats(values: number[]): { mean: number; stddev: number } {
    if (values.length === 0) {
      return { mean: 0, stddev: 0 };
    }

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance =
      values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    return { mean, stddev: Math.sqrt(variance) };
  }
}
