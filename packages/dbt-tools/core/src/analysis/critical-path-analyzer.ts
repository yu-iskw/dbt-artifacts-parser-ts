import type { ParsedRunResults } from "dbt-artifacts-parser/run_results";
import type { ManifestGraph } from "./manifest-graph";
import { ExecutionAnalyzer } from "./execution-analyzer";

/**
 * A single node on the critical execution path with enriched metadata.
 */
export interface CriticalPathNode {
  unique_id: string;
  name: string;
  resource_type: string;
  execution_time: number;
  /** Running total of execution time from path start to this node. */
  cumulative_time: number;
  /**
   * Number of other nodes whose execution windows overlapped with this node.
   * Computed from wall-clock timestamps in run_results when available;
   * 0 when timing data is absent.
   */
  concurrent_nodes: number;
}

/**
 * Result of critical path analysis.
 */
export interface CriticalPathAnalysis {
  /** Nodes in the critical path, ordered from root to leaf. */
  path: CriticalPathNode[];
  /** Total accumulated execution time along the critical path (seconds). */
  total_time: number;
  /** Total nodes included in the run. */
  total_nodes: number;
  /** Warehouse adapter type from run_results metadata. */
  adapter_type: string | null;
}

/**
 * Parse a timing string into epoch-milliseconds, or return null.
 */
function toMs(ts: string | undefined): number | null {
  if (!ts) return null;
  const ms = new Date(ts).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Analyze the critical execution path with per-node timing enrichment.
 *
 * Returns `null` when no critical path can be determined (e.g. empty
 * run_results or no graph nodes matched).
 */
export function analyzeCriticalPath(
  runResults: ParsedRunResults,
  graph: ManifestGraph,
): CriticalPathAnalysis | null {
  const analyzer = new ExecutionAnalyzer(runResults, graph);
  const nodeExecutions = analyzer.getNodeExecutions();
  const criticalPath = analyzer.calculateCriticalPath(nodeExecutions);

  if (!criticalPath || criticalPath.path.length === 0) {
    return null;
  }

  const executionMap = new Map(nodeExecutions.map((e) => [e.unique_id, e]));
  const g = graph.getGraph();

  // Build wall-clock windows for concurrent-node computation
  const windows = new Map<string, { start: number; end: number }>();
  for (const exec of nodeExecutions) {
    const start = toMs(exec.started_at);
    const end = toMs(exec.completed_at);
    if (start !== null && end !== null && end >= start) {
      windows.set(exec.unique_id, { start, end });
    }
  }

  const metadata = (runResults as unknown as Record<string, unknown>)
    .metadata as Record<string, unknown> | undefined;
  const adapterType = (metadata?.adapter_type as string | undefined) ?? null;

  let cumulativeTime = 0;
  const pathNodes: CriticalPathNode[] = criticalPath.path.map((nodeId) => {
    const exec = executionMap.get(nodeId);
    const execTime = exec?.execution_time ?? 0;
    cumulativeTime += execTime;

    const attrs = g.hasNode(nodeId) ? g.getNodeAttributes(nodeId) : undefined;

    // Count nodes with overlapping execution windows
    let concurrentNodes = 0;
    const window = windows.get(nodeId);
    if (window) {
      for (const [otherId, otherWindow] of windows.entries()) {
        if (
          otherId !== nodeId &&
          otherWindow.start < window.end &&
          otherWindow.end > window.start
        ) {
          concurrentNodes++;
        }
      }
    }

    return {
      unique_id: nodeId,
      name: attrs?.name ?? nodeId,
      resource_type: String(attrs?.resource_type ?? "unknown"),
      execution_time: execTime,
      cumulative_time: Math.round(cumulativeTime * 100) / 100,
      concurrent_nodes: concurrentNodes,
    };
  });

  return {
    path: pathNodes,
    total_time: criticalPath.total_time,
    total_nodes: nodeExecutions.length,
    adapter_type: adapterType,
  };
}
