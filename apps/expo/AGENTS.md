# Expo client

## Purpose

- Own the WGJS school frontend for Android, iOS, and Expo web using Expo SDK 57 and Expo Router.

## Ownership

- Own app configuration, package manifest, EAS profiles, TypeScript/ESLint setup, assets, environment examples, and client development documentation.
- Source presentation and identity/UI state are owned by the source child contract.

## Local Contracts

- Launcher and product name are Syscommunicator. The slug is `syscommunicator`.
- Retain Open Sans, website red/gold colours, and the supplied crest. `assets/logo.png` is a copy of the original; square native icons are padded derivatives without cropping.
- Use Metro's automatic workspace support; do not add manual watchFolders or dependency resolution overrides.
- Expo uses its SDK-compatible React/React Native versions. Keep React/React DOM aligned across clients to avoid duplicate React in a bundle.
- Declare expo-secure-store at the SDK-bundled version and keep its config plugin. Native dependency/config changes require a new compatible build; appVersion runtime policy isolates old builds.
- Declare Reanimated and Worklets directly at the versions in Expo's bundledNativeModules.json. Router/native-module optional peers can otherwise resolve older JS packages than Expo Go's native binaries; doctor does not check undeclared transitive peers.
- Root `.env` supplies EXPO_TOKEN only to EAS account commands. Never read it into app configuration, `extra`, public variables, or bundles.
- EAS CLI is invoked on demand at version 24.13.0 through the root helper, not installed as an app dependency. The account project is `@mcmarsh/wynberg-girls-junior-connect`; its public ID lives in app.json and is inherited by app.config.ts.
- The app uses Convex Auth and live server identity through `EXPO_PUBLIC_CONVEX_URL`; school modules read paginated live records and independent details through shared backend hooks. Tokens use expo-secure-store natively and browser storage on web. Email flows await deployment Resend setup. Production and real payments are not connected. Phase 10 implements remote push registration, generic notice/consent alerts, delivery history and phone controls; live delivery still needs EAS push credentials and a compatible installed build. Audited Phase 7 school workflows persist; payment processing remains unavailable.
- Ad Center video uses SDK-bundled `expo-video` (~57.0.5) with its config plugin and requires runtime **1.0.4** (app version bumped); installed 1.0.3 binaries need a new EAS build to receive updates with ads. Expo Go SDK 57 and Expo web include it. Images use `expo-image`.
- SDK-compatible expo-notifications/device/constants and the notifications config plugin require runtime 1.0.3 and a new compatible native binary. Remote push is disabled in the Expo Go preview and web bridge; keep those previews usable. Never copy the EAS account token into push configuration.
- Report selection uses SDK-compatible expo-document-picker, with FileSystem/shared-file adapters. Reports and notice/resource uploads use session-bound Convex upload reservations (PDF 10 MiB, PNG/JPEG 5 MiB). Protected downloads use two-minute scope-checked gateway links; receipt PDFs derive only from verified stored successful payments. Cached downloads are removed after native sharing.
- Calendar export uses SDK-compatible expo-file-system/expo-sharing natively and a web-only Blob download adapter. New native dependencies require a compatible binary; exports are not device tests.
- Web output is a SPA (`web.output=single`) for authenticated database-ID deep links; do not enumerate private IDs in generateStaticParams. Hosting must serve index.html for client routes.
- EAS profiles prepare later builds; setup does not submit store listings or trigger builds.
- EAS Update uses separate preview and production branches with matching build channels and environments; runtime compatibility follows appVersion. Increment expo.version before publishing native dependency/configuration changes after a build exists.
- `expo:update` publishes native preview updates; `expo:deploy` publishes the exported Expo web frontend to EAS Hosting. Neither submits an app store listing or creates a native build.

## Work Guidance

- Run commands from the root or explicitly target `@school-connect/expo`.
- Use root `expo:whoami`, `expo:init`, and `expo:info` commands for account operations.
- Root `dev:mobile`, `dev:mobile:go`, and `dev:mobile:tunnel` use scripts/expo-go.mjs: Expo Go tunnel on port 8082 with a direct exp:// QR and no runtime chooser. Pass --clear after -- when cache clearing is needed. `dev:mobile:lan` explicitly selects LAN on 8081; `dev:mobile:client` targets an installed development build. Expo web uses 8081.
- The Expo workspace declares @expo/ngrok as a development dependency so setup does not require a global install. Tunnel URLs are temporary; keep Metro running and scan the QR from the mobile terminal. The separate web terminal can still show a LAN QR.

## Verification

- From the root: `npm run typecheck:expo`, `npm run check:expo`, `npm run export:expo`, and `npm run lint --workspace @school-connect/expo`.
- `npm run dev:expo-web` uses port 8081, separate from the existing web app on 8080.
- Bundle checks are not device tests. Local iOS simulator testing requires macOS.

## Child DOX Index

- [public/AGENTS.md](public/AGENTS.md): SPA HTML template, public school metadata and supplied crest.
- [src/AGENTS.md](src/AGENTS.md): Expo Router entry points, reusable native components, theme, and school feature.
