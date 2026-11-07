# Convex backend

## Purpose

- Own the single Convex backend and database shared by the TanStack web app and the Expo app.

## Ownership

- Own `convex.json`, `convex/` outside the indexed authorization library, `DATA-MODEL.md`, `AUTHORIZATION.md`, `CLIENT-DATA.md`, `WRITE-WORKFLOWS.md`, `FILES.md`, `NOTIFICATIONS.md`, `IMPORTS.md`, backend TypeScript/package configuration, environment examples, and setup documentation.
- Domain types, fixtures, and pure business rules remain owned by `../school-core/`.
- The phased integration checklist is owned by the root `Backend-and-Database-Integration.md`.

## Local Contracts

- This is the only Convex functions directory. Run every Convex CLI command from `packages/backend` (root `npm run dev:backend` does this). Never create or run Convex from the repository root.
- The dev deployment is linked through the ignored `packages/backend/.env.local` (`CONVEX_DEPLOYMENT`, `CONVEX_URL`, `CONVEX_SITE_URL`). No production deployment exists yet.
- `convex/schema.ts` defines the full data model and is deployed to dev. `DATA-MODEL.md` owns the mapping from mock state, the design decisions, and the access-path → index map; update it with every schema change.
- Enum validators in `convex/validators.ts` are built from the `as const` tuples in `@school-connect/core/domain`. Add or change enum values there, never as local literals.
- `users` keeps Convex Auth's field/index names (`email`, `phone`) with app fields optional. Internal fixtures populate dev; Convex Auth and public identity/onboarding functions are deployed. Both clients use live identity, native cursor pagination, independent detail reads and exact scoped dashboard counts through shared hooks.
- `seed.ts` owns internal seed, reset, file registration and verification; `seedFiles.ts` stores labelled text samples before calling the seed mutation. `seedSupport.ts` owns shared guard, bounded inventory and indexed fixture identity helpers.
- Seed/reset/file registration fail closed unless the server's generated `env.CONVEX_CLOUD_URL` matches `https://diligent-bass-226.convex.cloud`. Never weaken this to a caller-supplied deployment or production opt-in.
- `seedFixtures.by_key` maps stable logical fixture keys to documents or owned files, preserving edits across seed runs. Natural-key matches must be unique; never overwrite existing user values. Missing referenced parent documents require reset if verification finds stale links.
- Reset clears all schema application tables, including auth tables/sessions, only after a 500-row total preflight. It deletes only registry-owned files; other storage is preserved. Interrupted file preparation leaves registered, reusable samples; rerun seed to resume.
- Dates use fixed October 2026 Johannesburg fixture times. Seeding does not create credentials; guarded auth setup provisions separate private dev credentials; sample text documents have real storage IDs and byte sizes, with no claim of PDF rendering or delivery.
- `auth.ts`, `auth.config.ts`, and `http.ts` wire Convex Auth password and email providers. Spread `authTables` before the customized `users` table; preserve library-required auth indexes. Library-returned function definitions are not handwritten app builders.
- `authPolicy.ts` owns normalized, school-registered/invited account linking, active-account checks, live session checks, invitation hashes. Use Convex Auth's supported identity/session helpers for its subject format; never accept identity/role arguments for authorization.
- Password profiles accept only normalized email. Signup/signin must verify the password account's email; linking a profile must not mark an unverified password account verified. Roles and guardian links come only from existing school records or verified, single-use invitation acceptance.
- `users.ts` owns current profile/roles/linked learners, disabled module keys, safe public capability flags, and sign-out everywhere. Deactivation stores a cutoff at least as new as the latest indexed session; requireSession/current reject older sessions even after reactivation. Another Administrator must change the caller's own access. Revoked/deactivated identities return no roles or learners. Live queries load the session row so revocation is immediate even before JWT expiry.
- `onboarding.ts` requires Administrator identity to issue invitations. Store only SHA-256 token hashes; recipient email, expiry and Pending status must match before granting roles/guardian links atomically. Audit issuance, revocation, acceptance and each new role/guardian grant. Learner choices are bounded to 100; guardian links to 20 in total, checked before acceptance grants any role or link.
- `authEmail.ts` sends through deployment-only `RESEND_API_KEY`/`AUTH_EMAIL_FROM` and uses `SITE_URL`. Email verification/reset use short-lived codes; magic links require explicit email confirmation. Allow only the configured web origin and `wgjsconnect://signin` as return destinations. Missing configuration must fail without claiming delivery.
- `developmentAuth.ts` provisions only the five seeded profiles with the dev flag and exact dev URL. Provisioning secrets arrive through temporary deployment env values, are never public arguments, and are removed by the setup helper. Client bundles never contain demo passwords.
- `react.ts` owns shared native Convex pagination, independent detail subscriptions, dashboard rebuilding, error boundaries/retry, socket state and optimistic receipts. Server functions never import this client export. `schoolRead.ts` and `lib/read.ts` project authorized normalized records into `core/live`; every long list retains native pagination metadata, including empty filtered pages. `schoolData.ts` remains a bounded compatibility/home-preview API. Receipt writes derive the reader from the session and audit changes; acknowledgement additionally requires guardian audience membership.
- `workflows.ts` owns validated/audited school writes, internal scheduled publication/25-user receipt fanout and legacy 512 KiB PDF byte actions. `files.ts` owns session-bound upload reservations/finalization, two-minute protected download grants, resource publication, notice attachment removal and conservative bounded cleanup; `crons.ts` runs hourly internal cleanup. `receiptFiles.ts` generates PDFs only for matching verified successful payments. `FILES.md` owns these contracts. `receiptAssets.ts` embeds the supplied crest and licensed Open Sans via scripts/prepare-receipt-assets.mjs. `workflowForms.ts` describes allowed commands and initial field values for both clients; its visibility is presentation only, never authorization. `lib/workflowRules.ts` owns normalization, input bounds, school time and class/audience write checks.
- `notifications.ts` owns authenticated device registration/removal, safe paginated personal/staff delivery history and audited retries. `notificationJobs.ts` owns internal dispatch, provider transport, receipt polling, consent reminder fanout and invitation expiry. NOTIFICATIONS.md owns activation, truthful status semantics, infrastructure audit exceptions and deferred payment messages. `notificationWorkpool` limits push concurrency to two; `notificationEmailWorkpool` serializes email work. `notificationEmail.ts` uses the Node runtime and Rate Limiter reservations for one Resend send/status request per second, rechecking authorization after the wait. Only idempotent email sends retry automatically; uncertain push sends do not.
- `imports.ts` owns Administrator-only roster import: `preview` (no writes) and `commit` (audited, 50-row chunks, idempotent by natural key) re-validate rows with `@school-connect/core/imports`; `importBatches` records uploads and `importBatchRows` binds each batch row number to a content digest so replays never inflate counts. Guardians/staff are only staged in `rosterContacts` and never create users, roles, links or invitations; activation awaits the POPIA decision. `IMPORTS.md` owns these contracts.
- `client.ts` exports the narrow public identity/onboarding, workflow and protected-read contract and references for both clients, preventing client TypeScript settings from checking internal function implementations. `auth.test.ts` verifies facade compatibility against generated APIs.
- `dashboard.ts` materializes per-user/learner dashboard projections in authenticated, bounded internal transactions. `dashboardAggregate` mirrors dashboardItems transactionally. Domain audit writes and seed invalidate source revisions; own receipt writes invalidate only that reader. Derived cache transactions are the documented business-audit exception. Direct dashboard database edits require rerunning insert-only seed to invalidate caches. `convex.config.ts` mounts the aggregate component and enables generated environment access. `vitest.config.ts`, `convex/seed.test.ts`, and `convex/auth.test.ts` and `convex/authz.test.ts` and `convex/schoolData.test.ts` and `convex/schoolRead.test.ts` and `convex/workflows.test.ts` and `convex/files.test.ts` and `convex/notifications.test.ts` and `convex/imports.test.ts` and `convex/journeys.test.ts` (enquiry and report-release journeys through the public `client.ts` facade) own isolated edge-runtime tests with mocked email and ephemeral signing keys. Keep Vite import-meta type references in test files, not global compiler types; never deploy or load cloud credentials in CI.
- One `convex` version (`^1.48.0`) is shared by the root, this workspace, and `apps/expo`; npm hoists a single copy. Change all three manifests together.
- Clients import the typed API from this package: `@school-connect/backend/client` (public identity/onboarding references/types) and `@school-connect/backend/dataModel` (`Id`, `Doc`). Backend functions use generated `api`/`internal` locally. Do not copy generated types into clients.
- Convex generates `convex/_generated/`; commit it, never edit it by hand. `convex.json` keeps `aiFiles` disabled so `convex dev` does not install duplicate skills here.
- Public client URLs: web `VITE_CONVEX_URL` (root `.env.local`), Expo `EXPO_PUBLIC_CONVEX_URL` (`apps/expo/.env.local`). Backend secrets live only in Convex deployment environment variables, never in client env files.

- Protected reads for notices, learners, resources and charges use authenticated builders and per-document scope checks. `AUTHORIZATION.md` owns the role matrix, endpoint exceptions and four-shape audit evidence. All public school mutations use audited builders. Workflow transitions, corrections, role/class grants, preferences and settings audit their specific targets. Payment confirmation remains a future provider workflow.

## Work Guidance

- Read `convex/_generated/ai/guidelines.md` before writing Convex code. Key rules:
  - Every function declares argument validators; private functions use `internalQuery`/`internalMutation`/`internalAction`.
  - Derive identity with `ctx.auth.getUserIdentity()` (key on `tokenIdentifier`); never accept a user ID or role argument for authorization.
  - Query through `.withIndex()` with index names listing every field (`by_a_and_b`); bound reads with `.take()` or pagination, never unbounded `.collect()`.
  - No wall-clock reads in queries; use scheduled mutations or pass time in.
  - Child tables instead of unbounded arrays in a document; use `@convex-dev/aggregate` for counts.
  - HTTP endpoints live in `convex/http.ts` and validate untrusted bodies; Node built-ins need a separate `"use node";` action file.
  - Tests use `convex-test` with Vitest `edge-runtime`, under `convex/`.
- Do not import React/native presentation into backend code.

## Verification

- From the root: `npm run typecheck:backend`. Backend tests use one worker and a 15-second default test timeout for component/fixture workloads.
- `npm run test:backend` checks CLI guards, isolated fixture workflows and real auth-library verification/reset/magic-link flows with mocked email, invitation isolation/replay/expiry, deactivation and session revocation. `npm run verify:auth:dev` checks real dev password sessions and identity from independent HTTP clients; this is not device or live email coverage.
- `npm run setup:auth:dev` installs missing signing keys without rotating existing keys, configures a local dev SITE_URL when absent, enables dev accounts, pushes and provisions private passwords. It must run only through the guarded root helper. After `reset:backend`, rerun setup to restore dev logins.
- `npm run seed:backend` pushes functions, prepares files, seeds and verifies the identified dev deployment; `verify:backend` only checks it. `reset:backend` explicitly clears dev then reseeds. All commands run through the root guard helper.
- `npx convex dev --once` from this folder pushes and regenerates `_generated/` against the dev deployment.

## Child DOX Index

- [convex/lib/AGENTS.md](convex/lib/AGENTS.md): server session actors, role/guardian/class checks, audiences, paginated projections, workflow/file validation, receipt PDF layout, dashboard helpers and audit enforcement.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
