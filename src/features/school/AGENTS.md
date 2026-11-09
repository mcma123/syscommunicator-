# School feature

## Purpose

- Own school module screens and the shared desktop/mobile web experience.

## Ownership

- `auth-provider.tsx` reuses the router-owned Convex client and owns the Convex Auth provider and resilient browser token storage.
- `demo-login.tsx` owns branded real password/email/verification/recovery UI; `demo-auth.ts` re-exports shared module visibility only, with no demo credentials. Existing demo-named CSS/file names are presentation compatibility.
- `demo-session-gate.tsx` gates module rendering using server identity and session state; `account-management.tsx` owns acceptance, Administrator invitations and account session controls.
- `store.tsx` owns identity/onboarding, selected learner, feedback and client hook adapters. `useNotifications`, `useWorkflows`, `useRecords`, `useDetail` and `useDashboard` delegate to shared backend React hooks; `useModule` retains bounded preview compatibility and `useReceipt` delegates to the audited receipt mutation. `shell.tsx`, `portal.tsx`, and `components.tsx` own module presentation; the shell top bar holds the moon/sun dark-mode toggle from `@/lib/theme`.
- `home.tsx` owns the home dashboard: campus banner with greeting and live term, linked summary cards from `useDashboard`, the latest-updates feed with category tabs, upcoming events (paging past filtered pages, falling back to labelled recent events), Needs your attention (pending consent forms and due charges) and quick links. Every section is gated by module grants and has its own data boundary; records open in the portal-owned detail dialog through `onOpen`.
- `module-views.tsx` owns the styled Messages (notice cards with category tabs), Calendar (month grid with event chips and day agenda, grouped agenda with past events dimmed), My children/Learners (learner cards opening detail tabs directly) Payments (summary, honest online-payments notice, charges/history table), Forms & consent (grouped to-complete/completed cards with due and past-due state), Resources (category tabs and file rows with type, size and updated date) and Contact school (school office card from the live school record plus enquiry conversation cards) presentations used by `RecordBrowser`. `components.tsx` owns the shared NoticeCard, EventRow, StatusTag, Placeholder and Empty pieces; `format.ts` owns Johannesburg date, rand and status-tone helpers.
- `workflow-panel.tsx` renders server-provided school actions, confirmation, persistent success feedback across form transitions, validation/pending/offline state and PDF file selection/download; components use the store adapter, not provider calls.
- `notification-panel.tsx` renders own/staff-scoped paginated delivery history, honest acceptance/provider-confirmation labels, configuration feedback and confirmed retry requests through the store adapter. It never exposes device tokens or provider IDs.
- `ads.tsx` owns the Ad Center presentation: the home `AdBanner` spotlight carousel (image or muted looping inline video, https link button with `noopener`, dots/arrows, auto-advance paused on hover/focus and off under reduced motion), `AdPopup`, one dialog after every login stepping through all popup ads (seen `id:revision` keys stored with the sign-in session start from `ads.session`, so reloads stay quiet and a new login shows it again), staff `AdList` cards and the `AdPreview` banner preview in the detail dialog. `ad-composer.tsx` owns the one-step Ad Center editor (headline, caption, schedule, audience, popup, optional button link toggle) with a drag-and-drop zone: client-side type/size/10-item checks, previews, per-file progress, remove/reorder, then `adSave` followed by direct R2 uploads; `AdComposerLauncher` opens it from the Ad Center page and the ad detail dialog embeds it while `WorkflowPanel` (`hide`) shows only status actions. `useAds`, `useAdMedia` and `useAdUploader` in `store.tsx` adapt the shared hooks. Ad media arrives as signed gateway links (FILES.md).
- `roster-import.tsx` renders the Administrator People → Import roster flow: template download, local parse, server preview in chunks, confirmed chunked commit and recent batches through the `useRosterImport` store adapter. It states that guardians/staff are staged only.
- Routes live in `src/routes/`; reusable domain contracts remain in `packages/school-core/`.

## Local Contracts

- Use Convex Auth actions and `@school-connect/backend/client` through SchoolProvider. Never restore identity from a browser account ID, trust a selected role, or include hard-coded passwords.
- Derive identity, staff roles and linked learners from `users.current`. Block missing, deactivated, revoked and unlinked accounts before module rendering. Use the shared school-core module matrix for navigation and route gates, combining staff roles with Parent only when active learners are linked. Finance alone sees payments and basic home/profile navigation; teachers cannot enter people/settings/audit. Server endpoints independently enforce record scope.
- Do not import mock repositories, fixture learners or SchoolState into runtime presentation. Render paginated live records, independent details and explicit loading/empty/error/retry states. Search/category filters run on the server over successive pages; retain Load more even when a filtered page is empty. Filter using server learner IDs; receipts persist and update optimistically with rollback on failure.
- Shared live query definitions must be memoized across renders; the real-subscription regression test protects against render loops.
- Browser tokens use provider-managed namespacing/storage, with in-memory fallback when browser storage is blocked. Do not log tokens or passwords. Session restoration must remain SSR-safe and show the supplied crest, school name, tagline and accessible status.
- Password signup requires school registration/invitation and email verification; password reset uses an email code. Magic-link URLs require explicit confirmation and email matching. Keep invitation tokens until acceptance and remove used token parameters from the URL.
- Only server-confirmed Administrators can send real staff/guardian invitations. Never claim an email was sent if the action fails; disable email entry flows when configuration is absent. School workflows save through audited server commands; never simulate saved or paid status. Payment processing remains unavailable.
- Keep named leaf URLs, Open Sans, school red/gold palette, existing module design and supplied crest. Use schoolConfig names. Dev records remain fictional. Offline banners derive from the actual Convex socket; there is no simulated offline toggle. Dashboard counts, module pagination/history, learner related sections and calendar month/agenda/ICS export are live. Publication/scheduling, event/consent/enquiry/attendance/conduct/report/admin/profile writes are connected. Notice attachments, resources and report PDF uploads use session-owned Convex upload reservations; protected downloads use expiring links. Receipt PDFs derive only from verified stored payments. Payment processing remains Phase 9.

## Work Guidance

- `portal.tsx` renders `HomeDashboard` for the home module and owns its detail dialog. `RecordBrowser` keeps search, filters, pagination and the detail dialog (which can open on a named related tab) and delegates styled lists to `module-views.tsx`; role-aware titles/descriptions live in `portal.tsx`. It also owns paginated module browsers, related detail tabs, dashboard counts, staff workflow-record filters, people/invitation history and calendar views/downloads. Module flags from live identity filter navigation and route gates.
- PDF uploads are limited to 10 MiB, images to 5 MiB. Downloads fetch a two-minute gateway URL after current scope checks; only authorized staff or released-report guardians may fetch learner reports. School email invitations show missing deployment configuration explicitly. Wrap paginated consumers in SchoolDataBoundary so server failures offer retry without exposing diagnostics.
- Use the existing UI primitives and global styles; maintain matching modules across desktop and mobile web.
- Update root `FRONTEND.md` when delivered functionality or prototype limits change.

## Verification

- From the root, run `npm run build` and `node node_modules/typescript/bin/tsc --noEmit` for feature changes.
- `npm test` covers provider delegation, server identity/loading/blocked session states, credential-free form rendering, module visibility, storage fallback and shared live data/connection behavior, plus routing/core/mobile checks. Backend auth flows are covered by `test:backend`; neither suite is native device coverage.

## Child DOX Index

- None. This doc owns the entire school feature subtree.
