# 14. Auto-reload dbt artifacts when DBT_TARGET files change

Date: 2026-03-13

## Status

Accepted

Depends-on [12. Optional default dbt target directory for web dev server](0012-optional-default-dbt-target-directory-for-web-dev-server.md)

Uses reload subscription [15. MVC-style layering for web app](0015-mvc-style-layering-for-web-app.md)

Amended-by [28. DBT_TOOLS\_ prefix for dbt-tools environment variables](0028-dbt-tools-prefix-for-dbt-tools-environment-variables.md)

Related [29. Remote object storage artifact sources and auto-reload](0029-remote-object-storage-artifact-sources-and-auto-reload.md)

## Context

When DBT_TARGET preloads artifacts successfully, users run `dbt run` repeatedly during local development. The app displayed stale analysis until the user manually refreshed the page or clicked "Load different artifacts". This added friction to the dev loop.

## Decision

1. **File watch**: The dbt-target Vite plugin watches `manifest.json` and `run_results.json` in the DBT_TARGET directory using `fs.watch`.

2. **WebSocket notification**: When either file changes, the plugin sends a `dbt-artifacts-changed` event via Vite's WebSocket (`server.ws.send`). Changes are debounced with `DBT_RELOAD_DEBOUNCE_MS` (default 300ms).

3. **Client subscription**: When analysis was loaded from preload (not upload), the app subscribes to `dbt-artifacts-changed` via `import.meta.hot.on`. On event, it refetches from `/api/*`, re-analyzes, and updates the UI.

4. **Configuration**:
   - `DBT_WATCH=1` (default when DBT_TARGET set): enable file watch and auto-reload.
   - `DBT_WATCH=0`: disable.
   - `DBT_RELOAD_DEBOUNCE_MS` (default 300): debounce for rapid writes.

5. **Scope**: Auto-reload applies only when analysis source is preload. Manual upload flow does not subscribe.

## Consequences

**Positive:**

- Smoother dev loop: run dbt, see updated analysis immediately.
- No change for upload flow or production builds (`import.meta.hot` is undefined).

**Negative:**

- File watch adds minimal server overhead; debouncing limits reload frequency.
- `fs.watch` behavior varies by OS; tested on macOS.
