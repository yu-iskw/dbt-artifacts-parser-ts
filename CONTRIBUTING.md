# Contributing

This document is for **developers** who want to build, test, or contribute to this monorepo. For end-user documentation, see the package READMEs.

---

## Prerequisites

- [Node.js](https://nodejs.org/) — **20+** required; use [`.node-version`](.node-version) for parity with CI (GitHub Actions uses `node-version-file: .node-version`)
- [pnpm](https://pnpm.io/) **9+** (`npm install -g pnpm@9` or newer; this repo uses lockfile format 9)
- Git

---

## Setup

```bash
git clone https://github.com/yu-iskw/dbt-artifacts-parser-ts.git
cd dbt-artifacts-parser-ts
pnpm install
```

---

## Repository Structure

```text
dbt-artifacts-parser-ts/
├── packages/
│   ├── dbt-artifacts-parser/   # standalone parsing library
│   └── dbt-tools/
│       ├── core/               # @dbt-tools/core
│       ├── cli/                # @dbt-tools/cli
│       └── web/                # @dbt-tools/web
├── scripts/                    # shared build/utility scripts
├── vitest.workspace.mjs        # unified test config
└── eslint.config.mjs           # unified lint config
```

---

## Build Order

Packages must be built in dependency order. The root `pnpm build` handles this automatically:

```mermaid
graph LR
  P[dbt-artifacts-parser] -->|build first| C[@dbt-tools/core]
  C -->|then| CLI[@dbt-tools/cli]
  C -->|then| WEB[@dbt-tools/web]
```

```bash
# Build all packages in order
pnpm build

# Build a single package
pnpm --filter dbt-artifacts-parser build
pnpm --filter @dbt-tools/core build
pnpm --filter @dbt-tools/cli build
pnpm --filter @dbt-tools/web build
```

---

## Testing

```bash
# Run all unit tests (vitest)
pnpm test

# Watch mode
pnpm test --watch

# Run tests for a specific package
pnpm --filter dbt-artifacts-parser test
pnpm --filter @dbt-tools/core test
pnpm --filter @dbt-tools/cli test

# Run E2E tests for the web app (Playwright)
pnpm test:e2e
```

---

## Linting & Formatting

This project uses [Trunk](https://trunk.io/) to orchestrate ESLint and Prettier.

```bash
# Check linting
pnpm lint

# Auto-fix formatting
pnpm format
```

---

## Generating TypeScript Types

Types for `dbt-artifacts-parser` are generated from dbt's official JSON Schema files stored in `packages/dbt-artifacts-parser/resources/`.

```bash
# Regenerate all TypeScript types from JSON schemas
pnpm --filter dbt-artifacts-parser gen:types
```

### Adding a New dbt Artifact Version

1. Download the new JSON schema from [schemas.getdbt.com](https://schemas.getdbt.com/) into `packages/dbt-artifacts-parser/resources/`.
2. Run `pnpm gen:types` to regenerate types.
3. Add a version-specific parser in `src/<artifact>/v<N>.ts` (follow existing patterns).
4. Register the new version in `src/<artifact>/index.ts` (add to `parseArtifact` switch and union type).
5. Add a fixture file and unit test in `src/<artifact>/v<N>.test.ts`.

---

## Web App Development

```bash
# Start the Vite dev server
pnpm dev:web

# With local dbt artifacts preloaded
DBT_TOOLS_TARGET_DIR=./target pnpm dev:web

# With debug logging
DBT_TOOLS_DEBUG=1 DBT_TOOLS_TARGET_DIR=./target pnpm dev:web

# Optional: load the latest complete manifest/run_results pair from S3 or GCS
# (server-side only; JSON shape matches @dbt-tools/core getDbtToolsRemoteSourceConfigFromEnv)
DBT_TOOLS_REMOTE_SOURCE='{"provider":"s3","bucket":"my-bucket","prefix":"dbt/runs","pollIntervalMs":30000}' pnpm dev:web
```

Remote semantics: the dev server **polls** object storage and **detects** when a newer complete artifact pair exists; the open workspace **switches only after the user confirms** in the UI (see [ADR-0029](./docs/adr/0029-remote-object-storage-artifact-sources-and-auto-reload.md)).

Use your cloud provider’s normal application credentials (for example the AWS SDK default credential chain, or Application Default Credentials / `GOOGLE_APPLICATION_CREDENTIALS` for GCS). Credentials stay in the **Node/Vite middleware process**, not in the browser.

See [`packages/dbt-tools/web/README.md`](./packages/dbt-tools/web/README.md) for the full environment variable reference and [`docs/adr/0029-remote-object-storage-artifact-sources-and-auto-reload.md`](./docs/adr/0029-remote-object-storage-artifact-sources-and-auto-reload.md) for architecture.

---

## Coverage Report

```bash
pnpm coverage:report
```

---

## Publishing

All publishable packages have `"publishConfig": { "access": "public" }` in their `package.json`. Internal workspace references (`"workspace:*"`) are resolved to real version numbers by pnpm at publish time.

Packages:

- `dbt-artifacts-parser` — `npm publish` from `packages/dbt-artifacts-parser/`
- `@dbt-tools/core` — `npm publish` from `packages/dbt-tools/core/`
- `@dbt-tools/cli` — `npm publish` from `packages/dbt-tools/cli/` (binary: `dbt-tools`)
- `@dbt-tools/web` — `npm publish` from `packages/dbt-tools/web/` (binary: `dbt-tools-web`; ships `dist/` + server bundle)

CI publishes `@dbt-tools/*` in order via [`.github/workflows/publish-dbt-tools.yml`](.github/workflows/publish-dbt-tools.yml) after a GitHub Release (or `workflow_dispatch`). That workflow runs **unit tests for `@dbt-tools/core` and `@dbt-tools/cli`** before publish and builds **`@dbt-tools/web`** via its package `build` script (including prepack); it does not run the web app’s full E2E suite in that job.

---

## Commit Conventions

Use concise, imperative commit messages:

```text
feat: add manifest v13 support
fix: handle missing metadata in sources parser
docs: update @dbt-tools/core API reference
```

---

## License

Apache License 2.0. Contributions are accepted under the same license.
