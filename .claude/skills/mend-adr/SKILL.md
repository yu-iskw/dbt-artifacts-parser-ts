---
name: mend-adr
description: Detect drift between Architecture Decision Records (ADRs) and actual implementation, then amend the drifted ADRs to reflect current reality. Use when ADRs may be stale, implementation has evolved, or after a refactoring sprint.
---

# Mend Architecture Decision Records

## Purpose

ADR drift occurs when the implementation evolves beyond what the ADRs documented.
This skill detects those gaps and amends the affected ADRs **in-place** with an
`## Amendment` section — preserving the original decision as historical record while
bringing the document in sync with the codebase.

## When to Use

- After any significant refactor or feature sprint
- Before a release, to ensure architecture docs are accurate
- When a reviewer notices an ADR claim that no longer matches the code
- Periodically as a hygiene check (e.g., after every 5–10 new ADRs)

## Instructions

### 1. List all ADRs

Run:

```bash
adr list
```

Read every file in `docs/adr/`. For each ADR with status **Accepted** (skip
Superseded), note its key claims:

- Numeric thresholds (ESLint limits, hop counts, debounce values, coverage floors)
- Structural claims (directory layout, entry points, exported API names)
- UI/navigation claims (view names, breakpoints, sidebar behavior)
- Algorithm parameters (cap values, sort modes, filter defaults)
- File paths and component names referenced in the Decision section

### 2. Audit the implementation

For each claim, verify the actual codebase state:

| Claim category | Where to look |
| -------------- | ------------- |
| ESLint rules | `eslint.config.mjs` |
| Coverage thresholds | `vitest.config.mjs`, `scripts/coverage-score.mjs` |
| TypeScript / build config | `tsconfig.json`, `vite.config.ts` |
| Source structure | `packages/*/src/` directory listings |
| Exported APIs | `packages/*/src/index.ts`, `browser.ts` |
| CSS breakpoints | `packages/dbt-tools/web/src/styles/app-shell.css` |
| Navigation labels | `packages/dbt-tools/web/src/components/AppShell/appNavigation.ts` |
| View hierarchy | `packages/dbt-tools/web/src/lib/analysis-workspace/types.ts` |
| Constants / defaults | `packages/dbt-tools/web/src/lib/*/constants.ts` |
| Graph edge logic | `packages/dbt-tools/core/src/analysis/manifest-graph.ts` |

Use `Grep` and `Read` to locate the relevant files. Cross-check every quantitative
claim (threshold numbers, line limits, hop counts, pixel widths) and every structural
claim (file names, directory layout, navigation structure).

### 3. Classify each drift

For each ADR that has at least one mismatch, assign a severity:

| Severity | Examples |
| -------- | -------- |
| **Major** | Thresholds relaxed/tightened significantly; feature removed or replaced |
| **Moderate** | Labels renamed; structural element moved (e.g., sub-surface vs top-level) |
| **Minor** | Undocumented addition consistent with ADR intent (e.g., extra breakpoint) |

Skip ADRs where all claims match. Do not amend superseded ADRs unless the superseding
ADR itself has drifted.

### 4. Amend each drifted ADR

Append an `## Amendment (YYYY-MM-DD)` section at the **bottom** of each drifted ADR
file. Use today's date.

**Amendment format**:

```markdown
## Amendment (YYYY-MM-DD)

Brief one-sentence summary of what changed and why the ADR no longer matches.

### [Sub-heading for first drift topic]

Exact details: updated tables, file paths, actual constants, renamed labels as they
exist today.

### [Sub-heading for second drift topic, if any]

...
```

**Rules for amendments**:

- **Never** delete or alter the original Decision or Context sections — they are history
- Be specific: include actual values, file references, and line numbers where helpful
- If the drift reflects a deliberate product decision, state the rationale
- If the drift is a defect (code should match ADR, not vice versa), open a separate
  issue instead of amending — amendments document "here is reality", not "here is a bug"

### 5. Link amendments (optional)

If the amendment substantially changes the ADR's intent, record the link via:

```bash
adr link <N> Amends <N> "Amended by"
```

For minor parameter tweaks, the inline `## Amendment` section is sufficient without
a formal link entry.

### 6. Verify

After amending, confirm:

- All Markdown tables render correctly (balanced pipe characters)
- File paths referenced in amendments resolve (`Glob` to check)
- The original ADR body is unchanged — only the Amendment section was added

## Best Practices

- Stack multiple drift topics under one `## Amendment (date)` section per audit run
- If the same ADR requires another audit later, append a **second** dated Amendment
  section rather than editing the first
- Keep amendments factual and concise — the goal is accuracy, not re-litigation of
  the decision
- If a drift is large enough to reverse the original decision, use `manage-adr` to
  create a new superseding ADR instead of an amendment

## References

- Skill: [manage-adr](../manage-adr/SKILL.md) — creating and linking ADRs
- ADR directory: `docs/adr/`
- ADR granularity guidance: [manage-adr/references/adr-granularity.md](../manage-adr/references/adr-granularity.md)
