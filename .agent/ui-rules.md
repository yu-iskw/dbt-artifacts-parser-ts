# UI implementation rules (dbt-tools/web)

## Token contract

- Use semantic tokens (`--dt-semantic-*`) in feature and page code.
- Use component tokens (`--dt-component-*`) only inside shared design-system components.
- Never use primitive tokens directly in feature code.

## Hard constraints

- No hardcoded hex/rgb/px/radius/shadow values in `src/design-system` or `src/styles`.
- If a visual value is missing, add a token in `tokens/` and regenerate.
- Prefer `src/design-system/components` over one-off styled wrappers.

## Theming

- Light/dark must be implemented through CSS custom properties.
- Theme toggles may only set `data-theme`; components should remain theme-agnostic.

## Verification

Run before commit:

1. `pnpm tokens:build`
2. `pnpm tokens:validate`
3. `pnpm --filter @dbt-tools/web build`
