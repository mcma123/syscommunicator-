# Wynberg Girls Junior Connect frontend inventory

## Delivery and limits
The root workspace remains the Lovable TanStack Start web app. `packages/school-core` contains provider-independent domain types, school configuration, fixtures and a repository contract. `apps/expo` adds an Expo SDK 57 / Expo Router client for Android, iOS, and Expo web. `packages/backend` prepares Convex with an empty initial schema and no provisioned deployment.

The Expo scaffold has a branded native home screen, demo role switching, shared mock notices, a module directory, and named placeholders for every existing school module. Full native workflows have not been ported. Each running client has its own in-memory repository; live cross-client state requires a future backend adapter.

No backend, Clerk, Convex, real email or payment processing has been provisioned. Demo state is in memory and resets on refresh. Demo roles are not security. School branding is Wynberg Girls Junior School; contact information still awaits confirmation. Campus photo is generated, not the actual school, and learner/operational records remain fictional demo data.

## Research
- https://help.d6.co.za/portal/en/kb/articles/d6-communicator-mobile-app-user-manual
- https://d6.co.za/goodbye-grey-connect-app-hello-blue-communicator-app/
- https://d6.co.za/school-solutions/communication_solutions/
- https://d6.co.za/parent-starter-pack-for-d6-communicator/
- https://help.d6.co.za/portal/en/kb/articles/what-are-the-staff-roles-and-permissions-in-d6-communicator

Official d6 materials informed the module structure and workflows; this is not a claimed pixel-identical clone and does not use d6 logos. The user-approved Open Sans font and module design are retained with Wynberg Girls Junior School branding.

## School branding

- Website source: https://wynberggirlsjunior.co.za/. Its custom styles use red `#C6252B`, gold `#FAB513`, dark red `#861D23`, and charcoal `#3C3C3C`. The app uses these with supporting light surfaces and readable status colours.
- Store/app name: **Wynberg Girls Junior Connect**; phone icon label: **WGJS Connect**; inside the app: **Wynberg Girls Junior School**; tagline: **Honor Before Honours**.
- `schoolConfig` in `packages/school-core/src/index.ts` owns the branding labels. Route metadata and school screens consume it.
- `public/logo.png` is the supplied school crest, used directly in the app, favicon, and Apple touch icon. `public/manifest.webmanifest` provides web app naming and theme metadata; no native store listing is provisioned here.

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
Implement `SchoolRepository` in a future adapter against `packages/backend`. Map subscription/snapshot/update operations to typed Convex queries and mutations. Provision Convex separately using `npm run dev:backend`, and implement production authentication/role checks; never trust either prototype role selector. Put real messages, document storage, PDF previews, payment verification/webhooks and server audit records behind backend contracts.

## Deferred scope
Real PDF rendering/import parsing, rich-text/gallery/video blocks, custom audience group editing, granular class permissions, persistent scheduling, CSV import, live branding configuration, full accounting, native shop, elections, AI and custom modules are not implemented. Settings controls marked preview do not change school branding. Sample audit rows and delivery counts are not provider telemetry. No production parity or exact d6 equivalence is claimed.
