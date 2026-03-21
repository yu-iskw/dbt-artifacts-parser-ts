# 15. MVC-style layering for web app

Date: 2026-03-13

## Status

Accepted

Depends-on [11. Web workspace MVP for visual dbt analysis](0011-web-workspace-mvp-for-visual-dbt-analysis.md)

Depends-on [13. DBT_TARGET as primary dev source hide upload when preload succeeds](0013-dbt-target-as-primary-dev-source-hide-upload-when-preload-succeeds.md)

Depends-on [14. Auto-reload dbt artifacts when DBT_TARGET files change](0014-auto-reload-dbt-artifacts-when-dbt-target-files-change.md)

## Context

App.tsx combined preload, reload, upload handling, and UI in one file. ADR-0011 and ADR-0013/0014 added preload and auto-reload; logic grew without structure. We needed separation of concerns without introducing Redux/Zustand.

## Decision

1. **Model (services/)**: Pure data and analysis. `artifactApi.ts` provides `refetchFromApi()`. `analyze.ts` provides `analyzeArtifacts()` (moved from root).

2. **Controller (hooks/)**: State and side effects. `useAnalysisPreload` runs once on mount; `useDbtArtifactsReload` subscribes to HMR when source is preload; `useAnalysisPage` composes them and exposes `{ analysis, error, preloadLoading, ... }`.

3. **View (components/)**: Presentational only. Extract `SubtitleWithAction` and `ErrorBanner` from App; App becomes a thin shell that calls `useAnalysisPage` and renders components.

4. **Scope**: `dbt-target-plugin.ts` remains build-time tooling; it does not belong to MVC layers.

### Layer Structure

```mermaid
flowchart TB
    subgraph View [View - components/]
        App[App.tsx]
        FileUpload[FileUpload]
        RunSummary[RunSummary]
        GanttChart[GanttChart]
        SubtitleWithAction[SubtitleWithAction]
        ErrorBanner[ErrorBanner]
    end

    subgraph Controller [Controller - hooks/]
        useAnalysisPreload[useAnalysisPreload]
        useDbtArtifactsReload[useDbtArtifactsReload]
        useAnalysisPage[useAnalysisPage]
    end

    subgraph Model [Model - services/]
        artifactApi[artifactApi.ts]
        analyze[analyze.ts]
    end

    App --> useAnalysisPage
    useAnalysisPage --> useAnalysisPreload
    useAnalysisPage --> useDbtArtifactsReload
    useAnalysisPreload --> artifactApi
    useDbtArtifactsReload --> artifactApi
    useAnalysisPreload --> analyze
    FileUpload --> analyze
    artifactApi --> analyze
```

### Data Flow (Preload vs Upload vs Reload)

```mermaid
sequenceDiagram
    participant App
    participant useAnalysisPreload
    participant useDbtArtifactsReload
    participant artifactApi
    participant analyze
    participant FileUpload

    Note over App: Mount
    App->>useAnalysisPreload: run once
    useAnalysisPreload->>artifactApi: refetchFromApi
    artifactApi->>analyze: analyzeArtifacts
    analyze-->>useAnalysisPreload: AnalysisState
    useAnalysisPreload-->>App: setAnalysis, setSource preload

    Note over App: source=preload and HMR
    useDbtArtifactsReload->>artifactApi: refetchFromApi on dbt-artifacts-changed
    artifactApi->>analyze: analyzeArtifacts
    analyze-->>useDbtArtifactsReload: AnalysisState
    useDbtArtifactsReload-->>App: setAnalysis

    Note over App: User loads different
    App->>App: clear analysis, show FileUpload
    FileUpload->>analyze: analyzeArtifacts
    analyze-->>FileUpload: AnalysisState
    FileUpload-->>App: onAnalysis
```

## Consequences

**Positive:**

- Clearer boundaries, easier testing, consistent place for new features.

**Negative:**

- More files and imports; some indirection for a small app.

**Mitigations:**

- Keep App thin; add new features in the appropriate layer.
