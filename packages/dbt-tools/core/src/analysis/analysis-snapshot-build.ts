import type { ParsedManifest } from "dbt-artifacts-parser/manifest";
import type { ParsedRunResults } from "dbt-artifacts-parser/run_results";
import { detectBottlenecks } from "./run-results-search";
import { ExecutionAnalyzer } from "./execution-analyzer";
import { ManifestGraph } from "./manifest-graph";
import type {
  AnalysisSnapshot,
  AnalysisSnapshotBuildTimings,
} from "./analysis-snapshot-types";
import type {
  GraphLike,
  GraphologyAttrsGraph,
  NeighborGraph,
} from "./analysis-snapshot-internal";
import {
  buildInvocationId,
  buildProjectName,
  buildResourceGroups,
  buildWarehouseType,
  inferPackageNameFromUniqueId,
  inferResourceTypeFromId,
  now,
  statusLabel,
  statusTone,
} from "./analysis-snapshot-shared";
import { buildResourcesAndDependencyIndex } from "./analysis-snapshot-resources";
import {
  buildManifestEntryLookup,
  buildSyntheticSourceRows,
  compareGanttItems,
  enrichGanttItemRow,
} from "./analysis-snapshot-gantt";
import {
  buildStatusBreakdown,
  buildThreadStats,
  buildTimelineAdjacency,
} from "./analysis-snapshot-executions";

export function buildAnalysisSnapshotFromParsedArtifacts(
  manifestJson: Record<string, unknown>,
  runResultsJson: Record<string, unknown>,
  manifest: ParsedManifest,
  runResults: ParsedRunResults,
): {
  analysis: AnalysisSnapshot;
  timings: AnalysisSnapshotBuildTimings;
  graph: ManifestGraph;
} {
  const graphStart = now();
  const graph = new ManifestGraph(manifest);
  const analyzer = new ExecutionAnalyzer(runResults, graph);
  const graphBuildMs = now() - graphStart;

  const snapshotStart = now();
  const projectName = buildProjectName(manifestJson);
  const warehouseType = buildWarehouseType(manifestJson);
  const summary = analyzer.getSummary();
  const manifestEntryLookup = buildManifestEntryLookup(manifestJson);
  const ganttData = analyzer.getGanttData();
  const nodeExecutions = analyzer.getNodeExecutions();
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
          const pkg = attrs?.package_name;
          if (typeof pkg === "string" && pkg.length > 0) return pkg;
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

  const analysis: AnalysisSnapshot = {
    summary,
    projectName,
    warehouseType,
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
    invocationId: buildInvocationId(runResultsJson),
  };

  return {
    analysis,
    timings: {
      graphBuildMs,
      snapshotBuildMs: now() - snapshotStart,
    },
    graph,
  };
}

export async function buildAnalysisSnapshotFromArtifacts(
  manifestJson: Record<string, unknown>,
  runResultsJson: Record<string, unknown>,
): Promise<AnalysisSnapshot> {
  const [{ parseManifest }, { parseRunResults }] = await Promise.all([
    import("dbt-artifacts-parser/manifest") as Promise<{
      parseManifest: (
        nextManifestJson: Record<string, unknown>,
      ) => ParsedManifest;
    }>,
    import("dbt-artifacts-parser/run_results") as Promise<{
      parseRunResults: (
        nextRunResultsJson: Record<string, unknown>,
      ) => ParsedRunResults;
    }>,
  ]);
  const manifest = parseManifest(manifestJson);
  const runResults = parseRunResults(runResultsJson);
  return buildAnalysisSnapshotFromParsedArtifacts(
    manifestJson,
    runResultsJson,
    manifest,
    runResults,
  ).analysis;
}
