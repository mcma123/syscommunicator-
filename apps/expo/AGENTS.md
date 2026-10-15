# Expo client

## Purpose

- Own the WGJS parent frontend for Android, iOS, and Expo web using Expo SDK 57 and Expo Router.

## Ownership

- Own app configuration, package manifest, EAS profiles, TypeScript/ESLint setup, assets, environment examples, and client development documentation.
- Source presentation and mock state are owned by the source child contract.

## Local Contracts

- Launcher name is WGJS Connect; full product name is Wynberg Girls Junior Connect. The slug is `wynberg-girls-junior-connect`.
- Retain Open Sans, website red/gold colours, and the supplied crest. `assets/logo.png` is a copy of the original; square native icons are padded derivatives without cropping.
- Use Metro's automatic workspace support; do not add manual watchFolders or dependency resolution overrides.
- Expo uses its SDK-compatible React/React Native versions. Keep React/React DOM aligned across clients to avoid duplicate React in a bundle.
- Declare Reanimated and Worklets directly at the versions in Expo's bundledNativeModules.json. Router/native-module optional peers can otherwise resolve older JS packages than Expo Go's native binaries; doctor does not check undeclared transitive peers.
- Root `.env` supplies EXPO_TOKEN only to EAS account commands. Never read it into app configuration, `extra`, public variables, or bundles.
- EAS CLI is invoked on demand at version 24.13.0 through the root helper, not installed as an app dependency. The account project is `@mcmarsh/wynberg-girls-junior-connect`; its public ID lives in app.json and is inherited by app.config.ts.
- The app uses mock state; `EXPO_PUBLIC_CONVEX_URL` alone does not connect a backend. Parent interactions use local state. No production sign-in, payments, push notifications, PDF rendering, or school message delivery is connected.
- EAS profiles prepare later builds; setup does not submit store listings or trigger builds.
- EAS Update uses the preview branch and matching build channels; runtime compatibility follows appVersion. Increment expo.version before publishing native dependency/configuration changes after a build exists.
- `expo:update` publishes native preview updates; `expo:deploy` publishes the exported Expo web frontend to EAS Hosting. Neither submits an app store listing or creates a native build.

## Work Guidance

- Run commands from the root or explicitly target `@school-connect/expo`.
- Use root `expo:whoami`, `expo:init`, and `expo:info` commands for account operations.
- Root `dev:mobile` and `dev:mobile:go`, and workspace web/android/ios commands, explicitly target Expo Go. `dev:mobile:client` targets an installed development build. Default Expo Metro uses port 8081, also used by Expo web.

## Verification

- From the root: `npm run typecheck:expo`, `npm run check:expo`, `npm run export:expo`, and `npm run lint --workspace @school-connect/expo`.
- `npm run dev:expo-web` uses port 8081, separate from the existing web app on 8080.
- Bundle checks are not device tests. Local iOS simulator testing requires macOS.

## Child DOX Index

- [src/AGENTS.md](src/AGENTS.md): Expo Router entry points, reusable native components, theme, and school feature.
