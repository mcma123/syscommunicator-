# Expo source

## Purpose

- Own native-compatible presentation and routing shared by Android, iOS, and Expo web.

## Ownership

- Own `app/` route entry points, `components/` reusable presentation, and `theme/` brand tokens.
- The school feature owns screen content and its provider.

## Local Contracts

- Use React Native primitives, not DOM elements or the existing web-only Radix components.
- `app/+html.tsx` is a web-only document for static/server output, not a native screen. Current SPA output uses ../public/index.html for metadata and scrolling reset instead.
- `_layout.tsx` loads local Open Sans fonts and mounts SchoolAuthProvider, one SchoolProvider, the native notification bridge and SchoolNavigator above all routes. `/signin` is public; other routes require an active live identity with a staff role or linked learner. Screens and navigation apply the shared module matrix; the backend rechecks all record access.
- Show the supplied SYS logo above the loading indicator while native fonts load; retain it in the configured native splash screen.
- Five parent tabs live in `app/(tabs)/`: Home, Updates, Calendar, Children, More; their public URLs remain unchanged. Other parent modules and dynamic details use the root stack with animation disabled. Detail routes use live database IDs at runtime; SPA export removes fixture-ID pre-rendering. Route files delegate presentation to the school feature.
- `+not-found.tsx` handles unknown module URLs. Native and web links use Expo Router.
- Use the `@/` source alias and `@school-connect/core` workspace import.

## Work Guidance

- Global native colours and font family names live in `theme/school.ts`.
- Parent screens use the school feature UI with compact branding, keyboard-aware scrolling, and responsive content width. Staff screens share live paginated reads and server-described school actions. Module flags filter tabs/screens as well as server access.

## Verification

- From the root, run `npm run typecheck:expo` and `npm run export:expo`.
- Preview `npm run dev:expo-web` to inspect home and module routes.

## Child DOX Index

- [features/school/AGENTS.md](features/school/AGENTS.md): parent sign-in/session storage and invitation acceptance, live module subscriptions and receipt updates, common UI, and authorized staff reads/writes, protected file selection/download/sharing, phone registration/response handling, delivery status and confirmations.
