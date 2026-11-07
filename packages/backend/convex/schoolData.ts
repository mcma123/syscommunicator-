import { v } from "convex/values";
import { SCHOOL_MODULES } from "@school-connect/core/permissions";
import type { ModuleRecord, ModulePage } from "@school-connect/core/live";
import type { Doc, Id } from "./_generated/dataModel";
import { authedQuery } from "./lib/functions";
import { requireModule, requireLearnerAccess, wholeSchool, hasRole, type Actor } from "./lib/auth";
import { canReadNotice, matchesAudience } from "./lib/audiences";
import { literals } from "./validators";
import type { QueryCtx } from "./_generated/server";

export const recordValidator = v.object({
  id: v.string(),
  title: v.string(),
  body: v.string(),
  subtitle: v.string(),
  status: v.string(),
  at: v.union(v.number(), v.null()),
  amountCents: v.union(v.number(), v.null()),
  read: v.boolean(),
  acknowledged: v.boolean(),
  canAcknowledge: v.boolean(),
  canMarkRead: v.optional(v.boolean()),
  category: v.optional(v.string()),
  endsAt: v.optional(v.number()),
  allDay: v.optional(v.boolean()),
  pending: v.optional(v.boolean()),
  requiresAcknowledgement: v.optional(v.boolean()),
  fields: v.optional(v.array(v.object({ label: v.string(), value: v.string() }))),
});
export const pageValidator = v.object({
  records: v.array(recordValidator),
  truncated: v.boolean(),
});
const CAP = 50;
function record(
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
async function audienceAllowed(
  ctx: QueryCtx,
  actor: Actor,
  audiences: Doc<"notices">["audiences"],
) {
  return (
    wholeSchool(actor) ||
    (await matchesAudience(ctx, actor, audiences, "guardian")) ||
    (await matchesAudience(ctx, actor, audiences, "teacher"))
  );
}
async function scopedLearners(ctx: QueryCtx, actor: Actor): Promise<Doc<"learners">[]> {
  if (wholeSchool(actor))
    return ctx.db
      .query("learners")
      .withIndex("by_learnerNumber")
      .take(CAP + 1);
  const learners = new Map(actor.learners.map((l) => [l._id, l]));
  if (hasRole(actor, "Teacher"))
    for (const classroom of actor.teachingClasses) {
      const rows = await ctx.db
        .query("learners")
        .withIndex("by_classId_and_status", (q) =>
          q.eq("classId", classroom._id).eq("status", "Active"),
        )
        .take(CAP + 1);
      for (const row of rows) learners.set(row._id, row);
      if (learners.size > CAP) break;
    }
  return [...learners.values()];
}

/** Small bounded module pages. Full search, history and list pagination land in Phase 6. */
export const list = authedQuery({
  args: { module: literals(SCHOOL_MODULES), learnerId: v.optional(v.id("learners")) },
  returns: pageValidator,
  handler: async (ctx, { module, learnerId }): Promise<ModulePage> => {
    requireModule(ctx.actor, module);
    if (
      learnerId &&
      !(module === "payments" && (wholeSchool(ctx.actor) || hasRole(ctx.actor, "Finance")))
    )
      await requireLearnerAccess(ctx, learnerId, ctx.actor);
    const actor: Actor = learnerId
      ? { ...ctx.actor, learners: ctx.actor.learners.filter((l) => l._id === learnerId) }
      : ctx.actor;
    const records: ModuleRecord[] = [];
    let truncated = false;
    const bounded = <T>(rows: T[]) => {
      if (rows.length > CAP) truncated = true;
      return rows.slice(0, CAP);
    };
    if (module === "home" || module === "settings") {
      const school = await ctx.db.query("schools").first();
      if (school)
        records.push(
          record(school._id, school.name, school.tagline, school.currentTerm, "Connected"),
        );
    } else if (module === "messages") {
      const rows = await ctx.db
        .query("notices")
        .withIndex("by_status_and_publishedAt", (q) => q.eq("status", "Published"))
        .order("desc")
        .take(CAP + 1);
      for (const n of bounded(rows))
        if (await canReadNotice(ctx, actor, n)) {
          const receipt = await ctx.db
            .query("noticeReceipts")
            .withIndex("by_noticeId_and_guardianId", (q) =>
              q.eq("noticeId", n._id).eq("guardianId", actor.user._id),
            )
            .unique();
          const author = await ctx.db.get("users", n.authorId);
          records.push(
            record(
              n._id,
              n.title,
              n.body,
              `${n.category} · ${author?.name ?? "School"}`,
              n.status,
              {
                at: n.publishedAt ?? null,
                read: !!receipt?.readAt,
                acknowledged: !!receipt?.acknowledgedAt,
                canAcknowledge: await matchesAudience(ctx, actor, n.audiences, "guardian"),
              },
            ),
          );
        }
    } else if (module === "calendar") {
      const rows = await ctx.db
        .query("events")
        .withIndex("by_status_and_startsAt", (q) => q.eq("status", "Scheduled"))
        .take(CAP + 1);
      for (const e of bounded(rows))
        if (await audienceAllowed(ctx, actor, e.audiences))
          records.push(
            record(e._id, e.title, e.description ?? "", e.location, e.status, { at: e.startsAt }),
          );
    } else if (module === "resources") {
      const rows = await ctx.db
        .query("resources")
        .withIndex("by_status_and_category", (q) => q.eq("status", "Published"))
        .take(CAP + 1);
      for (const r of bounded(rows))
        if (await audienceAllowed(ctx, actor, r.audiences))
          records.push(
            record(
              r._id,
              r.title,
              r.description ?? "",
              `${r.category} · ${r.file.fileName}`,
              r.status,
            ),
          );
    } else if (module === "children") {
      const rows = learnerId
        ? [await requireLearnerAccess(ctx, learnerId, actor)]
        : await scopedLearners(ctx, actor);
      for (const l of bounded(rows)) {
        const classroom = await ctx.db.get("classes", l.classId);
        const grade = await ctx.db.get("grades", l.gradeId);
        const teacher = classroom?.homeroomTeacherId
          ? await ctx.db.get("users", classroom.homeroomTeacherId)
          : null;
        records.push(
          record(
            l._id,
            `${l.firstName} ${l.lastName}`,
            teacher?.name ? `Class teacher: ${teacher.name}` : "Class teacher to be confirmed",
            `${grade?.name ?? ""} · ${classroom?.name ?? ""}`,
            l.status,
          ),
        );
      }
    } else if (module === "payments") {
      const rows: Doc<"charges">[] = [];
      if (wholeSchool(actor) || hasRole(actor, "Finance")) {
        if (learnerId)
          rows.push(
            ...(await ctx.db
              .query("charges")
              .withIndex("by_learnerId_and_status", (q) => q.eq("learnerId", learnerId))
              .take(CAP + 1)),
          );
        else
          rows.push(
            ...(await ctx.db
              .query("charges")
              .withIndex("by_status_and_dueAt")
              .take(CAP + 1)),
          );
      } else
        for (const l of actor.learners)
          rows.push(
            ...(await ctx.db
              .query("charges")
              .withIndex("by_learnerId_and_status", (q) => q.eq("learnerId", l._id))
              .take(CAP + 1)),
          );
      for (const c of bounded(rows))
        records.push(
          record(c._id, c.title, c.description ?? "", "School charge", c.status, {
            at: c.dueAt,
            amountCents: c.amountCents,
          }),
        );
    } else if (module === "forms") {
      const rows = await ctx.db
        .query("consentRequests")
        .withIndex("by_status_and_dueAt", (q) => q.eq("status", "Open"))
        .take(CAP + 1);
      for (const f of bounded(rows))
        if (await audienceAllowed(ctx, actor, f.audiences))
          records.push(
            record(f._id, f.title, f.description, "Consent request", f.status, { at: f.dueAt }),
          );
    } else if (module === "contact") {
      const rows = wholeSchool(actor)
        ? await ctx.db
            .query("enquiries")
            .withIndex("by_status_and_lastMessageAt")
            .order("desc")
            .take(CAP + 1)
        : await ctx.db
            .query("enquiries")
            .withIndex("by_createdBy_and_lastMessageAt", (q) => q.eq("createdBy", actor.user._id))
            .order("desc")
            .take(CAP + 1);
      for (const e of bounded(rows)) {
        const messages = await ctx.db
          .query("enquiryMessages")
          .withIndex("by_enquiryId", (q) => q.eq("enquiryId", e._id))
          .order("desc")
          .take(21);
        if (messages.length > 20) truncated = true;
        const body = messages
          .slice(0, 20)
          .filter((m) => !m.internal || wholeSchool(actor))
          .reverse()
          .map((m) => m.body)
          .join("\n\n");
        records.push(
          record(e._id, e.subject, body, e.department, e.status, { at: e.lastMessageAt }),
        );
      }
    } else if (module === "reports" || module === "conduct" || module === "attendance") {
      const learners = bounded(
        learnerId
          ? [await requireLearnerAccess(ctx, learnerId, actor)]
          : await scopedLearners(ctx, actor),
      );

      // A bounded preview per learner avoids fetching an unbounded class history.
      for (const l of learners) {
        const staff =
          wholeSchool(actor) ||
          (hasRole(actor, "Teacher") && actor.teachingClasses.some((c) => c._id === l.classId));
        if (module === "reports") {
          const rows = await ctx.db
            .query("reports")
            .withIndex("by_learnerId_and_status", (q) => q.eq("learnerId", l._id))
            .take(11);
          if (rows.length > 10) truncated = true;
          for (const r of rows.slice(0, 10))
            if (staff || r.status === "Released")
              records.push(
                record(r._id, r.title, "", `${l.firstName} ${l.lastName} · ${r.term}`, r.status, {
                  at: r.releasedAt ?? null,
                }),
              );
        } else if (module === "conduct") {
          const rows = await ctx.db
            .query("conductEntries")
            .withIndex("by_learnerId_and_occurredAt", (q) => q.eq("learnerId", l._id))
            .order("desc")
            .take(11);
          if (rows.length > 10) truncated = true;
          for (const r of rows.slice(0, 10))
            if (staff || r.visibleToGuardians)
              records.push(
                record(
                  r._id,
                  r.title,
                  r.description ?? "",
                  `${l.firstName} ${l.lastName}`,
                  r.type,
                  { at: r.occurredAt },
                ),
              );
        } else {
          const rows = await ctx.db
            .query("attendanceMarks")
            .withIndex("by_learnerId_and_date", (q) => q.eq("learnerId", l._id))
            .order("desc")
            .take(11);
          if (rows.length > 10) truncated = true;
          for (const r of rows.slice(0, 10))
            records.push(
              record(r._id, `${l.firstName} ${l.lastName}`, r.note ?? "", r.date, r.status),
            );
        }
        if (records.length > CAP) {
          truncated = true;
          break;
        }
      }
    } else if (module === "groups") {
      if (wholeSchool(actor)) {
        const rows = await ctx.db
          .query("groups")
          .withIndex("by_name")
          .take(CAP + 1);
        for (const g of bounded(rows))
          records.push(record(g._id, g.name, g.description ?? "", "School group"));
      } else {
        for (const c of bounded(actor.teachingClasses))
          records.push(record(c._id, c.name, "", "Assigned class"));
        const rows = await ctx.db
          .query("groupMembers")
          .withIndex("by_userId", (q) => q.eq("userId", actor.user._id))
          .take(CAP + 1);
        for (const member of bounded(rows)) {
          const group = await ctx.db.get("groups", member.groupId);
          if (group) records.push(record(group._id, group.name, group.description ?? "", "Member"));
        }
      }
    } else if (module === "people") {
      for (const user of bounded(
        await ctx.db
          .query("users")
          .withIndex("email")
          .take(CAP + 1),
      ))
        records.push(
          record(
            user._id,
            user.name ?? "School account",
            user.email ?? "",
            "Account",
            user.status ?? "Active",
          ),
        );
    } else if (module === "audit") {
      for (const a of bounded(
        await ctx.db
          .query("auditLog")
          .withIndex("by_action")
          .take(CAP + 1),
      ))
        records.push(
          record(a._id, a.action, "", a.targetTable, "Recorded", { at: a._creationTime }),
        );
    }
    return { records: records.slice(0, CAP), truncated: truncated || records.length > CAP };
  },
});
