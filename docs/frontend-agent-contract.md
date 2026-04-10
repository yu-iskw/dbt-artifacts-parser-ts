# Frontend Agent Contract

Rules and conventions for styling `@dbt-tools/web`. AI agents and human contributors must follow these to maintain the design-token architecture.

## Token usage

- **Never hard-code** colors, spacing, radii, shadows, typography sizes, or motion values in components or feature CSS.
- **Use semantic tokens** (`--text-primary`, `--bg-surface`, `--border-default`, etc.) in component and feature code.
- **Foundation tokens** (`--space-*`, `--text-sm`, `--radius-md`, `--duration-fast`) are for reusable primitives and base styles.
- **Component tokens** (in `tokens/components.json`) document specific contracts but are optional; only create them when a named alias genuinely helps.
- `--color-white` / `--color-black` exist for `color-mix()` operations only; prefer `--text-inverse` for foreground-on-dark-background.

## Token source of truth

| Layer      | Source                   | CSS output                                              |
| ---------- | ------------------------ | ------------------------------------------------------- |
| Foundation | `tokens/foundation.json` | `src/styles/tokens.css` `:root`                         |
| Semantic   | `tokens/semantic.json`   | `src/styles/tokens.css` `:root` + `[data-theme="dark"]` |
| Component  | `tokens/components.json` | Co-located `*.css` in `components/ui/`                  |

JSON files are the canonical reference; `tokens.css` is hand-maintained but must stay aligned. When ADR 0022 Phase 2 ships codegen, the CSS will be generated.

## CSS cascade layers

Layer order (declared in `src/styles/layers.css`):

```css
@layer reset, tokens, base, components, utilities, legacy;
```

- **tokens** — CSS custom property definitions only.
- **base** — element-level global rules (`*`, `body`, `button`, `input`, focus-visible).
- **components** — reusable UI primitives (`components/ui/`).
- **utilities** — utility classes (currently unused; reserved).
- **legacy** — surviving monolithic CSS from the original split. Migration target: empty.

## Reusable primitives

New UI elements should reuse primitives from `src/components/ui/`:

| Primitive           | Import                             |
| ------------------- | ---------------------------------- |
| Button / IconButton | `@web/components/ui/Button/Button` |
| Badge               | `@web/components/ui/Badge/Badge`   |
| Card                | `@web/components/ui/Card/Card`     |
| Tabs                | `@web/components/ui/Tabs/Tabs`     |
| EmptyState          | `@web/components/ui/EmptyState`    |
| Spinner             | `@web/components/ui/Spinner`       |
| Skeleton            | `@web/components/ui/Skeleton`      |
| Toast               | `@web/components/ui/Toast`         |

Do not invent a new visual pattern if an existing primitive or variant can support it.

## Naming conventions

- CSS classes for primitives: `ui-{component}` (e.g. `ui-btn`, `ui-badge`, `ui-card`).
- Modifiers: `ui-{component}--{modifier}` (e.g. `ui-btn--primary`, `ui-badge--danger`).
- Sub-elements: `ui-{component}__{element}` (e.g. `ui-card__header`).
- Legacy classes: BEM without the `ui-` prefix (e.g. `explorer-tree__row`).

## Storybook

Every reusable UI primitive must have a `*.stories.tsx` file covering:

- Default state
- All variants
- Disabled state (if interactive)
- Focus-visible state
- Dark theme (via Storybook toolbar)

Run: `pnpm --filter @dbt-tools/web storybook`

## Enforcement

Stylelint enforces:

- `declaration-no-important: true` — no `!important` in new code (warning in legacy files).
- `color-named: "never"` — no named colors like `white`, `black` (use tokens).
- Token files exempt from color rules.

## Accessibility

- Semantic HTML first; add ARIA only when HTML cannot express the pattern.
- All interactive components must be keyboard-accessible.
- Focus ring uses `var(--focus-ring)` token.
- Do not communicate status by color alone.

## Migration path

Legacy CSS lives in `@layer legacy`. To migrate a feature area:

1. Replace hard-coded values with token references.
2. Replace custom CSS with primitives where possible.
3. Move migrated rules from `@layer legacy` to `@layer components` or `@layer base`.
4. Delete dead selectors.
5. Verify with build + Storybook + tests.
