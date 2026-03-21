# @dbt-tools/web

Web application for visual dbt artifact analysis.

## Development

### Preloading artifacts from a local target directory

Set `DBT_TARGET` to serve `manifest.json` and `run_results.json` from that directory at `/api/manifest.json` and `/api/run_results.json`:

```bash
DBT_TARGET=./target pnpm dev
# or
pnpm dev:target
```

Open the URL Vite prints (e.g. `http://localhost:5173/`). If the port changes (e.g. 5174), use that URL so requests hit the server with `DBT_TARGET` configured.

### Debug logging

- **Server**: `DBT_DEBUG=1` when starting dev to see dbt-target middleware logs in the terminal.
- **Client**: Add `?debug=1` to the URL to see preload logs in the browser console.

Example:

```bash
DBT_DEBUG=1 DBT_TARGET=~/path/to/target pnpm dev
```

Then open `http://localhost:5173/?debug=1` (or the port Vite prints).

### Auto-reload when artifacts change

When `DBT_TARGET` is set, the app automatically reloads and re-analyzes when `manifest.json` or `run_results.json` change on disk (e.g. after running `dbt run`). Configuration:

- **`DBT_WATCH`**: `1` (default) = enable file watch and auto-reload; `0` = disable.
- **`DBT_RELOAD_DEBOUNCE_MS`**: Debounce in ms for rapid file writes (default: 300).

Example:

```bash
DBT_WATCH=0 DBT_TARGET=./target pnpm dev
```
