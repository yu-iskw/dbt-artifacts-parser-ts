# Web app styles (`@dbt-tools/web`)

## Import order

`src/index.css` is the only stylesheet entry from `main.tsx`. It imports slices in this order:

1. **`app.css`** — generated `tokens.css`, `theme.css`, Tailwind (`@tailwindcss/vite`), `tailwind.theme.css` (semantic → utility bridge), and `design-system/design-system.css`.
2. **`base.css`** — global element rules (`*`, `html`, `body`, etc.).
3. **`app-shell.css`** — layout shell (sidebar, frame, header) and many analyzer/landing rules that sat **before** the lineage section in the original monolith. Shell and workspace selectors are interleaved there on purpose: **cascade order matches the old `index.css`**.
4. **`ui-primitives.css`** — spinner, skeleton, tooltip, toast, empty state, plus blocks that followed them in the monolith (sidebar link icons, signals, upload/overview landing). Kept in one file to avoid reordering rules.
5. **`lineage-graph.css`** — dependency graph, lineage viewport, graph toolbars/menus.
6. **`workspace.css`** — explorer tree, overview modules/bands, type donut, shared legend rows.

**Token pipeline:** edit JSON under `tokens/`, then `pnpm run build:tokens` in this package (runs automatically before `pnpm build`). Generated: `src/styles/tokens.css`, `src/styles/theme.css`, `src/styles/tailwind.theme.css`, `src/lib/tokens.generated.ts`, `src/constants/themeColors.generated.ts`.

Do not change `@import` order without checking for specificity/cascade regressions.

## CSS ↔ TypeScript colors

Canvas and chart code cannot read CSS variables directly in all paths. **`src/constants/themeColors.generated.ts`** is produced by `scripts/build-tokens.mjs` from the same token JSON as `tokens.css`. Edit `tokens/semantics/color.json` and `tokens/themes/dark.json`, then rebuild tokens.

## Status colors in TypeScript

**`src/constants/colors.ts`** defines `STATUS_COLORS` and helpers (`getStatusColor`, `getResourceTypeColor`) for execution/run status and resource-type accents. Chart code uses **`getStatusTonePalette`** from `src/lib/analysis-workspace/constants.ts` for **StatusTone**-aligned palettes (Gantt legend, donuts, etc.).
