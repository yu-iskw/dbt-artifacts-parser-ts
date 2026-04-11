---
name: postmortem
description: Use at the end of a coding session to summarize outcomes, failures, inefficiencies, and root causes, then output a concise postmortem report with ranked improvements for next time. Output only in chat; do not edit project files unless the user explicitly asks. Skip nit-picks and one-off mistakes.
compatibility: Claude Code project skill. Produces a Markdown report in the conversation; no scripts or repo changes required.
---

# Session postmortem

## Trigger scenarios

Activate when the user says or implies:

- Postmortem, retrospective, session review, end of session
- What went wrong, why we failed, lessons learned, inefficiencies, wasted tokens/time

## Non-goals

- Do **not** edit `AGENTS.md`, `CLAUDE.md`, `.cursor/rules`, `.claude/skills`, hooks, or subagent files unless the user **explicitly** asks for a follow-up change.
- Do **not** treat this skill as permission to refactor, fix tests, or run commands; stay analytical unless the user combines this with another task.

## Guardrails

1. **Signal only:** If a finding would not materially help a **similar** future session, omit it.
2. **Cap urgency:** At most **three** items under **Must** in "Changes for next session".
3. **Doc updates:** The section **Suggested documentation or skill updates** must be **"None warranted"** unless the issue is **recurring** and **high impact** (e.g. repeated wrong quality gates, wrong tool assumptions, systematic repo misunderstanding).

## Instructions

1. Briefly restate the **session goal** and whether it was **met**, **partially met**, or **not met** (one short paragraph).
2. Fill every section of the report template in [`references/postmortem-report-template.md`](references/postmortem-report-template.md) with concise bullets or short paragraphs. Prefer bullets over prose.
3. End with **Changes for next session** ranked **Must / Should / Consider**.
4. If **two or more** **Must**-level items are **mutually exclusive** or **order-ambiguous**, score those options in chat using [`references/solution-scorecard.md`](references/solution-scorecard.md) (read if not already in context). Output stays in the conversation; do not edit repo files.
5. If and only if guardrail (3) applies, add **Suggested documentation or skill updates** with **proposed wording** as copy-paste snippets (still do not apply edits yourself).

## Report template

Canonical section headings and placeholders live in [`references/postmortem-report-template.md`](references/postmortem-report-template.md). If that file is not already in context, read it before writing the report.

**Output contract:** Emit a single Markdown document using **exactly** the `###` sections under **Report body** in that file (same wording and heading level). **Do not** include the reference’s `## Report body` line in the report.

## Example (illustrative fragment)

### Example: Changes for next session

- **Must:** Run `pnpm lint:report` and `pnpm coverage:report` from repo root before claiming complete (per AGENTS.md).
- **Should:** Read the relevant package README before editing `packages/dbt-tools/web`.
- **Consider:** Delegate broad codebase search to a subagent when the question spans many directories.

### Example: Suggested documentation or skill updates

None warranted.
