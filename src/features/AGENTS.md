# Frontend features

## Purpose

- Own feature-specific presentation and frontend state coordination.

## Ownership

- This doc owns feature boundaries. The school feature owns all current module presentation.
- Routes, generic UI components, and shared domain contracts have separate owning docs.

## Local Contracts

- School modules stay under `school/` and use the shared root provider and repository contracts.
- Components must not call backend providers directly.

## Work Guidance

- Keep named school modules accessible through their leaf routes.

## Verification

- From the root, use `npm run build` and `node node_modules/typescript/bin/tsc --noEmit` for feature changes.

## Child DOX Index

- [school/AGENTS.md](school/AGENTS.md): school screens, responsive navigation, dialogs, and shared demo state.
