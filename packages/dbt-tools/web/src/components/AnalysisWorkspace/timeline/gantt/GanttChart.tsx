import { useEffect, useMemo, useRef, useState } from "react";
import { useSyncedDocumentTheme } from "@web/hooks/useTheme";
import type {
  GanttItem,
  ResourceConnectionSummary,
  ResourceTestStats,
} from "@web/types";
import {
  groupIntoBundles,
  type BundleRow,
} from "@web/lib/analysis-workspace/bundleLayout";
import { drawGantt } from "./canvasDraw";
import {
  AXIS_TOP,
  BUNDLE_HULL_PAD,
  LABEL_W,
  MAX_VIEWPORT_RATIO,
  MIN_VIEWPORT_H,
  ROW_H,
  TEST_LANE_H,
  TIMELINE_TIMEZONE_STORAGE_KEY,
  VIEWPORT_SCREEN_PADDING,
  type DisplayMode,
} from "./constants";
import { getAvailableTimeZones, getInitialTimeZone } from "./formatting";
import { getBundleEdges } from "./edgeGeometry";
import { GanttEdgeLayer } from "./GanttEdgeLayer";
import { GanttModeToggle } from "./GanttModeToggle";
import { GanttTooltip } from "./GanttTooltip";
import { hitTestBundle, type BundleLayout, type HoverState } from "./hitTest";

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

// ---------------------------------------------------------------------------
// Pure helpers (outside component to avoid re-creation on render)
// ---------------------------------------------------------------------------

function computeRowLayout(
  bundles: BundleRow[],
  expandedIds: Set<string>,
  showTests: boolean,
): { rowOffsets: number[]; rowHeights: number[]; totalHeight: number } {
  const rowOffsets: number[] = [];
  const rowHeights: number[] = [];
  let total = 0;
  for (const bundle of bundles) {
    rowOffsets.push(total);
    const isExpanded = expandedIds.has(bundle.item.unique_id);
    const h =
      isExpanded && showTests && bundle.laneCount > 0
        ? ROW_H + BUNDLE_HULL_PAD + bundle.laneCount * TEST_LANE_H + BUNDLE_HULL_PAD
        : ROW_H;
    rowHeights.push(h);
    total += h;
  }
  return { rowOffsets, rowHeights, totalHeight: total };
}

function computeVisRange(
  rowOffsets: number[],
  scrollTop: number,
  viewportH: number,
  bundleCount: number,
): { visStart: number; visEnd: number } {
  const bottom = scrollTop + viewportH - AXIS_TOP;
  let start = 0;
  while (start < bundleCount - 1 && (rowOffsets[start + 1] ?? 0) <= scrollTop) {
    start++;
  }
  start = Math.max(0, start - 1);
  let end = start;
  while (end < bundleCount - 1 && (rowOffsets[end] ?? 0) < bottom) {
    end++;
  }
  return { visStart: start, visEnd: Math.min(end, bundleCount - 1) };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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
  const [scrollTop, setScrollTop] = useState(0);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("duration");
  const [timeZone, setTimeZone] = useState<string>(getInitialTimeZone);
  const [containerWidth, setContainerWidth] = useState(0);
  const [windowHeight, setWindowHeight] = useState(() =>
    typeof window === "undefined" ? 900 : window.innerHeight,
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
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
  const { rowOffsets, rowHeights, totalHeight } = useMemo(
    () => computeRowLayout(bundles, expandedIds, showTests),
    [bundles, expandedIds, showTests],
  );

  const layout: BundleLayout = useMemo(
    () => ({ rowOffsets, rowHeights, expandedIds }),
    [rowOffsets, rowHeights, expandedIds],
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

  const totalScrollH = totalHeight + AXIS_TOP;
  const maxViewportH = Math.max(
    MIN_VIEWPORT_H,
    Math.min(
      windowHeight - VIEWPORT_SCREEN_PADDING,
      Math.round(windowHeight * MAX_VIEWPORT_RATIO),
    ),
  );
  const viewportH = Math.max(MIN_VIEWPORT_H, Math.min(maxViewportH, totalScrollH));
  const needsScroll = totalScrollH > viewportH;

  useEffect(() => {
    const onResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const { visStart, visEnd } = useMemo(
    () => computeVisRange(rowOffsets, scrollTop, viewportH, bundles.length),
    [rowOffsets, scrollTop, viewportH, bundles.length],
  );

  const edges = useMemo(() => {
    if (!showEdges || !dependencyIndex || bundles.length === 0) return [];
    return getBundleEdges(bundles, visStart, visEnd, dependencyIndex, bundleIndexById);
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || bundles.length === 0) return;

    function draw() {
      drawGantt(canvas!, bundles, rowOffsets, rowHeights, expandedIds, {
        scrollTop,
        maxEnd,
        displayMode: activeMode,
        runStartedAt,
        focusIds: focusedIds,
        hoveredId: hover?.item.unique_id ?? null,
        labelW: effectiveLabelW,
        timeZone,
        testStatsById,
        theme,
        showTests,
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
    bundles, rowOffsets, rowHeights, expandedIds, scrollTop, maxEnd, activeMode,
    runStartedAt, focusedIds, hover, effectiveLabelW, timeZone, testStatsById,
    theme, showTests,
  ]);

  if (bundles.length === 0) {
    return (
      <div className="empty-state empty-state--chart">
        No Gantt data (run_results may lack timing info)
      </div>
    );
  }

  function toggleExpand(bundleId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(bundleId)) next.delete(bundleId);
      else next.add(bundleId);
      return next;
    });
  }

  function handlePointerInteraction(
    e: React.MouseEvent<HTMLDivElement>,
    mode: "move" | "click",
  ) {
    const hit = hitTestBundle(e, bundles, layout, scrollTop, maxEnd, effectiveLabelW, canvasRef.current);
    if (!hit) {
      if (mode === "move") setHover(null);
      return;
    }
    if (mode === "move") {
      setHover(hit.isChevron ? null : { item: hit.item, x: hit.x, y: hit.y });
      return;
    }
    // click
    if (hit.isChevron) {
      toggleExpand(hit.item.unique_id);
    } else if (onSelect) {
      onSelect(hit.item.unique_id);
    }
  }

  return (
    <div className="gantt-shell" role="tree" aria-label="Execution timeline">
      {canShowTimestamps && (
        <GanttModeToggle
          activeMode={activeMode}
          onChange={setDisplayMode}
          activeTimeZone={timeZone}
          timeZones={availableTimeZones}
          onTimeZoneChange={setTimeZone}
        />
      )}

      <section className="chart-frame" style={{ position: "relative", userSelect: "none" }}>
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute", top: 0, left: 0,
            width: "100%", height: viewportH,
            pointerEvents: "none", display: "block",
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

        <div
          className="chart-frame__viewport"
          role="presentation"
          tabIndex={0}
          aria-label="Timeline chart viewport — use arrow keys to scroll"
          style={{ position: "relative", height: viewportH, overflowY: needsScroll ? "scroll" : "hidden" }}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          onMouseMove={(e) => handlePointerInteraction(e, "move")}
          onClick={(e) => handlePointerInteraction(e, "click")}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            const activeId = hover?.item.unique_id ?? selectedId;
            if (!activeId) return;
            const idx = bundleIndexById.get(activeId);
            const bundle = idx !== undefined ? bundles[idx] : undefined;
            if (bundle && bundle.tests.length > 0) {
              toggleExpand(bundle.item.unique_id);
            } else if (onSelect && activeId) {
              onSelect(activeId);
            }
          }}
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

// ---------------------------------------------------------------------------
// Helper: identify bundles that should be auto-expanded in failuresOnly mode
// ---------------------------------------------------------------------------

export function getFailureBundleIds(
  bundles: BundleRow[],
  testStatsById?: Map<string, ResourceTestStats>,
): Set<string> {
  const ids = new Set<string>();
  for (const bundle of bundles) {
    const stats = testStatsById?.get(bundle.item.unique_id);
    const hasTestFail = stats
      ? stats.fail + stats.error > 0
      : bundle.tests.some((t) => !isPositiveStatus(t.status));
    if (!isPositiveStatus(bundle.item.status) || hasTestFail) {
      ids.add(bundle.item.unique_id);
    }
  }
  return ids;
}

function isPositiveStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s === "success" || s === "pass" || s === "passed";
}
