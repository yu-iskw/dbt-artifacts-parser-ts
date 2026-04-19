# Claude Code — project context

## Canonical instructions

**[AGENTS.md](AGENTS.md) is canonical** for stack layout, web app structure, publish workflows, and cross-tool notes (Cursor, Codex, commands). If this file and AGENTS disagree, **AGENTS wins**—update this digest. Read AGENTS when you need detail beyond this file (see **Agent documentation split** there).

## Environment

- **Package manager:** `pnpm` (monorepo).
- **Node.js:** version in [`.node-version`](.node-version) (authoritative for local/tooling).
- **Trunk:** After `pnpm install`, `@trunkio/launcher` provides the `trunk` CLI ([documented pnpm install](https://docs.trunk.io/code-quality/overview/cli/getting-started/install): `pnpm add -D @trunkio/launcher`). Full **`pnpm format`** / **`pnpm lint`** (and `pnpm verify:normalize`) run Trunk first—see [AGENTS.md](AGENTS.md) **Commands** (Trunk) and [CONTRIBUTING.md](CONTRIBUTING.md).

## Quality gates (before claiming work complete)

From the repository root, follow [AGENTS.md](AGENTS.md) **Quality gates** — especially **Before you call a task done (ordered)** — for the full ordered checklist (tests, `lint:report`, `knip`, `coverage:report`, when to run full lint/Trunk, `pnpm build`, `pnpm test:e2e`, optional CodeQL). The minimum **three** checks **`pnpm lint:report`**, **`pnpm coverage:report`**, and **`pnpm knip`** still apply for many tasks; **documentation-only** work, **Playwright when to run**, **coverage harness notes**, and **suppression policy** are all defined there—do not rely on this file for the full rules.

Thresholds (same as AGENTS): lines 60%, branches 50%, functions 60%, statements 60%.

Cursor mirror: [`.cursor/rules/coverage-and-lint-reports.mdc`](.cursor/rules/coverage-and-lint-reports.mdc).

## Secrets and AI context

Do **not** commit API keys, tokens, or passwords into rules, `AGENTS.md`, prompts, or tracked config. Reference environment variable **names** only (for example `NPM_TOKEN`, `NODE_AUTH_TOKEN`), never values. See [`.cursor/rules/no-secrets-in-ai-context.mdc`](.cursor/rules/no-secrets-in-ai-context.mdc).

## Claude Code configuration (this repo)

| Item                                             | Purpose                                                                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| [`.claude/settings.json`](.claude/settings.json) | Team-shared defaults: permissions, sandbox, network allowlist, plugins.                                                               |
| `.claude/settings.local.json`                    | Machine-only overrides (gitignored). Precedence: local over project.                                                                  |
| [`.claude/skills/`](.claude/skills/)             | Project skills; each skill is `*/SKILL.md` under this directory (navigational index only—**not** an exhaustive catalog in this file). |
| [`.claude/agents/`](.claude/agents/)             | Subagents (for example verifier).                                                                                                     |

Run **`/status`** in Claude Code to see which settings layers are active and to catch JSON errors ([settings scopes](https://docs.anthropic.com/en/docs/claude-code/settings#configuration-scopes)).

**Sandbox:** This file does not change Cursor’s agent sandbox; [`.cursor/sandbox.json`](.cursor/sandbox.json) applies to Cursor only. Keep registry/GitHub egress allowlists aligned with `.claude/settings.json` when you change network policy (see AGENTS.md).

## Plugins

Official plugins enabled for this project are listed in `.claude/settings.json` under `enabledPlugins` and summarized in [AGENTS.md](AGENTS.md).

## Session prerequisites

Before running any quality gate or invoking the verifier, confirm:

1. `node_modules/` is present at the repo root. If absent, run `pnpm install --frozen-lockfile` before anything else. Many tools (Trunk, ESLint, Vitest, Playwright) silently fail without it.
2. Playwright browsers are installed for `@dbt-tools/web` E2E. If `pnpm test:e2e` or the `ui-feature-verify` skill reports missing browsers, run `pnpm --filter @dbt-tools/web exec playwright install chromium --with-deps` once. CI caches `~/.cache/ms-playwright`; local machines must install once per Playwright major.

The session-start hook in `.claude/settings.json` covers the `node_modules` case automatically; browser binaries require the one-time manual step above.

## Agent coordination

When more than one agent runs concurrently, file-write conflicts waste tokens and produce incorrect commits. Follow these rules:

- **Before spawning a background agent**, note which files it may write. Do not spawn a second agent that writes the same files as the foreground agent until the first write batch is committed.
- **Explore agents** must read only. When dispatching two Explore agents, scope each to a disjoint directory set and merge their summaries before the main agent reads those files—this avoids double-reading.
- **The verifier agent** is write-capable (step 7 runs `pnpm format`). Do not start the verifier while the foreground agent has uncommitted edits. Commit or stash first.
- **Scope verification to the change.** For a UI-only change (`packages/dbt-tools/web/src/` only), use the `ui-feature-verify` skill instead of the full verifier. Reserve the full verifier (CodeQL, pack+npx smoke) for changes that touch published packages, scripts, or CI configuration.
