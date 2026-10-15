# Wynberg Girls Junior Connect

A school communication monorepo for Wynberg Girls Junior School, inspired by d6 module workflows. The existing TanStack web app stays at the root; `apps/expo` provides an Android, iOS, and Expo web parent frontend; `packages/backend` prepares a future Convex database; `packages/school-core` shares domain contracts and mock data. The apps use the school's red and gold colours, supplied crest, and the tagline **Honor Before Honours**, while retaining Open Sans.

The full app/store name is **Wynberg Girls Junior Connect**, the phone icon label is **WGJS Connect**, and the in-app school name is **Wynberg Girls Junior School**. Both clients include the school branding. Native store submissions and live backend integration remain future work.

## Development

Use Node.js 24 LTS and npm 11. Install all workspaces from the root. Both clients run on mock data without database credentials; each client owns its own temporary state and changes reset on reload.

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
| `npm run dev:backend` | Convex setup/development; provisions only when explicitly run and authenticated |
| `npm run typecheck:web` | Existing web TypeScript check |
| `npm run typecheck:expo` | Expo TypeScript check |
| `npm run typecheck:backend` | Offline backend schema check |
| `npm run check:expo` | Expo diagnostics |
| `npm run export:expo` | Android, iOS, and web bundle export |
| `npm run expo:whoami` / `expo:init` / `expo:info` | Authenticate, link, and inspect the Expo account project |
| `npm run expo:update` | Publish a native update to the preview branch |
| `npm run expo:deploy` | Deploy the exported Expo web frontend to EAS Hosting preview |

Expo includes a premium parent frontend: five bottom tabs, updates, learner profiles, payments, consent, resources, enquiries, and profile preferences. Interactions use local demo data; staff routes remain placeholders. Follow [the Expo workspace guide](apps/expo/README.md) to develop those screens and [the backend guide](packages/backend/README.md) when ready to provision Convex.

## Web demo login

Run `npm run dev` and open http://localhost:8080/signin. Select a profile, click **Use these details**, then **Sign in to WGJS Connect**.

| Role | Email | Password |
| --- | --- | --- |
| Parent | `parent@wgjs.example` | `ParentDemo!26` |
| Teacher | `teacher@wgjs.example` | `TeacherDemo!26` |
| Principal | `principal@wgjs.example` | `PrincipalDemo!26` |
| Finance | `finance@wgjs.example` | `FinanceDemo!26` |
| Administrator | `admin@wgjs.example` | `AdminDemo!26` |

These fictional accounts apply to the root TanStack web app. Sign out using the header button or Profile to switch accounts. The account ID is stored in sessionStorage for this browser tab; passwords are never stored there. Account identity survives refresh, but mock school changes reset on reload. Staff accounts use the existing staff module previews; granular staff permissions are not implemented. Parents cannot open staff-only module previews through the demo UI. This is frontend demonstration access, not production authentication or server-side authorization. Expo remains the separate parent frontend.

## Local account credentials

The ignored root `.env` stores `EXPO_TOKEN` for EAS account commands only. Commit only `.env.example`, never the real `.env`. The account helper loads this file without exposing it to clients. Never use an `EXPO_PUBLIC_*` variable for the token or add it to app configuration. Expo credentials do not authenticate to Convex.

No cloud build, store submission, or live Convex deployment is performed by installation.

## AI agent instructions

This repository uses the [DOX framework](https://github.com/agent0ai/dox). Start with [AGENTS.md](AGENTS.md), follow its Child DOX Index to the contracts governing the files you will edit, and update affected contracts and indexes before finishing. DOX requires no package or runtime installation.

## Testing the apps locally

From PowerShell, open the repository root:

```powershell
cd C:\Users\HP22\Desktop\school-connect-hub
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

The local frontend uses mock data; no backend server is needed. Reloading resets demo state.

## Production release

- [Production Expo web frontend](https://wgjs-connect.expo.app).
- [Android/iOS production update](https://expo.dev/accounts/mcmarsh/projects/wynberg-girls-junior-connect/updates/8b64bb04-f548-4f7f-856c-3dc080190f7b), runtime 1.0.1, production branch/channel/environment, application source commit 069d656.
- [Deployment snapshot](https://wgjs-connect--w5c5p4fsu6.expo.app).
- The hosted frontend uses mock data. Native updates require a compatible installed runtime 1.0.1 build; publishing does not create an APK/IPA or submit store listings.

## Published previews

- [Expo web parent frontend](https://wgjs-connect--7krjaw189g.expo.app) � hosted testing preview.
- [Native preview update](https://expo.dev/accounts/mcmarsh/projects/wynberg-girls-junior-connect/updates/b4845344-2719-44a7-a53c-2bc8cc906cad) � Android/iOS, preview branch/channel, runtime 1.0.0, source commit 1eed9c3.
- No native APK/IPA has been built for this project yet. Published EAS updates require a compatible installed development or preview build; use the local Expo Go server only with an SDK-compatible Expo Go installation.
