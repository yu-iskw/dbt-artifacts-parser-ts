import { useMemo } from "react";
import type { GanttItem, TimelineAdjacencyEntry } from "@web/types";
import type { TimelineDependencyDirection } from "@web/lib/analysis-workspace/types";
import {
  buildDependencyContextHint,
  getFocusTimelineEdges,
  type FocusTimelineEdge,
} from "./edgeGeometry";
import { mapTimelineDependencyControlsToFocusOptions } from "./dependencyControls";

export interface UseGanttFocusEdgesParams {
  edgeFocusId: string | null;
  timelineAdjacency: Record<string, TimelineAdjacencyEntry> | undefined;
  itemById: Map<string, GanttItem>;
  bundleIndexById: Map<string, number>;
  dependencyDirection: TimelineDependencyDirection;
  dependencyDepthHops: number;
  hoverUniqueId: string | null | undefined;
}

export function useGanttFocusEdges({
  edgeFocusId,
  timelineAdjacency,
  itemById,
  bundleIndexById,
  dependencyDirection,
  dependencyDepthHops,
  hoverUniqueId,
}: UseGanttFocusEdgesParams): {
  edges: FocusTimelineEdge[];
  dependencyEdgeHint: string | undefined;
} {
  const focusOptions = useMemo(
    () =>
      mapTimelineDependencyControlsToFocusOptions({
        dependencyDirection,
        dependencyDepthHops,
      }),
    [dependencyDepthHops, dependencyDirection],
  );

  const { edges, extendedTruncated } = useMemo(
    () =>
      getFocusTimelineEdges(
        edgeFocusId,
        timelineAdjacency,
        itemById,
        bundleIndexById,
        focusOptions,
      ),
    [edgeFocusId, timelineAdjacency, itemById, bundleIndexById, focusOptions],
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
      focusOptions,
      extendedTruncated,
    });
  }, [
    edgeFocusId,
    hoverUniqueId,
    edges,
    extendedTruncated,
    timelineAdjacency,
    bundleIndexById,
    focusOptions,
  ]);

  return { edges, dependencyEdgeHint };
}
