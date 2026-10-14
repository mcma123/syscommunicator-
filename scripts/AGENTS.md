# Workspace helpers

## Purpose

- Own local workspace setup and Expo account command helpers.

## Ownership

- `expo-account.mjs` loads the ignored root environment for EAS commands.
- `prepare-expo-assets.ps1` creates padded native icon canvases from the original crest on Windows.

## Local Contracts

- Never print access tokens or pass them as CLI arguments. Token authentication uses the child process environment only.
- The account helper uses the pinned on-demand `eas-cli@24.13.0`, not a dependency installed inside the Expo app.
- Only account commands load the root `.env`; app development/export commands do not need the private token.
- EAS init temporarily hides `app.config.ts` while updating static app.json, then restores it in a finally block. Stop development servers before re-linking and recover any leftover config backup after an interrupted process.
- Asset preparation preserves `public/logo.png` and fits the crest without cropping; outputs stay in Expo assets.

## Work Guidance

- Resolve helper paths relative to the repository, independent of the shell working directory.

## Verification

- `npm run expo:whoami` validates token authentication; `npm run expo:info` validates the linked project.
- Check that `.env` is ignored and exported public configuration contains no token.

## Child DOX Index

- None. This doc owns the helper subtree.
