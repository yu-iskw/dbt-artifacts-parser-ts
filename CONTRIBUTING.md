# Contributing

## Setup

```bash
pnpm install
```

## Common commands

```bash
pnpm build
pnpm test
pnpm lint:report
pnpm knip
pnpm coverage:report
pnpm lint
```

## Parser changes

The package source is [`packages/dbt-artifacts-parser`](packages/dbt-artifacts-parser). When updating artifact schemas or generated types, follow [`.claude/skills/dbt-parser-refresh/SKILL.md`](.claude/skills/dbt-parser-refresh/SKILL.md).
