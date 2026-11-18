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
- After QA review of every candidate, hand the candidate, changed paths, scope, findings, and test evidence to `dev-security@starter` through the durable queue. Security review is required before reporting work ready; findings return to the builder for fixes and re-review.
- Defer Phase 9 payment integration until the other feature work is complete. Continue with Phase 10 notifications next; leave payment-dependent reminders, receipt emails and payment journey checks pending until payments are implemented. Final launch still requires the applicable payment checks.
- Keep the project independent of the original scaffold provider: no editor integration, telemetry, branding, project metadata, or Git synchronization. Shared links must use school names, descriptions, and the supplied crest.
- Preserve Open Sans and the existing module routes. Use the SYS palette (pink `#F4024D`, navy `#0B1B42`, pale surfaces) and supplied SYS logo for Syscommunicator product branding across web and Expo. School names remain live school content.


## School Connect architecture
- Keep the supported TanStack Start web application at the monorepo root and provider-independent domain types and mock repositories in `packages/school-core`; this allows future clients to reuse the same domain contracts without changing the preview bootstrap.
- Keep TanStack module presentation under `src/features/school` and Expo presentation under `apps/expo/src/features/school`. Give named modules their own leaf routes in each client.
- Keep mock repositories for isolated tests/previews and backend fixtures. Runtime providers own identity and view state; module data comes from the shared live Convex hook.
- `packages/backend` is the single Convex backend for both clients; the Syscommunicator clone targets its own self-hosted instance through ignored local environment files. Never run Convex from the root. Convex Auth supplies identity on both clients; shared authenticated hooks read paginated modules and independent details from normalized tables. Scoped dashboard counts use the aggregate component and rebuildable projections. Components use the owning client store rather than calling providers directly.
- Backend fixture commands seed the identified dev database through internal functions, preserve existing fixture edits, and expose reset separately. Production and unknown deployment targets are blocked by both command and server guards. CI uses isolated convex-test databases; cloud preview CI is deferred.

## Project Scope and Root Ownership

- School Connect is a monorepo: the supported TanStack Start web app stays at the root, Expo Android/iOS/web is in `apps/expo`, the shared Convex backend is in `packages/backend`, and provider-independent domain code is in `packages/school-core`.
- Root owns build and workspace configuration, dependency manifests and lockfiles, `.gitignore`, `README.md`, `FRONTEND.md`, `roadmap.md`, and `OPERATIONS.md` (prepared, unexecuted Phase 13 production/backup/monitoring/launch runbook and its missing inputs).
- Root owns `SECURITY.md`, the cross-client security assessment and residual-risk register maintained by `dev-security@starter` in coordination with the builder. It records exact reviewed candidates, evidence, unresolved risks and re-review outcomes; it is not a claim of continuous monitoring.
- Root also owns the client deliverable `WGJS-Connect-Scope-and-Requirements.pdf`; its reproducible source and diagram contracts live under `documents/`.
- `FRONTEND.md` records delivered modules, research sources, and prototype limitations; keep it aligned with meaningful scope changes. `roadmap.md` owns planned work. `Backend-and-Database-Integration.md` owns the phased Convex backend/database integration checklist for both clients; tick steps only after verification.
- Dev Convex Auth is connected on web and Expo, with real sessions, server-derived identity, invitations, and recovery flows. Live email delivery awaits deployment-only Resend configuration and a verified sender. No production deployment or payment processing is provisioned. Both clients read fictional dev database records; notice receipts persist across clients. Phase 7 writes persist on both clients: notice publication/scheduling, events, consent, enquiries, attendance/conduct, report review/release, people/settings and profiles. Native staff controls use server-derived roles. Payment processing remains disabled.
- Web creates one Convex client per router alongside its TanStack Query bridge; private data is deferred until the client restores identity. Expo creates one client above its navigator. Expo web exports a SPA so real database-ID detail URLs resolve without build-time private-data enumeration.
- Public identity/onboarding/protected-read references and types are exported through `@school-connect/backend/client`, verified against generated APIs by backend tests; internal generated APIs stay in backend code. No hard-coded demo passwords or role/account IDs may restore a session. Development accounts require the backend flag and the known dev URL; private credentials live only in ignored `.env.auth.local`.
- Shared module grants live in school-core; backend session actors and document-scope checks enforce guardian, teacher and Finance boundaries. Authenticated school mutations require audit entries; runtime screens do not mount mock repositories. Server-produced workflow forms drive both clients through their store adapters; clients never grant authority from a displayed control. Module flags govern server reads/writes and navigation. Phase 8 files use session-owned upload reservations (PDF 10 MiB, images 5 MiB), authorized two-minute download grants, school-branded receipt PDFs from verified payment records, and conservative hourly cleanup. Receipt generation never changes payment status. Phase 10 adds session-bound phone registration, preference/quiet-hour-aware notice and consent notifications through bounded Workpools, provider-confirmed delivery reporting and hourly invitation expiry. Payment messages remain deferred; live email and physical-phone acceptance require service credentials and a compatible build.
- Ad Center: Teachers, Principals and Administrators manage image/poster/short-video ads in the `ads` module (teachers submit for approval; Principals/Administrators publish). Parents see running ads in their audience as a home spotlight carousel plus a popup after every login stepping through all popup ads on web and Expo. Staff drag and drop up to 10 pictures/videos per ad; media lives in the private Cloudflare R2 bucket and is delivered only through signed, revocable `/media/ad` links (`packages/backend/FILES.md`, setup in `OPERATIONS.md`); Expo video needs runtime 1.0.4. Ad views, popup views and clicks are counted once per parent per day (`adStats`); the public `/advertise` page collects consented business enquiries into the leaders-only Advertisers pipeline with consent-only follow-up and monthly report emails (POPIA notes in `OPERATIONS.md`).
- Class CSV import: Teachers (own classes) and Principals (any class) import learners plus optional staged parent contacts from a class folder on web, through the same audited `imports` endpoints (`IMPORTS.md` → Class imports).
- Phase 11 roster import: Administrators preview and commit CSV classes/learners/guardians/staff through audited server chunks (`packages/backend/IMPORTS.md`). Guardians/staff are staged as non-access contacts; activation, POPIA consent, preview-deployment rehearsal, school sign-off and production import remain open.
- Keep generated and local output out of the DOX tree: `node_modules/`, `.git/`, `.output/`, `.tanstack/`, `.wrangler/`, and `.firecrawl/`. Research downloads in `.firecrawl/` are ignored; durable findings belong in the owning documentation.

## Root Work Guidance

- `vite.config.ts` directly configures Vite, TanStack Start, React, Tailwind, native TypeScript path resolution, and build-only Nitro. Production output is a standalone Node server; `npm start` serves the build. Preserve the custom SSR entry and CSRF middleware.
- Dokploy hosts the root web app using the root `Dockerfile` with repository-root build context. Build with Node 24/npm 11 and run Nitro on `0.0.0.0:3000`; do not deploy this server-rendered client through static-site Caddy detection. `.dockerignore` excludes private environments, local dependencies and generated output. Copy only the complete `.output` into the runtime image; no Expo or database process runs there. Pass the public `VITE_CONVEX_URL` as a Docker build argument for authentication; never copy backend signing/email secrets into the image.
- Local setup is documented in `README.md`; use npm 11 with the single root `package-lock.json` for all workspaces. Do not add competing package-manager lockfiles; EAS uses the root lockfile to select npm.
- DOX is Markdown only. Do not add a DOX package, dependency, or runtime.

## Root Verification

- Run existing checks relevant to code changes from the repository root: `npm test`, `npm run build`, `node node_modules/typescript/bin/tsc --noEmit`, and `npm run lint`.
- Frontend Vitest uses two workers; backend Vitest uses one worker and a 15-second default test timeout to bound component/fixture memory on Windows and CI.
- `npm run test:backend` verifies development fixture commands, Convex seed/reset, authentication, role/ownership denials and audit rollback. GitHub CI runs both test suites, web/Expo/backend TypeScript checks, root ESLint and Expo ESLint without cloud credentials.
- Existing tests cover real-session store delegation/rendering, parent module visibility, home-route matching, shared mock repository isolation/subscription/native cloning, pure parent mobile filtering/validation/counters/privacy, backend verification/recovery/invitations/session revocation and seed/reset, live subscription stability/connection/retry, module scope, persisted notice receipts, cursor pagination beyond 50 rows, independent details, scoped aggregate counts, calendar exports, audited write workflows, scheduling/fanout, PDF release access, account reactivation/session cutoffs, submission confirmation/error UI, protected file grants, upload validation and conservative orphan cleanup. Mocked email tests and API smoke checks are not live email delivery or native device coverage.
- For Expo/backend changes, run `typecheck:expo`, `typecheck:backend`, `check:expo`, and `export:expo` root commands as relevant. Keep private `.env` files ignored and access tokens out of app configuration and bundles.
- For documentation changes, check referenced local paths, child indexes, inherited contracts, and `git diff --check`.

## Framework Source

- Framework instructions are copied from https://github.com/agent0ai/dox/blob/main/AGENTS.md; project context and indexes are maintained locally.

## Child DOX Index

- [documents/AGENTS.md](documents/AGENTS.md): client-facing documents, scope sources, diagrams, and PDF verification.
- [src/AGENTS.md](src/AGENTS.md): web application, runtime, styling, and frontend subdomains.
- [packages/AGENTS.md](packages/AGENTS.md): reusable workspace packages and the school core.
- [public/AGENTS.md](public/AGENTS.md): static files served directly by the web app.
- [apps/AGENTS.md](apps/AGENTS.md): additional client workspaces, including Expo for Android/iOS/web.
- [scripts/AGENTS.md](scripts/AGENTS.md): Expo account helpers, phone/QR development launcher, native/receipt asset preparation, and guarded backend fixture/auth helpers.
- [.github/AGENTS.md](.github/AGENTS.md): Node/npm CI with isolated backend tests and client/backend TypeScript verification.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

All Convex code lives in `packages/backend/convex/` (run Convex CLI commands from
`packages/backend`). When working on Convex code, **always read
`packages/backend/convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills are installed at the repository root (`.claude/skills`,
`.agents/skills`). Refresh guidelines with `npx convex ai-files install` from
`packages/backend`, then delete the duplicate skill folders it creates there.

<!-- convex-ai-end -->
