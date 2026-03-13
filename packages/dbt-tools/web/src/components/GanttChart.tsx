import { useEffect, useRef, useState } from "react";
import type { GanttItem } from "../types";

interface GanttChartProps {
  data: GanttItem[];
  /** Absolute epoch-ms of the earliest executed node — enables wall-clock timestamps. */
  runStartedAt?: number | null;
}

// ─── Layout constants ──────────────────────────────────────────────────────
const ROW_H = 28; // px per row
const BAR_H = 16; // bar height within a row
const BAR_PAD = (ROW_H - BAR_H) / 2; // vertical centring
const LABEL_W = 160; // left gutter for Y-axis labels
const X_PAD = 24; // right padding
const AXIS_TOP = 32; // top gutter for X-axis tick labels
const MAX_VIEWPORT_H = 640; // cap scroll window height
const MIN_VIEWPORT_H = 240;

// ─── Colours ───────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  success: "#2bb673",
  error: "#d86066",
  skipped: "#94a3b8",
  "run error": "#d86066",
  pass: "#2bb673",
  fail: "#d86066",
  warn: "#f2a44b",
  "no op": "#94a3b8",
};

function getStatusColor(status: string): string {
  return STATUS_COLORS[status.toLowerCase()] ?? "#64748b";
}

const TOOLTIP_LABEL_STYLE: React.CSSProperties = {
  color: "var(--text-soft)",
  fontSize: "0.82rem",
};

// ─── Tick helpers ──────────────────────────────────────────────────────────
type DisplayMode = "duration" | "timestamps";

function formatMs(ms: number): string {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(0)}m`;
  if (ms >= 10_000) return `${(ms / 1000).toFixed(0)}s`;
  if (ms >= 1_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms.toFixed(0)}ms`;
}

/** Format as HH:MM:SS given an absolute epoch ms. */
function formatTimestamp(epochMs: number): string {
  const d = new Date(epochMs);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const ss = d.getSeconds().toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
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

// ─── Main draw function ────────────────────────────────────────────────────
function drawGantt(
  canvas: HTMLCanvasElement,
  data: GanttItem[],
  scrollTop: number,
  maxEnd: number,
  displayMode: DisplayMode,
  runStartedAt: number | null | undefined,
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

  const chartW = w - LABEL_W - X_PAD;

  // ── X-axis ticks & grid lines ────────────────────────────────────────────
  const ticks = computeTicks(maxEnd);
  ctx.font = "11px 'IBM Plex Mono', 'Fira Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#8e97a6";

  for (const tick of ticks) {
    const x = LABEL_W + (tick.ms / maxEnd) * chartW;
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
        ? formatTimestamp(runStartedAt + tick.ms)
        : tick.label;
    ctx.fillText(label, x, AXIS_TOP / 2);
  }

  // ── Visible rows ──────────────────────────────────────────────────────────
  const visStart = Math.max(0, Math.floor(scrollTop / ROW_H));
  const visEnd = Math.min(
    data.length - 1,
    Math.ceil((scrollTop + h - AXIS_TOP) / ROW_H),
  );

  ctx.font = "12px 'IBM Plex Sans', 'Avenir Next', sans-serif";
  ctx.textBaseline = "middle";

  for (let i = visStart; i <= visEnd; i++) {
    const item = data[i]!;
    const rowY = AXIS_TOP + i * ROW_H - scrollTop;
    const barY = rowY + BAR_PAD;
    const midY = rowY + ROW_H / 2;

    // Alternating row background
    if (i % 2 === 0) {
      ctx.fillStyle = "rgba(248,250,252,0.55)";
      ctx.fillRect(0, rowY, w, ROW_H);
    }

    // Y-axis label (clipped to LABEL_W)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, rowY, LABEL_W - 10, ROW_H);
    ctx.clip();
    ctx.textAlign = "left";
    ctx.fillStyle = "#394251";
    ctx.fillText(item.name || item.unique_id, 2, midY);
    ctx.restore();

    // Bar
    const barX = LABEL_W + (item.start / maxEnd) * chartW;
    const barW = Math.max(2, (item.duration / maxEnd) * chartW);
    ctx.fillStyle = getStatusColor(item.status);
    fillRoundRect(ctx, barX, barY, barW, BAR_H, 3);
  }
}

// ─── Component ────────────────────────────────────────────────────────────
interface HoverState {
  item: GanttItem;
  x: number;
  y: number;
}

function GanttTooltip({
  hover,
  runStartedAt,
  canShowTimestamps,
}: {
  hover: HoverState;
  runStartedAt: number | null | undefined;
  canShowTimestamps: boolean;
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
      {canShowTimestamps && runStartedAt != null ? (
        <>
          <div>
            <span style={TOOLTIP_LABEL_STYLE}>Start: </span>
            {formatTimestamp(runStartedAt + hover.item.start)}
          </div>
          <div>
            <span style={TOOLTIP_LABEL_STYLE}>End: </span>
            {formatTimestamp(runStartedAt + hover.item.end)}
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
    </div>
  );
}

export function GanttChart({ data, runStartedAt }: GanttChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("duration");

  const canShowTimestamps = runStartedAt != null;
  const activeMode: DisplayMode = canShowTimestamps ? displayMode : "duration";

  const maxEnd = Math.max(...data.map((d) => d.end), 1);
  const totalScrollH = data.length * ROW_H + AXIS_TOP;
  const viewportH = Math.max(
    MIN_VIEWPORT_H,
    Math.min(MAX_VIEWPORT_H, totalScrollH),
  );
  const needsScroll = totalScrollH > viewportH;

  // ── Redraw whenever data / scrollTop / mode changes ──────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    function draw() {
      drawGantt(canvas!, data, scrollTop, maxEnd, activeMode, runStartedAt);
    }

    draw();

    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [data, scrollTop, maxEnd, activeMode, runStartedAt]);

  // ── Hit-testing ──────────────────────────────────────────────────────────
  function hitTest(e: React.MouseEvent<HTMLDivElement>): HoverState | null {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (mouseY < AXIS_TOP || mouseX < 0) return null;

    const rowIdx = Math.floor((mouseY - AXIS_TOP + scrollTop) / ROW_H);
    if (rowIdx < 0 || rowIdx >= data.length) return null;

    const canvas = canvasRef.current;
    if (!canvas) return null;
    const cw = canvas.getBoundingClientRect().width;
    const chartW = cw - LABEL_W - X_PAD;

    const item = data[rowIdx]!;
    const barX = LABEL_W + (item.start / maxEnd) * chartW;
    const barW = Math.max(2, (item.duration / maxEnd) * chartW);

    if (mouseX >= barX && mouseX <= barX + barW) {
      return { item, x: mouseX, y: mouseY };
    }
    return null;
  }

  if (data.length === 0) {
    return (
      <div className="empty-state empty-state--chart">
        No Gantt data (run_results may lack timing info)
      </div>
    );
  }

  return (
    <div>
      {/* Display mode toggle */}
      {canShowTimestamps && (
        <div className="gantt-controls">
          <div className="gantt-mode-toggle">
            <button
              type="button"
              className={activeMode === "duration" ? "active" : ""}
              onClick={() => setDisplayMode("duration")}
            >
              Duration
            </button>
            <button
              type="button"
              className={activeMode === "timestamps" ? "active" : ""}
              onClick={() => setDisplayMode("timestamps")}
            >
              Timestamps
            </button>
          </div>
        </div>
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

        {/* Transparent overlay: captures scroll + mouse events */}
        <div
          ref={overlayRef}
          style={{
            position: "relative",
            height: viewportH,
            overflowY: needsScroll ? "scroll" : "hidden",
          }}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          onMouseMove={(e) => setHover(hitTest(e))}
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
          />
        )}
      </section>
    </div>
  );
}
