# Native school feature

## Purpose
- Own the premium school frontend for Expo Android, iOS and web.

## Ownership
- `parent-screens.tsx` owns paginated module lists, search/category/outstanding filters, dashboard counts, calendar month/agenda views, home/profile and independent database-ID details with related history tabs.
- `workflow-panel.tsx` renders shared server-described actions with native fields, confirmations, persistent success feedback across form transitions, pending/offline states and server validation. `report-files.ts` selects PDFs/images and downloads protected links into temporary cache for sharing; `.web.ts` uses browser file selection/download.
- `ui.tsx` owns native cards, branding, selected-learner controls, keyboard-aware screens and feedback.
- `store.tsx` owns auth/onboarding and selected learner, and adapts shared backend hooks through `useNotifications`/`useWorkflows`/`useRecords`/`useDetail`/`useDashboard`/`useReceipt`; `useModule` retains bounded home previews.
- `device-notifications.tsx` registers session-bound Expo tokens, handles foreground/token refresh and fixed safe notice/form response routes; `.web.tsx` is a no-op. Initial sign-in/manual retries may request permission; reconnection/foreground refresh does not nag. Native sign-out unregisters the current session before sign-out; server revocation independently blocks sends.
- `notification-panel.tsx` renders paginated own/staff delivery states, provider-confirmation limits, registration/settings feedback and explicit retry controls through the store adapter.
- Staff Learners (`ModuleContent` in `parent-screens.tsx`) browse grade folders → class folders → class learners (opening the learner detail screen), or search all learners; parents keep their children list.
- `ads.tsx` owns the native Ad Center presentation (each picture/video shows a loading indicator until ready and a calm message on failure): a manually swiped home spotlight carousel (no automatic motion) with `expo-image`/`expo-video` media and https link buttons, a popup `Modal` (no animation) shown after every login stepping through all popup ads (seen keys stored with the session start) and the staff `AdPreview`. `local-store.ts` is the shared SecureStore/browser/memory store used for auth tokens and ad dismissals. `ad-composer.tsx` is the native Ad Center editor (fields, multi-file picker via `report-files` `pickAdFiles`, item list with remove/reorder, uploads to R2 through `useAdUploader`); the carousel/popup show every item of an ad.
- `auth-provider.tsx` owns the single native Convex client and SecureStore/browser session storage. `signin.tsx` owns sign-in/invitation UI and mounted Stack.Protected navigation.
- `parent-model.ts` retains pure legacy mock selectors/validation for tests only; runtime screens do not import it. `module-placeholder.tsx` retains its route adapter name but renders authorized live staff modules.

## Local Contracts
- Active identities need linked learners or explicit staff roles to enter. Navigation and screens use the shared module matrix. Identity comes from the server; no native staff role switch or credentials in config/bundles.
- Components call owning client adapters, not Convex directly. Module data comes from `@school-connect/backend/react`, never a mock repository. Keep auth tokens in SecureStore natively and browser storage on web, with in-memory fallback.
- Retain verification/reset/magic-link/invitation flows and the exact wgjsconnect://signin return route. Show missing email configuration and failures explicitly.
- Select learners by server ID, with full names; never assume fictional names or IDs. Live queries enforce audience/guardian/class scope.
- Render loading, empty, error/retry and Load more states; empty filtered pages retain pagination. Paginated consumers use SchoolDataBoundary. Derive connection banners from the real socket and keep cached records visible during reconnection. There is no simulated offline switch.
- Notice read/acknowledgement uses an audited mutation and optimistic updates with rollback. Phase 7 school writes are audited and persist across clients. Notice attachments, resources, reports and verified-payment receipt PDFs use shared protected file workflows; payment processing remains Phase 9; never simulate success.
- Detail URLs query their IDs independently of loaded pages; unavailable/out-of-scope records show a safe error state. Learner details expose released reports, visible conduct, attendance and timetable; charges expose payment history and enquiries expose authorized threads.
- `calendar-export.ts` writes an ICS cache file and opens native sharing; `.web.ts` downloads it with browser APIs. Pure calendar generation belongs to school-core. File uploads use Convex reservations (PDF 10 MiB, images 5 MiB). File downloads use two-minute gateway grants that recheck current scope and session at redemption; remove temporary cache files after sharing. Never expose permanent storage URLs; Ad Center media arrives as signed, revocable gateway links (FILES.md).
- Staff can browse draft/review/scheduled notices and cancelled events through the workflow-record filter. People includes sanitized invitation history. Module flags from live identity govern visible navigation and backend access.
- Keep protected routes registered while sessions restore, under an opaque loading overlay. Resolve access after restoration so database-ID deep links are not discarded by the guard.
- Expo web is a SPA; no private database records or fixture IDs are enumerated at export time. Sign-out everywhere invalidates real sessions.

## Work Guidance
- Preserve Open Sans, supplied WGJS crest, red/gold palette, warm white surfaces, rounded cards and existing five parent tabs.
- Use native primitives, accessible controls, safe areas, keyboard-aware forms and visible feedback. No motion on press/navigation.

## Verification
- Run root typecheck:expo, export:expo, check:expo and Expo workspace lint.
- Root tests cover shared live hook states, optimistic updates and pure legacy parent rules. Backend tests cover normalized reads, scope and receipt persistence. Browser QA is distinct from physical native device coverage.

## Child DOX Index
- None.
