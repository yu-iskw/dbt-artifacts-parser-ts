import { ManifestGraph } from "./manifest-graph";
import { FieldFilter } from "../formatting/field-filter";
import type { GraphNodeAttributes } from "../types";

/**
 * Dependency analysis result
 */
export interface DependencyResult {
  resource_id: string;
  direction: "upstream" | "downstream";
  dependencies: Array<{
    unique_id: string;
    resource_type: string;
    name: string;
    package_name: string;
    [key: string]: unknown;
  }>;
  count: number;
}

/**
 * DependencyService wraps ManifestGraph dependency methods with formatting
 * and field filtering capabilities.
 */
export class DependencyService {
  /**
   * Get dependencies for a resource with optional field filtering
   */
  static getDependencies(
    graph: ManifestGraph,
    resourceId: string,
    direction: "upstream" | "downstream",
    fields?: string,
  ): DependencyResult {
    // Get dependency IDs
    const dependencyIds =
      direction === "upstream"
        ? graph.getUpstream(resourceId)
        : graph.getDownstream(resourceId);

    // Get full graph to extract node attributes
    const graphologyGraph = graph.getGraph();

    // Build dependency list with full attributes
    const dependencies: DependencyResult["dependencies"] = dependencyIds.map(
      (id) => {
        const attributes = graphologyGraph.getNodeAttributes(
          id,
        ) as GraphNodeAttributes;

        return {
          ...attributes,
          unique_id: id,
          resource_type: attributes.resource_type || "unknown",
          name: attributes.name || id,
          package_name: attributes.package_name || "",
        };
      },
    );

    // Apply field filtering if specified
    let filteredDependencies = dependencies;
    if (fields) {
      filteredDependencies = FieldFilter.filterArrayFields(
        dependencies,
        fields,
      ) as DependencyResult["dependencies"];
    }

    return {
      resource_id: resourceId,
      direction,
      dependencies: filteredDependencies,
      count: filteredDependencies.length,
    };
  }
}
