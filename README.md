# Syscommunicator

A school communication monorepo for Wynberg Girls Junior School, inspired by d6 module workflows. The existing TanStack web app stays at the root; `apps/expo` provides an Android, iOS, and Expo web school frontend; `packages/backend` is the single Convex backend and database for both clients (dev deployment linked, schema and internal fixture functions deployed; fictional seed data and dev authentication available); `packages/school-core` shares domain contracts, pure rules and test-only mock data. The apps use the school's red and gold colours, supplied crest, and the tagline **Honor Before Honours**, while retaining Open Sans.

The app/store name and phone icon label are **Syscommunicator**, and the in-app school name is **Wynberg Girls Junior School**. Both clients include the school branding. Live development reads and authenticated sessions are connected. Native store submissions and production backend provisioning remain future work.

## Development

The client-facing [Scope and Requirements PDF](WGJS-Connect-Scope-and-Requirements.pdf) explains the proposed completed system, mobile and web modules, workflows, and delivery boundaries. Reproducible sources and editable diagrams are maintained under [documents/scope](documents/scope/AGENTS.md). It is a proposed scope for review, not a claim that production services are connected.

The phased plan for connecting both the web and Expo clients to one shared Convex backend and database is tracked in [Backend and Database Integration](Backend-and-Database-Integration.md).

Use Node.js 24 LTS and npm 11. Install all workspaces from the root. Both clients use the public Convex URL for real authentication and identity. School modules read fictional development database records through shared paginated queries and independent details; notice read/acknowledgement persists across clients. School write workflows are audited and persist across clients; payment processing remains unavailable.

```sh
git clone <this-repository-url>
cd <repository-name>
npx --yes npm@11 ci
npm run dev
```

The npm 11 command uses `package-lock.json` without replacing your globally installed npm. It also avoids the dependency-resolution error encountered with npm 10 on this machine.

Run `npm run build` for a TanStack production build and `npm test` for routing and shared repository checks. The development server prints its local URL after startup.

## Standalone web deployment

The web app uses standard Vite, TanStack Start and Nitro plugins. It runs independently of the original scaffolding service, with no editor scripts or error-reporting hooks.

```sh
npx --yes npm@11 ci
npm run build
npm start
```

The production Node server serves `.output/server/index.mjs` and static assets from `.output/public`. Default production port is 3000; set `PORT` and `HOST` as needed for your hosting service. Development remains on port 8080. Deploy the entire `.output` directory, not just its public assets: social previews and routes are server rendered.

Share-image URLs are absolute and use the current request origin automatically. Optionally set the public build-time variable `VITE_SITE_URL` to the canonical deployed web app origin (for example, `https://connect.your-school-domain.co.za`) before building to override it. It is separate from the school website and Expo frontend domains. Share metadata uses the school name, tagline, description and supplied crest. A fresh deployment is required to change previously hosted content; social services may retain cached previews.

## Dokploy web hosting

Use the root [Dockerfile](Dockerfile) to build the TanStack web app. The generated Nixpacks plan using Node 18/npm 9 and Caddy is incompatible with this app's Node runtime and server-rendered routes.

In the Dokploy application, select:

| Setting | Value |
| --- | --- |
| Repository branch | `main` |
| Build type | **Dockerfile** |
| Build path / Docker context | repository root (`.` or `/`, as labelled in Dokploy) |
| Dockerfile path | `Dockerfile` |
| Domain container port | `3000` |
| HTTPS | Enable on the assigned domain |

Remove any Caddy/static-site start command override, then deploy. The Dockerfile installs from the monorepo root using Node 24/npm 11, builds the web app and starts `node .output/server/index.mjs` as an unprivileged user. It does not start Expo, Convex or a separate database. Do not set `NODE_ENV=production` during dependency installation: the web build needs devDependencies.

`HOST=0.0.0.0`, `PORT=3000` and runtime `NODE_ENV=production` are set in the image. Set the public Docker build argument `VITE_CONVEX_URL` to the intended deployment URL for sign-in (`https://diligent-bass-226.convex.cloud` for the current dev preview). Rebuild after changing it. No Expo token or backend secrets belong in this image. Private `.env` files are excluded from Docker's build context. Optional public build argument `VITE_SITE_URL` can pin the canonical web origin; otherwise share metadata uses the incoming request origin.

For local container testing with Docker installed:

```sh
docker build -t wgjs-web .
docker run --rm -p 3000:3000 wgjs-web
```

Open `/signin` and `/logo.png` to verify the application and crest.

## Workspace commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | TanStack web app, port 8080 |
| `npm start` | Standalone production Node server after building, port 3000 |
| `npm run dev:mobile` | Expo Go tunnel with a direct scannable QR, port 8082 |
| `npm run dev:mobile:go` / `dev:mobile:tunnel` | Same Expo Go tunnel workflow |
| `npm run dev:mobile:lan` | Optional local-network Expo Go server, port 8081 |
| `npm run dev:mobile:client` | Metro explicitly for an installed development build |
| `npm run dev:expo-web` | Expo web development server, port 8081 |
| `npm run dev:backend` | Convex dev server for `packages/backend` (the only Convex folder); requires Convex login |
| `npm run typecheck:web` | Existing web TypeScript check |
| `npm run typecheck:expo` | Expo TypeScript check |
| `npm run typecheck:backend` | Offline backend schema/function check |
| `npm run test:backend` | Isolated Convex auth/onboarding/fixture and command-guard tests |
| `npm run setup:auth:dev` | Configure dev signing keys and private dev accounts |
| `npm run verify:auth:dev` | Real dev password/identity/session smoke check |
| `npm run seed:backend` | Push, seed missing dev fixtures, and verify; preserve existing edits |
| `npm run reset:backend` | Clear dev application data and seed again; removes seed-owned files |
| `npm run verify:backend` | Read-only dev counts, relationships, and sample-file checks |
| `npm run check:expo` | Expo diagnostics |
| `npm run export:expo` | Android, iOS, and web bundle export |
| `npm run expo:whoami` / `expo:init` / `expo:info` | Authenticate, link, and inspect the Expo account project |
| `npm run expo:update` | Publish a native update to the preview branch |
| `npm run expo:deploy` | Deploy the exported Expo web frontend to EAS Hosting preview |

Expo includes a premium parent frontend: five bottom tabs, updates, learner profiles, payments, consent, resources, enquiries, and profile preferences. Module reads use shared paginated Convex hooks and independent details; staff roles can open their authorized read screens. School actions persist notices, events, consent, enquiries, registers/conduct, report review/release, people/settings and profiles. Payments remain disabled. Follow [the Expo workspace guide](apps/expo/README.md) to develop those screens and [the backend guide](packages/backend/README.md) for Convex setup. Phase 8 supports PDF uploads up to 10 MiB, image attachments up to 5 MiB and expiring protected downloads; native file selection/sharing needs a compatible build and device verification.

## Sign-in and identity

Run `npm run dev` and open http://localhost:8080/signin. Both clients use **Convex Auth** for email/password, email verification, magic links and password recovery. The web login retains the school design; Expo has a parent sign-in screen and stores native session tokens with `expo-secure-store` (browser storage for Expo web). The server supplies profiles, staff roles and linked learners; old browser demo IDs cannot create a session.

For this linked development deployment:

```sh
npm run seed:backend
npm run setup:auth:dev
npm run verify:auth:dev
```

Auth setup preserves existing signing keys, configures missing dev keys, enables the dev-account flag and provisions five real password accounts for the seeded fictional profiles. Private passwords are generated in ignored `.env.auth.local`, using `DEV_AUTH_PASSWORD_PARENT`, `DEV_AUTH_PASSWORD_TEACHER`, `DEV_AUTH_PASSWORD_PRINCIPAL`, `DEV_AUTH_PASSWORD_FINANCE` and `DEV_AUTH_PASSWORD_ADMIN`. Their emails are `parent@wgjs.example`, `teacher@wgjs.example`, `principal@wgjs.example`, `finance@wgjs.example`, and `admin@wgjs.example`. There is no credential picker or shared hard-coded password. The setup helper pipes secrets through stdin and removes temporary provisioning passwords from the deployment. Never commit this file or copy its values into public variables.

Development accounts work only with `ENABLE_DEMO_ACCOUNTS=true` on the identified dev deployment. They cannot authenticate on production or an unknown deployment. Sign out from the header/profile to switch accounts; Profile also supports **Sign out everywhere**. Revoked and deactivated accounts are blocked. Expo accepts linked guardians and explicit staff roles. Both clients share fictional development database records and persisted notice receipts.

### Email activation and invitations

In the **Convex dev deployment environment**, configure `RESEND_API_KEY`, `AUTH_EMAIL_FROM` (a verified Resend sender), and `SITE_URL` (the web app URL recipients can open). Never put these secrets in client env files. The default dev `SITE_URL` is `http://localhost:8080`; replace it with the reachable deployed web URL for real recipients. Email actions fail explicitly until configured; no live email delivery has been verified yet.

Parents create a password using the school-registered guardian email and verify the emailed code; the existing profile keeps its learner links. An Administrator uses the **People** account form to email staff/guardian invitations. Recipients sign in/create a password, verify their email and accept the single-use invitation code. Invitations expire after seven days; only hashes are stored and only the matching verified recipient can accept. Unknown emails without an invitation cannot register. Missing/expired access requires school assistance.

Password recovery uses an emailed eight-digit code and invalidates previous sessions after the password changes. Magic links require explicit email confirmation and expire after 15 minutes. Native links use `wgjsconnect://signin`, which needs a compatible installed native build; password and code flows can be tested in SDK-compatible Expo Go. Native runtime 1.0.3 includes SecureStore and notification configuration; existing builds need a new compatible binary before native updates.

`verify:auth:dev` checks real password sessions from two independent HTTP clients, matching parent identity/learners, staff roles, guardian/class/publication/Finance/signed-out authorization and cross-session revocation. Automated email/invitation/recovery tests use a mocked transport. Neither check is native device testing or proof of live email delivery.

## Backend development data

Run `npm run seed:backend` to populate the linked `dev:diligent-bass-226` deployment with fictional school records. The command pushes backend functions first, stores six labelled sample text documents, inserts missing fixture records, and verifies counts and relationships. Run it again safely to preserve existing edits. Both clients read the fictional seeded records through scoped paginated reads and independent details.

`npm run reset:backend` explicitly clears all application records in that development database, deletes only seed-owned sample files, then rebuilds fixtures. Reset also clears auth accounts/sessions: rerun `setup:auth:dev` to restore dev logins. Seed/reset are blocked on production and unknown targets. `npm run verify:backend` is read-only; `npm run test:backend` uses isolated in-memory databases with no credentials. See the [backend guide](packages/backend/README.md) for limits and recovery. GitHub CI runs tests and all three TypeScript checks; cloud preview CI is deferred.

## Local account credentials

The ignored root `.env` stores `EXPO_TOKEN` for EAS account commands only. Commit only `.env.example`, never the real `.env`. The account helper loads this file without exposing it to clients. Never use an `EXPO_PUBLIC_*` variable for the token or add it to app configuration. Expo credentials do not authenticate to Convex.

No cloud build, store submission, or live Convex deployment is performed by installation.

## AI agent instructions

This repository uses the [DOX framework](https://github.com/agent0ai/dox). Start with [AGENTS.md](AGENTS.md), follow its Child DOX Index to the contracts governing the files you will edit, and update affected contracts and indexes before finishing. DOX requires no package or runtime installation.

## Testing the apps locally

From PowerShell, open the repository root:

```powershell
cd C:\Users\HP22\Desktop\syscommunicator\syscommunicator
```

Run `npm run dev` for the existing TanStack web app at http://localhost:8080.
Run `npm run dev:expo-web` for the mobile parent frontend in a browser at
http://localhost:8081. These are two different clients in the same monorepo.

For phone testing, run `npm run dev:mobile` and scan the QR in that terminal
using Expo Go's scanner with an Expo Go version that supports SDK 57. The QR
opens the direct exp:// internet tunnel, so manual URL entry is unnecessary.
Keep the computer and Metro running. On a physical iPhone, sign in to Expo CLI and Expo Go using
the same account (`npx expo login` from apps/expo if needed). The normal mobile
and Expo web commands explicitly target Expo Go, even with the development-client
package installed.
If Expo Go cannot run SDK 57, use an SDK-compatible development build with
`npm run dev:mobile:client`. Publishing an update does not create that build.

Metro shortcuts: `w` opens Expo web, `a` opens an available Android emulator,
`r` reloads, and `s` switches between Expo Go and development-client targets.
The iOS simulator requires macOS. Use Ctrl+C to stop a server.

Expo mobile uses the tunnel on 8082; Expo web uses 8081. You can run both in
separate terminals, or press `w` in the mobile terminal to open Expo web there.
For the separate browser preview, use:

```powershell
npm run dev:expo-web
```

For a phone connection that cannot reach the local network, try:

```powershell
npm run dev:mobile:tunnel
```

The tunnel helper is installed with the Expo workspace. The normal mobile command
already uses this workflow; `dev:mobile:tunnel` is an alias. This command uses port
8082 so the browser preview on 8081 can keep running. Keep the terminal open and
scan its new QR code, or enter its exp:// tunnel URL in Expo Go. Do not enter
localhost or the production website URL in Expo Go. Tunnel addresses can change
between sessions and old QR codes stop working when Metro stops.

On LAN, the phone and computer must share a network that allows device-to-device
connections. Windows Public networks, guest Wi-Fi isolation, VPNs, or the wrong
virtual network adapter can prevent access even when the desktop preview works.
The tunnel bypasses LAN access without disabling the firewall. If you prefer LAN
on a network that allows it, use `npm run dev:mobile:lan` and keep both devices
on that same network. Scan the QR from the mobile terminal when using a tunnel;
the separate browser-only terminal can still show a local-network QR.

Local sign-in and module reads use the linked Convex dev backend. Notice read/acknowledgement receipts survive reload and update other clients. School write workflows are audited and persist across clients; payment processing remains unavailable.

## Authorization

Phase 4 adds shared module permissions, session-derived server actors, scoped notice/learner/resource/charge reads and audited mutation builders. Web navigation and route gates use the same module grants. [The authorization contract and audit](packages/backend/AUTHORIZATION.md) records role boundaries and negative tests. Phase 5 connects live bounded module reads and audited receipt updates on both clients; [the client data contract](packages/backend/CLIENT-DATA.md) records limits and remaining module work. No production deployment is changed.

## Production release

- [Production Expo web frontend](https://wgjs-connect.expo.app).
- [Android/iOS production update](https://expo.dev/accounts/mcmarsh/projects/wynberg-girls-junior-connect/updates/8b64bb04-f548-4f7f-856c-3dc080190f7b), runtime 1.0.1, production branch/channel/environment, application source commit 069d656.
- [Deployment snapshot](https://wgjs-connect--w5c5p4fsu6.expo.app).
- This hosted release (source commit 069d656) predates the Convex data layer and still shows mock data; republishing it against production Convex is Phase 13. Native updates require a compatible installed runtime 1.0.1 build; publishing does not create an APK/IPA or submit store listings.

## Published previews

- [Expo web parent frontend](https://wgjs-connect--7krjaw189g.expo.app) � hosted testing preview.
- [Native preview update](https://expo.dev/accounts/mcmarsh/projects/wynberg-girls-junior-connect/updates/b4845344-2719-44a7-a53c-2bc8cc906cad) � Android/iOS, preview branch/channel, runtime 1.0.0, source commit 1eed9c3.
- No native APK/IPA has been built for this project yet. Published EAS updates require a compatible installed development or preview build; use the local Expo Go server only with an SDK-compatible Expo Go installation.

Phase 10 implements phone registration, notice push/urgent email, consent reminders, quiet hours and truthful delivery history. See [notification setup](packages/backend/NOTIFICATIONS.md). Install a new native build for runtime 1.0.3; live delivery needs EAS push credentials and a verified Resend sender. Payment integration remains deferred until the other feature work is complete.

## Ad Center
Teachers, Principals and Administrators open **Ad Center** (`/ads` on web, **More → Ad Center** in the app) and press **New ad**:

1. Write a headline and caption, choose when it shows and who sees it, and optionally tick *Also show as a popup*. A button link is optional and hidden behind **Add a button link**.
2. **Drag and drop pictures or videos** onto the drop area (or browse; the phone app uses the file picker): up to 10 items per ad — PNG/JPEG/WebP pictures up to 10 MB and MP4/WebM/MOV videos up to 50 MB. Reorder or remove them, then **Save**; files upload straight to the school's Cloudflare R2 bucket with progress.
3. Teachers **Submit for approval**; a Principal or Administrator **Approves and publishes** (or returns it with a note). Principals and Administrators can publish their own ads directly.

Running ads appear on parents' home screens as spotlight slides (web and Expo); after every login, one popup steps through all ads marked as popups (it stays closed on reloads in the same login and shows again after an edit). Administrators can switch the module off in School settings (`Enable ads`). Each ad's details show its **performance**: parents reached, banner and popup views, button clicks and click rate, counted once per parent per day.

Principals and Administrators also get an **Advertisers** tab: enquiries from the public **Advertise with us** page (`/advertise`, a shareable link with reach figures, packages and a consented enquiry form), businesses added after meeting them, status (Lead → Contacted → Active → Lapsed) and notes. Businesses that opted in receive three follow-up emails and, once an ad is linked to them, a monthly views-and-clicks report; every email has an unsubscribe link. Media setup, CORS and key rotation are in [OPERATIONS.md](OPERATIONS.md). Playing video in the installed phone app requires the runtime **1.0.4** build (`expo-video`).
