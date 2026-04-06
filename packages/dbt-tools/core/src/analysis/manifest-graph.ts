import { DirectedGraph } from "graphology";
import { hasCycle, topologicalSort } from "graphology-dag";
import type { ParsedManifest } from "dbt-artifacts-parser/manifest";
import type { ParsedCatalog } from "dbt-artifacts-parser/catalog";
import type {
  GraphNodeAttributes,
  GraphEdgeAttributes,
  GraphSummary,
  DbtResourceType,
} from "../types";
import {
  isSupportedVersion,
  getVersionInfo,
  MIN_SUPPORTED_SCHEMA_VERSION,
} from "../version";
import type { ColumnDependencyMap } from "./sql-analyzer";

type ManifestEntryMap = Record<string, unknown>;
type OptionalManifestCollections = ParsedManifest & {
  metrics?: ManifestEntryMap;
  semantic_models?: ManifestEntryMap;
  unit_tests?: ManifestEntryMap;
};

function getManifestMetrics(
  manifest: ParsedManifest,
): ManifestEntryMap | undefined {
  return (manifest as OptionalManifestCollections).metrics;
}

function getManifestSemanticModels(
  manifest: ParsedManifest,
): ManifestEntryMap | undefined {
  return (manifest as OptionalManifestCollections).semantic_models;
}

function getManifestUnitTests(
  manifest: ParsedManifest,
): ManifestEntryMap | undefined {
  return (manifest as OptionalManifestCollections).unit_tests;
}
/**
 * ManifestGraph builds and manages a directed graph from a dbt manifest.
 *
 * This class transforms dbt artifacts into a graphology graph, enabling
 * efficient graph operations like cycle detection, path finding, and traversal.
 */
export class ManifestGraph {
  private graph: DirectedGraph<GraphNodeAttributes, GraphEdgeAttributes>;
  private relationMap: Map<string, string> = new Map(); // relation_name -> unique_id

  constructor(manifest: ParsedManifest) {
    if (!isSupportedVersion(manifest)) {
      const versionInfo = getVersionInfo(manifest);
      throw new Error(
        `Unsupported dbt version. ` +
          `Schema version: ${versionInfo.schema_version || "unknown"}, ` +
          `dbt version: ${versionInfo.dbt_version || "unknown"}. ` +
          `Requires dbt 1.10+ (manifest schema v${MIN_SUPPORTED_SCHEMA_VERSION}+)`,
      );
    }
    this.graph = new DirectedGraph<GraphNodeAttributes, GraphEdgeAttributes>();
    this.buildGraph(manifest);
  }

  /**
   * Build the graph from manifest data
   */
  private buildGraph(manifest: ParsedManifest): void {
    // Add all nodes from manifest
    this.addNodes(manifest);

    // Add edges based on dependencies
    this.addEdges(manifest);
  }

  /**
   * Add nodes from manifest to the graph
   */
  /** Map relation_name (lowercase) to unique_id when present on manifest entries. */
  private registerRelationName(uniqueId: string, relationName: unknown): void {
    if (!relationName) return;
    this.relationMap.set((relationName as string).toLowerCase(), uniqueId);
  }

  private addNodes(manifest: ParsedManifest): void {
    this.addNodeEntries(manifest.nodes);
    this.addSourceEntries(manifest.sources);
    this.addMacroEntries(manifest.macros);
    this.addExposureEntries(manifest.exposures);
    this.addMetricEntries(getManifestMetrics(manifest));
    this.addSemanticModelEntries(getManifestSemanticModels(manifest));
    this.addUnitTestEntries(getManifestUnitTests(manifest));
  }

  private addNodeEntries(nodes: ParsedManifest["nodes"] | undefined): void {
    if (!nodes) return;
    for (const [uniqueId, node] of Object.entries(nodes)) {
      const nodeAny = node as Record<string, unknown>;
      const resourceType = this.extractResourceType(
        (nodeAny.resource_type as string) || "model",
      );
      const config = nodeAny.config as Record<string, unknown> | undefined;
      const materializedRaw = config?.materialized;
      const materialized =
        typeof materializedRaw === "string" && materializedRaw.trim() !== ""
          ? materializedRaw
          : undefined;
      this.graph.addNode(uniqueId, {
        unique_id: uniqueId,
        resource_type: resourceType,
        name: (nodeAny.name as string) || uniqueId,
        package_name: (nodeAny.package_name as string) || "",
        path: (nodeAny.path as string) || undefined,
        original_file_path: (nodeAny.original_file_path as string) || undefined,
        patch_path: (nodeAny.patch_path as string) || undefined,
        database: (nodeAny.database as string) || undefined,
        schema: (nodeAny.schema as string) || undefined,
        tags: (nodeAny.tags as string[]) || undefined,
        description: (nodeAny.description as string) || undefined,
        compiled_code: (nodeAny.compiled_code as string) || undefined,
        raw_code:
          (nodeAny.raw_code as string) ||
          (nodeAny.raw_sql as string) ||
          undefined,
        ...(materialized != null ? { materialized } : {}),
      });
      this.registerRelationName(uniqueId, nodeAny.relation_name);
    }
  }

  private addSourceEntries(
    sources: ParsedManifest["sources"] | undefined,
  ): void {
    if (!sources) return;
    for (const [uniqueId, source] of Object.entries(sources)) {
      const sourceAny = source as Record<string, unknown>;
      this.graph.addNode(uniqueId, {
        unique_id: uniqueId,
        resource_type: "source",
        name: (sourceAny.name as string) || uniqueId,
        package_name: (sourceAny.package_name as string) || "",
        path: (sourceAny.path as string) || undefined,
        original_file_path:
          (sourceAny.original_file_path as string) || undefined,
        tags: (sourceAny.tags as string[]) || undefined,
        description: (sourceAny.description as string) || undefined,
      });
      this.registerRelationName(uniqueId, sourceAny.relation_name);
    }
  }

  private addMacroEntries(macros: ParsedManifest["macros"] | undefined): void {
    if (!macros) return;
    for (const [uniqueId, macro] of Object.entries(macros)) {
      const macroAny = macro as Record<string, unknown>;
      this.graph.addNode(uniqueId, {
        unique_id: uniqueId,
        resource_type: "macro",
        name: (macroAny.name as string) || uniqueId,
        package_name: (macroAny.package_name as string) || "",
        path: (macroAny.path as string) || undefined,
        original_file_path:
          (macroAny.original_file_path as string) || undefined,
        description: (macroAny.description as string) || undefined,
        raw_code: (macroAny.macro_sql as string) || undefined,
      });
    }
  }

  private addExposureEntries(
    exposures: ParsedManifest["exposures"] | undefined,
  ): void {
    if (!exposures) return;
    for (const [uniqueId, exposure] of Object.entries(exposures)) {
      const exposureAny = exposure as Record<string, unknown>;
      this.graph.addNode(uniqueId, {
        unique_id: uniqueId,
        resource_type: "exposure",
        name: (exposureAny.name as string) || uniqueId,
        package_name: (exposureAny.package_name as string) || "",
        tags: (exposureAny.tags as string[]) || undefined,
        description: (exposureAny.description as string) || undefined,
      });
    }
  }

  private addMetricEntries(metrics: ManifestEntryMap | undefined): void {
    if (!metrics) return;
    for (const [uniqueId, metric] of Object.entries(metrics)) {
      const metricAny = metric as Record<string, unknown>;
      const tagsValue = metricAny.tags;
      const tags = Array.isArray(tagsValue)
        ? (tagsValue as string[])
        : typeof tagsValue === "string"
          ? [tagsValue]
          : undefined;
      this.graph.addNode(uniqueId, {
        unique_id: uniqueId,
        resource_type: "metric",
        name: (metricAny.name as string) || uniqueId,
        package_name: (metricAny.package_name as string) || "",
        path: (metricAny.path as string) || undefined,
        original_file_path:
          (metricAny.original_file_path as string) || undefined,
        description: (metricAny.description as string) || undefined,
        label: (metricAny.label as string) || undefined,
        metric_type: (metricAny.type as string) || undefined,
        metric_expression:
          ((metricAny.type_params as Record<string, unknown> | undefined)
            ?.expr as string | undefined) || undefined,
        metric_measure:
          ((
            (metricAny.type_params as Record<string, unknown> | undefined)
              ?.measure as Record<string, unknown> | undefined
          )?.name as string | undefined) || undefined,
        metric_input_measures: Array.isArray(
          (metricAny.type_params as Record<string, unknown> | undefined)
            ?.input_measures,
        )
          ? (
              (metricAny.type_params as Record<string, unknown>)
                .input_measures as Array<Record<string, unknown>>
            )
              .map((entry) => entry.name)
              .filter((entry): entry is string => typeof entry === "string")
          : undefined,
        metric_input_metrics: Array.isArray(
          (metricAny.type_params as Record<string, unknown> | undefined)
            ?.metrics,
        )
          ? (
              (metricAny.type_params as Record<string, unknown>)
                .metrics as Array<Record<string, unknown>>
            )
              .map((entry) => entry.name)
              .filter((entry): entry is string => typeof entry === "string")
          : undefined,
        metric_time_granularity:
          (metricAny.time_granularity as string) || undefined,
        metric_filters: Array.isArray(
          (metricAny.filter as Record<string, unknown> | undefined)
            ?.where_filters,
        )
          ? (
              (metricAny.filter as Record<string, unknown>)
                .where_filters as Array<Record<string, unknown>>
            )
              .map((entry) => entry.where_sql_template)
              .filter((entry): entry is string => typeof entry === "string")
          : undefined,
        metric_source_reference:
          (
            (metricAny.depends_on as Record<string, unknown> | undefined)
              ?.nodes as string[] | undefined
          )?.[0] || undefined,
        tags,
      });
    }
  }

  private addSemanticModelEntries(
    semanticModels: ManifestEntryMap | undefined,
  ): void {
    if (!semanticModels) return;
    for (const [uniqueId, semanticModel] of Object.entries(semanticModels)) {
      const sm = semanticModel as Record<string, unknown>;
      this.graph.addNode(uniqueId, {
        unique_id: uniqueId,
        resource_type: "semantic_model",
        name: (sm.name as string) || uniqueId,
        package_name: (sm.package_name as string) || "",
        path: (sm.path as string) || undefined,
        original_file_path: (sm.original_file_path as string) || undefined,
        description: (sm.description as string) || undefined,
        label: (sm.label as string) || undefined,
        semantic_model_reference: (sm.model as string) || undefined,
        semantic_model_default_time_dimension:
          ((sm.defaults as Record<string, unknown> | undefined)
            ?.agg_time_dimension as string | undefined) || undefined,
        semantic_model_entities: Array.isArray(sm.entities)
          ? (sm.entities as Array<Record<string, unknown>>)
              .map((entry) => entry.name)
              .filter((entry): entry is string => typeof entry === "string")
          : undefined,
        semantic_model_measures: Array.isArray(sm.measures)
          ? (sm.measures as Array<Record<string, unknown>>)
              .map((entry) => entry.name)
              .filter((entry): entry is string => typeof entry === "string")
          : undefined,
        semantic_model_dimensions: Array.isArray(sm.dimensions)
          ? (sm.dimensions as Array<Record<string, unknown>>)
              .map((entry) => entry.name)
              .filter((entry): entry is string => typeof entry === "string")
          : undefined,
      });
    }
  }

  private addUnitTestEntries(unitTests: ManifestEntryMap | undefined): void {
    if (!unitTests) return;
    for (const [uniqueId, unitTest] of Object.entries(unitTests)) {
      const ut = unitTest as Record<string, unknown>;
      this.graph.addNode(uniqueId, {
        unique_id: uniqueId,
        resource_type: "unit_test",
        name: (ut.name as string) || uniqueId,
        package_name: (ut.package_name as string) || "",
      });
    }
  }

  /**
   * Add edges based on dependencies
   */
  private addEdges(manifest: ParsedManifest): void {
    if (manifest.parent_map) {
      this.addEdgesFromParentMap(manifest.parent_map);
    }
    this.addEdgesFromNodeDependsOn(manifest.nodes);
    this.addEdgesFromExposureDependsOn(manifest.exposures);
    this.addEdgesFromMetricDependsOn(getManifestMetrics(manifest));
  }

  private addEdgesFromParentMap(parentMap: Record<string, string[]>): void {
    for (const [childId, parentIds] of Object.entries(parentMap)) {
      if (!this.graph.hasNode(childId)) continue;
      for (const parentId of parentIds) {
        if (
          this.graph.hasNode(parentId) &&
          !this.graph.hasEdge(parentId, childId)
        ) {
          this.graph.addEdge(parentId, childId, {
            dependency_type: this.inferDependencyType(parentId),
          });
        }
      }
    }
  }

  private addEdgesFromDependsOn(
    childId: string,
    dependsOn: { nodes?: string[]; macros?: string[] },
  ): void {
    if (dependsOn.nodes) {
      for (const depId of dependsOn.nodes) {
        if (this.graph.hasNode(depId) && !this.graph.hasEdge(depId, childId)) {
          this.graph.addEdge(depId, childId, { dependency_type: "node" });
        }
      }
    }
    if (dependsOn.macros) {
      for (const macroId of dependsOn.macros) {
        if (
          this.graph.hasNode(macroId) &&
          !this.graph.hasEdge(macroId, childId)
        ) {
          this.graph.addEdge(macroId, childId, { dependency_type: "macro" });
        }
      }
    }
  }

  private addEdgesFromNodeDependsOn(
    nodes: ParsedManifest["nodes"] | undefined,
  ): void {
    if (!nodes) return;
    for (const [uniqueId, node] of Object.entries(nodes)) {
      const dep = (node as Record<string, unknown>).depends_on as
        | { nodes?: string[]; macros?: string[] }
        | undefined;
      if (dep) this.addEdgesFromDependsOn(uniqueId, dep);
    }
  }

  private addEdgesFromExposureDependsOn(
    exposures: ParsedManifest["exposures"] | undefined,
  ): void {
    if (!exposures) return;
    for (const [uniqueId, exposure] of Object.entries(exposures)) {
      const dep = (exposure as Record<string, unknown>).depends_on as
        | { nodes?: string[]; macros?: string[] }
        | undefined;
      if (dep?.nodes) this.addEdgesFromDependsOn(uniqueId, dep);
    }
  }

  private addEdgesFromMetricDependsOn(
    metrics: ManifestEntryMap | undefined,
  ): void {
    if (!metrics) return;
    for (const [uniqueId, metric] of Object.entries(metrics)) {
      const dep = (metric as Record<string, unknown>).depends_on as
        | { nodes?: string[]; macros?: string[] }
        | undefined;
      if (dep?.nodes) this.addEdgesFromDependsOn(uniqueId, dep);
    }
  }

  /**
   * Extract resource type from manifest node
   */
  private extractResourceType(resourceType: string): DbtResourceType {
    const normalized = resourceType.toLowerCase();
    if (
      [
        "model",
        "source",
        "seed",
        "snapshot",
        "test",
        "analysis",
        "macro",
        "exposure",
        "metric",
        "semantic_model",
        "unit_test",
        "function",
      ].includes(normalized)
    ) {
      return normalized as DbtResourceType;
    }
    return "model"; // Default fallback
  }

  /**
   * Infer dependency type from node ID
   */
  private inferDependencyType(nodeId: string): "node" | "macro" | "source" {
    if (nodeId.startsWith("macro.")) {
      return "macro";
    }
    if (nodeId.startsWith("source.")) {
      return "source";
    }
    return "node";
  }

  /**
   * Get the underlying graphology graph
   */
  getGraph(): DirectedGraph<GraphNodeAttributes, GraphEdgeAttributes> {
    return this.graph;
  }

  /**
   * Get summary statistics about the graph
   */
  getSummary(): GraphSummary {
    const nodesByType: Record<string, number> = {};
    let totalNodes = 0;

    // Count nodes by type
    this.graph.forEachNode((nodeId, attributes) => {
      totalNodes++;
      const type = attributes.resource_type || "unknown";
      nodesByType[type] = (nodesByType[type] || 0) + 1;
    });

    // Detect cycles using graphology-dag
    const hasCycles = hasCycle(this.graph);

    return {
      total_nodes: totalNodes,
      nodes_by_type: nodesByType,
      total_edges: this.graph.size,
      has_cycles: hasCycles,
    };
  }

  /**
   * Get all upstream dependencies of a node using BFS.
   * @param nodeId - The node to find upstream dependencies for
   * @param maxDepth - Optional limit; 1 = immediate neighbors only, undefined = all levels
   * @returns Array of { nodeId, depth } where depth is the shortest distance from the node
   */
  getUpstream(
    nodeId: string,
    maxDepth?: number,
  ): Array<{ nodeId: string; depth: number }> {
    if (!this.graph.hasNode(nodeId)) {
      return [];
    }

    const result: Array<{ nodeId: string; depth: number }> = [];
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [];
    let head = 0;

    for (const neighborId of this.graph.inboundNeighbors(nodeId)) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        result.push({ nodeId: neighborId, depth: 1 });
        if (maxDepth === undefined || 1 < maxDepth) {
          queue.push({ id: neighborId, depth: 1 });
        }
      }
    }

    while (head < queue.length) {
      const { id, depth } = queue[head++];
      const nextDepth = depth + 1;
      for (const neighborId of this.graph.inboundNeighbors(id)) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          result.push({ nodeId: neighborId, depth: nextDepth });
          if (maxDepth === undefined || nextDepth < maxDepth) {
            queue.push({ id: neighborId, depth: nextDepth });
          }
        }
      }
    }

    return result;
  }

  /**
   * Get all downstream dependents of a node using BFS.
   * @param nodeId - The node to find downstream dependents for
   * @param maxDepth - Optional limit; 1 = immediate neighbors only, undefined = all levels
   * @returns Array of { nodeId, depth } where depth is the shortest distance from the node
   */
  getDownstream(
    nodeId: string,
    maxDepth?: number,
  ): Array<{ nodeId: string; depth: number }> {
    if (!this.graph.hasNode(nodeId)) {
      return [];
    }

    const result: Array<{ nodeId: string; depth: number }> = [];
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [];
    let head = 0;

    for (const neighborId of this.graph.outboundNeighbors(nodeId)) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        result.push({ nodeId: neighborId, depth: 1 });
        if (maxDepth === undefined || 1 < maxDepth) {
          queue.push({ id: neighborId, depth: 1 });
        }
      }
    }

    while (head < queue.length) {
      const { id, depth } = queue[head++];
      const nextDepth = depth + 1;
      for (const neighborId of this.graph.outboundNeighbors(id)) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          result.push({ nodeId: neighborId, depth: nextDepth });
          if (maxDepth === undefined || nextDepth < maxDepth) {
            queue.push({ id: neighborId, depth: nextDepth });
          }
        }
      }
    }

    return result;
  }

  /**
   * Get upstream dependencies with parent info for tree construction.
   * @returns Array of { nodeId, depth, parentId } where parentId is the BFS predecessor
   */
  getUpstreamWithParents(
    nodeId: string,
    maxDepth?: number,
  ): Array<{ nodeId: string; depth: number; parentId: string }> {
    if (!this.graph.hasNode(nodeId)) {
      return [];
    }

    const result: Array<{
      nodeId: string;
      depth: number;
      parentId: string;
    }> = [];
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number; parentId: string }> = [];

    for (const neighborId of this.graph.inboundNeighbors(nodeId)) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        result.push({ nodeId: neighborId, depth: 1, parentId: nodeId });
        if (maxDepth === undefined || 1 < maxDepth) {
          queue.push({ id: neighborId, depth: 1, parentId: nodeId });
        }
      }
    }

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      const nextDepth = depth + 1;
      for (const neighborId of this.graph.inboundNeighbors(id)) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          result.push({ nodeId: neighborId, depth: nextDepth, parentId: id });
          if (maxDepth === undefined || nextDepth < maxDepth) {
            queue.push({ id: neighborId, depth: nextDepth, parentId: id });
          }
        }
      }
    }

    return result;
  }

  /**
   * Get upstream dependencies in build order (topological sort).
   * Sources and root models first, then models that depend on them.
   * @param nodeId - The node to find upstream dependencies for
   * @param maxDepth - Optional limit; 1 = immediate neighbors only, undefined = all levels
   * @returns Array of { nodeId, depth } in build order
   */
  getUpstreamBuildOrder(
    nodeId: string,
    maxDepth?: number,
  ): Array<{ nodeId: string; depth: number }> {
    const entries = this.getUpstream(nodeId, maxDepth);
    if (entries.length === 0) {
      return [];
    }

    const nodeIds = new Set(entries.map((e) => e.nodeId));
    const depthByNode = new Map(entries.map((e) => [e.nodeId, e.depth]));

    const subgraph = new DirectedGraph<
      GraphNodeAttributes,
      GraphEdgeAttributes
    >();
    for (const nid of nodeIds) {
      subgraph.addNode(nid, this.graph.getNodeAttributes(nid));
    }
    this.graph.forEachEdge((_edge, attr, source, target) => {
      if (nodeIds.has(source) && nodeIds.has(target)) {
        if (!subgraph.hasEdge(source, target)) {
          subgraph.addEdge(source, target, attr);
        }
      }
    });

    const orderedIds = topologicalSort(subgraph);
    return orderedIds.map((nid) => ({
      nodeId: nid,
      depth: depthByNode.get(nid) ?? 0,
    }));
  }

  /**
   * Get downstream dependents with parent info for tree construction.
   * @returns Array of { nodeId, depth, parentId } where parentId is the BFS predecessor
   */
  getDownstreamWithParents(
    nodeId: string,
    maxDepth?: number,
  ): Array<{ nodeId: string; depth: number; parentId: string }> {
    if (!this.graph.hasNode(nodeId)) {
      return [];
    }

    const result: Array<{
      nodeId: string;
      depth: number;
      parentId: string;
    }> = [];
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number; parentId: string }> = [];

    for (const neighborId of this.graph.outboundNeighbors(nodeId)) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        result.push({ nodeId: neighborId, depth: 1, parentId: nodeId });
        if (maxDepth === undefined || 1 < maxDepth) {
          queue.push({ id: neighborId, depth: 1, parentId: nodeId });
        }
      }
    }

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      const nextDepth = depth + 1;
      for (const neighborId of this.graph.outboundNeighbors(id)) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          result.push({ nodeId: neighborId, depth: nextDepth, parentId: id });
          if (maxDepth === undefined || nextDepth < maxDepth) {
            queue.push({ id: neighborId, depth: nextDepth, parentId: id });
          }
        }
      }
    }

    return result;
  }

  /**
   * Add field nodes from catalog metadata
   */
  public addFieldNodes(catalog: ParsedCatalog): void {
    if (catalog.nodes) {
      for (const [uniqueId, node] of Object.entries(catalog.nodes)) {
        if (this.graph.hasNode(uniqueId)) {
          const columns = (node as unknown as Record<string, unknown>)
            .columns as Record<string, unknown> | undefined;
          this.processCatalogColumns(uniqueId, columns);
        }
      }
    }

    if (catalog.sources) {
      for (const [uniqueId, source] of Object.entries(catalog.sources)) {
        if (this.graph.hasNode(uniqueId)) {
          const columns = (source as unknown as Record<string, unknown>)
            .columns as Record<string, unknown> | undefined;
          this.processCatalogColumns(uniqueId, columns);
        }
      }
    }
  }

  private processCatalogColumns(
    parentUniqueId: string,
    columns: Record<string, unknown> | undefined,
  ): void {
    if (!columns) return;

    const parentNode = this.graph.getNodeAttributes(parentUniqueId);

    for (const [colName, colAttr] of Object.entries(columns)) {
      const fieldUniqueId = `${parentUniqueId}#${colName}`;
      const attr = colAttr as Record<string, unknown> | undefined;
      const description =
        (attr?.comment as string | undefined) ??
        (attr?.description as string | undefined);

      // Add field node if it doesn't exist
      if (!this.graph.hasNode(fieldUniqueId)) {
        this.graph.addNode(fieldUniqueId, {
          unique_id: fieldUniqueId,
          resource_type: "field",
          name: colName,
          package_name: parentNode.package_name,
          parent_id: parentUniqueId,
          description,
        });

        // Add internal edge from parent to field
        this.graph.addEdge(parentUniqueId, fieldUniqueId, {
          dependency_type: "internal",
        });
      }
    }
  }

  /**
   * Add field-to-field edges based on SQL analysis
   */
  public addFieldEdges(
    childNodeId: string,
    dependencies: ColumnDependencyMap,
  ): void {
    if (!this.graph.hasNode(childNodeId)) return;

    for (const [targetCol, sourceCols] of Object.entries(dependencies)) {
      const targetFieldId = `${childNodeId}#${targetCol}`;

      // Ensure target field node exists
      this.ensureFieldNode(childNodeId, targetCol);

      for (const source of sourceCols) {
        // Resolve source table name/relation name to unique ID
        const sourceNodeId = this.resolveRelationToUniqueId(source.sourceTable);
        if (!sourceNodeId) continue;

        const sourceFieldId = `${sourceNodeId}#${source.sourceColumn}`;
        this.ensureFieldNode(sourceNodeId, source.sourceColumn);

        // Add field edge from source field to target field
        if (!this.graph.hasEdge(sourceFieldId, targetFieldId)) {
          this.graph.addEdge(sourceFieldId, targetFieldId, {
            dependency_type: "field",
          });
        }
      }
    }
  }

  private ensureFieldNode(parentNodeId: string, colName: string): string {
    const fieldId = `${parentNodeId}#${colName}`;
    if (!this.graph.hasNode(fieldId)) {
      const parentAttr = this.graph.getNodeAttributes(parentNodeId);
      this.graph.addNode(fieldId, {
        unique_id: fieldId,
        resource_type: "field",
        name: colName,
        package_name: parentAttr.package_name,
        parent_id: parentNodeId,
      });
      // Add internal edge
      this.graph.addEdge(parentNodeId, fieldId, {
        dependency_type: "internal",
      });
    }
    return fieldId;
  }

  private resolveRelationToUniqueId(relationName: string): string | undefined {
    // Try exact match
    const normalized = relationName.toLowerCase();
    if (this.relationMap.has(normalized)) {
      return this.relationMap.get(normalized);
    }

    // Try stripping quotes if any
    const unquoted = normalized.replace(/["`]/g, "");
    if (this.relationMap.has(unquoted)) {
      return this.relationMap.get(unquoted);
    }

    // Try partial match if it's just the table name (alias)
    // We also strip quotes from the mapped relations for comparison
    for (const [rel, uid] of this.relationMap.entries()) {
      const relUnquoted = rel.replace(/["`]/g, "");
      if (relUnquoted.endsWith(`.${unquoted}`) || relUnquoted === unquoted) {
        return uid;
      }
    }

    return undefined;
  }

  /**
   * Build a focused subgraph centred on a single node.
   *
   * @param focusId - unique_id of the focal node (must exist in the graph)
   * @param direction - which edges to traverse: "upstream", "downstream", or "both"
   * @param depth - optional max traversal hops (undefined = unlimited)
   * @param resourceTypes - optional set of resource_type values to keep (undefined = keep all)
   * @returns A new DirectedGraph containing only the focal node, the reachable
   *          nodes in the requested direction(s), and the edges between them.
   * @throws Error if focusId is not found in the graph
   */
  buildSubgraph(
    focusId: string,
    direction: "upstream" | "downstream" | "both",
    depth?: number,
    resourceTypes?: Set<string>,
  ): DirectedGraph<GraphNodeAttributes, GraphEdgeAttributes> {
    if (!this.graph.hasNode(focusId)) {
      throw new Error(`Focus node not found in manifest: ${focusId}`);
    }

    const included = new Set<string>([focusId]);

    if (direction === "upstream" || direction === "both") {
      for (const { nodeId } of this.getUpstream(focusId, depth)) {
        included.add(nodeId);
      }
    }
    if (direction === "downstream" || direction === "both") {
      for (const { nodeId } of this.getDownstream(focusId, depth)) {
        included.add(nodeId);
      }
    }

    const subgraph = new DirectedGraph<GraphNodeAttributes, GraphEdgeAttributes>();

    for (const nodeId of included) {
      if (!this.graph.hasNode(nodeId)) continue;
      const attrs = this.graph.getNodeAttributes(nodeId);
      if (resourceTypes && !resourceTypes.has(attrs.resource_type.toLowerCase())) {
        continue;
      }
      subgraph.addNode(nodeId, attrs);
    }

    this.graph.forEachEdge((_edgeId, attrs, source, target) => {
      if (subgraph.hasNode(source) && subgraph.hasNode(target)) {
        if (!subgraph.hasEdge(source, target)) {
          subgraph.addEdge(source, target, attrs);
        }
      }
    });

    return subgraph;
  }
}
