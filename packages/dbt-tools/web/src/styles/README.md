# Web app styles (`@dbt-tools/web`)

## Import order

`src/index.css` is the single stylesheet entry from `main.tsx`.

1. **`styles/app.css`** — app-level contract; imports generated token files (`tokens.css`, `theme.css`) and publishes compatibility aliases used by existing styles.
2. **`styles/base.css`** — global element rules (`*`, `html`, `body`, etc.) and tokenized typography defaults.
3. **`styles/design-system.css`** — shared component and pattern classes (`.ds-*`) that must map visual decisions to design tokens.
4. **`styles/app-shell.css`**
5. **`styles/ui-primitives.css`**
6. **`styles/lineage-graph.css`**
7. **`styles/workspace.css`**

## Token source of truth

Design tokens live in `packages/dbt-tools/web/tokens/` with layered folders:

- `primitives/`
- `semantics/`
- `components/`
- `themes/`

Generated outputs are produced by `pnpm tokens:build`:

- `src/styles/tokens.css`
- `src/styles/theme.css`
- `src/lib/tokens.ts`
- `src/lib/tailwind-theme-bridge.ts`

## Guardrails

- `pnpm tokens:validate` checks token schema and blocks hardcoded design literals in guarded UI paths.
- Agent-facing implementation rules live at `.agent/ui-rules.md`.
