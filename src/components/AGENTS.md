# Shared components

## Purpose

- Own reusable presentation components shared across frontend features.

## Ownership

- This doc owns shared component boundaries; `ui/` owns the existing component library.
- School-specific screens and dialogs stay under `../features/school/`.

## Local Contracts

- Root `components.json` defines the component aliases, Tailwind stylesheet, and shadcn configuration.
- Keep school domain state and repository access in the school feature.

## Work Guidance

- Follow the existing `@/components`, `@/components/ui`, and `@/lib/utils` aliases.

## Verification

- From the root, run `npm run build` and `node node_modules/typescript/bin/tsc --noEmit` for shared component changes.

## Child DOX Index

- [ui/AGENTS.md](ui/AGENTS.md): reusable UI primitives and wrappers.
