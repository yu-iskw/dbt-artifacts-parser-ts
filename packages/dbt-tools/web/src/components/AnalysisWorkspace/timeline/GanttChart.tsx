import { useEffect, useMemo, useRef, useState } from "react";
import { getResourceTypeColor, getStatusColor } from "@web/constants/colors";
import type {
  GanttItem,
  ResourceConnectionSummary,
  ResourceTestStats,
} from "@web/types";

interface GanttChartProps {
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

// ─── Layout constants ──────────────────────────────────────────────────────
const ROW_H = 44; // px per row (increased to fit two-line label)
const BAR_H = 14; // bar height within a row
const BAR_PAD = 6; // px from row top to bar top (top-aligned, leaves room below)
const NAME_Y = 14; // y offset within row for the node-name text baseline
const TIME_Y = 34; // y offset within row for the start→end timestamp baseline
const LABEL_W = 160; // left gutter for Y-axis labels
const X_PAD = 24; // right padding
const AXIS_TOP = 32; // top gutter for X-axis tick labels
const MIN_VIEWPORT_H = 240;
const VIEWPORT_SCREEN_PADDING = 320;
const MAX_VIEWPORT_RATIO = 0.78;

const TOOLTIP_LABEL_STYLE: React.CSSProperties = {
  color: "var(--text-soft)",
  fontSize: "0.82rem",
};
const TIMELINE_TIMEZONE_STORAGE_KEY = "dbt-tools.timelineTimezone";

// ─── Tick helpers ──────────────────────────────────────────────────────────
type DisplayMode = "duration" | "timestamps";

function formatMs(ms: number): string {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(0)}m`;
  if (ms >= 10_000) return `${(ms / 1000).toFixed(0)}s`;
  if (ms >= 1_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms.toFixed(0)}ms`;
}

/** Format as HH:MM:SS given an absolute epoch ms. */
function formatTimestamp(epochMs: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone,
  }).format(new Date(epochMs));
}

function getAvailableTimeZones(): string[] {
  const localTimeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const supportedValuesOf = (
    Intl as unknown as {
      supportedValuesOf?: (key: string) => string[];
    }
  ).supportedValuesOf;
  const supportedTimeZones = supportedValuesOf?.("timeZone") ?? [];
  return Array.from(new Set([localTimeZone, "UTC", ...supportedTimeZones]));
}

function getInitialTimeZone(): string {
  const localTimeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  try {
    return (
      window.localStorage.getItem(TIMELINE_TIMEZONE_STORAGE_KEY) ||
      localTimeZone
    );
  } catch {
    return localTimeZone;
  }
}

function isPositiveStatus(status: string): boolean {
  return ["success", "pass", "passed"].includes(status.trim().toLowerCase());
}

function computeTicks(maxEnd: number): Array<{ ms: number; label: string }> {
  if (maxEnd <= 0) return [];
  const STEPS = [
    50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 30000, 60000, 120000,
  ];
  const TARGET = 6;
  const step = STEPS.find((s) => maxEnd / s <= TARGET) ?? 120_000;
  const ticks: Array<{ ms: number; label: string }> = [];
  for (let ms = 0; ms <= maxEnd; ms += step) {
    ticks.push({ ms, label: formatMs(ms) });
  }
  return ticks;
}

// ─── Rounded rectangle (canvas polyfill) ──────────────────────────────────
function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

function drawRowBackground(
  ctx: CanvasRenderingContext2D,
  rowIndex: number,
  rowY: number,
  width: number,
  isFocused: boolean,
  isHovered: boolean,
) {
  if (rowIndex % 2 !== 0) return;
  ctx.fillStyle = isHovered ? "rgba(37,88,217,0.07)" : "rgba(248,250,252,0.55)";
  ctx.globalAlpha = isFocused ? 1 : 0.35;
  ctx.fillRect(0, rowY, width, ROW_H);
  ctx.globalAlpha = 1;
}

function drawRowLabels(
  ctx: CanvasRenderingContext2D,
  item: GanttItem,
  rowY: number,
  labelW: number,
  displayMode: DisplayMode,
  runStartedAt: number | null | undefined,
  timeZone: string,
  emphasis: number,
) {
  ctx.save();
  ctx.globalAlpha = emphasis;
  ctx.beginPath();
  ctx.rect(0, rowY, labelW - 10, ROW_H);
  ctx.clip();
  ctx.textAlign = "left";

  ctx.font = '12px "IBM Plex Sans", "Avenir Next", sans-serif';
  ctx.fillStyle = "#394251";
  ctx.fillText(item.name || item.unique_id, 2, rowY + NAME_Y);

  const startLabel =
    displayMode === "timestamps" && runStartedAt != null
      ? formatTimestamp(runStartedAt + item.start, timeZone)
      : `+${formatMs(item.start)}`;
  const endLabel =
    displayMode === "timestamps" && runStartedAt != null
      ? formatTimestamp(runStartedAt + item.end, timeZone)
      : `+${formatMs(item.end)}`;
  ctx.font = '10px "IBM Plex Mono", "Fira Mono", monospace';
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(`${startLabel} → ${endLabel}`, 2, rowY + TIME_Y);
  ctx.restore();
}

interface DrawRowBarParams {
  ctx: CanvasRenderingContext2D;
  item: GanttItem;
  rowY: number;
  maxEnd: number;
  chartW: number;
  labelW: number;
  emphasis: number;
  isHovered: boolean;
  attachedTestStats: ResourceTestStats | undefined;
}

function drawRowBar({
  ctx,
  item,
  rowY,
  maxEnd,
  chartW,
  labelW,
  emphasis,
  isHovered,
  attachedTestStats,
}: DrawRowBarParams) {
  const barY = rowY + BAR_PAD;
  const barX = labelW + (item.start / maxEnd) * chartW;
  const barW = Math.max(2, (item.duration / maxEnd) * chartW);

  ctx.globalAlpha = emphasis;
  ctx.fillStyle = getStatusColor(item.status);
  fillRoundRect(ctx, barX, barY, barW, BAR_H, 3);

  ctx.fillStyle = getResourceTypeColor(item.resourceType);
  ctx.fillRect(barX, barY, 3, BAR_H);

  if (
    attachedTestStats &&
    attachedTestStats.fail + attachedTestStats.error > 0 &&
    isPositiveStatus(item.status)
  ) {
    ctx.fillStyle = "rgba(216, 96, 102, 0.9)";
    fillRoundRect(ctx, barX, barY + BAR_H - 4, barW, 4, 2);
  }

  if (isHovered) {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(37, 88, 217, 0.65)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(barX - 0.5, barY - 0.5, barW + 1, BAR_H + 1);
  }
  ctx.globalAlpha = 1;
}

// ─── Main draw function ────────────────────────────────────────────────────
interface DrawGanttParams {
  scrollTop: number;
  maxEnd: number;
  displayMode: DisplayMode;
  runStartedAt: number | null | undefined;
  focusIds: Set<string> | null;
  hoveredId: string | null;
  labelW?: number;
  timeZone: string;
  testStatsById?: Map<string, ResourceTestStats>;
}

function drawGantt(
  canvas: HTMLCanvasElement,
  data: GanttItem[],
  {
    scrollTop,
    maxEnd,
    displayMode,
    runStartedAt,
    focusIds,
    hoveredId,
    labelW = LABEL_W,
    timeZone,
    testStatsById,
  }: DrawGanttParams,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = rect.width;
  const h = rect.height;
  if (w === 0 || h === 0) return;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const chartW = w - labelW - X_PAD;

  // ── X-axis ticks & grid lines ────────────────────────────────────────────
  const ticks = computeTicks(maxEnd);
  ctx.font = "11px 'IBM Plex Mono', 'Fira Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#8e97a6";

  for (const tick of ticks) {
    const x = labelW + (tick.ms / maxEnd) * chartW;
    // grid line
    ctx.strokeStyle = "rgba(35,42,52,0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, AXIS_TOP);
    ctx.lineTo(x, h);
    ctx.stroke();
    // label — show wall-clock time if mode is timestamps and we have origin
    const label =
      displayMode === "timestamps" && runStartedAt != null
        ? formatTimestamp(runStartedAt + tick.ms, timeZone)
        : tick.label;
    ctx.fillText(label, x, AXIS_TOP / 2);
  }

  // ── Visible rows ──────────────────────────────────────────────────────────
  const visStart = Math.max(0, Math.floor(scrollTop / ROW_H));
  const visEnd = Math.min(
    data.length - 1,
    Math.ceil((scrollTop + h - AXIS_TOP) / ROW_H),
  );

  ctx.textBaseline = "middle";

  for (let i = visStart; i <= visEnd; i++) {
    const item = data[i];
    const rowY = AXIS_TOP + i * ROW_H - scrollTop;
    const isFocused = focusIds == null || focusIds.has(item.unique_id);
    const isHovered = hoveredId === item.unique_id;
    const emphasis = isFocused ? 1 : 0.18;

    drawRowBackground(ctx, i, rowY, w, isFocused, isHovered);
    drawRowLabels(
      ctx,
      item,
      rowY,
      labelW,
      displayMode,
      runStartedAt,
      timeZone,
      emphasis,
    );
    drawRowBar({
      ctx,
      item,
      rowY,
      maxEnd,
      chartW,
      labelW,
      emphasis,
      isHovered,
      attachedTestStats: testStatsById?.get(item.unique_id),
    });
  }
}

// ─── Edge computation ─────────────────────────────────────────────────────
interface Edge {
  sourceRow: number;
  targetRow: number;
}

function getEdgesForVisibleRows(
  data: GanttItem[],
  visStart: number,
  visEnd: number,
  dependencyIndex: Record<string, ResourceConnectionSummary>,
  dataIndexById: Map<string, number>,
): Edge[] {
  const visibleIds = new Set<string>();
  for (let i = visStart; i <= visEnd; i++) {
    visibleIds.add(data[i].unique_id);
  }

  const edges: Edge[] = [];
  for (let i = visStart; i <= visEnd; i++) {
    const item = data[i];
    const deps = dependencyIndex[item.unique_id];
    if (!deps) continue;
    for (const upstreamId of deps.upstream.map((d) => d.uniqueId)) {
      if (!visibleIds.has(upstreamId)) continue;
      const sourceRow = dataIndexById.get(upstreamId);
      if (sourceRow === undefined) continue;
      edges.push({ sourceRow, targetRow: i });
    }
  }
  return edges;
}

// ─── Component ────────────────────────────────────────────────────────────
interface HoverState {
  item: GanttItem;
  x: number;
  y: number;
}

function hitTestBar(
  event: React.MouseEvent<HTMLDivElement>,
  data: GanttItem[],
  scrollTop: number,
  maxEnd: number,
  effectiveLabelW: number,
  canvas: HTMLCanvasElement | null,
): HoverState | null {
  if (!canvas) return null;
  const rect = event.currentTarget.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  if (mouseY < AXIS_TOP || mouseX < 0) return null;

  const rowIdx = Math.floor((mouseY - AXIS_TOP + scrollTop) / ROW_H);
  if (rowIdx < 0 || rowIdx >= data.length) return null;

  const chartW = canvas.getBoundingClientRect().width - effectiveLabelW - X_PAD;
  const item = data[rowIdx];
  const barX = effectiveLabelW + (item.start / maxEnd) * chartW;
  const barW = Math.max(2, (item.duration / maxEnd) * chartW);

  return mouseX >= barX && mouseX <= barX + barW
    ? { item, x: mouseX, y: mouseY }
    : null;
}

function edgePath(
  edge: Edge,
  data: GanttItem[],
  effectiveLabelW: number,
  maxEnd: number,
  chartW: number,
  scrollTop: number,
): string {
  const src = data[edge.sourceRow];
  const tgt = data[edge.targetRow];
  const sx = effectiveLabelW + ((src.start + src.duration) / maxEnd) * chartW;
  const sy =
    AXIS_TOP + edge.sourceRow * ROW_H + BAR_PAD + BAR_H / 2 - scrollTop;
  const tx = effectiveLabelW + (tgt.start / maxEnd) * chartW;
  const ty =
    AXIS_TOP + edge.targetRow * ROW_H + BAR_PAD + BAR_H / 2 - scrollTop;
  const cx = Math.abs(tx - sx) * 0.4;

  return `M${sx},${sy} C${sx + cx},${sy} ${tx - cx},${ty} ${tx},${ty}`;
}

function GanttModeToggle({
  activeMode,
  onChange,
  activeTimeZone,
  timeZones,
  onTimeZoneChange,
}: {
  activeMode: DisplayMode;
  onChange: (next: DisplayMode) => void;
  activeTimeZone: string;
  timeZones: string[];
  onTimeZoneChange: (next: string) => void;
}) {
  return (
    <div className="gantt-controls">
      <div className="gantt-mode-toggle">
        <button
          type="button"
          className={activeMode === "duration" ? "active" : ""}
          onClick={() => onChange("duration")}
        >
          Duration
        </button>
        <button
          type="button"
          className={activeMode === "timestamps" ? "active" : ""}
          onClick={() => onChange("timestamps")}
        >
          Timestamps
        </button>
      </div>
      {activeMode === "timestamps" && (
        <label className="gantt-timezone-select">
          <span>Timezone</span>
          <select
            value={activeTimeZone}
            onChange={(event) => onTimeZoneChange(event.target.value)}
          >
            {timeZones.map((timeZone) => (
              <option key={timeZone} value={timeZone}>
                {timeZone}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

function GanttEdges({
  edges,
  data,
  focusedIds,
  canvasWidth,
  effectiveLabelW,
  maxEnd,
  scrollTop,
  viewportH,
}: {
  edges: Edge[];
  data: GanttItem[];
  focusedIds: Set<string> | null;
  canvasWidth: number;
  effectiveLabelW: number;
  maxEnd: number;
  scrollTop: number;
  viewportH: number;
}) {
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
            stroke="#3b82f6"
            strokeWidth={edgeFocused ? 1.6 : 1.1}
            fill="none"
            opacity={edgeFocused ? 0.55 : 0.1}
          />
        );
      })}
    </svg>
  );
}

function GanttTooltip({
  hover,
  runStartedAt,
  canShowTimestamps,
  timeZone,
  testStats,
}: {
  hover: HoverState;
  runStartedAt: number | null | undefined;
  canShowTimestamps: boolean;
  timeZone: string;
  testStats?: ResourceTestStats;
}) {
  return (
    <div
      className="chart-tooltip"
      style={{
        position: "absolute",
        left: hover.x + 16,
        top: hover.y,
        pointerEvents: "none",
        zIndex: 20,
        minWidth: 180,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: "0.3rem" }}>
        {hover.item.name || hover.item.unique_id}
      </div>
      <div>
        <span style={TOOLTIP_LABEL_STYLE}>Status: </span>
        {hover.item.status}
      </div>
      {hover.item.resourceType && (
        <div>
          <span style={TOOLTIP_LABEL_STYLE}>Type: </span>
          {hover.item.resourceType}
        </div>
      )}
      {canShowTimestamps && runStartedAt != null ? (
        <>
          <div>
            <span style={TOOLTIP_LABEL_STYLE}>Start: </span>
            {formatTimestamp(runStartedAt + hover.item.start, timeZone)}
          </div>
          <div>
            <span style={TOOLTIP_LABEL_STYLE}>End: </span>
            {formatTimestamp(runStartedAt + hover.item.end, timeZone)}
          </div>
        </>
      ) : (
        <>
          <div>
            <span style={TOOLTIP_LABEL_STYLE}>Start: </span>+
            {formatMs(hover.item.start)}
          </div>
          <div>
            <span style={TOOLTIP_LABEL_STYLE}>End: </span>+
            {formatMs(hover.item.end)}
          </div>
        </>
      )}
      <div>
        <span style={TOOLTIP_LABEL_STYLE}>Duration: </span>
        {formatMs(hover.item.duration)}
      </div>
      {testStats && testStats.pass + testStats.fail + testStats.error > 0 && (
        <div>
          <span style={TOOLTIP_LABEL_STYLE}>Tests: </span>✓{testStats.pass} · ✗
          {testStats.fail + testStats.error}
        </div>
      )}
    </div>
  );
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
  const overlayRef = useRef<HTMLDivElement>(null);
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

  // Shrink the label gutter proportionally on narrow screens; cap at LABEL_W
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

  // ── Compute visible row range (shared by canvas and SVG) ──────────────────
  const visStart = Math.max(0, Math.floor(scrollTop / ROW_H));
  const visEnd = Math.min(
    data.length - 1,
    Math.ceil((scrollTop + viewportH - AXIS_TOP) / ROW_H),
  );

  // ── Compute edges for visible rows ────────────────────────────────────────
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

  // ── Redraw whenever data / scrollTop / mode / label width changes ─────────
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
        {/* Canvas — purely visual, pointer events off */}
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

        <GanttEdges
          edges={edges}
          data={data}
          focusedIds={focusedIds}
          canvasWidth={containerWidth > 0 ? containerWidth : 600}
          effectiveLabelW={effectiveLabelW}
          maxEnd={maxEnd}
          scrollTop={scrollTop}
          viewportH={viewportH}
        />

        {/* Transparent overlay: captures scroll + mouse events */}
        <div
          ref={overlayRef}
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
          {/* Spacer that creates the scrollable height */}
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
