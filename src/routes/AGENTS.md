# File routes

## Purpose

- Own direct URLs and the TanStack Start root layout.

## Ownership

- All route `.tsx` files and `README.md` in this folder are owned here.
- Module presentation belongs to `../features/school/`; `../routeTree.gen.ts` is generated outside this subtree.

## Local Contracts

- `__root.tsx` is the sole root layout. Preserve `Outlet`, `HeadContent`, `Scripts`, QueryClientProvider, SchoolAuthProvider using the router-owned Convex client, SchoolProvider, and the toaster.
- `/signin` renders public SchoolLogin for passwords, email verification/recovery and invitation acceptance. DemoSessionGate retains its existing filename but now gates live Convex identity and session status; preserve module leaf URLs.
- Leaf routes bind `createFileRoute` paths to the matching `SchoolPortal` module. Named modules must retain direct links.
- Keep error/not-found boundaries and the root head metadata compatible with the application shell.
- Use `schoolConfig` for school names in page metadata. Root head links `/logo.png` as the PNG favicon and Apple touch icon, and `/manifest.webmanifest` for the full app name and phone label.
- Inherit school share tags from `../lib/school-metadata.ts`; root and sign-in previews use the app name and supplied crest without scaffold-provider branding.
- File route conventions are detailed in [README.md](README.md); do not introduce Next.js or Remix layout conventions.

## Work Guidance

- Regenerate the route tree through `npm run dev` or `npm run build` when route files change.
- When a module path changes, check the school navigation and links in `../features/school/` as well.

## Verification

- From the root, run `npm test` for the existing home-route check and `npm run build` for route generation/bundling.
- Run `node node_modules/typescript/bin/tsc --noEmit` after generation to check typed route links.

## Child DOX Index

- None. This doc owns the entire subtree.
