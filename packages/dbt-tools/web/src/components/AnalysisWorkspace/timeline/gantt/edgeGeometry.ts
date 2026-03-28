import type { GanttItem, TimelineAdjacencyEntry } from "@web/types";
import type { BundleRow } from "@web/lib/analysis-workspace/bundleLayout";
import { TEST_RESOURCE_TYPES } from "@web/lib/analysis-workspace/constants";
import {
  AXIS_TOP,
  BAR_H,
  BAR_PAD,
  BUNDLE_HULL_PAD,
  ROW_H,
  TEST_BAR_H,
  TEST_LANE_H,
  TIMELINE_EXTENDED_MAX_EDGES_PER_DIRECTION,
  TIMELINE_EXTENDED_MAX_HOPS,
  TIMELINE_MAX_DOWNSTREAM_EDGES,
  TIMELINE_MAX_UPSTREAM_EDGES,
} from "./constants";

export type FocusEdgeTier = "primary" | "secondary" | "downstream";

export type FocusEdgeLeg = "upstream" | "downstream";

export interface FocusTimelineEdge {
  fromId: string;
  toId: string;
  tier: FocusEdgeTier;
  /** 1 = direct neighbor of focus; 2+ = extended multi-hop segment. */
  hop: number;
  leg: FocusEdgeLeg;
}

/** True when both items are tests under the same parent model (display tier hint). */
function isSiblingTestNeighbor(
  neighbor: GanttItem | undefined,
  focusItem: GanttItem | undefined,
): boolean {
  if (!neighbor || !focusItem) return false;
  if (!TEST_RESOURCE_TYPES.has(focusItem.resourceType)) return false;
  if (!TEST_RESOURCE_TYPES.has(neighbor.resourceType)) return false;
  if (focusItem.parentId == null || neighbor.parentId == null) return false;
  return focusItem.parentId === neighbor.parentId;
}

/** Display-only priority for ranking upstream parcels (lower = earlier in sort). */
const UPSTREAM_RESOURCE_RANK: Record<string, number> = {
  model: 0,
  source: 1,
  source_freshness: 1,
  snapshot: 2,
  seed: 3,
  exposure: 4,
  metric: 5,
  semantic_model: 6,
  test: 7,
  unit_test: 8,
  macro: 9,
  analysis: 10,
};

function resourceTypeRank(resourceType: string | undefined): number {
  if (!resourceType) return 99;
  return UPSTREAM_RESOURCE_RANK[resourceType] ?? 98;
}

/**
 * Deterministic order: sibling tests first, then resource-type priority, then
 * temporal proximity (upstream `end` closest to focus `start`), then id.
 */
export function rankInboundNeighborIds(
  inboundOnTimeline: string[],
  focusItem: GanttItem,
  itemById: Map<string, GanttItem>,
): string[] {
  return [...inboundOnTimeline].sort((a, b) => {
    const ia = itemById.get(a);
    const ib = itemById.get(b);
    const sa = isSiblingTestNeighbor(ia, focusItem) ? 0 : 1;
    const sb = isSiblingTestNeighbor(ib, focusItem) ? 0 : 1;
    if (sa !== sb) return sa - sb;

    const ra = resourceTypeRank(ia?.resourceType);
    const rb = resourceTypeRank(ib?.resourceType);
    if (ra !== rb) return ra - rb;

    const da = Math.abs((ia?.end ?? 0) - focusItem.start);
    const db = Math.abs((ib?.end ?? 0) - focusItem.start);
    if (da !== db) return da - db;

    return a.localeCompare(b);
  });
}

/**
 * Cap a ranked neighbor id list (shared by upstream and downstream focus edges).
 */
export function applyNeighborCap(
  ranked: string[],
  showAll: boolean,
  maxEdges: number,
): string[] {
  if (showAll || ranked.length <= maxEdges) {
    return ranked;
  }
  return ranked.slice(0, maxEdges);
}

export function applyUpstreamCap(
  rankedInbound: string[],
  showAllUpstream: boolean,
  maxUpstreamEdges: number,
): string[] {
  return applyNeighborCap(rankedInbound, showAllUpstream, maxUpstreamEdges);
}

/**
 * Deterministic order: sibling tests first, then resource-type priority, then
 * temporal proximity (dependent `start` closest to focus `end`), then id.
 */
export function rankOutboundNeighborIds(
  outboundOnTimeline: string[],
  focusItem: GanttItem,
  itemById: Map<string, GanttItem>,
): string[] {
  return [...outboundOnTimeline].sort((a, b) => {
    const ia = itemById.get(a);
    const ib = itemById.get(b);
    const sa = isSiblingTestNeighbor(ia, focusItem) ? 0 : 1;
    const sb = isSiblingTestNeighbor(ib, focusItem) ? 0 : 1;
    if (sa !== sb) return sa - sb;

    const ra = resourceTypeRank(ia?.resourceType);
    const rb = resourceTypeRank(ib?.resourceType);
    if (ra !== rb) return ra - rb;

    const da = Math.abs((ia?.start ?? 0) - focusItem.end);
    const db = Math.abs((ib?.start ?? 0) - focusItem.end);
    if (da !== db) return da - db;

    return a.localeCompare(b);
  });
}

export interface FocusTimelineEdgesOptions {
  includeUpstream?: boolean;
  includeDownstream: boolean;
  /** When true, draw every direct upstream edge on the timeline. */
  showAllUpstream: boolean;
  /** When `showAllUpstream` is false, at most this many upstream edges. */
  maxUpstreamEdges: number;
  /** When true, draw every direct downstream edge on the timeline. */
  showAllDownstream: boolean;
  /** When `showAllDownstream` is false, at most this many downstream edges. */
  maxDownstreamEdges: number;
  /** Optional multi-hop segments (hop ≥ 2), capped separately from one-hop. */
  extendedDeps?: {
    enabled: boolean;
    maxHops?: number;
    maxEdgesPerDirection?: number;
  };
}

export interface FocusTimelineEdgesResult {
  edges: FocusTimelineEdge[];
  /** True if extended BFS hit a per-direction cap (hop ≥ 2 only). */
  extendedTruncated: boolean;
}

function focusEdgeDedupeKey(
  e: Pick<FocusTimelineEdge, "fromId" | "toId">,
): string {
  return `${e.fromId}\t${e.toId}`;
}

function compareFocusEdges(a: FocusTimelineEdge, b: FocusTimelineEdge): number {
  if (a.hop !== b.hop) return a.hop - b.hop;
  const legA = a.leg === "upstream" ? 0 : 1;
  const legB = b.leg === "upstream" ? 0 : 1;
  if (legA !== legB) return legA - legB;
  const cf = a.fromId.localeCompare(b.fromId);
  if (cf !== 0) return cf;
  return a.toId.localeCompare(b.toId);
}

function collectOneHopUpstreamEdges(
  focusId: string,
  entry: TimelineAdjacencyEntry,
  focusItem: GanttItem,
  itemById: Map<string, GanttItem>,
  inTimeline: (id: string) => boolean,
  options: FocusTimelineEdgesOptions,
): FocusTimelineEdge[] {
  const candidates = entry.inbound.filter((u) => inTimeline(u));
  const ranked = rankInboundNeighborIds(candidates, focusItem, itemById);
  const capped = applyNeighborCap(
    ranked,
    options.showAllUpstream,
    options.maxUpstreamEdges,
  );

  return capped.map((u) => {
    const upstreamItem = itemById.get(u);
    const tier: FocusEdgeTier = isSiblingTestNeighbor(upstreamItem, focusItem)
      ? "secondary"
      : "primary";
    return {
      fromId: u,
      toId: focusId,
      tier,
      hop: 1,
      leg: "upstream",
    };
  });
}

function collectOneHopDownstreamEdges(
  focusId: string,
  entry: TimelineAdjacencyEntry,
  focusItem: GanttItem,
  itemById: Map<string, GanttItem>,
  inTimeline: (id: string) => boolean,
  options: FocusTimelineEdgesOptions,
): FocusTimelineEdge[] {
  const downCandidates = entry.outbound.filter((v) => inTimeline(v));
  const rankedDown = rankOutboundNeighborIds(
    downCandidates,
    focusItem,
    itemById,
  );
  const cappedDown = applyNeighborCap(
    rankedDown,
    options.showAllDownstream,
    options.maxDownstreamEdges,
  );

  return cappedDown.map((v) => ({
    fromId: focusId,
    toId: v,
    tier: "downstream",
    hop: 1,
    leg: "downstream",
  }));
}

function collectExtendedEdges(
  focusId: string,
  timelineAdjacency: Record<string, TimelineAdjacencyEntry>,
  bundleIndexById: Map<string, number>,
  maxHops: number,
  perDir: number,
  includeUpstream: boolean,
  includeDownstream: boolean,
): {
  upExt: { edges: FocusTimelineEdge[]; truncated: boolean };
  downExt: { edges: FocusTimelineEdge[]; truncated: boolean };
} {
  return {
    upExt: includeUpstream
      ? collectExtendedUpstreamEdges(
          focusId,
          timelineAdjacency,
          bundleIndexById,
          maxHops,
          perDir,
        )
      : { edges: [] as FocusTimelineEdge[], truncated: false },
    downExt: includeDownstream
      ? collectExtendedDownstreamEdges(
          focusId,
          timelineAdjacency,
          bundleIndexById,
          maxHops,
          perDir,
        )
      : { edges: [] as FocusTimelineEdge[], truncated: false },
  };
}

function mergeFocusEdges(
  oneHop: FocusTimelineEdge[],
  upExt: FocusTimelineEdge[],
  downExt: FocusTimelineEdge[],
): FocusTimelineEdge[] {
  const merged = new Map<string, FocusTimelineEdge>();
  for (const e of oneHop) merged.set(focusEdgeDedupeKey(e), e);
  for (const e of upExt) {
    const k = focusEdgeDedupeKey(e);
    if (!merged.has(k)) merged.set(k, e);
  }
  for (const e of downExt) {
    const k = focusEdgeDedupeKey(e);
    if (!merged.has(k)) merged.set(k, e);
  }
  return [...merged.values()].sort(compareFocusEdges);
}

type ExtendedBfsDirection = "upstream" | "downstream";

interface ExtendedBfsVisitCtx {
  hop: number;
  direction: ExtendedBfsDirection;
  timelineAdjacency: Record<string, TimelineAdjacencyEntry>;
  inTimeline: (id: string) => boolean;
  seen: Set<string>;
  edges: FocusTimelineEdge[];
  maxEdges: number;
  nextFrontier: Set<string>;
}

function visitExtendedNeighborsForVertex(
  v: string,
  ctx: ExtendedBfsVisitCtx,
): boolean {
  const entry = ctx.timelineAdjacency[v];
  if (!entry) return false;
  const neighbors =
    ctx.direction === "upstream" ? entry.inbound : entry.outbound;
  for (const n of neighbors) {
    if (!ctx.inTimeline(n)) continue;
    const fromId = ctx.direction === "upstream" ? n : v;
    const toId = ctx.direction === "upstream" ? v : n;
    const key = focusEdgeDedupeKey({ fromId, toId });
    if (ctx.seen.has(key)) continue;
    ctx.seen.add(key);
    if (ctx.hop >= 2) {
      ctx.edges.push({
        fromId,
        toId,
        tier: ctx.direction === "upstream" ? "primary" : "downstream",
        hop: ctx.hop,
        leg: ctx.direction,
      });
      if (ctx.edges.length >= ctx.maxEdges) return true;
    }
    ctx.nextFrontier.add(n);
  }
  return false;
}

function collectExtendedEdgesBfs(
  focusId: string,
  timelineAdjacency: Record<string, TimelineAdjacencyEntry>,
  bundleIndexById: Map<string, number>,
  maxHops: number,
  maxEdges: number,
  direction: ExtendedBfsDirection,
): { edges: FocusTimelineEdge[]; truncated: boolean } {
  const inTimeline = (id: string) => bundleIndexById.has(id);
  const seen = new Set<string>();
  const edges: FocusTimelineEdge[] = [];
  let truncated = false;
  let frontier = new Set<string>([focusId]);

  for (let hop = 1; hop <= maxHops && edges.length < maxEdges; hop++) {
    const nextFrontier = new Set<string>();
    const visitCtx: ExtendedBfsVisitCtx = {
      hop,
      direction,
      timelineAdjacency,
      inTimeline,
      seen,
      edges,
      maxEdges,
      nextFrontier,
    };
    for (const v of frontier) {
      truncated = visitExtendedNeighborsForVertex(v, visitCtx);
      if (truncated) break;
    }
    frontier = nextFrontier;
    if (truncated || frontier.size === 0) break;
  }

  return { edges, truncated };
}

/** Extended upstream edges only (hop ≥ 2): BFS backward from focus using inbound lists. */
export function collectExtendedUpstreamEdges(
  focusId: string,
  timelineAdjacency: Record<string, TimelineAdjacencyEntry>,
  bundleIndexById: Map<string, number>,
  maxHops: number,
  maxEdges: number,
): { edges: FocusTimelineEdge[]; truncated: boolean } {
  return collectExtendedEdgesBfs(
    focusId,
    timelineAdjacency,
    bundleIndexById,
    maxHops,
    maxEdges,
    "upstream",
  );
}

/** Extended downstream edges only (hop ≥ 2): BFS forward from focus using outbound lists. */
export function collectExtendedDownstreamEdges(
  focusId: string,
  timelineAdjacency: Record<string, TimelineAdjacencyEntry>,
  bundleIndexById: Map<string, number>,
  maxHops: number,
  maxEdges: number,
): { edges: FocusTimelineEdge[]; truncated: boolean } {
  return collectExtendedEdgesBfs(
    focusId,
    timelineAdjacency,
    bundleIndexById,
    maxHops,
    maxEdges,
    "downstream",
  );
}

/** Count of manifest inbound neighbors that appear on the current timeline. */
export function countInboundOnTimeline(
  focusId: string | null,
  timelineAdjacency: Record<string, TimelineAdjacencyEntry> | undefined,
  bundleIndexById: Map<string, number>,
): number {
  if (!focusId || !timelineAdjacency) return 0;
  const entry = timelineAdjacency[focusId];
  if (!entry) return 0;
  let n = 0;
  for (const u of entry.inbound) {
    if (bundleIndexById.has(u)) n += 1;
  }
  return n;
}

/** Count of manifest outbound neighbors that appear on the current timeline. */
export function countOutboundOnTimeline(
  focusId: string | null,
  timelineAdjacency: Record<string, TimelineAdjacencyEntry> | undefined,
  bundleIndexById: Map<string, number>,
): number {
  if (!focusId || !timelineAdjacency) return 0;
  const entry = timelineAdjacency[focusId];
  if (!entry) return 0;
  let n = 0;
  for (const v of entry.outbound) {
    if (bundleIndexById.has(v)) n += 1;
  }
  return n;
}

/** Total inbound ids in adjacency for the node (ignores timeline visibility). */
export function countInboundInAdjacency(
  focusId: string | null,
  timelineAdjacency: Record<string, TimelineAdjacencyEntry> | undefined,
): number {
  if (!focusId || !timelineAdjacency) return 0;
  const entry = timelineAdjacency[focusId];
  return entry?.inbound.length ?? 0;
}

/** Total outbound ids in adjacency for the node (ignores timeline visibility). */
export function countOutboundInAdjacency(
  focusId: string | null,
  timelineAdjacency: Record<string, TimelineAdjacencyEntry> | undefined,
): number {
  if (!focusId || !timelineAdjacency) return 0;
  const entry = timelineAdjacency[focusId];
  return entry?.outbound.length ?? 0;
}

export interface DependencyContextHintParams {
  focusId: string;
  timelineAdjacency: Record<string, TimelineAdjacencyEntry> | undefined;
  bundleIndexById: Map<string, number>;
  edges: FocusTimelineEdge[];
  focusOptions: FocusTimelineEdgesOptions;
  extendedTruncated: boolean;
}

function pushCompactDirectCapHintParts(
  parts: string[],
  args: {
    includeUpstream: boolean;
    showAllUpstream: boolean;
    upstreamOnTimelineCount: number;
    upstreamShownCount: number;
    includeDownstream: boolean;
    showAllDownstream: boolean;
    outboundOnTimelineCount: number;
    downstreamShownCount: number;
  },
): void {
  if (
    args.includeUpstream &&
    !args.showAllUpstream &&
    args.upstreamOnTimelineCount > TIMELINE_MAX_UPSTREAM_EDGES
  ) {
    parts.push(
      `Showing ${args.upstreamShownCount} of ${args.upstreamOnTimelineCount} direct dependencies.`,
    );
  }
  if (
    args.includeDownstream &&
    !args.showAllDownstream &&
    args.outboundOnTimelineCount > TIMELINE_MAX_DOWNSTREAM_EDGES
  ) {
    parts.push(
      `Showing ${args.downstreamShownCount} of ${args.outboundOnTimelineCount} direct dependents.`,
    );
  }
}

function pushOffTimelineNeighborHintParts(
  parts: string[],
  hiddenUp: number,
  hiddenDown: number,
): void {
  if (hiddenUp > 0) {
    parts.push(
      `${hiddenUp} direct dependenc${hiddenUp === 1 ? "y" : "ies"} not on this timeline (filters or scope).`,
    );
  }
  if (hiddenDown > 0) {
    parts.push(
      `${hiddenDown} direct dependent${hiddenDown === 1 ? "" : "s"} not on this timeline (filters or scope).`,
    );
  }
}

function pushExtendedDepHintParts(
  parts: string[],
  args: {
    showExtendedDeps: boolean;
    hiddenUp: number;
    hiddenDown: number;
    onTimelineNeighborSum: number;
    extendedTruncated: boolean;
    edges: FocusTimelineEdge[];
  },
): void {
  if (
    !args.showExtendedDeps &&
    args.hiddenUp === 0 &&
    args.hiddenDown === 0 &&
    args.onTimelineNeighborSum > 0
  ) {
    parts.push("Transitive dependency lines are off for this timeline focus.");
  }

  if (args.showExtendedDeps && args.extendedTruncated) {
    const extCount = args.edges.filter((e) => e.hop >= 2).length;
    if (extCount > 0) {
      parts.push(
        `Showing ${extCount} transitive-on-timeline line${extCount === 1 ? "" : "s"}. Extended paths may be truncated by caps.`,
      );
    } else {
      parts.push("Extended dependency lines may be truncated by caps.");
    }
  }
}

/**
 * Tooltip copy when hovering the focused row: caps, off-timeline neighbors,
 * extended-mode state, and truncation. Returns undefined if nothing to say.
 */
export function buildDependencyContextHint(
  params: DependencyContextHintParams,
): string | undefined {
  const {
    focusId,
    timelineAdjacency,
    bundleIndexById,
    edges,
    focusOptions,
    extendedTruncated,
  } = params;
  const includeUpstream = focusOptions.includeUpstream ?? true;
  const includeDownstream = focusOptions.includeDownstream;
  const showExtendedDeps = focusOptions.extendedDeps?.enabled === true;

  const parts: string[] = [];

  const upstreamOnTimelineCount = countInboundOnTimeline(
    focusId,
    timelineAdjacency,
    bundleIndexById,
  );
  const upstreamShownCount = edges.filter(
    (e) => e.toId === focusId && e.hop === 1 && e.leg === "upstream",
  ).length;
  const outboundOnTimelineCount = countOutboundOnTimeline(
    focusId,
    timelineAdjacency,
    bundleIndexById,
  );
  const downstreamShownCount = edges.filter(
    (e) => e.hop === 1 && e.leg === "downstream",
  ).length;

  pushCompactDirectCapHintParts(parts, {
    includeUpstream,
    showAllUpstream: focusOptions.showAllUpstream,
    upstreamOnTimelineCount,
    upstreamShownCount,
    includeDownstream,
    showAllDownstream: focusOptions.showAllDownstream,
    outboundOnTimelineCount,
    downstreamShownCount,
  });

  const inboundAdj = countInboundInAdjacency(focusId, timelineAdjacency);
  const outboundAdj = countOutboundInAdjacency(focusId, timelineAdjacency);
  const hiddenUp = includeUpstream
    ? Math.max(0, inboundAdj - upstreamOnTimelineCount)
    : 0;
  const hiddenDown = includeDownstream
    ? Math.max(0, outboundAdj - outboundOnTimelineCount)
    : 0;

  pushOffTimelineNeighborHintParts(parts, hiddenUp, hiddenDown);

  pushExtendedDepHintParts(parts, {
    showExtendedDeps,
    hiddenUp,
    hiddenDown,
    onTimelineNeighborSum: upstreamOnTimelineCount + outboundOnTimelineCount,
    extendedTruncated,
    edges,
  });

  return parts.length > 0 ? parts.join(" ") : undefined;
}

/**
 * One-hop dependency edges plus optional extended (hop ≥ 2) segments for the focused node.
 * Upstream: manifest inbound neighbors → focus (ranked + optionally capped).
 * Downstream: focus → outbound (ranked + optionally capped, optional).
 */
export function getFocusTimelineEdges(
  focusId: string | null,
  timelineAdjacency: Record<string, TimelineAdjacencyEntry> | undefined,
  itemById: Map<string, GanttItem>,
  bundleIndexById: Map<string, number>,
  options: FocusTimelineEdgesOptions,
): FocusTimelineEdgesResult {
  if (!focusId || !timelineAdjacency) {
    return { edges: [], extendedTruncated: false };
  }
  const entry = timelineAdjacency[focusId];
  const focusItem = itemById.get(focusId);
  if (!entry || !focusItem || !bundleIndexById.has(focusId)) {
    return { edges: [], extendedTruncated: false };
  }

  const inTimeline = (id: string) => bundleIndexById.has(id);
  const includeUpstream = options.includeUpstream ?? true;
  const includeDownstream = options.includeDownstream;
  const oneHop = [
    ...(includeUpstream
      ? collectOneHopUpstreamEdges(
          focusId,
          entry,
          focusItem,
          itemById,
          inTimeline,
          options,
        )
      : []),
    ...(includeDownstream
      ? collectOneHopDownstreamEdges(
          focusId,
          entry,
          focusItem,
          itemById,
          inTimeline,
          options,
        )
      : []),
  ];

  const ext = options.extendedDeps;
  if (!ext?.enabled) {
    return {
      edges: [...oneHop].sort(compareFocusEdges),
      extendedTruncated: false,
    };
  }

  const maxHops = ext.maxHops ?? TIMELINE_EXTENDED_MAX_HOPS;
  const perDir =
    ext.maxEdgesPerDirection ?? TIMELINE_EXTENDED_MAX_EDGES_PER_DIRECTION;
  const { upExt, downExt } = collectExtendedEdges(
    focusId,
    timelineAdjacency,
    bundleIndexById,
    maxHops,
    perDir,
    includeUpstream,
    includeDownstream,
  );
  const edges = mergeFocusEdges(oneHop, upExt.edges, downExt.edges);
  return {
    edges,
    extendedTruncated: upExt.truncated || downExt.truncated,
  };
}

/** Vertical center (viewport coords) of a parcel's timing bar / test chip. */
export function parcelCenterY(
  bundleIndex: number,
  uniqueId: string,
  bundles: BundleRow[],
  rowOffsets: number[],
  scrollTop: number,
  showTests: boolean,
): number | null {
  const bundle = bundles[bundleIndex];
  if (!bundle) return null;
  const rowY = AXIS_TOP + (rowOffsets[bundleIndex] ?? 0) - scrollTop;

  if (bundle.item.unique_id === uniqueId) {
    return rowY + BAR_PAD + BAR_H / 2;
  }

  if (!showTests) return null;
  for (const { item: test, lane } of bundle.lanes) {
    if (test.unique_id === uniqueId) {
      const chipY = rowY + ROW_H + BUNDLE_HULL_PAD + lane * TEST_LANE_H;
      return chipY + TEST_BAR_H / 2;
    }
  }

  return null;
}

export interface FocusEdgePathParams {
  edge: FocusTimelineEdge;
  itemById: Map<string, GanttItem>;
  bundleIndexById: Map<string, number>;
  bundles: BundleRow[];
  rowOffsets: number[];
  scrollTop: number;
  showTests: boolean;
  effectiveLabelW: number;
  rangeStart: number;
  rangeEnd: number;
  chartW: number;
}

/**
 * Cubic-bezier path from the right edge of `fromItem` to the left edge of `toItem`.
 */
export function focusEdgePath(p: FocusEdgePathParams): string {
  const {
    edge,
    itemById,
    bundleIndexById,
    bundles,
    rowOffsets,
    scrollTop,
    showTests,
    effectiveLabelW,
    rangeStart,
    rangeEnd,
    chartW,
  } = p;
  const fromItem = itemById.get(edge.fromId);
  const toItem = itemById.get(edge.toId);
  const fromRow = bundleIndexById.get(edge.fromId);
  const toRow = bundleIndexById.get(edge.toId);
  if (
    fromItem == null ||
    toItem == null ||
    fromRow === undefined ||
    toRow === undefined
  ) {
    return "";
  }

  const sy = parcelCenterY(
    fromRow,
    edge.fromId,
    bundles,
    rowOffsets,
    scrollTop,
    showTests,
  );
  const ty = parcelCenterY(
    toRow,
    edge.toId,
    bundles,
    rowOffsets,
    scrollTop,
    showTests,
  );
  if (sy == null || ty == null) return "";

  const rangeDuration = Math.max(1, rangeEnd - rangeStart);
  const sx =
    effectiveLabelW +
    ((fromItem.start + fromItem.duration - rangeStart) / rangeDuration) *
      chartW;
  const tx =
    effectiveLabelW + ((toItem.start - rangeStart) / rangeDuration) * chartW;
  const cx = Math.abs(tx - sx) * 0.4;

  return `M${sx},${sy} C${sx + cx},${sy} ${tx - cx},${ty} ${tx},${ty}`;
}
