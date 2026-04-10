# `src/design-system`

Shared UI foundation for `@dbt-tools/web`.

- `components/` — reusable components with intentional variants (`Button`, `Input`, `Card`).
- `patterns/` — reusable composition patterns (`LoadingStatePattern`, `EmptyStatePattern`).
- `foundations/` — low-level helpers (`cx`).

Planned next shared components to add in this area:

- Table
- Badge
- Tabs
- Dialog

All visual decisions in this folder must map to token variables from `src/styles/tokens.css` / `src/styles/theme.css`.
