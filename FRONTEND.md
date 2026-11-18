# Syscommunicator frontend inventory

## Delivery and limits
The root TanStack Start web app and Expo SDK 57 school app use one development Convex backend. Authentication, identity, paginated module reads, independent details and scoped dashboard counts are live. Records remain fictional development fixtures; no production deployment or school payment processing is provisioned. The school-core mock repository remains available for tests/previews but is not mounted by either runtime provider.

Web retains its module URLs, sidebar and responsive navigation. Expo retains its five parent tabs, supplied SYS logo, Open Sans, pink/navy palette and premium light cards. Native staff screens use server-derived roles and the shared module matrix. Module lists share server-projected records with native cursor pagination, category filters and server search over successive pages. Detail queries open records independently of loaded pages; related tabs expose actual learner histories, class rosters, consent responses and enquiry threads.

Notice read/acknowledgement receipts persist, are audited, and update other signed-in clients without reload. An optimistic update is rolled back on rejection. Phase 7 school actions save through audited server commands on both clients. Phase 8 adds notice/resource/report uploads, two-minute protected downloads, verified-payment receipt PDFs and conservative scheduled cleanup. PDFs support 10 MiB, images 5 MiB; payment processing remains Phase 9. Screens never claim a simulated save or payment.

Web creates one Convex client per router/request and connects the TanStack Query bridge. Private module subscriptions start only after browser identity restoration; SSR shows the branded session/loading gate without prefetching private data. Expo uses one client above its navigator and SecureStore for native tokens. Expo web exports a SPA so database-ID detail URLs work without enumerating private IDs at build time; hosting must use index.html fallback.

Both clients display loading, empty, error/retry and Load more states. Offline/reconnecting feedback comes from the actual Convex socket, with the last received data retained during a disconnect. There is no demo offline toggle. No persistent offline-write queue is implemented.

The web build produces a standalone Nitro Node server. Dokploy uses the root Dockerfile with Node 24/npm 11 and public VITE_CONVEX_URL build configuration. Expo and Convex remain separate deployment concerns. Provider branding, editor hooks and telemetry from the original scaffold remain removed.

## Research
- https://help.d6.co.za/portal/en/kb/articles/d6-communicator-mobile-app-user-manual
- https://d6.co.za/goodbye-grey-connect-app-hello-blue-communicator-app/
- https://d6.co.za/school-solutions/communication_solutions/
- https://d6.co.za/parent-starter-pack-for-d6-communicator/
- https://help.d6.co.za/portal/en/kb/articles/what-are-the-staff-roles-and-permissions-in-d6-communicator

Official d6 materials informed the module structure and workflows; this is not a claimed pixel-identical clone and does not use d6 logos. The user-approved Open Sans font and module design are retained with Syscommunicator product branding and live school content. The web app has a dark mode (moon/sun toggle in the top bar, remembered per browser, defaulting to the device preference) covering the portal, sign-in and loading screens. The home page restores the original dashboard layout on live data: campus banner, linked summary cards, latest updates, coming-up events, items needing attention and quick links. Inside a class folder, Teachers (their own classes), Principals and Administrators can use **Import learners (CSV)**: download the class template (learner number, names, optional date of birth and one optional parent per row), drop the filled CSV, check it against school records and import; parent contacts are staged for the office only (web only). Staff Learners are organised in folders: grades (e.g. Grade 1) open to their classes (Grade 1A, 1B…), which open to that class's learner cards with Reports, Attendance, Conduct and Timetable; teachers see only their own classes and everyone can switch to "Search all learners". The staff Ad Center (`/ads`) lets Teachers, Principals and Administrators drag and drop up to 10 posters, pictures or short videos (stored in Cloudflare R2) with a headline, caption, schedule, audience and an optional button link; parents see running ads as a home spotlight carousel and a popup after every login. Ad details show performance (parents reached, views, clicks, last 14 days); Principals/Administrators have an Advertisers tab (enquiries, status, notes, linking ads) and share the public, sign-in-free **Advertise with us** page (`/advertise`, `/advertise/unsubscribe`), styled for light/dark and phones. Messages, Calendar (agenda and month grid), My children, Payments, Forms & consent, Resources and Contact school use the same card, table and tag styling on live data; payments still state that online payment is unavailable.

## Product branding

- Startup loading uses the supplied SYS logo in the web session screen and native font-loading fallback; the native splash also retains the logo.

- Brand source: https://supportyourschool.co.za/. The app uses SYS pink `#F4024D`, navy `#0B1B42`, pale gray `#F2F3F9`, white and supporting status colours.
- Store/app and phone name: **Syscommunicator**. Product tagline: **Support Your School**. The connected school name remains school content.
- `schoolConfig` in `packages/school-core/src/index.ts` owns the branding labels. Route metadata and school screens consume it.
- `public/logo.png` is the supplied SYS logo, used directly in the app, favicon, and Apple touch icon. A square derivative at `public/icon.png` serves the installable web manifest; matching square derivatives serve Expo launcher icons. No native store listing is provisioned here.

## Live route inventory
- Home: exact unread, pending-action, upcoming-event and amount-due counts after complete scoped aggregate materialization; school identity/term and live navigation.
- Messages: paginated published feed, server search/category filters, independent detail, persisted read/acknowledgement. Staff can mark readable notices as read; guardian acknowledgements retain audience checks.
- Calendar: agenda and month/day views, stored event details and interoperable ICS download/native sharing.
- Learners: actual class/teacher/profile metadata, timetable, released reports, visible conduct and attendance history through related tabs.
- Resources: paginated authorized metadata with category/search; secure downloads remain deferred.
- Payments: per-learner charges and actual stored history/status/receipt references; checkout is disabled.
- Forms: authorized consent requests, outstanding-only filter and scoped response details; submissions remain deferred.
- Contact: own enquiries and paginated conversations; assigned teachers and whole-school staff get their authorized view, with internal notes hidden from families.
- Staff: groups/classes and class rosters, register marks, conduct, reports, people, school settings/flags and chronological audit. Teacher scope uses assignments, never guardian linkage alone. Web retains Administrator email invitation UI, pending email configuration. Web People → Import roster lets Administrators download CSV templates, check classes/learners/guardians/staff files against school records and import them in audited chunks; guardians and staff are staged only, with no accounts, access or invitations (web only; not yet exercised in a browser against a deployment).
- More/profile: permitted navigation and live identity/session controls. Sign-in retains verification, recovery, invitation acceptance and magic-link confirmation.

## Data ownership and remaining work
`packages/backend/CLIENT-DATA.md` defines pagination, independent details, dashboard materialization/invalidation and error handling. Stores own auth/onboarding and selection; server data is never copied into SchoolState. An empty filtered page retains Load more so older matching records remain reachable. Dashboard totals show an updating state until complete and use no query wall clock.

Phase 7 implements publication/scheduling, event changes, validated consent, assigned enquiry replies/status, register corrections, conduct visibility, report review/release, invitations/role/class/deactivation controls, settings and profile preferences. Protected storage downloads are implemented in Phase 8; Phase 10 implements notifications with live activation checks pending; provider payments remain deferred. Native calendar sharing needs a compatible binary and device verification. No production parity or exact d6 equivalence is claimed.

## Authentication delivery status
Both clients use Convex Auth and the same identity contract. Active linked guardians and explicit staff roles enter Expo with authorized navigation and school actions. Revoked/deactivated sessions are blocked. Development passwords live only in ignored .env.auth.local and require the exact development deployment and flag.

Verification/recovery/invitation email flows are tested with mocked transport; live delivery still needs RESEND_API_KEY, a verified AUTH_EMAIL_FROM and a reachable SITE_URL. Browser/API checks do not establish physical native-device coverage.

## School write controls
Both clients render server-described forms under School actions, with online completion, explicit confirmations for sensitive changes, disabled pending buttons and retained drafts on failure. Actions appear beside lists and authorized details. A staff-only workflow filter exposes drafts/review/scheduled notices and cancelled events; People includes sanitized invitation history.

Server permissions remain authoritative. Teachers write assigned classes, Principal/Administrator review publication/report release, guardians submit only eligible consent, and only responsible staff resolve enquiries. Submitted-register corrections capture prior/next values and a reason. Deactivated accounts cannot regain old sessions when reactivated. Module switches immediately affect navigation and server access; profile preferences persist without claiming push/email delivery.

Report selection/upload supports PDFs up to 10 MiB through authenticated upload reservations; two-minute download links recheck session and current scope/release at redemption. Notice/resource attachments support PDF, PNG and JPEG; receipt PDFs require matching successful stored payments. Sample text report fixtures are not presented as downloadable PDFs. Native selection/sharing requires a compatible build and physical-device verification. See [write contracts](packages/backend/WRITE-WORKFLOWS.md).

Phase 10 adds paginated personal/staff notice delivery status and confirmed retries to both clients. Expo adds session-bound phone registration and safe notification responses; web is a no-op for device registration. Server delivery respects preferences and quiet hours. Accepted/provider-confirmed/read/acknowledged remain distinct. Live email and physical phone acceptance require the activation steps in packages/backend/NOTIFICATIONS.md; payment notifications remain deferred.
