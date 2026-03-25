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
} from "./constants";

export type FocusEdgeTier = "primary" | "secondary" | "downstream";

export interface FocusTimelineEdge {
  fromId: string;
  toId: string;
  tier: FocusEdgeTier;
}

function isSiblingTestUpstream(
  upstreamItem: GanttItem | undefined,
  focusItem: GanttItem | undefined,
): boolean {
  if (!upstreamItem || !focusItem) return false;
  if (!TEST_RESOURCE_TYPES.has(focusItem.resourceType)) return false;
  if (!TEST_RESOURCE_TYPES.has(upstreamItem.resourceType)) return false;
  if (focusItem.parentId == null || upstreamItem.parentId == null) return false;
  return focusItem.parentId === upstreamItem.parentId;
}

function isSiblingTestDownstream(
  downstreamItem: GanttItem | undefined,
  focusItem: GanttItem | undefined,
): boolean {
  if (!downstreamItem || !focusItem) return false;
  if (!TEST_RESOURCE_TYPES.has(focusItem.resourceType)) return false;
  if (!TEST_RESOURCE_TYPES.has(downstreamItem.resourceType)) return false;
  if (focusItem.parentId == null || downstreamItem.parentId == null)
    return false;
  return focusItem.parentId === downstreamItem.parentId;
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
    const sa = isSiblingTestUpstream(ia, focusItem) ? 0 : 1;
    const sb = isSiblingTestUpstream(ib, focusItem) ? 0 : 1;
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
    const sa = isSiblingTestDownstream(ia, focusItem) ? 0 : 1;
    const sb = isSiblingTestDownstream(ib, focusItem) ? 0 : 1;
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
  includeDownstream: boolean;
  /** When true, draw every direct upstream edge on the timeline. */
  showAllUpstream: boolean;
  /** When `showAllUpstream` is false, at most this many upstream edges. */
  maxUpstreamEdges: number;
  /** When true, draw every direct downstream edge on the timeline. */
  showAllDownstream: boolean;
  /** When `showAllDownstream` is false, at most this many downstream edges. */
  maxDownstreamEdges: number;
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

/**
 * One-hop dependency edges for the focused executed node only (O(degree)).
 * Upstream: manifest inbound neighbors → focus (ranked + optionally capped).
 * Downstream: focus → outbound (ranked + optionally capped, optional).
 */
export function getFocusTimelineEdges(
  focusId: string | null,
  timelineAdjacency: Record<string, TimelineAdjacencyEntry> | undefined,
  itemById: Map<string, GanttItem>,
  bundleIndexById: Map<string, number>,
  options: FocusTimelineEdgesOptions,
): FocusTimelineEdge[] {
  if (!focusId || !timelineAdjacency) return [];
  const entry = timelineAdjacency[focusId];
  const focusItem = itemById.get(focusId);
  if (!entry || !focusItem || !bundleIndexById.has(focusId)) return [];

  const inTimeline = (id: string) => bundleIndexById.has(id);
  const edges: FocusTimelineEdge[] = [];

  const candidates = entry.inbound.filter((u) => inTimeline(u));
  const ranked = rankInboundNeighborIds(candidates, focusItem, itemById);
  const capped = applyNeighborCap(
    ranked,
    options.showAllUpstream,
    options.maxUpstreamEdges,
  );

  for (const u of capped) {
    const upstreamItem = itemById.get(u);
    const tier: FocusEdgeTier = isSiblingTestUpstream(upstreamItem, focusItem)
      ? "secondary"
      : "primary";
    edges.push({ fromId: u, toId: focusId, tier });
  }

  if (options.includeDownstream) {
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
    for (const v of cappedDown) {
      edges.push({ fromId: focusId, toId: v, tier: "downstream" });
    }
  }

  return edges;
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
  maxEnd: number;
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
    maxEnd,
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

  const sx =
    effectiveLabelW + ((fromItem.start + fromItem.duration) / maxEnd) * chartW;
  const tx = effectiveLabelW + (toItem.start / maxEnd) * chartW;
  const cx = Math.abs(tx - sx) * 0.4;

  return `M${sx},${sy} C${sx + cx},${sy} ${tx - cx},${ty} ${tx},${ty}`;
}
