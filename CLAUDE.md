# Claude Code — project context

## Canonical instructions

Full stack layout, web app structure, publish workflows, and cross-tool notes (Cursor, Codex, commands) live in **[AGENTS.md](AGENTS.md)**. Read it when you need detail beyond this file.

## Environment

- **Package manager:** `pnpm` (monorepo).
- **Node.js:** version in [`.node-version`](.node-version) (authoritative for local/tooling).
- **Trunk:** After `pnpm install`, `@trunkio/launcher` provides the `trunk` CLI. Full **`pnpm format`** / **`pnpm lint`** (and `pnpm verify:normalize`) run Trunk first—see [AGENTS.md](AGENTS.md) **Commands** (Trunk) and [CONTRIBUTING.md](CONTRIBUTING.md) prerequisites.

## Quality gates (before claiming work complete)

From the repository root:

1. **`pnpm lint:report`** — must exit 0 (writes `lint-report.json`).
2. **`pnpm coverage:report`** — must exit 0 (writes `coverage-report.json`). If coverage is below thresholds, add or improve unit tests until it passes.
3. **`pnpm knip`** — must exit 0 (dead code / unused deps; see `knip.json`).

Thresholds: lines 60%, branches 50%, functions 60%, statements 60%.

**Violations:** Fix root causes first; avoid inline linter/SAST suppressions unless technically unavoidable, with the narrowest scope and a short justification. Full policy: [AGENTS.md](AGENTS.md) (Quality gates — **Linter and static-analysis violations (agent default)**).

Same expectations are documented in [`.cursor/rules/coverage-and-lint-reports.mdc`](.cursor/rules/coverage-and-lint-reports.mdc) and [AGENTS.md](AGENTS.md).

## Secrets and AI context

Do **not** commit API keys, tokens, or passwords into rules, `AGENTS.md`, prompts, or tracked config. Reference environment variable **names** only (for example `NPM_TOKEN`, `NODE_AUTH_TOKEN`), never values. See [`.cursor/rules/no-secrets-in-ai-context.mdc`](.cursor/rules/no-secrets-in-ai-context.mdc).

## Claude Code configuration (this repo)

| Item                                             | Purpose                                                                                         |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| [`.claude/settings.json`](.claude/settings.json) | Team-shared defaults: permissions, sandbox, network allowlist, plugins.                         |
| `.claude/settings.local.json`                    | Machine-only overrides (gitignored). Precedence: local over project.                            |
| [`.claude/skills/`](.claude/skills/)             | Project skills (build-fix, lint-fix, test-fix, codeql-fix, dbt-tools-web-pack-npx-smoke, etc.). |
| [`.claude/agents/`](.claude/agents/)             | Subagents (e.g. verifier).                                                                      |

Run **`/status`** in Claude Code to see which settings layers are active and to catch JSON errors ([settings scopes](https://docs.anthropic.com/en/docs/claude-code/settings#configuration-scopes)).

**Sandbox:** This file does not change Cursor’s agent sandbox; [`.cursor/sandbox.json`](.cursor/sandbox.json) applies to Cursor only. Keep registry/GitHub egress allowlists aligned with `.claude/settings.json` when you change network policy (see AGENTS.md).

## Plugins

Official plugins enabled for this project are listed in `.claude/settings.json` under `enabledPlugins` and summarized in [AGENTS.md](AGENTS.md).
