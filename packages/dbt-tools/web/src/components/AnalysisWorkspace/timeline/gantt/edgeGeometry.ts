import type { GanttItem, ResourceConnectionSummary } from "@web/types";
import type { BundleRow } from "@web/lib/analysis-workspace/bundleLayout";
import { AXIS_TOP, BAR_H, BAR_PAD, ROW_H } from "./constants";

export interface Edge {
  sourceRow: number;
  targetRow: number;
}

// ---------------------------------------------------------------------------
// Bundle-level edges (default — one edge per unique bundle pair)
// ---------------------------------------------------------------------------

/**
 * Compute deduplicated bundle-to-bundle edges for the visible range.
 *
 * Each edge goes from the right edge of the source bundle's parent bar to the
 * left edge of the target bundle's parent bar (same geometry as node-level
 * edges, but one per unique bundle pair).
 */
export function getBundleEdges(
  bundles: BundleRow[],
  visStart: number,
  visEnd: number,
  dependencyIndex: Record<string, ResourceConnectionSummary>,
  bundleIndexById: Map<string, number>,
): Edge[] {
  const visibleSet = new Set<number>();
  for (let i = visStart; i <= visEnd; i++) {
    visibleSet.add(i);
  }

  const seen = new Set<string>();
  const edges: Edge[] = [];

  for (let i = visStart; i <= visEnd; i++) {
    const bundle = bundles[i];
    if (!bundle) continue;
    const deps = dependencyIndex[bundle.item.unique_id];
    if (!deps) continue;

    for (const upstream of deps.upstream) {
      const sourceIdx = bundleIndexById.get(upstream.uniqueId);
      if (sourceIdx === undefined || sourceIdx === i) continue;
      if (!visibleSet.has(sourceIdx)) continue;

      const key = `${sourceIdx}:${i}`;
      if (seen.has(key)) continue;
      seen.add(key);

      edges.push({ sourceRow: sourceIdx, targetRow: i });
    }
  }

  return edges;
}

// ---------------------------------------------------------------------------
// Node-level edges (used in focus mode)
// ---------------------------------------------------------------------------

export function getEdgesForVisibleRows(
  data: GanttItem[],
  visStart: number,
  visEnd: number,
  dependencyIndex: Record<string, ResourceConnectionSummary>,
  dataIndexById: Map<string, number>,
): Edge[] {
  const visibleIds = new Set<string>();
  for (let i = visStart; i <= visEnd; i++) {
    const item = data[i];
    if (item) visibleIds.add(item.unique_id);
  }

  const edges: Edge[] = [];
  for (let i = visStart; i <= visEnd; i++) {
    const item = data[i];
    if (!item) continue;
    const deps = dependencyIndex[item.unique_id];
    if (!deps) continue;
    for (const upstreamId of deps.upstream.map((d) => d.uniqueId)) {
      if (!visibleIds.has(upstreamId)) continue;
      const sourceRow = dataIndexById.get(upstreamId);
      if (sourceRow === undefined) continue;
      edges.push({ sourceRow, targetRow: i });
    }
  }
  return edges;
}

// ---------------------------------------------------------------------------
// Edge path — shared by both bundle and node-level edges
// ---------------------------------------------------------------------------

/**
 * Compute a cubic-bezier SVG path from the end of the source bar to the
 * start of the target bar. Accepts an array of GanttItems ordered by row
 * index (pass `bundles.map(b => b.item)` for bundle-level edges).
 *
 * `rowOffsets` — cumulative Y pixel offset per row (content-area relative,
 * excluding AXIS_TOP). When omitted, uniform ROW_H is assumed (legacy).
 */
export function edgePath(
  edge: Edge,
  data: GanttItem[],
  effectiveLabelW: number,
  maxEnd: number,
  chartW: number,
  scrollTop: number,
  rowOffsets?: number[],
): string {
  const src = data[edge.sourceRow];
  const tgt = data[edge.targetRow];
  if (!src || !tgt) return "";

  const srcOffsetY = rowOffsets
    ? (rowOffsets[edge.sourceRow] ?? edge.sourceRow * ROW_H)
    : edge.sourceRow * ROW_H;
  const tgtOffsetY = rowOffsets
    ? (rowOffsets[edge.targetRow] ?? edge.targetRow * ROW_H)
    : edge.targetRow * ROW_H;

  const sx = effectiveLabelW + ((src.start + src.duration) / maxEnd) * chartW;
  const sy = AXIS_TOP + srcOffsetY + BAR_PAD + BAR_H / 2 - scrollTop;
  const tx = effectiveLabelW + (tgt.start / maxEnd) * chartW;
  const ty = AXIS_TOP + tgtOffsetY + BAR_PAD + BAR_H / 2 - scrollTop;
  const cx = Math.abs(tx - sx) * 0.4;

  return `M${sx},${sy} C${sx + cx},${sy} ${tx - cx},${ty} ${tx},${ty}`;
}
