# Prompt template: implement a shared component

When adding or changing a component in `@dbt-tools/web`, follow this sequence:

1. Confirm required semantic/component tokens exist under `packages/dbt-tools/web/tokens`.
2. If missing, add tokens first and run `pnpm tokens:build`.
3. Implement component in `src/design-system/components` with limited variants.
4. Map every visual decision (color/space/radius/typography/shadow/motion/z-index) to tokens.
5. Do not add arbitrary style override props.
6. Add/update tests and run `pnpm tokens:validate` plus package build.
