# Backend and Database Integration

Wynberg Girls Junior Connect is one monorepo with two frontends:
- **Web portal** (TanStack Start, repo root): parents and all staff roles.
- **Mobile app** (Expo, `apps/expo`): parents on Android, iOS and Expo web.

Both frontends will use **one Convex backend and one Convex database**. Clients never talk to each other directly. They read and write through typed Convex queries, mutations and actions, and every permission check runs on the server.

Status key: `- [ ]` not started · `- [x]` done. Tick a step only after it has been checked.

## Target architecture

Execution order: defer Phase 9 payments until the other feature work is complete. Continue with Phase 10 notifications, then data-import tooling, quality checks and launch preparation. Payment-dependent reminders, receipt emails and payment journey tests remain pending until Phase 9; complete applicable payment validation before final launch. Phase numbers remain stable for existing references.

    apps/expo (parent mobile)  ─┐
                                ├─► Convex functions (packages/backend/convex) ─► Convex database + file storage
    root web (TanStack Start)  ─┘          │
                                           ├─► Auth provider (identity)
                                           ├─► Payment provider (webhooks → HTTP actions)
                                           └─► Push / email providers (actions + scheduler)

    packages/school-core: shared domain types, validators, pure business rules (no provider imports)

---

## Phase 0 — Foundations and decisions
Goal: one Convex project, one location for backend code, and the open decisions settled.

- [x] Put all Convex code in one place: **`packages/backend/convex/`**. Move or remove the stray root `convex/` folder, and point `packages/backend/convex.json` at it.
- [x] Use one `convex` version across the root, `packages/backend` and `apps/expo` (all on `^1.48.0`; npm hoists one copy).
- [x] Re-run `npx convex dev` from `packages/backend`, linked to the existing deployment. Confirm that `_generated/` is created there.
- [x] Read `convex/_generated/ai/guidelines.md` and record the key rules in `packages/backend/AGENTS.md`.
- [x] Set up environment variables:
  - [x] Web: `VITE_CONVEX_URL`
  - [x] Expo: `EXPO_PUBLIC_CONVEX_URL`
  - [x] Backend secrets go in the Convex dashboard only
  - [x] Update `.env.example` files
- [ ] Create separate **dev** and **production** Convex deployments, and use preview deployments for branches if needed. *(Dev done; production deliberately deferred to Phase 13.)*
- [x] Decide the **auth provider**: **Convex Auth** (chosen). Options were Convex Auth or Clerk. Requirements: email/password plus magic link for parents, staff invitations, and support for both web and Expo.
- [ ] Decide the **payment provider** (for example PayFast, Yoco or Paystack) and whether to start with sandbox mode.
- [x] Decide **notification channels**: **Expo push + Resend email** (chosen); SMS optional later.
- [ ] Confirm **POPIA** requirements: data retention, consent records, access to learner data, and audit obligations.
- [x] Export `api` and the data-model types from `packages/backend` so both clients import the same typed API.
- [x] Record the architecture in `packages/backend/AGENTS.md`, root `AGENTS.md` and `FRONTEND.md` (DOX pass).

**Exit criteria:** `npm run dev:backend` syncs an empty schema from `packages/backend`, both clients can read their Convex URL, and the decisions are recorded.

---

## Phase 1 — Database schema and data model
Goal: replace the single `SchoolState` blob with normalised tables, using validators and indexes.

- [x] Map every `SchoolState` field and module in `packages/school-core` to tables (see the table list below). Mapping and index map: [`packages/backend/DATA-MODEL.md`](packages/backend/DATA-MODEL.md).
- [x] Define tables in `packages/backend/convex/schema.ts`, with validators for every field:
  - [x] `schools` (branding, term, timezone, currency, feature flags; replaces the hard-coded `schoolConfig`)
  - [x] `users` (identity link, name, email, phone, status) and `staffRoles` (Teacher / Principal / Finance / Administrator)
  - [x] `grades`, `classes`, `learners`, `guardianLinks` (guardian ↔ learner, relationship, primary contact)
  - [x] `teachingAssignments` (staff ↔ class/subject, used to scope teacher access)
  - [x] `groups` and `groupMembers` (custom audiences)
  - [x] `notices`, `noticeReceipts` (delivered / read / acknowledged per guardian); audiences are a bounded inline array, not a separate table
  - [x] `events` (inline audiences)
  - [x] `resources` (category, `storageId`, audience, size)
  - [x] `reports` (per learner and term, draft → reviewed → released, `storageId`)
  - [x] `attendanceRegisters` and `attendanceMarks`
  - [x] `conductEntries` (merit / demerit, learner, author)
  - [x] `consentRequests`, `consentResponses` (a generic `forms` table is deferred until custom forms are commissioned)
  - [x] `charges`, `payments`, `paymentEvents` (webhook history), `receipts`
  - [x] `enquiries`, `enquiryMessages` (department, assignee, status)
  - [x] `invitations` (email, role, token hash, expiry, status)
  - [x] `pushTokens`, `notificationPreferences`
  - [x] `auditLog` (actor, action, target, summary; timestamp from `_creationTime`)
- [x] Add indexes for every access path, for example `by_guardianId`, `by_classId_and_status`, `by_status_and_publishAt`, `by_enquiryId` (single-school deployment, so no `by_school`).
- [x] Use `v.id()` references, explicit status unions and timestamps (`_creationTime`, `updatedAt`). Store dates as ISO strings or epoch milliseconds, not display strings.
- [x] Move shared enums and status unions into `packages/school-core`, so both frontends and the backend use the same values.
- [x] Run `typecheck:backend` and deploy the schema to dev.

**Exit criteria:** the schema deploys, every current mock entity has a table, and every planned query has an index.

---

## Phase 2 — Seed data and developer workflow
Goal: a realistic dev database built from the current fake data.

- [x] Write an `internalMutation` seed (`seed.ts`) based on `initialState` and `children` in `school-core`.
- [x] Seed one school, the 5 demo users with their roles, learners, guardian links, notices, events, resources, enquiries, attendance and conduct.
- [x] Add a `reset` internal mutation that is blocked on production.
- [x] Add root scripts such as `seed:backend`, and document them in `README.md`.
- [x] Add isolated `convex-test` backend tests and GitHub Actions for existing/backend tests and all three TypeScript checks, without cloud credentials.
- [ ] Use a Convex test/preview deployment for CI. *(Deferred by choice: CI uses isolated in-memory test databases; cloud preview provisioning requires a later decision and credentials.)*

Development verification: `npm run seed:backend` pushes and seeds `dev:diligent-bass-226`; `verify:backend` checks table counts, document/foreign-key references and six real sample text files. The seed creates five credential-free profiles, six fictional learners, five notices (four published), four events, four resources, an unanswered consent request and a Due R250 charge, plus related records. Clients still use mocks. `reset:backend` explicitly clears all dev application data before reseeding; command and server guards block other deployments. See [the backend guide](packages/backend/README.md) for fixture identity, bounded reset and recovery contracts.

**Exit criteria:** a fresh dev deployment can be seeded with one command and shows the same content as the mock app.

---

## Phase 3 — Authentication and identity
Goal: replace the demo login (`src/features/school/demo-auth.ts`) with real identity on both clients.

- [x] Install and configure the chosen auth provider (`auth.config.ts`, plus provider keys in Convex environment variables).
- [x] Web: wrap the root in `ConvexProviderWithAuth`/`ConvexAuthProvider`, and replace `signIn`/`signOut` in `src/features/school/store.tsx`.
- [x] Web: rebuild `/signin` on top of the real provider while keeping the current branded design, and remove the hard-coded demo credentials.
- [x] Expo: add sign-in screens, with secure token storage (`expo-secure-store`) and session restore.
- [x] Add a `users.current` query that returns the profile, roles and linked learners. Both clients use it in place of `account` and `role`.
- [ ] Staff onboarding: an Administrator creates an invitation, an email is sent, the new user accepts, and a `users` row with the role is created. *(Implemented and tested with mocked email, including role grants, recipient matching, expiry and replay rejection. Live email delivery/acceptance awaits Resend configuration.)*
- [x] Parent onboarding: invite by email/phone, or match the school-registered guardian email to `guardianLinks`.
- [ ] Add password reset, sign-out everywhere, and handling for deactivated accounts. *(Implemented: reset with mocked email and real password hashing is tested; live dev sign-out everywhere and deactivation/session checks pass. End-to-end live reset-email delivery remains pending.)*
- [x] Keep demo accounts only on dev/preview deployments, behind a flag.

Status: web and Expo use Convex Auth and the same server identity contract. `verify:auth:dev` verified real password sessions from two independent HTTP clients, matched parent identity/linked learners, staff roles and immediate cross-session revocation. Dev credentials are random and stored only in ignored `.env.auth.local`, gated by the exact dev URL plus `ENABLE_DEMO_ACCOUNTS=true`. Public client types are checked against generated APIs. School-module data still uses mocks; physical native storage/deep links are not device-tested.

Remaining external setup: configure deployment-only `RESEND_API_KEY`, a verified `AUTH_EMAIL_FROM`, and a recipient-reachable `SITE_URL`, then verify invitation, magic-link and recovery delivery. No live email was sent during implementation.

**Exit criteria:** a parent can sign in on both web and Expo and see the same identity, and staff can sign in on web with their real roles.

---

## Phase 4 — Authorization and server rules
Goal: every function decides access from the server-side identity, never from arguments sent by the client.

- [x] Write helpers in `convex/lib/auth.ts`: `requireUser`, `requireRole(...)`, `requireGuardianOf(learnerId)`, `requireTeacherOf(classId)`.
- [x] Wrap functions with custom builders (`authedQuery`, `staffMutation`, …) so no endpoint can skip the checks.
- [x] Parents see only published content addressed to their learners' grades, classes or groups, or to the whole school. This logic moves from `visibleNotices` to the server.
- [x] Teachers see only their assigned classes. Principals and Administrators see the whole school. Finance staff see payments only.
- [x] Port `canAccessDemoModule` / `STAFF_MODULES` to a shared permission matrix in `school-core`. The UI uses it to hide screens and the server uses it to block access.
- [x] Never accept caller `userId` or `role` as authorization arguments. Load documents by id, then check ownership. Administrator invitation recipient grants are validated target data.
- [x] Require audit entries through authenticated mutation builders; audit existing invitation, role and guardian grants individually. Publish, report-release and payment-status endpoints must use these builders when introduced in Phases 7/9.
- [x] Run the `convex-authz` audit.

Verification: shared module permissions drive web gates/navigation and protected server reads. Parent notice/resource audiences, teacher class scope, Finance restrictions, combined guardian grants, direct-ID access, session revocation, invitation grant limits and audit rollback are covered by isolated backend tests. The four-shape authz audit and endpoint exceptions are recorded in [the authorization contract](packages/backend/AUTHORIZATION.md). Real dev HTTP sessions verify guardian/class/publication/Finance/signed-out boundaries. School-module screens remain mocked until Phase 5; pending Phase 3 live-email checks are unchanged.

**Exit criteria:** negative tests prove that a wrong-role user, a different parent and a signed-out user are all refused.

---

## Phase 5 — Shared client data layer
Goal: both frontends use the same API, and screens no longer depend on mocks.

- [x] Web: create one `ConvexReactClient` and provider in `src/router.tsx`/`__root.tsx`. For SSR-safe data, use `@convex-dev/react-query` with the existing TanStack Query setup.
- [x] Expo: add `ConvexProvider` in `apps/expo/src/app/_layout.tsx` with `EXPO_PUBLIC_CONVEX_URL`.
- [x] Replace runtime `SchoolRepository` use with shared per-module hooks and authorized normalized projections (`schoolData.list`), retaining mocks for tests/previews. Keep `school-core` free of provider code: types and pure rules only.
- [x] Refactor `useSchool()` in both `store.tsx` files so it keeps UI state only (selected child, offline banner, toasts). Server data comes from Convex hooks.
- [x] Handle loading (`undefined`), empty and error states in the shared UI components. Use optimistic updates where interactions must feel instant.
- [x] Remove the simulated offline toggle. Use the Convex connection state for the real offline banner.
- [x] Keep the mock repository only for unit tests and Storybook-style previews, if they are still useful.

Verification: both clients use `@school-connect/backend/react` through owning adapters. Private module subscriptions wait for restored identity, and the web provider reuses its router-owned client with the TanStack Query bridge. Lists are bounded previews with explicit truncation; detailed module features/history/pagination remain Phase 6. Notice read/acknowledgement is the first audited, optimistic shared write; other submissions remain Phase 7. Browser verification signed into web and Expo web separately, opened a real database-ID notice link through session restoration, and observed a web acknowledgement on the already-open mobile browser without reload. This is browser coverage, not physical Android/iOS testing. See [the client data contract](packages/backend/CLIENT-DATA.md).

**Exit criteria:** both clients render from Convex, and a change made on web shows up live in Expo.

---

## Phase 6 — Module migration: reading data
Goal: every screen reads real data. Do this one module at a time, in this order.

- [x] Home / dashboard counts: unread notices, pending actions, upcoming events
- [x] Updates / messages: list, search, filter by category, detail, mark as read
- [x] Calendar: month and agenda views, event detail, `.ics` download
- [x] Children / learner profiles: details, teacher, timetable
- [x] Resources: category and search
- [x] Payments: charges and history per learner
- [x] Forms: outstanding consent requests
- [x] Contact: the user's enquiries and threads
- [x] Staff views: groups, attendance registers, conduct, reports, people, settings, audit
- [x] Add pagination (`paginationOpts`) to long lists: notices, audit, enquiries

Verification: 31 frontend tests, 41 isolated backend tests and 3 fixture command tests pass. All three TypeScript checks, the web production build, Android/iOS/web exports and Expo doctor (21/21) pass. Changed web files lint with no errors; Expo lint passes. Repository-wide lint retains 4,763 existing errors outside this work. Backend functions/component/schema and insert-only timetable fixtures are deployed and verified on `dev:diligent-bass-226`.

Browser checks verified desktop dashboard totals, calendar month/ICS export and learner timetable; Expo web verified learner timetable and the teacher's scoped class roster. Mark-as-read on web updated an already-open Expo notice detail without reload and reduced the dashboard unread count. Pagination beyond 50 records, empty filtered pages, direct details, private thread/contact/report denials, aggregate invalidation and reset cleanup are covered by isolated tests. Native calendar sharing still needs a compatible device/binary. Other school writes, secure downloads and payment processing remain later phases.

**Exit criteria:** no screen imports `initialState` or `createMockRepository`.

---

## Phase 7 — Module migration: write workflows
Goal: every journey the scope document describes is stored on the server and enforced there.

- [x] Notices: draft → review → publish/schedule. Resolve the audience, create `noticeReceipts`, and record acknowledgements.
- [x] Events: create, edit, cancel, with audience targeting.
- [x] Consent: submit a response (who, when, contact phone) with server-side validation, and let staff see a response overview.
- [x] Enquiries: create, reply, assign to a department or person, resolve, reopen.
- [x] Attendance: take a register per class and day, with corrections recorded in the audit log.
- [x] Conduct: add merit/demerit entries, visible to parents according to policy.
- [x] Reports: upload → review → release per term. Parents see only released reports.
- [x] People: invitations, role changes, deactivation.
- [x] Settings: school profile and feature flags, editable by Administrators only.
- [x] Profile: notification preferences and contact details.

Verification: 33 frontend tests, 52 isolated backend tests and 3 fixture-command tests pass (88 total). All three TypeScript checks, web production build, Android/iOS/web exports, Expo lint and doctor (21/21) pass. Changed web files have no lint errors; repository-wide lint retains 4,763 pre-existing errors. The backend suite passes with two workers; concurrent build/test runs exceeded the old 5-second limit in two read tests without functional failures.

Browser checks created an enquiry in Expo web, assigned/replied/resolved it from web, observed the live reply on the open phone view and confirmed status after reload. Teacher draft/review and Administrator publication reached the guardian Expo feed. A PDF uploaded on web was reviewed/released and downloaded by the linked guardian in Expo web. A separate real-session dev API check proved concurrent and sequential report-upload retries reuse one Draft report. Dev functions/schema/indexes and fixture-reference verification pass on `dev:diligent-bass-226`.

Both clients use the same authorized server-described actions; sensitive actions confirm intent, failures retain drafts, and writes audit atomically. Reports use a narrow authenticated PDF-byte path (512 KiB maximum) to complete this phase; general storage/upload URLs, attachments, receipt PDFs and cleanup remain Phase 8. Live invitation email still awaits deployment-only Resend/verified-sender configuration, and physical Android/iOS picker/sharing acceptance remains outstanding. Notification delivery and payment processing retain their later phases. See [write workflow contracts](packages/backend/WRITE-WORKFLOWS.md).

**Exit criteria:** every journey in the scope PDF works end to end on both clients, and its state survives a reload.

---

## Phase 8 — Files and document storage
Goal: real files replace the sample previews.

- [x] Upload through Convex storage: a mutation issues an upload URL, the client uploads, and a mutation saves the `storageId` with metadata.
- [x] Serve files through authorised queries only, which return short-lived URLs after checking access.
- [x] Use this for notice attachments, resources, learner reports (PDF) and receipts (PDF).
- [x] Generate receipt PDFs in an action, or render them on the server.
- [x] Enforce file type and size limits, and clean up orphaned files on a schedule.
- [x] Expo: preview or download files using `expo-file-system` / `expo-sharing`.

**Exit criteria:** staff can upload a report and only the linked guardian can open it.

Status: implemented on both clients and deployed to the linked development backend. Session-owned upload URLs support PDF (10 MiB), PNG/JPEG (5 MiB), draft notice attachments and reviewed/released reports; resources require school publication. Authenticated queries return two-minute gateway links that recheck current scope, live session and file snapshot at redemption. Receipt PDFs embed the supplied crest/Open Sans and require existing matching successful payment records; payment processing remains Phase 9. Hourly bounded cleanup preserves unrelated and attached storage. Legacy byte actions retain their 512 KiB compatibility limit. See [file contracts](packages/backend/FILES.md).

Verification: 34 frontend, 59 backend and 3 CLI tests; TypeScript checks, web build and all Expo exports. Live dev HTTP checks cover direct upload POST, >512 KiB PDFs, publication/release, Finance denial, retry deduplication, removal/archive and sign-out revocation. Browser QA verifies web upload/review/release followed by linked-guardian Expo web download. Receipt PDFs are validated/rendered from isolated fixtures; there is no live payment-provider evidence. Physical Android/iOS picker/sharing acceptance remains outstanding.

---

## Phase 9 — Payments
Goal: a payment is marked "Paid" only after the provider confirms it.

- [ ] Configure the chosen provider in sandbox mode, with keys in Convex environment variables.
- [ ] A Convex action creates a checkout session, and the client redirects (web) or opens the in-app browser (Expo).
- [ ] An `http.ts` webhook endpoint verifies the signature, saves to `paymentEvents` (ignoring duplicates), and updates the payment status.
- [ ] Track statuses: Due → Pending verification → Paid / Failed / Refunded, with retry.
- [ ] Create a receipt (Phase 8) and send a notification (Phase 10) when a payment succeeds.
- [ ] Finance view: reconciliation list, manual verification with an audit log entry, CSV export.
- [ ] Never trust the status the client reports after its redirect. Display only.

**Exit criteria:** a sandbox payment completes from both clients and the receipt appears on both.

---

## Phase 10 - Notifications and scheduled jobs
Goal: families are told about new content, and time-based work runs on the server.

- [x] Expo push registration, session-bound device ownership, native permission/refresh/response handling and server Expo API transport.
- [x] Email implementation: existing invitations/password recovery plus queued urgent notices through Resend.
  - [ ] Activate a verified sender/API key and reachable HTTPS school URL; verify an actual mailbox receives the message.
  - [ ] Receipt emails remain deferred with Phase 9 payments.
- [x] Respect notification channels, muted categories and Johannesburg quiet hours; recheck current access/preferences at dispatch and before every send.
- [x] Publish reviewed scheduled notices with revision-checked `ctx.scheduler.runAt`, active publishing authority and module flags.
- [x] Hourly consent reminders, expired invitation status/audits and the existing owned-file cleanup, with bounded jobs and deduplication.
  - [ ] Payment reminders remain deferred with Phase 9; daily digest is optional and deferred.
- [x] Record actual provider acceptance/confirmation/failure separately from in-app availability, read and acknowledgement; show paginated private/staff delivery history and confirmed retry controls on both clients.
- [ ] Build/install runtime 1.0.3 with EAS push credentials and verify a targeted notification on a physical phone.

**Exit criteria:** publishing a notice sends a push to the targeted parents' phones, and a scheduled notice goes live on time.

Status: implementation deployed to the linked development backend. The public EAS project and development delivery switch are configured. Live dev HTTP checks verified scheduled publication, honest Blocked statuses, scoped personal/staff histories and retry denials. Resend sender/key and a physical registered phone are absent, so live phone/mailbox acceptance remains pending; no delivery is claimed. Transactional email keeps its existing verification/recovery rules, and payment messages remain deferred by request. See [notification contracts and activation](packages/backend/NOTIFICATIONS.md).

Verification: 70 backend, 36 frontend and 3 CLI tests pass, including actual Workpool execution with mocked providers and idempotent email retry. TypeScript checks, Expo doctor, web build, all-platform Expo export and both notification-history browser checks pass. Exports/browser checks cannot substitute for live provider/native-device acceptance.

---

## Phase 11 — Data import and go-live data
Goal: load the school's real records safely.

- [x] Define CSV templates for learners, classes, guardians and staff.
- [ ] Build an Administrator import flow that validates rows, previews them, reports errors per row and writes in batches. *(Implemented and isolated-tested on web; awaiting a browser journey against a deployment and authenticated Convex codegen.)*
- [x] Rule out duplicates by matching on school learner number and guardian email.
- [ ] Before inviting parents, get POPIA-compliant consent and privacy notice acknowledgement.
- [ ] Do a test import into a preview deployment, have the school sign it off, then import to production.

**Exit criteria:** production holds the real school roster, and the school has signed it off.

Status: `@school-connect/core/imports` owns templates, RFC 4180 parsing, row validation, formula-prefix refusal and in-file duplicates; `convex/imports.ts` adds Administrator-only preview and audited 50-row commits that re-validate every row, match learners by number and guardians by email plus learner, never erase stored values from blank cells, cap grades at 50 and count each batch row once by content digest (replays cannot inflate completion). Guardians and staff are staged in `rosterContacts` only: no accounts, roles, links, invitations or email. Activation awaits the school's POPIA decision. See [import contracts](packages/backend/IMPORTS.md).

Verification: builder runs under Node 24/npm 11 pass 46 frontend, 82 backend and 3 CLI tests, TypeScript, lint, web build and Expo export. QA and security reviewed each change and the combined integration, independently rerunning tests, lint and build under Node 22. Not yet done: authenticated codegen (`_generated/api.d.ts` carries the two lines codegen adds), dev deployment, browser import journey, preview rehearsal, school sign-off and any real-data import.

---

## Phase 12 — Testing and quality
Goal: prove the backend is correct and secure.

- [ ] Write `convex-test` unit tests for each module's queries and mutations.
- [ ] Write authorization tests, including the negative cases from Phase 4.
- [ ] Update the existing Vitest suites (`src/test/*`) to use Convex test fixtures in place of the mock repository.
- [ ] Add end-to-end checks for the key journeys: excursion (notice → consent → payment → receipt), enquiry, report release.
- [ ] Run `typecheck:web`, `typecheck:expo`, `typecheck:backend`, `npm test`, `npm run lint` and `export:expo` in CI. *(CI runs tests, all three typechecks, root lint and Expo lint; `export:expo` is not yet in CI and the workflow has not run on GitHub since this change.)*
- [ ] Run the `convex-reviewer` and `convex-launch-readiness` audits.

**Exit criteria:** CI passes and there are no unresolved high-severity findings.

Status: root lint is clean after excluding local agent tooling folders and formatting-only fixes. Compatible dependency updates (Vite 8.3.6, Vitest 4.1.12, node-forge 1.4.3, seroval 1.7.10) reduce `npm audit` from 23 to 18 entries (6 to 4 high) in builder fresh-cache runs; security independently confirmed the final 18 (a default npm cache reported 61 meta-vulnerability entries with the same five advisory packages). Remaining advisories (decode-uri-component via Expo Router, zod 3, glob, minimatch, uuid) require compatibility and reachability review; npm proposes only major-version fixes for some of them. They are tracked in [SECURITY.md](SECURITY.md). End-to-end journeys and the Convex audits are not done; the excursion journey depends on Phase 9.

---

## Phase 13 — Deployment, operations and launch
Goal: production is configured, monitored and recoverable.

- [ ] Deploy the production Convex deployment (`npx convex deploy`) with production environment variables.
- [ ] Dokploy: pass `VITE_CONVEX_URL` (production) as a Docker build argument, then rebuild the web image.
- [ ] EAS: set `EXPO_PUBLIC_CONVEX_URL` per build profile, and build new native binaries (new runtime version, because native modules were added).
- [ ] Set up a custom domain and add it to the auth provider's allowed origins.
- [ ] Set up backups and run a restore drill (`convex-backup`), and document the recovery runbook.
- [ ] Set up monitoring: Convex logs and insights, and error capture on both clients.
- [ ] Remove demo accounts from production. Update `README.md`, `FRONTEND.md` and `AGENTS.md` so they no longer say "mock data".
- [ ] Run a pilot with one grade, collect feedback, then roll out to the whole school.

**Exit criteria:** both clients run against production Convex, monitoring and backups are verified, and the school has signed off.

Status: [OPERATIONS.md](OPERATIONS.md) prepares the production, backup/restore, monitoring and pilot runbook and lists the missing inputs. Nothing has been executed; no production deployment exists. Payment-dependent launch checks remain pending with Phase 9.

---

## Open decisions
| Decision | Options | Needed by |
| --- | --- | --- |
| Auth provider | **Decided: Convex Auth** | Phase 3 |
| Payment provider | PayFast / Yoco / Paystack — open | Phase 9 |
| Notifications | **Decided: Expo push + Resend email** | Phase 10 |
| Parent web access | Web portal for parents too, or mobile only | Phase 3 |
| Data retention policy | School POPIA policy — open | Phase 11 |
| Production deployment | Deferred to Phase 13 | Phase 13 |
