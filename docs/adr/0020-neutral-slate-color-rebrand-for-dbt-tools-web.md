# 20. Neutral Slate color rebrand for dbt-tools web

Date: 2026-03-24

## Status

Accepted

Supersedes [19. Standardize color schema for dbt-tools web and adopt dbt resource-type tokens](0019-standardize-color-schema-for-dbt-tools-web-and-adopt-dbt-resource-type-tokens.md)

## Context

ADR 0019 established a four-layer color architecture and standardized the token structure across foundation surfaces, semantic status, dbt resource types, and graph components. The architecture itself is sound and remains unchanged.

However, the palette values introduced by ADR 0019 produce failing contrast ratios on several core text roles:

- `--text-muted` (`#536273`) on `--bg` (`#edf1f5`): ~4.1:1 — borderline AA, fails for body-size text
- `--text-soft` (`#708091`) on `--bg` (`#edf1f5`): ~3.1:1 — fails WCAG AA entirely

The overall visual impression is one of low contrast, which is compounded by the blue-gray background creating insufficient separation between the app surface and white panels.

At the time this ADR was first written, the lineage graph was also expected to remain on a darker graph canvas inside the broader light-theme product language. Subsequent graph work changed that direction. In the current product, the broader dark theme remains dark, but the lineage graph in dark mode is intentionally treated as a lighter analytical workspace to reduce visual fatigue, improve scanability, and make dense graph relationships easier to follow.

That change also proved that graph-local UI could not simply inherit generic dark-surface assumptions. Once the dark-mode graph canvas became light gray, graph panels, borders, text roles, edges, test badges, and compact node metadata all needed graph-specific rebalancing.

A scored analysis across five candidate schemas was conducted, evaluating WCAG contrast compliance, dbt ecosystem fit, lineage graph legibility, developer tool aesthetic, implementation complexity, and status signal clarity. The Neutral Slate schema scored highest (83/100 average) and was selected.

## Decision

Replace the foundation surface tokens and graph canvas tokens with a neutral cool-gray palette. The four-layer architecture from ADR 0019 is preserved; only palette values change.

### Palette and tokens (living source)

**Normative hex values, semantic roles, and legacy aliases** are maintained in
`packages/dbt-tools/web/src/styles/tokens.css` and mirrored for TypeScript consumers in
`packages/dbt-tools/web/src/constants/themeColors.ts`. This ADR records the **design
decision**, not a copy of that table.

At a high level: adopt a **neutral cool-gray** foundation and **stronger text contrast**
on panels (addressing WCAG failures called out in Context), shift **accent** toward a
lighter GitHub-style blue, and keep **semantic status** and **dbt resource-type** layers
stable from ADR 0019.

### Graph canvas and graph-local behavior

The dark-mode lineage graph remains a **light analytical island**: graph-local tokens
(`--graph-*`) and behavior-level rules in `lineage-graph.css` tune canvas, panels, text,
edges, and badges for **dark-on-light** reading inside dark app chrome—without duplicating
the full token matrix here.

### Unchanged layers

The following token layers are unchanged:

- Semantic status tokens: `--mint`, `--amber`, `--rose`, `--slate` and their soft variants
- All `--status-*` alias tokens
- All `--dbt-type-*` resource-type tokens
- Graph-local hotspot and selected-node accent behavior
- Border radius tokens

The neutral foundation still improves app-wide contrast, but the lineage graph now uses its own lighter graph-local layer inside dark mode. That graph-local layer is implemented through `tokens.css` graph aliases and `lineage-graph.css` behavior-level rules rather than through shared dark foundation tokens alone.

### Lineage graph behavior on the lighter canvas

- Resource-type node fills remain the primary semantic signal.
- Graph-local test stat badges use stronger contrast so pass/fail counts stay readable on the lighter surface.
- Node metadata is simplified for scanability: depth is removed from node bodies, and resource-type icons appear inline with node titles instead of relying on extra text rows.
- Graph chrome such as legends, zoom controls, edges, and panels is tuned to support the lighter graph canvas without overpowering node differentiation.

## Alternatives considered

1. **WCAG Light Mode Refresh (Schema 1)**: Incremental contrast fixes while keeping the blue-gray foundation. Scores similarly but preserves the underlying feeling of low contrast rather than resolving it.

2. **Deep Navy Dark Mode (Schema 2)**: Highest graph legibility and strongest aesthetic impact, but requires updating all four token layers and is best deferred to a dedicated dark-mode initiative.

3. **WCAG AAA High-Contrast (Schema 3)**: Maximum compliance but clinical aesthetic unsuited to the product's visual identity.

4. **dbt Brand Warm (Schema 4)**: Strongest dbt ecosystem alignment but amber warning tokens become ambiguous on cream backgrounds, reducing status signal clarity.

## Consequences

### Positive

- `--text-muted` and `--text-soft` now pass WCAG AA on all panel surfaces.
- The neutral cool-gray background creates stronger panel separation without requiring border changes.
- The lineage graph is easier to scan in dark mode because it uses a lighter analytical canvas with graph-local contrast tuning.
- Resource-type fills, compact test badges, and simplified node headers are easier to differentiate on the lighter graph surface.
- The palette remains familiar and legible to developers accustomed to GitHub, Linear, and similar tools.

### Negative

- The warm blue-gray character of the previous palette is lost in favor of a cooler, more neutral tone.
- The accent blue shifts from a deeper navy (`#1747b3`) to a lighter GitHub-style blue (`#0969da`), which may feel less bold on some surfaces.
- Dark mode now contains a light graph-specific analytical island, so graph panels, text, edges, and badges must be tuned deliberately instead of inheriting generic dark-surface defaults.

### Mitigations

- All semantic and resource-type token values are preserved, so node meaning remains consistent even as graph-local surfaces change.
- The graph-specific exception is isolated to graph-local aliases and graph UI rules (see References), limiting the impact on the rest of dark mode.
- The lighter canvas is paired with graph-local rebalancing of text, panels, edges, test badges, and node metadata so readability does not regress.

## References

- `packages/dbt-tools/web/src/styles/tokens.css`
- `packages/dbt-tools/web/src/styles/lineage-graph.css`
- [ADR 0019](0019-standardize-color-schema-for-dbt-tools-web-and-adopt-dbt-resource-type-tokens.md)
