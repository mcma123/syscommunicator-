# Frontend tests

## Purpose

- Own frontend auth/store, routing, shared repository and pure parent model tests and setup.

## Ownership

- `demo-auth.test.tsx` checks server-derived identity, auth-provider delegation, loading/revoked states, parent/staff visibility, browser token fallback, credential-free form rendering, sign-out and absence of runtime repository/update/offline-toggle APIs. Its historic filename does not imply demo authentication remains.
- `workflow-panel.test.tsx` verifies confirmation, pending-state disabling, server validation, retained drafts on failure, success only after a resolved submission, and success feedback surviving newly created workflow forms.
- `notifications.test.tsx` verifies accepted-versus-confirmed labels, explicit retry, pending disabling and offline controls.
- `calendar.test.ts` checks Johannesburg month boundaries, spanning/all-day events and interoperable ICS text.
- `live-subscription.test.tsx` uses the real Convex hook with a local watch to catch subscription render loops and verify session unsubscription, native pagination across empty pages, filter reset and independent details.
- `live-data.test.tsx` checks live subscription states/retry, disabled-session data clearing, socket-derived offline behavior and scoped optimistic receipts.
- `permissions.test.ts` checks shared module grants, Finance/Teacher restrictions, unknown modules and explicit guardian/staff combinations.
- `setup.ts` provides jest-dom matchers and the matchMedia mock.
- `app-routing.test.tsx` checks that `/` matches a page rather than only the root route.
- `school-repository.test.ts` checks shared-core mock behavior including native-safe cloning, nested fixture isolation, snapshot identity, subscriptions, and unsubscribe.
- `parent-mobile.test.ts` checks parent filtering, state-derived counters, draft privacy, and consent validation using pure native feature helpers.
- Root `vitest.config.ts` owns jsdom, setup registration, aliases, and test discovery across `src/`.

## Local Contracts

- The routing check uses `router.matchRoutes` without loaders or rendering because jsdom does not load the stylesheets React waits on.
- Keep the setup and test files compatible with the root Vitest configuration.

## Work Guidance

- Follow the existing Vitest and Testing Library setup for frontend tests.

## Verification

- Run `npm test` from the repository root; use `npm run test:watch` during local iteration.
- Current coverage includes routing, shared repositories, and parent selection/action semantics. It is not native device coverage.

## Child DOX Index

- None. This doc owns the entire subtree.
