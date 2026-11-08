# Server authorization library

## Purpose
- Own reusable server identity, role, resource-scope, registration and audit enforcement.

## Ownership
- `auth.ts` owns actor loading and guardian/teacher/module checks. Internal file redemption may load an actor only after validating the stored grant session, user status and cutoff.
- `audiences.ts` owns parent/teacher notice audience and publication access, and current teacher-author/class scope for staff receipt/delivery management. A guardian read grant never grants staff management.
- `functions.ts` owns authenticated registration builders; `audit.ts` owns audit entry creation.
- `workflowRules.ts` owns command field validation, canonical ID normalization, Johannesburg dates/times, class write scope and bounded audience validation.
- `read.ts` owns bounded paginated projections, contextual detail relationships and per-document publication/guardian/class/financial scope.
- `dashboardState.ts` owns audited source invalidation; `dashboardAggregate.ts` owns the component mirror keyed by user/learner build namespace.
- `fileValidators.ts` owns schema-safe upload/target validators without runtime authorization imports. `fileRules.ts` owns file size/name/type/signature and current upload/download scope checks. `receiptPdf.ts` renders school-branded receipt PDFs using generated licensed assets.
- `notificationRules.ts` owns fixed Johannesburg quiet-hour calculation and current guardian/source scope. `notificationQueue.ts` owns deduplicated per-device/channel jobs and separate bounded push/email Workpools. Provider actions and authenticated APIs stay in the backend parent.
- Registered module endpoints and schema remain owned by the backend parent.

## Local Contracts
- Derive identity from the existing Convex Auth session foundation. Load roles, active guardian learners and teacher assignments from indexes, with bounded reads and fail-closed limits.
- Parent membership is explicit guardian linkage, not a default role. Finance alone has no academic access; grants combine for users who are also guardians or teachers.
- Load each requested document before checking its guardian/class/audience relationship. Author IDs never replace ownership or audience checks.
- All new public school functions use the authenticated builders. Auth-library exports, sanitized sign-in status/configuration endpoints, and guarded internal fixture utilities are documented exceptions.
- Authenticated mutation builders require at least one audit entry on success; a missing entry throws and rolls back the mutation. Record additional role/guardian/class grants individually. Attendance corrections include previous/next values and a reason; submitted registers require a correction reason.
- No unbounded collections, client-supplied caller identity, permanent storage URLs, or wall-clock reads in queries. Protected file queries may return expiring gateway URLs after grant and scope validation; Ad Center media (published promotional ads in the viewer's audience, and staff ad previews) may return Convex storage URLs. FILES.md owns both exceptions.
- `fileRules.ts` `adEditor` is the single ad write/upload scope check: whole-school staff, or the creating Teacher while the ad still targets classes they teach.
- Pass native pagination options/results intact; filtering an unauthorized/search-mismatched page must retain its advancing cursor. Independent details repeat document scope checks and never depend on a loaded page.
- Canonical school writers must use the audit writer so dashboard revisions invalidate atomically. Aggregate insert/delete accompanies each dashboardItems mutation in the same transaction.

## Work Guidance
- Workflow commands reject unexpected value keys, derive authors/guardians from the session and normalize every target before checking its current document relationship. Draft authorship does not replace current class access.
- Keep provider-independent module permissions in school-core. Keep concrete database checks here.

## Verification
- Root `test:backend` exercises ownership, audience filtering, class scope, role denial, session rejection, and audit rollback. Run `typecheck:backend` and the authz audit after changes.

## Child DOX Index
- None.
