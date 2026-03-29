# Mend ADR

Detect drift between Architecture Decision Records in `docs/adr/` and the codebase,
then record corrections—**at the decision and intent level**, not by copying volatile
file lists or config tables into ADRs.

## Policy: two-tier audit

For each `docs/adr/*.md` with status **Accepted** (skip Superseded):

### Tier A — Intent (primary)

Extract and verify:

- Stated **goals**, **boundaries**, **non-goals**
- **User-visible** or **cross-package** behavior the ADR promises (e.g. capped focus
  edges, worker-backed analysis, per-package coverage visibility)
- **Architectural constraints** (e.g. layering, no React in workers)

**How to verify:** Read relevant tests, public APIs, and subsystem behavior—not every
file path named in an older ADR. If the **intent** still holds after refactors, there
is no drift even when paths moved.

### Tier B — Explicit stable facts (secondary)

Extract only claims the ADR marks as **normative** and **stable**, for example:

- Published **package names** or scopes
- **CLI flags** or behaviors described as the public contract
- Versioned **protocol** numbers if the ADR defines them as part of the decision

Verify these against `package.json`, CLI help, or the cited code. If wrong, amend with
a **short** correction (names/flags), not a directory listing.

## Optional hints for intent checks

Use when helpful; **do not** treat as mandatory, and **do not** paste these paths into
ADRs as amendments:

| Concern                           | Where detail usually lives                        |
| --------------------------------- | ------------------------------------------------- |
| ESLint / complexity               | `eslint.config.mjs`                               |
| Coverage thresholds / `byPackage` | `vitest.config.mjs`, `scripts/coverage-score.mjs` |
| Breakpoints / shell layout        | `packages/dbt-tools/web/src/styles/app-shell.css` |
| Nav labels / workspace types      | `appNavigation.ts`, `types.ts` under web          |
| Package exports                   | `packages/*/src/index.ts`, `browser.ts`           |
| Graph / snapshot                  | `packages/dbt-tools/core/src/analysis/`           |

## Classify drift

- **Major:** User-visible behavior or architectural boundary no longer matches the ADR.
- **Moderate:** Stable fact (Tier B) wrong; intent holds but public contract changed.
- **Minor:** Wording-only; implementation moved files but intent unchanged (often **no
  amendment**—update a package README or comment instead).

## Amend drifted ADRs

Append at the bottom:

```markdown
## Amendment (YYYY-MM-DD)

One-sentence **decision-level** summary (what changed in intent or stable facts).

### Invariants (optional)

- Bullet list of **durable** rules that still apply after the change.

### Living detail (optional)

At most **one pointer per topic** (e.g. `eslint.config.mjs`, `tokens.css`)—do not
duplicate threshold tables, hex palettes, or file inventories here.
```

**Rules:**

- **Agent / automated runs:** Append `## Amendment` only. Do **not** edit existing
  Context, Decision, Consequences, or prior Amendment bodies.
- **Maintainer editorial passes (reviewed PR):** May **trim** Context/Decision to remove
  duplicated implementation detail (per decision-first ADR policy). Prefer
  **superseding** a new ADR if the architectural choice itself changes.
- **Do not** amend to match code that violates the ADR—open an issue or fix the code.
- **Discourage** amendments that only swap file paths after refactors; note “intent
  unchanged” in a PR or README instead.

## Verify

- Markdown is valid; any path mentioned in the **new** amendment exists.
- Text above the new amendment block is unchanged on **agent** runs.
