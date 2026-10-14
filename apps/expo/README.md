# WGJS Expo client

Expo SDK 57 with Expo Router provides one Android, iOS, and web client in this
monorepo. The existing Lovable/TanStack app remains at the repository root.

Install all dependencies from the root with `npx --yes npm@11 ci`. Do not create
a separate lockfile in this workspace.

## Develop

- `npm run dev:mobile` from the root starts Metro for native development.
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
- `src/features/school/` owns screens, the module directory, and mock state.
- `src/components/` owns reusable native layout/text components.
- `src/theme/school.ts` owns the WGJS palette and local Open Sans font names.
- `@school-connect/core` shares school names, domain types, mock fixtures,
  repository contracts, and filtering with the root web app.

The parent frontend uses a light banking-inspired design with red/gold branding,
rounded cards, and Home/Updates/Calendar/Children/More bottom tabs. Parent modules
include search and acknowledgement, event and learner details, simulated payment
checkout/receipts, validated consent, resource previews, enquiry threads, and
profile preferences. The fictional parent Jamie Williams starts signed in.
Staff routes remain placeholders and are excluded from parent navigation.

`parent-screens.tsx` owns presentation; `ui.tsx` owns shared parent UI;
`parent-model.ts` owns pure filtering/validation; `store.tsx` mounts one repository
and preserves selected child, consent response, and payment simulation across
navigation. Demo controls under Profile can choose success, pending, or failure
and reset the excursion payment. Reload resets all data. No real payments,
messages, push notifications, authentication, persistence, or PDF service is
connected. Use React Native primitives; DOM/Radix components are web-only.

## Branding and account project

The full product/store name is Wynberg Girls Junior Connect, launcher name is
WGJS Connect, school name is Wynberg Girls Junior School, and tagline is Honor
Before Honours. Original crest source is `public/logo.png`; this workspace uses
an unchanged copy plus padded square icons. On Windows, regenerate icon assets
with `powershell -File scripts/prepare-expo-assets.ps1` from the repository root.

The ignored root `.env` contains the CLI-only EXPO_TOKEN. Use `npm run
expo:whoami`, `npm run expo:init`, and `npm run expo:info` from the root. Do not
copy the token into this app's public environment variables or configuration.
The slug is `wynberg-girls-junior-connect`; owner/project ID are public linkage
metadata, not credentials.

Linked project: [@mcmarsh/wynberg-girls-junior-connect](https://expo.dev/accounts/mcmarsh/projects/wynberg-girls-junior-connect).
Before the first native build, configure the intended iOS bundle identifier and
Android package name; no store identifiers or store submissions are configured
by this scaffold.

## Future backend

`packages/backend` contains the Convex scaffold. Authentication and provisioning
are separate from Expo, and the app does not yet connect to Convex. Copy the
workspace `.env.example` to an ignored `.env.local` only when a real public
deployment URL is available. Implement the repository adapter and production
authorization before switching away from mock state.

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
