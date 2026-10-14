# Expo source

## Purpose

- Own native-compatible presentation and routing shared by Android, iOS, and Expo web.

## Ownership

- Own `app/` route entry points, `components/` reusable presentation, and `theme/` brand tokens.
- The school feature owns screen content and its provider.

## Local Contracts

- Use React Native primitives, not DOM elements or the existing web-only Radix components.
- The Expo web-only `app/+html.tsx` document is the exception: it supplies HTML metadata and ScrollViewStyleReset and is not a native screen.
- `_layout.tsx` loads local Open Sans fonts and mounts one SchoolProvider above all routes.
- Five parent tabs live in `app/(tabs)/`: Home, Updates, Calendar, Children, More; their public URLs remain unchanged. Other parent modules and dynamic details use the root stack with animation disabled. Known fixture detail IDs are pre-rendered using generateStaticParams for Expo static web export. Route files delegate presentation to the school feature.
- `+not-found.tsx` handles unknown module URLs. Native and web links use Expo Router.
- Use the `@/` source alias and `@school-connect/core` workspace import.

## Work Guidance

- Global native colours and font family names live in `theme/school.ts`.
- Parent screens use the school feature UI with compact branding, keyboard-aware scrolling, and responsive content width. `SchoolScreen` remains available for staff placeholders.

## Verification

- From the root, run `npm run typecheck:expo` and `npm run export:expo`.
- Preview `npm run dev:expo-web` to inspect home and module routes.

## Child DOX Index

- [features/school/AGENTS.md](features/school/AGENTS.md): parent screens, local mock interactions, common UI, and retained staff placeholders.
