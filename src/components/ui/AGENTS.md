# UI primitives

## Purpose

- Own reusable shadcn-style React UI primitives and wrappers.

## Ownership

- All `.tsx` components in this folder belong here, including form, dialog, navigation, chart, and toast primitives.
- Domain-specific behavior belongs to the school feature; global tokens belong to `src/styles.css`.

## Local Contracts

- Preserve exported component/variant APIs used by existing consumers.
- Use the existing Radix, class-variance-authority, and `cn` patterns where the component already uses them.
- Keep semantic roles, accessible labels, focus behavior, and keyboard behavior supplied by the existing primitives.
- Follow root `components.json`: TypeScript React components, CSS-variable Tailwind tokens, and Lucide icons.

## Work Guidance

- Follow existing component composition and styling conventions; keep school data and repository calls in feature components.

## Verification

- From the root, run `npm run build` and `node node_modules/typescript/bin/tsc --noEmit` for component changes.
- No dedicated UI component test suite currently exists.

## Child DOX Index

- None. This doc owns the entire UI subtree.
