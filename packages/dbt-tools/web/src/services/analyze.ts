import type {
  AnalysisState,
  CatalogColumn,
  GanttItem,
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
function inferPackageNameFromUniqueId(uniqueId: string): string {
  const parts = uniqueId.split(".");
  if (parts.length < 2) return "";
  return parts[1] ?? "";
}

function inferResourceTypeFromId(uniqueId: string): string {
  const prefix = uniqueId.split(".")[0] ?? "";
  const KNOWN = new Set([
    "model",
    "test",
    "unit_test",
    "seed",
    "snapshot",
    "source",
    "source_freshness",
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
  catalogColumnsByUniqueId: Map<string, CatalogColumn[]>,
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
      const columns = catalogColumnsByUniqueId.get(uniqueId);
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
        ...(columns !== undefined && { columns }),
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

type GraphologyAttrsGraph = {
  hasNode(nodeId: string): boolean;
  getNodeAttributes(nodeId: string): Record<string, unknown> | undefined;
};

type ManifestEntryLookup = Map<string, Record<string, unknown>>;

function buildManifestEntryLookup(
  manifestJson: Record<string, unknown>,
): ManifestEntryLookup {
  const lookup: ManifestEntryLookup = new Map();

  const addEntries = (value: unknown) => {
    if (value == null || typeof value !== "object") return;
    for (const [key, entry] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (entry != null && typeof entry === "object") {
        lookup.set(key, entry as Record<string, unknown>);
      }
    }
  };

  addEntries(manifestJson.nodes);
  addEntries(manifestJson.sources);
  addEntries(manifestJson.unit_tests);

  if (
    manifestJson.disabled != null &&
    typeof manifestJson.disabled === "object"
  ) {
    for (const [key, entries] of Object.entries(
      manifestJson.disabled as Record<string, unknown>,
    )) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (entry != null && typeof entry === "object") {
          lookup.set(key, entry as Record<string, unknown>);
        }
      }
    }
  }

  return lookup;
}

function getManifestAttrs(
  uniqueId: string,
  graphologyGraph: GraphologyAttrsGraph,
  manifestEntryLookup: ManifestEntryLookup,
): Record<string, unknown> | undefined {
  if (graphologyGraph.hasNode(uniqueId)) {
    return graphologyGraph.getNodeAttributes(uniqueId);
  }
  return manifestEntryLookup.get(uniqueId);
}

function resolveTestParentFromManifest(
  graph: GraphLike,
  graphologyGraph: GraphologyAttrsGraph,
  manifestEntryLookup: ManifestEntryLookup,
  testUniqueId: string,
): string | null {
  const upstream = graph.getUpstream(testUniqueId);
  const direct = upstream.filter((u) => u.depth === 1);
  const candidates = direct.length > 0 ? direct : upstream;
  for (const u of candidates) {
    const uAttrs = getManifestAttrs(
      u.nodeId,
      graphologyGraph,
      manifestEntryLookup,
    );
    const uType = String(uAttrs?.resource_type ?? "");
    if (uType !== "test" && uType !== "unit_test" && uType !== "") {
      return u.nodeId;
    }
  }

  const testAttrs = manifestEntryLookup.get(testUniqueId);
  const attachedNode =
    typeof testAttrs?.attached_node === "string"
      ? testAttrs.attached_node
      : null;
  if (attachedNode != null) {
    return attachedNode;
  }

  const dependsOn = testAttrs?.depends_on as
    | { nodes?: unknown; macros?: unknown }
    | undefined;
  if (Array.isArray(dependsOn?.nodes)) {
    for (const parentId of dependsOn.nodes) {
      if (typeof parentId !== "string") continue;
      const parentAttrs = getManifestAttrs(
        parentId,
        graphologyGraph,
        manifestEntryLookup,
      );
      const parentType = String(
        parentAttrs?.resource_type ?? inferResourceTypeFromId(parentId),
      );
      if (parentType !== "test" && parentType !== "unit_test") {
        return parentId;
      }
    }
  }

  return null;
}

function manifestDisplayPath(
  attrs: Record<string, unknown> | undefined,
): string | null {
  if (typeof attrs?.original_file_path === "string") {
    return attrs.original_file_path;
  }
  if (typeof attrs?.path === "string") {
    return attrs.path;
  }
  return null;
}

function enrichGanttItemRow(
  item: {
    unique_id: string;
    name: string;
    start: number;
    end: number;
    duration: number;
    status: string;
    compileStart?: number | null;
    compileEnd?: number | null;
    executeStart?: number | null;
    executeEnd?: number | null;
  },
  graph: GraphLike,
  graphologyGraph: GraphologyAttrsGraph,
  manifestEntryLookup: ManifestEntryLookup,
): GanttItem {
  const attrs = getManifestAttrs(
    item.unique_id,
    graphologyGraph,
    manifestEntryLookup,
  );
  const rtRaw = attrs?.resource_type;
  const resourceType =
    typeof rtRaw === "string" && rtRaw
      ? rtRaw
      : inferResourceTypeFromId(item.unique_id);

  const parentId =
    resourceType === "test" || resourceType === "unit_test"
      ? resolveTestParentFromManifest(
          graph,
          graphologyGraph,
          manifestEntryLookup,
          item.unique_id,
        )
      : null;

  const pkg =
    typeof attrs?.package_name === "string" && attrs.package_name.length > 0
      ? attrs.package_name
      : inferPackageNameFromUniqueId(item.unique_id);

  const mat = attrs?.materialized;
  const materialized =
    typeof mat === "string" && mat.trim() !== "" ? mat : null;

  return {
    ...item,
    resourceType,
    packageName: pkg,
    path: manifestDisplayPath(attrs),
    parentId,
    materialized,
  };
}

function statusSeverity(status: string | null | undefined): number {
  const normalized = status?.trim().toLowerCase();
  if (!normalized) return 0;
  if (["error", "fail", "failed", "run error"].includes(normalized)) {
    return 3;
  }
  if (["warn", "warning"].includes(normalized)) {
    return 2;
  }
  if (["success", "pass", "passed"].includes(normalized)) {
    return 1;
  }
  return 0;
}

function pickRepresentativeStatus(items: GanttItem[]): string {
  let bestStatus = items[0]?.status ?? "unknown";
  let bestSeverity = statusSeverity(bestStatus);

  for (const item of items.slice(1)) {
    const severity = statusSeverity(item.status);
    if (severity > bestSeverity) {
      bestSeverity = severity;
      bestStatus = item.status;
    }
  }

  return bestStatus;
}

function compareGanttItems(a: GanttItem, b: GanttItem): number {
  const startDiff = a.start - b.start;
  if (startDiff !== 0) return startDiff;

  const durationDiff = b.duration - a.duration;
  if (durationDiff !== 0) return durationDiff;

  return a.name.localeCompare(b.name);
}

function buildSyntheticSourceRows(
  enrichedGanttData: GanttItem[],
  graphologyGraph: GraphologyAttrsGraph,
): GanttItem[] {
  const existingIds = new Set(enrichedGanttData.map((item) => item.unique_id));
  const testsBySourceId = new Map<string, GanttItem[]>();

  for (const item of enrichedGanttData) {
    if (
      (item.resourceType !== "test" && item.resourceType !== "unit_test") ||
      item.parentId == null ||
      !graphologyGraph.hasNode(item.parentId)
    ) {
      continue;
    }

    const parentAttrs = graphologyGraph.getNodeAttributes(item.parentId);
    if (String(parentAttrs?.resource_type ?? "") !== "source") {
      continue;
    }

    const existing = testsBySourceId.get(item.parentId) ?? [];
    existing.push(item);
    testsBySourceId.set(item.parentId, existing);
  }

  const syntheticRows: GanttItem[] = [];
  for (const [sourceId, tests] of testsBySourceId.entries()) {
    if (existingIds.has(sourceId) || tests.length === 0) {
      continue;
    }

    const sourceAttrs = graphologyGraph.getNodeAttributes(sourceId);
    const sortedTests = [...tests].sort(compareGanttItems);
    const start = Math.min(...sortedTests.map((item) => item.start));
    const end = Math.max(...sortedTests.map((item) => item.end));

    syntheticRows.push({
      unique_id: sourceId,
      name:
        typeof sourceAttrs?.name === "string" && sourceAttrs.name.length > 0
          ? sourceAttrs.name
          : sourceId,
      start,
      end,
      duration: Math.max(0, end - start),
      status: pickRepresentativeStatus(sortedTests),
      resourceType: "source",
      packageName:
        typeof sourceAttrs?.package_name === "string" &&
        sourceAttrs.package_name.length > 0
          ? sourceAttrs.package_name
          : inferPackageNameFromUniqueId(sourceId),
      path: manifestDisplayPath(sourceAttrs),
      parentId: null,
      compileStart: null,
      compileEnd: null,
      executeStart: null,
      executeEnd: null,
      materialized: null,
    });
  }

  return syntheticRows.sort(compareGanttItems);
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

/** Minimal graphology surface for timeline neighbor lists. */
interface NeighborGraph {
  hasNode(id: string): boolean;
  inboundNeighbors(id: string): Iterable<string>;
  outboundNeighbors(id: string): Iterable<string>;
}

function buildTimelineAdjacency(
  graphologyGraph: NeighborGraph,
  executedUniqueIds: string[],
): AnalysisState["timelineAdjacency"] {
  const out: AnalysisState["timelineAdjacency"] = {};
  for (const id of executedUniqueIds) {
    out[id] = graphologyGraph.hasNode(id)
      ? {
          inbound: [...graphologyGraph.inboundNeighbors(id)],
          outbound: [...graphologyGraph.outboundNeighbors(id)],
        }
      : { inbound: [], outbound: [] };
  }
  return out;
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

type CatalogTableLike = {
  columns: Record<
    string,
    { name: string; type: string; index: number; comment?: string | null }
  >;
  unique_id?: string | null;
};

function buildCatalogColumnIndex(
  catalogJson: Record<string, unknown>,
): Map<string, CatalogColumn[]> {
  const index = new Map<string, CatalogColumn[]>();

  const addTable = (uniqueId: string, table: CatalogTableLike) => {
    const cols = Object.values(table.columns)
      .map((c) => ({
        name: c.name,
        type: c.type,
        index: c.index,
        comment: c.comment ?? null,
      }))
      .sort((a, b) => a.index - b.index);
    if (cols.length > 0) index.set(uniqueId, cols);
  };

  const nodesRaw = catalogJson.nodes;
  if (nodesRaw != null && typeof nodesRaw === "object") {
    for (const [key, table] of Object.entries(
      nodesRaw as Record<string, unknown>,
    )) {
      if (table == null || typeof table !== "object") continue;
      const t = table as CatalogTableLike;
      const id = typeof t.unique_id === "string" ? t.unique_id : key;
      addTable(id, t);
    }
  }

  const sourcesRaw = catalogJson.sources;
  if (sourcesRaw != null && typeof sourcesRaw === "object") {
    for (const [key, table] of Object.entries(
      sourcesRaw as Record<string, unknown>,
    )) {
      if (table == null || typeof table !== "object") continue;
      const t = table as CatalogTableLike;
      const id = typeof t.unique_id === "string" ? t.unique_id : key;
      addTable(id, t);
    }
  }

  return index;
}

/**
 * Parses manifest and run_results JSON, runs analysis, and returns AnalysisState.
 * Shared by both file upload and API preload paths.
 * catalogJson is optional — when absent, all views work identically without column metadata.
 */
export async function analyzeArtifacts(
  manifestJson: Record<string, unknown>,
  runResultsJson: Record<string, unknown>,
  catalogJson?: Record<string, unknown>,
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
  const manifestEntryLookup = buildManifestEntryLookup(manifestJson);
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

  const catalogColumnsByUniqueId =
    catalogJson != null
      ? buildCatalogColumnIndex(catalogJson)
      : new Map<string, CatalogColumn[]>();

  const { resources, dependencyIndex } = buildResourcesAndDependencyIndex(
    graph as unknown as GraphLike,
    executionById,
    catalogColumnsByUniqueId,
  );

  const graphologyGraph = graph.getGraph();

  // Enrich each GanttItem with its resource_type, packageName, path, and
  // parentId (for test nodes) from the manifest graph.
  const enrichedGanttData = ganttData.map((item) =>
    enrichGanttItemRow(
      item,
      graph as unknown as GraphLike,
      graphologyGraph as GraphologyAttrsGraph,
      manifestEntryLookup,
    ),
  );
  const syntheticSourceRows = buildSyntheticSourceRows(
    enrichedGanttData,
    graphologyGraph as GraphologyAttrsGraph,
  );
  const timelineGanttData = [...enrichedGanttData, ...syntheticSourceRows].sort(
    compareGanttItems,
  );

  const timelineAdjacency = buildTimelineAdjacency(
    graphologyGraph as unknown as NeighborGraph,
    timelineGanttData.map((g) => g.unique_id),
  );

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
        packageName: (() => {
          const p = attrs?.package_name;
          if (typeof p === "string" && p.length > 0) return p;
          return inferPackageNameFromUniqueId(execution.unique_id);
        })(),
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
    ganttData: timelineGanttData,
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
    timelineAdjacency,
    selectedResourceId,
  };
}
