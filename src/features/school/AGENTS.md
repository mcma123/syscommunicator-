# School feature

## Purpose

- Own school module screens and the shared desktop/mobile web experience.

## Ownership

- `portal.tsx` composes module screens and their actions.
- `shell.tsx` owns desktop sidebar, mobile navigation, and demo role switching.
- `components.tsx` owns school cards, child filters, and notice/event/consent/payment dialogs.
- `store.tsx` owns SchoolProvider, useSchool, demo role/child selection, offline state, and repository updates.
- Leaf URLs live in `src/routes/`; reusable domain contracts live in `packages/school-core/`.

## Local Contracts

- SchoolProvider creates one mock repository per provider lifetime and shares its snapshot through `useSyncExternalStore`. Role switching must keep the same repository state.
- Screens use `useSchool` and repository updates; do not instantiate per-screen repositories or call backend providers directly.
- Offline updates are blocked by the store and report feedback through the existing toast mechanism.
- Parent and staff demo roles share module data. Module access and role switching are prototypes, not production authorization.
- Keep named module routes aligned with `navigation`, `staffNavigation`, and the module branches in SchoolPortal.
- Payments, consent, invitations, reports, and audit/delivery displays are simulated. Preserve pending-verification and simulated-payment distinctions.
- School identity is Wynberg Girls Junior School; the app name is Wynberg Girls Junior Connect, the phone label is WGJS Connect, and the tagline is Honor Before Honours. Use `schoolConfig` for these labels and the supplied `/logo.png` crest.
- Preserve the current Open Sans font and module design. Use the school's website red/gold palette through the global CSS tokens; do not restore the previous blue branding.
- Campus imagery and learner/operational data remain generated or fictional demo content, not actual school records.

## Work Guidance

- Use the existing UI primitives and global styles; maintain matching modules across desktop and mobile web.
- Update root `FRONTEND.md` when delivered functionality or prototype limits change.

## Verification

- From the root, run `npm run build` and `node node_modules/typescript/bin/tsc --noEmit` for feature changes.
- `npm test` currently checks only home-route matching; no school interaction suite exists.

## Child DOX Index

- None. This doc owns the entire school feature subtree.
