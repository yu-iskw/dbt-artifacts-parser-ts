import { useEffect, useMemo, useRef, useState } from "react";
import type {
  GanttItem,
  ResourceConnectionSummary,
  ResourceTestStats,
} from "@web/types";
import { drawGantt } from "./canvasDraw";
import {
  AXIS_TOP,
  LABEL_W,
  MAX_VIEWPORT_RATIO,
  MIN_VIEWPORT_H,
  ROW_H,
  TIMELINE_TIMEZONE_STORAGE_KEY,
  VIEWPORT_SCREEN_PADDING,
  type DisplayMode,
} from "./constants";
import { getAvailableTimeZones, getInitialTimeZone } from "./formatting";
import { getEdgesForVisibleRows } from "./edgeGeometry";
import { GanttEdgeLayer } from "./GanttEdgeLayer";
import { GanttModeToggle } from "./GanttModeToggle";
import { GanttTooltip } from "./GanttTooltip";
import { hitTestBar, type HoverState } from "./hitTest";

export interface GanttChartProps {
  data: GanttItem[];
  /** Absolute epoch-ms of the earliest executed node — enables wall-clock timestamps. */
  runStartedAt?: number | null;
  /** O(1) lookup from unique_id → row index (pass from TimelineView). */
  dataIndexById?: Map<string, number>;
  /** Dependency index keyed by unique_id. */
  dependencyIndex?: Record<string, ResourceConnectionSummary>;
  testStatsById?: Map<string, ResourceTestStats>;
  /** Whether to render dependency edges. Default: true. */
  showEdges?: boolean;
}

export function GanttChart({
  data,
  runStartedAt,
  dataIndexById,
  dependencyIndex,
  testStatsById,
  showEdges = true,
}: GanttChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("duration");
  const [timeZone, setTimeZone] = useState<string>(getInitialTimeZone);
  const [containerWidth, setContainerWidth] = useState(0);
  const [windowHeight, setWindowHeight] = useState(() =>
    typeof window === "undefined" ? 900 : window.innerHeight,
  );
  const availableTimeZones = useMemo(() => getAvailableTimeZones(), []);

  const canShowTimestamps = runStartedAt != null;
  const activeMode: DisplayMode = canShowTimestamps ? displayMode : "duration";

  useEffect(() => {
    try {
      window.localStorage.setItem(TIMELINE_TIMEZONE_STORAGE_KEY, timeZone);
    } catch {
      // ignore localStorage failures
    }
  }, [timeZone]);

  const effectiveLabelW =
    containerWidth > 0
      ? Math.max(80, Math.min(LABEL_W, Math.round(containerWidth * 0.35)))
      : LABEL_W;

  const maxEnd = Math.max(...data.map((d) => d.end), 1);
  const totalScrollH = data.length * ROW_H + AXIS_TOP;
  const maxViewportHeight = Math.max(
    MIN_VIEWPORT_H,
    Math.min(
      windowHeight - VIEWPORT_SCREEN_PADDING,
      Math.round(windowHeight * MAX_VIEWPORT_RATIO),
    ),
  );
  const viewportH = Math.max(
    MIN_VIEWPORT_H,
    Math.min(maxViewportHeight, totalScrollH),
  );
  const needsScroll = totalScrollH > viewportH;

  useEffect(() => {
    const onResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const visStart = Math.max(0, Math.floor(scrollTop / ROW_H));
  const visEnd = Math.min(
    data.length - 1,
    Math.ceil((scrollTop + viewportH - AXIS_TOP) / ROW_H),
  );

  const edges = useMemo(() => {
    if (!showEdges || !dependencyIndex || !dataIndexById || data.length === 0) {
      return [];
    }
    return getEdgesForVisibleRows(
      data,
      visStart,
      visEnd,
      dependencyIndex,
      dataIndexById,
    );
  }, [showEdges, dependencyIndex, dataIndexById, data, visStart, visEnd]);

  const focusedIds = useMemo(() => {
    if (!hover?.item || !dependencyIndex) return null;
    const relation = dependencyIndex[hover.item.unique_id];
    if (!relation) return new Set([hover.item.unique_id]);
    return new Set([
      hover.item.unique_id,
      ...relation.upstream.map((d) => d.uniqueId),
      ...relation.downstream.map((d) => d.uniqueId),
    ]);
  }, [dependencyIndex, hover]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    function draw() {
      drawGantt(canvas!, data, {
        scrollTop,
        maxEnd,
        displayMode: activeMode,
        runStartedAt,
        focusIds: focusedIds,
        hoveredId: hover?.item.unique_id ?? null,
        labelW: effectiveLabelW,
        timeZone,
        testStatsById,
      });
    }

    draw();

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
      draw();
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [
    data,
    scrollTop,
    maxEnd,
    activeMode,
    runStartedAt,
    focusedIds,
    hover,
    effectiveLabelW,
    timeZone,
    testStatsById,
  ]);

  if (data.length === 0) {
    return (
      <div className="empty-state empty-state--chart">
        No Gantt data (run_results may lack timing info)
      </div>
    );
  }

  return (
    <div className="gantt-shell">
      {canShowTimestamps && (
        <GanttModeToggle
          activeMode={activeMode}
          onChange={setDisplayMode}
          activeTimeZone={timeZone}
          timeZones={availableTimeZones}
          onTimeZoneChange={setTimeZone}
        />
      )}

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
          data={data}
          focusedIds={focusedIds}
          canvasWidth={containerWidth > 0 ? containerWidth : 600}
          effectiveLabelW={effectiveLabelW}
          maxEnd={maxEnd}
          scrollTop={scrollTop}
          viewportH={viewportH}
        />

        <div
          className="chart-frame__viewport"
          style={{
            position: "relative",
            height: viewportH,
            overflowY: needsScroll ? "scroll" : "hidden",
          }}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          onMouseMove={(e) =>
            setHover(
              hitTestBar(
                e,
                data,
                scrollTop,
                maxEnd,
                effectiveLabelW,
                canvasRef.current,
              ),
            )
          }
          onMouseLeave={() => setHover(null)}
        >
          <div style={{ height: totalScrollH }} />
        </div>

        {hover && (
          <GanttTooltip
            hover={hover}
            runStartedAt={runStartedAt}
            canShowTimestamps={canShowTimestamps}
            timeZone={timeZone}
            testStats={testStatsById?.get(hover.item.unique_id)}
          />
        )}
      </section>
    </div>
  );
}
