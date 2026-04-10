# UI rules for coding agents (@dbt-tools/web)

## Token contract

1. **Source of truth:** DTCG-style JSON under `packages/dbt-tools/web/tokens/` (`primitives/`, `semantics/`, `components/`, `themes/`).
2. **After editing token JSON:** run `pnpm run build:tokens` from `packages/dbt-tools/web` (or `pnpm tokens:web:build` from repo root), then commit generated files.
3. **Product / feature code** must use:
   - semantic CSS variables (`var(--text-primary)`, `var(--bg-surface)`, …), **or**
   - Tailwind utilities mapped in `src/styles/tailwind.theme.css` (`bg-background`, `text-foreground`, …), **or**
   - shared components from `src/design-system/`.
4. **Do not** reference primitive palette variables (names like `primitive.*` in JSON) in feature CSS/TS — primitives exist to compose semantics only.
5. **Design-system components** may use **component** tokens (`--button-*`, `--input-*`) defined in `tokens/components/*.json`.

## Forbidden in new feature code

- Hardcoded hex/rgb/hsl colors, raw `px` spacing scales, arbitrary radii, z-index literals, or shadow strings — unless they come from tokens or existing legacy slices you are explicitly migrating.
- New `eslint-disable` / `@ts-expect-error` to bypass style or token rules.

## Files agents should read before UI work

- `packages/dbt-tools/web/src/styles/README.md` — CSS import / cascade order.
- `packages/dbt-tools/web/tokens/` — current token model.
- This file — agent contract.

## Verification

From repo root: `pnpm tokens:web:validate`. Before merge: `pnpm lint`, `pnpm test`, and package build as in CI.
