import type {
  ExecutionSummary,
  BottleneckResult,
} from "@dbt-tools/core/browser";

export interface GanttItem {
  unique_id: string;
  name: string;
  start: number;
  end: number;
  duration: number;
  status: string;
  /** dbt resource type (model, test, seed, snapshot, etc.). Inferred from unique_id prefix when absent from the manifest graph. */
  resourceType: string;
  /** dbt package name for this node (populated from the manifest graph). */
  packageName: string;
  /** Source file path for this node (populated from the manifest graph). */
  path: string | null;
  /**
   * unique_id of the parent resource for test/unit_test nodes (the model, seed,
   * source, or snapshot being tested). Resolved from depends_on.nodes in the
   * manifest graph. null for non-test resources or when parentage is ambiguous.
   */
  parentId: string | null;
  /** Relative ms from run start; absent or null when compile timing is missing in run_results. */
  compileStart?: number | null;
  compileEnd?: number | null;
  /** Relative ms from run start; absent or null when execute timing is missing in run_results. */
  executeStart?: number | null;
  executeEnd?: number | null;
  /** Model `config.materialized` from manifest when present. */
  materialized?: string | null;
}

export type StatusTone = "positive" | "warning" | "danger" | "neutral";

export interface ResourceTestStats {
  pass: number;
  fail: number;
  error: number;
}

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

export interface CatalogColumn {
  name: string;
  type: string;
  index: number;
  comment: string | null;
}

export interface ResourceNode {
  uniqueId: string;
  name: string;
  resourceType: string;
  packageName: string;
  path: string | null;
  originalFilePath: string | null;
  /** Patch path from the manifest (used as a fallback for display path when originalFilePath is absent). */
  patchPath?: string | null;
  /** Database name from the manifest (available on model/seed/snapshot nodes). */
  database?: string | null;
  /** Schema name from the manifest (available on model/seed/snapshot nodes). */
  schema?: string | null;
  description: string | null;
  /** Compiled SQL for this resource (available on model nodes with compiled output). */
  compiledCode?: string | null;
  /** Raw SQL source for this resource (available from manifest compiled_code / raw_code). */
  rawCode?: string | null;
  definition?: ResourceDefinition | null;
  status: string | null;
  statusTone: StatusTone;
  executionTime: number | null;
  threadId: string | null;
  /** Column metadata from catalog.json. Present only when catalog was provided at analysis time. */
  columns?: CatalogColumn[];
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

export interface ResourceConnectionSummary {
  upstreamCount: number;
  downstreamCount: number;
  upstream: DependencyPreview[];
  downstream: DependencyPreview[];
}

/**
 * Immediate manifest graph neighbors for executed timeline nodes only.
 * Edges follow ManifestGraph: inbound = depends_on (upstream of this node).
 */
export interface TimelineAdjacencyEntry {
  inbound: string[];
  outbound: string[];
}

export interface AnalysisState {
  summary: ExecutionSummary;
  /** Project name from manifest metadata, or null for older manifests. */
  projectName: string | null;
  /** Absolute epoch-ms of the earliest executed node. Null when no timing data. */
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
  /** Per-executed-node inbound/outbound unique_ids from the manifest graph. */
  timelineAdjacency: Record<string, TimelineAdjacencyEntry>;
  selectedResourceId: string | null;
  /** dbt invocation ID from the run_results metadata (if available). */
  invocationId?: string | null;
}
