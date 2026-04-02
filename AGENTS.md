# Agent instructions (dbt-artifacts-parser-ts)

## Tech stack

- **Package manager:** pnpm (monorepo)
- **Node.js:** use the version in [`.node-version`](.node-version) for local development and CI (authoritative). Published packages declare **`engines.node` ≥ 20**; Node 18 is EOL — see [Node.js releases](https://nodejs.org/en/about/previous-releases).
- **Language:** TypeScript; unit tests use Vitest from the repository root

## Frontend application

- **Package:** `@dbt-tools/web`
- **Path:** [`packages/dbt-tools/web`](packages/dbt-tools/web)
- **Stack:** Vite, React, Recharts, `@tanstack/react-virtual`; depends on workspace packages `@dbt-tools/core` and `dbt-artifacts-parser`
- **E2E:** Playwright specs under [`packages/dbt-tools/web/e2e/`](packages/dbt-tools/web/e2e/). For authoring or extending specs (selectors, fixtures, preview constraints), see [`.agents/skills/dbt-tools-web-e2e/SKILL.md`](.agents/skills/dbt-tools-web-e2e/SKILL.md). To run `pnpm test:e2e` and fix failing Playwright tests, see [`.agents/skills/dbt-tools-web-e2e-fix/SKILL.md`](.agents/skills/dbt-tools-web-e2e-fix/SKILL.md) (Claude copy: [`.claude/skills/dbt-tools-web-e2e-fix/SKILL.md`](.claude/skills/dbt-tools-web-e2e-fix/SKILL.md)).
- **Pack + `npx` smoke (published layout):** verify `pnpm pack` + `dbt-tools-web` via `npx` without npm publish — [`.agents/skills/dbt-tools-web-pack-npx-smoke/SKILL.md`](.agents/skills/dbt-tools-web-pack-npx-smoke/SKILL.md) (Claude copy: [`.claude/skills/dbt-tools-web-pack-npx-smoke/SKILL.md`](.claude/skills/dbt-tools-web-pack-npx-smoke/SKILL.md)). The **verifier** subagent runs this after `pnpm build`; CI mirrors it in **`web-pack-npx-smoke`** ([`.github/workflows/test.yml`](.github/workflows/test.yml)).
- **Source layout (`packages/dbt-tools/web/src`):**
  - [`lib/analysis-workspace/`](packages/dbt-tools/web/src/lib/analysis-workspace/) — pure TypeScript (tree, lineage, overview helpers) and colocated `*.test.ts`; use `@web/types` for shared app types.
  - [`components/AnalysisWorkspace/`](packages/dbt-tools/web/src/components/AnalysisWorkspace/) — analyzer UI (import the package via `./components/AnalysisWorkspace`, which resolves to [`index.tsx`](packages/dbt-tools/web/src/components/AnalysisWorkspace/index.tsx)): [`views/`](packages/dbt-tools/web/src/components/AnalysisWorkspace/views/) (feature folders `health/`, `runs/`, `inventory/`, shared `overview/` and `assets`), [`timeline/`](packages/dbt-tools/web/src/components/AnalysisWorkspace/timeline/) (Gantt; **must include dbt `source` nodes**, including rows synthesized in `@dbt-tools/core` snapshot construction when `run_results` has no timed source entries — [ADR-0032](docs/adr/0032-timeline-includes-dbt-sources-via-snapshot-synthesis.md)), explorer, lineage graph (Inventory **Lineage** tab + `assetTab=lineage`; legacy `?view=lineage` / `?view=dependencies` redirect there), [`shared.tsx`](packages/dbt-tools/web/src/components/AnalysisWorkspace/shared.tsx).
  - [`components/ui/`](packages/dbt-tools/web/src/components/ui/) — generic primitives (e.g. Spinner, Toast, Skeleton).
  - **Remote artifact sources (S3 / GCS):** [`packages/dbt-tools/web/src/artifact-source/`](packages/dbt-tools/web/src/artifact-source/) — Vite middleware resolves runs from `DBT_TOOLS_REMOTE_SOURCE` (JSON parsed via `@dbt-tools/core` [`getDbtToolsRemoteSourceConfigFromEnv`](packages/dbt-tools/core/src/config/dbt-tools-env.ts)); browser client [`artifactSourceApi.ts`](packages/dbt-tools/web/src/services/artifactSourceApi.ts); decision [ADR-0029](docs/adr/0029-remote-object-storage-artifact-sources-and-auto-reload.md).
- **Path alias `@web`:** maps to `src/` for this package ([`tsconfig.json`](packages/dbt-tools/web/tsconfig.json), [`vite.config.ts`](packages/dbt-tools/web/vite.config.ts)). Root [`vitest.config.mjs`](vitest.config.mjs) defines the same alias so monorepo `pnpm test` resolves `@web/...` — keep these in sync if the alias changes.
- **`@dbt-tools/core` vs `core/browser`:** Use `@dbt-tools/core/browser` in workers and anywhere that must stay free of Node built-ins. The full `@dbt-tools/core` entry is for Vite/Node-only code (`artifact-source/`, `dbt-target-plugin.ts`). ESLint encodes this for workers, hooks, and components ([`eslint.config.mjs`](eslint.config.mjs)).

## Quality gates (before claiming work complete)

From the repository root:

- `pnpm lint:report` — writes `lint-report.json`; must exit 0
- `pnpm coverage:report` — writes `coverage-report.json`; must exit 0. If coverage is below thresholds, add or improve unit tests (lines 60%, branches 50%, functions 60%, statements 60%)
- `pnpm knip` — unused exports/files/deps (monorepo); must exit 0. Configuration: [`knip.json`](knip.json). `ignoreExportsUsedInFile` is enabled; parser package ignores noisy `types` issues; `scripts/preprocess-refs.js` and the `@apidevtools/json-schema-ref-parser` devDependency are scoped to generation scripts (see `ignoreFiles` / `ignoreDependencies`).
- **ESLint vs TypeScript 6:** `@typescript-eslint/*` 8.57.x still declares a peer range that excludes TypeScript 6 while this repo uses TypeScript 6, so `pnpm lint:eslint` may log a “not officially supported” warning. That is informational until [typescript-eslint#12123](https://github.com/typescript-eslint/typescript-eslint/issues/12123) ships; when a release widens the peer range, bump `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` to the **same** new version and refresh the lockfile.

### Linter and static-analysis violations (agent default)

- **Fix the issue first.** When ESLint, TypeScript, Semgrep, CodeQL, or similar tools report a violation, agents should **resolve the underlying problem** (refactor, types, tests, safer APIs) so the tool stays green **without** hiding the signal.
- **Avoid inline suppression by default.** Do not add `eslint-disable`, `// @ts-expect-error`, `nosemgrep`, or other line-level ignore comments merely to silence output; those tend to mask real defects and rot over time.
- **Inline ignores are a last resort.** Use them **only** when a violation is **effectively unavoidable** (documented tool bug, third-party code you cannot change, or a known false positive with no practical refactor). When you must suppress:
  - Keep the narrowest scope (single line or rule id, not whole files).
  - Add a **short comment** explaining **why** suppression is necessary and what would remove it (issue link, upstream fix, or alternative attempted).
- **Prefer config over scatter.** If a rule is consistently wrong for part of the repo, a **focused** change in project config (ESLint override, `semgrep.yml` path rule) with team-visible rationale is preferable to many scattered inline disables—still treat that as exceptional, not the default workflow.

## Cursor (IDE)

- **Indexing:** [`.cursorignore`](.cursorignore) narrows what Cursor indexes (secrets, `node_modules`, build/coverage artifacts, Playwright output, etc.). It does not replace `.gitignore` for version control.
- **Project rules:** [`.cursor/rules/`](.cursor/rules/) (`.mdc` files) — stack, quality gates, and a short no-secrets invariant. Prefer concise rules; narrative and cross-tool detail stay in this file.
- **Agent sandbox:** [`.cursor/sandbox.json`](.cursor/sandbox.json) applies to **Cursor’s agent only** (not Claude Code or Codex). Network policy is **default deny** with an allowlist aligned with [`.claude/settings.json`](.claude/settings.json) `sandbox.network.allowedDomains`.

| Host pattern              | Purpose                            |
| ------------------------- | ---------------------------------- |
| `registry.npmjs.org`      | pnpm/npm package installs          |
| `registry.yarnpkg.com`    | Yarn compatibility                 |
| `*.github.com`            | GitHub API, git HTTPS, releases    |
| `*.githubusercontent.com` | Raw assets from GitHub             |
| `*.googleapis.com`        | Google API clients used by tooling |

When adding a host (for example a private registry), update **both** [`.cursor/sandbox.json`](.cursor/sandbox.json) and Claude’s `sandbox.network.allowedDomains` in [`.claude/settings.json`](.claude/settings.json), and add a row to this table.

- **UI settings (not in repo):** Cursor Settings cover Privacy mode, trusted workspace, and agent/terminal approval. Document org expectations in an internal runbook where needed.

### Cursor Team / Enterprise (optional)

If the org uses Cursor business features, use the **admin dashboard** for org-wide defaults (for example SSO and usage policies). Project files in this repo still apply when developers open the workspace; org-level controls are configured in Cursor’s admin experience (see [Cursor documentation](https://docs.cursor.com)). Coordinate with IT/compliance alongside [Enterprise / managed policy](#enterprise--managed-policy-optional) for Claude Code.

## Claude Code (CLI / IDE)

- **Project settings:** [`.claude/settings.json`](.claude/settings.json) — team-shared defaults (permissions, sandbox, plugins). Uses the [Claude Code settings schema](https://json.schemastore.org/claude-code-settings.json) for editor validation.
- **Local overrides:** `.claude/settings.local.json` — machine-only preferences (gitignored). Precedence: local overrides project; see [configuration scopes](https://docs.anthropic.com/en/docs/claude-code/settings#configuration-scopes).
- **Verify what is active:** Run `/status` in Claude Code to see managed / user / project / local sources and catch JSON errors ([verify active settings](https://docs.anthropic.com/en/docs/claude-code/settings#verify-active-settings)).
- **Cursor vs Claude Code:** [`.cursor/sandbox.json`](.cursor/sandbox.json) applies to Cursor’s agent sandbox only; it does not change Claude Code. Keep egress allowlists aligned when you change registry or GitHub access in either file (see [Cursor (IDE)](#cursor-ide) for the allowlist table).
- **Diagrams (draw.io):** Native `.drawio` (mxGraphModel) and optional draw.io Desktop CLI export — [`.claude/skills/drawio-cli/SKILL.md`](.claude/skills/drawio-cli/SKILL.md).
- **Architecture Decision Records:** Records live in [`docs/adr/`](docs/adr/). Authoring and granularity rules: [`.claude/skills/manage-adr/SKILL.md`](.claude/skills/manage-adr/SKILL.md) (canonical copy in-repo). Drift checks: [`.claude/commands/mend-adr.md`](.claude/commands/mend-adr.md) (intent-first; avoid duplicating config paths into ADRs). New ADR skeleton: [`docs/adr/template.md`](docs/adr/template.md).

### Plugins (this repo)

Official plugins enabled in [`.claude/settings.json`](.claude/settings.json):

| Plugin              | Role                          |
| ------------------- | ----------------------------- |
| `code-review`       | Review-focused workflows      |
| `code-simplifier`   | Refactoring / simplification  |
| `feature-dev`       | Feature development helpers   |
| `frontend-design`   | UI/frontend guidance          |
| `security-guidance` | Security-oriented suggestions |
| `skill-creator`     | Authoring skills              |
| `typescript-lsp`    | TypeScript LSP integration    |

Disable any you do not need in `enabledPlugins` to reduce surface area.

### MCP

There is **no** project-level `.mcp.json` in this repository. User-level MCP servers still apply from your Claude Code user config; for org-wide allow/deny of MCP, use [managed MCP](https://docs.anthropic.com/en/mcp#managed-mcp-configuration) when required.

### Enterprise / managed policy (optional)

If IT must enforce non-overridable rules (permissions, domains, MCP, marketplaces), use **managed** delivery: server-managed settings, MDM/OS policy, or `managed-settings.json` as described in [Claude Code settings](https://docs.anthropic.com/en/docs/claude-code/settings) and [managed-only settings](https://docs.anthropic.com/en/permissions#managed-only-settings). Pilot before broad rollout.

## Commands

- **Codex CLI:** Project defaults live in [`.codex/config.toml`](.codex/config.toml). Codex loads that file only when the project is **trusted**; otherwise it uses your user config ([Config basics](https://developers.openai.com/codex/config-basic)).
- **Dead code (Knip):** `pnpm knip` (optional fix: `pnpm knip:fix`, review diffs). Uses workspace entry points in [`knip.json`](knip.json).
- **Web dev server:** `pnpm dev:web` (runs `pnpm --filter @dbt-tools/web dev`)
- **E2E tests:** `pnpm test:e2e` (runs `pnpm --filter @dbt-tools/web test:e2e`). Run after meaningful UI or user-flow changes
- **Build web:** `pnpm --filter @dbt-tools/web build`
- **Publish `dbt-artifacts-parser` (npm):** GitHub Actions workflow [`.github/workflows/publish-dbt-artifacts-parser.yml`](.github/workflows/publish-dbt-artifacts-parser.yml) (release published or `workflow_dispatch`). Requires `NPM_TOKEN` with publish access to the unscoped package.
- **Publish `@dbt-tools/*` (npm):** Workflow [`.github/workflows/publish-dbt-tools.yml`](.github/workflows/publish-dbt-tools.yml) publishes `@dbt-tools/core`, `@dbt-tools/cli`, and `@dbt-tools/web` in that order. **Prerequisite (Option A):** the `dbt-artifacts-parser` version in this repo must **already exist on npm**—run the parser publish workflow first (or publish the parser manually) so workspace dependencies rewrite to a published version. Use the same `NPM_TOKEN` if the token can publish both the unscoped parser and the `@dbt-tools` scope. After changing versions, trigger via GitHub **Release** (published) or **`workflow_dispatch`** for a dry run before relying on releases.

## Frontend-specific guidance

For stack details, UI tone (product/analyzer UI), and verification expectations for Codex, see [`.codex/skills/frontend-skill/SKILL.md`](.codex/skills/frontend-skill/SKILL.md).

Optionally install OpenAI’s `frontend-skill` in the Codex app for composition and motion defaults; repository facts and commands in this file and the skill take precedence.

## Learned User Preferences

- Architecture Decision Records should center on **decisions** (options, trade-offs, invariants, boundaries), not exhaustive file paths, line-level wiring, or duplicated configuration and token tables; use at most a thin pointer when disambiguation is needed. Drift workflows such as **mend-adr** should target **intent-level** claims, not volatile path churn. Granular detail belongs in code, tests, and this file.
- Documentation for **published** `@dbt-tools/web` should be **npm-first** (`npx`, `dbt-tools-web` binary): lead with end-user install/run, push monorepo and contributor detail to later README sections, [`CONTRIBUTING.md`](CONTRIBUTING.md), and the long-form guide [`docs/user-guide-dbt-tools-web.md`](docs/user-guide-dbt-tools-web.md).

## Learned Workspace Facts

- Scaling `@dbt-tools/web` to enormous manifests depends critically on `@dbt-tools/core` snapshot construction and payload size, not only on React rendering; the codebase uses bounded dependency previews, direct-neighbor counts (with matching UI labels), lazy SQL via the analysis worker protocol, a virtualized explorer, and worker-assisted resource search for global queries; see [`docs/adr/0027-large-manifest-web-performance-dependency-index-and-lazy-sql.md`](docs/adr/0027-large-manifest-web-performance-dependency-index-and-lazy-sql.md).
- The `@dbt-tools/web` package runs a production build before Playwright in its `test:e2e` script; root `pnpm test:e2e` therefore builds the web app so preview mode has `dist/`.
- Implementations typed against graph interfaces used during snapshot construction should mirror `ManifestGraph` call signatures (for example optional `maxDepth` on `getUpstream` / `getDownstream`) so `tsc` passes when the E2E script triggers a build.
- In Playwright specs, interpolating dynamic strings (for example dbt unique IDs) into `new RegExp(...)` should use full regex metacharacter escaping (such as a small local `escapeRegExp` helper) or assert query values via `URL` / `searchParams`; dot-only escaping can trigger CodeQL “Incomplete string escaping or encoding.”
- **Published** `@dbt-tools/web` is invoked by end users as `npx @dbt-tools/web` (npm `bin` name `dbt-tools-web`, entry `dist-serve/server/cli.js`); `prepack` runs the package build before publish. Monorepo development stays `pnpm dev:web` / package `dev` scripts.
- Root [`vitest.config.mjs`](vitest.config.mjs) uses `resolve.alias` for `dbt-artifacts-parser` subpaths imported from source in tests (`manifest`, `run_results`, `catalog`, `test-utils`); add a matching alias if new test imports use another published subpath. Knip may need `@dbt-tools/core` **built** (`dist/` present) because the web Vite config references it.
