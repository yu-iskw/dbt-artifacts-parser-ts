# 26. Default-hidden tests and time-range brush for scalable timeline performance

Date: 2026-03-27

## Status

Accepted

## Context

The execution timeline view renders dbt models, seeds, snapshots, and — optionally — their attached test chips, all on a shared canvas with TanStack Virtual for vertical scrolling.

Two compounding scalability problems emerged as adoption of the tool grew to real-world projects:

### 1. Test-chip overhead on large projects

The lane-assignment algorithm (`assignLanes()`) runs for every bundle row at render time. With tens of thousands of tests — common in mature analytics projects that use schema tests on every column — the initial layout and canvas-draw pass is measurably slow, even with virtualisation. The marginal value of showing tests by default is low: most users open the timeline to inspect model parallelism and bottlenecks, not individual test timing.

### 2. Compressed horizontal space in long runs

When a dbt run spans hours (e.g. a full overnight refresh of a large warehouse), the entire timeline must fit within the canvas width (≈ 800–1400 px). Every bar becomes sub-pixel wide, which makes it impossible to distinguish models that ran in the same minute, let alone to correlate timing across related nodes.

There was no mechanism to zoom into a specific time window.

## Decision

### Part A — Default `showTests: false`

Change the initial value of `showTests` in `TimelineFilterState` from `true` to `false`. The "Tests" toggle in the legend remains available; users who want to inspect test timing can opt in with one click.

The change touches four locations:

| File | Change |
|------|--------|
| `src/App.tsx` | `showTests: false` in initial state |
| `src/lib/analysis-workspace/types.ts` | JSDoc updated to "Default false for performance" |
| `gantt/GanttChart.tsx` | Default prop `showTests = false` |
| `gantt/canvasDraw.ts` | Default destructure `showTests = false` |

### Part B — Time-range brush for horizontal zoom

Introduce a `timeWindow: TimeWindow | null` field to `TimelineFilterState`:

```typescript
export interface TimeWindow {
  start: number; // ms relative to time-origin 0 (same as GanttItem.start)
  end: number;
}
```

When `timeWindow` is set, the main chart:

1. **Filters bundles** to those whose items overlap `[start, end]`.
2. **Rescales the X-axis** using `minTime = timeWindow.start` and `maxEnd = timeWindow.end - timeWindow.start`.

The rescaling formula in `canvasDraw.ts`, `hitTest.ts`, `edgeGeometry.ts`, and `GanttEdgeLayer.tsx` changes from:

```
x = labelW + (item.start / maxEnd) * chartW
```

to:

```
x = labelW + ((item.start - minTime) / maxEnd) * chartW
```

where `maxEnd` is now the *visible span* rather than the absolute run duration. A `minTime = 0` default preserves existing behaviour for all callers that don't pass the parameter.

#### New component: `TimeRangeBrush`

A 48 px canvas strip rendered above the main `GanttChartFrame`. It shows a compressed minimap of all bundle items (coloured by resource type) and implements a drag-to-select interaction:

- **New drag** (outside existing selection): draws a selection rectangle; on `mouseup`, commits `onChange({ start, end })` if the span exceeds `MIN_SPAN_RATIO * maxEnd`.
- **Resize handles**: 6 px wide handles on each edge allow adjusting an existing selection via `ew-resize` cursor.
- **Click inside** (no movement): clears the selection via `onChange(null)`.
- **Escape key**: clears the selection.

Window-level `mousemove` / `mouseup` listeners ensure drags that leave the canvas area complete correctly.

The brush receives `allBundles` (computed from `allData`, the unfiltered parent items) so the minimap always shows the full picture even when type/status filters are active in the main chart.

#### Clear-zoom badge

When `timeWindow != null`, a `<p class="timeline-zoom-active">` element appears above the chart showing the zoomed span and a "Clear zoom ×" button.

## Consequences

**Positive:**

- Initial timeline render on large projects is significantly faster — no lane-assignment or chip-draw for hidden tests.
- Users can zoom into any sub-second window of a multi-hour run without losing context (minimap always shows the full execution).
- The `minTime` offset is additive and defaults to `0`, so no existing tests or callers break.

**Negative:**

- Users who relied on tests being visible by default must now click the legend toggle once. This is a deliberate UX trade-off: the legend button is prominently placed and self-describing.
- The `minTime` parameter was added to several internal interfaces (`DrawGanttParams`, `DrawRowBarParams`, `DrawTestChipParams`, `DrawGanttAxisTicksParams`, `DrawGanttVisibleRowParams`, `FocusEdgePathParams`, `GanttPointerContext`, `UseGanttCanvasDrawParams`, `GanttChartFrame` props, `GanttEdgeLayer` props). While the default keeps existing callers working, it increases the surface area of these internal APIs.
- The `TimeRangeBrush` component introduces a second `ResizeObserver` and canvas per timeline view. For typical viewport sizes this is negligible.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| Keep `showTests: true`, only optimise the algorithm | The lane-assignment is already greedy O(n·k); reducing per-test draw calls requires significant refactoring with uncertain payoff. A default toggle is simpler and reversible. |
| Mouse-wheel horizontal zoom (no brush) | Requires scroll-event capture on the chart, conflicting with vertical scroll. The brush's explicit drag UX is more predictable. |
| Preset time-range buttons (first 10%, last 25%, …) | Inflexible; doesn't let users zoom to a specific failure cluster. |
| Progressive/virtual time buckets | Overkill for a client-side only tool; adds build-time complexity without clear benefit given existing virtualisation. |
