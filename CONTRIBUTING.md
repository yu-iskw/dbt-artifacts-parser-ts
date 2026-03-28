# Contributing

This document is for **developers** who want to build, test, or contribute to this monorepo. For end-user documentation, see the package READMEs.

---

## Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- [pnpm](https://pnpm.io/) ≥ 8 (`npm install -g pnpm`)
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
DBT_TARGET=./target pnpm dev:web

# With debug logging
DBT_DEBUG=1 DBT_TARGET=./target pnpm dev:web
```

See [`packages/dbt-tools/web/README.md`](./packages/dbt-tools/web/README.md) for full environment variable reference.

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
- `@dbt-tools/cli` — `npm publish` from `packages/dbt-tools/cli/`
- `@dbt-tools/web` — not published to npm (app only)

---

## Commit Conventions

Use concise, imperative commit messages:

```
feat: add manifest v13 support
fix: handle missing metadata in sources parser
docs: update @dbt-tools/core API reference
```

---

## License

Apache License 2.0. Contributions are accepted under the same license.
