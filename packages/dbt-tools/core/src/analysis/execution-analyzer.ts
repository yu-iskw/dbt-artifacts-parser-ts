// @ts-expect-error - workspace package, TypeScript resolves via package.json
import type { ParsedRunResults } from "dbt-artifacts-parser/run_results";
import type { ManifestGraph } from "./manifest-graph";
/**
 * Execution timing information for a single node
 */
export interface NodeExecution {
  unique_id: string;
  status: string;
  execution_time: number;
  started_at?: string;
  completed_at?: string;
  thread_id?: string;
}

/**
 * Critical path analysis result
 */
export interface CriticalPath {
  path: string[];
  total_time: number;
}

/**
 * Execution summary statistics
 */
export interface ExecutionSummary {
  total_execution_time: number;
  total_nodes: number;
  nodes_by_status: Record<string, number>;
  critical_path?: CriticalPath;
  node_executions: NodeExecution[];
}

/**
 * ExecutionAnalyzer processes run_results.json to extract timing information
 * and correlate it with the dependency graph.
 */
export class ExecutionAnalyzer {
  private runResults: ParsedRunResults;
  private graph: ManifestGraph;

  constructor(runResults: ParsedRunResults, graph: ManifestGraph) {
    this.runResults = runResults;
    this.graph = graph;
  }

  /**
   * Get execution summary with statistics
   */
  getSummary(): ExecutionSummary {
    const nodeExecutions = this.getNodeExecutions();
    const nodesByStatus: Record<string, number> = {};
    let totalExecutionTime = 0;

    for (const execution of nodeExecutions) {
      // Count by status
      const status = execution.status || "unknown";
      nodesByStatus[status] = (nodesByStatus[status] || 0) + 1;

      // Sum execution time
      totalExecutionTime += execution.execution_time || 0;
    }

    // Calculate critical path
    const criticalPath = this.calculateCriticalPath(nodeExecutions);

    return {
      total_execution_time: totalExecutionTime,
      total_nodes: nodeExecutions.length,
      nodes_by_status: nodesByStatus,
      critical_path: criticalPath,
      node_executions: nodeExecutions,
    };
  }

  /**
   * Extract execution information for each node
   */
  getNodeExecutions(): NodeExecution[] {
    if (!this.runResults.results || !Array.isArray(this.runResults.results)) {
      return [];
    }

    return this.runResults.results.map((result: Record<string, unknown>) => {
      // Find execute timing (most relevant for execution time)
      const timingArray =
        (result.timing as Array<Record<string, unknown>>) || [];
      const executeTiming = timingArray.find(
        (t: Record<string, unknown>) => t.name === "execute",
      );
      const compileTiming = timingArray.find(
        (t: Record<string, unknown>) => t.name === "compile",
      );

      // Use execute timing if available, otherwise fall back to compile
      const timing = executeTiming || compileTiming || timingArray[0];

      return {
        unique_id: (result.unique_id as string) || "",
        status: (result.status as string) || "unknown",
        execution_time: (result.execution_time as number) || 0,
        started_at: (timing?.started_at as string) || undefined,
        completed_at: (timing?.completed_at as string) || undefined,
        thread_id: (result.thread_id as string) || undefined,
      };
    });
  }

  /**
   * Calculate the critical path (longest path through the dependency graph)
   */
  calculateCriticalPath(
    nodeExecutions: NodeExecution[],
  ): CriticalPath | undefined {
    // Create a map of node executions by unique_id
    const executionMap = new Map<string, NodeExecution>();
    for (const exec of nodeExecutions) {
      executionMap.set(exec.unique_id, exec);
    }

    // Find all leaf nodes (nodes with no downstream dependents)
    const leafNodes: string[] = [];
    const graph = this.graph.getGraph();

    graph.forEachNode((nodeId) => {
      const outboundNeighbors = graph.outboundNeighbors(nodeId);
      if (outboundNeighbors.length === 0 && executionMap.has(nodeId)) {
        leafNodes.push(nodeId);
      }
    });

    if (leafNodes.length === 0) {
      return undefined;
    }

    // For each leaf node, find the longest path from root
    let maxPath: string[] = [];
    let maxTime = 0;

    for (const leafNode of leafNodes) {
      const path = this.findLongestPathToRoot(leafNode, executionMap);
      const pathTime = this.calculatePathTime(path, executionMap);

      if (pathTime > maxTime) {
        maxTime = pathTime;
        maxPath = path;
      }
    }

    if (maxPath.length === 0) {
      return undefined;
    }

    return {
      path: maxPath,
      total_time: maxTime,
    };
  }

  /**
   * Find the longest path from a node to root (nodes with no dependencies)
   */
  private findLongestPathToRoot(
    startNode: string,
    executionMap: Map<string, NodeExecution>,
  ): string[] {
    const graph = this.graph.getGraph();
    const visited = new Set<string>();
    let longestPath: string[] = [];

    const dfs = (currentNode: string, currentPath: string[]): void => {
      if (visited.has(currentNode)) {
        return;
      }

      visited.add(currentNode);
      const newPath = [...currentPath, currentNode];

      // Update longest path if this is longer
      if (newPath.length > longestPath.length) {
        longestPath = newPath;
      }

      // Traverse upstream (inbound neighbors)
      const inboundNeighbors = graph.inboundNeighbors(currentNode);
      for (const neighbor of inboundNeighbors) {
        if (executionMap.has(neighbor)) {
          dfs(neighbor, newPath);
        }
      }

      visited.delete(currentNode);
    };

    dfs(startNode, []);
    return longestPath.reverse(); // Reverse to get root-to-leaf order
  }

  /**
   * Calculate total execution time for a path
   */
  private calculatePathTime(
    path: string[],
    executionMap: Map<string, NodeExecution>,
  ): number {
    let totalTime = 0;
    for (const nodeId of path) {
      const exec = executionMap.get(nodeId);
      if (exec) {
        totalTime += exec.execution_time || 0;
      }
    }
    return totalTime;
  }

  /**
   * Get Gantt chart data for visualization
   */
  getGanttData(): Array<{
    unique_id: string;
    name: string;
    start: number;
    end: number;
    duration: number;
    status: string;
  }> {
    const executions = this.getNodeExecutions();

    // Parse timestamps and convert to milliseconds since start
    const executionsWithTimestamps = executions
      .map((exec) => {
        const start = exec.started_at
          ? new Date(exec.started_at).getTime()
          : null;
        const end = exec.completed_at
          ? new Date(exec.completed_at).getTime()
          : null;

        return {
          ...exec,
          start,
          end,
        };
      })
      .filter((exec) => exec.start !== null && exec.end !== null);

    if (executionsWithTimestamps.length === 0) {
      return [];
    }

    // Find the earliest start time
    const minStart = Math.min(...executionsWithTimestamps.map((e) => e.start!));

    // Convert to relative times (milliseconds from start)
    return executionsWithTimestamps.map((exec) => {
      const graphologyGraph = this.graph.getGraph();
      const nodeAttributes = graphologyGraph.hasNode(exec.unique_id)
        ? graphologyGraph.getNodeAttributes(exec.unique_id)
        : undefined;
      const name = nodeAttributes?.name || exec.unique_id;

      return {
        unique_id: exec.unique_id,
        name,
        start: exec.start! - minStart,
        end: exec.end! - minStart,
        duration: exec.end! - exec.start!,
        status: exec.status,
      };
    });
  }
}
