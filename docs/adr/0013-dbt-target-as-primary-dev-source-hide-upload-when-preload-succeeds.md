# 13. DBT_TARGET as primary dev source hide upload when preload succeeds

Date: 2026-03-13

## Status

Accepted

Depends-on [12. Optional default dbt target directory for web dev server](0012-optional-default-dbt-target-directory-for-web-dev-server.md)

## Context

When DBT_TARGET is set and artifacts exist, the app must start with analysis loaded. The upload UI should not be the primary path—users should not need to specify or upload anything. ADR-0012 added preload from `DBT_TARGET`, but the UI still showed the upload form prominently even when analysis was already loaded, conflating both flows.

## Decision

When preload succeeds (`analysis` is set on mount), treat that as the primary state:

1. **Hide FileUpload** when analysis exists; render it only when `!analysis`.
2. **Subtitle**: When analysis exists, show "Analysis ready" (or "Loaded from DBT_TARGET" when source is known); when not, keep "Upload manifest.json and run_results.json to analyze your dbt run".
3. **Secondary action**: Add "Load different artifacts" link/button that clears analysis and shows upload UI on demand.
4. **Layout order**: Show RunSummary and GanttChart as primary content when analysis exists; place upload UI only when no analysis.

## Consequences

**Positive:**

- Clearer UX for DBT_TARGET users: app starts with analysis, no upload required.
- Upload remains available on demand via "Load different artifacts".
- Single source of truth: one layout path when analysis exists, one when it does not.

**Negative:**

- None identified.
