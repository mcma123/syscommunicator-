# Frontend and server utilities

## Purpose

- Own shared helpers and the error-reporting infrastructure used by Start and Lovable.

## Ownership

- `utils.ts` owns class merging; `error-page.ts` owns the standalone fallback HTML.
- `error-capture.ts` captures original server errors; `lovable-error-reporting.ts` forwards browser errors to optional Lovable hooks.
- `../server.ts`, `../start.ts`, and the root route consume these helpers and have their own owners.

## Local Contracts

- Keep `cn` compatible with clsx and Tailwind class merging.
- Preserve server error stacks/cause details and consume captured errors with the existing short expiry; the console wrapper is an intentional runtime side effect.
- Keep browser reporting safe when `window` or Lovable hooks are absent.
- The fallback error page must render without React or application bundles.

## Work Guidance

- Match the existing client/server guards when changing utilities used by both runtimes.

## Verification

- From the root, run `npm run build` and `node node_modules/typescript/bin/tsc --noEmit`.
- No dedicated utility/error tests currently exist.

## Child DOX Index

- None. This doc owns the entire subtree.
