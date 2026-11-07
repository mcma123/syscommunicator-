# Security assessment and residual risks

## Scope and review contract

Security review covers the root TanStack web application, Expo client, shared domain contracts and Convex backend. The current mission is Phases 10–13 of [the integration plan](Backend-and-Database-Integration.md). Phases 3 and 9 remain outside implementation scope. Review existing identity boundaries when relevant; do not expand authentication or implement payments without a scope change.

The builder sends a fixed candidate and requirements to dev-review, which hands its verdict and evidence to dev-security through the durable queue before readiness is declared. Record the base/head commits or an exact diff snapshot, changed paths, public behavior, tests and limitations. Findings return to the builder with severity, file/line, exploit prerequisites, impact, fix guidance and reproduction evidence. Security fixes require re-review. Coordinate edits with the builder; an author cannot independently approve their own repair.

Use only authorized local or isolated test/dev data. No production attacks, real-user notifications, real charges, deployment or publication are authorized by this review contract. Keep secrets out of evidence. A persistent reviewer is not continuous runtime protection.

## Current assessment

- No candidate has completed security review in this register. Local baseline checks are recorded below; no live security checks have been run by this reviewer.
- Phase 11 roster imports are in preparation. Builder-reported base: `ce28295`, branch `openrig-work`; changing working-tree edits are not a frozen review candidate.
- Builder describes Administrator-only, audited, chunked imports and staged contacts that do not create accounts, roles, guardian links or invitations. These are claims awaiting source review and negative tests after QA.
- The review will examine authorization and school/learner ownership, escalation and anonymous access, revocation, bounded validation/import processing, CSV injection, audit rollback, file grants, environment separation, mobile token/deep-link handling, CSRF/CORS, XSS and dependencies as affected by the candidate. Cite current vendor and OWASP sources when evaluating controls; record installed versions and compatibility.

## Residual-risk register

These entries are evidence gaps or deferred requirements, not confirmed vulnerabilities or accepted launch risks.

| ID | Risk or gap | Owner and closure evidence |
| --- | --- | --- |
| SEC-01 | Live backend deployment behavior is unverified; builder reports unavailable deployment credentials. | Operator coordinates authorized dev verification; reviewer records target, candidate and results without credentials. Local isolated tests can continue. |
| SEC-02 | Physical-device notification, token-storage and deep-link acceptance remain unverified. | Operator arranges a compatible build and test device; builder/reviewer record device checks using test accounts without real-user notifications. |
| SEC-03 | Live email delivery and production configuration are unverified. | Operator coordinates verified sender/service configuration and separately authorized environment checks. Mocked provider tests do not close this gap. |
| SEC-04 | Roster contact activation, invitations and guardian linking need a privacy/POPIA decision and separate authorization design. | Builder retains staging boundaries; operator resolves intended use before activation. Reviewer verifies denial tests and data scope for the approved design. |
| SEC-05 | Payment security is unimplemented and Phase 9 is deferred. | Future payment scope must require server-calculated amounts, signed provider event verification, replay/idempotency protection, reconciliation and access control. Redirects are not payment proof; do not store card data or claim compliance. Applicable payment checks remain required for final launch. |
| SEC-06 | Dependency scan found advisory matches; application exploitability and compatible fixes remain under review. | Builder coordinates dependency remediation and the CI proposal below; security rechecks the resulting candidate. No automatic major upgrades. |

## Dependency baseline — 2026-11-07

Scope: local working tree during Phase 11 preparation, not a QA-approved candidate. Lockfile SHA-256: `c64ac7d39b7777ad140763accf5822da929583dd1a5a03d14c1fb12b5c41f5d2`. CI file SHA-256: `88a7e46df343343ef56cf0b7f1bea2e1b16428787fa2a7cdeda0f1ae96c1b37c`.

Installed inventory from `npm ls`: Convex 1.48.0, Convex Auth 0.0.96, TanStack React Start 1.168.60, React 19.2.3, Expo 57.0.32, React Native 0.86.3, Vite 8.1.5, Nitro 3.0.260603-beta. Host: Node 22.23.4/npm 10.9.9, unlike the required CI Node 24/npm 11. No dependencies changed.

`npm audit --json --ignore-scripts` exited 1: 85 affected package entries (20 high, 60 moderate, 5 low, zero critical), including transitive meta-vulnerabilities. This is not a count of distinct exploitable application flaws. Nine packages have direct advisory records: decode-uri-component, seroval, zod, node-forge, vite, @vitest/mocker, glob, minimatch and uuid. Remaining entries inherit dependency exposure.

Priority triage (severity below is the registry rating; app impact is not yet reproduced):

| Dependency evidence | Prerequisites and possible impact | Required follow-up |
| --- | --- | --- |
| High: decode-uri-component 0.2.2, `package-lock.json:9638`; Expo router calls query-string parsing in installed `node_modules/expo-router/build/react-navigation/core/getStateFromPath.js:499`, and query-string calls the decoder at `node_modules/query-string/index.js:233`. | Crafted malformed percent-encoded URL query reaches this parser; possible UI thread denial of service. Device reachability and resource cost untested. | Prioritize a compatible Expo/query-string upgrade or narrowly scoped patched decoder resolution, then run malformed-link and ordinary Unicode/query regression checks on both native and web. [Advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) lists 0.5.0 as patched for this advisory; also assess GHSA-qr28-fpjm-wq7f before selecting a version. |
| Moderate: seroval 1.6.9, `package-lock.json:16764`, reached through TanStack dependency graph. | Attacker-influenced special values must reach serialization; possible script/code injection. An application data path satisfying this prerequisite has not been established. | Evaluate compatible 1.6.11 or newer resolution and SSR hydration tests; assess both typed-array and RegExp advisories. [Typed-array advisory](https://github.com/advisories/GHSA-f86p-h4j2-7qgj). |
| High: zod 3.25.76, `package-lock.json:18871`. | Oversized collections reach affected validation; possible memory exhaustion. Focused source import search found no direct Zod import in web/backend/Expo source; transitive use remains unassessed. | Trace transitive validation before deciding migration/removal; do not force Zod 4 into Zod 3 consumers. [Advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). |
| High: node-forge 1.4.0, `package-lock.json:14719`; high Vite 8.1.5; moderate Vitest mocker. | Forge exposure depends on use of affected certificate/crypto/parsing functions; Vite and Vitest issues involve development-server/tooling prerequisites. This does not establish production-server compromise. | Review Expo signing/build inputs and development-server exposure; select compatible vendor fixes and verify builds. Keep tooling separate from runtime reachability but retain it in the scan. |

Baseline test evidence: `npm test` exited 1 (41 passed, 3 timed out at 5 seconds: `demo-auth.test.tsx:56`, `workflow-panel.test.tsx:38` and `:49`). These test files had no local diff. A diagnostic rerun, `npm test -- src/test/demo-auth.test.tsx src/test/workflow-panel.test.tsx --maxWorkers=1`, passed all 13 tests. Reduced-load success is consistent with timing sensitivity but does not prove its cause or replace a full-suite pass under the required environment. No timeout configuration changed.

## Proposed security CI change

Not implemented yet; coordinate as a separate builder candidate. Existing `.github/workflows/ci.yml` runs tests/types on push and pull request with read-only contents permissions but no explicit advisory gate or scheduled scan.

- Add a dependency-check job on pull requests changing any workspace manifest or the root lockfile, manual dispatch and a weekly schedule. Use Node 24/npm 11, root lockfile, and no deployment credentials.
- Run `npm audit --package-lock-only --ignore-scripts --audit-level=high --json`; preserve its report and exit result even when findings occur. Do not use `npm audit fix --force` or silently convert scan/network errors into success. Include dev dependencies because builds and signing are security relevant.
- Triage the current baseline before enabling a required gate. Any temporary exception must name advisory, dependency path, reachability rationale, owner and expiry; retain moderate findings for review. The current high-advisory baseline would fail an unconditional high gate.
- Builder owns update proposals; security reviews relevant compatibility and regression evidence. Review new advisories weekly and reassess after material dependency or build changes. Branch protection and scheduled-job enablement need repository-owner verification; adding YAML alone proves neither.

Basis: [npm audit documentation](https://docs.npmjs.com/cli/v11/commands/npm-audit/) distinguishes advisory reporting, exit thresholds and modifying fix operations; [OWASP supply-chain guidance](https://cheatsheetseries.owasp.org/cheatsheets/Software_Supply_Chain_Security_Cheat_Sheet.html) supports dependency inventory, pinned resolution and ongoing review. Sources checked 2026-11-07.

## Minimum external acceptance inputs

- SEC-01: operator supplies the identified dev deployment and authorized machine login through secure local configuration, plus the exact reviewed candidate. Run isolated fixture/read/write authorization checks against that dev target only; obtain separate authorization before any deployment-affecting command.
- SEC-02: operator supplies a compatible test build, supported physical device, test account and explicitly designated test phone. Check sign-out token removal, protected deep-link access and test-only notification receipt; no real-user broadcast.
- SEC-03: operator supplies a verified test sender and test recipient with provider credentials configured server-side. Verify one authorized test delivery and provider confirmation. Production checks additionally require an explicit production target and authorization; neither is supplied by the dev checks. Never paste secrets into chat.

## Evidence record format

For each reviewed candidate append: queue reference; exact candidate identity; scope and threat prerequisites; source findings and current primary references; commands and observed results; fixes re-reviewed; unchecked journeys; residual risks and next owner. Preserve unresolved findings until closure evidence is recorded. Reassess after material changes to authorization, imports, files, mobile identity, notification delivery or payments.
