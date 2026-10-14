# School Connect frontend inventory

## Delivery and limits
The root workspace is the TanStack Start web app. `packages/school-core` contains browser-safe domain types, school configuration, fixtures and a repository contract. Desktop and mobile web render the same routes, data and actions. This is not a separate native iOS/Android app: native frameworks are not supported in this environment. A future native client can consume the shared core and use the same Convex backend, integrated outside Lovable.

No backend, Clerk, Convex, real email or payment processing has been provisioned. Demo state is in memory and resets on refresh. Demo roles are not security. Final school identity and contact information await confirmation. Campus photo is generated, not the actual school.

## Research
- https://help.d6.co.za/portal/en/kb/articles/d6-communicator-mobile-app-user-manual
- https://d6.co.za/goodbye-grey-connect-app-hello-blue-communicator-app/
- https://d6.co.za/school-solutions/communication_solutions/
- https://d6.co.za/parent-starter-pack-for-d6-communicator/
- https://help.d6.co.za/portal/en/kb/articles/what-are-the-staff-roles-and-permissions-in-d6-communicator

Official materials establish the blue Communicator redesign, personalised news, calendar, resources, learner information, payments and publishing roles. No authoritative exact native-app font or colour specification was found. The prototype uses a d6-inspired royal blue and Open Sans approximation, not a claimed pixel-identical clone; it does not use d6 logos.

## Routes and components
- `/`: parent home / staff overview, child filters, notices, events and actions.
- `/messages`: search/category filters, notice details, acknowledged state, compose/preview/draft/review/publish/schedule and delivery distinctions.
- `/calendar`: month/agenda, event detail, create event, calendar download.
- `/children`: learner overview, published reports, conduct, attendance and timetable.
- `/resources`: category/search, sample document preview and sample publishing.
- `/payments`: charge details, simulated checkout return pending verification, finance simulation, failed/retry and receipt.
- `/forms`: excursion consent and staff response overview.
- `/contact`: departmental enquiries, threads, reply, assign and resolve.
- `/more`: mobile module directory and external clothing-store link.
- `/profile`, `/signin`: profile, notifications, offline/error/retry demos and invitation mock.
- `/groups`, `/attendance`, `/conduct`, `/reports`: staff learner operations.
- `/people`, `/settings`, `/audit`: demo invitations, feature flags, settings preview and sample audit list.

`SchoolShell` provides desktop/sidebar and mobile/bottom navigation. `SchoolPortal` composes module screens. Shared detail components provide notice, event, consent and payment dialogs. `SchoolProvider` owns the repository and role/child context.

## Replacing mocks
Implement `SchoolRepository` in a future Convex adapter. Map subscription/snapshot/update operations to typed backend queries and mutations. Add Clerk role/session checks on the real backend; never trust the prototype role selector. Put real messages, document storage, PDF previews, payment verification/webhooks and server audit records behind backend contracts.

## Deferred scope
Real PDF rendering/import parsing, rich-text/gallery/video blocks, custom audience group editing, granular class permissions, persistent scheduling, CSV import, live branding configuration, full accounting, native shop, elections, AI and custom modules are not implemented. Settings controls marked preview do not change school branding. Sample audit rows and delivery counts are not provider telemetry. No production parity or exact d6 equivalence is claimed.
