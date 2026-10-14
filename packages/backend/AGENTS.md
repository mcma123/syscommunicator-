# Convex backend scaffold

## Purpose

- Prepare one future Convex backend for the TanStack and Expo clients.

## Ownership

- Own `convex.json`, `convex/schema.ts`, backend TypeScript/package configuration, environment examples, and setup documentation.
- Domain types and fixtures remain owned by `../school-core/`.

## Local Contracts

- The initial schema is empty. There is no deployment, authentication, database connection, seed data, or production query/mutation implementation.
- Provisioning is deferred. `npm run dev:backend` requires separate Convex authentication and may create a deployment; the Expo token cannot authenticate to Convex.
- Screens must consume a repository adapter when integration is implemented rather than call providers directly.
- Convex generates API files under `convex/_generated/`; never fabricate or edit them by hand.

## Work Guidance

- Follow this workspace's README when provisioning and planning production data/access contracts.
- Do not import React/native presentation into backend code.

## Verification

- From the root, run `npm run typecheck:backend` to check the schema scaffold without provisioning.

## Child DOX Index

- None. This doc owns the entire backend workspace.
