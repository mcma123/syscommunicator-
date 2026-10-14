# Convex backend workspace

This workspace prepares the shared backend for the TanStack and Expo clients.
It contains an empty schema and has no deployment, production tables, queries,
authentication, seed data, or client connection yet.

Run `npm run typecheck:backend` from the repository root to check the scaffold.
When ready to provision Convex, run `npm run dev:backend` and follow its separate
account setup. The Expo access token does not authenticate to Convex.

Convex will write deployment variables to an ignored `.env.local` in this folder
and generate `convex/_generated/` API types. Do not invent or hand-edit those
generated files. Then configure the public deployment URL in the clients:
`VITE_CONVEX_URL` for the existing web app and `EXPO_PUBLIC_CONVEX_URL` for Expo.
Those URLs alone do not enable the connection: implement a repository adapter
and production access checks before switching clients away from mock data.

Provider-independent domain contracts stay in `packages/school-core`. Backend
queries/mutations and client adapters will implement those contracts; screens
must not call backend providers directly.
