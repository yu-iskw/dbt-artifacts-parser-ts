import type { AnalysisState, ResourceNode } from "@web/types";
import { TEST_RESOURCE_TYPES } from "./constants";
import type { LensMode } from "./types";

export interface LineageGraphNodeLayout {
  resource: ResourceNode;
  x: number;
  y: number;
  column: number;
  depth: number;
  side: "upstream" | "selected" | "downstream";
}

export interface LineageGraphModel {
  upstreamMap: Map<string, number>;
  downstreamMap: Map<string, number>;
  columnNodes: Array<{ column: number; resources: ResourceNode[] }>;
  nodeLayouts: Map<string, LineageGraphNodeLayout>;
  graphEdges: Array<{ from: string; to: string }>;
  svgWidth: number;
  svgHeight: number;
  hasRelatedNodes: boolean;
}

export type DependencyIndex = AnalysisState["dependencyIndex"];

export function clampDepth(value: number): number {
  return Math.max(0, Math.min(10, value));
}

export function collectDependencyIdsByDepth(
  index: DependencyIndex,
  rootId: string,
  maxDepth: number,
  direction: "upstream" | "downstream",
): Map<string, number> {
  const discovered = new Map<string, number>();
  let frontier = [rootId];

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const nextFrontier: string[] = [];
    for (const nodeId of frontier) {
      const relation = index[nodeId];
      const neighborIds =
        direction === "upstream"
          ? (relation?.upstream?.map((d) => d.uniqueId) ?? [])
          : (relation?.downstream?.map((d) => d.uniqueId) ?? []);
      for (const neighborId of neighborIds) {
        if (discovered.has(neighborId) || neighborId === rootId) continue;
        discovered.set(neighborId, depth);
        nextFrontier.push(neighborId);
      }
    }
    frontier = nextFrontier;
    if (frontier.length === 0) break;
  }

  return discovered;
}

export function getGraphStage(resourceType: string): number {
  switch (resourceType) {
    case "source":
    case "seed":
    case "snapshot":
      return 0;
    case "model":
      return 1;
    case "semantic_model":
      return 2;
    case "metric":
    case "exposure":
      return 3;
    default:
      return 4;
  }
}

export function getDependencyGraphNodeTypeClass(resourceType: string): string {
  switch (resourceType) {
    case "source":
      return "dependency-graph__node--type-source";
    case "seed":
      return "dependency-graph__node--type-seed";
    case "snapshot":
      return "dependency-graph__node--type-snapshot";
    case "model":
      return "dependency-graph__node--type-model";
    case "semantic_model":
      return "dependency-graph__node--type-semantic-model";
    case "metric":
      return "dependency-graph__node--type-metric";
    case "exposure":
      return "dependency-graph__node--type-exposure";
    case "test":
    case "unit_test":
      return "dependency-graph__node--type-test";
    case "macro":
      return "dependency-graph__node--type-macro";
    case "operation":
    case "sql_operation":
      return "dependency-graph__node--type-operation";
    default:
      return "dependency-graph__node--type-generic";
  }
}

export function resolveLineageSide(
  resourceId: string,
  selectedId: string,
  upstreamMap: Map<string, number>,
  downstreamMap: Map<string, number>,
): { side: "upstream" | "selected" | "downstream"; depth: number } {
  if (resourceId === selectedId) {
    return { side: "selected", depth: 0 };
  }

  const upstreamDepth = upstreamMap.get(resourceId);
  const downstreamDepth = downstreamMap.get(resourceId);

  if (upstreamDepth != null && downstreamDepth != null) {
    return upstreamDepth <= downstreamDepth
      ? { side: "upstream", depth: upstreamDepth }
      : { side: "downstream", depth: downstreamDepth };
  }
  if (upstreamDepth != null) {
    return { side: "upstream", depth: upstreamDepth };
  }
  if (downstreamDepth != null) {
    return { side: "downstream", depth: downstreamDepth };
  }
  return { side: "selected", depth: 0 };
}

// eslint-disable-next-line sonarjs/cognitive-complexity, sonarjs/cyclomatic-complexity -- column layout ranking
export function buildDisplayColumns(
  selectedId: string,
  upstreamMap: Map<string, number>,
  downstreamMap: Map<string, number>,
  resourceById: Map<string, ResourceNode>,
  dependencyIndex: DependencyIndex,
) {
  // Longest-path rank for upstream nodes.
  const upstreamRank = new Map<string, number>();
  const upstreamSorted = [...upstreamMap.keys()].sort(
    (a, b) => upstreamMap.get(a)! - upstreamMap.get(b)!,
  );
  for (const id of upstreamSorted) {
    const resource = resourceById.get(id);
    if (!resource || TEST_RESOURCE_TYPES.has(resource.resourceType)) continue;
    const downNeighbors =
      dependencyIndex[id]?.downstream?.map((d) => d.uniqueId) ?? [];
    let maxDownRank = 0;
    for (const nbr of downNeighbors) {
      if (nbr === selectedId) {
        maxDownRank = Math.max(maxDownRank, 0);
      } else {
        const nbrRank = upstreamRank.get(nbr);
        if (nbrRank !== undefined) maxDownRank = Math.max(maxDownRank, nbrRank);
      }
    }
    upstreamRank.set(id, maxDownRank + 1);
  }

  // Longest-path rank for downstream nodes (symmetric).
  const downstreamRank = new Map<string, number>();
  const downstreamSorted = [...downstreamMap.keys()].sort(
    (a, b) => downstreamMap.get(a)! - downstreamMap.get(b)!,
  );
  for (const id of downstreamSorted) {
    const resource = resourceById.get(id);
    if (!resource || TEST_RESOURCE_TYPES.has(resource.resourceType)) continue;
    const upNeighbors =
      dependencyIndex[id]?.upstream?.map((d) => d.uniqueId) ?? [];
    let maxUpRank = 0;
    for (const nbr of upNeighbors) {
      if (nbr === selectedId) {
        maxUpRank = Math.max(maxUpRank, 0);
      } else {
        const nbrRank = downstreamRank.get(nbr);
        if (nbrRank !== undefined) maxUpRank = Math.max(maxUpRank, nbrRank);
      }
    }
    downstreamRank.set(id, maxUpRank + 1);
  }

  const columns = new Map<number, ResourceNode[]>();
  const selected = resourceById.get(selectedId);
  if (selected) {
    columns.set(0, [selected]);
  }

  for (const [id] of upstreamMap) {
    const resource = resourceById.get(id);
    if (!resource || TEST_RESOURCE_TYPES.has(resource.resourceType)) continue;
    const column = -(upstreamRank.get(id) ?? 1);
    const current = columns.get(column) ?? [];
    current.push(resource);
    columns.set(column, current);
  }

  for (const [id] of downstreamMap) {
    const resource = resourceById.get(id);
    if (!resource || TEST_RESOURCE_TYPES.has(resource.resourceType)) continue;
    const column = downstreamRank.get(id) ?? 1;
    const current = columns.get(column) ?? [];
    current.push(resource);
    columns.set(column, current);
  }

  return Array.from(columns.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([column, resources]) => ({
      column,
      resources: [
        ...new Map(resources.map((entry) => [entry.uniqueId, entry])).values(),
      ].sort((left, right) => {
        const stageOrder =
          getGraphStage(left.resourceType) - getGraphStage(right.resourceType);
        if (stageOrder !== 0) return stageOrder;
        return left.name.localeCompare(right.name);
      }),
    }));
}

export function reorderGraphColumns(
  columns: Array<{ column: number; resources: ResourceNode[] }>,
  dependencyIndex: DependencyIndex,
): Array<{ column: number; resources: ResourceNode[] }> {
  const positionById = new Map<string, number>();
  columns.forEach((entry) =>
    entry.resources.forEach((resource, index) =>
      positionById.set(resource.uniqueId, index),
    ),
  );

  const nextColumns = columns.map((entry) => ({
    ...entry,
    resources: [...entry.resources],
  }));

  for (let pass = 0; pass < 4; pass += 1) {
    for (let index = 1; index < nextColumns.length; index += 1) {
      const previous = nextColumns[index - 1];
      const current = nextColumns[index];
      current.resources.sort((left, right) => {
        const leftNeighbors =
          dependencyIndex[left.uniqueId]?.upstream?.map((d) => d.uniqueId) ??
          [];
        const rightNeighbors =
          dependencyIndex[right.uniqueId]?.upstream?.map((d) => d.uniqueId) ??
          [];
        const leftScore =
          leftNeighbors.length > 0
            ? leftNeighbors.reduce(
                (sum, id) =>
                  sum + (positionById.get(id) ?? previous.resources.length),
                0,
              ) / leftNeighbors.length
            : (positionById.get(left.uniqueId) ?? 0);
        const rightScore =
          rightNeighbors.length > 0
            ? rightNeighbors.reduce(
                (sum, id) =>
                  sum + (positionById.get(id) ?? previous.resources.length),
                0,
              ) / rightNeighbors.length
            : (positionById.get(right.uniqueId) ?? 0);
        return leftScore - rightScore;
      });
      current.resources.forEach((resource, order) =>
        positionById.set(resource.uniqueId, order),
      );
    }

    for (let index = nextColumns.length - 2; index >= 0; index -= 1) {
      const next = nextColumns[index + 1];
      const current = nextColumns[index];
      current.resources.sort((left, right) => {
        const leftNeighbors =
          dependencyIndex[left.uniqueId]?.downstream?.map((d) => d.uniqueId) ??
          [];
        const rightNeighbors =
          dependencyIndex[right.uniqueId]?.downstream?.map((d) => d.uniqueId) ??
          [];
        const leftScore =
          leftNeighbors.length > 0
            ? leftNeighbors.reduce(
                (sum, id) =>
                  sum + (positionById.get(id) ?? next.resources.length),
                0,
              ) / leftNeighbors.length
            : (positionById.get(left.uniqueId) ?? 0);
        const rightScore =
          rightNeighbors.length > 0
            ? rightNeighbors.reduce(
                (sum, id) =>
                  sum + (positionById.get(id) ?? next.resources.length),
                0,
              ) / rightNeighbors.length
            : (positionById.get(right.uniqueId) ?? 0);
        return leftScore - rightScore;
      });
      current.resources.forEach((resource, order) =>
        positionById.set(resource.uniqueId, order),
      );
    }
  }

  return nextColumns;
}

export function buildLineageGraphModel({
  resource,
  dependencySummary,
  dependencyIndex,
  resourceById,
  upstreamDepth,
  downstreamDepth,
}: {
  resource: ResourceNode;
  dependencySummary: DependencyIndex[string] | undefined;
  dependencyIndex: DependencyIndex;
  resourceById: Map<string, ResourceNode>;
  upstreamDepth: number;
  downstreamDepth: number;
}): LineageGraphModel {
  const upstreamMap = collectDependencyIdsByDepth(
    dependencyIndex,
    resource.uniqueId,
    upstreamDepth,
    "upstream",
  );
  const downstreamMap = collectDependencyIdsByDepth(
    dependencyIndex,
    resource.uniqueId,
    downstreamDepth,
    "downstream",
  );

  const columnNodes = reorderGraphColumns(
    buildDisplayColumns(
      resource.uniqueId,
      upstreamMap,
      downstreamMap,
      resourceById,
      dependencyIndex,
    ),
    dependencyIndex,
  ).filter((entry) => entry.resources.length > 0);

  const columnCount = columnNodes.length;
  const nodeWidth = 212;
  const nodeHeight = 62;
  const columnGap = 160;
  const rowGap = 40;
  const paddingX = 56;
  const paddingY = 52;
  const svgWidth =
    paddingX * 2 +
    columnCount * nodeWidth +
    Math.max(0, columnCount - 1) * columnGap;
  const tallestColumn = Math.max(
    1,
    ...columnNodes.map((entry) => entry.resources.length),
  );
  const svgHeight =
    paddingY * 2 +
    tallestColumn * nodeHeight +
    Math.max(0, tallestColumn - 1) * rowGap;

  const nodeLayouts = new Map<string, LineageGraphNodeLayout>();
  columnNodes.forEach((entry, columnIndex) => {
    const columnHeight =
      entry.resources.length * nodeHeight +
      Math.max(0, entry.resources.length - 1) * rowGap;
    const startY = paddingY + (svgHeight - paddingY * 2 - columnHeight) / 2;
    const x = paddingX + columnIndex * (nodeWidth + columnGap);

    entry.resources.forEach((node, rowIndex) => {
      const y = startY + rowIndex * (nodeHeight + rowGap);
      const { depth, side } = resolveLineageSide(
        node.uniqueId,
        resource.uniqueId,
        upstreamMap,
        downstreamMap,
      );
      nodeLayouts.set(node.uniqueId, {
        resource: node,
        x,
        y,
        column: entry.column,
        depth,
        side,
      });
    });
  });

  const displayedIds = new Set(nodeLayouts.keys());
  const graphEdges: Array<{ from: string; to: string }> = [];
  for (const nodeId of displayedIds) {
    const relation = dependencyIndex[nodeId];
    if (!relation) continue;
    for (const downstreamId of relation.downstream.map((d) => d.uniqueId)) {
      if (displayedIds.has(downstreamId)) {
        graphEdges.push({ from: nodeId, to: downstreamId });
      }
    }
  }

  return {
    upstreamMap,
    downstreamMap,
    columnNodes,
    nodeLayouts,
    graphEdges,
    svgWidth,
    svgHeight,
    hasRelatedNodes:
      nodeLayouts.size > 1 &&
      ((dependencySummary?.upstreamCount ?? 0) > 0 ||
        (dependencySummary?.downstreamCount ?? 0) > 0),
  };
}

export function collectHighlightedGraphIds(
  resourceId: string | null,
  edges: Array<{ from: string; to: string }>,
): Set<string> {
  if (!resourceId) return new Set();
  const highlighted = new Set([resourceId]);
  for (const edge of edges) {
    if (edge.from === resourceId) highlighted.add(edge.to);
    if (edge.to === resourceId) highlighted.add(edge.from);
  }
  return highlighted;
}

export function getLineageGraphTypes(
  nodeLayouts: Map<string, LineageGraphNodeLayout>,
): string[] {
  return Array.from(
    new Set(
      Array.from(nodeLayouts.values()).map(
        (entry) => entry.resource.resourceType,
      ),
    ),
  ).sort((left, right) => {
    const stageOrder = getGraphStage(left) - getGraphStage(right);
    if (stageOrder !== 0) return stageOrder;
    return left.localeCompare(right);
  });
}

// ─── Lineage Lenses ──────────────────────────────────────────────────────────

/** Soft pastel fill colors for the status lens (applied inline on SVG rects). */
export const STATUS_LENS_FILLS: Record<string, string> = {
  positive: "rgba(43, 182, 115, 0.22)",
  warning: "rgba(242, 164, 75, 0.24)",
  danger: "rgba(216, 96, 102, 0.24)",
  neutral: "rgba(142, 151, 166, 0.18)",
};

/** Solid colors for status lens legend swatches. */
export const STATUS_LENS_SOLID: Record<string, string> = {
  positive: "#2bb673",
  warning: "#f2a44b",
  danger: "#d86066",
  neutral: "#8e97a6",
};

const TYPE_LENS_NEUTRAL = "rgba(142, 151, 166, 0.16)";
const TYPE_LENS_MUTED = "rgba(120, 113, 108, 0.14)";

/** Soft pastel fill colors for the type lens. */
export const TYPE_LENS_FILLS: Record<string, string> = {
  model: "rgba(37, 88, 217, 0.18)",
  source: "rgba(8, 145, 178, 0.18)",
  seed: "rgba(147, 51, 234, 0.16)",
  snapshot: "rgba(234, 88, 12, 0.16)",
  test: TYPE_LENS_NEUTRAL,
  unit_test: TYPE_LENS_NEUTRAL,
  metric: "rgba(219, 39, 119, 0.16)",
  semantic_model: "rgba(99, 102, 241, 0.16)",
  exposure: "rgba(13, 148, 136, 0.16)",
  macro: TYPE_LENS_MUTED,
  operation: TYPE_LENS_MUTED,
  sql_operation: TYPE_LENS_MUTED,
};

/** Solid colors for type lens legend swatches. */
export const TYPE_LENS_SOLID: Record<string, string> = {
  model: "#2558d9",
  source: "#0891b2",
  seed: "#9333ea",
  snapshot: "#ea580c",
  test: "#8e97a6",
  unit_test: "#8e97a6",
  metric: "#db2777",
  semantic_model: "#6366f1",
  exposure: "#0d9488",
  macro: "#78716c",
  operation: "#78716c",
  sql_operation: "#78716c",
};

/** Returns the SVG fill color for a node given the active lens mode. */
export function getLensNodeFill(
  resource: ResourceNode,
  lensMode: LensMode,
): string {
  switch (lensMode) {
    case "status":
      return (
        STATUS_LENS_FILLS[resource.statusTone ?? "neutral"] ??
        STATUS_LENS_FILLS.neutral
      );
    case "type":
      return TYPE_LENS_FILLS[resource.resourceType] ?? TYPE_LENS_NEUTRAL;
    case "coverage":
      return resource.description
        ? "rgba(43, 182, 115, 0.22)"
        : "rgba(216, 96, 102, 0.22)";
  }
}

export interface LensLegendItem {
  key: string;
  label: string;
  color: string;
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatResourceLabel(resourceType: string): string {
  return resourceType
    .split("_")
    .map((part) => capitalizeFirst(part))
    .join(" ");
}

/** Returns legend items appropriate for the active lens mode. */
export function getLensLegendItems(
  lensMode: LensMode,
  nodeLayouts: Map<string, LineageGraphNodeLayout>,
): LensLegendItem[] {
  switch (lensMode) {
    case "status": {
      const tones = new Set<string>();
      for (const layout of nodeLayouts.values()) {
        tones.add(layout.resource.statusTone ?? "neutral");
      }
      const order = ["positive", "warning", "danger", "neutral"];
      return order
        .filter((t) => tones.has(t))
        .map((t) => ({
          key: t,
          label: capitalizeFirst(t),
          color: STATUS_LENS_SOLID[t] ?? "#8e97a6",
        }));
    }
    case "type": {
      const types = getLineageGraphTypes(nodeLayouts);
      return types.map((type) => ({
        key: type,
        label: formatResourceLabel(type),
        color: TYPE_LENS_SOLID[type] ?? "#8e97a6",
      }));
    }
    case "coverage":
      return [
        { key: "documented", label: "Documented", color: "#2bb673" },
        { key: "undocumented", label: "No description", color: "#d86066" },
      ];
  }
}
