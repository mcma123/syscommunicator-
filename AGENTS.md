# DOX framework

- DOX is highly performant AGENTS.md hierarchy installed here
- Agent must follow DOX instructions across any edits

## Core Contract

- AGENTS.md files are binding work contracts for their subtrees
- Work products, source materials, instructions, records, assets, and durable docs must stay understandable from the nearest applicable AGENTS.md plus every parent AGENTS.md above it

## Read Before Editing

1. Read the root AGENTS.md
2. Identify every file or folder you expect to touch
3. Walk from the repository root to each target path
4. Read every AGENTS.md found along each route
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path, read that child and continue from there
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide rules
7. If docs conflict, the closer doc controls local work details, but no child doc may weaken DOX

Do not rely on memory. Re-read the applicable DOX chain in the current session before editing.

## Update After Editing

Every meaningful change requires a DOX pass before the task is done.

Update the closest owning AGENTS.md when a change affects:

- purpose, scope, ownership, or responsibilities
- durable structure, contracts, workflows, or operating rules
- required inputs, outputs, permissions, constraints, side effects, or artifacts
- user preferences about behavior, communication, process, organization, or quality
- AGENTS.md creation, deletion, move, rename, or index contents

Update parent docs when parent-level structure, ownership, workflow, or child index changes. Update child docs when parent changes alter local rules. Remove stale or contradictory text immediately. Small edits that do not change behavior or contracts may leave docs unchanged, but the DOX pass still must happen.

## Hierarchy

- Root AGENTS.md is the DOX rail: project-wide instructions, global preferences, durable workflow rules, and the top-level Child DOX Index
- Child AGENTS.md files own domain-specific instructions and their own Child DOX Index
- Each parent explains what its direct children cover and what stays owned by the parent
- The closer a doc is to the work, the more specific and practical it must be

## Child Doc Shape

- Create a child AGENTS.md when a folder becomes a durable boundary with its own purpose, rules, responsibilities, workflow, materials, or quality standards
- Work Guidance must reflect the current standards of the project or user instructions; if there are no specific standards or instructions yet, leave it empty
- Verification must reflect an existing check; if no verification framework exists yet, leave it empty and update it when one exists

Default section order:
- Purpose
- Ownership
- Local Contracts
- Work Guidance
- Verification
- Child DOX Index

## Style

- Keep docs concise, current, and operational
- Document stable contracts, not diary entries
- Put broad rules in parent docs and concrete details in child docs
- Prefer direct bullets with explicit names
- Do not duplicate rules across many files unless each scope needs a local version
- Delete stale notes instead of explaining history
- Trim obvious statements, repeated rules, misplaced detail, and warnings for risks that no longer exist

## Closeout

1. Re-check changed paths against the DOX chain
2. Update nearest owning docs and any affected parents or children
3. Refresh every affected Child DOX Index
4. Remove stale or contradictory text
5. Run existing verification when relevant
6. Report any docs intentionally left unchanged and why

## User Preferences

When the user requests a durable behavior change, record it here or in the relevant child AGENTS.md

- Use DOX for this repository and keep the instruction hierarchy and indexes current.
- Preserve the current Open Sans font and TanStack module design; use a light, premium banking-inspired layout for the Expo parent frontend while applying Wynberg Girls Junior School website colours and the user-supplied crest. Naming: Wynberg Girls Junior Connect (store/app name), WGJS Connect (phone label), Wynberg Girls Junior School (inside the app), Honor Before Honours (tagline).

<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## School Connect architecture
- Keep the supported TanStack Start web application at the monorepo root and provider-independent domain types and mock repositories in `packages/school-core`; this allows future clients to reuse the same domain contracts without changing the preview bootstrap.
- Keep TanStack module presentation under `src/features/school` and Expo presentation under `apps/expo/src/features/school`. Give named modules their own leaf routes in each client.
- Share one in-memory mock repository through the root provider; prototype role switching must see the same state without creating production authorisation or persistence.
- Prepare the future Convex backend in `packages/backend`. Clients remain on mocks until production adapters and authentication are implemented; components must not call providers directly.

## Project Scope and Root Ownership

- School Connect is a monorepo: the supported TanStack Start web app stays at the root, Expo Android/iOS/web is in `apps/expo`, the Convex scaffold is in `packages/backend`, and provider-independent domain code is in `packages/school-core`.
- Root owns build and workspace configuration, dependency manifests and lockfiles, `.lovable/` metadata, `.gitignore`, `README.md`, `FRONTEND.md`, and `roadmap.md`.
- `FRONTEND.md` records delivered modules, research sources, and prototype limitations; keep it aligned with meaningful scope changes. `roadmap.md` owns planned work.
- No production backend, authentication, persistence, real email, or payment processing is provisioned. Expo provides interactive parent screens with local mock data; staff routes remain placeholders. The existing TanStack frontend retains its broader role workflows.
- Keep generated and local output out of the DOX tree: `node_modules/`, `.git/`, `.output/`, `.tanstack/`, `.wrangler/`, and `.firecrawl/`. Research downloads in `.firecrawl/` are ignored; durable findings belong in the owning documentation.

## Root Work Guidance

- `vite.config.ts` uses `@lovable.dev/vite-tanstack-config`, which already supplies Start, React, Tailwind, path aliases, and Nitro plugins. Do not add duplicate plugins.
- Local setup is documented in `README.md`; use npm 11 with the single root `package-lock.json` for all workspaces. Do not add competing package-manager lockfiles; EAS uses the root lockfile to select npm.
- DOX is Markdown only. Do not add a DOX package, dependency, or runtime.

## Root Verification

- Run existing checks relevant to code changes from the repository root: `npm test`, `npm run build`, `node node_modules/typescript/bin/tsc --noEmit`, and `npm run lint`.
- Existing tests cover web demo credentials/session lifecycle/parent module visibility, home-route matching, shared mock repository isolation/subscription/native cloning, and pure parent mobile filtering/validation/counters/privacy; do not describe them as native device coverage.
- For Expo/backend changes, run `typecheck:expo`, `typecheck:backend`, `check:expo`, and `export:expo` root commands as relevant. Keep private `.env` files ignored and access tokens out of app configuration and bundles.
- For documentation changes, check referenced local paths, child indexes, inherited contracts, and `git diff --check`.

## Framework Source

- Framework instructions are copied from https://github.com/agent0ai/dox/blob/main/AGENTS.md; project context and indexes are maintained locally.

## Child DOX Index

- [src/AGENTS.md](src/AGENTS.md): web application, runtime, styling, and frontend subdomains.
- [packages/AGENTS.md](packages/AGENTS.md): reusable workspace packages and the school core.
- [public/AGENTS.md](public/AGENTS.md): static files served directly by the web app.
- [apps/AGENTS.md](apps/AGENTS.md): additional client workspaces, including Expo for Android/iOS/web.
- [scripts/AGENTS.md](scripts/AGENTS.md): Expo account helpers, phone/QR development launcher, and native asset preparation.
