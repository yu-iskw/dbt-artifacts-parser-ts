import { useMemo } from "react";
import type { GanttItem, TimelineAdjacencyEntry } from "@web/types";
import {
  TIMELINE_EXTENDED_MAX_EDGES_PER_DIRECTION,
  TIMELINE_EXTENDED_MAX_HOPS,
  TIMELINE_MAX_DOWNSTREAM_EDGES,
  TIMELINE_MAX_UPSTREAM_EDGES,
} from "./constants";
import {
  buildDependencyContextHint,
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
  /** Multi-hop extended edges (hop ≥ 2), capped separately. */
  showExtendedDeps: boolean;
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
  showExtendedDeps,
  hoverUniqueId,
}: UseGanttFocusEdgesParams): {
  edges: FocusTimelineEdge[];
  dependencyEdgeHint: string | undefined;
} {
  const { edges, extendedTruncated } = useMemo(
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
          extendedDeps: showExtendedDeps
            ? {
                enabled: true,
                maxHops: TIMELINE_EXTENDED_MAX_HOPS,
                maxEdgesPerDirection: TIMELINE_EXTENDED_MAX_EDGES_PER_DIRECTION,
              }
            : { enabled: false },
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
      showExtendedDeps,
    ],
  );

  const dependencyEdgeHint = useMemo(() => {
    if (!edgeFocusId || hoverUniqueId !== edgeFocusId) {
      return undefined;
    }
    return buildDependencyContextHint({
      focusId: edgeFocusId,
      timelineAdjacency,
      bundleIndexById,
      edges,
      showDependents,
      showAllUpstream,
      showAllDownstream,
      showExtendedDeps,
      extendedTruncated,
    });
  }, [
    edgeFocusId,
    hoverUniqueId,
    edges,
    extendedTruncated,
    timelineAdjacency,
    bundleIndexById,
    showAllUpstream,
    showDependents,
    showAllDownstream,
    showExtendedDeps,
  ]);

  return { edges, dependencyEdgeHint };
}
