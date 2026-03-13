import type { NodeExecution } from "./execution-analyzer";
import type { ManifestGraph } from "./manifest-graph";

/**
 * Criteria for filtering run results executions
 */
export interface RunResultsSearchCriteria {
  /** Min execution time in seconds */
  min_execution_time?: number;
  /** Max execution time in seconds */
  max_execution_time?: number;
  /** Filter by status: success, error, skipped, etc. */
  status?: string | string[];
  /** Glob or regex pattern for unique_id */
  unique_id_pattern?: string | RegExp;
  /** Limit number of results (for top-N queries) */
  limit?: number;
  /** Sort by: execution_time_asc | execution_time_desc | unique_id */
  sort?: "execution_time_asc" | "execution_time_desc" | "unique_id";
}

/**
 * Single bottleneck node in the result
 */
export interface BottleneckNode {
  unique_id: string;
  name?: string;
  execution_time: number;
  rank: number;
  pct_of_total: number;
  status: string;
}

/**
 * Result of bottleneck detection
 */
export interface BottleneckResult {
  nodes: BottleneckNode[];
  total_execution_time: number;
  criteria_used: "top_n" | "threshold";
}

/**
 * Simple glob match: * matches any chars. Avoids ReDoS from dynamic RegExp.
 */
function matchesGlob(text: string, pattern: string): boolean {
  const parts = pattern.split("*");
  if (parts.length === 1) return text === pattern;
  let pos = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const idx = text.indexOf(part, pos);
    if (idx === -1) return false;
    if (i === 0 && idx !== 0) return false;
    pos = idx + part.length;
  }
  return (
    parts[parts.length - 1] === "" || text.endsWith(parts[parts.length - 1])
  );
}

/**
 * Filter executions by unique_id pattern (glob or RegExp)
 */
function matchesUniqueId(uniqueId: string, pattern: string | RegExp): boolean {
  if (pattern instanceof RegExp) {
    return pattern.test(uniqueId);
  }
  return matchesGlob(uniqueId, pattern);
}

/**
 * Search and filter NodeExecution array by criteria.
 * Pure function: returns new array, no side effects.
 */
export function searchRunResults(
  executions: NodeExecution[],
  criteria: RunResultsSearchCriteria,
): NodeExecution[] {
  let result = [...executions];

  // Filter by status
  if (criteria.status !== undefined) {
    const statuses =
      typeof criteria.status === "string" ? [criteria.status] : criteria.status;
    const set = new Set(statuses.map((s) => s.toLowerCase()));
    result = result.filter((e) =>
      set.has((e.status || "unknown").toLowerCase()),
    );
  }

  // Filter by execution time range
  if (criteria.min_execution_time !== undefined) {
    result = result.filter(
      (e) => (e.execution_time ?? 0) >= criteria.min_execution_time!,
    );
  }
  if (criteria.max_execution_time !== undefined) {
    result = result.filter(
      (e) => (e.execution_time ?? 0) <= criteria.max_execution_time!,
    );
  }

  // Filter by unique_id pattern
  if (criteria.unique_id_pattern !== undefined) {
    result = result.filter((e) =>
      matchesUniqueId(e.unique_id, criteria.unique_id_pattern!),
    );
  }

  // Sort
  if (criteria.sort) {
    result = [...result].sort((a, b) => {
      switch (criteria.sort) {
        case "execution_time_asc":
          return (a.execution_time ?? 0) - (b.execution_time ?? 0);
        case "execution_time_desc":
          return (b.execution_time ?? 0) - (a.execution_time ?? 0);
        case "unique_id":
          return a.unique_id.localeCompare(b.unique_id);
        default:
          return 0;
      }
    });
  }

  // Limit
  if (criteria.limit !== undefined && criteria.limit >= 0) {
    result = result.slice(0, criteria.limit);
  }

  return result;
}

/**
 * Get display name for a node from the graph, or fallback to unique_id
 */
function getNodeName(
  uniqueId: string,
  graph?: ManifestGraph,
): string | undefined {
  if (!graph) return undefined;
  const g = graph.getGraph();
  if (!g.hasNode(uniqueId)) return undefined;
  const attrs = g.getNodeAttributes(uniqueId);
  return (attrs?.name as string) || undefined;
}

/**
 * Detect bottlenecks in execution results.
 * Uses searchRunResults internally for filtering.
 */
export function detectBottlenecks(
  executions: NodeExecution[],
  options:
    | {
        mode: "top_n";
        top: number;
        graph?: ManifestGraph;
      }
    | {
        mode: "threshold";
        min_seconds: number;
        graph?: ManifestGraph;
      },
): BottleneckResult {
  const totalExecutionTime = executions.reduce(
    (sum, e) => sum + (e.execution_time ?? 0),
    0,
  );

  let filtered: NodeExecution[];

  if (options.mode === "top_n") {
    filtered = searchRunResults(executions, {
      sort: "execution_time_desc",
      limit: options.top,
    });
  } else {
    filtered = searchRunResults(executions, {
      min_execution_time: options.min_seconds,
      sort: "execution_time_desc",
    });
  }

  const nodes: BottleneckNode[] = filtered.map((e, i) => {
    const time = e.execution_time ?? 0;
    const pct = totalExecutionTime > 0 ? (time / totalExecutionTime) * 100 : 0;
    return {
      unique_id: e.unique_id,
      name: getNodeName(e.unique_id, options.graph),
      execution_time: time,
      rank: i + 1,
      pct_of_total: Math.round(pct * 10) / 10,
      status: e.status || "unknown",
    };
  });

  return {
    nodes,
    total_execution_time: totalExecutionTime,
    criteria_used: options.mode === "top_n" ? "top_n" : "threshold",
  };
}
