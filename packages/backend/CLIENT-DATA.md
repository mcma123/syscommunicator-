# Shared live client contract

## Boundary
`@school-connect/core/live` defines provider-independent records, read filters, detail relationships and dashboard state. `@school-connect/core/calendar` provides pure Johannesburg calendar/ICS helpers. The backend client facade is compile-checked against generated APIs; its React export owns subscriptions and optimistic receipts. Server functions never import React.

Both client stores own identity/onboarding and selected-learner UI state. Components use `useWorkflows`, `useRecords`, `useDetail`, `useDashboard` and `useReceipt`; they never mount a repository or copy server records into SchoolState. `useModule`/`schoolData.list` remain bounded compatibility/home previews, not the full-history contract.

## Pagination and independent details
`schoolRead.page({module,learnerId?,parentId?,classId?,search?,category?,from?,to?,outstandingOnly?,paginationOpts})` derives the session actor, checks module and contextual ownership, then paginates one indexed source. Native pagination options and metadata remain intact, including split cursors and read budgets. Pages accept 1-50 candidates; clients load 25 at a time with Convex usePaginatedQuery. Never replace the advancing cursor with an offset or stop because a filtered page is empty.

Audience/scope and substring search filter each source page on the server. Searching the entire history can require Load more, including through empty pages; the UI states this explicitly. Category indexes narrow notices/resources before paging. Calendar month bounds include overlapping events, with candidate starts before the next month; agenda reads all scheduled events. There is no implicit wall clock in a query.

`schoolRead.detail` normalizes the target ID to its module table, loads it directly and repeats document scope checks. Details never depend on a loaded list. Related sections carry only target context and open independent paginated subscriptions: learner reports/conduct/attendance/timetable, charge payment history, enquiry conversation, class roster, register marks and consent responses.

Finance reads financial records without acquiring academic access. Teachers see assigned classes; guardian membership alone never exposes unreleased reports or hidden conduct. Families see only their own enquiries and external replies. Assigned teachers may see internal thread notes; another guardian's response contact details remain private. File metadata is readable, but storage IDs/URLs are not exposed by these projections. Files use the protected upload/grant contract in FILES.md.

## Dashboard counts
`dashboard.current({learnerId?,now})` returns ready=false until its complete, authorized projection has been built; clients show an updating state rather than partial totals. `dashboard.advance` authenticates and calls an independently authenticated internal transaction, processing at most 25 candidates or stale items per step. The client continues while progress advances. Reloading resumes an interrupted build.

The aggregate component mirrors dashboardItems transactionally, in namespaces owned by a user/learner build. Counts are exact across the complete authorized dataset: unread published notices, pending consent/charges/required guardian acknowledgements, upcoming scheduled event starts, and outstanding charge amounts in cents. The client supplies minute-rounded time; advancing the clock updates upcoming counts without a query clock or rebuild.

The build revision includes canonical source version, the reader's receipt revision, roles, active linked learners and their class/grade, teaching assignments and group membership. Audited canonical changes invalidate source versions atomically; own receipt updates invalidate only that reader. Old projections are hidden immediately and cleaned in bounded transactions before rebuilding. No stale aggregate is returned under changed membership. Direct administrator database edits bypass application auditing: rerun insert-only `seed:backend` to invalidate/rebuild development caches. Future canonical writers must use the audit writer. Derived cache steps are not business submissions and are the documented audit exception.

## Sessions, failures and connection
Web creates one router/request-scoped ConvexReactClient with the TanStack Query bridge. Private subscriptions wait for restored browser identity; no private SSR loader prefetch or token serialization is added. Expo owns one client above its navigator. Active staff roles or linked guardians enter Expo; shared module grants control screens and navigation, with independent server enforcement. Live disabled-module keys filter navigation and server module/related reads; settings and identity remain available through supported switches.

Memoized detail/dashboard query maps prevent subscription loops. SchoolDataBoundary catches paginated query failures and remounts the consumer on retry; detail failures expose safe unavailable/retry UI. Session changes unsubscribe and clear visible private data. Actual socket state distinguishes initial connection from disconnection; cached reads stay visible during reconnection. No persistent offline-write queue exists.

Expo web remains a SPA for database-ID URLs; no private IDs are enumerated at export. Hosting needs index.html fallback. Protected routes remain mounted behind the session-restoring overlay to preserve deep links.

## Receipts and calendar export
`notices.setReceipt({noticeId,acknowledge})` requires a Published notice readable by the current actor. Mark-as-read is available to authorized staff and guardians; acknowledgement additionally requires guardian audience membership. The server derives receipt identity from the session, preserves timestamps and audits atomically. Optimistic updates affect only existing authorized preview, paginated and detail caches and roll back on failure. Screens disable writes while offline/pending and display failures.

ICS uses stored event starts/ends, UTC times for timed events and Johannesburg dates/exclusive ends for all-day events. Text is escaped and UTF-8 lines folded. Web downloads a Blob; native writes a cache file and opens expo-sharing. This export needs no backend storage URL. Native sharing requires a compatible binary and device verification.

School submissions now use the Phase 7 command/form contract in WRITE-WORKFLOWS.md. Phase 8 adds notice/resource/report upload reservations and expiring protected downloads, including verified-payment receipt PDFs. Notifications and real payment processing retain their dedicated phases; screens never simulate a save or payment.

## Verification
Backend tests cover permitted/denied roles, more than 50 records, empty filtered pages, independent details, parent context validation, hidden notes/unreleased reports, other guardian contact privacy, exact aggregate counts and receipt/membership invalidation. Root tests use real Convex hooks with local watches to verify stable subscriptions, native cursor progression/filter reset, disabled sessions and direct details; calendar tests cover date boundaries, spanning events, all-day ends, escaping and line folding.

Run both suites, all three TypeScript checks, the web build and all Expo exports. Browser checks cover desktop and Expo web; exports and browser tests do not establish physical Android/iOS sharing, secure storage or live email delivery.

## Write forms and receipts
`workflowForms.forms` returns only the current actor's available operations, initialized field values and bounded human-labelled choices. This is presentation metadata; every submit independently authenticates, validates known input keys and current document state, and checks class/guardian/parent scope. The client facade uses canonical target-ID unions; dynamic field strings are normalized/validated on the server. Clients call store useWorkflows, which delegates to the shared hook for mutations, file upload reservations/download grants and existing invitation actions.

Both platforms require confirmations where described by the server, disable pending/offline submissions and retain input after failure. Success follows a resolved server call. A newly created record stays addressable for its next workflow step; live paginated views update independently. Staff manage filters expose private workflow states only after server checks. Notice details include paginated guardian read/acknowledgement receipts for authorized notice owners/whole-school staff; invitation history never exposes token hashes.

## Notification delivery
`useSchoolNotifications` owns stable configuration subscriptions, private/staff-scoped native pagination and audited retry requests. Each client exposes it through useNotifications; profile and authorized notice details render it. Accepted means provider request acceptance; Provider confirmed means push-service handoff or authenticated email delivery confirmation, not screen display/read. `deliveredAt` remains in-app availability; `notificationDeliveredAt` is separate transport evidence. Native device/response handling lives entirely in the Expo store/bridge and has a web no-op. NOTIFICATIONS.md owns activation and session/preference rules.

## Ads
- `useSchoolAds(enabled)` subscribes to `ads.active` with a minute-rounded `now`, so ads appear and expire on schedule without reloading. Both clients show a home spotlight carousel and an optional popup once per device per ad revision (dismissals stay on the device). Staff manage ads through the `ads` module list, detail preview and server-described forms.
