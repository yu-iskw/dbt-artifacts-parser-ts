# AGENTS.md

## Cursor Cloud specific instructions

### Overview

pnpm monorepo with four packages: `dbt-artifacts-parser` (core parser library), `@dbt-tools/core`, `@dbt-tools/cli`, and `@dbt-tools/web` (React/Vite). No external services or databases required.

### Node.js

Node.js version is pinned in `.node-version` (currently 22.10.0). The environment uses nvm; the update script activates the correct version automatically.

### Key commands

All commands run from the repo root. See `package.json` `scripts` for full list.

| Task | Command |
|---|---|
| Install deps | `pnpm install --frozen-lockfile` |
| Build all | `pnpm build` |
| Unit tests | `pnpm test` |
| Test + coverage | `pnpm test:coverage` |
| Lint (ESLint) | `pnpm lint:eslint` |
| Lint report | `pnpm lint:report` (must exit 0) |
| Coverage report | `pnpm coverage:report` (must exit 0) |
| Web dev server | `pnpm dev:web` (localhost:5173) |
| E2E tests | `pnpm test:e2e` (needs Playwright + Chromium) |
| CLI | `node packages/dbt-tools/cli/dist/cli.js` (build first) |

### Non-obvious caveats

- **esbuild build script warning**: `pnpm install` may warn about ignored build scripts for `esbuild`. This is safe to ignore; esbuild still works because it ships prebuilt binaries for the platform.
- **Web dev server with artifacts**: To pre-load dbt artifacts, start with `DBT_TARGET=/path/to/target pnpm dev:web`. Without `DBT_TARGET`, the app shows an upload UI. Sample artifacts live under `packages/dbt-artifacts-parser/resources/`.
- **Trunk CLI**: `pnpm lint` and `pnpm format` require the Trunk CLI. For CI/agent lint checks, use `pnpm lint:eslint` and `pnpm lint:report` instead.
- **Build before CLI**: The CLI requires `pnpm build` first since it runs from `dist/`.
- **Coverage thresholds**: lines 60%, branches 50%, functions 60%, statements 60%. See `vitest.config.mjs`.
