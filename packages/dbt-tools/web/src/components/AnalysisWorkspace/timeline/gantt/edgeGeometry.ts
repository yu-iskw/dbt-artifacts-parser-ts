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

/**
 * One-hop dependency edges for the focused executed node only (O(degree)).
 * Upstream: manifest inbound neighbors → focus. Downstream: focus → outbound (optional).
 */
export function getFocusTimelineEdges(
  focusId: string | null,
  timelineAdjacency: Record<string, TimelineAdjacencyEntry> | undefined,
  itemById: Map<string, GanttItem>,
  bundleIndexById: Map<string, number>,
  options: { includeDownstream: boolean },
): FocusTimelineEdge[] {
  if (!focusId || !timelineAdjacency) return [];
  const entry = timelineAdjacency[focusId];
  const focusItem = itemById.get(focusId);
  if (!entry || !focusItem || !bundleIndexById.has(focusId)) return [];

  const inTimeline = (id: string) => bundleIndexById.has(id);
  const edges: FocusTimelineEdge[] = [];

  for (const u of entry.inbound) {
    if (!inTimeline(u)) continue;
    const upstreamItem = itemById.get(u);
    const tier: FocusEdgeTier = isSiblingTestUpstream(upstreamItem, focusItem)
      ? "secondary"
      : "primary";
    edges.push({ fromId: u, toId: focusId, tier });
  }

  if (options.includeDownstream) {
    for (const v of entry.outbound) {
      if (!inTimeline(v)) continue;
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
