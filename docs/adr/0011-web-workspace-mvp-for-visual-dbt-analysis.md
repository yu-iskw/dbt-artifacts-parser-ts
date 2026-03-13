# 11. Web workspace MVP for visual dbt analysis

Date: 2026-03-13

## Status

Accepted

Depends-on [6. Artifact-first agent-first positioning of dbt-tools](0006-artifact-first-agent-first-positioning-of-dbt-tools.md)

Extends web workspace MVP [12. Optional default dbt target directory for web dev server](0012-optional-default-dbt-target-directory-for-web-dev-server.md)

Layers web app structure [15. MVC-style layering for web app](0015-mvc-style-layering-for-web-app.md)

## Context

ADR-0006 defines artifact-first, agent-first positioning and Tier 2 features (Gantt-style execution data, bottlenecks). `@dbt-tools/core` already provides `ExecutionAnalyzer.getGanttData()`, `ManifestGraph`, and `detectBottlenecks`. The CLI uses this core. We needed a web app for interactive visual dbt analysis while sharing logic across CLI, web, and future MCP.

The core package uses Node.js APIs (`fs`, `path`) in artifact-loader and input-validator. These cannot be bundled for the browser. `ExecutionAnalyzer`, `ManifestGraph`, `searchRunResults`, and `detectBottlenecks` operate on parsed JSON only—no file I/O—so they are browser-safe.

## Decision

1. **New package**: `packages/dbt-tools/web` as a Vite + React SPA.

2. **Browser entry point**: Add `@dbt-tools/core/browser` that re-exports only browser-safe APIs (`ManifestGraph`, `ExecutionAnalyzer`, `searchRunResults`, `detectBottlenecks` and related types). The web app imports from this entry to avoid Node-only modules.

3. **Client-side artifact loading**: Users upload `manifest.json` and `run_results.json` via file inputs. Parse with `parseManifest` and `parseRunResults` from `dbt-artifacts-parser`. Analyze with `ExecutionAnalyzer` and `ManifestGraph` from `@dbt-tools/core/browser`. Use dynamic imports for parser and core to work around Rollup CJS/ESM interop with workspace packages.

4. **MVP views**: Gantt chart (Recharts horizontal stacked bars) and run summary (total time, status counts, top 5 bottlenecks).

5. **Out of scope for MVP**: Lineage graph, AI agents (page-agent), web workers.

### Architecture

```mermaid
flowchart TB
    subgraph Web [packages/dbt-tools/web]
        Upload[File upload UI]
        Parse[JSON.parse + parseManifest/parseRunResults]
        Analyze[ManifestGraph + ExecutionAnalyzer]
        Gantt[Gantt chart view]
        Summary[Run summary view]
    end

    subgraph Core [@dbt-tools/core/browser]
        MG[ManifestGraph]
        EA[ExecutionAnalyzer]
    end

    subgraph Parser [dbt-artifacts-parser]
        PM[parseManifest]
        PR[parseRunResults]
    end

    Upload --> Parse
    Parse --> PM
    Parse --> PR
    PM --> MG
    PR --> EA
    MG --> EA
    EA --> Gantt
    EA --> Summary
```

## Consequences

**Positive:**

- Single source of truth for analysis logic (CLI and web share core).
- Clear separation: core/browser excludes Node APIs; web app stays thin.
- Enables interactive Gantt and run summary without backend.
- Aligns with ADR-0006 Tier 2 roadmap.

**Negative:**

- Dynamic imports for parser and core add slight latency on first analyze.
- Large chunk size (~535 KB) for the combined parser/core/Recharts bundle.

**Mitigations:**

- Document the browser entry for future web/MCP consumers.
- Consider manual chunks or lazy loading for post-MVP performance.
