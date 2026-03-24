declare module "@dbt-tools/core/browser" {
  export interface NodeExecution {
    unique_id: string;
    status: string;
    execution_time: number;
    started_at?: string;
    completed_at?: string;
    thread_id?: string;
  }

  export interface CriticalPath {
    path: string[];
  }

  export interface ExecutionSummary {
    total_execution_time: number;
    total_nodes: number;
    nodes_by_status: Record<string, number>;
    node_executions: NodeExecution[];
    critical_path?: CriticalPath | null;
  }

  export interface BottleneckNode {
    rank: number;
    unique_id: string;
    name?: string | null;
    execution_time: number;
    pct_of_total: number;
  }

  export interface BottleneckResult {
    nodes: BottleneckNode[];
  }

  export class ManifestGraph {
    constructor(manifest: unknown);
    getSummary(): {
      total_nodes: number;
      total_edges: number;
      has_cycles: boolean;
      nodes_by_type: Record<string, number>;
    };
    getGraph(): {
      hasNode(nodeId: string): boolean;
      getNodeAttributes(nodeId: string): Record<string, unknown> | undefined;
      forEachNode(
        callback: (nodeId: string, attrs: Record<string, unknown>) => void,
      ): void;
      inNeighbors(nodeId: string): string[];
      outNeighbors(nodeId: string): string[];
    };
  }

  export class ExecutionAnalyzer {
    constructor(runResults: unknown, graph: ManifestGraph);
    getSummary(): ExecutionSummary;
    getGanttData(): Array<{
      unique_id: string;
      name: string;
      start: number;
      end: number;
      duration: number;
      status: string;
    }>;
    getNodeExecutions(): NodeExecution[];
  }

  export function detectBottlenecks(
    nodeExecutions: NodeExecution[],
    options: Record<string, unknown>,
  ): BottleneckResult | undefined;
}

declare module "dbt-artifacts-parser/manifest" {
  export type ParsedManifest = unknown;
  export function parseManifest(
    parsed: Record<string, unknown>,
  ): ParsedManifest;
}

declare module "dbt-artifacts-parser/run_results" {
  export type ParsedRunResults = unknown;
  export function parseRunResults(
    parsed: Record<string, unknown>,
  ): ParsedRunResults;
}
