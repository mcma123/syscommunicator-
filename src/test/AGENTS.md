# Frontend tests

## Purpose

- Own shared test setup and the existing routing regression test.

## Ownership

- `setup.ts` provides jest-dom matchers and the matchMedia mock.
- `app-routing.test.tsx` checks that `/` matches a page rather than only the root route.
- `school-repository.test.ts` checks shared-core mock behavior including native-safe cloning, nested fixture isolation, snapshot identity, subscriptions, and unsubscribe.
- Root `vitest.config.ts` owns jsdom, setup registration, aliases, and test discovery across `src/`.

## Local Contracts

- The routing check uses `router.matchRoutes` without loaders or rendering because jsdom does not load the stylesheets React waits on.
- Keep the setup and test files compatible with the root Vitest configuration.

## Work Guidance

- Follow the existing Vitest and Testing Library setup for frontend tests.

## Verification

- Run `npm test` from the repository root; use `npm run test:watch` during local iteration.
- Current coverage is home-route matching and shared mock repository behavior, not module interaction or native device coverage.

## Child DOX Index

- None. This doc owns the entire subtree.
