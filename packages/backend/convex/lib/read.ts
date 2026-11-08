import { v } from "convex/values";
import type { PaginationOptions, PaginationResult } from "convex/server";
import { SCHOOL_MODULES } from "@school-connect/core/permissions";
import {
  RELATED_MODULES,
  type ReadModule,
  type ModuleRecord,
  type RecordDetail,
} from "@school-connect/core/live";
import { NOTICE_CATEGORIES, RESOURCE_CATEGORIES } from "@school-connect/core/domain";
import type { Doc, Id, TableNames } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { literals } from "../validators";
import { canManageNotice, canReadNotice, matchesAudience } from "./audiences";
import {
  denied,
  missing,
  requireModule,
  requireGuardianOf,
  requireLearnerAccess,
  requireTeacherOf,
  wholeSchool,
  hasRole,
  type Actor,
} from "./auth";

export const readModule = literals([...SCHOOL_MODULES, ...RELATED_MODULES]);
export const parentIdValidator = v.union(
  v.id("notices"),
  v.id("charges"),
  v.id("enquiries"),
  v.id("attendanceRegisters"),
  v.id("classes"),
  v.id("consentRequests"),
);
export const readArgs = {
  module: readModule,
  learnerId: v.optional(v.id("learners")),
  parentId: v.optional(parentIdValidator),
  classId: v.optional(v.id("classes")),
  manage: v.optional(v.boolean()),
  search: v.optional(v.string()),
  category: v.optional(v.string()),
  from: v.optional(v.number()),
  to: v.optional(v.number()),
  outstandingOnly: v.optional(v.boolean()),
};
export interface ReadInput {
  module: ReadModule;
  learnerId?: Id<"learners">;
  parentId?: Id<
    "charges" | "enquiries" | "attendanceRegisters" | "classes" | "consentRequests" | "notices"
  >;
  classId?: Id<"classes">;
  manage?: boolean;
  search?: string;
  category?: string;
  from?: number;
  to?: number;
  outstandingOnly?: boolean;
}
export const tables: Partial<Record<ReadModule, TableNames>> = {
  invitations: "invitations",
  noticeReceipts: "noticeReceipts",
  home: "schools",
  settings: "schools",
  messages: "notices",
  calendar: "events",
  children: "learners",
  classLearners: "learners",
  resources: "resources",
  payments: "charges",
  forms: "consentRequests",
  contact: "enquiries",
  groups: "groups",
  classes: "classes",
  attendance: "attendanceRegisters",
  conduct: "conductEntries",
  reports: "reports",
  people: "users",
  audit: "auditLog",
  timetable: "timetablePeriods",
  attendanceMarks: "attendanceMarks",
  paymentHistory: "payments",
  enquiryMessages: "enquiryMessages",
  formResponses: "consentResponses",
  ads: "ads",
};
export function record(
  id: string,
  title: string,
  body = "",
  subtitle = "",
  status = "",
  extra: Partial<ModuleRecord> = {},
): ModuleRecord {
  return {
    id,
    title,
    body,
    subtitle,
    status,
    at: null,
    amountCents: null,
    read: false,
    acknowledged: false,
    canAcknowledge: false,
    ...extra,
  };
}
/** Short human audience description; bounded by the 20-entry audience limit. */
export async function audienceLabel(ctx: QueryCtx, audiences: Doc<"ads">["audiences"]) {
  const names: string[] = [];
  for (const a of audiences) {
    if (a.kind === "School") names.push("Whole school");
    else if (a.kind === "Grade")
      names.push((await ctx.db.get("grades", a.gradeId))?.name ?? "Grade");
    else if (a.kind === "Class")
      names.push(`Class ${(await ctx.db.get("classes", a.classId))?.name ?? ""}`.trim());
    else names.push((await ctx.db.get("groups", a.groupId))?.name ?? "Group");
  }
  return names.join(", ");
}
const field = (label: string, value: string | number | null | undefined) => ({
  label,
  value: value === null || value === undefined || value === "" ? "Not provided" : String(value),
});
export function staffForLearner(actor: Actor, l: Doc<"learners">) {
  return (
    wholeSchool(actor) ||
    (hasRole(actor, "Teacher") && actor.teachingClasses.some((c) => c._id === l.classId))
  );
}
export function seesLearner(actor: Actor, l: Doc<"learners">) {
  return (
    staffForLearner(actor, l) ||
    (l.status === "Active" && actor.learners.some((own) => own._id === l._id))
  );
}
export function academic(actor: Actor) {
  return wholeSchool(actor) || hasRole(actor, "Teacher");
}
async function audience(
  ctx: QueryCtx,
  actor: Actor,
  targets: Doc<"notices">["audiences"],
  selected?: Doc<"learners">,
) {
  const allowed =
    wholeSchool(actor) ||
    (await matchesAudience(ctx, actor, targets, "guardian")) ||
    (await matchesAudience(ctx, actor, targets, "teacher"));
  return (
    allowed &&
    (!selected ||
      (await matchesAudience(ctx, { ...actor, learners: [selected] }, targets, "guardian")))
  );
}
export async function financial(ctx: QueryCtx, actor: Actor, learnerId: Id<"learners">) {
  if (wholeSchool(actor) || hasRole(actor, "Finance")) return;
  await requireGuardianOf(ctx, learnerId, actor);
}
function financeAllowed(actor: Actor, learnerId: Id<"learners">) {
  return (
    wholeSchool(actor) ||
    hasRole(actor, "Finance") ||
    actor.learners.some((l) => l._id === learnerId)
  );
}
export function enquiryAllowed(actor: Actor, e: Doc<"enquiries">) {
  return (
    wholeSchool(actor) ||
    e.createdBy === actor.user._id ||
    (hasRole(actor, "Teacher") && e.assigneeId === actor.user._id)
  );
}
function normalize<T extends TableNames>(ctx: QueryCtx, table: T, id: string): Id<T> {
  const normalized = ctx.db.normalizeId(table, id);
  if (!normalized) missing();
  return normalized;
}
export async function guardRead(ctx: QueryCtx, actor: Actor, args: ReadInput) {
  const { module, learnerId, parentId } = args;
  const feature =
    (
      {
        attendanceMarks: "attendance",
        classLearners: "groups",
        timetable: "groups",
        paymentHistory: "payments",
        enquiryMessages: "contact",
        formResponses: "forms",
        noticeReceipts: "messages",
        invitations: "people",
      } as Partial<Record<ReadModule, string>>
    )[module] ?? module;
  if (actor.disabledModules?.includes(feature)) denied();
  if (args.manage && !academic(actor)) denied();
  if (args.search && args.search.length > 200) throw new Error("Search is too long.");
  if (
    (args.from !== undefined && !Number.isFinite(args.from)) ||
    (args.to !== undefined && !Number.isFinite(args.to)) ||
    (args.from !== undefined && args.to !== undefined && args.to <= args.from)
  )
    throw new Error("Invalid date range.");
  if (["reports", "conduct", "attendanceMarks", "timetable"].includes(module) && learnerId) {
    requireModule(actor, "children");
    await requireLearnerAccess(ctx, learnerId, actor);
  } else if (module === "classLearners" || module === "classes") requireModule(actor, "groups");
  else if (module === "paymentHistory") requireModule(actor, "payments");
  else if (module === "enquiryMessages") requireModule(actor, "contact");
  else if (module === "invitations") requireModule(actor, "people");
  else if (module === "noticeReceipts") requireModule(actor, "messages");
  else if (module === "formResponses") requireModule(actor, "forms");
  else if (module === "attendanceMarks") {
    requireModule(actor, "attendance");
    if (!parentId) throw new Error("Choose a register or learner.");
  } else if (module === "timetable") requireModule(actor, "groups");
  else requireModule(actor, module as (typeof SCHOOL_MODULES)[number]);
  const selected = learnerId ? await ctx.db.get("learners", learnerId) : null;
  if (learnerId && !selected) missing();
  if (selected) {
    if (module === "payments" || module === "paymentHistory")
      await financial(ctx, actor, selected._id);
    else await requireLearnerAccess(ctx, selected._id, actor);
  }
  if (args.classId) await requireTeacherOf(ctx, args.classId, actor);
  if (module === "classLearners") {
    if (!parentId) throw new Error("Choose a class.");
    await requireTeacherOf(ctx, normalize(ctx, "classes", parentId), actor);
  }
  if (module === "timetable" && !selected) {
    if (!args.classId) throw new Error("Choose a learner or class.");
  }
  if (module === "enquiryMessages") {
    if (!parentId) throw new Error("Choose a conversation.");
    const e = await ctx.db.get("enquiries", normalize(ctx, "enquiries", parentId));
    if (!e) missing();
    if (!enquiryAllowed(actor, e)) denied();
  }
  if (module === "paymentHistory" && parentId) {
    const c = await ctx.db.get("charges", normalize(ctx, "charges", parentId));
    if (!c) missing();
    await financial(ctx, actor, c.learnerId);
    if (selected && c.learnerId !== selected._id) denied();
  }
  if (module === "attendanceMarks" && parentId) {
    const r = await ctx.db.get(
      "attendanceRegisters",
      normalize(ctx, "attendanceRegisters", parentId),
    );
    if (!r) missing();
    await requireTeacherOf(ctx, r.classId, actor);
  }
  if (module === "formResponses") {
    if (!parentId) throw new Error("Choose a form.");
    const f = await ctx.db.get("consentRequests", normalize(ctx, "consentRequests", parentId));
    if (!f) missing();
    if (!(await audience(ctx, actor, f.audiences, selected ?? undefined))) denied();
  }
  if (module === "noticeReceipts") {
    if (!parentId || !academic(actor)) denied();
    const n = await ctx.db.get("notices", normalize(ctx, "notices", parentId));
    if (!n || !canManageNotice(actor, n)) denied();
  }
  return selected ?? undefined;
}

/** Project one source document only after its relationship and current publication are checked. */
export async function project(
  ctx: QueryCtx,
  actor: Actor,
  args: ReadInput,
  row: Doc<TableNames>,
  selected?: Doc<"learners">,
): Promise<ModuleRecord | null> {
  const { module } = args;
  const parentFields: Partial<Record<ReadModule, string>> = {
    noticeReceipts: "noticeId",
    paymentHistory: "chargeId",
    enquiryMessages: "enquiryId",
    attendanceMarks: "registerId",
    formResponses: "consentRequestId",
    classLearners: "classId",
  };
  const parentField = parentFields[module];
  if (
    args.parentId &&
    parentField &&
    (row as unknown as Record<string, unknown>)[parentField] !== args.parentId
  )
    return null;

  if (module === "invitations") {
    const invite = row as Doc<"invitations">;
    return record(
      invite._id,
      invite.email,
      "",
      `${invite.kind}${invite.staffRole ? ` | ${invite.staffRole}` : ""}`,
      invite.status,
      { fields: [field("Expires", new Date(invite.expiresAt).toISOString())] },
    );
  }
  if (module === "noticeReceipts") {
    const receipt = row as Doc<"noticeReceipts">;
    const user = await ctx.db.get("users", receipt.guardianId);
    return record(
      receipt._id,
      user?.name ?? "Guardian",
      "",
      "Notice receipt",
      receipt.acknowledgedAt ? "Acknowledged" : receipt.readAt ? "Read" : "Unread",
      {
        read: !!receipt.readAt,
        acknowledged: !!receipt.acknowledgedAt,
        fields: [
          field(
            "Available in app",
            receipt.deliveredAt ? new Date(receipt.deliveredAt).toISOString() : null,
          ),
          field(
            "Provider confirmed",
            receipt.notificationDeliveredAt
              ? new Date(receipt.notificationDeliveredAt).toISOString()
              : null,
          ),
          field("Read at", receipt.readAt ? new Date(receipt.readAt).toISOString() : null),
          field(
            "Acknowledged at",
            receipt.acknowledgedAt ? new Date(receipt.acknowledgedAt).toISOString() : null,
          ),
        ],
      },
    );
  }
  if (module === "messages") {
    const n = row as Doc<"notices">;
    if (!(await canReadNotice(ctx, actor, n))) return null;
    if (
      selected &&
      !(await matchesAudience(ctx, { ...actor, learners: [selected] }, n.audiences, "guardian"))
    )
      return null;
    const r = await ctx.db
      .query("noticeReceipts")
      .withIndex("by_noticeId_and_guardianId", (q) =>
        q.eq("noticeId", n._id).eq("guardianId", actor.user._id),
      )
      .unique();
    const author = await ctx.db.get("users", n.authorId);
    return record(n._id, n.title, n.body, author?.name ?? "School", n.status, {
      at: n.publishedAt ?? null,
      category: n.category,
      canMarkRead: n.status === "Published",
      read: !!r?.readAt,
      acknowledged: !!r?.acknowledgedAt,
      canAcknowledge:
        n.status === "Published" && (await matchesAudience(ctx, actor, n.audiences, "guardian")),
      requiresAcknowledgement: n.requiresAcknowledgement,
      pending: !r?.readAt,
      fields: n.attachments.map((a) => field("Attachment", a.fileName)),
    });
  }
  if (module === "calendar") {
    const e = row as Doc<"events">;
    if (
      (e.status !== "Scheduled" &&
        !(args.manage && (wholeSchool(actor) || e.createdBy === actor.user._id))) ||
      !(await audience(ctx, actor, e.audiences, selected))
    )
      return null;
    if (
      (args.from !== undefined && e.endsAt <= args.from) ||
      (args.to !== undefined && e.startsAt >= args.to)
    )
      return null;
    return record(e._id, e.title, e.description ?? "", e.location, e.status, {
      at: e.startsAt,
      endsAt: e.endsAt,
      allDay: e.allDay,
      category: e.category,
      fields: [field("Location", e.location), field("Timezone", "Africa/Johannesburg")],
    });
  }
  if (module === "ads") {
    const ad = row as Doc<"ads">;
    const manager =
      wholeSchool(actor) ||
      (hasRole(actor, "Teacher") &&
        ad.createdBy === actor.user._id &&
        (await matchesAudience(ctx, actor, ad.audiences, "teacher")));
    if (!manager) return null;
    const url = ad.media ? await ctx.storage.getUrl(ad.media.storageId) : null;
    const author = await ctx.db.get("users", ad.createdBy);
    return record(
      ad._id,
      ad.title,
      ad.caption ?? "",
      await audienceLabel(ctx, ad.audiences),
      ad.status,
      {
        at: ad.startsAt,
        endsAt: ad.endsAt,
        category: ad.popup ? "Popup" : "Banner",
        pending: ad.status === "Review",
        ...(url && ad.media
          ? {
              media: {
                url,
                kind: ad.media.contentType.startsWith("video/")
                  ? ("video" as const)
                  : ("image" as const),
              },
            }
          : {}),
        fields: [
          field("Created by", author?.name),
          field("Link", ad.linkUrl),
          field("Button label", ad.linkLabel),
          field("Popup", ad.popup ? "Yes, once per device" : "No"),
          field("Media", ad.media ? `${ad.media.fileName} (${ad.media.contentType})` : null),
          ...(ad.reviewNote ? [field("Review note", ad.reviewNote)] : []),
        ],
      },
    );
  }
  if (module === "resources") {
    const r = row as Doc<"resources">;
    const privateStaff =
      wholeSchool(actor) ||
      (hasRole(actor, "Teacher") &&
        r.publishedBy === actor.user._id &&
        (await matchesAudience(ctx, actor, r.audiences, "teacher")));
    if (
      !privateStaff &&
      (r.status !== "Published" || !(await audience(ctx, actor, r.audiences, selected)))
    )
      return null;
    return record(r._id, r.title, r.description ?? "", r.category, r.status, {
      category: r.category,
      at: r.updatedAt,
      fields: [
        field("File", r.file.fileName),
        field("Size", `${r.file.size} bytes`),
        field("Type", r.file.contentType),
      ],
    });
  }
  if (module === "children" || module === "classLearners") {
    const l = row as Doc<"learners">;
    if (!seesLearner(actor, l) || (selected && l._id !== selected._id)) return null;
    const c = await ctx.db.get("classes", l.classId);
    const g = await ctx.db.get("grades", l.gradeId);
    const t = c?.homeroomTeacherId ? await ctx.db.get("users", c.homeroomTeacherId) : null;
    return record(
      l._id,
      `${l.firstName} ${l.lastName}`,
      t?.name ? `Class teacher: ${t.name}` : "Class teacher not provided",
      `${g?.name ?? ""} | ${c?.name ?? ""}`,
      l.status,
      {
        fields: [
          field("Learner number", l.learnerNumber),
          field("Preferred name", l.preferredName),
          field("Birth date", l.dateOfBirth),
          field("Class teacher", t?.name),
          field("Class", c?.name),
          field("Grade", g?.name),
        ],
      },
    );
  }
  if (module === "payments") {
    const c = row as Doc<"charges">;
    if (!financeAllowed(actor, c.learnerId) || (selected && selected._id !== c.learnerId))
      return null;
    const learner = await ctx.db.get("learners", c.learnerId);
    return record(
      c._id,
      c.title,
      c.description ?? "",
      learner ? `${learner.firstName} ${learner.lastName}` : "School charge",
      c.status,
      {
        at: c.dueAt,
        amountCents: c.amountCents,
        pending: c.status !== "Paid" && c.status !== "Cancelled",
      },
    );
  }
  if (module === "paymentHistory") {
    const p = row as Doc<"payments">;
    const c = await ctx.db.get("charges", p.chargeId);
    if (!c || !financeAllowed(actor, c.learnerId) || (selected && selected._id !== c.learnerId))
      return null;
    const receipt = await ctx.db
      .query("receipts")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", p._id))
      .first();
    const learner = await ctx.db.get("learners", c.learnerId);
    return record(
      p._id,
      c.title,
      "",
      `${learner ? `${learner.firstName} ${learner.lastName} | ` : ""}${p.provider}`,
      p.status,
      {
        at: p.completedAt ?? p._creationTime,
        amountCents: p.amountCents,
        fields: [
          field("Provider reference", p.providerReference),
          field("Receipt", receipt?.receiptNumber),
        ],
      },
    );
  }
  if (module === "forms") {
    const f = row as Doc<"consentRequests">;
    if (f.status !== "Open" || !(await audience(ctx, actor, f.audiences, selected))) return null;
    const family = selected ? [selected] : actor.learners;
    let pending = academic(actor) && !family.length;
    for (const l of family) {
      if (!(await matchesAudience(ctx, { ...actor, learners: [l] }, f.audiences, "guardian")))
        continue;
      const response = await ctx.db
        .query("consentResponses")
        .withIndex("by_consentRequestId_and_learnerId", (q) =>
          q.eq("consentRequestId", f._id).eq("learnerId", l._id),
        )
        .first();
      if (!response) pending = true;
    }
    return record(
      f._id,
      f.title,
      f.description,
      "Consent",
      pending ? "Awaiting response" : "Submitted",
      { at: f.dueAt, pending },
    );
  }
  if (module === "formResponses") {
    const r = row as Doc<"consentResponses">;
    const l = await ctx.db.get("learners", r.learnerId);
    if (!l || !seesLearner(actor, l) || (selected && l._id !== selected._id)) return null;
    const canSeeContact = staffForLearner(actor, l) || r.guardianId === actor.user._id;
    return record(
      r._id,
      `${l.firstName} ${l.lastName}`,
      canSeeContact ? (r.notes ?? "") : "",
      "Consent response",
      r.decision,
      {
        at: r.respondedAt,
        fields: canSeeContact ? [field("Emergency contact", r.contactPhone)] : [],
      },
    );
  }
  if (module === "contact") {
    const e = row as Doc<"enquiries">;
    if (!enquiryAllowed(actor, e) || (selected && e.learnerId !== selected._id)) return null;
    return record(e._id, e.subject, "", e.department, e.status, { at: e.lastMessageAt });
  }
  if (module === "enquiryMessages") {
    const m = row as Doc<"enquiryMessages">;
    const e = await ctx.db.get("enquiries", m.enquiryId);
    if (!e || !enquiryAllowed(actor, e) || (selected && e.learnerId !== selected._id)) return null;
    const staff =
      wholeSchool(actor) || (hasRole(actor, "Teacher") && e.assigneeId === actor.user._id);
    if (m.internal && !staff) return null;
    const author = await ctx.db.get("users", m.authorId);
    return record(
      m._id,
      author?.name ?? "School",
      m.body,
      "",
      m.internal ? "Internal note" : "Reply",
      { at: m._creationTime },
    );
  }
  if (module === "reports" || module === "conduct" || module === "attendanceMarks") {
    const r = row as Doc<"reports"> | Doc<"conductEntries"> | Doc<"attendanceMarks">;
    const l = await ctx.db.get("learners", r.learnerId);
    if (
      !l ||
      !seesLearner(actor, l) ||
      (selected && l._id !== selected._id) ||
      (args.classId && l.classId !== args.classId)
    )
      return null;
    const staff = staffForLearner(actor, l),
      name = `${l.firstName} ${l.lastName}`;
    if (module === "reports") {
      const report = r as Doc<"reports">;
      if (!staff && report.status !== "Released") return null;
      return record(report._id, report.title, "", `${name} | ${report.term}`, report.status, {
        at: report.releasedAt ?? null,
        fields: [field("Term", report.term), field("Document", report.file?.fileName)],
      });
    }
    if (module === "conduct") {
      const c = r as Doc<"conductEntries">;
      if (!staff && !c.visibleToGuardians) return null;
      return record(c._id, c.title, c.description ?? "", name, c.type, { at: c.occurredAt });
    }
    const m = r as Doc<"attendanceMarks">;
    return record(m._id, name, m.note ?? "", m.date, m.status, { fields: [field("Date", m.date)] });
  }
  if (module === "attendance") {
    const r = row as Doc<"attendanceRegisters">;
    if (!wholeSchool(actor) && !actor.teachingClasses.some((c) => c._id === r.classId)) return null;
    const c = await ctx.db.get("classes", r.classId);
    return record(r._id, c?.name ?? "Class register", "", r.date, r.status, {
      fields: [field("Date", r.date), field("Class", c?.name)],
    });
  }
  if (module === "timetable") {
    const p = row as Doc<"timetablePeriods">;
    if (
      selected
        ? p.classId !== selected.classId
        : !wholeSchool(actor) && !actor.teachingClasses.some((c) => c._id === p.classId)
    )
      return null;
    const teacher = p.teacherId ? await ctx.db.get("users", p.teacherId) : null;
    const clock = (m: number) =>
      `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    return record(
      p._id,
      p.subject,
      "",
      `${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][p.weekday % 7]} ${clock(p.startMinute)}-${clock(p.endMinute)}`,
      "Scheduled",
      { fields: [field("Teacher", teacher?.name), field("Room", p.room)] },
    );
  }
  if (module === "classes") {
    const c = row as Doc<"classes">;
    if (!wholeSchool(actor) && !actor.teachingClasses.some((own) => own._id === c._id)) return null;
    return record(c._id, c.name, "", "Class", String(c.year));
  }
  if (module === "groups") {
    const g = row as Doc<"groups">;
    if (
      !wholeSchool(actor) &&
      !(await ctx.db
        .query("groupMembers")
        .withIndex("by_groupId_and_userId", (q) =>
          q.eq("groupId", g._id).eq("userId", actor.user._id),
        )
        .first())
    )
      return null;
    return record(g._id, g.name, g.description ?? "", "School group");
  }
  if (module === "people") {
    const u = row as Doc<"users">;
    const roles = await ctx.db
      .query("staffRoles")
      .withIndex("by_userId", (q) => q.eq("userId", u._id))
      .take(5);
    return record(
      u._id,
      u.name ?? "School account",
      u.email ?? "",
      roles.map((r) => r.role).join(" | "),
      u.status ?? "Active",
      { fields: [field("Email", u.email), field("Phone", u.phone)] },
    );
  }
  if (module === "audit") {
    const a = row as Doc<"auditLog">;
    const user = a.actorId ? await ctx.db.get("users", a.actorId) : null;
    return record(a._id, a.action, a.summary ?? "", user?.name ?? "System", "Recorded", {
      at: a._creationTime,
      fields: [field("Table", a.targetTable), field("Record", a.targetId)],
    });
  }
  if (module === "home" || module === "settings") {
    const s = row as Doc<"schools">;
    return record(s._id, s.name, s.tagline, s.currentTerm, "Connected", {
      fields: [
        field("Timezone", s.timezone),
        field("Currency", s.currency),
        field("Email", s.contactEmail),
        field("Phone", s.contactPhone),
        ...(module === "settings"
          ? Object.entries(s.featureFlags).map(([name, enabled]) =>
              field(name, enabled ? "Enabled" : "Disabled"),
            )
          : []),
      ],
    });
  }
  return null;
}

export async function readPage(
  ctx: QueryCtx,
  actor: Actor,
  args: ReadInput,
  options: PaginationOptions,
): Promise<PaginationResult<ModuleRecord>> {
  if (!Number.isInteger(options.numItems) || options.numItems < 1 || options.numItems > 50)
    throw new Error("Choose between 1 and 50 records.");
  const selected = await guardRead(ctx, actor, args);
  let result: PaginationResult<Doc<TableNames>>;
  const { module, learnerId, parentId, classId, category } = args;
  switch (module) {
    case "invitations":
      result = await ctx.db
        .query("invitations")
        .withIndex("by_status_and_expiresAt")
        .order("desc")
        .paginate(options);
      break;
    case "noticeReceipts":
      result = await ctx.db
        .query("noticeReceipts")
        .withIndex("by_noticeId", (q) => q.eq("noticeId", normalize(ctx, "notices", parentId!)))
        .paginate(options);
      break;
    case "messages":
      if (args.manage) {
        result = await ctx.db
          .query("notices")
          .withIndex("by_status_and_publishedAt")
          .order("desc")
          .paginate(options);
        break;
      }
      if (category && !NOTICE_CATEGORIES.includes(category as (typeof NOTICE_CATEGORIES)[number]))
        throw new Error("Unknown category.");
      result = category
        ? await ctx.db
            .query("notices")
            .withIndex("by_status_and_category_and_publishedAt", (q) =>
              q
                .eq("status", "Published")
                .eq("category", category as (typeof NOTICE_CATEGORIES)[number]),
            )
            .order("desc")
            .paginate(options)
        : await ctx.db
            .query("notices")
            .withIndex("by_status_and_publishedAt", (q) => q.eq("status", "Published"))
            .order("desc")
            .paginate(options);
      break;
    case "calendar":
      if (args.manage) {
        result = await ctx.db.query("events").withIndex("by_status_and_startsAt").paginate(options);
        break;
      }
      result = await ctx.db
        .query("events")
        .withIndex("by_status_and_startsAt", (q) =>
          args.to !== undefined
            ? q.eq("status", "Scheduled").lt("startsAt", args.to)
            : q.eq("status", "Scheduled"),
        )
        .paginate(options);
      break;
    case "resources":
      if (args.manage) {
        result = await ctx.db
          .query("resources")
          .withIndex("by_status_and_category")
          .paginate(options);
        break;
      }
      if (
        category &&
        !RESOURCE_CATEGORIES.includes(category as (typeof RESOURCE_CATEGORIES)[number])
      )
        throw new Error("Unknown category.");
      result = await ctx.db
        .query("resources")
        .withIndex("by_status_and_category", (q) =>
          category
            ? q
                .eq("status", "Published")
                .eq("category", category as (typeof RESOURCE_CATEGORIES)[number])
            : q.eq("status", "Published"),
        )
        .paginate(options);
      break;
    case "children":
      if (!academic(actor)) {
        const links = await ctx.db
          .query("guardianLinks")
          .withIndex("by_guardianId", (q) => q.eq("guardianId", actor.user._id))
          .paginate(options);
        const page = [];
        for (const link of links.page) {
          const l = await ctx.db.get("learners", link.learnerId);
          if (l) page.push(l);
        }
        result = { ...links, page };
      } else
        result = classId
          ? await ctx.db
              .query("learners")
              .withIndex("by_classId_and_status", (q) =>
                q.eq("classId", classId).eq("status", "Active"),
              )
              .paginate(options)
          : await ctx.db.query("learners").withIndex("by_learnerNumber").paginate(options);
      break;
    case "classLearners":
      result = await ctx.db
        .query("learners")
        .withIndex("by_classId_and_status", (q) =>
          q.eq("classId", normalize(ctx, "classes", parentId!)).eq("status", "Active"),
        )
        .paginate(options);
      break;
    case "payments":
      result = learnerId
        ? await ctx.db
            .query("charges")
            .withIndex("by_learnerId_and_status", (q) => q.eq("learnerId", learnerId))
            .paginate(options)
        : await ctx.db.query("charges").withIndex("by_status_and_dueAt").paginate(options);
      break;
    case "paymentHistory":
      result = parentId
        ? await ctx.db
            .query("payments")
            .withIndex("by_chargeId", (q) => q.eq("chargeId", normalize(ctx, "charges", parentId)))
            .order("desc")
            .paginate(options)
        : await ctx.db.query("payments").withIndex("by_status").order("desc").paginate(options);
      break;
    case "forms":
      result = await ctx.db
        .query("consentRequests")
        .withIndex("by_status_and_dueAt", (q) => q.eq("status", "Open"))
        .paginate(options);
      break;
    case "formResponses":
      result = await ctx.db
        .query("consentResponses")
        .withIndex("by_consentRequestId", (q) =>
          q.eq("consentRequestId", normalize(ctx, "consentRequests", parentId!)),
        )
        .paginate(options);
      break;
    case "contact":
      result = academic(actor)
        ? await ctx.db
            .query("enquiries")
            .withIndex("by_status_and_lastMessageAt")
            .order("desc")
            .paginate(options)
        : await ctx.db
            .query("enquiries")
            .withIndex("by_createdBy_and_lastMessageAt", (q) => q.eq("createdBy", actor.user._id))
            .order("desc")
            .paginate(options);
      break;
    case "enquiryMessages":
      result = await ctx.db
        .query("enquiryMessages")
        .withIndex("by_enquiryId", (q) => q.eq("enquiryId", normalize(ctx, "enquiries", parentId!)))
        .order("desc")
        .paginate(options);
      break;
    case "reports":
      result = learnerId
        ? await ctx.db
            .query("reports")
            .withIndex("by_learnerId_and_status", (q) => q.eq("learnerId", learnerId))
            .paginate(options)
        : await ctx.db
            .query("reports")
            .withIndex("by_term_and_status")
            .order("desc")
            .paginate(options);
      break;
    case "conduct":
      result = learnerId
        ? await ctx.db
            .query("conductEntries")
            .withIndex("by_learnerId_and_occurredAt", (q) => q.eq("learnerId", learnerId))
            .order("desc")
            .paginate(options)
        : await ctx.db.query("conductEntries").withIndex("by_authorId").paginate(options);
      break;
    case "attendance":
      result = classId
        ? await ctx.db
            .query("attendanceRegisters")
            .withIndex("by_classId_and_date", (q) => q.eq("classId", classId))
            .order("desc")
            .paginate(options)
        : await ctx.db
            .query("attendanceRegisters")
            .withIndex("by_date_and_status")
            .order("desc")
            .paginate(options);
      break;
    case "attendanceMarks":
      result = learnerId
        ? await ctx.db
            .query("attendanceMarks")
            .withIndex("by_learnerId_and_date", (q) => q.eq("learnerId", learnerId))
            .order("desc")
            .paginate(options)
        : await ctx.db
            .query("attendanceMarks")
            .withIndex("by_registerId", (q) =>
              q.eq("registerId", normalize(ctx, "attendanceRegisters", parentId!)),
            )
            .paginate(options);
      break;
    case "timetable":
      result = await ctx.db
        .query("timetablePeriods")
        .withIndex("by_classId_and_weekday_and_startMinute", (q) =>
          q.eq("classId", selected?.classId ?? classId!),
        )
        .paginate(options);
      break;
    case "classes":
      result = await ctx.db.query("classes").withIndex("by_year_and_name").paginate(options);
      break;
    case "groups":
      result = await ctx.db.query("groups").withIndex("by_name").paginate(options);
      break;
    case "people":
      result = await ctx.db.query("users").withIndex("email").paginate(options);
      break;
    case "audit":
      result = await ctx.db.query("auditLog").order("desc").paginate(options);
      break;
    case "home":
    case "settings":
      result = await ctx.db.query("schools").paginate(options);
      break;
    case "ads":
      result = wholeSchool(actor)
        ? await ctx.db.query("ads").withIndex("by_updatedAt").order("desc").paginate(options)
        : await ctx.db
            .query("ads")
            .withIndex("by_createdBy_and_updatedAt", (q) => q.eq("createdBy", actor.user._id))
            .order("desc")
            .paginate(options);
      break;
    default:
      return { page: [], isDone: true, continueCursor: "" };
  }
  const page: ModuleRecord[] = [];
  for (const row of result.page) {
    const r = await project(ctx, actor, args, row, selected);
    if (!r) continue;
    if (
      args.search &&
      !`${r.title} ${r.body} ${r.subtitle}`.toLowerCase().includes(args.search.trim().toLowerCase())
    )
      continue;
    if (
      args.category &&
      module !== "resources" &&
      (module !== "messages" || args.manage) &&
      r.category !== args.category
    )
      continue;
    if (args.outstandingOnly && !r.pending) continue;
    page.push(r);
  }
  return { ...result, page };
}

export async function readDetail(
  ctx: QueryCtx,
  actor: Actor,
  args: ReadInput,
  itemId: string,
): Promise<RecordDetail> {
  const selected = await guardRead(ctx, actor, args);
  const table = tables[args.module];
  if (!table) missing();
  const id = normalize(ctx, table, itemId);
  const row = await ctx.db.get(table, id);
  if (!row) missing();
  const r = await project(ctx, actor, args, row, selected);
  if (!r) denied();
  const related: RecordDetail["related"] = [];
  if (args.module === "children" || args.module === "classLearners")
    for (const [module, title] of [
      ["reports", "Reports"],
      ["conduct", "Conduct"],
      ["attendanceMarks", "Attendance"],
      ["timetable", "Timetable"],
    ] as const)
      related.push({ module, title, learnerId: r.id });
  if (args.module === "messages" && canManageNotice(actor, row as Doc<"notices">))
    related.push({
      module: "noticeReceipts",
      title: "Read & acknowledgement receipts",
      parentId: r.id,
    });
  if (args.module === "payments")
    related.push({ module: "paymentHistory", title: "Payment history", parentId: r.id });
  if (args.module === "contact")
    related.push({ module: "enquiryMessages", title: "Conversation", parentId: r.id });
  if (args.module === "attendance")
    related.push({ module: "attendanceMarks", title: "Register marks", parentId: r.id });
  if (args.module === "classes")
    related.push({ module: "classLearners", title: "Class learners", parentId: r.id });
  if (args.module === "forms")
    related.push({ module: "formResponses", title: "Responses", parentId: r.id });
  return { record: r, related };
}
