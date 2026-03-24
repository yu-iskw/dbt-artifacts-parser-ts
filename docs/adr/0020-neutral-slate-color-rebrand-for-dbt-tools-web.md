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

A scored analysis across five candidate schemas was conducted, evaluating WCAG contrast compliance, dbt ecosystem fit, lineage graph legibility, developer tool aesthetic, implementation complexity, and status signal clarity. The Neutral Slate schema scored highest (83/100 average) and was selected.

## Decision

Replace the foundation surface tokens and graph canvas tokens with a neutral cool-gray palette. The four-layer architecture from ADR 0019 is preserved; only palette values change.

### Foundation surface tokens

| Token            | Old value                | New value             | Notes                    |
| ---------------- | ------------------------ | --------------------- | ------------------------ |
| `--bg`           | `#edf1f5`                | `#f6f8fa`             | Cooler, lighter gray     |
| `--bg-soft`      | `#f7f8fb`                | `#ffffff`             | Pure white soft surface  |
| `--panel`        | `rgba(255,255,255,0.94)` | `#ffffff`             | Opaque white panel       |
| `--panel-border` | `rgba(29,39,51,0.12)`    | `rgba(31,45,61,0.14)` | Slightly stronger border |

### Text hierarchy tokens

| Token          | Old value | New value | Contrast on white |
| -------------- | --------- | --------- | ----------------- |
| `--text`       | `#17212b` | `#0d1117` | 19.5:1 (AAA)      |
| `--text-muted` | `#536273` | `#424a53` | 8.1:1 (AAA)       |
| `--text-soft`  | `#708091` | `#626c77` | 4.9:1 (AA)        |

### Brand + accent tokens

| Token           | Old value              | New value              |
| --------------- | ---------------------- | ---------------------- |
| `--accent`      | `#1747b3`              | `#0969da`              |
| `--accent-soft` | `rgba(37,88,217,0.12)` | `rgba(9,105,218,0.12)` |

### Graph canvas tokens

| Token               | Old value | New value | Notes                         |
| ------------------- | --------- | --------- | ----------------------------- |
| `--graph-bg-top`    | `#16384b` | `#13181f` | Neutral dark canvas           |
| `--graph-bg-bottom` | `#0f2838` | `#0d1117` | Matches `--text` for cohesion |

### Unchanged layers

The following token layers are unchanged:

- Semantic status tokens: `--mint`, `--amber`, `--rose`, `--slate` and their soft variants
- All `--status-*` alias tokens
- All `--dbt-type-*` resource-type tokens
- All remaining graph tokens (panel, text, edge, stroke, hotspot)
- Border radius tokens

The neutral background makes the vibrant resource-type fills pop harder on the graph canvas without requiring any adjustments to those tokens.

## Alternatives considered

1. **WCAG Light Mode Refresh (Schema 1)**: Incremental contrast fixes while keeping the blue-gray foundation. Scores similarly but preserves the underlying feeling of low contrast rather than resolving it.

2. **Deep Navy Dark Mode (Schema 2)**: Highest graph legibility and strongest aesthetic impact, but requires updating all four token layers and is best deferred to a dedicated dark-mode initiative.

3. **WCAG AAA High-Contrast (Schema 3)**: Maximum compliance but clinical aesthetic unsuited to the product's visual identity.

4. **dbt Brand Warm (Schema 4)**: Strongest dbt ecosystem alignment but amber warning tokens become ambiguous on cream backgrounds, reducing status signal clarity.

## Consequences

### Positive

- `--text-muted` and `--text-soft` now pass WCAG AA on all panel surfaces.
- The neutral cool-gray background creates stronger panel separation without requiring border changes.
- Resource-type fills gain perceptual contrast on the darker neutral graph canvas without any token value changes.
- The palette is familiar and legible to developers accustomed to GitHub, Linear, and similar tools.

### Negative

- The warm blue-gray character of the previous palette is lost in favor of a cooler, more neutral tone.
- The accent blue shifts from a deeper navy (`#1747b3`) to a lighter GitHub-style blue (`#0969da`), which may feel less bold on some surfaces.

### Mitigations

- All semantic and resource-type token values are preserved, so no component logic changes are required.
- The graph canvas darkening is minimal and does not affect node fills or edge readability.

## References

- `packages/dbt-tools/web/src/index.css`
- [ADR 0019](0019-standardize-color-schema-for-dbt-tools-web-and-adopt-dbt-resource-type-tokens.md)
