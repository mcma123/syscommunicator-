# Native school feature

## Purpose

- Own the premium parent frontend for Expo Android, iOS, and web.

## Ownership

- `parent-screens.tsx` owns Home, Updates, Calendar, Children, More, Payments, Consent, Resources, Contact, Profile, and detail presentation.
- `ui.tsx` owns cards, controls, compact branding, child selection, keyboard-aware screens, and status feedback.
- `parent-model.ts` owns pure parent selectors, notice actions, and consent validation.
- `store.tsx` owns one mock repository, selected child, consent contact, notification preference, and payment simulation; `home.tsx` re-exports parent home.
- `modules.ts` and `module-placeholder.tsx` retain the unlinked staff module scaffold.

## Local Contracts

- Start as fictional parent Jamie Williams. There is no staff role switch in the native parent frontend.
- Mount one repository above routes. Parent changes survive navigation but reset on reload; they are independent of TanStack state.
- Import domain types, names, and fixtures from `@school-connect/core`. Keep supplementary learner/timetable/fee examples explicitly labelled as samples.
- Parent notices are Published only, including direct detail URLs. Unreleased reports remain hidden. Learner records are read-only.
- All/individual child filtering scopes notices, events, resources, consent, and activity balance. Counters use the same state as module actions.
- Consent requires permission and at least ten digits in the emergency number. Enquiries/replies require nonempty text.
- Payments simulate verification and outcomes in the provider so navigating away does not interrupt completion. Pending/failed payments remain outstanding; only Paid clears the amount. No card details or real money processing.
- Document previews are samples, not actual PDF rendering. Enquiries are local and never delivered to school staff. Notification toggle is a preference only.

## Work Guidance

- Retain Open Sans and the supplied WGJS crest. Use warm white surfaces, deep red overview cards, restrained gold, generous spacing, and 20�24px rounded cards.
- Use React Native primitives, accessible controls with at least 44px touch targets, safe areas, keyboard-aware forms, and visible empty/error/success states.
- Press feedback uses opacity without motion; keep navigation respectful of reduced-motion preferences.
- Keep future integrations behind repository adapters. Do not change shared domain contracts for presentation-only fixtures.

## Verification

- Root `typecheck:expo`, `export:expo`, `check:expo`, and Expo workspace lint verify code and bundling.
- Root `npm test` includes pure parent selectors/consent/counter/privacy checks.
- Browser preview checks parent navigation, local state, forms, checkout, enquiry replies, and narrow/tablet layouts. Browser QA does not replace device testing.

## Child DOX Index

- None. This doc owns the entire native school feature.
