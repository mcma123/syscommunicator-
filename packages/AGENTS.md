# Shared workspace packages

## Purpose

- Own reusable packages consumed by the root web app and future clients.

## Ownership

- This doc owns package boundaries under `packages/`; each indexed package owns its implementation.
- Root `package.json` owns the `packages/*` workspace registration and installation workflow.
- The backend workspace owns provider-specific Convex configuration; domain packages remain provider-independent.

## Local Contracts

- Keep shared domain packages independent of frontend rendering and backend providers.
- The supported preview application stays at the repository root.

## Work Guidance

- Follow the root School Connect architecture when changing package responsibilities.

## Verification

- Run `npm run build` from the root to verify packages consumed by the web app.

## Child DOX Index

- [school-core/AGENTS.md](school-core/AGENTS.md): school domain/workflow contracts, shared module permissions, calendar export, fixtures, configuration, and mock repository.
- [backend/AGENTS.md](backend/AGENTS.md): the single Convex backend shared by both clients, its dev deployment link, typed API exports and shared reactive client hooks.
