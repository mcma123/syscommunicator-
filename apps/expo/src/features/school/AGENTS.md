# Native school feature

## Purpose

- Own the native home screen and module scaffold for future school app development.

## Ownership

- `store.tsx` owns the shared mock repository provider and demo role selection.
- `home.tsx` renders shared notices and the module directory.
- `modules.ts` lists module IDs/titles; `module-placeholder.tsx` renders their starter screens.

## Local Contracts

- Mount one repository per provider lifetime and preserve it across role switches and route navigation.
- Import domain types, fixtures, filters, and names from `@school-connect/core`.
- Each listed module has a matching named Expo Router leaf route.
- Module placeholders are explicitly unfinished. Do not imply they process payments, submit forms, authenticate users, or save production data.
- Demo state is local to each running app and resets when the app reloads; it is not shared live with TanStack.
- Preserve WGJS branding and the user-approved font/design direction when implementing native modules.

## Work Guidance

- Use React Native primitives and shared native `SchoolScreen`/`SchoolText` components.
- Keep provider integrations behind the SchoolRepository contract in future work.

## Verification

- Root `typecheck:expo`, `export:expo`, and `check:expo` commands verify the scaffold.
- Root `npm test` checks shared repository behavior, not native interactions.

## Child DOX Index

- None. This doc owns the entire native school feature.
