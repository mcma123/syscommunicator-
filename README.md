# Wynberg Girls Junior Connect

A school communication monorepo for Wynberg Girls Junior School, inspired by d6 module workflows. The existing TanStack web app stays at the root; `apps/expo` provides an Android, iOS, and Expo web scaffold; `packages/backend` prepares a future Convex database; `packages/school-core` shares domain contracts and mock data. The apps use the school's red and gold colours, supplied crest, and the tagline **Honor Before Honours**, while retaining Open Sans.

The full app/store name is **Wynberg Girls Junior Connect**, the phone icon label is **WGJS Connect**, and the in-app school name is **Wynberg Girls Junior School**. Both clients include the school branding. Native store submissions and live backend integration remain future work.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4a2a4cc7-ba26-44d1-9b9c-a551ec746957).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Use Node.js 24 LTS and npm 11. Install all workspaces from the root. Both clients run on mock data without database credentials; each client owns its own temporary state and changes reset on reload.

```sh
git clone <this-repository-url>
cd <repository-name>
npx --yes npm@11 ci
npm run dev
```

The npm 11 command uses `package-lock.json` without replacing your globally installed npm. It also avoids the dependency-resolution error encountered with npm 10 on this machine.

Run `npm run build` for a TanStack production build and `npm test` for routing and shared repository checks. The development server prints its local URL after startup.

## Workspace commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Existing TanStack web app, port 8080 |
| `npm run dev:mobile` | Expo development server for Android/iOS |
| `npm run dev:expo-web` | Expo web development server, port 8081 |
| `npm run dev:backend` | Convex setup/development; provisions only when explicitly run and authenticated |
| `npm run typecheck:web` | Existing web TypeScript check |
| `npm run typecheck:expo` | Expo TypeScript check |
| `npm run typecheck:backend` | Offline backend schema check |
| `npm run check:expo` | Expo diagnostics |
| `npm run export:expo` | Android, iOS, and web bundle export |
| `npm run expo:whoami` / `expo:init` / `expo:info` | Authenticate, link, and inspect the Expo account project |

Expo currently includes native home and module placeholders. Follow [the Expo workspace guide](apps/expo/README.md) to develop those screens and [the backend guide](packages/backend/README.md) when ready to provision Convex.

## Local account credentials

The ignored root `.env` stores `EXPO_TOKEN` for EAS account commands only. Commit only `.env.example`, never the real `.env`. The account helper loads this file without exposing it to clients. Never use an `EXPO_PUBLIC_*` variable for the token or add it to app configuration. Expo credentials do not authenticate to Convex.

No cloud build, store submission, or live Convex deployment is performed by installation.

## AI agent instructions

This repository uses the [DOX framework](https://github.com/agent0ai/dox). Start with [AGENTS.md](AGENTS.md), follow its Child DOX Index to the contracts governing the files you will edit, and update affected contracts and indexes before finishing. DOX requires no package or runtime installation.
