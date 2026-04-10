# Claude Code — project context

## Canonical instructions

Full stack layout, web app structure, publish workflows, and cross-tool notes (Cursor, Codex, commands) live in **[AGENTS.md](AGENTS.md)**. Read it when you need detail beyond this file.

## Environment

- **Package manager:** `pnpm` (monorepo).
- **Node.js:** version in [`.node-version`](.node-version) (authoritative for local/tooling).

## Fresh environment startup checklist

When starting work in a new cloud environment, run:

```bash
bash scripts/bootstrap-ci-tools.sh
```

This script:
- Verifies Node.js version and installs `pnpm` if missing (hard failure if install fails)
- Installs `trunk` CLI if missing (hard failure if install fails)
- Runs `trunk install` to download runtimes and tool versions
- Detects `codeql` availability (warning only; not a failure if missing)

See [AGENTS.md — Cloud agent bootstrap workflow](AGENTS.md#cloud-agent-bootstrap-workflow) for detailed behavior and fallback commands.

## Missing tool policy

| Tool | Missing behavior | Impact |
|------|------------------|--------|
| `pnpm` | Hard failure; bootstrap installs via npm | Cannot proceed without it |
| `trunk` | Hard failure; bootstrap installs via npm | Cannot proceed without it |
| `codeql` | Warning only | Only blocks CodeQL-specific tasks (see policy below) |
| `corepack` | Warning; bootstrap continues | Rarely needed; pnpm can install via npm |

## Default command order (typical code changes)

1. **Bootstrap (fresh environment only):** `bash scripts/bootstrap-ci-tools.sh`
2. **Code changes:** Edit files, create tests
3. **Format:** `pnpm format` (or `pnpm format:without-trunk` if trunk unavailable)
4. **Lint:** `pnpm lint` (or `pnpm lint:without-trunk` if trunk unavailable)
5. **Test:** `pnpm test`
6. **Verify coverage:** `pnpm coverage:report` (must pass thresholds)
7. **Commit and push:** CodeQL is GitHub Actions only (on PRs)

## CodeQL policy

**CodeQL is NOT required for general code changes.** Missing CodeQL does NOT block:
- Feature implementation
- Bug fixes
- Refactoring
- Documentation updates

CodeQL is required only when your task explicitly involves:
- Running CodeQL workflows or SARIF generation
- Local parity checks with the GitHub Actions [`.github/workflows/codeql.yml`](.github/workflows/codeql.yml)
- Debugging CodeQL configuration or scripts

If CodeQL is unavailable and your task is non-CodeQL:
- Proceed with code changes
- Run standard quality gates (format, lint, test, coverage)
- Document environment limitation in commit message if relevant

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
