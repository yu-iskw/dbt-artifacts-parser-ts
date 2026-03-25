import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSyncedDocumentTheme } from "@web/hooks/useTheme";
import type {
  GanttItem,
  ResourceTestStats,
  TimelineAdjacencyEntry,
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
import { getFocusTimelineEdges } from "./edgeGeometry";
import { GanttChartFrame } from "./GanttChartFrame";
import { GanttModeToggle } from "./GanttModeToggle";
import { bundleRowHeight, computeRowLayout } from "./ganttChartHelpers";
import { hitTestBundle, type BundleLayout, type HoverState } from "./hitTest";
import { useGanttCanvasDraw } from "./useGanttCanvasDraw";

export { getFailureBundleIds } from "./ganttChartHelpers";

export interface GanttChartProps {
  data: GanttItem[];
  /** Absolute epoch-ms of the earliest executed node — enables wall-clock timestamps. */
  runStartedAt?: number | null;
  /** Immediate manifest neighbors for executed timeline nodes (from analyze). */
  timelineAdjacency?: Record<string, TimelineAdjacencyEntry>;
  testStatsById?: Map<string, ResourceTestStats>;
  /** Whether to show test chips inside bundle rows. Default: true. */
  showTests?: boolean;
  /** When true, one-hop outbound edges from the focused node are drawn. */
  showDependents?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}

export function GanttChart({
  data,
  runStartedAt,
  timelineAdjacency,
  testStatsById,
  showTests = true,
  showDependents = false,
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

  const itemById = useMemo(() => {
    const m = new Map<string, GanttItem>();
    for (const item of data) m.set(item.unique_id, item);
    return m;
  }, [data]);

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

  const maxEnd = useMemo(() => {
    let m = 1;
    for (const b of bundles) {
      m = Math.max(m, b.item.end);
      for (const t of b.tests) m = Math.max(m, t.end);
    }
    return m;
  }, [bundles]);

  /** Selection wins over hover for which dependency edges are shown. */
  const edgeFocusId = selectedId ?? hover?.item.unique_id ?? null;

  const edges = useMemo(
    () =>
      getFocusTimelineEdges(
        edgeFocusId,
        timelineAdjacency,
        itemById,
        bundleIndexById,
        { includeDownstream: showDependents },
      ),
    [edgeFocusId, timelineAdjacency, itemById, bundleIndexById, showDependents],
  );

  const focusedIds = useMemo(() => {
    if (!edgeFocusId) return null;
    const s = new Set<string>([edgeFocusId]);
    for (const e of edges) {
      s.add(e.fromId);
      s.add(e.toId);
    }
    return s;
  }, [edgeFocusId, edges]);

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
      else onSelect?.(null);
      return;
    }
    if (mode === "move") {
      setHover({ item: hit.item, x: hit.x, y: hit.y });
      return;
    }
    onSelect?.(hit.item.unique_id);
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

      <GanttChartFrame
        canvasRef={canvasRef}
        scrollRef={scrollRef}
        edges={edges}
        edgeFocusId={edgeFocusId}
        itemById={itemById}
        bundleIndexById={bundleIndexById}
        bundles={bundles}
        rowOffsets={rowOffsets}
        containerWidth={containerWidth}
        effectiveLabelW={effectiveLabelW}
        maxEnd={maxEnd}
        scrollTop={scrollTop}
        viewportH={viewportH}
        needsScroll={needsScroll}
        totalScrollH={totalScrollH}
        theme={theme}
        showTests={showTests}
        hover={hover}
        runStartedAt={runStartedAt}
        canShowTimestamps={canShowTimestamps}
        timeZone={timeZone}
        testStatsById={testStatsById}
        selectedId={selectedId}
        onSelect={onSelect}
        onPointer={handlePointerInteraction}
        onHoverClear={() => setHover(null)}
      />
    </div>
  );
}
