/**
 * TimeRangeBrush — compact minimap + drag-to-zoom strip above the main Gantt.
 *
 * Renders a thin canvas overview of all timeline bundles. The user can:
 *   • Drag to draw a selection rectangle → zooms the main chart to that window.
 *   • Drag the left or right resize handle to adjust an existing selection.
 *   • Click inside the selection (without moving) → clears the selection.
 *   • Press Escape → clears the selection.
 *
 * The component is intentionally self-contained: all pointer tracking is done
 * on the window so drags that escape the canvas border are handled correctly.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import type { BundleRow } from "@web/lib/analysis-workspace/bundleLayout";
import type { ThemeMode } from "@web/constants/themeColors";
import {
  getCanvasColors,
  getResourceTypeSoftFill,
} from "@web/constants/themeColors";
import type { TimeWindow } from "@web/lib/analysis-workspace/types";
import { X_PAD } from "./constants";

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

/** Total height of the brush strip in CSS pixels. */
const BRUSH_H = 48;
/** Vertical margin above/below the minimap bars inside the strip. */
const BAR_MARGIN = 10;
/** Height of each minimap bar. */
const BAR_H = BRUSH_H - BAR_MARGIN * 2;
/** Width of the drag handles on each edge of the selection. */
const HANDLE_W = 6;
/** Minimum visible selection span as a fraction of maxEnd. */
const MIN_SPAN_RATIO = 0.002;
/** Drag state kind for resizing the left edge of the selection. */
const DRAG_KIND_RESIZE_LEFT = "resize-left" as const;
/** Drag state kind for resizing the right edge of the selection. */
const DRAG_KIND_RESIZE_RIGHT = "resize-right" as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Convert a pixel X offset (relative to the canvas) to a time value in ms. */
function xToTime(
  x: number,
  labelW: number,
  chartW: number,
  maxEnd: number,
): number {
  const frac = (x - labelW) / chartW;
  return clamp(frac * maxEnd, 0, maxEnd);
}

/** Convert a time value in ms to a pixel X offset within the canvas. */
function timeToX(
  time: number,
  labelW: number,
  chartW: number,
  maxEnd: number,
): number {
  return labelW + (time / maxEnd) * chartW;
}

// ---------------------------------------------------------------------------
// Canvas draw
// ---------------------------------------------------------------------------

function drawBrush(
  canvas: HTMLCanvasElement,
  bundles: BundleRow[],
  maxEnd: number,
  labelW: number,
  timeWindow: TimeWindow | null,
  theme: ThemeMode,
  dragState: DragState | null,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  if (w === 0 || h === 0) return;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const palette = getCanvasColors(theme);
  const chartW = w - labelW - X_PAD;

  // Background
  ctx.fillStyle = palette.rowStripe;
  ctx.globalAlpha = 0.4;
  ctx.fillRect(labelW, 0, chartW + X_PAD, h);
  ctx.globalAlpha = 1;

  // Label zone text
  ctx.font = '10px "IBM Plex Sans", "Avenir Next", sans-serif';
  ctx.fillStyle = palette.axisTick;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Zoom", labelW / 2, h / 2);

  // Minimap bars (all bundles, very compact)
  for (const bundle of bundles) {
    const item = bundle.item;
    if (item.end <= 0 || maxEnd <= 0) continue;
    const bx = timeToX(item.start, labelW, chartW, maxEnd);
    const bw = Math.max(1, (item.duration / maxEnd) * chartW);
    ctx.fillStyle = getResourceTypeSoftFill(item.resourceType, theme);
    ctx.globalAlpha = 0.7;
    ctx.fillRect(bx, BAR_MARGIN, bw, BAR_H);
    ctx.globalAlpha = 1;
  }

  // Determine the active selection (committed window or live drag)
  let selStart: number | null = null;
  let selEnd: number | null = null;

  if (dragState && dragState.kind !== "idle") {
    if (
      dragState.kind === "new" ||
      dragState.kind === "resize-left" ||
      dragState.kind === "resize-right"
    ) {
      selStart = dragState.selStart;
      selEnd = dragState.selEnd;
    }
  } else if (timeWindow) {
    selStart = timeWindow.start;
    selEnd = timeWindow.end;
  }

  if (selStart != null && selEnd != null && selEnd > selStart) {
    const sx = timeToX(selStart, labelW, chartW, maxEnd);
    const ex = timeToX(selEnd, labelW, chartW, maxEnd);
    const sw = ex - sx;

    // Dim the unselected regions
    ctx.fillStyle =
      theme === "dark" ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)";
    ctx.fillRect(labelW, 0, sx - labelW, h);
    ctx.fillRect(ex, 0, w - ex, h);

    // Selection outline
    ctx.strokeStyle = palette.barHoverStroke;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx, 1, sw, h - 2);

    // Resize handles
    const handleColor =
      theme === "dark" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.5)";
    ctx.fillStyle = handleColor;
    ctx.fillRect(sx, (h - 16) / 2, HANDLE_W, 16);
    ctx.fillRect(ex - HANDLE_W, (h - 16) / 2, HANDLE_W, 16);
  }
}

// ---------------------------------------------------------------------------
// Drag state machine
// ---------------------------------------------------------------------------

type DragState =
  | { kind: "idle" }
  | {
      kind: "new";
      originX: number; // canvas px where drag started
      selStart: number; // ms
      selEnd: number; // ms
    }
  | {
      kind: "resize-left";
      selStart: number;
      selEnd: number;
    }
  | {
      kind: "resize-right";
      selStart: number;
      selEnd: number;
    };

function hitHandle(
  mouseX: number,
  timeWindow: TimeWindow | null,
  labelW: number,
  chartW: number,
  maxEnd: number,
): "left" | "right" | "inside" | "outside" {
  if (!timeWindow) return "outside";
  const sx = timeToX(timeWindow.start, labelW, chartW, maxEnd);
  const ex = timeToX(timeWindow.end, labelW, chartW, maxEnd);

  if (mouseX >= sx && mouseX <= sx + HANDLE_W) return "left";
  if (mouseX >= ex - HANDLE_W && mouseX <= ex) return "right";
  if (mouseX > sx && mouseX < ex) return "inside";
  return "outside";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface TimeRangeBrushProps {
  bundles: BundleRow[];
  maxEnd: number;
  labelW: number;
  timeWindow: TimeWindow | null;
  onChange: (tw: TimeWindow | null) => void;
  theme?: ThemeMode;
}

export function TimeRangeBrush({
  bundles,
  maxEnd,
  labelW,
  timeWindow,
  onChange,
  theme = "light",
}: TimeRangeBrushProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState>({ kind: "idle" });

  // Redraw whenever relevant props change.
  const redraw = useCallback(
    (drag: DragState) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const chartW =
        canvas.getBoundingClientRect().width - labelW - X_PAD;
      if (chartW <= 0) return;
      drawBrush(canvas, bundles, maxEnd, labelW, timeWindow, theme, drag);
    },
    [bundles, labelW, maxEnd, theme, timeWindow],
  );

  useEffect(() => {
    redraw(dragRef.current);
  }, [redraw]);

  // ResizeObserver to handle container width changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => redraw(dragRef.current));
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [redraw]);

  // -------------------------------------------------------------------------
  // Pointer interaction
  // -------------------------------------------------------------------------

  const getChartW = () => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    return canvas.getBoundingClientRect().width - labelW - X_PAD;
  };

  const getCanvasX = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    return clientX - canvas.getBoundingClientRect().left;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const chartW = getChartW();
    if (chartW <= 0) return;
    const x = getCanvasX(e.clientX);
    const zone = hitHandle(x, timeWindow, labelW, chartW, maxEnd);

    if (zone === "inside") {
      // Click-to-clear starts here; confirmed on mouseup without movement.
      dragRef.current = {
        kind: "new",
        originX: x,
        selStart: timeWindow!.start,
        selEnd: timeWindow!.end,
      };
    } else if (zone === "left") {
      dragRef.current = {
        kind: "resize-left",
        selStart: timeWindow!.start,
        selEnd: timeWindow!.end,
      };
    } else if (zone === "right") {
      dragRef.current = {
        kind: "resize-right",
        selStart: timeWindow!.start,
        selEnd: timeWindow!.end,
      };
    } else {
      // New drag outside any selection.
      const t = xToTime(x, labelW, chartW, maxEnd);
      dragRef.current = {
        kind: "new",
        originX: x,
        selStart: t,
        selEnd: t,
      };
    }
    redraw(dragRef.current);
  };

  // Window-level mousemove so drags outside the canvas work.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (drag.kind === "idle") return;
      const chartW = getChartW();
      if (chartW <= 0) return;
      const x = getCanvasX(e.clientX);
      const minSpan = maxEnd * MIN_SPAN_RATIO;

      if (drag.kind === "new") {
        const origin = drag.originX;
        const t = xToTime(x, labelW, chartW, maxEnd);
        const originT = xToTime(origin, labelW, chartW, maxEnd);
        dragRef.current = {
          ...drag,
          selStart: Math.min(t, originT),
          selEnd: Math.max(t, originT),
        };
      } else if (drag.kind === "resize-left") {
        const t = xToTime(x, labelW, chartW, maxEnd);
        dragRef.current = {
          ...drag,
          selStart: clamp(t, 0, drag.selEnd - minSpan),
        };
      } else if (drag.kind === "resize-right") {
        const t = xToTime(x, labelW, chartW, maxEnd);
        dragRef.current = {
          ...drag,
          selEnd: clamp(t, drag.selStart + minSpan, maxEnd),
        };
      }
      redraw(dragRef.current);
    };

    const onUp = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (drag.kind === "idle") return;
      const chartW = getChartW();
      if (chartW <= 0) return;
      const x = getCanvasX(e.clientX);
      const minSpan = maxEnd * MIN_SPAN_RATIO;

      if (drag.kind === "new") {
        const span = drag.selEnd - drag.selStart;
        const moved = Math.abs(x - drag.originX) > 3;
        if (!moved && timeWindow) {
          // Stationary click inside existing selection → clear.
          const zone = hitHandle(x, timeWindow, labelW, chartW, maxEnd);
          if (zone === "inside") {
            onChange(null);
          }
        } else if (moved && span >= minSpan) {
          onChange({ start: drag.selStart, end: drag.selEnd });
        }
      } else if (drag.kind === "resize-left" || drag.kind === "resize-right") {
        const span = drag.selEnd - drag.selStart;
        if (span >= minSpan) {
          onChange({ start: drag.selStart, end: drag.selEnd });
        }
      }

      dragRef.current = { kind: "idle" };
      redraw({ kind: "idle" });
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable refs / maxEnd/labelW don't change during a drag
  }, [labelW, maxEnd, onChange, redraw, timeWindow]);

  // Keyboard: Escape clears the selection.
  const handleKeyDown = (e: KeyboardEvent<HTMLCanvasElement>) => {
    if (e.key === "Escape" && timeWindow) {
      onChange(null);
    }
  };

  // Dynamic cursor based on hover zone.
  const getCursor = useCallback(
    (clientX: number): CSSProperties["cursor"] => {
      const chartW = getChartW();
      if (chartW <= 0) return "crosshair";
      const x = getCanvasX(clientX);
      const zone = hitHandle(x, timeWindow, labelW, chartW, maxEnd);
      if (zone === "left" || zone === "right") return "ew-resize";
      if (zone === "inside") return "pointer";
      return "crosshair";
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- labelW/maxEnd/timeWindow are stable per render
    [labelW, maxEnd, timeWindow],
  );

  const [cursor, setCursor] = useState<CSSProperties["cursor"]>("crosshair");

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragRef.current.kind !== "idle") return;
    setCursor(getCursor(e.clientX));
  };

  const handleMouseLeave = () => {
    if (dragRef.current.kind === "idle") setCursor("crosshair");
  };

  return (
    <div className="time-range-brush" aria-label="Timeline zoom brush">
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          height: BRUSH_H,
          cursor,
        }}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- brush is keyboard-accessible for Escape to clear
        tabIndex={0}
        aria-label="Drag to select a time range to zoom into"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
