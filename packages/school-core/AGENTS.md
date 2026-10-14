# School domain core

## Purpose

- Own browser-safe, provider-independent school contracts reusable by future clients.

## Ownership

- `src/index.ts` owns Role, Notice, Child, SchoolEvent, Enquiry, SchoolState, SchoolRepository, schoolConfig, fixtures, and helper functions.
- `package.json` exports the TypeScript entry as `@school-connect/core`.
- UI state coordination belongs to each client's school feature; root config owns workspace installation. Expo consumes this package as `@school-connect/core`.

## Local Contracts

- Keep this package independent of React, Clerk, Convex, and browser DOM APIs.
- Preserve `SchoolRepository.getSnapshot`, `update`, and `subscribe` for the root provider and future adapters.
- Mock repositories clone `initialState`, replace state on update, notify subscribers, and return an unsubscribe function. Reads must retain snapshot identity until an update.
- Fixtures must remain JSON-compatible: repositories deep-copy them via JSON serialization for Hermes compatibility without requiring structuredClone. Repository instances isolate state between running clients.
- `visibleNotices` implements demo role/child filtering. Demo roles do not establish production authorization.
- Keep Johannesburg timezone and ZAR formatting consistent with schoolConfig and the `money` helper.
- `schoolConfig` owns `name` (Wynberg Girls Junior School), `appName` (Wynberg Girls Junior Connect), `shortName` (WGJS Connect), `subtitle` (Honor Before Honours), `logoUrl` (/logo.png), and the school website URL. These are display contracts for web and future clients.

## Work Guidance

- Coordinate domain type changes with consumers in `src/features/school/`.
- Implement future provider adapters against `packages/backend` using the repository contract; current clients still use mocks.

## Verification

- From the root, `npm run build` checks the package as consumed by the app; `node node_modules/typescript/bin/tsc --noEmit` checks types imported by the frontend.
- `npm test` includes `src/test/school-repository.test.ts` for native-safe cloning, nested fixture isolation, snapshot identity, notification, and unsubscribe behavior.

## Child DOX Index

- None. This doc owns `src/` and the entire package subtree.
