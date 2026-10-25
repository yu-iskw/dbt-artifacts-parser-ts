# Agent instructions (dbt-artifacts-parser-ts)

## Scope

This repository owns the `dbt-artifacts-parser` TypeScript package only. It parses dbt artifact JSON with generated types, version-aware entry points, and test fixtures. Product/UI/CLI packages live outside this repository.

## When documentation and code disagree

When a repository's documentation and its existing code disagree, follow the conventions used in the existing code, and in your final reply point out each inconsistency you found between the documentation and the code.

"Documentation" includes this file, `CLAUDE.md`, editor rules, READMEs, `docs/`, ADRs, RFCs, and code comments. Treat what they say about the code as claims to check against the code, not as facts.

- **Documented target state wins only when it is explicit.** Follow the documentation instead of the code only when the documentation says the code is legacy or a migration is in progress. For example: a "migration in progress", "legacy", or "deprecated" marker, `@deprecated` on the code you would copy, or an ADR/RFC with status _Accepted_ that is not superseded and is newer than the code it replaces. Ignore ADRs/RFCs that are _Proposed_, _Rejected_, _Deprecated_, or _Superseded_. Follow the superseding one.
- **When you can't tell which is current,** compare recency (`git log -1 --format=%cs -- <doc>` vs the code paths). Prefer the newer source, and say that you did. If the choice changes behavior and is still unclear, ask before proceeding.
- **Scope.** Apply the convention you choose to the code you are writing or changing. Don't rewrite working code, and don't edit documentation just to make the two agree, unless the task asks for it.
- **Process and safety rules still apply.** Commands to run, quality gates, review/merge rules, and security constraints in this file are not descriptions of the code. Follow them.
- **Report.** In your final reply (and in the PR description, if you open one), list each inconsistency: the document and section, what the code actually does, which one you followed, and why.

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
