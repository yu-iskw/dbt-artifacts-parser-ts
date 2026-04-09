import type { NodeExecution } from "../execution-analyzer";
import { buildNodeExecutionSemantics } from "../node-execution-semantics";
import type {
  GraphLike,
  ManifestEntryLookup,
} from "./analysis-snapshot-internal";
import type { AnalysisSnapshot, ResourceNode } from "./analysis-snapshot-types";
import {
  buildResourceDefinition,
  sortResources,
  statusLabel,
  statusTone,
} from "./analysis-snapshot-shared";
import { buildTestAttachedTargetDisplay } from "./analysis-snapshot-test-target";

function optionalStringField(
  obj: Record<string, unknown>,
  key: string,
): string | null {
  const v = obj[key];
  return typeof v === "string" ? v : null;
}

function readGraphResourceCore(
  uniqueId: string,
  attributes: Record<string, unknown>,
) {
  return {
    uniqueId,
    name: String(attributes.name || uniqueId),
    resourceType: String(attributes.resource_type || "unknown"),
    packageName: String(attributes.package_name || ""),
    path: optionalStringField(attributes, "path"),
    originalFilePath: optionalStringField(attributes, "original_file_path"),
    patchPath: optionalStringField(attributes, "patch_path"),
    database: optionalStringField(attributes, "database"),
    schema: optionalStringField(attributes, "schema"),
    description: optionalStringField(attributes, "description"),
  };
}

function mapDependencyNeighbors(
  graph: GraphLike,
  graphologyGraph: ReturnType<GraphLike["getGraph"]>,
  uniqueId: string,
) {
  const upstream = graph.getUpstream(uniqueId, 1);
  const downstream = graph.getDownstream(uniqueId, 1);
  return {
    upstreamCount: upstream.length,
    downstreamCount: downstream.length,
    upstream: upstream.map((entry) => {
      const attrs = graphologyGraph.getNodeAttributes(entry.nodeId);
      return {
        uniqueId: entry.nodeId,
        name: String(attrs?.name || entry.nodeId),
        resourceType: String(attrs?.resource_type || "unknown"),
        depth: entry.depth,
      };
    }),
    downstream: downstream.map((entry) => {
      const attrs = graphologyGraph.getNodeAttributes(entry.nodeId);
      return {
        uniqueId: entry.nodeId,
        name: String(attrs?.name || entry.nodeId),
        resourceType: String(attrs?.resource_type || "unknown"),
        depth: entry.depth,
      };
    }),
  };
}

function buildResourceNode(
  uniqueId: string,
  attributes: Record<string, unknown>,
  execution: NodeExecution | undefined,
  manifestEntry: Record<string, unknown> | undefined,
  graph: GraphLike,
  manifestEntryLookup: ManifestEntryLookup,
  adapterType: string | null | undefined,
): ResourceNode {
  const core = readGraphResourceCore(uniqueId, attributes);
  const { resourceType } = core;
  const materializedRaw = optionalStringField(attributes, "materialized");
  const mat =
    materializedRaw != null && materializedRaw.trim() !== ""
      ? materializedRaw
      : null;
  const semantics = buildNodeExecutionSemantics({
    resourceType,
    materialized: mat,
    manifestEntry: manifestEntryLookup.get(uniqueId) ?? null,
    adapterType: adapterType ?? null,
  });
  const isTest = resourceType === "test" || resourceType === "unit_test";
  const testAttachedTarget = isTest
    ? buildTestAttachedTargetDisplay(manifestEntry, graph)
    : null;
  const runMsg = execution?.message;
  const runResultMessage =
    typeof runMsg === "string" && runMsg.trim() !== "" ? runMsg.trim() : null;

  return {
    ...core,
    compiledCode: null,
    rawCode: null,
    definition: buildResourceDefinition(resourceType, attributes),
    status: execution?.status ? statusLabel(execution.status) : null,
    statusTone: statusTone(execution?.status),
    executionTime:
      typeof execution?.execution_time === "number"
        ? execution.execution_time
        : null,
    threadId:
      typeof execution?.thread_id === "string" ? execution.thread_id : null,
    semantics,
    ...(testAttachedTarget != null ? { testAttachedTarget } : {}),
    ...(runResultMessage != null ? { runResultMessage } : {}),
    ...(execution?.adapterMetrics != null
      ? { adapterMetrics: execution.adapterMetrics }
      : {}),
    ...(execution?.adapterResponseFields != null
      ? { adapterResponseFields: execution.adapterResponseFields }
      : {}),
  };
}

export function buildResourcesAndDependencyIndex(
  graph: GraphLike,
  executionById: Map<string, NodeExecution>,
  manifestEntryLookup: ManifestEntryLookup,
  adapterType: string | null | undefined,
): {
  resources: AnalysisSnapshot["resources"];
  dependencyIndex: AnalysisSnapshot["dependencyIndex"];
} {
  const resources: AnalysisSnapshot["resources"] = [];
  const dependencyIndex: AnalysisSnapshot["dependencyIndex"] = {};
  const graphologyGraph = graph.getGraph();

  graphologyGraph.forEachNode(
    (uniqueId: string, attributes: Record<string, unknown>) => {
      const execution = executionById.get(uniqueId);
      const manifestEntry = manifestEntryLookup.get(uniqueId);
      resources.push(
        buildResourceNode(
          uniqueId,
          attributes,
          execution,
          manifestEntry,
          graph,
          manifestEntryLookup,
          adapterType,
        ),
      );
      dependencyIndex[uniqueId] = mapDependencyNeighbors(
        graph,
        graphologyGraph,
        uniqueId,
      );
    },
  );

  resources.sort(sortResources);
  return { resources, dependencyIndex };
}
