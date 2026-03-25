import { useMemo } from "react";
import type { GanttItem, TimelineAdjacencyEntry } from "@web/types";
import {
  TIMELINE_MAX_DOWNSTREAM_EDGES,
  TIMELINE_MAX_UPSTREAM_EDGES,
} from "./constants";
import {
  countInboundOnTimeline,
  countOutboundOnTimeline,
  getFocusTimelineEdges,
  type FocusTimelineEdge,
} from "./edgeGeometry";

export interface UseGanttFocusEdgesParams {
  edgeFocusId: string | null;
  timelineAdjacency: Record<string, TimelineAdjacencyEntry> | undefined;
  itemById: Map<string, GanttItem>;
  bundleIndexById: Map<string, number>;
  showDependents: boolean;
  showAllUpstream: boolean;
  showAllDownstream: boolean;
  hoverUniqueId: string | null | undefined;
}

export function useGanttFocusEdges({
  edgeFocusId,
  timelineAdjacency,
  itemById,
  bundleIndexById,
  showDependents,
  showAllUpstream,
  showAllDownstream,
  hoverUniqueId,
}: UseGanttFocusEdgesParams): {
  edges: FocusTimelineEdge[];
  dependencyEdgeHint: string | undefined;
} {
  const edges = useMemo(
    () =>
      getFocusTimelineEdges(
        edgeFocusId,
        timelineAdjacency,
        itemById,
        bundleIndexById,
        {
          includeDownstream: showDependents,
          showAllUpstream,
          maxUpstreamEdges: TIMELINE_MAX_UPSTREAM_EDGES,
          showAllDownstream,
          maxDownstreamEdges: TIMELINE_MAX_DOWNSTREAM_EDGES,
        },
      ),
    [
      edgeFocusId,
      timelineAdjacency,
      itemById,
      bundleIndexById,
      showDependents,
      showAllUpstream,
      showAllDownstream,
    ],
  );

  const dependencyEdgeHint = useMemo(() => {
    if (!edgeFocusId || hoverUniqueId !== edgeFocusId) {
      return undefined;
    }
    const upstreamOnTimelineCount = countInboundOnTimeline(
      edgeFocusId,
      timelineAdjacency,
      bundleIndexById,
    );
    const upstreamShownCount = edges.filter(
      (e) => e.toId === edgeFocusId && e.tier !== "downstream",
    ).length;
    const outboundOnTimelineCount = countOutboundOnTimeline(
      edgeFocusId,
      timelineAdjacency,
      bundleIndexById,
    );
    const downstreamShownCount = edges.filter(
      (e) => e.tier === "downstream",
    ).length;
    const parts: string[] = [];
    if (
      !showAllUpstream &&
      upstreamOnTimelineCount > TIMELINE_MAX_UPSTREAM_EDGES
    ) {
      parts.push(
        `Showing ${upstreamShownCount} of ${upstreamOnTimelineCount} direct dependencies.`,
      );
    }
    if (
      showDependents &&
      !showAllDownstream &&
      outboundOnTimelineCount > TIMELINE_MAX_DOWNSTREAM_EDGES
    ) {
      parts.push(
        `Showing ${downstreamShownCount} of ${outboundOnTimelineCount} direct dependents.`,
      );
    }
    return parts.length > 0 ? parts.join(" ") : undefined;
  }, [
    edgeFocusId,
    hoverUniqueId,
    edges,
    timelineAdjacency,
    bundleIndexById,
    showAllUpstream,
    showDependents,
    showAllDownstream,
  ]);

  return { edges, dependencyEdgeHint };
}
