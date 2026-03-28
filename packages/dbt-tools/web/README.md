# @dbt-tools/web

React web application for visual dbt artifact analysis. Provides interactive dependency graph exploration and execution timeline visualization.

---

## Prerequisites

- **Node.js** ≥ 18
- **pnpm** ≥ 8 (the monorepo uses pnpm workspaces)
- A dbt project with a `./target/` directory containing `manifest.json` and/or `run_results.json`

---

## Tech Stack

| Layer           | Technology                                                       |
| --------------- | ---------------------------------------------------------------- |
| UI framework    | [React 18](https://react.dev/)                                   |
| Build tool      | [Vite 6](https://vitejs.dev/)                                    |
| Charts          | [Recharts](https://recharts.org/)                                |
| Virtualization  | [@tanstack/react-virtual](https://tanstack.com/virtual)          |
| Analysis engine | `@dbt-tools/core` (web worker, `@dbt-tools/core/browser` export) |
| E2E tests       | [Playwright](https://playwright.dev/)                            |
| Language        | TypeScript 5                                                     |

---

## Features

- **Dependency graph visualization** — explore model relationships as an interactive graph
- **Execution timeline** — Gantt-style view of `run_results.json` with critical path highlighting
- **Auto-reload** — automatically re-analyzes artifacts when `dbt run` completes
- **Large project support** — virtualized lists and web workers keep the UI responsive at 100k+ nodes

---

## Architecture

```mermaid
graph TD
  FS["./target/\nmanifest.json\nrun_results.json"]
  VDS[Vite Dev Server\nDBT_TARGET middleware]
  APP[React App]
  WW[Web Worker]
  CORE["@dbt-tools/core/browser\nManifestGraph · ExecutionAnalyzer"]

  FS -->|file watch| VDS
  VDS -->|GET /api/manifest.json\nGET /api/run_results.json| APP
  APP -->|postMessage| WW
  WW --> CORE
  CORE -->|graph · analysis results| WW
  WW -->|postMessage| APP
  APP -->|renders| UI[Dependency Graph\nExecution Timeline\nSummary Stats]
```

Heavy analysis runs in a web worker to keep the main thread free. The worker imports from `@dbt-tools/core/browser` (the Node.js-free export) so it works without any server-side code.

---

## Running Locally

The web app is not published to npm. Run it from the monorepo:

```bash
# From repo root
pnpm dev:web

# Or from the package directory
cd packages/dbt-tools/web
pnpm dev
```

### Preloading artifacts from a local dbt project

Set `DBT_TARGET` to serve `manifest.json` and `run_results.json` from that directory:

```bash
DBT_TARGET=./target pnpm dev
# or use the dev:target convenience script from the package directory:
pnpm dev:target   # shorthand for DBT_TARGET=./target vite
```

Then open the URL Vite prints (e.g. `http://localhost:5173/`).

### Debug Logging

- **Server-side** (Vite middleware): set `DBT_DEBUG=1` when starting dev
- **Client-side** (browser console): add `?debug=1` to the URL

```bash
DBT_DEBUG=1 DBT_TARGET=~/path/to/target pnpm dev
# then open: http://localhost:5173/?debug=1
```

### Auto-reload When Artifacts Change

When `DBT_TARGET` is set, the app automatically reloads and re-analyzes when `manifest.json` or `run_results.json` change on disk (e.g. after `dbt run`):

| Variable                 | Default | Description                                                 |
| ------------------------ | ------- | ----------------------------------------------------------- |
| `DBT_WATCH`              | `1`     | Enable (`1`) or disable (`0`) file watching and auto-reload |
| `DBT_RELOAD_DEBOUNCE_MS` | `300`   | Debounce in ms for rapid file writes                        |

```bash
# Disable auto-reload
DBT_WATCH=0 DBT_TARGET=./target pnpm dev
```

---

## Configuration

All configuration is via environment variables passed to the Vite dev server or build:

| Variable                 | Default | Description                                                                                        |
| ------------------------ | ------- | -------------------------------------------------------------------------------------------------- |
| `DBT_TARGET`             | —       | Directory containing `manifest.json` and `run_results.json`; enables the `/api/*` proxy middleware |
| `DBT_DEBUG`              | `0`     | Set to `1` to enable server-side debug logging in the Vite middleware                              |
| `DBT_WATCH`              | `1`     | Enable (`1`) or disable (`0`) file watching and auto-reload when artifacts change                  |
| `DBT_RELOAD_DEBOUNCE_MS` | `300`   | Debounce delay in ms before triggering a reload on rapid file writes                               |

Add `?debug=1` to the browser URL to enable client-side debug logging.

---

## Building for Production

```bash
pnpm build
# Output in dist/
pnpm preview   # serve the production build locally
```

---

## Project Structure

```text
packages/dbt-tools/web/
├── src/
│   ├── components/          # React UI components
│   │   ├── AnalysisWorkspace/   # Gantt timeline and execution view
│   │   ├── AppShell/            # Top-level layout shell
│   │   └── ui/                  # Shared primitive components
│   ├── hooks/               # Custom React hooks
│   ├── services/            # Data-fetching and artifact API services
│   ├── workers/             # Web worker for off-thread analysis
│   ├── constants/           # Theme colors and shared constants
│   ├── lib/                 # Analysis workspace helpers
│   ├── styles/              # CSS tokens, base, and component styles
│   ├── App.tsx              # Root application component
│   └── main.tsx             # Entry point
├── e2e/                     # Playwright end-to-end test specs
├── vite.config.ts           # Vite + Vite middleware (DBT_TARGET proxy)
└── package.json
```

---

## E2E Tests

The web app has Playwright end-to-end tests:

```bash
pnpm test:e2e
```

See `e2e/` for test specs.

---

## Troubleshooting

| Symptom                              | Fix                                                                                                                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Blank page / "No artifacts found"    | Ensure `DBT_TARGET` points to a directory that contains `manifest.json`                                                                                                |
| Auto-reload not triggering           | Check `DBT_WATCH` is not set to `0`; verify the file watcher has read access to the target directory                                                                   |
| Slow UI with large manifests         | The web worker and virtualized lists should handle 100k+ nodes; if performance still degrades, open the browser profiler and check for main-thread analysis code paths |
| `GET /api/manifest.json` returns 404 | `DBT_TARGET` is not set or the Vite dev server was started without it                                                                                                  |
| Debug logs not appearing             | Server-side: restart dev with `DBT_DEBUG=1`; client-side: add `?debug=1` to the URL                                                                                    |

---

## Development

```bash
pnpm build   # TypeScript + Vite build
pnpm dev     # Vite dev server with HMR
```

See [CONTRIBUTING.md](../../../CONTRIBUTING.md) for the full developer guide, including how to set up the monorepo and run all tests.

---

## Related Packages

| Package                                                        | Description                                                                  |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [`@dbt-tools/core`](../core/README.md)                         | Analysis engine used by this web app (dependency graphs, execution analysis) |
| [`@dbt-tools/cli`](../cli/README.md)                           | Command-line interface for the same analysis, optimized for AI agents        |
| [`dbt-artifacts-parser`](../../dbt-artifacts-parser/README.md) | Standalone library for parsing and typing dbt JSON artifacts                 |

---

## License

Apache License 2.0.
