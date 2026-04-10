# Layout and verification (dbt-tools-cli plugin skills)

## Decision record

[ADR-0034: First-party coding agent plugins and repository verification](../../../../docs/adr/0034-first-party-coding-agent-plugins-and-repository-verification.md) — one plugin tree under `plugins/<plugin-id>/`, parallel manifests (`.claude-plugin`, `.codex-plugin`, `.cursor-plugin`), and `skills/` at the plugin root.

## Structural checks (Codex)

[`plugins/tests/verify-codex-plugins.sh`](../../../../plugins/tests/verify-codex-plugins.sh) enforces for each plugin that:

- The Codex manifest sets **`skills`** to a string path (e.g. `./skills/`).
- That directory exists.
- Every **immediate subdirectory** of `skills/` contains a **`SKILL.md`** (one skill per folder).
- There is **at least one** skill directory.

So each new workflow must be `plugins/dbt-tools-cli/skills/<id>/SKILL.md`, not a loose file under `skills/`.

## Orchestrator

[`plugins/tests/verify-agent-plugins.sh`](../../../../plugins/tests/verify-agent-plugins.sh) runs **structural** verification (marketplaces, manifests, skills layout) and optional vendor `plugin validate` phases. From the repo root:

```bash
./plugins/tests/verify-agent-plugins.sh structural
```

Operational detail and Docker image: [`plugins/CONTRIBUTING.md`](../../../../plugins/CONTRIBUTING.md).

## What structural does not replace

After adding or editing skills, still run the repository quality gates from the root:

```bash
pnpm lint:report
pnpm coverage:report
pnpm knip
```

Markdown-only changes usually do not affect coverage; keep the suite green before merging.
