import type { AnalysisState } from "../types";

const RESOURCE_TYPE_ORDER = [
  "model",
  "source",
  "test",
  "metric",
  "semantic_model",
  "exposure",
  "seed",
  "snapshot",
  "unit_test",
  "analysis",
  "macro",
];

function statusTone(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase();
  if (!normalized) return "neutral" as const;
  if (["success", "pass", "passed"].includes(normalized)) {
    return "positive" as const;
  }
  if (["warn", "warning"].includes(normalized)) {
    return "warning" as const;
  }
  if (["error", "fail", "failed", "run error"].includes(normalized)) {
    return "danger" as const;
  }
  return "neutral" as const;
}

function statusLabel(status: string | null | undefined): string {
  if (!status) return "Unknown";
  return status
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function resourceTypeLabel(resourceType: string): string {
  return resourceType
    .split("_")
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ");
}

function sortByResourceType(a: string, b: string): number {
  const aIndex = RESOURCE_TYPE_ORDER.indexOf(a);
  const bIndex = RESOURCE_TYPE_ORDER.indexOf(b);
  if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
  if (aIndex === -1) return 1;
  if (bIndex === -1) return -1;
  return aIndex - bIndex;
}

function sortResources(
  a: { resourceType: string; name: string },
  b: { resourceType: string; name: string },
): number {
  const typeOrder = sortByResourceType(a.resourceType, b.resourceType);
  if (typeOrder !== 0) return typeOrder;
  return a.name.localeCompare(b.name);
}

/**
 * Parses manifest and run_results JSON, runs analysis, and returns AnalysisState.
 * Shared by both file upload and API preload paths.
 */
export async function analyzeArtifacts(
  manifestJson: Record<string, unknown>,
  runResultsJson: Record<string, unknown>,
): Promise<AnalysisState> {
  const [manifestParser, runResultsParser, coreMod] = await Promise.all([
    import("dbt-artifacts-parser/manifest"),
    import("dbt-artifacts-parser/run_results"),
    import("@dbt-tools/core/browser"),
  ]);
  const manifest = manifestParser.parseManifest(manifestJson);
  const runResults = runResultsParser.parseRunResults(runResultsJson);

  const { ManifestGraph, ExecutionAnalyzer, detectBottlenecks } = coreMod;
  const graph = new ManifestGraph(manifest);
  const analyzer = new ExecutionAnalyzer(runResults, graph);

  const summary = analyzer.getSummary();
  const ganttData = analyzer.getGanttData();
  const nodeExecutions = analyzer.getNodeExecutions();
  const bottlenecks = detectBottlenecks(summary.node_executions, {
    mode: "top_n",
    top: 5,
    graph,
  });
  const graphSummary = graph.getSummary();
  const ganttById = new Map(ganttData.map((item) => [item.unique_id, item]));
  const executionById = new Map(
    nodeExecutions.map((execution) => [execution.unique_id, execution]),
  );

  const resources: AnalysisState["resources"] = [];
  const dependencyIndex: AnalysisState["dependencyIndex"] = {};

  const graphologyGraph = graph.getGraph();
  graphologyGraph.forEachNode((uniqueId, attributes) => {
    const execution = executionById.get(uniqueId);
    resources.push({
      uniqueId,
      name: String(attributes.name || uniqueId),
      resourceType: String(attributes.resource_type || "unknown"),
      packageName: String(attributes.package_name || ""),
      path: typeof attributes.path === "string" ? attributes.path : null,
      originalFilePath:
        typeof attributes.original_file_path === "string"
          ? attributes.original_file_path
          : null,
      description:
        typeof attributes.description === "string"
          ? attributes.description
          : null,
      status: execution?.status ? statusLabel(execution.status) : null,
      statusTone: statusTone(execution?.status),
      executionTime:
        typeof execution?.execution_time === "number"
          ? execution.execution_time
          : null,
      threadId:
        typeof execution?.thread_id === "string" ? execution.thread_id : null,
    });

    const upstream = graph.getUpstream(uniqueId);
    const downstream = graph.getDownstream(uniqueId);
    dependencyIndex[uniqueId] = {
      upstreamCount: upstream.length,
      downstreamCount: downstream.length,
      upstream: upstream.slice(0, 8).map((entry) => {
        const attrs = graphologyGraph.getNodeAttributes(entry.nodeId);
        return {
          uniqueId: entry.nodeId,
          name: String(attrs?.name || entry.nodeId),
          resourceType: String(attrs?.resource_type || "unknown"),
          depth: entry.depth,
        };
      }),
      downstream: downstream.slice(0, 8).map((entry) => {
        const attrs = graphologyGraph.getNodeAttributes(entry.nodeId);
        return {
          uniqueId: entry.nodeId,
          name: String(attrs?.name || entry.nodeId),
          resourceType: String(attrs?.resource_type || "unknown"),
          depth: entry.depth,
        };
      }),
    };
  });

  resources.sort(sortResources);

  const groupedResources = new Map<string, AnalysisState["resources"]>();
  for (const resource of resources) {
    const current = groupedResources.get(resource.resourceType) ?? [];
    current.push(resource);
    groupedResources.set(resource.resourceType, current);
  }

  const resourceGroups = [...groupedResources.entries()]
    .sort(([a], [b]) => sortByResourceType(a, b))
    .map(([resourceType, grouped]) => ({
      resourceType,
      label: resourceTypeLabel(resourceType),
      count: grouped.length,
      attentionCount: grouped.filter(
        (resource) =>
          resource.statusTone === "danger" || resource.statusTone === "warning",
      ).length,
      resources: grouped,
    }));

  const executions = nodeExecutions
    .map((execution) => {
      const attrs = graphologyGraph.hasNode(execution.unique_id)
        ? graphologyGraph.getNodeAttributes(execution.unique_id)
        : undefined;
      const gantt = ganttById.get(execution.unique_id);
      return {
        uniqueId: execution.unique_id,
        name: String(attrs?.name || execution.unique_id),
        resourceType: String(attrs?.resource_type || "operation"),
        packageName: String(attrs?.package_name || ""),
        path:
          typeof attrs?.original_file_path === "string"
            ? attrs.original_file_path
            : typeof attrs?.path === "string"
              ? attrs.path
              : null,
        status: statusLabel(execution.status),
        statusTone: statusTone(execution.status),
        executionTime: execution.execution_time ?? 0,
        threadId:
          typeof execution.thread_id === "string" ? execution.thread_id : null,
        start: gantt?.start ?? null,
        end: gantt?.end ?? null,
      };
    })
    .sort((a, b) => b.executionTime - a.executionTime);

  const durationByStatus = new Map<string, number>();
  for (const execution of nodeExecutions) {
    const status = statusLabel(execution.status);
    durationByStatus.set(
      status,
      (durationByStatus.get(status) ?? 0) + (execution.execution_time ?? 0),
    );
  }

  const statusBreakdown = Object.entries(summary.nodes_by_status)
    .map(([status, count]) => ({
      status: statusLabel(status),
      count,
      duration: durationByStatus.get(statusLabel(status)) ?? 0,
      share: summary.total_nodes > 0 ? count / summary.total_nodes : 0,
      tone: statusTone(status),
    }))
    .sort((a, b) => b.count - a.count);

  const threadAggregation = new Map<
    string,
    { count: number; totalExecutionTime: number }
  >();
  for (const execution of executions) {
    const threadId = execution.threadId ?? "unknown";
    const current = threadAggregation.get(threadId) ?? {
      count: 0,
      totalExecutionTime: 0,
    };
    current.count += 1;
    current.totalExecutionTime += execution.executionTime;
    threadAggregation.set(threadId, current);
  }

  const threadStats = [...threadAggregation.entries()]
    .map(([threadId, value]) => ({
      threadId,
      count: value.count,
      totalExecutionTime: value.totalExecutionTime,
    }))
    .sort((a, b) => b.totalExecutionTime - a.totalExecutionTime);

  const selectedResourceId =
    resources.find((resource) => resource.resourceType === "model")?.uniqueId ??
    resources[0]?.uniqueId ??
    null;

  return {
    summary,
    ganttData,
    bottlenecks,
    graphSummary: {
      totalNodes: graphSummary.total_nodes,
      totalEdges: graphSummary.total_edges,
      hasCycles: graphSummary.has_cycles,
      nodesByType: graphSummary.nodes_by_type,
    },
    resources,
    resourceGroups,
    executions,
    statusBreakdown,
    threadStats,
    dependencyIndex,
    selectedResourceId,
  };
}
