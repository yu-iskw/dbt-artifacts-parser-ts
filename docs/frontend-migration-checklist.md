# Frontend Migration Checklist

Status tracker for migrating `@dbt-tools/web` from legacy CSS to the governed token/primitive architecture.

## Infrastructure

| Item                            | Status | Notes                                                                         |
| ------------------------------- | ------ | ----------------------------------------------------------------------------- |
| Design token JSON source files  | Done   | `tokens/foundation.json`, `semantic.json`, `components.json`                  |
| CSS custom properties expansion | Done   | Spacing, typography, z-index, motion, radii, focus-ring added to `tokens.css` |
| CSS cascade layers              | Done   | `layers.css` declares order; all CSS files wrapped in appropriate layers      |
| Storybook setup                 | Done   | `@storybook/react-vite` v10; `.storybook/` config at web package level        |
| Stylelint enforcement           | Done   | `declaration-no-important`, `color-named: never` with legacy file overrides   |

## Reusable primitives

| Primitive  | Status  | Stories | Tests    | Notes                                                                  |
| ---------- | ------- | ------- | -------- | ---------------------------------------------------------------------- |
| Button     | Done    | Yes     | Yes      | Primary, secondary, danger, ghost variants; sm/md/lg sizes             |
| IconButton | Done    | Yes     | Yes      | Part of Button module                                                  |
| Badge      | Done    | Yes     | Yes      | 6 tones: neutral, accent, success, warning, danger, info; optional dot |
| Card       | Done    | Yes     | Yes      | Header/Body/Footer compound; flat/default/elevated; compact variant    |
| Tabs       | Done    | Yes     | Yes      | Underline + pill/segmented variants; full keyboard nav                 |
| EmptyState | Done    | Yes     | Existing | Moved to `components/ui/`; added action slot                           |
| Spinner    | Done    | Yes     | Existing | Updated to use semantic tokens                                         |
| Skeleton   | Done    | Yes     | Existing | Already tokenized                                                      |
| Toast      | Done    | Yes     | Existing | Already tokenized                                                      |
| Input      | Pending | -       | -        | Extract from `.workspace-search` pattern                               |
| Table      | Pending | -       | -        | Extract from `.results-table` pattern                                  |
| Modal      | Pending | -       | -        | Extract from fullscreen dialog in lineage-graph.css                    |

## Feature area migration

| Area                       | Status             | Hard-coded values                         | Primitives used            | Notes                                                                  |
| -------------------------- | ------------------ | ----------------------------------------- | -------------------------- | ---------------------------------------------------------------------- |
| Token definitions          | Done               | n/a                                       | n/a                        | Foundation tokens complete                                             |
| Base styles                | Done               | None                                      | n/a                        | `focus-visible` baseline added                                         |
| UI primitives CSS          | Done               | None remaining                            | n/a                        | Tooltip, empty state, toast now use tokens                             |
| Sidebar links              | Migrated to tokens | None                                      | -                          | In `@layer legacy`; uses `var(--text-secondary)`, `var(--icon-accent)` |
| App shell (sidebar, frame) | Partial            | `color-mix` uses `var(--color-white)`     | -                          | `@layer legacy`; glass effects use utility token                       |
| Buttons/actions            | Partial            | `color: var(--text-inverse)`              | Button primitive available | `.primary-action` still in legacy; replace with `<Button>`             |
| Exec-type-bar              | Partial            | `color: var(--text-inverse)`              | -                          | Duplicated in app-shell.css + workspace.css; consolidation needed      |
| Badges                     | Ready              | Token-based                               | Badge primitive available  | `.tone-badge` still in legacy; replace with `<Badge>`                  |
| Tabs/segmented controls    | Ready              | -                                         | Tabs primitive available   | 4+ variants in legacy; consolidate to `<Tabs>`                         |
| Explorer tree              | Partial            | -                                         | -                          | `!important` removed via compound selector                             |
| Overview panels            | Ready              | -                                         | Card primitive available   | Replace with `<Card>`                                                  |
| Lineage graph              | Partial            | SVG stat fills now use tokens             | -                          | Remaining: `rgb()` shadows; low priority                               |
| Workspace views            | Partial            | `var(--surface-elevated, #fff)` fallbacks | -                          | Fallbacks are safe; remove once tokens guaranteed                      |

## Legacy CSS files

| File                                 | Lines | Layer           | Migration status                                                  |
| ------------------------------------ | ----- | --------------- | ----------------------------------------------------------------- |
| `app-shell.css`                      | ~2400 | `@layer legacy` | Named colors replaced; glass effects tokenized; bulk rules remain |
| `workspace.css`                      | ~2600 | `@layer legacy` | `!important` removed; named colors replaced; bulk rules remain    |
| `lineage-graph.css`                  | ~1300 | `@layer legacy` | SVG hex replaced with tokens; `color-mix` tokenized               |
| `ui-primitives.css` (legacy section) | ~200  | `@layer legacy` | Sidebar/upload/overview rules tokenized; migration debt           |

## Removed legacy artifacts

| Item                                         | Status                                                      |
| -------------------------------------------- | ----------------------------------------------------------- |
| Named color `white` in CSS                   | Replaced with `var(--text-inverse)` or `var(--color-white)` |
| `!important` declarations                    | Removed (2 instances) via compound selectors                |
| Hard-coded SVG fill hex in lineage-graph.css | Replaced with semantic tokens                               |
| Hard-coded `#fff` in exec-type-bar           | Replaced with `var(--text-inverse)`                         |

## Follow-up work

1. Build remaining primitives: Input, Table, Modal
2. Replace `.primary-action` / `.secondary-action` with `<Button>` in TSX
3. Replace `.tone-badge` / `.app-badge` with `<Badge>` in TSX
4. Consolidate exec-type-bar into single shared partial
5. Replace legacy segmented controls with `<Tabs variant="pill">`
6. Move migrated CSS from `@layer legacy` to `@layer components`
7. Shrink legacy CSS files as rules are consumed by primitives
8. Add codegen from JSON tokens to CSS + TS (ADR 0022 Phase 2)
9. Add CI script (`scripts/check-css-tokens.mjs`) for hard-coded value detection
