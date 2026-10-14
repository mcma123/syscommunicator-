# Client workspaces

## Purpose

- Own additional clients while the Lovable TanStack web app stays at the repository root.

## Ownership

- This doc owns client workspace boundaries under `apps/`; each indexed app owns its implementation.
- Root `package.json` registers `apps/*` alongside `packages/*` using npm workspaces.

## Local Contracts

- Reuse provider-independent contracts from `@school-connect/core`.
- Keep each app's build configuration and runtime dependencies scoped to its workspace.

## Work Guidance

- Use npm 11 and the root npm lockfile for dependency changes.

## Verification

- Run the owning app's checks through its root workspace commands.

## Child DOX Index

- [expo/AGENTS.md](expo/AGENTS.md): Android, iOS, and Expo web client, branding assets, and EAS configuration.
