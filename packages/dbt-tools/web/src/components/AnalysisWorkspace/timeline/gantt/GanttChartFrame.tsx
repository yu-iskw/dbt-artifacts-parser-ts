import type { MouseEvent, RefObject } from "react";
import type { GanttItem, ResourceTestStats } from "@web/types";
import type { BundleRow } from "@web/lib/analysis-workspace/bundleLayout";
import type { ThemeMode } from "@web/constants/themeColors";
import type { FocusTimelineEdge } from "./edgeGeometry";
import { GanttEdgeLayer } from "./GanttEdgeLayer";
import { GanttTooltip } from "./GanttTooltip";
import type { HoverState } from "./hitTest";

export function GanttChartFrame({
  canvasRef,
  scrollRef,
  edges,
  edgeFocusId,
  itemById,
  bundleIndexById,
  bundles,
  rowOffsets,
  containerWidth,
  effectiveLabelW,
  maxEnd,
  scrollTop,
  viewportH,
  needsScroll,
  totalScrollH,
  theme,
  showTests,
  hover,
  runStartedAt,
  canShowTimestamps,
  timeZone,
  testStatsById,
  selectedId,
  onSelect,
  onPointer,
  onHoverClear,
  dependencyEdgeHint,
}: {
  canvasRef: RefObject<HTMLCanvasElement>;
  scrollRef: RefObject<HTMLDivElement>;
  edges: FocusTimelineEdge[];
  edgeFocusId: string | null;
  itemById: Map<string, GanttItem>;
  bundleIndexById: Map<string, number>;
  bundles: BundleRow[];
  rowOffsets: number[];
  containerWidth: number;
  effectiveLabelW: number;
  maxEnd: number;
  scrollTop: number;
  viewportH: number;
  needsScroll: boolean;
  totalScrollH: number;
  theme: ThemeMode;
  showTests: boolean;
  hover: HoverState | null;
  runStartedAt?: number | null;
  canShowTimestamps: boolean;
  timeZone: string;
  testStatsById?: Map<string, ResourceTestStats>;
  selectedId: string | null;
  onSelect?: (id: string | null) => void;
  onPointer: (e: MouseEvent<HTMLDivElement>, mode: "move" | "click") => void;
  onHoverClear: () => void;
  dependencyEdgeHint?: string;
}) {
  return (
    <section
      className="chart-frame"
      style={{ position: "relative", userSelect: "none" }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: viewportH,
          pointerEvents: "none",
          display: "block",
        }}
      />

      <GanttEdgeLayer
        edges={edges}
        focusId={edgeFocusId}
        itemById={itemById}
        bundleIndexById={bundleIndexById}
        bundles={bundles}
        rowOffsets={rowOffsets}
        canvasWidth={containerWidth > 0 ? containerWidth : 600}
        effectiveLabelW={effectiveLabelW}
        maxEnd={maxEnd}
        scrollTop={scrollTop}
        viewportH={viewportH}
        theme={theme}
        showTests={showTests}
      />

      {
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- chart viewport hit-test + scroll
        <div
          ref={scrollRef}
          className="chart-frame__viewport"
          role="region"
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- keyboard scroll / activation
          tabIndex={0}
          aria-label="Timeline chart viewport — use arrow keys to scroll"
          style={{
            position: "relative",
            height: viewportH,
            overflowY: needsScroll ? "auto" : "hidden",
          }}
          onMouseMove={(e) => onPointer(e, "move")}
          onClick={(e) => onPointer(e, "click")}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            const activeId = hover?.item.unique_id ?? selectedId;
            if (!activeId) return;
            onSelect?.(activeId);
          }}
          onMouseLeave={onHoverClear}
        >
          <div style={{ height: totalScrollH }} />
        </div>
      }

      {hover && (
        <GanttTooltip
          hover={hover}
          runStartedAt={runStartedAt}
          canShowTimestamps={canShowTimestamps}
          timeZone={timeZone}
          testStats={testStatsById?.get(hover.item.unique_id)}
          dependencyEdgeHint={dependencyEdgeHint}
        />
      )}
    </section>
  );
}
