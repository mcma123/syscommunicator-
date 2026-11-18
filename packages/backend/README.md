# Convex backend workspace

This workspace is the single Convex backend and database shared by the TanStack
web app and the Expo app. The phased plan lives in
[Backend and Database Integration](../../Backend-and-Database-Integration.md).

The Syscommunicator clone targets a separate self-hosted Convex instance. Its schema, functions and components have been deployed there. Local web, Expo and backend URLs are kept in ignored `.env.local` files; the self-hosted admin key belongs only in the backend file. The new database has no school records or accounts yet. Convex Auth signing variables are configured on that instance; `SITE_URL` currently points to `http://localhost:8080` for local development. Email delivery still requires its provider settings.

The original cloud dev deployment and its fictional fixtures remain documented below for reference. The legacy `seed:backend`, `reset:backend`, `verify:backend`, `setup:auth:dev` and `verify:auth:dev` helpers are pinned to that original deployment and reject the self-hosted instance. Do not use them to initialize this clone.

## Commands

Run Convex from this folder only (never from the repository root):

```sh
npm run dev:backend                 # from the root: convex dev in this workspace
npx convex dev --once               # from packages/backend: push once and regenerate types
npm run typecheck:backend           # from the root
npm run test:backend                # isolated tests, no credentials or cloud writes
npm run seed:backend                # push, insert missing fixtures, verify
npm run verify:backend              # read-only dev verification
npm run reset:backend               # clear development data, then reseed and verify
```

The ignored `.env.local` here holds `CONVEX_SELF_HOSTED_URL`, `CONVEX_SELF_HOSTED_ADMIN_KEY`, and the `CONVEX_URL`/`CONVEX_SITE_URL` values saved by the CLI. Run `npx convex dev --once` from this folder to push to the self-hosted instance. The Expo access token does not authenticate to Convex.

## Development fixtures

Fixture commands run from the root and are intentionally restricted to
`dev:diligent-bass-226` with URL `https://diligent-bass-226.convex.cloud`.
They reject production/unknown targets, deploy keys, self-hosted overrides and
extra arguments. Server functions independently check the actual cloud URL.

`seed:backend` preserves existing edits and uses indexed logical fixture keys
plus unique natural-key matching. Duplicate matches or a conflicting school
fail rather than guessing. Stable fixture identity is recorded in `seedFixtures`.
The seed imports shared school fixtures, with five credential-free demo profiles,
six learners (two family learners plus attendance classmates), four notices for
parents and one private draft. It also creates events, enquiries, attendance,
conduct, sample report states, notification preferences, an unanswered consent
request and a Due R250 excursion charge. Receipt rows do not claim actual delivery.

Six real UTF-8 `.sample.txt` files support resource/notice samples; these are not
the school's PDFs. Stored sizes are their actual byte sizes. Fictional dates stay
in October 2026, converted with Johannesburg's UTC+02:00 offset. Seeding itself creates no passwords or
auth accounts; separate guarded auth setup provisions them. No push tokens or real payment/provider events are seeded. Authors
without a demo user map to Administrator, with original notice attribution retained.

`reset:backend` explicitly deletes **all application-table records**, including auth accounts and sessions, in this dev
database before rebuilding fixtures. Run `setup:auth:dev` after reset to restore dev logins. It first checks a 500-row total limit and
refuses oversized datasets without deleting anything. Only seed-owned storage
files are deleted; unrelated files remain. Reset and reseeding are separate
operations: if rebuilding fails, rerun seed. File preparation interrupted after
registration leaves reusable samples. Verification detects broken references;
use reset if manual deletion of a referenced parent leaves surviving links stale.

`verify:backend` reports bounded per-table counts and checks registered documents,
foreign-key references and sample storage metadata. It does not assert that
client screens use the database.

GitHub CI runs command tests and `convex-test` in isolated in-memory databases,
alongside existing tests and all TypeScript checks. It requires no deployment
credentials. Cloud test/preview deployment CI is deferred in the integration plan.

## Client configuration

| Client | Variable | File |
| --- | --- | --- |
| Web (TanStack) | `VITE_CONVEX_URL` | root `.env.local` |
| Expo | `EXPO_PUBLIC_CONVEX_URL` | `apps/expo/.env.local` |

Both clients import the typed API from this package:

```ts
import { api } from "@school-connect/backend/client";
import type { Id, Doc } from "@school-connect/backend/dataModel";
```

Backend secrets (auth, payments, email) belong in the Convex dashboard's
environment variables, never in client env files.

## Rules

Read `convex/_generated/ai/guidelines.md` before writing Convex code. Commit
`convex/_generated/`, never edit it by hand. Provider-independent domain types
and pure rules stay in `packages/school-core`.

## Authentication and onboarding

`auth.ts` uses pinned Convex Auth 0.0.96 with Password (mandatory email verification/reset codes) and an Email magic-link provider. `auth.config.ts` trusts this deployment's Convex site; `http.ts` serves the auth discovery routes. Required auth tables are spread before the customized users table. Existing registered emails retain their profile IDs and guardian links; unknown emails need a pending school invitation. Password profiles never accept roles or verification flags from clients.

Root `npm run setup:auth:dev` generates missing RS256 signing keys, preserves existing ones, sets the local SITE_URL only when absent, enables dev accounts, pushes functions and provisions the five fictional accounts. It pipes signing/provisioning secrets through stdin, stores random passwords in ignored root `.env.auth.local`, and removes temporary password env variables. The server's exact dev URL and flag gate independently prevent demo authentication elsewhere. `verify:auth:dev` verifies real password sessions, matching identities from independent clients, staff roles, guardian/class/publication/Finance/signed-out authorization and immediate session revocation.

Public `users.current` returns a bounded profile, staff roles and linked active learners. It loads the session row and returns no memberships for revoked/deactivated users. `users.signOutEverywhere` derives the user from the session and invalidates all sessions; password reset also invalidates older sessions. Clients import the narrow `@school-connect/backend/client` facade, compile-checked against generated APIs, so internal function implementations do not enter client TypeScript programs or bundles.

Deployment-only email settings are `RESEND_API_KEY`, `AUTH_EMAIL_FROM` and a recipient-reachable `SITE_URL`. Missing settings fail explicitly and disable email entry controls. The initial SITE_URL is localhost:8080 for development; replace it for deployed email use. The implementation is tested with mocked email; real invitation/verification/recovery delivery still requires configured credentials and live verification. Never print keys, codes, invitation tokens or passwords in logs.

Administrator invitation issuance stores a SHA-256 hash, seven-day expiry and bounded learner IDs; email contains the raw one-use code. Acceptance requires an active session and verified matching email, then grants only the stored role/guardian links and writes an audit event atomically. A replacement invitation revokes prior Pending invitations. Failed email sends report failure rather than delivery; retry issues a new invitation. Account state without roles or linked learners cannot enter module screens. Expo accepts active staff roles or linked guardians, with the same module and document scope as web.

Auth tests use the real auth library with ephemeral local signing keys and mocked Resend HTTP responses: password verification/reset, magic-link replay, invitation ownership/expiry/reuse, guardian scoping, deactivation, demo flag and revocation. They are not live delivery or device coverage. Phase 4 authorization is described in [AUTHORIZATION.md](AUTHORIZATION.md); paginated module reads are implemented through Phase 6.

Implementation references: [Convex Auth setup](https://labs.convex.dev/auth/setup), [password verification/recovery](https://labs.convex.dev/auth/config/passwords), [magic links](https://labs.convex.dev/auth/config/email), and [session validity/account linking](https://labs.convex.dev/auth/advanced). Installed package source for 0.0.96 is the API ground truth.

## Shared live client layer

[CLIENT-DATA.md](CLIENT-DATA.md) owns the shared read contract. `schoolRead.page` supplies native cursor pagination; `schoolRead.detail` independently authorizes document IDs and related history. `dashboard.current/advance` supply exact scoped aggregate counts after bounded materialization. `schoolData.list` remains a compatibility/home-preview API. The separate React export supplies both clients with subscriptions, retry boundaries, connection state and optimistic receipts. Neither runtime mounts SchoolRepository. Phase 7 school writes use `workflowForms.forms` and `workflows.submit`; Phase 8 file workflows use upload reservations (PDF 10 MiB, images 5 MiB), expiring protected downloads, receipt PDFs and conservative cleanup. See [FILES.md](FILES.md). Provider payments remain Phase 9.

Phase 10 adds session-owned Expo device registration, bounded notice/consent delivery, preference/quiet-hour handling, provider confirmation and invitation expiry. See [NOTIFICATIONS.md](NOTIFICATIONS.md) for deployment variables, physical-build and Resend activation, retry semantics and verification limits. Payment notifications remain deferred.
