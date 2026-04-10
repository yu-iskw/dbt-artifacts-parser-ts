# Web app styles (`@dbt-tools/web`)

## Architecture

Styles use **CSS cascade layers** for predictable precedence:

```css
@layer reset, tokens, base, components, utilities, legacy;
```

- **`layers.css`** — declares layer order (must load first).
- **`tokens.css`** — all CSS custom properties in `@layer tokens`.
- **`base.css`** — global element rules in `@layer base`.
- **`ui-primitives.css`** — shared micro-interaction styles (spinner, skeleton, tooltip, toast, empty state) in `@layer components`; legacy sidebar/upload rules in `@layer legacy`.
- **`app-shell.css`** — app frame, sidebar, header, and analyzer rules in `@layer legacy`.
- **`lineage-graph.css`** — dependency graph and lineage UI in `@layer legacy`.
- **`workspace.css`** — explorer tree, overview, workspace views in `@layer legacy`.

## Import order

`src/index.css` is the only stylesheet entry from `main.tsx`. It imports slices in this order:

1. **`layers.css`** — cascade layer declaration.
2. **`tokens.css`** — `:root`, `[data-theme="dark"]`, and all variable definitions.
3. **`base.css`** — global element rules.
4. **`ui-primitives.css`** — primitive + legacy sections.
5. **`app-shell.css`** — app shell legacy rules.
6. **`lineage-graph.css`** — lineage graph legacy rules.
7. **`workspace.css`** — workspace legacy rules.

Do not change `@import` order without checking for cascade regressions.

## Design tokens

Token sources live in `packages/dbt-tools/web/tokens/`:

- **`foundation.json`** — raw scales (palette, spacing, type, radii, shadows, motion, z-index, breakpoints).
- **`semantic.json`** — role-mapped tokens (surface, text, border, action, status).
- **`components.json`** — component-level contracts.

CSS custom properties in `tokens.css` must stay aligned with the JSON sources. Future codegen (ADR 0022 Phase 2) will automate this.

### Token layers in CSS

- Foundation: `--space-*`, `--text-xs`..`--text-3xl`, `--leading-*`, `--font-*`, `--radius-*`, `--shadow-*`, `--z-*`, `--duration-*`, `--ease-*`
- Semantic: `--bg-*`, `--text-*`, `--border-*`, `--icon-*`, `--accent-*`, `--success-*`, `--warning-*`, `--danger-*`, `--info-*`, `--chart-*`
- Legacy aliases: `--bg`, `--panel`, `--text`, `--accent`, `--mint`, `--rose`, `--amber` (map to semantic tokens)
- Graph: `--graph-*` (alias to semantic tokens)
- dbt types: `--dbt-type-*` (map to chart palette)

## Reusable primitives

Component CSS in `src/components/ui/*/` uses `@layer components` so it slots correctly regardless of import order relative to legacy rules.

## CSS ↔ TypeScript colors

Canvas and chart code cannot read CSS variables in all paths. `src/constants/themeColors.ts` mirrors chart-related custom properties (light and dark). When you change chart or graph palette tokens, update both places until a codegen pipeline exists.

## Status colors in TypeScript

`src/constants/colors.ts` defines `STATUS_COLORS` and helpers. Chart code uses `getStatusTonePalette` from `src/lib/analysis-workspace/constants.ts`.

## Enforcement

Stylelint enforces `declaration-no-important` and `color-named: "never"`. Legacy files have warning-level overrides during migration. See `stylelint.config.mjs` and `docs/frontend-agent-contract.md`.
