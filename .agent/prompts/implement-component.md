# Prompt: implement a UI component (dbt-tools web)

You are adding or changing UI in `@dbt-tools/web`. Follow this checklist.

## 1. Placement

- **Shared / reusable** (buttons, inputs, cards, dialogs, empty states): implement under `packages/dbt-tools/web/src/design-system/` and export from `src/design-system/index.ts`.
- **Feature-specific** (analyzer views, timeline, graph): keep under `src/components/…` but **still** use semantic tokens or Tailwind theme utilities — no raw palette.

## 2. Styling

1. Prefer **component tokens** for visuals inside design-system components (`tokens/components/*.json`), then run `pnpm run build:tokens` in the web package.
2. Use **semantic** CSS variables in CSS files: `var(--border-subtle)`, not `#e6e9f0`.
3. If using Tailwind, use theme-mapped names from `tailwind.theme.css` (e.g. `bg-card`, `text-foreground`, `border-border`) — avoid arbitrary values like `bg-[#fff]`.

## 3. Variants

- Expose a **small** set of variants (`primary` | `secondary` | `ghost`, etc.).
- Do **not** add generic `style={{}}`, `className` escape hatches for colors, or `color` props that accept arbitrary hex.

## 4. Theming

- Assume `data-theme="light"` / `data-theme="dark"` on `document.documentElement`. All new variables must be defined for both modes in token JSON (`tokens/themes/dark.json` overrides).

## 5. Done when

- `pnpm tokens:web:validate` passes.
- Generated outputs updated if tokens changed (`tokens.css`, `theme.css`, `tailwind.theme.css`, `tokens.generated.ts`, `themeColors.generated.ts`).
- No new raw color literals in `src/design-system/**/*.tsx` (enforced by `scan-forbidden-style-values.mjs`).
