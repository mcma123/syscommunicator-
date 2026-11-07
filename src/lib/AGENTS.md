# Frontend and server utilities

## Purpose

- Own shared helpers, school metadata, and local error handling used by Start.

## Ownership

- `utils.ts` owns class merging; `error-page.ts` owns the standalone fallback HTML.
- `error-capture.ts` captures original server errors locally; no external telemetry hooks are installed.
- `school-metadata.ts` owns school-only Open Graph/Twitter identity and crest references. Use the request origin on the server and location origin in the browser for absolute crest URLs; optional public `VITE_SITE_URL` overrides the origin and is never a private token.
- `theme.ts` owns light/dark theme state: the `wgjs-theme` localStorage choice (falls back to the OS preference), the `dark` class and `color-scheme` on `<html>`, theme-color meta, the pre-paint `themeInitScript`, and the `useTheme` hook with an optional circular view-transition reveal that respects reduced motion.
- `../server.ts`, `../start.ts`, and the root route consume these helpers and have their own owners.

## Local Contracts

- Keep `cn` compatible with clsx and Tailwind class merging.
- Preserve server error stacks/cause details and consume captured errors with the existing short expiry; the console wrapper is an intentional runtime side effect.
- Do not add scaffold-provider reporting, editor hooks, or remote error transmission.
- The fallback error page must render without React or application bundles.

## Work Guidance

- Match the existing client/server guards when changing utilities used by both runtimes.

## Verification

- From the root, run `npm run build` and `node node_modules/typescript/bin/tsc --noEmit`.
- No dedicated utility/error tests currently exist.

## Child DOX Index

- None. This doc owns the entire subtree.
