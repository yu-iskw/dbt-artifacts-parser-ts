# Agent instructions (dbt-artifacts-parser-ts)

## Scope

This repository owns the `dbt-artifacts-parser` TypeScript package only. It parses dbt artifact JSON with generated types, version-aware entry points, and test fixtures. Product/UI/CLI packages live outside this repository.

## Tech stack

- Package manager: `pnpm` workspace.
- Node.js: use [`.node-version`](.node-version).
- Package: [`packages/dbt-artifacts-parser`](packages/dbt-artifacts-parser).
- Tests: Vitest from the repository root.

## Commands

```bash
pnpm install
pnpm build
pnpm test
pnpm lint:report
pnpm knip
pnpm coverage:report
pnpm lint
```

## Quality gates

Before claiming parser work complete, run `pnpm test`, `pnpm lint:report`, `pnpm knip`, and `pnpm coverage:report`. Run `pnpm build` when generated types, package exports, package metadata, or shared TypeScript configuration changes. Run full `pnpm lint` when Markdown, YAML, Trunk config, or broad formatting-sensitive files change.

Coverage thresholds are lines 60%, branches 50%, functions 60%, and statements 60%. Fix root causes for lint/static-analysis findings; inline suppressions are a last resort and must be narrow and justified.

## Parser type refresh

Use [`.claude/skills/dbt-parser-refresh/SKILL.md`](.claude/skills/dbt-parser-refresh/SKILL.md) when regenerating parser types from dbt artifact schemas. Generated parser resources live under [`packages/dbt-artifacts-parser/resources`](packages/dbt-artifacts-parser/resources).

## ADRs

Architecture records live in [`docs/adr`](docs/adr). Keep ADRs decision-focused; volatile file inventories belong in code, tests, or this file.

## Secrets

Do not commit API keys, tokens, passwords, or local credentials. Reference environment variable names only.
