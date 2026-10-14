# Public static files

## Purpose

- Own files served directly from the web application's public root.

## Ownership

- `logo.png` is the user-supplied school crest used by the app, PNG favicon, and Apple touch icon. Keep the original image intact.
- `manifest.webmanifest` owns the web app name, short phone label, theme colours, and crest icon reference. `favicon.ico` is a legacy asset; root head uses `logo.png`.
- `robots.txt` contains crawler directives.
- Bundled imports belong to `src/assets/`, which has its own contract.

## Local Contracts

- Keep `/logo.png` and `/manifest.webmanifest` compatible with `src/routes/__root.tsx` and the school shell.
- Manifest `name` is Wynberg Girls Junior Connect and `short_name` is WGJS Connect; keep these aligned with schoolConfig. Native App Store / Google Play listings are outside this frontend repo.
- Treat `robots.txt` as crawler configuration; its current policy allows crawling.

## Work Guidance

## Verification

- Run `npm run build` from the root to verify public asset delivery; check that manifest and logo URLs respond from the dev server after changes.

## Child DOX Index

- None. This doc owns the entire subtree.
