# GitHub automation

## Purpose
- Own repository CI workflows.

## Ownership
- `workflows/ci.yml` owns pull-request and push verification.
- `workflows/dependency-audit.yml`, `audit-exceptions.json` and the root `scripts/audit-gate.mjs` own the dependency advisory gate.

## Local Contracts
- Use Node 24/npm 11 and the root lockfile.
- CI runs root ESLint (web and school-core; Prettier formatting is an error) and the Expo workspace ESLint. Root lint ignores local agent tooling folders (`.claude`, `.codex`, `.openrig`); `packages/backend` is covered by its TypeScript check, not ESLint.
- CI also runs the all-platform Expo export (no EAS or account credentials; output is git-ignored).
- The dependency audit runs on manifest/lockfile/gate changes, weekly and on demand. Every high/critical advisory source, including transitive packages, must match an exception that names the exact GitHub advisory URL and vulnerable package, with rationale, owner, follow-up and expiry (at most about 30 days). Expired or incomplete exceptions, npm errors and malformed reports fail the job; the raw report is always uploaded. Exceptions are temporary CI tolerances, not risk acceptance; triage lives in root `SECURITY.md`.
- Pin third-party actions to full commit SHAs with the release tag in a comment.
- Backend tests use isolated convex-test databases, mocked email delivery and ephemeral local signing keys. CI must not deploy or need cloud credentials.

## Work Guidance
- Keep workflow permissions read-only and run commands from the repository root.

## Verification
- Run the workflow's test, typecheck and lint commands locally; check workflow syntax and `git diff --check`.

## Child DOX Index
- None.
