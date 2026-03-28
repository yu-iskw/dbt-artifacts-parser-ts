import { useRef } from "react";
import type { BundleRow } from "@web/lib/analysis-workspace/bundleLayout";

const MIN_BRUSH_WINDOW_MS = 1_000;
type BrushDragMode = "pan" | "start" | "end";

export function GanttTimeBrush({
  bundles,
  maxEnd,
  timeOffset = 0,
  rangeStart,
  rangeEnd,
  onChange,
}: {
  bundles: BundleRow[];
  /** Visible span in ms (denominator for bar positions and drag math). */
  maxEnd: number;
  /** Subtract from bundle times so bars align when the slice does not start at 0. */
  timeOffset?: number;
  /** Start/end of the brush selection in ms, relative to `timeOffset` (i.e. in `[0, maxEnd]`). */
  rangeStart: number;
  rangeEnd: number;
  onChange: (nextStart: number, nextEnd: number) => void;
}) {
  const brushRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    mode: BrushDragMode;
    startPx: number;
    initialStart: number;
    initialEnd: number;
  } | null>(null);

  const minWindowMs = Math.min(
    Math.max(MIN_BRUSH_WINDOW_MS, maxEnd * 0.01),
    maxEnd,
  );

  function beginBrushDrag(e: React.PointerEvent<Element>, mode: BrushDragMode) {
    if (!brushRef.current) return;
    dragRef.current = {
      mode,
      startPx: e.clientX,
      initialStart: rangeStart,
      initialEnd: rangeEnd,
    };
    brushRef.current.setPointerCapture(e.pointerId);
  }

  function onBrushPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const brushEl = brushRef.current;
    if (!drag || !brushEl || maxEnd <= 0) return;
    const width = brushEl.clientWidth;
    if (width <= 0) return;
    const deltaMs = ((e.clientX - drag.startPx) / width) * maxEnd;
    const currentDuration = drag.initialEnd - drag.initialStart;

    if (drag.mode === "pan") {
      const nextStart = Math.min(
        Math.max(0, drag.initialStart + deltaMs),
        maxEnd - currentDuration,
      );
      onChange(nextStart, nextStart + currentDuration);
      return;
    }
    if (drag.mode === "start") {
      const nextStart = Math.min(
        Math.max(0, drag.initialStart + deltaMs),
        drag.initialEnd - minWindowMs,
      );
      onChange(nextStart, drag.initialEnd);
      return;
    }
    const nextEnd = Math.max(
      Math.min(maxEnd, drag.initialEnd + deltaMs),
      drag.initialStart + minWindowMs,
    );
    onChange(drag.initialStart, nextEnd);
  }

  function endBrushDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current && brushRef.current?.hasPointerCapture(e.pointerId)) {
      brushRef.current.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
  }

  const brushLeftPct = Math.max(0, Math.min(100, (rangeStart / maxEnd) * 100));
  const brushRightPct = Math.max(0, Math.min(100, (rangeEnd / maxEnd) * 100));
  const brushWidthPct = Math.max(0, brushRightPct - brushLeftPct);
  const canResetZoom = rangeStart > 0 || rangeEnd < maxEnd;

  return (
    <div className="gantt-brush-wrap">
      <div className="gantt-brush__header">
        <p className="gantt-brush__title">Time range</p>
        <button
          type="button"
          className="workspace-pill"
          disabled={!canResetZoom}
          onClick={() => onChange(0, maxEnd)}
        >
          Reset zoom
        </button>
      </div>
      <div
        ref={brushRef}
        className="gantt-brush"
        onPointerMove={onBrushPointerMove}
        onPointerUp={endBrushDrag}
        onPointerCancel={endBrushDrag}
        role="slider"
        aria-label="Timeline time range"
        aria-valuemin={0}
        aria-valuemax={Math.round(maxEnd)}
        aria-valuenow={Math.round(rangeStart)}
        aria-valuetext={`${Math.round(rangeStart)} to ${Math.round(rangeEnd)} ms`}
      >
        {bundles.map((bundle) => {
          const rel0 = Math.max(0, bundle.item.start - timeOffset);
          const rel1 = Math.max(rel0, bundle.item.end - timeOffset);
          const startPct = (rel0 / maxEnd) * 100;
          const widthPct = Math.max(0.2, ((rel1 - rel0) / maxEnd) * 100);
          return (
            <span
              key={bundle.item.unique_id}
              className="gantt-brush__bar"
              style={{ left: `${startPct}%`, width: `${widthPct}%` }}
            />
          );
        })}
        <div
          className="gantt-brush__selection"
          style={{ left: `${brushLeftPct}%`, width: `${brushWidthPct}%` }}
          onPointerDown={(e) => beginBrushDrag(e, "pan")}
        >
          <span
            className="gantt-brush__handle gantt-brush__handle--start"
            onPointerDown={(e) => {
              e.stopPropagation();
              beginBrushDrag(e, "start");
            }}
          />
          <span
            className="gantt-brush__handle gantt-brush__handle--end"
            onPointerDown={(e) => {
              e.stopPropagation();
              beginBrushDrag(e, "end");
            }}
          />
        </div>
      </div>
    </div>
  );
}
