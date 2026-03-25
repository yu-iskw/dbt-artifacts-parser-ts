import { type ThemeMode, getThemeHex } from "@web/constants/themeColors";
import type { BundleRow } from "@web/lib/analysis-workspace/bundleLayout";
import type { GanttItem } from "@web/types";
import { X_PAD } from "./constants";
import { type FocusTimelineEdge, focusEdgePath } from "./edgeGeometry";

const MARKER_W = 8;
const MARKER_H = 8;

function ArrowMarker({ id, fill }: { id: string; fill: string }) {
  return (
    <marker
      id={id}
      viewBox={`0 0 ${MARKER_W} ${MARKER_H}`}
      refX={MARKER_W - 0.5}
      refY={MARKER_H / 2}
      markerWidth={MARKER_W}
      markerHeight={MARKER_H}
      orient="auto"
      markerUnits="userSpaceOnUse"
    >
      <path
        d={`M0,0 L${MARKER_W},${MARKER_H / 2} L0,${MARKER_H} Z`}
        fill={fill}
      />
    </marker>
  );
}

export function GanttEdgeLayer({
  edges,
  focusId,
  itemById,
  bundleIndexById,
  bundles,
  rowOffsets,
  canvasWidth,
  effectiveLabelW,
  maxEnd,
  scrollTop,
  viewportH,
  theme = "light",
  showTests = true,
}: {
  edges: FocusTimelineEdge[];
  focusId: string | null;
  itemById: Map<string, GanttItem>;
  bundleIndexById: Map<string, number>;
  bundles: BundleRow[];
  rowOffsets: number[];
  canvasWidth: number;
  effectiveLabelW: number;
  maxEnd: number;
  scrollTop: number;
  viewportH: number;
  theme?: ThemeMode;
  showTests?: boolean;
}) {
  if (focusId == null || edges.length === 0) return null;

  const t = getThemeHex(theme);
  const approxChartW = canvasWidth - effectiveLabelW - X_PAD;

  const markerPrimary = "gantt-edge-mk-primary";
  const markerSecondary = "gantt-edge-mk-secondary";
  const markerDownstream = "gantt-edge-mk-downstream";

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
      <defs>
        <ArrowMarker id={markerPrimary} fill={t.accent} />
        <ArrowMarker id={markerSecondary} fill={t.slate} />
        <ArrowMarker id={markerDownstream} fill={t.accent} />
      </defs>
      {edges.map((edge, i) => {
        const d = focusEdgePath({
          edge,
          itemById,
          bundleIndexById,
          bundles,
          rowOffsets,
          scrollTop,
          showTests,
          effectiveLabelW,
          maxEnd,
          chartW: approxChartW,
        });
        if (!d) return null;

        const tier = edge.tier;
        const stroke =
          tier === "secondary"
            ? t.slate
            : tier === "downstream"
              ? t.accent
              : t.accent;
        const strokeWidth =
          tier === "secondary" ? 1 : tier === "downstream" ? 1.5 : 2;
        const strokeDasharray =
          tier === "secondary" ? "4 3" : tier === "downstream" ? "5 4" : "6 4";
        const opacity =
          tier === "secondary" ? 0.42 : tier === "downstream" ? 0.62 : 0.88;
        const markerEnd =
          tier === "secondary"
            ? `url(#${markerSecondary})`
            : tier === "downstream"
              ? `url(#${markerDownstream})`
              : `url(#${markerPrimary})`;

        return (
          <path
            key={`${edge.fromId}-${edge.toId}-${edge.tier}-${i}`}
            d={d}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            fill="none"
            opacity={opacity}
            markerEnd={markerEnd}
          />
        );
      })}
    </svg>
  );
}
