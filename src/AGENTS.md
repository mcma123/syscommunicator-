# Web application

## Purpose

- Own the TanStack Start frontend and its browser/server entry points.

## Ownership

- This doc owns `router.tsx`, `start.ts`, `server.ts`, `styles.css`, generated `routeTree.gen.ts`, and `hooks/` (including `use-mobile.tsx`).
- Child docs own routes, feature presentation, shared components, utilities, tests, and bundled assets.

## Local Contracts

- `getRouter()` creates one ConvexReactClient and TanStack Query bridge per router/request. Pass both queryClient and convexClient through root context; SchoolAuthProvider reuses that client. Authenticated module subscriptions stay client-side until session restoration, so private data is not prefetched into shared SSR output.
- Generate `routeTree.gen.ts` through Vite/Start; do not edit it by hand.
- Keep SSR entry and error handling compatible with `src/server.ts` configured in root `vite.config.ts`.
- `start.ts` explicitly installs CSRF middleware for server functions and the error middleware; preserve both when changing request handling.
- Global design tokens and school layout styles live in `styles.css`. Shared responsive behavior uses `hooks/use-mobile.tsx`.
- Brand tokens use website red `#C6252B`, gold `#FAB513`, dark red `#861D23`, and charcoal `#3C3C3C`; keep Open Sans and the existing module layout. Supporting background and status colours preserve readable contrast.
- Dark mode redefines the same tokens under `.dark` (warm red-tinted charcoal surfaces, brighter red `#E5484D`, gold highlights) plus `.dark` overrides for fixed-colour sign-in/loading styles. New styles must use tokens or add a matching `.dark` override.

## Work Guidance

- Use the existing TypeScript strict configuration and `@/` alias defined at the root.
- Keep DOM/window access safe during SSR; preserve the effect-based media-query subscription in the mobile hook.

## Verification

- From the root, run `npm run build` for runtime/style changes and `node node_modules/typescript/bin/tsc --noEmit` for type changes.
- `npm test` checks web auth-provider/session delegation and module visibility, home-route matching and shared mock repository behavior; it does not verify responsive layouts or all modules.

## Child DOX Index

- [routes/AGENTS.md](routes/AGENTS.md): root layout, leaf routes, and route conventions.
- [features/AGENTS.md](features/AGENTS.md): frontend feature boundaries.
- [components/AGENTS.md](components/AGENTS.md): shared presentation components.
- [lib/AGENTS.md](lib/AGENTS.md): utilities, school share metadata, and local SSR error capture.
- [test/AGENTS.md](test/AGENTS.md): frontend identity/routing, live subscriptions, workflow confirmations, shared permissions/repositories and pure Expo model tests.
- [assets/AGENTS.md](assets/AGENTS.md): bundled visual assets and their provenance.
