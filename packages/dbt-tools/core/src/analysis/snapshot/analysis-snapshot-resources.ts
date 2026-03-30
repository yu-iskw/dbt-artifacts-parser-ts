import type { AnalysisSnapshot } from "./analysis-snapshot-types";
import type { GraphLike } from "./analysis-snapshot-internal";
import {
  buildResourceDefinition,
  sortResources,
  statusLabel,
  statusTone,
} from "./analysis-snapshot-shared";

export function buildResourcesAndDependencyIndex(
  graph: GraphLike,
  executionById: Map<
    string,
    { status?: string; execution_time?: number; thread_id?: string }
  >,
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
        compiledCode: null,
        rawCode: null,
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

      const upstream = graph.getUpstream(uniqueId, 1);
      const downstream = graph.getDownstream(uniqueId, 1);
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
