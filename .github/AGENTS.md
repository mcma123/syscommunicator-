# GitHub automation

## Purpose
- Own repository CI workflows.

## Ownership
- `workflows/ci.yml` owns pull-request and push verification.

## Local Contracts
- Use Node 24/npm 11 and the root lockfile.
- CI runs root ESLint (web and school-core; Prettier formatting is an error) and the Expo workspace ESLint. Root lint ignores local agent tooling folders (`.claude`, `.codex`, `.openrig`); `packages/backend` is covered by its TypeScript check, not ESLint.
- Backend tests use isolated convex-test databases, mocked email delivery and ephemeral local signing keys. CI must not deploy or need cloud credentials.

## Work Guidance
- Keep workflow permissions read-only and run commands from the repository root.

## Verification
- Run the workflow's test, typecheck and lint commands locally; check workflow syntax and `git diff --check`.

## Child DOX Index
- None.
