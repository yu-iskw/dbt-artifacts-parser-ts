# Mend ADR

Detect drift between the Architecture Decision Records in `docs/adr/` and the actual
codebase, then amend every drifted ADR in-place.

## Steps

1. **List ADRs** — read every `docs/adr/*.md` with status **Accepted** (skip Superseded).
   For each, extract all falsifiable claims: numeric thresholds, file paths, component
   names, navigation labels, breakpoints, API names, algorithm parameters.

2. **Audit the implementation** — verify each claim against the actual code.
   Key files to check:
   - ESLint thresholds → `eslint.config.mjs`
   - Coverage thresholds → `vitest.config.mjs`, `scripts/coverage-score.mjs`
   - CSS breakpoints → `packages/dbt-tools/web/src/styles/app-shell.css`
   - Navigation labels / view names → `packages/dbt-tools/web/src/components/AppShell/appNavigation.ts`,
     `packages/dbt-tools/web/src/lib/analysis-workspace/types.ts`
   - Source structure / exported APIs → `packages/*/src/index.ts`, `browser.ts`
   - Constants / defaults → `packages/dbt-tools/web/src/lib/*/constants.ts`
   - Graph edge logic → `packages/dbt-tools/core/src/analysis/manifest-graph.ts`

3. **Classify drift** — for each mismatch assign severity:
   - **Major**: threshold or feature significantly changed
   - **Moderate**: label renamed, element moved to a different structural level
   - **Minor**: undocumented addition consistent with ADR intent

4. **Amend each drifted ADR** — append at the bottom of the file:

   ```markdown
   ## Amendment (YYYY-MM-DD)

   One-sentence summary of what changed.

   ### [Topic]

   Specific details: actual values, file paths, updated tables.
   ```

   Rules:
   - Never alter the original Decision or Context sections — they are history
   - Be specific: include actual values, file paths, and line references where helpful
   - Only amend when the implementation is correct and the ADR is stale — if the code
     is the bug, open an issue instead of amending

5. **Verify** — confirm tables are valid Markdown, referenced file paths exist, and
   the original ADR body is unchanged above the Amendment section.
