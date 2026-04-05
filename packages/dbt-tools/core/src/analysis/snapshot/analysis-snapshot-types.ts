import type { BottleneckResult } from "../run-results-search";
import type { ExecutionSummary } from "../execution-analyzer";
import type { NodeExecutionSemantics } from "../node-execution-semantics";
import type {
  AdapterResponseField,
  AdapterResponseMetrics,
  AdapterTotalsSnapshot,
} from "../adapter-response-metrics";

export interface GanttItem {
  unique_id: string;
  name: string;
  start: number;
  end: number;
  duration: number;
  status: string;
  resourceType: string;
  packageName: string;
  path: string | null;
  parentId: string | null;
  compileStart?: number | null;
  compileEnd?: number | null;
  executeStart?: number | null;
  executeEnd?: number | null;
  materialized?: string | null;
  semantics?: NodeExecutionSemantics;
}

export type StatusTone =
  | "positive"
  | "warning"
  | "danger"
  | "neutral"
  | "skipped";

export interface MetricDefinition {
  kind: "metric";
  label: string | null;
  description: string | null;
  metricType: string | null;
  expression: string | null;
  sourceReference: string | null;
  filters: string[];
  timeGranularity: string | null;
  measures: string[];
  metrics: string[];
}

export interface SemanticModelDefinition {
  kind: "semantic_model";
  label: string | null;
  description: string | null;
  sourceReference: string | null;
  defaultTimeDimension: string | null;
  entities: string[];
  measures: string[];
  dimensions: string[];
}

export type ResourceDefinition = MetricDefinition | SemanticModelDefinition;

export interface GraphSnapshot {
  totalNodes: number;
  totalEdges: number;
  hasCycles: boolean;
  nodesByType: Record<string, number>;
}

export interface ResourceNode {
  uniqueId: string;
  name: string;
  resourceType: string;
  packageName: string;
  path: string | null;
  originalFilePath: string | null;
  patchPath?: string | null;
  database?: string | null;
  schema?: string | null;
  description: string | null;
  compiledCode?: string | null;
  rawCode?: string | null;
  definition?: ResourceDefinition | null;
  status: string | null;
  statusTone: StatusTone;
  executionTime: number | null;
  threadId: string | null;
  semantics?: NodeExecutionSemantics;
  /** Model/column target from manifest (`attached_node`, `column_name`, etc.) for tests. */
  testAttachedTarget?: string | null;
  /** Non-empty `run_results.results[].message` when present. */
  runResultMessage?: string | null;
}

export interface ResourceGroup {
  resourceType: string;
  label: string;
  count: number;
  attentionCount: number;
  resources: ResourceNode[];
}

export interface ExecutionRow {
  uniqueId: string;
  name: string;
  resourceType: string;
  packageName: string;
  path: string | null;
  status: string;
  statusTone: StatusTone;
  executionTime: number;
  threadId: string | null;
  start: number | null;
  end: number | null;
  adapterMetrics?: AdapterResponseMetrics;
  adapterResponseFields?: AdapterResponseField[];
  semantics?: NodeExecutionSemantics;
}

export interface StatusBreakdownItem {
  status: string;
  count: number;
  duration: number;
  share: number;
  tone: StatusTone;
}

export interface ThreadStat {
  threadId: string;
  count: number;
  totalExecutionTime: number;
}

export interface DependencyPreview {
  uniqueId: string;
  name: string;
  resourceType: string;
  depth: number;
}

/**
 * Direct (1-hop) dependency edges only. `upstream` / `downstream` list every
 * direct neighbor; counts match those lists (not transitive closure).
 */
export interface ResourceConnectionSummary {
  upstreamCount: number;
  downstreamCount: number;
  upstream: DependencyPreview[];
  downstream: DependencyPreview[];
}

export interface TimelineAdjacencyEntry {
  inbound: string[];
  outbound: string[];
}

export interface AnalysisSnapshot {
  summary: ExecutionSummary;
  projectName: string | null;
  warehouseType?: string | null;
  runStartedAt: number | null;
  ganttData: GanttItem[];
  bottlenecks: BottleneckResult | undefined;
  graphSummary: GraphSnapshot;
  resources: ResourceNode[];
  resourceGroups: ResourceGroup[];
  executions: ExecutionRow[];
  statusBreakdown: StatusBreakdownItem[];
  threadStats: ThreadStat[];
  dependencyIndex: Record<string, ResourceConnectionSummary>;
  timelineAdjacency: Record<string, TimelineAdjacencyEntry>;
  selectedResourceId: string | null;
  invocationId?: string | null;
  /** Aggregated adapter_response metrics when any node reported data */
  adapterTotals?: AdapterTotalsSnapshot;
}

export interface AnalysisSnapshotBuildTimings {
  graphBuildMs: number;
  snapshotBuildMs: number;
}
