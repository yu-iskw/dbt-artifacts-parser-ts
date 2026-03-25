import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSyncedDocumentTheme } from "@web/hooks/useTheme";
import type {
  GanttItem,
  ResourceConnectionSummary,
  ResourceTestStats,
} from "@web/types";
import { groupIntoBundles } from "@web/lib/analysis-workspace/bundleLayout";
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
import { getBundleEdges } from "./edgeGeometry";
import { GanttEdgeLayer } from "./GanttEdgeLayer";
import { GanttModeToggle } from "./GanttModeToggle";
import { GanttTooltip } from "./GanttTooltip";
import {
  bundleRowHeight,
  computeRowLayout,
  computeVisRange,
} from "./ganttChartHelpers";
import { hitTestBundle, type BundleLayout, type HoverState } from "./hitTest";
import { useGanttCanvasDraw } from "./useGanttCanvasDraw";

export { getFailureBundleIds } from "./ganttChartHelpers";

export interface GanttChartProps {
  data: GanttItem[];
  /** Absolute epoch-ms of the earliest executed node — enables wall-clock timestamps. */
  runStartedAt?: number | null;
  /** Dependency index keyed by unique_id. */
  dependencyIndex?: Record<string, ResourceConnectionSummary>;
  testStatsById?: Map<string, ResourceTestStats>;
  /** Whether to render dependency edges. Default: true. */
  showEdges?: boolean;
  /** Whether to show test chips inside bundle rows. Default: true. */
  showTests?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

export function GanttChart({
  data,
  runStartedAt,
  dependencyIndex,
  testStatsById,
  showEdges = true,
  showTests = true,
  selectedId = null,
  onSelect,
}: GanttChartProps) {
  const theme = useSyncedDocumentTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
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

  const bundles = useMemo(() => groupIntoBundles(data), [data]);
  const { rowOffsets, rowHeights } = useMemo(
    () => computeRowLayout(bundles, showTests),
    [bundles, showTests],
  );

  // TanStack Virtual drives scroll metrics; sizes come from bundle data (see bundleRowHeight).
  // eslint-disable-next-line react-hooks/incompatible-library -- useVirtualizer is intentionally non-memoized per TanStack
  const virtualizer = useVirtualizer({
    count: bundles.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) =>
      bundles[index] ? bundleRowHeight(bundles[index], showTests) : ROW_H,
    getItemKey: (index) => bundles[index]?.item.unique_id ?? index,
    overscan: 10,
  });

  const scrollTop = virtualizer.scrollOffset ?? 0;

  useLayoutEffect(() => {
    virtualizer.measure();
  }, [bundles, showTests, virtualizer]);

  const layout: BundleLayout = useMemo(
    () => ({ rowOffsets, rowHeights, showTests }),
    [rowOffsets, rowHeights, showTests],
  );

  const bundleIndexById = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < bundles.length; i++) {
      const bundle = bundles[i];
      if (!bundle) continue;
      map.set(bundle.item.unique_id, i);
      for (const test of bundle.tests) map.set(test.unique_id, i);
    }
    return map;
  }, [bundles]);

  const maxEnd = useMemo(
    () => Math.max(...bundles.map((b) => b.item.end), 1),
    [bundles],
  );

  const totalScrollH = AXIS_TOP + virtualizer.getTotalSize();
  const maxViewportH = Math.max(
    MIN_VIEWPORT_H,
    Math.min(
      windowHeight - VIEWPORT_SCREEN_PADDING,
      Math.round(windowHeight * MAX_VIEWPORT_RATIO),
    ),
  );
  const viewportH = Math.max(
    MIN_VIEWPORT_H,
    Math.min(maxViewportH, totalScrollH),
  );
  const needsScroll = totalScrollH > viewportH;

  useEffect(() => {
    const onResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const { visStart, visEnd } = useMemo(() => {
    const items = virtualizer.getVirtualItems();
    if (items.length > 0 && bundles.length > 0) {
      const first = items[0]!.index;
      const last = items[items.length - 1]!.index;
      return {
        visStart: Math.max(0, first - 1),
        visEnd: Math.min(bundles.length - 1, last + 1),
      };
    }
    return computeVisRange(rowOffsets, scrollTop, viewportH, bundles.length);
  }, [bundles.length, rowOffsets, scrollTop, viewportH, virtualizer]);

  const edges = useMemo(() => {
    if (!showEdges || !dependencyIndex || bundles.length === 0) return [];
    return getBundleEdges(
      bundles,
      visStart,
      visEnd,
      dependencyIndex,
      bundleIndexById,
    );
  }, [showEdges, dependencyIndex, bundles, visStart, visEnd, bundleIndexById]);

  const focusedIds = useMemo(() => {
    const activeId = selectedId ?? hover?.item.unique_id ?? null;
    if (!activeId || !dependencyIndex) return null;
    const relation = dependencyIndex[activeId];
    if (!relation) return new Set([activeId]);
    return new Set([
      activeId,
      ...relation.upstream.map((d) => d.uniqueId),
      ...relation.downstream.map((d) => d.uniqueId),
    ]);
  }, [dependencyIndex, hover, selectedId]);

  useGanttCanvasDraw({
    canvasRef,
    bundles,
    rowOffsets,
    rowHeights,
    scrollTop,
    maxEnd,
    activeMode,
    runStartedAt,
    focusedIds,
    hoveredId: hover?.item.unique_id ?? null,
    effectiveLabelW,
    timeZone,
    testStatsById,
    theme,
    showTests,
    setContainerWidth,
  });

  if (bundles.length === 0) {
    return (
      <div className="empty-state empty-state--chart">
        No Gantt data (run_results may lack timing info)
      </div>
    );
  }

  function handlePointerInteraction(
    e: React.MouseEvent<HTMLDivElement>,
    mode: "move" | "click",
  ) {
    const hit = hitTestBundle(
      e,
      bundles,
      layout,
      scrollTop,
      maxEnd,
      effectiveLabelW,
      canvasRef.current,
    );
    if (!hit) {
      if (mode === "move") setHover(null);
      return;
    }
    if (mode === "move") {
      setHover({ item: hit.item, x: hit.x, y: hit.y });
      return;
    }
    if (onSelect) onSelect(hit.item.unique_id);
  }

  return (
    <div className="gantt-shell" role="region" aria-label="Execution timeline">
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
          bundles={bundles}
          rowOffsets={rowOffsets}
          focusedIds={focusedIds}
          canvasWidth={containerWidth > 0 ? containerWidth : 600}
          effectiveLabelW={effectiveLabelW}
          maxEnd={maxEnd}
          scrollTop={scrollTop}
          viewportH={viewportH}
          theme={theme}
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
            onMouseMove={(e) => handlePointerInteraction(e, "move")}
            onClick={(e) => handlePointerInteraction(e, "click")}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              const activeId = hover?.item.unique_id ?? selectedId;
              if (!activeId || !onSelect) return;
              onSelect(activeId);
            }}
            onMouseLeave={() => setHover(null)}
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
          />
        )}
      </section>
    </div>
  );
}
