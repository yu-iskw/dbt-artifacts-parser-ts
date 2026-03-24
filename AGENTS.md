# Agent instructions (dbt-artifacts-parser-ts)

## Tech stack

- **Package manager:** pnpm (monorepo)
- **Node.js:** version in [`.node-version`](.node-version) (currently 22.10.0)
- **Language:** TypeScript; unit tests use Vitest from the repository root

## Frontend application

- **Package:** `@dbt-tools/web`
- **Path:** [`packages/dbt-tools/web`](packages/dbt-tools/web)
- **Stack:** Vite, React, Recharts, `@tanstack/react-virtual`; depends on workspace packages `@dbt-tools/core` and `dbt-artifacts-parser`
- **E2E:** Playwright specs under [`packages/dbt-tools/web/e2e/`](packages/dbt-tools/web/e2e/). For authoring or extending specs (selectors, fixtures, preview constraints), see [`.agents/skills/dbt-tools-web-e2e/SKILL.md`](.agents/skills/dbt-tools-web-e2e/SKILL.md).
- **Source layout (`packages/dbt-tools/web/src`):**
  - [`lib/analysis-workspace/`](packages/dbt-tools/web/src/lib/analysis-workspace/) — pure TypeScript (tree, lineage, overview helpers) and colocated `*.test.ts`; use `@web/types` for shared app types.
  - [`components/AnalysisWorkspace/`](packages/dbt-tools/web/src/components/AnalysisWorkspace/) — analyzer UI: [`views/`](packages/dbt-tools/web/src/components/AnalysisWorkspace/views/), [`timeline/`](packages/dbt-tools/web/src/components/AnalysisWorkspace/timeline/) (Gantt), explorer, lineage, [`shared.tsx`](packages/dbt-tools/web/src/components/AnalysisWorkspace/shared.tsx).
  - [`components/AnalysisWorkspace.tsx`](packages/dbt-tools/web/src/components/AnalysisWorkspace.tsx) — thin re-export shim so `import … from "./components/AnalysisWorkspace"` resolves (file wins over directory).
  - [`components/ui/`](packages/dbt-tools/web/src/components/ui/) — generic primitives (e.g. Spinner, Toast, Skeleton, Tooltip, SubtitleWithAction).
- **Path alias `@web`:** maps to `src/` for this package ([`tsconfig.json`](packages/dbt-tools/web/tsconfig.json), [`vite.config.ts`](packages/dbt-tools/web/vite.config.ts)). Root [`vitest.config.mjs`](vitest.config.mjs) defines the same alias so monorepo `pnpm test` resolves `@web/...` — keep these in sync if the alias changes.

## Quality gates (before claiming work complete)

From the repository root:

- `pnpm lint:report` — writes `lint-report.json`; must exit 0
- `pnpm coverage:report` — writes `coverage-report.json`; must exit 0. If coverage is below thresholds, add or improve unit tests (lines 60%, branches 50%, functions 60%, statements 60%)

## Commands

- **Web dev server:** `pnpm dev:web` (runs `pnpm --filter @dbt-tools/web dev`)
- **E2E tests:** `pnpm test:e2e` (runs `pnpm --filter @dbt-tools/web test:e2e`). Run after meaningful UI or user-flow changes
- **Build web:** `pnpm --filter @dbt-tools/web build`

## Frontend-specific guidance

For stack details, UI tone (product/analyzer UI), and verification expectations for Codex, see [`.codex/skills/dbt-tools-frontend/SKILL.md`](.codex/skills/dbt-tools-frontend/SKILL.md).

Optionally install OpenAI’s `frontend-skill` in the Codex app for composition and motion defaults; repository facts and commands in this file and the skill take precedence.
