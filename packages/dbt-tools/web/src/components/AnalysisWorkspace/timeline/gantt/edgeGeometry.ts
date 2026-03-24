import type { GanttItem, ResourceConnectionSummary } from "@web/types";
import { AXIS_TOP, BAR_H, BAR_PAD, ROW_H } from "./constants";

export interface Edge {
  sourceRow: number;
  targetRow: number;
}

export function getEdgesForVisibleRows(
  data: GanttItem[],
  visStart: number,
  visEnd: number,
  dependencyIndex: Record<string, ResourceConnectionSummary>,
  dataIndexById: Map<string, number>,
): Edge[] {
  const visibleIds = new Set<string>();
  for (let i = visStart; i <= visEnd; i++) {
    visibleIds.add(data[i].unique_id);
  }

  const edges: Edge[] = [];
  for (let i = visStart; i <= visEnd; i++) {
    const item = data[i];
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

export function edgePath(
  edge: Edge,
  data: GanttItem[],
  effectiveLabelW: number,
  maxEnd: number,
  chartW: number,
  scrollTop: number,
): string {
  const src = data[edge.sourceRow];
  const tgt = data[edge.targetRow];
  const sx = effectiveLabelW + ((src.start + src.duration) / maxEnd) * chartW;
  const sy =
    AXIS_TOP + edge.sourceRow * ROW_H + BAR_PAD + BAR_H / 2 - scrollTop;
  const tx = effectiveLabelW + (tgt.start / maxEnd) * chartW;
  const ty =
    AXIS_TOP + edge.targetRow * ROW_H + BAR_PAD + BAR_H / 2 - scrollTop;
  const cx = Math.abs(tx - sx) * 0.4;

  return `M${sx},${sy} C${sx + cx},${sy} ${tx - cx},${ty} ${tx},${ty}`;
}
