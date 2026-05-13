# Claude Code — project context

[`AGENTS.md`](AGENTS.md) is canonical for this repository. If this file and `AGENTS.md` disagree, `AGENTS.md` wins.

## Environment

- Package manager: `pnpm` workspace.
- Node.js: version in [`.node-version`](.node-version).
- Package: `dbt-artifacts-parser` in [`packages/dbt-artifacts-parser`](packages/dbt-artifacts-parser).

## Quality gates

Use `AGENTS.md` for the full ordered gate policy. High-signal commands are:

```bash
pnpm test
pnpm lint:report
pnpm knip
pnpm coverage:report
pnpm build
```

## Claude Code resources

| Item                                                                                       | Purpose                                                        |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| [`.claude/skills/dbt-parser-refresh/SKILL.md`](.claude/skills/dbt-parser-refresh/SKILL.md) | Regenerate parser TypeScript types from artifact JSON schemas. |
| [`.claude/agents/verifier.md`](.claude/agents/verifier.md)                                 | Full verification orchestration prompt.                        |

## Coordination

When multiple agents run concurrently, avoid overlapping writes. Do not invoke the verifier while another worker has uncommitted edits on files it may normalize or format.
