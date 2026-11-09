# Production operations and launch runbook (Phase 13)

Status: **prepared, not executed.** No production Convex deployment, production web build, production
native binary, custom domain, backup schedule or monitoring exists yet. Every step below needs the inputs
in the first section. Payments (Phase 9) are deferred, so launch readiness stays **pending** on the
applicable payment checks even after these steps pass.

## Inputs needed before any production change

| Input | Owner | Used by |
| --- | --- | --- |
| Convex team/project for production and a production deploy key (`CONVEX_DEPLOY_KEY`, kept outside the repo) | School / user | Deploy, env vars, backups |
| Production web origin (custom domain) and DNS access | School / user | Dokploy, `SITE_URL`, auth origins |
| Resend API key and verified sender domain (`AUTH_EMAIL_FROM`) | School / user | Invitations, recovery, urgent notices |
| EAS credentials for production builds (Apple/Google accounts) and push credentials | User | Native binaries, push |
| Client error-capture choice (for example Sentry) or an explicit "none" | User | Monitoring |
| Backup expectation: how much data loss is acceptable and how often to back up (Convex plan permitting) | School / user | Backup schedule |
| POPIA retention/consent policy, privacy notice text and who may sign off the roster | School | Phase 11 activation and production import |
| Pilot grade and feedback contacts | School | Pilot |

## 1. Production backend

Run from `packages/backend` only, with the production deploy key in the shell environment (never in a
committed file):

1. `npx convex deploy` — pushes schema, functions, crons and components.
2. Set production environment variables in the Convex dashboard: `SITE_URL` (production HTTPS origin),
   `JWT_PRIVATE_KEY`/`JWKS` (new keys, never the dev ones), `RESEND_API_KEY`, `AUTH_EMAIL_FROM`,
   `EXPO_PROJECT_ID`, `NOTIFICATION_DELIVERY_ENABLED` (only after the delivery test plan is agreed).
   Do **not** set `ENABLE_DEMO_ACCOUNTS`: demo accounts are additionally blocked because the production
   URL is not the dev URL (`authPolicy.ts` `demoEnabled`).
3. Seed, reset and auth-setup helpers refuse non-dev deployments by design; production school data enters
   only through the Phase 11 import after school sign-off.
4. Create the school settings row and the first Administrator through an agreed, audited bootstrap
   (to be designed with the school; no production bootstrap exists yet).

## 2. Web (Dokploy)

1. Build the root `Dockerfile` with build arguments `VITE_CONVEX_URL=<production .convex.cloud URL>` and
   `VITE_SITE_URL=<production origin>`. These are public values; never pass backend secrets.
2. Point the custom domain at the Dokploy service with HTTPS; then confirm sign-in from that origin.

## 3. Native apps (EAS)

1. Set `EXPO_PUBLIC_CONVEX_URL` per build profile in EAS environment variables (production profile =
   production URL).
2. Native modules were added since runtime 1.0.1, so build new binaries (`eas build --profile production`)
   on runtime 1.0.3 or later; OTA updates cannot reach older runtimes.
3. Verify sign-in, a targeted push and a report download on one physical Android and one iOS device.

## 4. Backups and restore drill

1. Take an export from production: `npx convex export --path <file>.zip` (from `packages/backend`,
   with the production deploy key). Enable scheduled backups in the Convex dashboard if the plan allows.
2. Drill: import the export into a **separate, throwaway** deployment (`npx convex import`), then run
   `npm run verify:backend`-style count and reference checks against it and sign in with a test account.
   Never import into production during a drill.
3. Record the date, export size, restore time and result here. Repeat after major schema changes.

Recovery: if production data is damaged, stop writes (disable affected module flags), restore the latest
good export into a new deployment, verify, then repoint clients by URL (web rebuild + EAS env) or import
back with explicit approval.

## 5. Monitoring

- Convex dashboard logs and insights for function errors, slow or expensive functions.
- Client error capture on web and Expo once a provider is chosen; send no learner data, tokens or emails
  in error payloads.
- Watch notification delivery history (Phase 10) for Blocked/Failed states after launch.

## 6. Documentation and demo removal

- Production never enables demo accounts (see step 1.2). Remove demo-account references from user-facing
  docs at launch.
- Update `README.md`, `FRONTEND.md` and `AGENTS.md` with the production URLs and remove remaining
  "development only" statements once production is live.

## 7. Pilot and rollout

1. Import and sign off one pilot grade (Phase 11 preview rehearsal first).
2. Activate pilot guardians only after the POPIA consent/notice process is approved.
3. Collect feedback for an agreed period, fix, then roll out school-wide with school sign-off.

## Ad Center media storage (Cloudflare R2)
- Bucket: `wynburg` (private, WEUR). Convex env vars (set per deployment with `npx convex env set NAME=value` from `packages/backend`, never in client env, Dokploy or git): `R2_ENDPOINT` (account S3 endpoint without the bucket), `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (an R2 API token limited to Object Read & Write on this bucket) and `AD_MEDIA_SIGNING_KEY` (32+ random bytes, hex).
- Bucket CORS must allow `PUT, GET, HEAD` with `content-type` and `range` headers from every web origin that uploads: local `http://localhost:8080`, `http://localhost:3000`, `http://localhost:8081`, the production web domain and the Expo web host. Update it (Cloudflare dashboard → R2 → bucket → Settings → CORS, or the R2 CORS API) whenever a domain changes.
- **Rotation:** create a new R2 API token, set the new `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`, confirm an upload works, then delete the old token. Rotating `AD_MEDIA_SIGNING_KEY` only invalidates cached media links (clients receive fresh ones automatically).
- Production launch (Phase 13) needs the same variables on the production Convex deployment and its domain in the CORS list.

## Launch exit check

Both clients run against production Convex; a restore drill has passed; monitoring is in place; the school
has signed off the roster and pilot; and the deferred Phase 9 payment checks are complete or explicitly
excluded from launch by the school.
