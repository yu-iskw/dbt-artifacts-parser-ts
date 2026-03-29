import type { NodeExecution } from "./execution-analyzer";
import type { ManifestGraph } from "./manifest-graph";

export interface OptimizationCandidate {
  unique_id: string;
  name?: string;
  execution_time_seconds: number;
  downstream_reach: number;
  upstream_depth: number;
  bridge_score: number;
  critical_path_membership: boolean;
  impact_score: number;
  confidence: number;
  recommendations: string[];
}

export interface OptimizationReport {
  adapter_type?: string;
  top_n: number;
  total_execution_time_seconds: number;
  candidates: OptimizationCandidate[];
}

type AdapterHint = {
  adapterType?: string;
};

function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function buildRecommendations(
  candidate: Omit<OptimizationCandidate, "recommendations">,
  adapterHint: AdapterHint,
): string[] {
  const recommendations: string[] = [];

  if (candidate.execution_time_seconds >= 60) {
    recommendations.push(
      "Review compiled SQL and reduce expensive joins/scans for this node.",
    );
  }

  if (candidate.critical_path_membership) {
    recommendations.push(
      "Prioritize this node first: it is on the critical path and blocks total pipeline completion.",
    );
  }

  if (candidate.downstream_reach >= 8) {
    recommendations.push(
      "High downstream reach: optimize here for broad transitive runtime reduction.",
    );
  }

  if (candidate.bridge_score >= 24) {
    recommendations.push(
      "Bridge-like node detected: consider splitting logic or precomputing stable intermediates.",
    );
  }

  const adapter = adapterHint.adapterType?.toLowerCase();
  if (adapter === "bigquery") {
    recommendations.push(
      "BigQuery hint: prefer partition pruning and clustering keys on large incremental models.",
    );
  } else if (adapter === "snowflake") {
    recommendations.push(
      "Snowflake hint: validate warehouse sizing and clustering strategy for large table scans.",
    );
  } else if (adapter === "databricks" || adapter === "spark") {
    recommendations.push(
      "Databricks/Spark hint: inspect shuffle stages and skew; consider Z-ORDER/OPTIMIZE where applicable.",
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Collect additional run history to improve optimization confidence for this node.",
    );
  }

  return recommendations;
}

/**
 * Rank execution nodes by optimization impact using execution metrics + graph topology.
 */
export function buildOptimizationReport(
  executions: NodeExecution[],
  graph: ManifestGraph,
  options?: {
    topN?: number;
    criticalPath?: string[];
    adapterType?: string;
  },
): OptimizationReport {
  const topN = Math.max(1, options?.topN ?? 10);
  const graphology = graph.getGraph();
  const criticalPathSet = new Set(options?.criticalPath ?? []);

  const totalExecutionTime = executions.reduce(
    (sum, entry) => sum + (entry.execution_time ?? 0),
    0,
  );

  const raw = executions
    .filter((entry) => graphology.hasNode(entry.unique_id))
    .map((entry) => {
      const uniqueId = entry.unique_id;
      const executionTime = entry.execution_time ?? 0;
      const downstreamReach = graph.getDownstream(uniqueId).length;
      const upstreamNodes = graph.getUpstream(uniqueId);
      const upstreamDepth = upstreamNodes.reduce(
        (maxDepth, current) => Math.max(maxDepth, current.depth),
        0,
      );
      const bridgeScore = upstreamNodes.length * downstreamReach;
      const criticalPathMembership = criticalPathSet.has(uniqueId);

      const timeRatio = totalExecutionTime > 0 ? executionTime / totalExecutionTime : 0;
      const impactScoreRaw =
        executionTime * 0.6 +
        downstreamReach * 2.5 +
        bridgeScore * 0.2 +
        (criticalPathMembership ? 12 : 0) +
        upstreamDepth * 1.1 +
        timeRatio * 35;

      const confidenceRaw =
        35 +
        Math.min(30, downstreamReach * 2) +
        Math.min(20, upstreamDepth * 3) +
        (criticalPathMembership ? 10 : 0);

      return {
        unique_id: uniqueId,
        name: graphology.getNodeAttributes(uniqueId).name as string | undefined,
        execution_time_seconds: roundTo(executionTime),
        downstream_reach: downstreamReach,
        upstream_depth: upstreamDepth,
        bridge_score: bridgeScore,
        critical_path_membership: criticalPathMembership,
        impact_score: roundTo(impactScoreRaw),
        confidence: Math.min(100, Math.max(0, roundTo(confidenceRaw))),
      };
    })
    .sort((a, b) => b.impact_score - a.impact_score)
    .slice(0, topN)
    .map((candidate) => ({
      ...candidate,
      recommendations: buildRecommendations(candidate, {
        adapterType: options?.adapterType,
      }),
    }));

  return {
    adapter_type: options?.adapterType,
    top_n: topN,
    total_execution_time_seconds: roundTo(totalExecutionTime),
    candidates: raw,
  };
}
