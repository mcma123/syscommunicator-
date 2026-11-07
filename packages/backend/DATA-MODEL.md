# Data model

The Convex schema (`convex/schema.ts`) shared by the web app and the Expo app.
Enum values come from `packages/school-core/src/domain.ts`; the backend turns
them into validators in `convex/validators.ts`, so the clients and the database
always agree on the values.

## Conventions

- Timestamps are epoch milliseconds in fields ending `At`. Calendar days (attendance, birthdays) are ISO `YYYY-MM-DD` strings. Display strings such as "14 Oct 2026" are never stored.
- Money is stored as integer cents (`amountCents`) in the school currency (ZAR).
- References use `v.id(...)`. Files are stored in Convex storage and referenced as an `attachment` object (`storageId`, `fileName`, `contentType`, `size`).
- Index names list every field (`by_a_and_b`). The exceptions are `users.email` and `users.phone`, whose names Convex Auth requires.
- Lists that can grow without limit live in child tables. Only short, bounded lists are stored inline: `audiences`, `attachments`, `learnerIds` on an invitation, and `mutedCategories`.

## Design decisions

- **Single school.** One `schools` row holds branding, term and feature flags, replacing the hard-coded `schoolConfig`. Other tables have no `schoolId`, because each deployment serves one school.
- **Roles.** A user is a parent through `guardianLinks` and staff through `staffRoles`, so one person can be both (for example a teacher whose child attends the school).
- **Users match Convex Auth.** `users` keeps Convex Auth's field and index names. Our own fields are optional, and `authTables` is spread before overriding `users` with this definition.
- **Audiences.** Notices, events, resources and consent requests store a bounded `audiences` array (School, Grade, Class or Group). Publishing a notice creates one `noticeReceipts` row per guardian. A parent's feed and the delivered/read/acknowledged counts are then a single index read each.
- **Forms.** Generic form building is out of scope, so `consentRequests` and `consentResponses` cover the consent journey. A `forms` table can be added if custom forms are commissioned.
- **Payments.** A `charge` is what a family owes. A `payment` is one attempt to settle it. `paymentEvents` stores each raw provider webhook once, keyed by the provider's event ID, so processing it twice has no effect. A `charge` becomes Paid only from a verified payment event.
- **Counts.** `dashboardVersions` tracks audited canonical source changes, `users.dashboardRevision` tracks own receipts, `dashboardBuilds` tracks one paged projection per user/selected learner, and `dashboardItems` stores rebuildable scoped contributions. `@convex-dev/aggregate` mirrors each item transactionally in a build namespace; its key is `[kind, pending ? 1 : 0, at]` and sum value is amount in cents. Only complete builds matching current membership/revisions are readable. See CLIENT-DATA.md for invalidation, cleanup and direct-dev-edit rules.
- **Authentication.** Convex Auth adds `authAccounts`, `authSessions`, `authRefreshTokens`, `authVerificationCodes`, `authVerifiers` and `authRateLimits`. Preserve the library-required index names on these tables and users. Session/user IDs are resolved with the library helpers; current identity checks session existence and active status. Roles and guardian links remain separate app tables; verified invitations grant them atomically. Reset clears auth tables too.
- **Development fixtures.** `seedFixtures` stores a unique logical `key` and a target union: a document table/ID, or an attachment for a seed-owned file. `by_key` supports repeatable insert-only seeding even after records are renamed. It is internal tooling metadata, not a client or authorization contract. Duplicate natural-key matches fail; existing values are retained. Internal verification checks document and foreign-key existence and storage metadata. Inventory/reset reads are bounded to 500 total application rows; reset removes only registered files.

## Current mock state → tables

| `SchoolState` / fixture (`school-core`)            | Tables                                                                            |
| -------------------------------------------------- | --------------------------------------------------------------------------------- |
| `schoolConfig`                                     | `schools`                                                                         |
| `children` (Child)                                 | `learners`, `grades`, `classes`, `guardianLinks`, `teachingAssignments` (teacher) |
| demo accounts (`src/features/school/demo-auth.ts`) | `users`, `staffRoles`                                                             |
| `notices` (Notice)                                 | `notices`; `read`/`acknowledged` → `noticeReceipts`                               |
| `events` (SchoolEvent)                             | `events`                                                                          |
| `consent`                                          | `consentRequests`, `consentResponses`                                             |
| `payment`                                          | `charges`, `payments`, `paymentEvents`, `receipts`                                |
| `enquiries` (Enquiry + messages)                   | `enquiries`, `enquiryMessages`                                                    |
| `attendance`                                       | `attendanceRegisters`, `attendanceMarks`                                          |
| `conduct`                                          | `conductEntries`                                                                  |
| `reportReleased`                                   | `reports`                                                                         |
| `resources`                                        | `resources`                                                                       |
| `notifications`                                    | `notificationPreferences`, `pushTokens`                                           |
| `invited`                                          | `invitations`                                                                     |
| custom audiences (deferred in the prototype)       | `groups`, `groupMembers`                                                          |
| normalized weekly class periods (development fixture) | `timetablePeriods` (`classId`, weekday 0-6, local start/end minute, subject, optional room/teacher) |
| scoped, derived dashboard state | `dashboardVersions`, `dashboardBuilds`, `dashboardItems`; aggregate component tables are isolated |
| sample audit rows                                  | `auditLog`                                                                        |
| development fixture identity / file ownership      | `seedFixtures` (`by_key`); no client access                                        |

## Access paths → indexes

| Query (who)                                             | Index                                                                                        |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Current user by email at sign-in                        | `users.email`                                                                                |
| My roles (all)                                          | `staffRoles.by_userId`                                                                       |
| Staff list by role (admin)                              | `staffRoles.by_role`                                                                         |
| My learners (parent)                                    | `guardianLinks.by_guardianId`                                                                |
| Guardians of a learner (staff, audience fan-out)        | `guardianLinks.by_learnerId`                                                                 |
| Is this user a guardian of this learner (authorization) | `guardianLinks.by_guardianId_and_learnerId`                                                  |
| My classes (teacher)                                    | `teachingAssignments.by_staffId`                                                             |
| Is this user assigned to this class (authorization)     | `teachingAssignments.by_staffId_and_classId`                                                 |
| Learners in a class or grade (staff, fan-out)           | `learners.by_classId_and_status`, `learners.by_gradeId_and_status`                           |
| Learner lookup and duplicate check on import            | `learners.by_learnerNumber`                                                                  |
| Members of a group / my groups                          | `groupMembers.by_groupId`, `groupMembers.by_userId`                                          |
| My notice feed, newest first (parent)                   | `noticeReceipts.by_guardianId` (descending)                                                  |
| My unread notices (parent)                              | `noticeReceipts.by_guardianId_and_readAt`                                                    |
| Notice delivery/read/acknowledged stats (staff)         | `noticeReceipts.by_noticeId`                                                                 |
| Mark read / acknowledge (parent)                        | `noticeReceipts.by_noticeId_and_guardianId`                                                  |
| Published notices / drafts awaiting review (staff)      | `notices.by_status_and_publishedAt`                                                          |
| Scheduled notices due for publishing (scheduler)        | `notices.by_status_and_publishAt`                                                            |
| My drafts (author)                                      | `notices.by_authorId`                                                                        |
| Upcoming events in a date range (all)                   | `events.by_status_and_startsAt`                                                              |
| Resources by category (all)                             | `resources.by_status_and_category`                                                           |
| My enquiries (parent)                                   | `enquiries.by_createdBy_and_lastMessageAt`                                                   |
| Department inbox / my assigned enquiries (staff)        | `enquiries.by_department_and_status`, `enquiries.by_assigneeId_and_status`                   |
| Open enquiries, oldest activity first (admin)           | `enquiries.by_status_and_lastMessageAt`                                                      |
| Thread messages                                         | `enquiryMessages.by_enquiryId`                                                               |
| Released reports for a learner (parent)                 | `reports.by_learnerId_and_status`                                                            |
| A learner's report for a term                           | `reports.by_learnerId_and_term`                                                              |
| Reports awaiting review/release for a term (principal)  | `reports.by_term_and_status`                                                                 |
| Today's register for a class (teacher)                  | `attendanceRegisters.by_classId_and_date`                                                    |
| Registers not yet submitted today (admin)               | `attendanceRegisters.by_date_and_status`                                                     |
| Marks in a register / correct one mark                  | `attendanceMarks.by_registerId`, `attendanceMarks.by_registerId_and_learnerId`               |
| A learner's attendance history                          | `attendanceMarks.by_learnerId_and_date`                                                      |
| A learner's conduct timeline                            | `conductEntries.by_learnerId_and_occurredAt`                                                 |
| Open consent requests / reminders                       | `consentRequests.by_status_and_dueAt`                                                        |
| Consent overview / one learner's response               | `consentResponses.by_consentRequestId`, `consentResponses.by_consentRequestId_and_learnerId` |
| A learner's or guardian's consent history               | `consentResponses.by_learnerId`, `consentResponses.by_guardianId`                            |
| A learner's outstanding charges (parent)                | `charges.by_learnerId_and_status`                                                            |
| Overdue charges / reminders (finance, cron)             | `charges.by_status_and_dueAt`                                                                |
| Payment attempts for a charge                           | `payments.by_chargeId`                                                                       |
| My payments (parent)                                    | `payments.by_payerId`                                                                        |
| Match a webhook to a payment                            | `payments.by_provider_and_providerReference`                                                 |
| Pending payments to reconcile (finance)                 | `payments.by_status`                                                                         |
| Ignore duplicate webhooks                               | `paymentEvents.by_provider_and_providerEventId`                                              |
| Events for a payment (finance audit)                    | `paymentEvents.by_paymentId`                                                                 |
| My receipts (parent) / receipt lookup                   | `receipts.by_guardianId_and_issuedAt`, `receipts.by_receiptNumber`, `receipts.by_paymentId`  |
| Accept an invitation                                    | `invitations.by_tokenHash`                                                                   |
| Pending invitations for an email                        | `invitations.by_email_and_status`                                                            |
| Expire old invitations (cron)                           | `invitations.by_status_and_expiresAt`                                                        |
| A user's devices / remove a stale token                 | `pushTokens.by_userId`, `pushTokens.by_token`                                                |
| A user's notification settings                          | `notificationPreferences.by_userId`                                                          |
| History of one record / one actor / one action (audit)  | `auditLog.by_targetTable_and_targetId`, `auditLog.by_actorId`, `auditLog.by_action`          |
| School settings (single row)                            | `schools` (first document)                                                                   |
| Grades in display order                                 | `grades.by_sortOrder`                                                                        |
| Classes for a grade / for a year                        | `classes.by_gradeId`, `classes.by_year_and_name`                                             |

## Phase 6 access paths

| Read | Index |
| --- | --- |
| Published notices by category/date | `notices.by_status_and_category_and_publishedAt` |
| Weekly learner/class timetable | `timetablePeriods.by_classId_and_weekday_and_startMinute` |
| Current dashboard source revision | `dashboardVersions.by_key` |
| Own dashboard selection | `dashboardBuilds.by_userId_and_learnerId` |
| Bounded projection cleanup | `dashboardItems.by_buildId` |
| Idempotent projection contribution | `dashboardItems.by_buildId_and_kind_and_sourceId` |
| Full module lists | `schoolRead.page` uses one existing source index/native paginate per call; audit uses the built-in creation-time ordering |
| Independent details | Normalize the module's table ID, get the document, then enforce its current guardian/class/audience/parent scope |

New timetable and dashboard tables are additive; existing users receive only an optional dashboardRevision. Seed preserves existing values and adds one fictional Monday period per fixture class. Reset removes aggregate mirrors before deleting application items; both operations share the transaction. No canonical backfill or production migration is needed for this development-only addition.

## Phase 7 write state
- `notices.revision` and `publicationActorId` are optional additive fields. Each state transition increments revision; scheduled publication validates Scheduled status, stored time, revision and current publishing authority. A stale/cancelled job is a no-op. Published receipt fanout paginates users in batches of 25, resolves active guardian audiences and upserts unique `(noticeId, guardianId)` rows without clearing response timestamps.
- `users.sessionsValidAfter` is an optional cutoff. Deactivation records `max(mutation time, latest authSessions.userId creation time)`; both requireSession and current reject old sessions after reactivation. Roles/classes are still separate tables and are read on every actor load.
- Existing normalized tables store consent responses, thread/status changes, registers/marks, conduct, report files/review/release, role/class grants, school flags and profile preferences. Existing compound indexes provide idempotent consent/mark upserts, per-class/day registers and grant lookups; no new unbounded arrays or workflow-state blobs are introduced.
- `auditLog.summary` stores attendance correction previous/next status/note and reason. All canonical writes audit transactionally and invalidate derived dashboard versions. Internal publication/fanout use the same audit writer; no public audit-edit endpoint exists.
- Report upload actions store validated PDF bytes (maximum 512 KiB) then independently authorize/persist Draft metadata. Failed finalization deletes the newly stored file. Report reads recheck scope/release before returning bytes, never a permanent URL. This remains the legacy 512 KiB byte compatibility API; current clients use the Phase 8 contract in FILES.md. Reset still deletes only registry-owned seed files.
- Supported module flags are messages, calendar, resources, forms, contact, payments, reports, conduct, attendance and groups. Disabled flags affect direct/related server reads and writes plus navigation. Core identity/settings/navigation controls cannot be disabled by the settings form.

New report uploads also store optional `reports.uploadHash`, indexed by `by_uploadedBy_and_uploadHash`. A server-computed digest covers learner/title/term/PDF content; retries by the same uploader reuse the report. Finalization rechecks this index transactionally and removes a concurrently stored duplicate file. Existing reports remain unchanged; no production backfill is performed.

## File storage access paths
| Table / index | Purpose |
| --- | --- |
| fileUploads / by_expiresAt | Session-owned one-hour upload reservations; delayed staging cleanup |
| fileUploads / by_storageId | Unique claim of a staged upload |
| fileUploads / by_sha256 | Match abandoned upload responses by declared digest/size/type/time window |
| fileGrants / by_tokenHash | Redeem hashed 256-bit two-minute download tokens |
| fileGrants / by_expiresAt | Bounded expired-grant cleanup |
| managedFiles / by_storageId | Canonical ownership registry; excludes attached files from staging cleanup |
| managedFiles / by_detachedAt | Reclaim explicitly detached attachments after 24 hours |

Upload reservations store server-derived user/session, validated upload specification, file metadata and digest; canonical references stay on notices/resources/reports/receipts. Grants store server-derived session/user, canonical target and file snapshot, never raw tokens or permanent URLs. Notice attachment arrays are capped at ten. Public file metadata omits canonical storage IDs. Infrastructure rows do not invalidate business dashboard caches; attached-file audits do. See FILES.md for expiry, cleanup, receipt and compatibility contracts.

## Notification access paths
- `pushTokens` adds optional `sessionId`, `projectId` and `updatedAt` for existing-row compatibility. `by_token` supports atomic account transfer; `by_userId` supports a maximum of ten devices and current-session removal. Legacy unbound tokens do not send.
- `notificationDeliveries` stores deduplication key, recipient, source kind/revision and notice/consent reference, channel/device, state/run, provider acceptance/confirmation and next receipt check. `by_key` deduplicates; `by_userId` and `by_noticeId` paginate private histories; `by_noticeId_and_userId` supports per-family access; `by_channel_and_state_and_checkAt` bounds provider polling. Device IDs are soft historical references after removal; provider IDs/tokens are never public.
- `noticeReceipts.deliveredAt` retains in-app availability meaning. Optional `notificationDeliveredAt` records actual provider confirmation. Read and acknowledged timestamps stay independent.
- No real payment success, payment reminders or receipt emails are introduced by Phase 10. See NOTIFICATIONS.md for authority, scheduling, retry and activation contracts.

## Phase 11 roster import

| Read / write | Index |
| --- | --- |
| Grade for an imported class (exact name; bounded case-insensitive fallback, imports cap grades at 50) | `grades.by_name`, `grades.by_sortOrder` |
| Class for an imported learner/staff row | `classes.by_year_and_name` |
| Existing learner by school number | `learners.by_learnerNumber` (numbers stored upper-case by import) |
| Existing account / guardian link | `users.email`, `guardianLinks.by_guardianId_and_learnerId`, `staffRoles.by_userId` |
| Staged guardian contact | `rosterContacts.by_kind_and_email_and_learnerId`; per-learner bound via `rosterContacts.by_learnerId` |
| Staged staff contact | `rosterContacts.by_kind_and_email` |
| Recent uploads | `importBatches` creation-time order; `importBatches.by_status` for open batches |
| Replay-safe row accounting per batch | `importBatchRows.by_batchId_and_row` (row number → content digest, outcome) |

`importBatches`, `importBatchRows`, `rosterContacts` and the `grades.by_name` index are additive, with no backfill. Staged contacts are not identity, role or guardian data and grant no access; see [IMPORTS.md](IMPORTS.md). Reset clears both with the other application tables.
