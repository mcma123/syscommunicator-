# Wynberg Girls Junior Connect frontend inventory

## Delivery and limits
The root workspace remains the standalone TanStack Start web app. `packages/school-core` contains provider-independent domain types, school configuration, fixtures and a repository contract. `apps/expo` adds an Expo SDK 57 / Expo Router client for Android, iOS, and Expo web. `packages/backend` prepares Convex with an empty initial schema and no provisioned deployment.

The Expo parent frontend uses a premium light card layout with red/gold branding and five bottom tabs: Home, Updates, Calendar, Children, More. It includes child-scoped dashboard counts, published update search/read/acknowledgement, month/agenda and event details, learner profiles with read-only school records, simulated checkout with pending/failure/retry/receipts, validated consent with a saved response, resource sample previews, local enquiry threads/replies, and profile preferences. Staff modules remain unlinked placeholders. Each running client has its own in-memory repository; live cross-client state requires a future backend adapter.

No backend, Clerk, Convex, real email or payment processing has been provisioned. Demo state is in memory and resets on refresh. Demo roles are not security. School branding is Wynberg Girls Junior School; contact information still awaits confirmation. Campus photo is generated, not the actual school, and learner/operational records remain fictional demo data.

The root web build directly configures Vite/TanStack/React/Tailwind/Nitro and produces a standalone Node server. Scaffolding-service dependencies, injected editor scripts, project metadata and browser telemetry hooks are removed. School-only Open Graph and Twitter metadata include the supplied crest; share-image URLs use the request origin, with an optional build-time `VITE_SITE_URL` override.

Dokploy deployment uses a repository-root multi-stage Dockerfile with Node 24/npm 11 and the standalone Nitro server on port 3000. Build contexts exclude private environments and generated/local output; the runtime image contains only the complete `.output`. Expo and the future Convex backend are separate deployment concerns.

## Research
- https://help.d6.co.za/portal/en/kb/articles/d6-communicator-mobile-app-user-manual
- https://d6.co.za/goodbye-grey-connect-app-hello-blue-communicator-app/
- https://d6.co.za/school-solutions/communication_solutions/
- https://d6.co.za/parent-starter-pack-for-d6-communicator/
- https://help.d6.co.za/portal/en/kb/articles/what-are-the-staff-roles-and-permissions-in-d6-communicator

Official d6 materials informed the module structure and workflows; this is not a claimed pixel-identical clone and does not use d6 logos. The user-approved Open Sans font and module design are retained with Wynberg Girls Junior School branding.

## School branding

- Startup loading uses the supplied school crest in the web session screen and native font-loading fallback; the native splash also retains the crest.

- Website source: https://wynberggirlsjunior.co.za/. Its custom styles use red `#C6252B`, gold `#FAB513`, dark red `#861D23`, and charcoal `#3C3C3C`. The app uses these with supporting light surfaces and readable status colours.
- Store/app name: **Wynberg Girls Junior Connect**; phone icon label: **WGJS Connect**; inside the app: **Wynberg Girls Junior School**; tagline: **Honor Before Honours**.
- `schoolConfig` in `packages/school-core/src/index.ts` owns the branding labels. Route metadata and school screens consume it.
- `public/logo.png` is the supplied school crest, used directly in the app, favicon, and Apple touch icon. `public/manifest.webmanifest` provides web app naming and theme metadata; no native store listing is provisioned here.

## TanStack routes and components
- `/`: parent home / staff overview, child filters, notices, events and actions.
- `/messages`: search/category filters, notice details, acknowledged state, compose/preview/draft/review/publish/schedule and delivery distinctions.
- `/calendar`: month/agenda, event detail, create event, calendar download.
- `/children`: learner overview, published reports, conduct, attendance and timetable.
- `/resources`: category/search, sample document preview and sample publishing.
- `/payments`: charge details, simulated checkout return pending verification, finance simulation, failed/retry and receipt.
- `/forms`: excursion consent and staff response overview.
- `/contact`: departmental enquiries, threads, reply, assign and resolve.
- `/more`: mobile module directory and external clothing-store link.
- `/signin`: branded public demo login with distinct Parent, Teacher, Principal, Finance and Administrator credentials, validation and credential autofill. All other module routes require a demo session.
- `/profile`: current demo identity, notifications, offline/error/retry demos and sign-out.
- `/groups`, `/attendance`, `/conduct`, `/reports`: staff learner operations.
- `/people`, `/settings`, `/audit`: demo invitations, feature flags, settings preview and sample audit list.

`SchoolShell` provides desktop/sidebar and mobile/bottom navigation. `SchoolPortal` composes module screens. Shared detail components provide notice, event, consent and payment dialogs. `SchoolProvider` owns the repository, demo session and role/child context. The header shows the signed-in identity and sign-out control; role changes require signing in with another demo account. The account ID survives refresh in sessionStorage, while repository data remains in memory. Parent sessions cannot open staff-only module previews; staff roles retain the existing shared staff workspace without granular staff permissions.

## Replacing mocks
Implement `SchoolRepository` in a future adapter against `packages/backend`. Map subscription/snapshot/update operations to typed Convex queries and mutations. Provision Convex separately using `npm run dev:backend`, and implement production authentication/role checks; never trust frontend demo credentials or session state. Put real messages, document storage, PDF previews, payment verification/webhooks and server audit records behind backend contracts.

## Deferred scope
Real PDF rendering/import parsing, rich-text/gallery/video blocks, custom audience group editing, granular class permissions, persistent scheduling, CSV import, live branding configuration, full accounting, native shop, elections, AI and custom modules are not implemented. Settings controls marked preview do not change school branding. Sample audit rows and delivery counts are not provider telemetry. No production parity or exact d6 equivalence is claimed.
