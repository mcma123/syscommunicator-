# Workspace helpers

## Purpose

- Own local workspace setup, phone development launchers, and Expo account command helpers.

## Ownership

- `expo-account.mjs` loads the ignored root environment for EAS commands.
- `expo-go.mjs` starts phone testing through a direct Expo Go tunnel on port 8082. It inherits the terminal for QR rendering, disables Expo's runtime chooser with EXPO_NO_REDIRECT_PAGE, forwards extra CLI arguments, and never loads the private account environment file.
- `prepare-receipt-assets.mjs` reproducibly embeds public/logo.png and installed Open Sans Regular/Bold with source hashes and font license into backend convex/receiptAssets.ts. Run after changing the crest or font package; never fetch fonts at receipt generation time.
- `prepare-expo-assets.ps1` creates padded native icon canvases from the original crest on Windows.
- `backend-auth.mjs` owns dev-only signing-key setup, private demo account provisioning and real-session API smoke checks including guardian/class/publication/Finance/signed-out authorization. It uses the fixture target guard, pipes secrets through stdin, and stores generated passwords only in ignored `.env.auth.local`. Temporary deployment password values are removed after provisioning.
- `backend-fixtures.mjs` owns guarded seed/reset/verification commands, running Convex from `packages/backend`; `backend-fixtures.test.mjs` owns command guard regression tests.

## Local Contracts

- Never print access tokens or pass them as CLI arguments. Token authentication uses the child process environment only.
- The account helper uses the pinned on-demand `eas-cli@24.13.0`, not a dependency installed inside the Expo app.
- Only account commands load the root `.env`; app development/export commands do not need the private token.
- Backend fixture commands parse only `packages/backend/.env.local`, require the exact known dev deployment and matching URL, reject deploy keys/self-hosted overrides and additional flags, and announce targets before each CLI command. They pass an explicit env file so other local dotenv files cannot redirect the CLI. Never print credentials.
- Auth setup must preserve existing signing keys, reject incomplete key pairs, and never print secrets or pass them as CLI arguments. Do not load EXPO_TOKEN. Default SITE_URL is localhost:8080 only when absent; real email sending requires a verified sender and configured web URL.
- `reset:backend` clears all development application records (including auth accounts/sessions), removes seed-owned sample files and reseeds. Rerun `setup:auth:dev` afterward to provision dev logins. Keep it separate from the insert-only `seed:backend` workflow.
- Publishing commands `expo:update` and `expo:deploy` also use the account helper and load the private token only into the CLI process. Fixed arguments target the preview environment, native preview branch, and WGJS Expo web preview domain.
- EAS init temporarily hides `app.config.ts` while updating static app.json, then restores it in a finally block. Stop development servers before re-linking and recover any leftover config backup after an interrupted process.
- Asset preparation preserves `public/logo.png` and fits the crest without cropping; outputs stay in Expo assets.

## Work Guidance

- Resolve helper paths relative to the repository, independent of the shell working directory.

## Verification

- `npm run expo:whoami` validates token authentication; `npm run expo:info` validates the linked project.
- Check that `.env` is ignored and exported public configuration contains no token.
- `node --test scripts/backend-fixtures.test.mjs` checks accepted/rejected fixture command targets and argument/credential overrides.
- `npm run verify:auth:dev` checks the identified dev deployment with private credentials; it changes auth sessions only and never sends email.
- Verify `dev:mobile` displays a terminal QR whose decoded payload is the direct exp:// tunnel URL, and that the public Android manifest/bundle can be downloaded.

## Child DOX Index

- None. This doc owns the helper subtree.
