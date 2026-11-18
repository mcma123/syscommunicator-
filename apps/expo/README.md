# WGJS Expo client

Expo SDK 57 with Expo Router provides one Android, iOS, and web client in this
monorepo. The existing standalone TanStack app remains at the repository root.

Install all dependencies from the root with `npx --yes npm@11 ci`. Do not create
a separate lockfile in this workspace.

## Develop

- `npm run dev:mobile` from the root starts the Expo Go tunnel on 8082 and prints a direct exp:// QR. `dev:mobile:go` and `dev:mobile:tunnel` are aliases. Scan the QR from this mobile terminal using Expo Go's scanner.
- `npm run dev:mobile:lan` explicitly selects a local-network connection on 8081.
- `npm run dev:expo-web` starts Expo web on port 8081.
- `npm run android --workspace @school-connect/expo` opens an available Android
  emulator. Android Studio/device setup is separate from this repository.
- Local iOS simulator development requires macOS. Windows can prepare/export
  iOS JavaScript bundles and use a separately built iOS development client.
- EAS profiles in `eas.json` prepare development, preview, and production builds.
  No cloud builds are started by these setup commands.

The development-client dependency is included. Expo Go support depends on its
installed SDK version; use an SDK-compatible Expo Go or a development build.

## Where to build modules

- `src/app/` contains thin, named Expo Router leaf routes and the root layout.
- `src/features/school/` owns screens, the module directory and identity/UI adapters.
- `src/components/` owns reusable native layout/text components.
- `src/theme/school.ts` owns the WGJS palette and local Open Sans font names.
- `@school-connect/core` shares school names, domain types, mock fixtures,
  repository contracts, and filtering with the root web app.

The parent frontend retains its premium light design, SYS colours, logo and five tabs. It accepts active linked guardians and explicit staff roles, reading normalized development database records through shared hooks. Audited school actions persist and synchronize with web; Phase 8 file uploads and protected downloads are connected; payment processing remains Phase 9. Loading, empty, error/retry and actual connection feedback replace mock success/offline controls.

`parent-screens.tsx` owns presentation; `ui.tsx` owns shared native UI; `store.tsx` owns auth/onboarding and selected learner, adapting `@school-connect/backend/react`. Legacy parent-model selectors remain test-only. No runtime mock repository is mounted. See [the shared client contract](../../packages/backend/CLIENT-DATA.md).

Expo web exports a SPA, using real database IDs in detail routes. Configure hosting to serve index.html for client paths. No private database queries or fixed fixture IDs run at export time. Native builds use the same shared module contract; browser verification does not replace device testing.

## Branding and account project

The product and launcher name is Syscommunicator. The supplied SYS logo is
copied unchanged into assets/logo.png. Square derivatives serve the native launcher icons.
The app uses SYS pink and navy. The connected school name remains school content.

The ignored root `.env` contains the CLI-only EXPO_TOKEN. Use `npm run
expo:whoami`, `npm run expo:init`, and `npm run expo:info` from the root. Do not
copy the token into this app's public environment variables or configuration.
The slug is `wynberg-girls-junior-connect`; owner/project ID are public linkage
metadata, not credentials.

Linked project: [@mcmarsh/wynberg-girls-junior-connect](https://expo.dev/accounts/mcmarsh/projects/wynberg-girls-junior-connect).
Before the first native build, configure the intended iOS bundle identifier and
Android package name; no store identifiers or store submissions are configured
by this scaffold.

## Native compatibility

If Expo Go says "Failed to download remote update", first verify that Metro is
running and the phone can reach its manifest/bundle URL. This download-stage
error does not identify a JavaScript exception. From the root, run
`npm run dev:mobile:tunnel` to use an internet tunnel on port 8082. The local
@expo/ngrok development dependency supplies the tunnel helper. Keep Metro open
and scan the new terminal QR code or enter its exp:// tunnel URL in Expo Go.
The browser production URL is not an Expo Go launch URL. Desktop-only localhost
URLs cannot be reached as the computer from a phone. Tunnel URLs are temporary.

Declare Reanimated 4.5.1 and Worklets 0.10.1 directly for
SDK 57. Optional peer resolution previously selected incompatible 4.2.2/0.7.4
packages. Check installed versions with npm ls as well as Expo diagnostics.
Use the latest SDK 57 Expo Go on the phone; the early animation crash was fixed
in Android 57.0.3 / iOS 57.0.6 ([upstream issue](https://github.com/expo/expo/issues/48390)).
After dependency changes, stop Metro and restart from the root:

```powershell
npm run start --workspace @school-connect/expo -- --go --clear
```

App/runtime version 1.0.1 separates the corrected native dependency set from the
previously published 1.0.0 preview. Rescan the new terminal QR code for local testing.

## Shared backend

`packages/backend` supplies real Convex Auth sessions, paginated module reads,
independent detail/history queries and dashboard counts. Set this workspace's
public `EXPO_PUBLIC_CONVEX_URL` in ignored `.env.local`. Domain authorization
is enforced on the server for guardians, teachers and other staff roles.
Records are fictional development data. School actions now persist publication, events, consent, enquiries, registers/conduct, report review/release and administration/profile changes. Phase 8 supports PDF uploads up to 10 MiB, image attachments up to 5 MiB and expiring protected downloads; payment processing remains Phase 9. Calendar events can be exported
as ICS using browser downloads or native sharing. Report selection uses expo-document-picker; native selection/sharing needs a compatible binary and physical-device verification.

## Verify

From the root, run `npm run typecheck:expo`, `npm run check:expo`, and `npm run
export:expo`. Lint this app with `npm run lint --workspace @school-connect/expo`.
Exports verify bundling for all three platforms; they do not replace testing on
an Android/iOS device.

## Publishing previews

The app is configured for EAS Update with appVersion runtime compatibility and
development/preview/production build channels. Run `npm run expo:update` from
the root to publish native JavaScript/assets to the preview branch using the
preview environment. Matching native builds need the same runtime version;
updates do not create an APK/IPA. Increment expo.version before changing native
dependencies or configuration after a build exists.

To publish the Expo browser frontend, run `npm run export:expo` and then
`npm run expo:deploy`. The helper uses the WGJS preview domain on EAS Hosting.
Production deployment and store submissions are separate actions. Both helpers
load the ignored root token only for account commands.

See the root README for PowerShell dev-server commands, Expo Go versus development
clients, QR testing, Metro shortcuts, and simultaneous web/mobile testing.

## Production release

- Web: https://wgjs-connect.expo.app
- Deployment snapshot: https://wgjs-connect--w5c5p4fsu6.expo.app
- Native production update: https://expo.dev/accounts/mcmarsh/projects/wynberg-girls-junior-connect/updates/8b64bb04-f548-4f7f-856c-3dc080190f7b
- Runtime 1.0.1, production branch/channel/environment, application source commit 069d656.
- Release bundles were exported with the EAS production environment, then published using EAS Update on the production channel and EAS Hosting with --prod. The root publishing helpers still target previews.
- The hosted frontend retains mock data. Install a compatible native 1.0.1 build to receive the native production update; runtime 1.0.0 builds retain their own compatible updates.

## Published previews

- [Expo web parent frontend](https://wgjs-connect--7krjaw189g.expo.app) � hosted testing preview.
- [Native preview update](https://expo.dev/accounts/mcmarsh/projects/wynberg-girls-junior-connect/updates/b4845344-2719-44a7-a53c-2bc8cc906cad) � Android/iOS, preview branch/channel, runtime 1.0.0, source commit 1eed9c3.
- No native APK/IPA has been built for this project yet. Published EAS updates require a compatible installed development or preview build; use the local Expo Go server only with an SDK-compatible Expo Go installation.

## Sign-in

Set the public `EXPO_PUBLIC_CONVEX_URL` in this workspace's ignored `.env.local`. Root `seed:backend` and `setup:auth:dev` create the dev school and private credentials in ignored root `.env.auth.local`. Sign in as the seeded parent using that private password. No passwords or backend secrets belong in `EXPO_PUBLIC_*`, app config or bundles.

Native tokens use SDK-compatible expo-secure-store; Expo web uses browser storage. Password signup requires a registered/invited email plus an emailed verification code. Password reset uses a code; magic links open `wgjsconnect://signin` in a compatible installed build and require explicit confirmation. For Expo Go, use password/code flows. Email sending awaits deployment Resend configuration and a verified sender; the UI shows when this is unavailable. Staff roles can use authorized native read modules; there is no role switch.

Profile displays live identity/linked school learners and supports sign-out everywhere. School-module records come from the fictional development database. Native runtime 1.0.3 includes SecureStore and notification configuration; older installed builds require a new compatible binary before updates. Bundle checks do not test physical secure storage or device deep links.

## Phone notifications
Runtime 1.0.3 adds SDK-compatible expo-notifications and its config plugin. Create/install a compatible Android/iOS development/native build with EAS push credentials, then sign in and allow notifications. Expo Go and web retain preview support but do not register remote push. Profile shows registration status/retry/settings and delivery history. Push payloads are generic and destination routes recheck access. See [backend activation](../../packages/backend/NOTIFICATIONS.md); exports do not verify physical delivery. No remote EAS build is started automatically.
