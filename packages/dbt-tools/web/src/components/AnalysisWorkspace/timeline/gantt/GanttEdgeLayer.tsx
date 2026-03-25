import { type ThemeMode, getThemeHex } from "@web/constants/themeColors";
import type { BundleRow } from "@web/lib/analysis-workspace/bundleLayout";
import { X_PAD } from "./constants";
import { type Edge, edgePath } from "./edgeGeometry";

export function GanttEdgeLayer({
  edges,
  bundles,
  rowOffsets,
  focusedIds,
  canvasWidth,
  effectiveLabelW,
  maxEnd,
  scrollTop,
  viewportH,
  theme = "light",
}: {
  edges: Edge[];
  /** Bundle rows — used to look up parent item positions for edge drawing. */
  bundles: BundleRow[];
  /** Cumulative Y pixel offset per bundle (content-area relative, excl. AXIS_TOP). */
  rowOffsets: number[];
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

  // Edge paths use parent item positions (bundles[i].item)
  const parentItems = bundles.map((b) => b.item);

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
        const srcBundle = bundles[edge.sourceRow];
        const tgtBundle = bundles[edge.targetRow];
        if (!srcBundle || !tgtBundle) return null;

        const edgeFocused =
          focusedIds == null ||
          (focusedIds.has(srcBundle.item.unique_id) &&
            focusedIds.has(tgtBundle.item.unique_id));

        return (
          <path
            key={i}
            d={edgePath(
              edge,
              parentItems,
              effectiveLabelW,
              maxEnd,
              approxChartW,
              scrollTop,
              rowOffsets,
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
