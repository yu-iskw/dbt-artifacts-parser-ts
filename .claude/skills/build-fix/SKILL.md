---
name: build-fix
description: Run the build process and fix errors if they exist. Use when the user asks to build, fix build, fix build errors, get the project to compile, or make the build pass.
compatibility: Requires pnpm (or npm/yarn); project must define a build script.
---

# Build Fix

## Trigger scenarios

Activate this skill when the user says or implies:

- Build, run build, compile
- Fix build, fix build errors, make the build pass
- Build failed, build is broken, get the project to compile

## Purpose

Run the project build, then if it fails, identify the cause from the build output, apply minimal fixes, and re-run until the build succeeds or an iteration limit is reached.

## Commands for this repo

Run from the **repository root**.

- **Build:** `pnpm build` (runs `pnpm --recursive build`, which builds all workspace packages; the main package uses `tsc`).

## Fixer loop

1. **Run:** Execute `pnpm build` from the repository root.
2. **Identify:** If the build fails, read the compiler/linker output to determine the cause (e.g. TypeScript errors, missing modules, syntax errors).
3. **Fix:** Apply the minimum necessary change to resolve the reported error(s). Prefer fixing one logical issue per iteration.
4. **Verify:** Re-run `pnpm build`.
5. **Repeat** until the build succeeds or up to **5 iterations** to avoid unbounded loops.

## Common error types

- **TypeScript:** Type errors, missing types, wrong imports — fix types or imports in the indicated files.
- **Missing dependencies:** Install with `pnpm add …` or `pnpm add -D …` as needed.
- **Syntax / invalid code:** Fix the reported file and line.

## Example

First run (build fails):

```bash
pnpm build
```

After editing files to fix reported errors:

```bash
pnpm build
```

## Other projects

If the project uses a different package manager or build command, run the equivalent from the repo root (e.g. `npm run build`, `yarn build`, `cargo build`). Use the same fixer loop: run build → read errors → fix → re-run.
