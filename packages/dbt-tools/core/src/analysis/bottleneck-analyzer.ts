import type { ParsedRunResults } from "dbt-artifacts-parser/run_results";
import type { ManifestGraph } from "./manifest-graph";
import { ExecutionAnalyzer } from "./execution-analyzer";

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
 *
 * Critically, the top-N cutoff is applied **after** structural enrichment and
 * sorting, so nodes with moderate runtime but high downstream reach are never
 * discarded before scoring.
 */
export function analyzeBottlenecks(
  runResults: ParsedRunResults,
  graph: ManifestGraph,
  options: BottleneckOptions,
): BottleneckAnalysis {
  const analyzer = new ExecutionAnalyzer(runResults, graph);
  const nodeExecutions = analyzer.getNodeExecutions();

  // pct_of_total is always relative to the full run's execution time
  const totalExecutionTime = nodeExecutions.reduce(
    (sum, e) => sum + (e.execution_time ?? 0),
    0,
  );

  // Critical path node set for annotation
  const criticalPath = analyzer.calculateCriticalPath(nodeExecutions);
  const criticalPathSet = new Set(criticalPath?.path ?? []);

  const g = graph.getGraph();

  const metadata = (runResults as unknown as Record<string, unknown>)
    .metadata as Record<string, unknown> | undefined;
  const adapterType = (metadata?.adapter_type as string | undefined) ?? null;

  // Apply threshold pre-filter when requested (keeps only slow-enough nodes)
  const candidates =
    options.mode === "threshold"
      ? nodeExecutions.filter(
          (e) => (e.execution_time ?? 0) >= options.min_seconds,
        )
      : nodeExecutions;

  // Enrich ALL candidates with graph metrics before any top-N cutoff
  const enriched: EnrichedBottleneckNode[] = candidates.map((exec) => {
    const time = exec.execution_time ?? 0;
    const downstreamCount = graph.getDownstream(exec.unique_id).length;
    const fanIn = g.hasNode(exec.unique_id) ? g.inDegree(exec.unique_id) : 0;
    const fanOut = g.hasNode(exec.unique_id) ? g.outDegree(exec.unique_id) : 0;
    const rawScore = time * (1 + downstreamCount);
    const pct = totalExecutionTime > 0 ? (time / totalExecutionTime) * 100 : 0;
    const attrs = g.hasNode(exec.unique_id)
      ? g.getNodeAttributes(exec.unique_id)
      : undefined;

    return {
      unique_id: exec.unique_id,
      name: attrs?.name as string | undefined,
      execution_time: time,
      rank: 0, // assigned after sort
      pct_of_total: Math.round(pct * 10) / 10,
      status: exec.status || "unknown",
      downstream_count: downstreamCount,
      fan_in: fanIn,
      fan_out: fanOut,
      structural_impact_score: Math.round(rawScore * 100) / 100,
      is_on_critical_path: criticalPathSet.has(exec.unique_id),
    };
  });

  // Sort ALL by structural_impact_score, then apply top-N cutoff
  enriched.sort((a, b) => b.structural_impact_score - a.structural_impact_score);

  const topBottlenecks =
    options.mode === "top_n" ? enriched.slice(0, options.top) : enriched;

  topBottlenecks.forEach((n, i) => {
    n.rank = i + 1;
  });

  return {
    top_bottlenecks: topBottlenecks,
    total_execution_time: totalExecutionTime,
    criteria_used: options.mode === "top_n" ? "top_n" : "threshold",
    adapter_type: adapterType,
    total_nodes_analyzed: nodeExecutions.length,
  };
}
