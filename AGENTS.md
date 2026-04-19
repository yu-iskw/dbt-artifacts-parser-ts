# Agent instructions (dbt-artifacts-parser-ts)

## Agent documentation split

- **This file (`AGENTS.md`) is canonical** for humans and all agent tools (Cursor, Codex, Claude Code, and similar): stack, packages, full quality gates, commands, and policy detail.
- **[`CLAUDE.md`](CLAUDE.md)** is a **Claude Code entry digest**: pointers here, a few repeated high-signal invariants, and **Claude-only** workflow (for example [`.claude/settings.json`](.claude/settings.json), session prerequisites, multi-agent coordination). It is **not** a full duplicate of this file.
- **Single authority:** If anything disagrees, **this file wins**; update `CLAUDE.md` (or replace duplicated prose with a link to the relevant section here).
- **Edit workflow:** When you change **shared agent policy** (quality gate commands, thresholds, when to run Playwright, verifier expectations, doc-only gate rules), edit **this file first**, then update any short repeated lines in `CLAUDE.md` only if they still duplicate that fact.

## Tech stack

- **Package manager:** pnpm (monorepo)
- **Node.js:** use the version in [`.node-version`](.node-version) for local development and CI (authoritative). Published packages declare **`engines.node` ≥ 20**; Node 18 is EOL — see [Node.js releases](https://nodejs.org/en/about/previous-releases).
- **Language:** TypeScript; unit tests use Vitest from the repository root

## Frontend application

- **Positioning:** dbt-tools is a **dbt operational intelligence layer**; `@dbt-tools/web` is the **deterministic** investigation UI (artifact-driven; no LLM required for core value). See [ADR-0008](docs/adr/0008-dbt-tools-operational-intelligence-and-positioning-boundaries.md).
- **Package:** `@dbt-tools/web`
- **Path:** [`packages/dbt-tools/web`](packages/dbt-tools/web)
- **Stack:** Vite, React, Recharts, `@tanstack/react-virtual`; depends on workspace packages `@dbt-tools/core` and `dbt-artifacts-parser`
- **E2E:** Playwright specs under [`packages/dbt-tools/web/e2e/`](packages/dbt-tools/web/e2e/). For authoring or extending specs (selectors, fixtures, preview constraints), see [`.agents/skills/dbt-tools-web-e2e/SKILL.md`](.agents/skills/dbt-tools-web-e2e/SKILL.md). To run `pnpm test:e2e` and fix failing Playwright tests, see [`.agents/skills/dbt-tools-web-e2e-fix/SKILL.md`](.agents/skills/dbt-tools-web-e2e-fix/SKILL.md) (Claude copy: [`.claude/skills/dbt-tools-web-e2e-fix/SKILL.md`](.claude/skills/dbt-tools-web-e2e-fix/SKILL.md)).
- **Pack + `npx` smoke (published layout):** verify `pnpm pack` + `dbt-tools-web` via `npx` without npm publish — [`.agents/skills/dbt-tools-web-pack-npx-smoke/SKILL.md`](.agents/skills/dbt-tools-web-pack-npx-smoke/SKILL.md) (Claude copy: [`.claude/skills/dbt-tools-web-pack-npx-smoke/SKILL.md`](.claude/skills/dbt-tools-web-pack-npx-smoke/SKILL.md)). The **verifier** subagent runs this after `pnpm build`; CI runs **`scripts/smoke-npx-with-verdaccio.sh`** in **`web-pack-npx-smoke`** ([`.github/workflows/test.yml`](.github/workflows/test.yml)) so workspace peers resolve from a local registry before the tarball `npx` smoke.
- **Source layout (`packages/dbt-tools/web/src`):**
  - [`lib/analysis-workspace/`](packages/dbt-tools/web/src/lib/analysis-workspace/) — pure TypeScript (tree, lineage, overview helpers) and colocated `*.test.ts`; use `@web/types` for shared app types.
  - [`components/AnalysisWorkspace/`](packages/dbt-tools/web/src/components/AnalysisWorkspace/) — analyzer UI (import the package via `./components/AnalysisWorkspace`, which resolves to [`index.tsx`](packages/dbt-tools/web/src/components/AnalysisWorkspace/index.tsx)): [`views/`](packages/dbt-tools/web/src/components/AnalysisWorkspace/views/) (feature folders `health/`, `runs/`, `inventory/`, shared `overview/` and `assets`), [`timeline/`](packages/dbt-tools/web/src/components/AnalysisWorkspace/timeline/) (Gantt; **must include dbt `source` nodes**, including rows synthesized in `@dbt-tools/core` snapshot construction when `run_results` has no timed source entries — [ADR-0006](docs/adr/0006-timeline-includes-dbt-sources-via-snapshot-synthesis.md)), explorer, lineage graph (Inventory **Lineage** tab + `assetTab=lineage`; legacy `?view=lineage` / `?view=dependencies` redirect there), [`shared.tsx`](packages/dbt-tools/web/src/components/AnalysisWorkspace/shared.tsx).
  - [`components/ui/`](packages/dbt-tools/web/src/components/ui/) — generic primitives (e.g. Spinner, Toast, Skeleton).
  - **Remote artifact sources (S3 / GCS):** [`packages/dbt-tools/web/src/artifact-source/`](packages/dbt-tools/web/src/artifact-source/) — Vite middleware resolves runs from `DBT_TOOLS_REMOTE_SOURCE` (JSON parsed via `@dbt-tools/core` [`getDbtToolsRemoteSourceConfigFromEnv`](packages/dbt-tools/core/src/config/dbt-tools-env.ts)); browser client [`artifactSourceApi.ts`](packages/dbt-tools/web/src/services/artifactSourceApi.ts); decision [ADR-0004](docs/adr/0004-remote-object-storage-artifact-sources-and-auto-reload.md).
- **Path alias `@web`:** maps to `src/` for this package ([`tsconfig.json`](packages/dbt-tools/web/tsconfig.json), [`vite.config.ts`](packages/dbt-tools/web/vite.config.ts)). Root [`vitest.config.mjs`](vitest.config.mjs) defines the same alias so monorepo `pnpm test` resolves `@web/...` — keep these in sync if the alias changes.
- **`@dbt-tools/core` vs `core/browser`:** Use `@dbt-tools/core/browser` in workers and anywhere that must stay free of Node built-ins. The full `@dbt-tools/core` entry is for Vite/Node-only code (`artifact-source/`, `dbt-target-plugin.ts`). ESLint encodes this for workers, hooks, and components ([`eslint.config.mjs`](eslint.config.mjs)).

### Design tokens and styling

- **Token source of truth:** [`packages/dbt-tools/web/src/styles/tokens.css`](packages/dbt-tools/web/src/styles/tokens.css) — colors (light + dark), spacing scale (`--space-*`), typography scale (`--text-*`, `--leading-*`, `--font-*`), radii, shadows. See [`.cursor/rules/design-tokens.mdc`](.cursor/rules/design-tokens.mdc) for the quick-reference table.
- **TS mirror:** `constants/themeColors.generated.ts` is **auto-generated** by `pnpm tokens:sync`; never edit manually. CI runs `pnpm tokens:check` to detect drift.
- **Stylelint:** `stylelint-declaration-strict-value` enforces `var(--*)` for color and radius properties. Run `pnpm lint:stylelint` after CSS changes (not covered by `pnpm lint:report`).
- **Legacy aliases** (`--text`, `--bg`, `--panel`, `--mint`, `--rose`, `--amber`): kept for backward compatibility; do not use in new code — use semantic names (`--text-primary`, `--bg-canvas`, etc.).
- **Import order contract:** `tokens.css` → `base.css` → `app-shell.css` → `ui-primitives.css` → `lineage-graph.css` → `workspace.css`. Do not reorder without cascade regression check.

## Quality gates (before claiming work complete)

From the repository root:

- `pnpm lint:report` — writes `lint-report.json`; must exit 0. **ESLint only** (via [`scripts/eslint-score.mjs`](scripts/eslint-score.mjs)); it does **not** run Trunk linters such as markdownlint. **Trunk** (markdownlint, actionlint, yamllint, etc.) runs via **`pnpm lint:trunk`** / **`pnpm lint`** — see **Commands** — **Trunk (lint/format orchestration)** below.
- `pnpm coverage:report` — writes `coverage-report.json`; must exit 0. If coverage is below thresholds, add or improve unit tests (lines 60%, branches 50%, functions 60%, statements 60%)
- **Vitest + v8 coverage stability:** `pnpm coverage:report` runs Vitest via [`scripts/coverage-score.mjs`](scripts/coverage-score.mjs) with [`vitest.coverage.mjs`](vitest.coverage.mjs), which sets **`maxWorkers: 1`** (Vitest 4 top-level pool control) so the coverage harness avoids multi-worker parallelism that can trigger intermittent **SIGSEGV** with `@vitest/coverage-v8`. Regular **`pnpm test`** still uses the default settings in [`vitest.config.mjs`](vitest.config.mjs). If coverage still crashes after a retry, capture **Node version** (see [`.node-version`](.node-version)), **OS**, and any **native stack** from the crash; try adding **`fileParallelism: false`** next to `maxWorkers` in [`vitest.coverage.mjs`](vitest.coverage.mjs), or temporarily switch the coverage-only config to **`pool: "forks"`** with **`maxWorkers: 1`** (keep the same coverage `include` / `exclude` / thresholds), and report upstream (Vitest / Node issue).
- `pnpm knip` — unused exports/files/deps (monorepo); must exit 0. Configuration: [`knip.json`](knip.json). `ignoreExportsUsedInFile` is enabled; parser package ignores noisy `types` issues; `scripts/preprocess-refs.js` and the `@apidevtools/json-schema-ref-parser` devDependency are scoped to generation scripts (see `ignoreFiles` / `ignoreDependencies`).
- **`pnpm coverage:report` does not run Playwright** — it runs **Vitest** with coverage via [`vitest.coverage.mjs`](vitest.coverage.mjs) (see **Vitest + v8 coverage stability** below). Browser journeys are a separate gate.
- **Playwright when web journeys or E2E specs change:** if the change touches [`packages/dbt-tools/web/e2e/`](packages/dbt-tools/web/e2e/) or **material `@dbt-tools/web` user flows** (settings, artifact load, workspace navigation, and similar), also run **`pnpm test:e2e`** from the repository root before claiming the work complete (same script as **Commands** — **E2E tests** below).

### Documentation-only and agent-skills edits

- **Documentation-only** changes (for example `*.md`, `.claude/**`, `.cursor/rules/**`, or `docs/**` when you do not change executable code, build config, or scripts) **do not** waive **`pnpm lint:report`**, **`pnpm knip`**, or **`pnpm coverage:report`** for **agent completion claims**—run all three from the repository root like any other task.
- **Only the user** may explicitly narrow which gates apply (for example “lint only”); agents should treat that as **exceptional** and default to the **full trio** unless the user clearly relaxes scope.
- **`pnpm coverage:report`** stays **repo-wide** and is typically **slower** than **`pnpm test`** alone (see **Vitest + v8 coverage stability** above); doc-only work does not change that contract.

- Full **`pnpm format`**, **`pnpm lint`**, and **`pnpm verify:normalize`** run Trunk before ESLint / Prettier / Stylelint / Knip; see **Commands** — **Trunk (lint/format orchestration)** below.
- **Verifier subagent** ([`.claude/agents/verifier.md`](.claude/agents/verifier.md)): orchestrates gates and **delegates** fix loops to the skills listed in that file’s YAML (`build-fix`, `lint-fix`, `codeql-fix`, `test-fix`, `dbt-tools-web-pack-npx-smoke`). A full verification run always ends with `pnpm format` and `pnpm lint` (same as `pnpm verify:normalize`). If that leaves the working tree dirty, follow the agent’s **stability loop**: re-run `pnpm lint:report`, `pnpm test`, and `pnpm coverage:report` (up to three passes), re-applying normalization until clean or the cap is hit. For a **clean working tree** and **single-writer** context, the verifier doc also describes an optional **normalize first, then steps 1–6** variant (diagrams and checklist under **Optional variant — normalize first**).
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
- **Architecture Decision Records:** Records live in [`docs/adr/`](docs/adr/). Authoring and granularity rules: [`.claude/skills/manage-adr/SKILL.md`](.claude/skills/manage-adr/SKILL.md) (canonical copy in-repo). Drift checks: [`.claude/commands/mend-adr.md`](.claude/commands/mend-adr.md) (intent-first; avoid duplicating config paths into ADRs). New ADR skeleton: [`.claude/skills/manage-adr/assets/template.md`](.claude/skills/manage-adr/assets/template.md).
- **Session postmortem (optional):** End-of-session structured retro; output stays in chat unless the user asks for follow-up edits — [`.claude/skills/postmortem/SKILL.md`](.claude/skills/postmortem/SKILL.md).

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
- **Trunk (lint/format orchestration):** The root dev dependency `@trunkio/launcher` matches [Trunk’s documented pnpm install](https://docs.trunk.io/code-quality/overview/cli/getting-started/install) (`pnpm add -D @trunkio/launcher`) and supplies `trunk` on `PATH` for `pnpm run` / `pnpm exec` after `pnpm install`. **`pnpm format`** and **`pnpm lint`** run Trunk first (`format:trunk`, `lint:trunk`); **`pnpm trunk`** passes through to the CLI (Trunk's documented pattern). If Trunk cannot run, use **`pnpm format:without-trunk`** / **`pnpm lint:without-trunk`**. Config and CLI version: [`.trunk/trunk.yaml`](.trunk/trunk.yaml). CI: [`.github/workflows/trunk_check.yml`](.github/workflows/trunk_check.yml) (`trunk-io/trunk-action`). Prerequisites detail: [CONTRIBUTING.md](CONTRIBUTING.md).
- **Web dev server:** `pnpm dev:web` (runs `pnpm --filter @dbt-tools/web dev`)
- **E2E tests:** `pnpm test:e2e` (runs `pnpm --filter @dbt-tools/web test:e2e`). Run after meaningful UI or user-flow changes
- **Build web:** `pnpm --filter @dbt-tools/web build`
- **Publish `dbt-artifacts-parser` (npm):** GitHub Actions [`.github/workflows/publish-dbt-artifacts-parser.yml`](.github/workflows/publish-dbt-artifacts-parser.yml) (release published or `workflow_dispatch`). **Auth:** [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC); no `NPM_TOKEN` in the workflow. Maintainer context: [ADR-0009](docs/adr/0009-npm-releases-authenticate-via-github-actions-oidc-trusted-publishing.md).
- **Publish `@dbt-tools/*` (npm):** [`.github/workflows/publish-dbt-tools.yml`](.github/workflows/publish-dbt-tools.yml) publishes `@dbt-tools/core`, `@dbt-tools/cli`, and `@dbt-tools/web` in that order (same OIDC model). **Prerequisite:** the `dbt-artifacts-parser` version in this repo must **already exist on npm**—run the parser publish workflow first (or publish the parser manually) so workspace dependencies rewrite to a published version. On npmjs, each package’s **trusted publisher** workflow filename must match **either** `publish-dbt-artifacts-parser.yml` **or** `publish-dbt-tools.yml`, depending on which workflow publishes that package (see [ADR-0009](docs/adr/0009-npm-releases-authenticate-via-github-actions-oidc-trusted-publishing.md)). After changing versions, trigger via GitHub **Release** (published) or **`workflow_dispatch`**.

## Frontend-specific guidance

For stack details, UI tone (product/analyzer UI), and verification expectations for Codex, see [`.codex/skills/frontend-skill/SKILL.md`](.codex/skills/frontend-skill/SKILL.md).

Optionally install OpenAI’s `frontend-skill` in the Codex app for composition and motion defaults; repository facts and commands in this file and the skill take precedence.

## Learned User Preferences

- Architecture Decision Records should center on **decisions** (options, trade-offs, invariants, boundaries), not exhaustive file paths, line-level wiring, or duplicated configuration and token tables; use at most a thin pointer when disambiguation is needed. Drift workflows such as **mend-adr** should target **intent-level** claims, not volatile path churn. Granular detail belongs in code, tests, and this file.
- Documentation for **published** `@dbt-tools/web` should be **npm-first** (`npx`, `dbt-tools-web` binary): lead with end-user install/run, push monorepo and contributor detail to later README sections of [`packages/dbt-tools/web/README.md`](packages/dbt-tools/web/README.md), plus [`CONTRIBUTING.md`](CONTRIBUTING.md) (no separate long-form web user guide at repo root).
- For substantial UI or cross-surface workflow work, the user often asks for a **detailed plan with diagrams** (flow or architecture) before implementation.

## Learned Workspace Facts

- Artifact loading is oriented around **directory/prefix discovery** (not only per-file picking), with the **web app and CLI aligned** on the same resolution model; implementation spans `@dbt-tools/core` artifact I/O/discovery and `@dbt-tools/web` `artifact-source/` plus CLI resolve paths.
- Scaling `@dbt-tools/web` to enormous manifests depends critically on `@dbt-tools/core` snapshot construction and payload size, not only on React rendering; the codebase uses bounded dependency previews, direct-neighbor counts (with matching UI labels), lazy SQL via the analysis worker protocol, a virtualized explorer, and worker-assisted resource search for global queries; see [`docs/adr/0003-large-manifest-web-performance-dependency-index-and-lazy-sql.md`](docs/adr/0003-large-manifest-web-performance-dependency-index-and-lazy-sql.md).
- The `@dbt-tools/web` package runs a production build before Playwright in its `test:e2e` script; root `pnpm test:e2e` therefore builds the web app so preview mode has `dist/`.
- Implementations typed against graph interfaces used during snapshot construction should mirror `ManifestGraph` call signatures (for example optional `maxDepth` on `getUpstream` / `getDownstream`) so `tsc` passes when the E2E script triggers a build.
- In Playwright specs, interpolating dynamic strings (for example dbt unique IDs) into `new RegExp(...)` should use full regex metacharacter escaping (such as a small local `escapeRegExp` helper) or assert query values via `URL` / `searchParams`; dot-only escaping can trigger CodeQL “Incomplete string escaping or encoding.”
- **Published** `@dbt-tools/web` is invoked by end users as `npx @dbt-tools/web` (npm `bin` name `dbt-tools-web`, entry `dist-serve/server/cli.js`); `prepack` runs the package build before publish. Monorepo development stays `pnpm dev:web` / package `dev` scripts.
- Root [`vitest.config.mjs`](vitest.config.mjs) uses `resolve.alias` for `dbt-artifacts-parser` subpaths imported from source in tests (`manifest`, `run_results`, `catalog`, `test-utils`); add a matching alias if new test imports use another published subpath. Knip may need `@dbt-tools/core` **built** (`dist/` present) because the web Vite config references it.
