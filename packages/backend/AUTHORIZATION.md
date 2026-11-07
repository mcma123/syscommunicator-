# Authorization contract

Phase 4 protects the public backend surface. Phase 5 adds scoped module projections and persisted guardian notice receipts on both clients. No production deployment, storage download endpoint or payment workflow is introduced here. See [CLIENT-DATA.md](CLIENT-DATA.md) for bounded preview limits. An additional module read and receipt mutation bring the handwritten public surface to 14 endpoints; the original Phase 4 audit below records its earlier 12-endpoint inventory.

## Identity and grants

Convex Auth verifies JWT subjects. `authPolicy.requireSession` uses the supported user/session helpers, loads the matching session row and rejects missing, revoked, mismatched or deactivated accounts. The existing auth configuration and auth tables are the foundation; application document IDs are compared to resolved user IDs, never to raw JWT subjects.

`convex/lib/auth.ts` builds an actor from indexed staff roles, active guardian learners and teaching assignments. Caps are four role rows, 20 guardian links and 100 assignments; oversized memberships fail closed. Multiple subjects for one class are deduplicated. Parent access requires an active linked learner. Grants combine, so a Finance employee who is independently a guardian can read their own child's academic records.

| Grant | Modules and record scope |
| --- | --- |
| Parent | Family modules; active linked learners; only Published notices/resources matching school, learner grade/class or explicit user group membership. No class roster. |
| Teacher | Academic modules and assigned class learners/rosters. School, assigned grade/class and explicit member-group content. Own drafts require an eligible audience; authorship alone never grants access. No finance/people/settings/audit grant. |
| Principal | School-wide academic and financial reads; audit module. No people/settings grant. |
| Administrator | All modules and school-wide records; invitation issuance and learner choices. |
| Finance | Financial records across school, plus home/profile/basic navigation. No academic records unless an independent guardian/teacher grant applies. |

`@school-connect/core/permissions` supplies the module matrix to web gates/navigation and backend checks. Record ownership and publication checks always run separately on the server. Expo currently remains a linked-parent client with staff placeholders; no native staff workflow is added.

## Protected endpoints

- `notices.listForMe`: indexed Published pagination, 1?50 items requested; filter every page by actor audience. Pages may be empty after filtering; clients must continue with the returned cursor until `isDone`. Preserve Convex pagination metadata.
- `notices.get`: same audience rules, with Principal/Administrator draft access and assigned-audience Teacher own-draft access.
- `learners.get`: actual guardian or assigned Teacher, or school-wide Principal/Administrator.
- `learners.listForClass`: assigned Teacher or Principal/Administrator; at most 100 active learners. A parent cannot request classmates.
- `charges.get`: Finance/Principal/Administrator or the charge learner's guardian. Does not return a full learner profile.
- `resources.get`: published matching audience, or Principal/Administrator. Returns authorized metadata; download URLs remain Phase 8.
- `onboarding.invite`: Administrator checked before external work and again inside the internal write transaction. `staffRole` describes the recipient's grant, never the caller's authority. All referenced learners must exist and be Active. Acceptance validates the resulting total guardian-link count before granting any role or link.
- `onboarding.accept`: verified matching email, stored single-use token hash, Pending status and expiry authorize the stored grants. Client cannot select a role, guardian or learner ID.
- `onboarding.invitationOptions`: Administrator-only bounded learner choices.
- `users.signOutEverywhere`: current actor only; Convex Auth owns session invalidation.

## Builders, audit and exceptions

All public school functions use `authedQuery`, `authedMutation`, `staffMutation`, `authedAction` or `staffAction`. These authenticate before handlers run; every endpoint must additionally check its module and document scope. Actions load actors through the internal `access.context` query; database changes must recheck authority in their transaction.

Authenticated mutations must call `ctx.audit`; returning without an audit event throws and rolls back all writes. Existing sensitive writes record invitation creation/revocation/acceptance and each new role or guardian link with a session-derived actor. Invitation issuance is internal and calls the same audit writer. Future publish, report release and payment-status mutations must use these builders and record their specific target events; these workflows are not implemented in Phase 4.

Reviewed exceptions:

- `users.configuration` is intentionally public and returns two capability booleans only.
- `users.current` accepts no IDs and reads only the authenticated user/session and indexed memberships. It must report null or sanitized blocked status for sign-in UI, so it cannot use a builder that always throws on revoked sessions.
- `auth.ts` exports library-created auth functions; provider validation and account-linking policy remain authoritative.
- Internal seed/development utilities are unreachable from clients and retain exact-dev-target guards. `access.context` is internal only. No sensitive user/role ID becomes a public authorization argument.

## Four-shape audit evidence

The Convex authz skill's deterministic searches ran before hardening and again after it, excluding generated declarations and tests. A TypeScript AST inventory of registration calls confirmed 12 handwritten public endpoints: ten authenticated builders and the two documented `users` exceptions. Auth-library exports and internal utilities were reviewed separately. Searches surface candidates; wrapper-based enforcement requires following the helper call rather than treating absent inline `ctx.auth` text as a defect.

| Rule shape | Candidate and reviewed enforcement | Result |
| --- | --- | --- |
| Identity from argument | No public caller `userId`/`actorId`/`ownerId`/`authorId`/`accountId` argument. `users.ts:17` derives its user from Convex Auth; `onboarding.ts:58` accepts recipient grants only. | No unresolved finding. |
| Missing document ownership | `learners.ts:6`, `learners.ts:14`, `notices.ts:31`, `charges.ts:6`, `resources.ts:7`: load/check guardian, assigned class, publication/audience or explicit staff privilege before returning. | Protected; cross-parent and wrong-class tests pass. |
| ID-parameter PII/financial leak | Learner and charge reads above use the same per-record helpers. `onboarding.ts:147` allows Administrator only. `users.current` takes no user ID. | Signed-out, Finance-academic and unrelated-guardian denials tested. |
| Parent/container reference on write | `onboarding.ts:82` grants only learner IDs stored in a matching verified invitation, rechecking Active learners. Issuance `onboarding.ts:19` is internal, Administrator-only and validates referenced learners. | No arbitrary client foreign-key write; expiry/replay/escalation tests pass. |

Before this phase the existing onboarding surface already validated identity, recipient and invitation authority; no impersonation exploit was found there. Hardening replaces scattered public registration with the builders, performs Administrator preflight before email work, validates Active learner references and audits individual grants/revocations. Newly introduced ID reads were protected before exposure. The review found no unresolved Critical or Important issue in the implemented surface. Future endpoints require a new review.

Concrete hardening at the registration and grant boundaries:

```diff
-export const invite = action({
+export const invite = staffAction(["Administrator"], {
-export const accept = mutation({
+export const accept = authedMutation({
-    const user = await requireSession(ctx);
+    const user = ctx.actor.user;
-    await ctx.db.insert("staffRoles", { userId: user._id, role });
+    const roleId = await ctx.db.insert("staffRoles", { userId: user._id, role });
+    await ctx.audit("role.granted", "staffRoles", roleId);
```

Reproduce candidate searches from the repository root:

```powershell
rg -n '\b(userId|actorId|ownerId|authorId|accountId)\s*:\s*v\.id\(' packages/backend/convex -g '*.ts' -g '!**/_generated/**' -g '!*.test.ts'
rg -n 'query\(|mutation\(|action\(|authedQuery\(|authedMutation\(|staffMutation\(|staffAction\(|ctx\.db\.(get|insert|patch|replace|delete)|v\.id\(' packages/backend/convex -g '*.ts' -g '!**/_generated/**' -g '!*.test.ts'
```

Schema fields, return validators, internal seed functions and schema membership keys are expected search hits, not public caller arguments. Follow every candidate to its registered endpoint and scope helper.

## Verification

`npm run test:backend` covers independent identities and sessions, another parent, wrong class/role, revoked/deactivated/mismatched sessions, direct-ID draft/resource access, group membership, combined grants, oversized membership/pagination, argument spoofing and unaudited-write rollback. Auth tests verify role/guardian audit attribution, invitation expiry and replay. `npm test` verifies shared module policy and web identity delegation. Run all three TypeScript checks after API changes.

`npm run verify:auth:dev` uses private dev credentials and real HTTP sessions to check identity, guardian/publication/class/Finance/signed-out boundaries and cross-session revocation on `dev:diligent-bass-226`. It does not change school records or send email. Local tests use isolated databases; no check proves live email delivery, native device behavior, or completion of later module migrations.

## Phase 5 surface review
- `schoolData.list` derives its actor through authedQuery, checks the requested module and validates selected learner scope before indexed reads. Finance filters remain financial only; per-learner Teacher privileges depend on class assignments, not guardian membership.
- Guardian audience/publication rules filter notices, events, resources and forms. Enquiry reads are current creator or whole-school Principal/Administrator; internal notes remain hidden from families. Staff lists use the shared role matrix and class scope.
- `notices.setReceipt` verifies a Published readable notice before inserting (acknowledgement additionally requires guardian audience membership) into noticeReceipts. It derives guardianId from the session, preserves existing timestamps and audits writes through authedMutation. No client actor or role is accepted.
- Deterministic candidate searches show only target learnerId/noticeId arguments, not caller IDs. All new reads and the receipt foreign-key write have explicit scope checks; negative tests cover wrong role, other learner, private notice, internal messages, signed-out and spoofed identity arguments.

## Phase 6 surface review
- `schoolRead.page/detail` authenticate before source access, validate selection/context and apply per-document scope after every indexed page or direct get. Target IDs never identify the caller. Contextual child records must match the authorized parent; invalid table IDs and foreign parent contexts fail closed.
- Teacher academic access requires the actual learner class assignment, including for mixed guardian/staff roles. Finance gets only financial scope. Draft/unreleased reports and private conduct remain hidden from families. Only a conversation creator, assigned teacher or whole-school staff can read threads; internal notes stay staff-only.
- Consent response decisions can be visible to linked guardians while another guardian's notes/contact remain private. No projection returns auth secrets, storage URLs or full user documents.
- `dashboard.current/advance` recheck session and selection. `step` is internal and independently reauthenticates before writing derived rows; aggregate namespaces are never client-selected. Changed membership invalidates projections before counts can be read. Derived cache transactions are an explicit exception to business audit entries; canonical changes still require audit/invalidation.
- `notices.setReceipt` now permits authorized staff mark-as-read, while guardian audience membership remains required for acknowledgement. It derives the reader and audits in the same transaction. Optimistic changes touch existing authorized caches only.
- Review found no unresolved Critical/Important issue in this surface. Tests cover signed-out/wrong-role/foreign learner, private context/notes/contact, independent unpublished details, paging beyond 50 and stale aggregate rejection after receipt/membership changes. Direct dev dashboard edits require the documented seed invalidation; production is not provisioned.

## Phase 7 review
- Public writes use authenticated/audited builders. The dispatcher accepts a canonical target-ID union and a shared action enum; dynamic string fields are normalized per table, checked against known keys and independently authorized. Form visibility is never an authorization boundary.
- Teacher writes require current class scope; notice draft/event authorship cannot replace that scope. Guardian consent requires active linkage, current audience, Open status, deadline and matching response author. Enquiry assignment/status/internal notes enforce school responsibility independently of family ownership.
- Notice scheduling/fanout is internal, revision-checked and bounded. Scheduled approval rechecks publishing authority; recipient batches use active guardian membership and unique receipt lookups. No client can invoke a scheduler job, set its actor or write an audit row.
- Report actions validate PDF signature/size, preflight and transactionally recheck scope, clean failed uploads and return bytes only after current scope/release checks. General storage URLs are not exposed. Finance has no academic report permission.
- Administrator role/class/status/settings operations validate targets and block self access changes. Session cutoffs reject old sessions even after reactivation. Profile inputs cannot change roles, guardian links or sign-in email. Supported feature flags are enforced by direct/related reads, writes and navigation.
- No unresolved Critical/Important finding remains in the implemented surface. Negative tests cover foreign class/guardian, unassigned thread, premature release/publication, unknown identity fields, private response/notes, unauthorized role/flag changes, old sessions and recipient isolation. Live email configuration, device QA and payment processing remain separate delivery boundaries.

## Phase 8 file review
- FILES.md owns file upload reservations, metadata/signature/digest limits, canonical file ownership, two-minute grant hashes and scope-rechecking HTTP downloads. Caller arguments identify targets, never identity. Only internal redemption reconstructs an actor, after validating the stored live session and active user.
- Notice files require current draft/class scope; resources require audience/publication; reports require staff class scope or active linked guardian plus Released status. Receipt generation requires an existing matching Succeeded payment and never writes payment success. Legacy notice/resource DTOs omit storage IDs.
- Cleanup is internal, paginated/bounded and ownership-based; unknown storage and managed active files are preserved. Grant creation and infrastructure cleanup are read/maintenance audit exceptions; school file writes audit transactionally.
- Negative tests cover wrong role/family, premature release, changed guardian links/module flags, revoked/expired sessions, removed attachments, archived resources and invalid type/size/digest/signature. No unresolved Critical/Important finding remains in this surface; native device acceptance and payment-provider integration remain outstanding.

## Phase 10 notification boundary
- Registration derives identity/session and validates the configured Expo project. Ownership transfer is by secret device token; removal is scoped to the caller. Dispatch and every send attempt recheck active account, guardian/source scope, feature flags, preferences, quiet hours and live device session/cutoff. Generic payloads contain no private notice or learner content.
- Personal history is indexed by the current user; staff notice history/retry requires current whole-school or author/class scope. Guardian notice access cannot substitute for a removed teaching assignment when managing staff receipts or deliveries. Public results omit tokens, sessions, provider IDs and recipient email. Accepted and confirmed jobs cannot be retried; uncertain failed pushes need explicit confirmation.
- Provider polling is internal and authenticated to the provider. In-app availability never implies transport delivery. Provider confirmations, device cleanup and delivery-state transitions are infrastructure projections; public device/retry writes audit. Expiring invitations record system audit entries.
- Unit tests cover wrong caller/project/role, mixed teacher/guardian assignment loss, account transfer, session/guardian changes, opt-outs/quiet hours, retry idempotency, stale source/consent responses and honest provider state. Live phone/email acceptance is a separate activation check.
