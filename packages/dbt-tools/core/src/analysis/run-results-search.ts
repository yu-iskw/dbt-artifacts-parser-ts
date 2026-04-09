import type { NodeExecution } from "./execution-analyzer";
import type { ManifestGraph } from "./manifest-graph";
import type { AdapterMetricSortKey } from "./adapter-metric-descriptors";

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
  /** Sort key */
  sort?:
    | "execution_time_asc"
    | "execution_time_desc"
    | "unique_id"
    | "bytes_processed_desc"
    | "bytes_billed_desc"
    | "slot_ms_desc"
    | "rows_affected_desc"
    | "rows_inserted_desc"
    | "rows_updated_desc"
    | "rows_deleted_desc"
    | "rows_duplicated_desc"
    | "query_id"
    | "adapter_code"
    | "adapter_message";
  /** Minimum bytes_processed from adapter_response (when present) */
  min_bytes_processed?: number;
  /** Minimum slot_ms from adapter_response (when present) */
  min_slot_ms?: number;
  /** Minimum rows_affected from adapter_response (when present) */
  min_rows_affected?: number;
  /** Require adapter_response to contain this top-level key */
  has_adapter_key?: string;
  /** Free text match against canonical adapter string fields */
  adapter_text?: string;
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

function bytesProcessedOf(e: NodeExecution): number {
  return e.adapterMetrics?.bytesProcessed ?? 0;
}

function slotMsOf(e: NodeExecution): number {
  return e.adapterMetrics?.slotMs ?? 0;
}

function rowsAffectedOf(e: NodeExecution): number {
  return e.adapterMetrics?.rowsAffected ?? 0;
}

function rowsInsertedOf(e: NodeExecution): number {
  return e.adapterMetrics?.rowsInserted ?? 0;
}

function rowsUpdatedOf(e: NodeExecution): number {
  return e.adapterMetrics?.rowsUpdated ?? 0;
}

function rowsDeletedOf(e: NodeExecution): number {
  return e.adapterMetrics?.rowsDeleted ?? 0;
}

function rowsDuplicatedOf(e: NodeExecution): number {
  return e.adapterMetrics?.rowsDuplicated ?? 0;
}

function adapterStringValue(
  execution: NodeExecution,
  sortKey: "query_id" | "adapter_code" | "adapter_message",
): string {
  switch (sortKey) {
    case "query_id":
      return execution.adapterMetrics?.queryId ?? "";
    case "adapter_code":
      return execution.adapterMetrics?.adapterCode ?? "";
    case "adapter_message":
      return execution.adapterMetrics?.adapterMessage ?? "";
  }
}

export function getAdapterMetricSortValue(
  execution: NodeExecution,
  sortKey: AdapterMetricSortKey,
): number | string | undefined {
  switch (sortKey) {
    case "query_id":
    case "adapter_code":
    case "adapter_message":
      return adapterStringValue(execution, sortKey);
    case "bytes_processed":
      return execution.adapterMetrics?.bytesProcessed;
    case "bytes_billed":
      return execution.adapterMetrics?.bytesBilled;
    case "slot_ms":
      return execution.adapterMetrics?.slotMs;
    case "rows_affected":
      return execution.adapterMetrics?.rowsAffected;
    case "project_id":
      return execution.adapterMetrics?.projectId;
    case "location":
      return execution.adapterMetrics?.location;
    case "rows_inserted":
      return execution.adapterMetrics?.rowsInserted;
    case "rows_updated":
      return execution.adapterMetrics?.rowsUpdated;
    case "rows_deleted":
      return execution.adapterMetrics?.rowsDeleted;
    case "rows_duplicated":
      return execution.adapterMetrics?.rowsDuplicated;
  }
}

function compareOptionalMetric(
  left: number | string | undefined,
  right: number | string | undefined,
): number {
  const leftMissing = left === undefined || left === "";
  const rightMissing = right === undefined || right === "";
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

const NUMERIC_SORT_ACCESSORS = {
  bytes_processed_desc: (execution: NodeExecution) =>
    execution.adapterMetrics?.bytesProcessed ?? 0,
  bytes_billed_desc: (execution: NodeExecution) =>
    execution.adapterMetrics?.bytesBilled ?? 0,
  slot_ms_desc: (execution: NodeExecution) =>
    execution.adapterMetrics?.slotMs ?? 0,
  rows_affected_desc: (execution: NodeExecution) =>
    execution.adapterMetrics?.rowsAffected ?? 0,
  rows_inserted_desc: (execution: NodeExecution) =>
    execution.adapterMetrics?.rowsInserted ?? 0,
  rows_updated_desc: (execution: NodeExecution) =>
    execution.adapterMetrics?.rowsUpdated ?? 0,
  rows_deleted_desc: (execution: NodeExecution) =>
    execution.adapterMetrics?.rowsDeleted ?? 0,
  rows_duplicated_desc: (execution: NodeExecution) =>
    execution.adapterMetrics?.rowsDuplicated ?? 0,
} as const satisfies Record<
  | "bytes_processed_desc"
  | "bytes_billed_desc"
  | "slot_ms_desc"
  | "rows_affected_desc"
  | "rows_inserted_desc"
  | "rows_updated_desc"
  | "rows_deleted_desc"
  | "rows_duplicated_desc",
  (execution: NodeExecution) => number
>;

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

  if (criteria.min_bytes_processed !== undefined) {
    result = result.filter(
      (e) => bytesProcessedOf(e) >= criteria.min_bytes_processed!,
    );
  }
  if (criteria.min_slot_ms !== undefined) {
    result = result.filter((e) => slotMsOf(e) >= criteria.min_slot_ms!);
  }
  if (criteria.min_rows_affected !== undefined) {
    result = result.filter(
      (e) => rowsAffectedOf(e) >= criteria.min_rows_affected!,
    );
  }
  if (criteria.has_adapter_key !== undefined) {
    const key = criteria.has_adapter_key;
    result = result.filter(
      (e) => e.adapterMetrics?.rawKeys.includes(key) === true,
    );
  }
  if (
    criteria.adapter_text !== undefined &&
    criteria.adapter_text.trim() !== ""
  ) {
    const token = criteria.adapter_text.toLowerCase();
    result = result.filter((e) => {
      const metrics = e.adapterMetrics;
      if (metrics == null) return false;
      return [
        metrics.queryId,
        metrics.adapterCode,
        metrics.adapterMessage,
        metrics.projectId,
        metrics.location,
      ].some((value) => value?.toLowerCase().includes(token) === true);
    });
  }

  // Sort
  const sortKey = criteria.sort;
  if (sortKey) {
    result = [...result].sort((a, b) => {
      if (sortKey in NUMERIC_SORT_ACCESSORS) {
        const accessor =
          NUMERIC_SORT_ACCESSORS[
            sortKey as keyof typeof NUMERIC_SORT_ACCESSORS
          ];
        return accessor(b) - accessor(a);
      }
      if (
        sortKey === "query_id" ||
        sortKey === "adapter_code" ||
        sortKey === "adapter_message"
      ) {
        return compareOptionalMetric(
          getAdapterMetricSortValue(a, sortKey),
          getAdapterMetricSortValue(b, sortKey),
        );
      }
      switch (sortKey) {
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

export type AdapterHeavyMetric =
  | "bytes_processed"
  | "bytes_billed"
  | "slot_ms"
  | "rows_affected"
  | "rows_inserted"
  | "rows_updated"
  | "rows_deleted"
  | "rows_duplicated";

export interface AdapterHeavyNode {
  unique_id: string;
  name?: string;
  metric_value: number;
  rank: number;
  pct_of_total: number;
  status: string;
  execution_time: number;
}

export interface AdapterHeavyResult {
  metric: AdapterHeavyMetric;
  nodes: AdapterHeavyNode[];
  total_metric: number;
  criteria_used: "top_n";
}

function metricValue(e: NodeExecution, metric: AdapterHeavyMetric): number {
  switch (metric) {
    case "bytes_processed":
      return bytesProcessedOf(e);
    case "bytes_billed":
      return e.adapterMetrics?.bytesBilled ?? 0;
    case "slot_ms":
      return slotMsOf(e);
    case "rows_affected":
      return rowsAffectedOf(e);
    case "rows_inserted":
      return rowsInsertedOf(e);
    case "rows_updated":
      return rowsUpdatedOf(e);
    case "rows_deleted":
      return rowsDeletedOf(e);
    case "rows_duplicated":
      return rowsDuplicatedOf(e);
    default:
      return 0;
  }
}

/**
 * Top-N nodes by an adapter-reported metric (bytes, slot ms, or rows affected).
 * Percentages use the sum of that metric across nodes with value &gt; 0.
 */
export function detectAdapterHeavyNodes(
  executions: NodeExecution[],
  options: {
    metric: AdapterHeavyMetric;
    top: number;
    graph?: ManifestGraph;
  },
): AdapterHeavyResult {
  const totalMetric = executions.reduce(
    (sum, e) => sum + Math.max(0, metricValue(e, options.metric)),
    0,
  );

  const topN = options.top > 0 ? options.top : 10;
  const positive = executions.filter((e) => metricValue(e, options.metric) > 0);
  const sorted = [...positive].sort(
    (a, b) => metricValue(b, options.metric) - metricValue(a, options.metric),
  );
  const filtered = sorted.slice(0, topN);

  const nodes: AdapterHeavyNode[] = filtered.map((e, i) => {
    const value = metricValue(e, options.metric);
    const pct = totalMetric > 0 ? (value / totalMetric) * 100 : 0;
    return {
      unique_id: e.unique_id,
      name: getNodeName(e.unique_id, options.graph),
      metric_value: value,
      rank: i + 1,
      pct_of_total: Math.round(pct * 10) / 10,
      status: e.status || "unknown",
      execution_time: e.execution_time ?? 0,
    };
  });

  return {
    metric: options.metric,
    nodes,
    total_metric: totalMetric,
    criteria_used: "top_n",
  };
}
