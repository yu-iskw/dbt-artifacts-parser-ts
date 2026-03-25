import type {
  AnalysisState,
  MetricDefinition,
  ResourceDefinition,
  SemanticModelDefinition,
} from "@web/types";

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

/**
 * Infer the dbt resource type from the unique_id prefix.
 * All dbt unique_ids follow the format `{resource_type}.{package}.{name}...`.
 * Used as a fallback when the node is absent from the manifest graph (e.g.
 * slight manifest/run_results version mismatch).
 */
function inferResourceTypeFromId(uniqueId: string): string {
  const prefix = uniqueId.split(".")[0] ?? "";
  const KNOWN = new Set([
    "model",
    "test",
    "unit_test",
    "seed",
    "snapshot",
    "source",
    "exposure",
    "metric",
    "semantic_model",
    "analysis",
    "macro",
  ]);
  return KNOWN.has(prefix) ? prefix : "operation";
}

function resourceTypeLabel(resourceType: string): string {
  return resourceType
    .split("_")
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function buildMetricDefinition(
  attributes: Record<string, unknown>,
): MetricDefinition {
  const primaryMeasure =
    typeof attributes.metric_measure === "string"
      ? attributes.metric_measure
      : null;
  const measures = normalizeStringArray(attributes.metric_input_measures);

  return {
    kind: "metric",
    label: typeof attributes.label === "string" ? attributes.label : null,
    description:
      typeof attributes.description === "string"
        ? attributes.description
        : null,
    metricType:
      typeof attributes.metric_type === "string"
        ? attributes.metric_type
        : null,
    expression:
      typeof attributes.metric_expression === "string"
        ? attributes.metric_expression
        : null,
    sourceReference:
      typeof attributes.metric_source_reference === "string"
        ? attributes.metric_source_reference
        : typeof attributes.metric_measure === "string"
          ? attributes.metric_measure
          : null,
    filters: normalizeStringArray(attributes.metric_filters),
    timeGranularity:
      typeof attributes.metric_time_granularity === "string"
        ? attributes.metric_time_granularity
        : null,
    measures:
      measures.length > 0
        ? measures
        : primaryMeasure != null
          ? [primaryMeasure]
          : [],
    metrics: normalizeStringArray(attributes.metric_input_metrics),
  };
}

function buildSemanticModelDefinition(
  attributes: Record<string, unknown>,
): SemanticModelDefinition {
  return {
    kind: "semantic_model",
    label: typeof attributes.label === "string" ? attributes.label : null,
    description:
      typeof attributes.description === "string"
        ? attributes.description
        : null,
    sourceReference:
      typeof attributes.semantic_model_reference === "string"
        ? attributes.semantic_model_reference
        : null,
    defaultTimeDimension:
      typeof attributes.semantic_model_default_time_dimension === "string"
        ? attributes.semantic_model_default_time_dimension
        : null,
    entities: normalizeStringArray(attributes.semantic_model_entities),
    measures: normalizeStringArray(attributes.semantic_model_measures),
    dimensions: normalizeStringArray(attributes.semantic_model_dimensions),
  };
}

function buildResourceDefinition(
  resourceType: string,
  attributes: Record<string, unknown>,
): ResourceDefinition | null {
  if (resourceType === "metric") {
    return buildMetricDefinition(attributes);
  }
  if (resourceType === "semantic_model") {
    return buildSemanticModelDefinition(attributes);
  }
  return null;
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

type GraphLike = {
  getGraph: () => {
    forEachNode: (
      fn: (id: string, attrs: Record<string, unknown>) => void,
    ) => void;
    getNodeAttributes: (id: string) => Record<string, unknown> | undefined;
    hasNode: (id: string) => boolean;
  };
  getUpstream: (id: string) => Array<{ nodeId: string; depth: number }>;
  getDownstream: (id: string) => Array<{ nodeId: string; depth: number }>;
};

function buildResourcesAndDependencyIndex(
  graph: GraphLike,
  executionById: Map<
    string,
    { status?: string; execution_time?: number; thread_id?: string }
  >,
): {
  resources: AnalysisState["resources"];
  dependencyIndex: AnalysisState["dependencyIndex"];
} {
  const resources: AnalysisState["resources"] = [];
  const dependencyIndex: AnalysisState["dependencyIndex"] = {};
  const graphologyGraph = graph.getGraph();

  graphologyGraph.forEachNode(
    (uniqueId: string, attributes: Record<string, unknown>) => {
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
        patchPath:
          typeof attributes.patch_path === "string"
            ? attributes.patch_path
            : null,
        database:
          typeof attributes.database === "string" ? attributes.database : null,
        schema:
          typeof attributes.schema === "string" ? attributes.schema : null,
        description:
          typeof attributes.description === "string"
            ? attributes.description
            : null,
        compiledCode:
          typeof attributes.compiled_code === "string"
            ? attributes.compiled_code
            : null,
        rawCode:
          typeof attributes.raw_code === "string" ? attributes.raw_code : null,
        definition: buildResourceDefinition(
          String(attributes.resource_type || "unknown"),
          attributes,
        ),
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
    },
  );

  resources.sort(sortResources);
  return { resources, dependencyIndex };
}

function buildResourceGroups(resources: AnalysisState["resources"]) {
  const groupedResources = new Map<string, AnalysisState["resources"]>();
  for (const resource of resources) {
    const current = groupedResources.get(resource.resourceType) ?? [];
    current.push(resource);
    groupedResources.set(resource.resourceType, current);
  }
  return [...groupedResources.entries()]
    .sort(([a], [b]) => sortByResourceType(a, b))
    .map(([resourceType, grouped]) => ({
      resourceType,
      label: resourceTypeLabel(resourceType),
      count: grouped.length,
      attentionCount: grouped.filter(
        (r) => r.statusTone === "danger" || r.statusTone === "warning",
      ).length,
      resources: grouped,
    }));
}

function buildStatusBreakdown(
  summary: { nodes_by_status: Record<string, number>; total_nodes: number },
  nodeExecutions: Array<{ status?: string; execution_time?: number }>,
) {
  const durationByStatus = new Map<string, number>();
  for (const execution of nodeExecutions) {
    const status = statusLabel(execution.status);
    durationByStatus.set(
      status,
      (durationByStatus.get(status) ?? 0) + (execution.execution_time ?? 0),
    );
  }
  return Object.entries(summary.nodes_by_status)
    .map(([status, count]) => ({
      status: statusLabel(status),
      count,
      duration: durationByStatus.get(statusLabel(status)) ?? 0,
      share: summary.total_nodes > 0 ? count / summary.total_nodes : 0,
      tone: statusTone(status),
    }))
    .sort((a, b) => b.count - a.count);
}

function buildThreadStats(
  executions: Array<{ threadId: string | null; executionTime: number }>,
) {
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
  return [...threadAggregation.entries()]
    .map(([threadId, value]) => ({
      threadId,
      count: value.count,
      totalExecutionTime: value.totalExecutionTime,
    }))
    .sort((a, b) => b.totalExecutionTime - a.totalExecutionTime);
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

  // Prefer the project name embedded in manifest metadata (available in dbt
  // manifests >= v9). Fall back to null; AnalysisWorkspace derives it
  // heuristically from execution package names.
  const metaMaybe = (manifestJson as Record<string, unknown>).metadata;
  const projectName: string | null =
    metaMaybe !== null &&
    typeof metaMaybe === "object" &&
    "project_name" in (metaMaybe as object) &&
    typeof (metaMaybe as Record<string, unknown>).project_name === "string" &&
    (metaMaybe as Record<string, string>).project_name !== ""
      ? (metaMaybe as Record<string, string>).project_name
      : null;

  const summary = analyzer.getSummary();
  // Timeline rows are executed nodes from this run (with timing), not the full
  // project catalog. Large projects still have one row per executed parent.
  const ganttData = analyzer.getGanttData();
  const nodeExecutions = analyzer.getNodeExecutions();

  // Compute the wall-clock anchor for the Gantt timeline. We derive this
  // directly from nodeExecutions so there is no dependency on the compiled
  // dist of @dbt-tools/core (which could be stale in Vite's dep-bundle cache).
  const startTimestamps = nodeExecutions
    .map((e) => (e.started_at ? new Date(e.started_at).getTime() : null))
    .filter((t): t is number => t !== null);
  const runStartedAt: number | null =
    startTimestamps.length > 0 ? Math.min(...startTimestamps) : null;

  const bottlenecks = detectBottlenecks(summary.node_executions, {
    mode: "top_n",
    top: 5,
    graph,
  });
  const graphSummary = graph.getSummary();
  const ganttById = new Map(ganttData.map((item) => [item.unique_id, item]));
  const executionById = new Map(nodeExecutions.map((e) => [e.unique_id, e]));

  const { resources, dependencyIndex } = buildResourcesAndDependencyIndex(
    graph as unknown as GraphLike,
    executionById,
  );

  const graphologyGraph = graph.getGraph();

  // Enrich each GanttItem with its resource_type, packageName, path, and
  // parentId (for test nodes) from the manifest graph.
  const enrichedGanttData = ganttData.map((item) => {
    const attrs = graphologyGraph.hasNode(item.unique_id)
      ? graphologyGraph.getNodeAttributes(item.unique_id)
      : undefined;
    const rtRaw = attrs?.resource_type;
    const resourceType =
      typeof rtRaw === "string" && rtRaw
        ? rtRaw
        : inferResourceTypeFromId(item.unique_id);

    // Resolve parent for test nodes via the manifest graph upstream edges.
    // Tests reference their tested node via depends_on.nodes (depth=1 upstream).
    let parentId: string | null = null;
    if (resourceType === "test" || resourceType === "unit_test") {
      const upstream = (graph as unknown as GraphLike).getUpstream(
        item.unique_id,
      );
      // Prefer depth-1 (direct) upstream; fall back to any depth.
      const direct = upstream.filter((u) => u.depth === 1);
      const candidates = direct.length > 0 ? direct : upstream;
      for (const u of candidates) {
        const uAttrs = graphologyGraph.hasNode(u.nodeId)
          ? graphologyGraph.getNodeAttributes(u.nodeId)
          : undefined;
        const uType = String(uAttrs?.resource_type ?? "");
        if (uType !== "test" && uType !== "unit_test" && uType !== "") {
          parentId = u.nodeId;
          break;
        }
      }
    }

    return {
      ...item,
      resourceType,
      packageName:
        typeof attrs?.package_name === "string" ? attrs.package_name : "",
      path:
        typeof attrs?.original_file_path === "string"
          ? attrs.original_file_path
          : typeof attrs?.path === "string"
            ? attrs.path
            : null,
      parentId,
    };
  });

  const executions = nodeExecutions
    .map((execution) => {
      const attrs = graphologyGraph.hasNode(execution.unique_id)
        ? graphologyGraph.getNodeAttributes(execution.unique_id)
        : undefined;
      const gantt = ganttById.get(execution.unique_id);
      return {
        uniqueId: execution.unique_id,
        name: String(attrs?.name || execution.unique_id),
        resourceType: String(
          attrs?.resource_type || inferResourceTypeFromId(execution.unique_id),
        ),
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

  const resourceGroups = buildResourceGroups(resources);
  const statusBreakdown = buildStatusBreakdown(summary, nodeExecutions);
  const threadStats = buildThreadStats(executions);

  const selectedResourceId =
    resources.find((r) => r.resourceType === "model")?.uniqueId ??
    resources[0]?.uniqueId ??
    null;

  return {
    summary,
    projectName,
    runStartedAt,
    ganttData: enrichedGanttData,
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
