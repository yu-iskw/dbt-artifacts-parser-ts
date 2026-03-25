# 22. Modular CSS layers and token file split for dbt-tools web

Date: 2026-03-25

## Status

Accepted

Depends on [20. Neutral Slate color rebrand for dbt-tools web](0020-neutral-slate-color-rebrand-for-dbt-tools-web.md)

Related to [21. Strangler-style decomposition for oversized AnalysisWorkspace views](0021-strangler-style-decomposition-for-oversized-analysisworkspace-views.md) (parallel split: React views vs stylesheets)

## Context

The `@dbt-tools/web` stylesheet lived in a single `index.css` of several thousand lines. That made reviews and navigation expensive and obscured where design tokens ended and component rules began.

Semantic token architecture and palette direction remain defined by ADR 0020 (and the superseded ADR 0019 layering). TypeScript that paints canvas or chart surfaces (for example `themeColors.ts`) is still maintained in manual sync with CSS custom properties.

## Decision

1. **Physical modularization** under `packages/dbt-tools/web/src/styles/`:
   - **`tokens.css`** — only `:root`, `[data-theme="dark"]`, and variable-definition aliases (legacy `--bg`, `--panel`, graph aliases, `--dbt-type-*`, etc.).
   - **`base.css`** — global rules after tokens (`*`, `html`, `body`, `button`/`input`, `code`, `#root`).
   - **`app-shell.css`** — app frame, sidebar, header, and the bulk of analyzer/landing rules that originally appeared before the “micro-interaction” banner (shell and workspace rules are interleaved in source order; this file preserves that order for cascade safety).
   - **`ui-primitives.css`** — from the former “micro-interaction” section through the last rules before the lineage graph banner (spinner, skeleton, tooltip, toast, empty state, plus sidebar link refinements and upload/overview landing blocks that followed in the monolith — order unchanged).
   - **`lineage-graph.css`** — dependency graph, lineage viewport, context menu, node tooltip, toolbar, and related graph UI.
   - **`workspace.css`** — explorer tree, overview bands/modules, type donut, and shared legend rows that followed the graph section in the original file.

2. **`packages/dbt-tools/web/src/index.css`** is a **barrel** that `@import`s the slices in a fixed order: **tokens → base → app-shell → ui-primitives → lineage-graph → workspace**. `main.tsx` keeps a single entry: `import "./index.css"`.

3. **Phase 2 (optional):** If CSS/TS drift or multi-theme work becomes painful, introduce a token build (for example Style Dictionary) to generate CSS variables and/or TS mirrors, plus a CI diff check. Not required for this ADR.

## Consequences

- **Easier navigation** and smaller diffs per concern (tokens vs graph vs overview tree).
- **Import order is a contract**: `tokens.css` must load before any file that uses `var(--*)`.
- **Git blame** on specific rules shifts to new paths; history is still available via `git log --follow`.
- **Naming vs content:** Some files bundle more than the filename suggests because **cascade order must match the former monolith**; `packages/dbt-tools/web/src/styles/README.md` documents the split and the `themeColors.ts` sync contract.

## Diagram (target layering)

```mermaid
flowchart TB
  subgraph styles [src/styles]
    tokens["tokens.css"]
    base["base.css"]
    shell["app-shell.css"]
    ui["ui-primitives.css"]
    graph["lineage-graph.css"]
    ws["workspace.css"]
    barrel["../index.css barrel"]
  end
  main["main.tsx"]
  barrel --> tokens
  barrel --> base
  barrel --> shell
  barrel --> ui
  barrel --> graph
  barrel --> ws
  main --> barrel
```
