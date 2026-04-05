import type { GanttItem } from "./analysis-snapshot-types";
import type {
  GraphLike,
  GraphologyAttrsGraph,
  ManifestEntryLookup,
  NeighborGraph,
} from "./analysis-snapshot-internal";
import type { NodeExecutionSemantics } from "../node-execution-semantics";
import { buildNodeExecutionSemantics } from "../node-execution-semantics";
import {
  inferPackageNameFromUniqueId,
  inferResourceTypeFromId,
} from "./analysis-snapshot-shared";

/** Graphology view needed to walk sources and outbound dependency edges. */
type GraphologySourceDependentsGraph = GraphologyAttrsGraph &
  NeighborGraph & {
    forEachNode(
      fn: (nodeId: string, attributes: Record<string, unknown>) => void,
    ): void;
  };

const TEST_RESOURCE_TYPES_FOR_SOURCE_SYNTH = new Set(["test", "unit_test"]);

export function buildManifestEntryLookup(
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

export function buildSemanticsForTimelineNode(
  uniqueId: string,
  attrs: Record<string, unknown> | undefined,
  manifestEntryLookup: ManifestEntryLookup,
  adapterType: string | null | undefined,
): NodeExecutionSemantics {
  const entry = manifestEntryLookup.get(uniqueId) ?? null;
  const resourceType =
    typeof attrs?.resource_type === "string" && attrs.resource_type
      ? attrs.resource_type
      : inferResourceTypeFromId(uniqueId);
  const mat =
    typeof attrs?.materialized === "string" && attrs.materialized.trim() !== ""
      ? attrs.materialized
      : null;
  return buildNodeExecutionSemantics({
    resourceType,
    materialized: mat,
    manifestEntry: entry,
    adapterType: adapterType ?? null,
  });
}

export function enrichGanttItemRow(
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
  adapterType: string | null | undefined,
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

  const semantics = buildSemanticsForTimelineNode(
    item.unique_id,
    attrs,
    manifestEntryLookup,
    adapterType,
  );

  return {
    ...item,
    resourceType,
    packageName: pkg,
    path: manifestDisplayPath(attrs),
    parentId,
    materialized,
    semantics,
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

export function compareGanttItems(a: GanttItem, b: GanttItem): number {
  const startDiff = a.start - b.start;
  if (startDiff !== 0) return startDiff;

  const durationDiff = b.duration - a.duration;
  if (durationDiff !== 0) return durationDiff;

  return a.name.localeCompare(b.name);
}

export function buildSyntheticSourceRows(
  enrichedGanttData: GanttItem[],
  graphologyGraph: GraphologyAttrsGraph,
  manifestEntryLookup: ManifestEntryLookup,
  adapterType: string | null | undefined,
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

    const semantics = buildSemanticsForTimelineNode(
      sourceId,
      sourceAttrs,
      manifestEntryLookup,
      adapterType,
    );

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
      semantics,
    });
  }

  return syntheticRows.sort(compareGanttItems);
}

/**
 * Synthesize timeline rows for sources that have timed, non-test dependents in
 * `run_results` but no source row of their own (typical for `dbt run`).
 * Runs after {@link buildSyntheticSourceRows} on the combined row list.
 */
export function buildSyntheticSourceRowsFromExecutedDependents(
  combinedGanttData: GanttItem[],
  graphologyGraph: GraphologySourceDependentsGraph,
  projectName: string | null,
  manifestEntryLookup: ManifestEntryLookup,
  adapterType: string | null | undefined,
): GanttItem[] {
  const existingIds = new Set(combinedGanttData.map((item) => item.unique_id));
  const itemById = new Map(
    combinedGanttData.map((item) => [item.unique_id, item]),
  );

  const syntheticRows: GanttItem[] = [];

  graphologyGraph.forEachNode((nodeId, attrs) => {
    if (String(attrs.resource_type ?? "") !== "source") return;
    if (existingIds.has(nodeId)) return;

    const pkg =
      typeof attrs.package_name === "string" && attrs.package_name.length > 0
        ? attrs.package_name
        : inferPackageNameFromUniqueId(nodeId);
    if (projectName != null && pkg !== projectName) return;

    const dependents: GanttItem[] = [];
    for (const neighborId of graphologyGraph.outboundNeighbors(nodeId)) {
      const item = itemById.get(neighborId);
      if (item == null) continue;
      if (TEST_RESOURCE_TYPES_FOR_SOURCE_SYNTH.has(item.resourceType)) continue;
      dependents.push(item);
    }

    if (dependents.length === 0) return;

    const sortedDependents = [...dependents].sort(compareGanttItems);
    const start = Math.min(...sortedDependents.map((item) => item.start));
    const end = Math.max(...sortedDependents.map((item) => item.end));

    const semantics = buildSemanticsForTimelineNode(
      nodeId,
      attrs,
      manifestEntryLookup,
      adapterType,
    );

    syntheticRows.push({
      unique_id: nodeId,
      name:
        typeof attrs.name === "string" && attrs.name.length > 0
          ? attrs.name
          : nodeId,
      start,
      end,
      duration: Math.max(0, end - start),
      status: pickRepresentativeStatus(sortedDependents),
      resourceType: "source",
      packageName: pkg,
      path: manifestDisplayPath(attrs),
      parentId: null,
      compileStart: null,
      compileEnd: null,
      executeStart: null,
      executeEnd: null,
      materialized: null,
      semantics,
    });
  });

  return syntheticRows.sort(compareGanttItems);
}
