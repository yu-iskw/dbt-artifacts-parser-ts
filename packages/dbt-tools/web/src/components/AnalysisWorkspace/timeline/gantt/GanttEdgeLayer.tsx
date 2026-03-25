import { type ThemeMode, getThemeHex } from "@web/constants/themeColors";
import type { GanttItem } from "@web/types";
import { X_PAD } from "./constants";
import { type Edge, edgePath } from "./edgeGeometry";

export function GanttEdgeLayer({
  edges,
  data,
  focusedIds,
  canvasWidth,
  effectiveLabelW,
  maxEnd,
  scrollTop,
  viewportH,
  theme = "light",
}: {
  edges: Edge[];
  data: GanttItem[];
  focusedIds: Set<string> | null;
  canvasWidth: number;
  effectiveLabelW: number;
  maxEnd: number;
  scrollTop: number;
  viewportH: number;
  theme?: ThemeMode;
}) {
  const accent = getThemeHex(theme).accent;
  if (edges.length === 0) return null;
  const approxChartW = canvasWidth - effectiveLabelW - X_PAD;

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: viewportH,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 5,
      }}
      aria-hidden
    >
      {edges.map((edge, i) => {
        const edgeFocused =
          focusedIds == null ||
          (focusedIds.has(data[edge.sourceRow].unique_id) &&
            focusedIds.has(data[edge.targetRow].unique_id));
        return (
          <path
            key={i}
            d={edgePath(
              edge,
              data,
              effectiveLabelW,
              maxEnd,
              approxChartW,
              scrollTop,
            )}
            stroke={accent}
            strokeWidth={edgeFocused ? 1.6 : 1.1}
            fill="none"
            opacity={edgeFocused ? 0.55 : 0.1}
          />
        );
      })}
    </svg>
  );
}
