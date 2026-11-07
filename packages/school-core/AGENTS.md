# School domain core

## Purpose

- Own browser-safe, provider-independent school contracts reusable by future clients.

## Ownership

- `src/index.ts` owns Role, Notice, Child, SchoolEvent, Enquiry, SchoolState, SchoolRepository, schoolConfig, fixtures, and helper functions.
- `src/domain.ts` owns the shared enum tuples (roles, statuses, categories, departments, audience kinds, notification channels/kinds/states) and their types; `src/index.ts` re-exports them.
- `src/workflows.ts` owns provider-independent workflow action names, form fields, byte files and temporary download outcomes; exported as `@school-connect/core/workflows`. Server validators and both clients share these names.
- `src/imports.ts` owns roster CSV templates, RFC 4180 parsing, row validation/normalization, formula-prefix refusal and in-file natural-key duplicate detection, exported as `@school-connect/core/imports`. The web preview and the backend commit share it; the backend remains the authority.
- `src/live.ts` owns provider-independent module/detail/dashboard and filter presentation contracts, exported as `@school-connect/core/live`; it imports no fixture data.
- `src/calendar.ts` owns pure Johannesburg month/day calculations and RFC 5545 event export, including UTC/all-day times, escaping and UTF-8 line folding; exported as `@school-connect/core/calendar`.
- `src/permissions.ts` owns the shared module matrix, disabled-module gating and union of explicit staff/guardian grants; `@school-connect/core/permissions` exposes it without importing fixtures.
- `package.json` exports the TypeScript entry as `@school-connect/core` and the enums alone as `@school-connect/core/domain` (used by the Convex backend to build validators without bundling fixtures).
- UI state coordination belongs to each client's school feature; root config owns workspace installation. Expo consumes this package as `@school-connect/core`.

## Local Contracts

- Keep this package independent of React, Clerk, Convex, and browser DOM APIs.
- Changing a `domain.ts` value changes the database contract: coordinate with `packages/backend` (schema/validators) and both clients.
- Preserve `SchoolRepository` only for isolated tests/previews and fixture tooling. Runtime clients use the backend React hooks, not snapshot/update adapters.
- Mock repositories clone `initialState`, replace state on update, notify subscribers, and return an unsubscribe function. Reads must retain snapshot identity until an update.
- Fixtures must remain JSON-compatible: repositories deep-copy them via JSON serialization for Hermes compatibility without requiring structuredClone. Repository instances isolate state between running clients.
- `visibleNotices` implements mock display filtering only. Live access is enforced by backend audience/ownership checks; the shared matrix supplies module grants, never database authorization on its own.
- Keep Johannesburg timezone and ZAR formatting consistent with schoolConfig and the `money` helper.
- `schoolConfig` owns `name` (Wynberg Girls Junior School), `appName` (Wynberg Girls Junior Connect), `shortName` (WGJS Connect), `subtitle` (Honor Before Honours), `logoUrl` (/logo.png), and the school website URL. These are display contracts for web and future clients.

## Work Guidance

- Coordinate domain type changes with consumers in `src/features/school/`.
- Keep provider hooks in `packages/backend/react.ts` and client adapters in each store. This package remains types, pure rules, branding and test fixtures.

## Verification

- From the root, `npm run build` checks the package as consumed by the app; `node node_modules/typescript/bin/tsc --noEmit` checks types imported by the frontend.
- `src/test/calendar.test.ts` verifies date boundaries, spanning events, all-day exclusive ends and ICS formatting.
- `src/test/imports.test.ts` verifies CSV quoting, templates, header/field errors, normalization, duplicates, formula prefixes and size caps.
- `src/test/permissions.test.ts` verifies denied modules, Finance restrictions and explicit combined grants.
- `npm test` includes `src/test/school-repository.test.ts` for native-safe cloning, nested fixture isolation, snapshot identity, notification, and unsubscribe behavior.

## Child DOX Index

- None. This doc owns `src/` and the entire package subtree.
