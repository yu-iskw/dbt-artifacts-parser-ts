@AGENTS.md

<!-- AGENTS.md is canonical for every coding agent. Put only Claude Code–specific notes below. -->

## Claude Code

| Item                                                                                       | Purpose                                                        |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| [`.claude/skills/dbt-parser-refresh/SKILL.md`](.claude/skills/dbt-parser-refresh/SKILL.md) | Regenerate parser TypeScript types from artifact JSON schemas. |
| [`.claude/agents/verifier.md`](.claude/agents/verifier.md)                                 | Full verification orchestration prompt.                        |

When multiple agents run concurrently, avoid overlapping writes. Do not invoke the verifier while another worker has uncommitted edits on files it may normalize or format.
