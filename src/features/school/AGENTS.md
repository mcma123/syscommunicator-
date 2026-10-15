# School feature

## Purpose

- Own school module screens and the shared desktop/mobile web experience.

## Ownership

- `demo-login.tsx` owns the branded web login and profile credential picker; `demo-auth.ts` owns public fictional credentials and parent/staff module visibility; `demo-session-gate.tsx` gates module rendering.
- `portal.tsx` composes module screens and their actions.
- `shell.tsx` owns desktop sidebar, mobile navigation, signed-in identity, and sign-out.
- `components.tsx` owns school cards, child filters, and notice/event/consent/payment dialogs.
- `store.tsx` owns SchoolProvider, useSchool, demo sessions/child selection, offline state, and repository updates.
- Leaf URLs live in `src/routes/`; reusable domain contracts live in `packages/school-core/`.

## Local Contracts

- SchoolProvider creates one mock repository per provider lifetime and shares its snapshot through `useSyncExternalStore`. Role switching must keep the same repository state.
- Screens use `useSchool` and repository updates; do not instantiate per-screen repositories or call backend providers directly.
- Offline updates are blocked by the store and report feedback through the existing toast mechanism.
- Parent and staff demo accounts share module data. Switch accounts through sign-out and credential-based sign-in; do not restore the direct role selector.
- `/signin` is public. Other web module routes require a demo session; Parent accounts cannot render staff-only module previews. Staff roles retain shared staff previews without granular staff permissions. This is not production authentication or authorization.
- Restore only recognized fictional account IDs from sessionStorage after hydration; never store passwords. Browser storage is optional. Sign-out clears session/view state without replacing the shared repository.
- Keep the five web demo profiles (Parent, Teacher, Principal, Finance, Administrator) and their credentials documented in root README.md. Do not apply this web-only login to Expo implicitly.
- Keep named module routes aligned with `navigation`, `staffNavigation`, and the module branches in SchoolPortal.
- Payments, consent, invitations, reports, and audit/delivery displays are simulated. Preserve pending-verification and simulated-payment distinctions.
- School identity is Wynberg Girls Junior School; the app name is Wynberg Girls Junior Connect, the phone label is WGJS Connect, and the tagline is Honor Before Honours. Use `schoolConfig` for these labels and the supplied `/logo.png` crest.
- Preserve the current Open Sans font and module design. Use the school's website red/gold palette through the global CSS tokens; do not restore the previous blue branding.
- Campus imagery and learner/operational data remain generated or fictional demo content, not actual school records.
- The startup/session loading screen must show the supplied school crest, school name, tagline, and an accessible loading status. Keep the crest uncropped and visible in server-rendered HTML while the session restores.

## Work Guidance

- Use the existing UI primitives and global styles; maintain matching modules across desktop and mobile web.
- Update root `FRONTEND.md` when delivered functionality or prototype limits change.

## Verification

- From the root, run `npm run build` and `node node_modules/typescript/bin/tsc --noEmit` for feature changes.
- `npm test` covers demo credential validation, role visibility, session restore/sign-out, blocked storage, and shared repository continuity alongside existing routing/core/mobile checks.

## Child DOX Index

- None. This doc owns the entire school feature subtree.
