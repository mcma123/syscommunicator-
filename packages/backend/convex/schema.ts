import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  NOTIFICATION_KINDS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATES,
} from "@school-connect/core/domain";
import { literals } from "./validators";
import { authTables } from "@convex-dev/auth/server";
import { fileTarget, uploadSpec } from "./lib/fileValidators";
import {
  adMediaKind,
  adMediaStatus,
  adStatus,
  advertiserSource,
  advertiserStatus,
  attachment,
  attendanceStatus,
  audience,
  chargeStatus,
  conductType,
  consentDecision,
  consentRequestStatus,
  department,
  enquiryStatus,
  eventStatus,
  guardianRelationship,
  importBatchStatus,
  importKind,
  invitationKind,
  invitationStatus,
  learnerStatus,
  noticeCategory,
  noticeStatus,
  paymentStatus,
  publishStatus,
  pushPlatform,
  registerStatus,
  reportStatus,
  resourceCategory,
  rosterContactKind,
  staffRole,
  userStatus,
} from "./validators";

// Conventions: timestamps are epoch milliseconds (`...At`), calendar days are
// ISO "YYYY-MM-DD" strings, money is integer cents in the school currency.
// Every planned access path has an index; see packages/backend/DATA-MODEL.md.
export default defineSchema({
  ...authTables,
  fileUploads: defineTable({
    userId: v.id("users"),
    sessionId: v.id("authSessions"),
    spec: uploadSpec,
    fileName: v.string(),
    contentType: v.string(),
    size: v.number(),
    sha256: v.string(),
    expiresAt: v.number(),
    storageId: v.optional(v.id("_storage")),
    resultId: v.optional(v.string()),
  })
    .index("by_expiresAt", ["expiresAt"])
    .index("by_sha256", ["sha256"])
    .index("by_storageId", ["storageId"]),
  fileGrants: defineTable({
    userId: v.id("users"),
    sessionId: v.id("authSessions"),
    target: fileTarget,
    tokenHash: v.string(),
    storageId: v.id("_storage"),
    expiresAt: v.number(),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_expiresAt", ["expiresAt"]),
  managedFiles: defineTable({
    storageId: v.id("_storage"),
    target: fileTarget,
    detachedAt: v.optional(v.number()),
  })
    .index("by_storageId", ["storageId"])
    .index("by_detachedAt", ["detachedAt"]),
  // Development-only fixture identity and file ownership, never client data.
  seedFixtures: defineTable({
    key: v.string(),
    target: v.union(
      v.object({ kind: v.literal("document"), table: v.string(), documentId: v.string() }),
      v.object({ kind: v.literal("file"), file: attachment }),
    ),
  }).index("by_key", ["key"]),
  // ── School configuration ────────────────────────────────────────────────
  // Single-school deployment: one row replaces the hard-coded schoolConfig.
  schools: defineTable({
    name: v.string(),
    appName: v.string(),
    shortName: v.string(),
    tagline: v.string(),
    logoStorageId: v.optional(v.id("_storage")),
    websiteUrl: v.string(),
    clothingStoreUrl: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    timezone: v.string(),
    currency: v.string(),
    currentTerm: v.string(),
    featureFlags: v.record(v.string(), v.boolean()),
    updatedAt: v.number(),
  }),

  // ── People and identity ─────────────────────────────────────────────────
  // Field and index names match Convex Auth's `users` table so Phase 3 can
  // spread `authTables` and override `users` with this definition.
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // App fields stay optional because Convex Auth creates users without them.
    status: v.optional(userStatus),
    updatedAt: v.optional(v.number()),
    dashboardRevision: v.optional(v.number()),
    sessionsValidAfter: v.optional(v.number()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  // A user is a parent through guardianLinks and staff through staffRoles;
  // one person can be both.
  staffRoles: defineTable({
    userId: v.id("users"),
    role: staffRole,
  })
    .index("by_userId", ["userId"])
    .index("by_role", ["role"])
    .index("by_userId_and_role", ["userId", "role"]),

  grades: defineTable({
    name: v.string(),
    sortOrder: v.number(),
  })
    .index("by_sortOrder", ["sortOrder"])
    .index("by_name", ["name"]),

  classes: defineTable({
    gradeId: v.id("grades"),
    name: v.string(),
    year: v.number(),
    homeroomTeacherId: v.optional(v.id("users")),
  })
    .index("by_gradeId", ["gradeId"])
    .index("by_year_and_name", ["year", "name"]),

  learners: defineTable({
    firstName: v.string(),
    lastName: v.string(),
    preferredName: v.optional(v.string()),
    learnerNumber: v.string(),
    gradeId: v.id("grades"),
    classId: v.id("classes"),
    dateOfBirth: v.optional(v.string()),
    status: learnerStatus,
    photoStorageId: v.optional(v.id("_storage")),
  })
    .index("by_learnerNumber", ["learnerNumber"])
    .index("by_classId_and_status", ["classId", "status"])
    .index("by_gradeId_and_status", ["gradeId", "status"]),

  guardianLinks: defineTable({
    guardianId: v.id("users"),
    learnerId: v.id("learners"),
    relationship: guardianRelationship,
    isPrimaryContact: v.boolean(),
  })
    .index("by_guardianId", ["guardianId"])
    .index("by_learnerId", ["learnerId"])
    .index("by_guardianId_and_learnerId", ["guardianId", "learnerId"]),

  teachingAssignments: defineTable({
    staffId: v.id("users"),
    classId: v.id("classes"),
    subject: v.optional(v.string()),
  })
    .index("by_staffId", ["staffId"])
    .index("by_classId", ["classId"])
    .index("by_staffId_and_classId", ["staffId", "classId"]),

  timetablePeriods: defineTable({
    classId: v.id("classes"),
    weekday: v.union(...([0, 1, 2, 3, 4, 5, 6] as const).map((n) => v.literal(n))),
    startMinute: v.number(),
    endMinute: v.number(),
    subject: v.string(),
    room: v.optional(v.string()),
    teacherId: v.optional(v.id("users")),
  }).index("by_classId_and_weekday_and_startMinute", ["classId", "weekday", "startMinute"]),

  // Derived, rebuildable dashboard materialization; never canonical school records.
  dashboardVersions: defineTable({ key: v.string(), revision: v.number() }).index("by_key", [
    "key",
  ]),
  dashboardBuilds: defineTable({
    userId: v.id("users"),
    learnerId: v.optional(v.id("learners")),
    revision: v.string(),
    phase: v.union(v.literal("clean"), v.literal("build"), v.literal("ready")),
    moduleIndex: v.number(),
    progress: v.number(),
    cursor: v.union(v.string(), v.null()),
  }).index("by_userId_and_learnerId", ["userId", "learnerId"]),
  dashboardItems: defineTable({
    buildId: v.id("dashboardBuilds"),
    kind: v.union(
      v.literal("messages"),
      v.literal("forms"),
      v.literal("calendar"),
      v.literal("payments"),
      v.literal("acknowledgements"),
    ),
    pending: v.boolean(),
    at: v.number(),
    amount: v.number(),
    sourceId: v.string(),
  })
    .index("by_buildId", ["buildId"])
    .index("by_buildId_and_kind_and_sourceId", ["buildId", "kind", "sourceId"]),

  groups: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    createdBy: v.id("users"),
  }).index("by_name", ["name"]),

  groupMembers: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
  })
    .index("by_groupId", ["groupId"])
    .index("by_userId", ["userId"])
    .index("by_groupId_and_userId", ["groupId", "userId"]),

  // ── Communication ───────────────────────────────────────────────────────
  notices: defineTable({
    title: v.string(),
    body: v.string(),
    category: noticeCategory,
    status: noticeStatus,
    authorId: v.id("users"),
    revision: v.optional(v.number()),
    publicationActorId: v.optional(v.id("users")),
    reviewedBy: v.optional(v.id("users")),
    audiences: v.array(audience),
    urgent: v.boolean(),
    requiresAcknowledgement: v.boolean(),
    consentRequestId: v.optional(v.id("consentRequests")),
    attachments: v.array(attachment),
    publishAt: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_status_and_publishAt", ["status", "publishAt"])
    .index("by_status_and_publishedAt", ["status", "publishedAt"])
    .index("by_status_and_category_and_publishedAt", ["status", "category", "publishedAt"])
    .index("by_authorId", ["authorId"]),

  // Created per guardian when a notice is published (audience fan-out), so a
  // parent's feed and delivery/read/acknowledged counts are single index reads.
  noticeReceipts: defineTable({
    noticeId: v.id("notices"),
    guardianId: v.id("users"),
    deliveredAt: v.optional(v.number()),
    notificationDeliveredAt: v.optional(v.number()),
    readAt: v.optional(v.number()),
    acknowledgedAt: v.optional(v.number()),
  })
    .index("by_guardianId", ["guardianId"])
    .index("by_guardianId_and_readAt", ["guardianId", "readAt"])
    .index("by_noticeId", ["noticeId"])
    .index("by_noticeId_and_guardianId", ["noticeId", "guardianId"]),

  events: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    category: noticeCategory,
    status: eventStatus,
    startsAt: v.number(),
    endsAt: v.number(),
    allDay: v.boolean(),
    location: v.string(),
    audiences: v.array(audience),
    createdBy: v.id("users"),
    updatedAt: v.number(),
  }).index("by_status_and_startsAt", ["status", "startsAt"]),

  resources: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    category: resourceCategory,
    status: publishStatus,
    file: attachment,
    audiences: v.array(audience),
    publishedBy: v.id("users"),
    updatedAt: v.number(),
  }).index("by_status_and_category", ["status", "category"]),

  // Ad Center: staff-published promotional media shown on parent home screens.
  ads: defineTable({
    title: v.string(),
    caption: v.optional(v.string()),
    linkUrl: v.optional(v.string()),
    linkLabel: v.optional(v.string()),
    media: v.optional(attachment),
    status: adStatus,
    startsAt: v.number(),
    endsAt: v.number(),
    popup: v.boolean(),
    audiences: v.array(audience),
    createdBy: v.id("users"),
    approvedBy: v.optional(v.id("users")),
    reviewNote: v.optional(v.string()),
    updatedAt: v.number(),
    revision: v.number(),
    /** Business paying for the ad (monthly performance reports). */
    advertiserId: v.optional(v.id("advertisers")),
  })
    .index("by_status_and_endsAt", ["status", "endsAt"])
    .index("by_advertiserId", ["advertiserId"])
    .index("by_updatedAt", ["updatedAt"])
    .index("by_createdBy_and_updatedAt", ["createdBy", "updatedAt"]),

  // Ad Center media stored in the private Cloudflare R2 bucket (key = object key).
  adMedia: defineTable({
    adId: v.id("ads"),
    key: v.string(),
    kind: adMediaKind,
    contentType: v.string(),
    size: v.number(),
    fileName: v.string(),
    order: v.number(),
    status: adMediaStatus,
    uploadedBy: v.id("users"),
    sessionId: v.id("authSessions"),
    expiresAt: v.number(),
    detachedAt: v.optional(v.number()),
  })
    .index("by_adId_and_order", ["adId", "order"])
    .index("by_key", ["key"])
    .index("by_status_and_expiresAt", ["status", "expiresAt"])
    .index("by_detachedAt", ["detachedAt"]),

  // Ad Center measurement. One row per (ad, parent account): last day each event was
  // counted, so impressions/popups/clicks count once per parent per day and the row's
  // existence counts the parent once in lifetime reach.
  adViewers: defineTable({
    adId: v.id("ads"),
    userId: v.id("users"),
    lastSeenDay: v.number(),
    bannerDay: v.optional(v.number()),
    popupDay: v.optional(v.number()),
    clickDay: v.optional(v.number()),
  }).index("by_adId_and_userId", ["adId", "userId"]),
  // Daily counters per ad (day = days since epoch, South African time). Day 0 holds
  // lifetime totals, where `viewers` is the number of distinct parents reached.
  adStats: defineTable({
    adId: v.id("ads"),
    day: v.number(),
    impressions: v.number(),
    popupViews: v.number(),
    clicks: v.number(),
    viewers: v.number(),
  })
    .index("by_adId_and_day", ["adId", "day"])
    .index("by_day", ["day"]),

  // Businesses interested in advertising. Leads come from the public "Advertise with us"
  // form (consent recorded there) or are added by school leaders. Marketing email is only
  // sent while consentEmail is true; unsubscribing clears it permanently for that lead.
  advertisers: defineTable({
    businessName: v.string(),
    contactName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    category: v.optional(v.string()),
    message: v.optional(v.string()),
    source: advertiserSource,
    status: advertiserStatus,
    consentEmail: v.boolean(),
    consentWhatsApp: v.boolean(),
    consentAt: v.optional(v.number()),
    consentText: v.optional(v.string()),
    /** Next follow-up email (0 = welcome); absent when the sequence is finished or stopped. */
    sequenceStep: v.number(),
    nextSendAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    seenByStaff: v.boolean(),
    createdBy: v.optional(v.id("users")),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_updatedAt", ["updatedAt"])
    .index("by_nextSendAt", ["nextSendAt"])
    .index("by_status", ["status"])
    .index("by_seenByStaff", ["seenByStaff"]),
  // One row per marketing email attempt (sequence step or monthly report).
  advertiserEmails: defineTable({
    advertiserId: v.id("advertisers"),
    kind: v.string(),
    status: v.union(v.literal("Sent"), v.literal("Failed"), v.literal("Skipped")),
    detail: v.optional(v.string()),
  }).index("by_advertiserId", ["advertiserId"]),
  // Rounded public reach figures for the "Advertise with us" page, refreshed daily.
  siteStats: defineTable({
    key: v.literal("reach"),
    families: v.number(),
    learners: v.number(),
    weeklyFamilies: v.number(),
    adViews30: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  enquiries: defineTable({
    subject: v.string(),
    department: department,
    status: enquiryStatus,
    createdBy: v.id("users"),
    learnerId: v.optional(v.id("learners")),
    assigneeId: v.optional(v.id("users")),
    lastMessageAt: v.number(),
  })
    .index("by_createdBy_and_lastMessageAt", ["createdBy", "lastMessageAt"])
    .index("by_department_and_status", ["department", "status"])
    .index("by_assigneeId_and_status", ["assigneeId", "status"])
    .index("by_status_and_lastMessageAt", ["status", "lastMessageAt"]),

  enquiryMessages: defineTable({
    enquiryId: v.id("enquiries"),
    authorId: v.id("users"),
    body: v.string(),
    // Staff-only notes are hidden from the family.
    internal: v.boolean(),
  }).index("by_enquiryId", ["enquiryId"]),

  // ── Learner records ─────────────────────────────────────────────────────
  reports: defineTable({
    uploadHash: v.optional(v.string()),
    learnerId: v.id("learners"),
    term: v.string(),
    title: v.string(),
    status: reportStatus,
    file: v.optional(attachment),
    uploadedBy: v.id("users"),
    reviewedBy: v.optional(v.id("users")),
    releasedAt: v.optional(v.number()),
  })
    .index("by_learnerId_and_status", ["learnerId", "status"])
    .index("by_uploadedBy_and_uploadHash", ["uploadedBy", "uploadHash"])
    .index("by_learnerId_and_term", ["learnerId", "term"])
    .index("by_term_and_status", ["term", "status"]),

  attendanceRegisters: defineTable({
    classId: v.id("classes"),
    date: v.string(),
    status: registerStatus,
    takenBy: v.id("users"),
    submittedAt: v.optional(v.number()),
  })
    .index("by_classId_and_date", ["classId", "date"])
    .index("by_date_and_status", ["date", "status"]),

  attendanceMarks: defineTable({
    registerId: v.id("attendanceRegisters"),
    learnerId: v.id("learners"),
    date: v.string(),
    status: attendanceStatus,
    note: v.optional(v.string()),
    updatedBy: v.id("users"),
  })
    .index("by_registerId", ["registerId"])
    .index("by_registerId_and_learnerId", ["registerId", "learnerId"])
    .index("by_learnerId_and_date", ["learnerId", "date"]),

  conductEntries: defineTable({
    learnerId: v.id("learners"),
    type: conductType,
    title: v.string(),
    description: v.optional(v.string()),
    authorId: v.id("users"),
    visibleToGuardians: v.boolean(),
    occurredAt: v.number(),
  })
    .index("by_learnerId_and_occurredAt", ["learnerId", "occurredAt"])
    .index("by_authorId", ["authorId"]),

  // ── Forms and consent ───────────────────────────────────────────────────
  consentRequests: defineTable({
    title: v.string(),
    description: v.string(),
    status: consentRequestStatus,
    audiences: v.array(audience),
    eventId: v.optional(v.id("events")),
    dueAt: v.number(),
    createdBy: v.id("users"),
  }).index("by_status_and_dueAt", ["status", "dueAt"]),

  consentResponses: defineTable({
    consentRequestId: v.id("consentRequests"),
    learnerId: v.id("learners"),
    guardianId: v.id("users"),
    decision: consentDecision,
    contactPhone: v.string(),
    notes: v.optional(v.string()),
    respondedAt: v.number(),
  })
    .index("by_consentRequestId", ["consentRequestId"])
    .index("by_consentRequestId_and_learnerId", ["consentRequestId", "learnerId"])
    .index("by_learnerId", ["learnerId"])
    .index("by_guardianId", ["guardianId"]),

  // ── Payments ────────────────────────────────────────────────────────────
  charges: defineTable({
    learnerId: v.id("learners"),
    title: v.string(),
    description: v.optional(v.string()),
    amountCents: v.number(),
    status: chargeStatus,
    dueAt: v.number(),
    consentRequestId: v.optional(v.id("consentRequests")),
    createdBy: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_learnerId_and_status", ["learnerId", "status"])
    .index("by_status_and_dueAt", ["status", "dueAt"]),

  payments: defineTable({
    chargeId: v.id("charges"),
    payerId: v.id("users"),
    amountCents: v.number(),
    provider: v.string(),
    providerReference: v.optional(v.string()),
    status: paymentStatus,
    completedAt: v.optional(v.number()),
  })
    .index("by_chargeId", ["chargeId"])
    .index("by_payerId", ["payerId"])
    .index("by_provider_and_providerReference", ["provider", "providerReference"])
    .index("by_status", ["status"]),

  // Raw provider webhooks; the provider event ID makes processing idempotent.
  paymentEvents: defineTable({
    provider: v.string(),
    providerEventId: v.string(),
    type: v.string(),
    rawBody: v.string(),
    paymentId: v.optional(v.id("payments")),
    processedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_provider_and_providerEventId", ["provider", "providerEventId"])
    .index("by_paymentId", ["paymentId"]),

  receipts: defineTable({
    receiptNumber: v.string(),
    paymentId: v.id("payments"),
    chargeId: v.id("charges"),
    guardianId: v.id("users"),
    amountCents: v.number(),
    file: v.optional(attachment),
    issuedAt: v.number(),
  })
    .index("by_receiptNumber", ["receiptNumber"])
    .index("by_paymentId", ["paymentId"])
    .index("by_guardianId_and_issuedAt", ["guardianId", "issuedAt"]),

  // ── Onboarding, notifications and accountability ───────────────────────
  invitations: defineTable({
    email: v.string(),
    kind: invitationKind,
    staffRole: v.optional(staffRole),
    learnerIds: v.array(v.id("learners")),
    // Only a hash of the emailed token is stored.
    tokenHash: v.string(),
    status: invitationStatus,
    expiresAt: v.number(),
    invitedBy: v.id("users"),
    acceptedBy: v.optional(v.id("users")),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_email_and_status", ["email", "status"])
    .index("by_status_and_expiresAt", ["status", "expiresAt"]),

  // ── Phase 11 roster import ──────────────────────────────────────────────
  // One upload (Administrator, or a Principal/Teacher class import) of one CSV kind, committed in bounded chunks.
  importBatches: defineTable({
    kind: importKind,
    fileName: v.string(),
    status: importBatchStatus,
    createdBy: v.id("users"),
    totalRows: v.number(),
    created: v.number(),
    updated: v.number(),
    unchanged: v.number(),
    rejected: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_createdBy", ["createdBy"]),
  // One row per processed spreadsheet row of a batch: makes counters replay-safe.
  // digest = SHA-256 of kind + canonical cells; a changed replay is refused.
  importBatchRows: defineTable({
    batchId: v.id("importBatches"),
    row: v.number(),
    digest: v.string(),
    outcome: v.union(
      v.literal("create"),
      v.literal("update"),
      v.literal("unchanged"),
      v.literal("rejected"),
    ),
  }).index("by_batchId_and_row", ["batchId", "row"]),
  // Imported guardians/staff awaiting activation. A contact grants no sign-in,
  // role or learner access: authPolicy only links users rows and invitations.
  rosterContacts: defineTable({
    kind: rosterContactKind,
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    phone: v.optional(v.string()),
    // Guardian contacts: exactly one learner and relationship.
    learnerId: v.optional(v.id("learners")),
    relationship: v.optional(guardianRelationship),
    isPrimaryContact: v.optional(v.boolean()),
    // Staff contacts: requested roles and teaching classes (bounded by import rules).
    staffRoles: v.optional(v.array(staffRole)),
    classIds: v.optional(v.array(v.id("classes"))),
    importBatchId: v.id("importBatches"),
    updatedAt: v.number(),
  })
    .index("by_kind_and_email", ["kind", "email"])
    .index("by_kind_and_email_and_learnerId", ["kind", "email", "learnerId"])
    .index("by_learnerId", ["learnerId"]),

  pushTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
    platform: pushPlatform,
    sessionId: v.optional(v.id("authSessions")),
    projectId: v.optional(v.string()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_token", ["token"]),

  notificationDeliveries: defineTable({
    key: v.string(),
    userId: v.id("users"),
    kind: literals(NOTIFICATION_KINDS),
    channel: literals(NOTIFICATION_CHANNELS),
    state: literals(NOTIFICATION_STATES),
    noticeId: v.optional(v.id("notices")),
    consentRequestId: v.optional(v.id("consentRequests")),
    pushTokenId: v.optional(v.id("pushTokens")),
    revision: v.number(),
    run: v.number(),
    providerId: v.optional(v.string()),
    reason: v.optional(v.string()),
    workId: v.optional(v.string()),
    submittedAt: v.optional(v.number()),
    confirmedAt: v.optional(v.number()),
    checkAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_userId", ["userId"])
    .index("by_noticeId", ["noticeId"])
    .index("by_noticeId_and_userId", ["noticeId", "userId"])
    .index("by_channel_and_state_and_checkAt", ["channel", "state", "checkAt"]),
  notificationPreferences: defineTable({
    userId: v.id("users"),
    pushEnabled: v.boolean(),
    emailEnabled: v.boolean(),
    mutedCategories: v.array(noticeCategory),
    quietHoursStart: v.optional(v.string()),
    quietHoursEnd: v.optional(v.string()),
  }).index("by_userId", ["userId"]),

  // Append-only. `actorId` is absent for system actions (crons, webhooks).
  auditLog: defineTable({
    actorId: v.optional(v.id("users")),
    action: v.string(),
    targetTable: v.string(),
    targetId: v.string(),
    summary: v.optional(v.string()),
  })
    .index("by_targetTable_and_targetId", ["targetTable", "targetId"])
    .index("by_actorId", ["actorId"])
    .index("by_action", ["action"]),
});
