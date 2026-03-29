import type { ParsedRunResults } from "dbt-artifacts-parser/run_results";
import type { ManifestGraph } from "./manifest-graph";
import { ExecutionAnalyzer } from "./execution-analyzer";
import { detectBottlenecks } from "./run-results-search";

/**
 * A bottleneck node enriched with graph-structural metadata.
 */
export interface EnrichedBottleneckNode {
  unique_id: string;
  name?: string;
  execution_time: number;
  /** Rank by structural impact (1 = most impactful). */
  rank: number;
  pct_of_total: number;
  status: string;
  /** Total nodes reachable downstream (transitive). */
  downstream_count: number;
  /** Immediate in-degree: number of direct parents. */
  fan_in: number;
  /** Immediate out-degree: number of direct children. */
  fan_out: number;
  /**
   * execution_time × (1 + downstream_count).
   * Combines raw slowness with how many downstream nodes are blocked.
   */
  structural_impact_score: number;
  /** Whether this node lies on the critical execution path. */
  is_on_critical_path: boolean;
}

/**
 * Result of graph-enriched bottleneck analysis.
 */
export interface BottleneckAnalysis {
  top_bottlenecks: EnrichedBottleneckNode[];
  total_execution_time: number;
  criteria_used: "top_n" | "threshold";
  /** Warehouse adapter type from run_results metadata (e.g. "bigquery"). */
  adapter_type: string | null;
  total_nodes_analyzed: number;
}

type BottleneckOptions =
  | { mode: "top_n"; top: number }
  | { mode: "threshold"; min_seconds: number };

/**
 * Analyze execution bottlenecks enriched with graph-structural metrics.
 *
 * Unlike plain `detectBottlenecks`, this function ranks nodes by
 * **structural impact** (execution time × downstream reach) rather than raw
 * execution time alone, so a fast node that blocks hundreds of downstream
 * nodes surfaces above a slow isolated node.
 */
export function analyzeBottlenecks(
  runResults: ParsedRunResults,
  graph: ManifestGraph,
  options: BottleneckOptions,
): BottleneckAnalysis {
  const analyzer = new ExecutionAnalyzer(runResults, graph);
  const nodeExecutions = analyzer.getNodeExecutions();

  // Critical path node set for annotation
  const criticalPath = analyzer.calculateCriticalPath(nodeExecutions);
  const criticalPathSet = new Set(criticalPath?.path ?? []);

  const baseResult = detectBottlenecks(nodeExecutions, { ...options, graph });
  const g = graph.getGraph();

  const metadata = (runResults as unknown as Record<string, unknown>)
    .metadata as Record<string, unknown> | undefined;
  const adapterType = (metadata?.adapter_type as string | undefined) ?? null;

  const enriched: EnrichedBottleneckNode[] = baseResult.nodes.map((node) => {
    const downstreamCount = graph.getDownstream(node.unique_id).length;
    const fanIn = g.hasNode(node.unique_id) ? g.inDegree(node.unique_id) : 0;
    const fanOut = g.hasNode(node.unique_id) ? g.outDegree(node.unique_id) : 0;
    const rawScore = node.execution_time * (1 + downstreamCount);

    return {
      ...node,
      downstream_count: downstreamCount,
      fan_in: fanIn,
      fan_out: fanOut,
      structural_impact_score: Math.round(rawScore * 100) / 100,
      is_on_critical_path: criticalPathSet.has(node.unique_id),
    };
  });

  // Re-rank by structural_impact_score (highest = rank 1)
  enriched.sort((a, b) => b.structural_impact_score - a.structural_impact_score);
  enriched.forEach((n, i) => {
    n.rank = i + 1;
  });

  return {
    top_bottlenecks: enriched,
    total_execution_time: baseResult.total_execution_time,
    criteria_used: baseResult.criteria_used,
    adapter_type: adapterType,
    total_nodes_analyzed: nodeExecutions.length,
  };
}
