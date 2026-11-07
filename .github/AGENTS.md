# GitHub automation

## Purpose
- Own repository CI workflows.

## Ownership
- `workflows/ci.yml` owns pull-request and push verification.

## Local Contracts
- Use Node 24/npm 11 and the root lockfile.
- Backend tests use isolated convex-test databases, mocked email delivery and ephemeral local signing keys. CI must not deploy or need cloud credentials.

## Work Guidance
- Keep workflow permissions read-only and run commands from the repository root.

## Verification
- Run the workflow's test and typecheck commands locally; check workflow syntax and `git diff --check`.

## Child DOX Index
- None.
