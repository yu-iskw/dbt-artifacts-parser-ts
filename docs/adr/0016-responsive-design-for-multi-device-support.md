# 16. Responsive design for multi-device support

Date: 2026-03-14

Status: Accepted

Depends-on [11. Web workspace MVP for visual dbt analysis](0011-web-workspace-mvp-for-visual-dbt-analysis.md)

## Context

The dbt-tools web workspace was built desktop-first. The two existing CSS breakpoints
(1180 px and 780 px) handle laptops and tablets by stacking the sidebar above the main
content and collapsing multi-column grids. However, at phone-sized viewports (< 640 px)
several problems remain:

- The explorer pane grid column (`minmax(420 px, 500 px)`) exceeds the viewport width
  and triggers horizontal scroll.
- The sidebar stacks as a full-width block with no way to show/hide it without taking
  up primary screen real estate.
- The Gantt chart's 160 px label gutter crowds the bar area on narrow canvases, making
  the timeline unreadable.
- Interactive controls (nav buttons, filter chips, action buttons) are rendered at
  desktop sizes without the 44 px minimum touch-target height required for reliable
  touch interaction.

The app is used in the field by dbt practitioners who may only have a phone or small
tablet available during an incident response.

## Decision

Implement a **CSS-first, three-tier mobile breakpoint system** with minimal JS state
additions and no new runtime dependencies.

### Breakpoint tiers

| Breakpoint  | Range         | Primary changes                                  |
| ----------- | ------------- | ------------------------------------------------ |
| Desktop     | > 1180 px     | (existing) Full sidebar + grid layouts           |
| Tablet      | 780 – 1180 px | (existing) Stacked sidebar, single-column grids  |
| Mobile      | ≤ 639 px      | Overlay sidebar, stacked explorer, touch targets |
| Small phone | ≤ 479 px      | Tighter padding, fluid metric typography         |
| Tiny phone  | ≤ 359 px      | Overflow protection, text wrapping               |

### Mobile sidebar: fixed overlay

At ≤ 639 px the persistent sidebar is replaced by a hamburger-triggered slide-in
overlay:

```text
┌──────────────────┐        ┌──────────────────┐
│ ☰  dbt workspace │  tap   │ ◀ ╔══════════╗   │
│                  │ ──────▶│   ║ Sidebar  ║   │
│ [main content]   │        │   ╚══════════╝   │
└──────────────────┘        └──────────────────┘
```

- The `<aside>` element moves to `position: fixed; transform: translateX(-100%)` at
  mobile, overriding its desktop `position: sticky`.
- A hamburger button (`☰`, `min-height: 44px`) is added to the app header and hidden
  via `display: none` at larger breakpoints.
- `sidebarOpen` boolean state in `App.tsx` toggles the `app-frame--nav-open` class,
  which slides the sidebar in via `transform: translateX(0)`.
- A `sidebar-backdrop` div (semi-transparent, `z-index: 199`) captures click events
  outside the sidebar; pressing Escape also closes it.
- Sidebar navigation items call `onNavigate()` to auto-close the overlay on selection.

The desktop collapse toggle (`‹ ›`) is hidden at mobile via CSS since the overlay
pattern supersedes it at that width.

### Responsive Gantt label width

The Gantt chart canvas uses a `ResizeObserver` that already fires on every size change.
A `containerWidth` state is populated from `entry.contentRect.width`; `effectiveLabelW`
is computed as `max(80, min(160, containerWidth × 0.35))`. This value is passed to
`drawGantt` as the `labelW` parameter (replacing the hardcoded `LABEL_W` constant),
ensuring the Y-axis label gutter shrinks proportionally on narrow screens while
capping at 160 px on desktop.

### Touch targets

At ≤ 639 px, sidebar links, filter chips, and action buttons receive `min-height: 44px`
and `touch-action: manipulation` to meet WCAG 2.5.5 (Target Size) guidance and
eliminate the 300 ms tap delay on mobile browsers.

### Explorer stacking

At ≤ 639 px, the `.workspace-layout` grid switches to `grid-template-columns: 1fr`,
stacking the explorer pane above the main panel with no JS change required.

## Consequences

### Positive

- The web workspace is usable on phones (≥ 360 px wide) without horizontal scroll.
- Hamburger overlay preserves full nav visibility without sacrificing screen space.
- Gantt timeline remains readable on narrow canvases.
- No new runtime dependencies introduced.
- The CSS-only approach for breakpoints and stacking is low-risk and straightforward
  to revert if needed.

### Negative

- Three additional media query blocks increase stylesheet size by ~2 KB unminified.
- `sidebarOpen` adds a second sidebar-related boolean to `App.tsx` (alongside
  `sidebarCollapsed`), which must be kept in sync (e.g. resetting when viewport
  widens).
- The `drawGantt` function signature grew by one parameter; callers must be kept
  consistent.

### Mitigations

- The overlay sidebar reuses the existing `transform` transition pattern already used
  by the collapse animation, keeping visual consistency.
- `sidebarOpen` defaults to `false` and is reset automatically when the viewport grows
  (the sidebar becomes `position: sticky` again via CSS, so the open state has no
  visible effect above 640 px).
- `LABEL_W` is retained as a module-level constant serving as the default cap,
  preserving the existing mental model while the parameter provides flexibility.

## Amendment (2026-03-28)

The five-tier structural breakpoint system described above was implemented as specified.
In addition, component-level media queries may exist outside these tiers to adapt
specific toolbar or control layouts at intermediate widths.

**First instance**: `@media (max-width: 860px)` in `app-shell.css` scoped exclusively
to `.timeline-dependency-controls`: hides the divider element and makes the direction
zone full-width so the toolbar wraps cleanly on smaller tablets. This does not affect
the overall page layout or sidebar behavior and is **not** a new structural tier.
