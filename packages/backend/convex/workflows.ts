import { queueNotifications } from "./lib/notificationQueue";
import { targetId } from "./schoolRead";
import { v } from "convex/values";
import { WORKFLOW_ACTIONS } from "@school-connect/core/workflows";
import {
  NOTICE_CATEGORIES,
  CONSENT_DECISIONS,
  DEPARTMENTS,
  ATTENDANCE_STATUSES,
  CONDUCT_TYPES,
  STAFF_ROLES,
} from "@school-connect/core/domain";
import { authedMutation, authedAction, type AuthedMutationCtx } from "./lib/functions";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { literals } from "./validators";
import {
  loadActor,
  requireActor,
  requireModule,
  requireGuardianOf,
  requireTeacherOf,
  wholeSchool,
  hasRole,
  denied,
  missing,
  type Actor,
} from "./lib/auth";
import { matchesAudience, canReadNotice } from "./lib/audiences";
import { enquiryAllowed } from "./lib/read";
import { writeAudit } from "./lib/audit";
import {
  text,
  option,
  toggle,
  date,
  instant,
  id,
  get,
  invalid,
  administrator,
  academic,
  learnerWriter,
  audiences,
  keys,
  FEATURE_MODULES,
} from "./lib/workflowRules";
const input = {
  action: literals(WORKFLOW_ACTIONS),
  itemId: v.optional(targetId),
  values: v.record(v.string(), v.string()),
};
async function publisher(ctx: MutationCtx, userId: Id<"users">): Promise<Actor | null> {
  const user = await ctx.db.get("users", userId);
  if (!user || user.status !== "Active") return null;
  const actor = await loadActor(ctx, user);
  return !actor.disabledModules?.includes("messages") && wholeSchool(actor) ? actor : null;
}
async function published(ctx: MutationCtx, notice: Doc<"notices">, actor: Actor, revision: number) {
  await ctx.db.patch("notices", notice._id, {
    status: "Published",
    publishedAt: Date.now(),
    publishAt: undefined,
    reviewedBy: actor.user._id,
    publicationActorId: actor.user._id,
    revision,
    updatedAt: Date.now(),
  });
  await writeAudit(ctx, actor, "notice.published", "notices", notice._id);
  await ctx.scheduler.runAfter(0, internal.workflows.receipts, {
    noticeId: notice._id,
    revision,
    cursor: null,
  });
}
export const publishScheduled = internalMutation({
  args: { noticeId: v.id("notices"), revision: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const notice = await ctx.db.get("notices", args.noticeId);
    if (
      !notice ||
      notice.status !== "Scheduled" ||
      notice.revision !== args.revision ||
      !notice.publishAt ||
      notice.publishAt > Date.now()
    )
      return null;
    const actor = notice.publicationActorId
      ? await publisher(ctx, notice.publicationActorId)
      : null;
    if (!actor) {
      await ctx.db.patch("notices", notice._id, {
        status: "Review",
        publishAt: undefined,
        updatedAt: Date.now(),
      });
      await ctx.db.insert("auditLog", {
        action: "notice.scheduleBlocked",
        targetTable: "notices",
        targetId: notice._id,
        summary: "Publishing authority is no longer active.",
      });
      return null;
    }
    await published(ctx, notice, actor, args.revision);
    return null;
  },
});
export const receipts = internalMutation({
  args: { noticeId: v.id("notices"), revision: v.number(), cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const n = await ctx.db.get("notices", args.noticeId);
    if (!n || n.status !== "Published" || n.revision !== args.revision) return null;
    const user = n.publicationActorId ? await ctx.db.get("users", n.publicationActorId) : null;
    if (!user) return null;
    const actor: Actor = { user, roles: [], learners: [], teachingClasses: [] };
    const users = await ctx.db
      .query("users")
      .withIndex("email")
      .paginate({ numItems: 25, cursor: args.cursor });
    let created = 0;
    for (const user of users.page) {
      if (user.status !== "Active") continue;
      const links = await ctx.db
        .query("guardianLinks")
        .withIndex("by_guardianId", (q) => q.eq("guardianId", user._id))
        .take(21);
      if (links.length > 20) continue;
      const learners: Doc<"learners">[] = [];
      for (const link of links) {
        const l = await ctx.db.get("learners", link.learnerId);
        if (l?.status === "Active") learners.push(l);
      }
      if (
        !(await matchesAudience(
          ctx,
          { user, learners, roles: [], teachingClasses: [] },
          n.audiences,
          "guardian",
        ))
      )
        continue;
      const prior = await ctx.db
        .query("noticeReceipts")
        .withIndex("by_noticeId_and_guardianId", (q) =>
          q.eq("noticeId", n._id).eq("guardianId", user._id),
        )
        .unique();
      if (!prior) {
        await ctx.db.insert("noticeReceipts", {
          noticeId: n._id,
          guardianId: user._id,
          deliveredAt: Date.now(),
        });
        created++;
      }
      await queueNotifications(ctx, user._id, n);
    }
    if (created)
      await writeAudit(
        ctx,
        actor,
        "notice.receiptsCreated",
        "notices",
        n._id,
        JSON.stringify({ created }),
      );
    if (!users.isDone)
      await ctx.scheduler.runAfter(0, internal.workflows.receipts, {
        ...args,
        cursor: users.continueCursor,
      });
    return null;
  },
});
export const submit = authedMutation({
  args: input,
  returns: targetId,
  handler: async (ctx, { action, itemId, values: s }) => {
    const actor = ctx.actor,
      now = Date.now();
    if (action.startsWith("notice")) {
      requireModule(actor, "messages");
      academic(actor);
      if (action === "noticeSave") {
        keys(s, ["title", "body", "category", "audience", "urgent", "requiresAcknowledgement"]);
        const data = {
          title: text(s, "title"),
          body: text(s, "body", 10000),
          category: option(s, "category", NOTICE_CATEGORIES),
          audiences: await audiences(ctx, actor, text(s, "audience", 6000)),
          urgent: toggle(s, "urgent"),
          requiresAcknowledgement: toggle(s, "requiresAcknowledgement"),
          updatedAt: now,
        };
        if (itemId) {
          const n = await get(ctx, "notices", itemId);
          if (
            n.status !== "Draft" ||
            (!wholeSchool(actor) && n.authorId !== actor.user._id) ||
            !(await canReadNotice(ctx, actor, n))
          )
            denied();
          await ctx.db.patch("notices", n._id, data);
          await ctx.audit("notice.draftEdited", "notices", n._id);
          return n._id;
        }
        const created = await ctx.db.insert("notices", {
          ...data,
          status: "Draft",
          authorId: actor.user._id,
          attachments: [],
          revision: 0,
        });
        await ctx.audit("notice.draftCreated", "notices", created);
        return created;
      }
      const n = await get(ctx, "notices", itemId);
      if (!(await canReadNotice(ctx, actor, n))) denied();
      keys(s, action === "noticeSchedule" ? ["publishAt"] : []);
      const revision = (n.revision ?? 0) + 1;
      if (action === "noticeReview") {
        if (n.status !== "Draft" || (!wholeSchool(actor) && n.authorId !== actor.user._id))
          denied();
        await ctx.db.patch("notices", n._id, { status: "Review", revision, updatedAt: now });
      } else {
        if (!wholeSchool(actor)) denied();
        if (action === "noticeReturn") {
          if (!["Review", "Scheduled"].includes(n.status))
            invalid("This notice cannot return to draft.");
          await ctx.db.patch("notices", n._id, {
            status: "Draft",
            publishAt: undefined,
            revision,
            updatedAt: now,
          });
        } else if (action === "noticeArchive") {
          if (n.status !== "Published") invalid("Only a published notice can be archived.");
          await ctx.db.patch("notices", n._id, { status: "Archived", revision, updatedAt: now });
        } else {
          if (n.status !== "Review") invalid("Submit the notice for review first.");
          await audiences(ctx, actor, JSON.stringify(n.audiences));
          if (action === "noticePublish") {
            await published(ctx, n, actor, revision);
            await ctx.audit("notice.reviewApproved", "notices", n._id);
            return n._id;
          }
          if (action !== "noticeSchedule") invalid("Unknown notice action.");
          const publishAt = instant(s, "publishAt");
          if (publishAt <= now) invalid("Choose a future publication time.");
          await ctx.db.patch("notices", n._id, {
            status: "Scheduled",
            publishAt,
            reviewedBy: actor.user._id,
            publicationActorId: actor.user._id,
            revision,
            updatedAt: now,
          });
          await ctx.scheduler.runAt(publishAt, internal.workflows.publishScheduled, {
            noticeId: n._id,
            revision,
          });
        }
      }
      await ctx.audit(action, "notices", n._id);
      return n._id;
    }
    if (action === "eventSave" || action === "eventCancel") {
      requireModule(actor, "calendar");
      academic(actor);
      const prior = itemId ? await get(ctx, "events", itemId) : null;
      if (prior && !wholeSchool(actor) && prior.createdBy !== actor.user._id) denied();
      if (prior) await audiences(ctx, actor, JSON.stringify(prior.audiences));
      if (action === "eventCancel") {
        keys(s, []);
        if (!prior) missing();
        await audiences(ctx, actor, JSON.stringify(prior.audiences));
        await ctx.db.patch("events", prior._id, { status: "Cancelled", updatedAt: now });
        await ctx.audit("event.cancelled", "events", prior._id);
        return prior._id;
      }
      keys(s, [
        "title",
        "description",
        "category",
        "audience",
        "startsAt",
        "endsAt",
        "allDay",
        "location",
      ]);
      const startsAt = instant(s, "startsAt"),
        endsAt = instant(s, "endsAt"),
        allDay = toggle(s, "allDay");
      if (endsAt <= startsAt) invalid("The event must end after it starts.");
      if (allDay && (s.startsAt.slice(-5) !== "00:00" || s.endsAt.slice(-5) !== "00:00"))
        invalid("All-day events use midnight and an exclusive end date.");
      const data = {
        title: text(s, "title"),
        description: text(s, "description", 10000, true),
        category: option(s, "category", NOTICE_CATEGORIES),
        audiences: await audiences(ctx, actor, text(s, "audience", 6000)),
        startsAt,
        endsAt,
        allDay,
        location: text(s, "location"),
        updatedAt: now,
      };
      const target = prior
        ? prior._id
        : await ctx.db.insert("events", {
            ...data,
            status: "Scheduled",
            createdBy: actor.user._id,
          });
      if (prior) {
        if (prior.status !== "Scheduled") invalid("Cancelled events cannot be edited.");
        await ctx.db.patch("events", target, data);
      }
      await ctx.audit(prior ? "event.edited" : "event.created", "events", target);
      return target;
    }
    if (action === "consentCreate") {
      requireModule(actor, "forms");
      academic(actor);
      keys(s, ["title", "description", "audience", "dueAt"]);
      const dueAt = instant(s, "dueAt");
      if (dueAt <= now) invalid("Choose a future response deadline.");
      const target = await ctx.db.insert("consentRequests", {
        title: text(s, "title"),
        description: text(s, "description", 10000),
        audiences: await audiences(ctx, actor, text(s, "audience", 6000)),
        dueAt,
        status: "Open",
        createdBy: actor.user._id,
      });
      await ctx.audit("consent.created", "consentRequests", target);
      return target;
    }
    if (action === "consentRespond") {
      requireModule(actor, "forms");
      keys(s, ["learnerId", "decision", "contactPhone", "notes"]);
      const f = await get(ctx, "consentRequests", itemId);
      const l = await requireGuardianOf(ctx, id(ctx, "learners", s.learnerId), actor);
      if (f.status !== "Open" || f.dueAt <= now)
        invalid("The consent deadline has passed or the request is closed.");
      if (!(await matchesAudience(ctx, { ...actor, learners: [l] }, f.audiences, "guardian")))
        denied();
      const contactPhone = text(s, "contactPhone", 30);
      if (
        !/^[+\d][\d ()-]{6,29}$/.test(contactPhone) ||
        contactPhone.replace(/\D/g, "").length < 7 ||
        contactPhone.replace(/\D/g, "").length > 15
      )
        invalid("Enter a valid contact phone number.");
      const prior = await ctx.db
        .query("consentResponses")
        .withIndex("by_consentRequestId_and_learnerId", (q) =>
          q.eq("consentRequestId", f._id).eq("learnerId", l._id),
        )
        .unique();
      if (prior && prior.guardianId !== actor.user._id)
        invalid("Another guardian has already responded. Contact the school to correct it.");
      const data = {
        decision: option(s, "decision", CONSENT_DECISIONS),
        contactPhone,
        notes: text(s, "notes", 2000, true),
        respondedAt: now,
      };
      const target = prior
        ? prior._id
        : await ctx.db.insert("consentResponses", {
            ...data,
            consentRequestId: f._id,
            learnerId: l._id,
            guardianId: actor.user._id,
          });
      if (prior) await ctx.db.patch("consentResponses", target, data);
      await ctx.audit(
        prior ? "consent.corrected" : "consent.responded",
        "consentResponses",
        target,
      );
      return target;
    }
    if (action.startsWith("enquiry")) {
      requireModule(actor, "contact");
      if (action === "enquiryCreate") {
        keys(s, ["subject", "department", "body", "learnerId"]);
        const learnerId = s.learnerId ? id(ctx, "learners", s.learnerId) : undefined;
        if (learnerId) await requireGuardianOf(ctx, learnerId, actor);
        const target = await ctx.db.insert("enquiries", {
          subject: text(s, "subject"),
          department: option(s, "department", DEPARTMENTS),
          status: "Open",
          createdBy: actor.user._id,
          ...(learnerId ? { learnerId } : {}),
          lastMessageAt: now,
        });
        const msg = await ctx.db.insert("enquiryMessages", {
          enquiryId: target,
          authorId: actor.user._id,
          body: text(s, "body", 10000),
          internal: false,
        });
        await ctx.audit("enquiry.created", "enquiries", target);
        await ctx.audit("enquiry.message", "enquiryMessages", msg);
        return target;
      }
      const e = await get(ctx, "enquiries", itemId);
      if (!enquiryAllowed(actor, e)) denied();
      const staff =
        wholeSchool(actor) || (hasRole(actor, "Teacher") && e.assigneeId === actor.user._id);
      if (action === "enquiryReply") {
        keys(s, ["body", "internal"]);
        if (e.status === "Resolved") invalid("Reopen the enquiry before replying.");
        const internalNote = s.internal === undefined ? false : toggle(s, "internal");
        if (internalNote && !staff) denied();
        const target = await ctx.db.insert("enquiryMessages", {
          enquiryId: e._id,
          body: text(s, "body", 10000),
          internal: internalNote,
          authorId: actor.user._id,
        });
        await ctx.db.patch("enquiries", e._id, { lastMessageAt: now });
        await ctx.audit("enquiry.replied", "enquiryMessages", target);
        return target;
      }
      if (action === "enquiryAssign") {
        if (!wholeSchool(actor)) denied();
        keys(s, ["department", "assigneeId"]);
        const assignee = await get(ctx, "users", s.assigneeId);
        if (assignee.status === "Deactivated") invalid("Choose an active staff member.");
        const roles = await ctx.db
          .query("staffRoles")
          .withIndex("by_userId", (q) => q.eq("userId", assignee._id))
          .take(5);
        if (!roles.some((r) => ["Teacher", "Principal", "Administrator"].includes(r.role)))
          invalid("Choose an enquiry staff member.");
        await ctx.db.patch("enquiries", e._id, {
          department: option(s, "department", DEPARTMENTS),
          assigneeId: assignee._id,
          status: "Assigned",
          lastMessageAt: now,
        });
      } else {
        if (!staff) denied();
        keys(s, []);
        if (action !== "enquiryResolve" && action !== "enquiryReopen")
          invalid("Unknown enquiry action.");
        await ctx.db.patch("enquiries", e._id, {
          status: action === "enquiryResolve" ? "Resolved" : e.assigneeId ? "Assigned" : "Open",
          lastMessageAt: now,
        });
      }
      await ctx.audit(action, "enquiries", e._id);
      return e._id;
    }
    if (action === "attendanceSave" || action === "attendanceSubmit") {
      requireModule(actor, "attendance");
      academic(actor);
      if (action === "attendanceSubmit") {
        keys(s, []);
        const register = await get(ctx, "attendanceRegisters", itemId);
        await requireTeacherOf(ctx, register.classId, actor);
        const learners = await ctx.db
          .query("learners")
          .withIndex("by_classId_and_status", (q) =>
            q.eq("classId", register.classId).eq("status", "Active"),
          )
          .take(101);
        if (learners.length > 100) invalid("Register limit exceeded; contact the school.");
        for (const l of learners)
          if (
            !(await ctx.db
              .query("attendanceMarks")
              .withIndex("by_registerId_and_learnerId", (q) =>
                q.eq("registerId", register._id).eq("learnerId", l._id),
              )
              .unique())
          )
            invalid("Save a mark for every active learner before submitting.");
        await ctx.db.patch("attendanceRegisters", register._id, {
          status: "Submitted",
          submittedAt: now,
        });
        await ctx.audit("attendance.submitted", "attendanceRegisters", register._id);
        return register._id;
      }
      keys(s, ["classId", "date", "learnerId", "status", "note", "reason"]);
      const c = await requireTeacherOf(ctx, id(ctx, "classes", s.classId), actor);
      const learner = await learnerWriter(ctx, actor, id(ctx, "learners", s.learnerId));
      if (learner.classId !== c._id) denied();
      const day = date(s, "date");
      if (Date.parse(day + "T00:00:00+02:00") > now)
        invalid("Attendance cannot be taken in advance.");
      let r = await ctx.db
        .query("attendanceRegisters")
        .withIndex("by_classId_and_date", (q) => q.eq("classId", c._id).eq("date", day))
        .unique();
      if (itemId && r?._id !== itemId) denied();
      const reason = text(s, "reason", 500, r?.status !== "Submitted");
      if (!r) {
        const rid = await ctx.db.insert("attendanceRegisters", {
          classId: c._id,
          date: day,
          status: "Open",
          takenBy: actor.user._id,
        });
        r = (await ctx.db.get("attendanceRegisters", rid))!;
        await ctx.audit("attendance.opened", "attendanceRegisters", rid);
      }
      const prior = await ctx.db
        .query("attendanceMarks")
        .withIndex("by_registerId_and_learnerId", (q) =>
          q.eq("registerId", r!._id).eq("learnerId", learner._id),
        )
        .unique();
      const status = option(s, "status", ATTENDANCE_STATUSES),
        note = text(s, "note", 1000, true);
      const target = prior
        ? prior._id
        : await ctx.db.insert("attendanceMarks", {
            registerId: r._id,
            learnerId: learner._id,
            date: day,
            status,
            note,
            updatedBy: actor.user._id,
          });
      if (prior)
        await ctx.db.patch("attendanceMarks", target, { status, note, updatedBy: actor.user._id });
      await ctx.audit(
        prior ? "attendance.corrected" : "attendance.marked",
        "attendanceMarks",
        target,
        JSON.stringify({
          previous: prior ? { status: prior.status, note: prior.note ?? "" } : null,
          next: { status, note },
          reason,
        }),
      );
      return r._id;
    }
    if (action === "conductCreate") {
      requireModule(actor, "conduct");
      keys(s, ["learnerId", "type", "title", "description", "visibleToGuardians"]);
      const l = await learnerWriter(ctx, actor, id(ctx, "learners", s.learnerId));
      const target = await ctx.db.insert("conductEntries", {
        learnerId: l._id,
        type: option(s, "type", CONDUCT_TYPES),
        title: text(s, "title"),
        description: text(s, "description", 4000, true),
        visibleToGuardians: toggle(s, "visibleToGuardians"),
        authorId: actor.user._id,
        occurredAt: now,
      });
      await ctx.audit("conduct.created", "conductEntries", target);
      return target;
    }
    if (action === "reportReview" || action === "reportRelease") {
      requireModule(actor, "reports");
      if (!wholeSchool(actor)) denied();
      keys(s, []);
      const r = await get(ctx, "reports", itemId);
      if (!r.file) invalid("Upload the report PDF first.");
      const meta = await ctx.db.system.get("_storage", r.file.storageId);
      if (
        !meta ||
        meta.contentType !== "application/pdf" ||
        r.file.contentType !== "application/pdf" ||
        meta.size > 10 * 1024 * 1024
      )
        invalid("Upload a real PDF no larger than 10 MiB before review.");
      if (action === "reportReview") {
        if (r.status !== "Draft") invalid("Only a draft report can be reviewed.");
        await ctx.db.patch("reports", r._id, { status: "Reviewed", reviewedBy: actor.user._id });
      } else {
        if (r.status !== "Reviewed") invalid("Review the report before release.");
        await ctx.db.patch("reports", r._id, { status: "Released", releasedAt: now });
      }
      await ctx.audit(action, "reports", r._id);
      return r._id;
    }
    if (action === "personClass") {
      administrator(actor);
      keys(s, ["classId", "enabled"]);
      const user = await get(ctx, "users", itemId);
      const role = await ctx.db
        .query("staffRoles")
        .withIndex("by_userId_and_role", (q) => q.eq("userId", user._id).eq("role", "Teacher"))
        .unique();
      if (!role) invalid("Grant the Teacher role before assigning a class.");
      const classroom = await get(ctx, "classes", s.classId);
      const enabled = toggle(s, "enabled");
      const prior = await ctx.db
        .query("teachingAssignments")
        .withIndex("by_staffId_and_classId", (q) =>
          q.eq("staffId", user._id).eq("classId", classroom._id),
        )
        .unique();
      if (enabled && !prior) {
        const existing = await ctx.db
          .query("teachingAssignments")
          .withIndex("by_staffId", (q) => q.eq("staffId", user._id))
          .take(101);
        if (existing.length >= 100) invalid("Teaching assignment limit reached.");
        const target = await ctx.db.insert("teachingAssignments", {
          staffId: user._id,
          classId: classroom._id,
        });
        await ctx.audit("teaching.assigned", "teachingAssignments", target);
      } else if (!enabled && prior) {
        await ctx.db.delete("teachingAssignments", prior._id);
        await ctx.audit("teaching.revoked", "teachingAssignments", prior._id);
      } else await ctx.audit("teaching.unchanged", "users", user._id);
      return user._id;
    }
    if (action === "personRole" || action === "personStatus") {
      administrator(actor);
      const user = await get(ctx, "users", itemId);
      if (user._id === actor.user._id)
        invalid("Another Administrator must change your own access.");
      if (action === "personRole") {
        keys(s, ["role", "enabled"]);
        const role = option(s, "role", STAFF_ROLES),
          enabled = toggle(s, "enabled");
        const prior = await ctx.db
          .query("staffRoles")
          .withIndex("by_userId_and_role", (q) => q.eq("userId", user._id).eq("role", role))
          .unique();
        if (enabled && !prior) {
          const target = await ctx.db.insert("staffRoles", { userId: user._id, role });
          await ctx.audit("role.granted", "staffRoles", target);
        } else if (!enabled && prior) {
          await ctx.db.delete("staffRoles", prior._id);
          await ctx.audit("role.revoked", "staffRoles", prior._id);
        } else await ctx.audit("role.unchanged", "users", user._id);
      } else {
        keys(s, ["status"]);
        await ctx.db.patch("users", user._id, {
          status: option(s, "status", ["Active", "Deactivated"] as const),
          ...(s.status === "Deactivated"
            ? {
                sessionsValidAfter: Math.max(
                  now,
                  (
                    await ctx.db
                      .query("authSessions")
                      .withIndex("userId", (q) => q.eq("userId", user._id))
                      .order("desc")
                      .first()
                  )?._creationTime ?? 0,
                ),
              }
            : {}),
          updatedAt: now,
        });
        await ctx.audit("person.statusChanged", "users", user._id);
      }
      return user._id;
    }
    if (action === "invitationRevoke") {
      administrator(actor);
      keys(s, []);
      const invitation = await get(ctx, "invitations", itemId);
      if (invitation.status !== "Pending") invalid("Only pending invitations can be revoked.");
      await ctx.db.patch("invitations", invitation._id, { status: "Revoked" });
      await ctx.audit("invitation.revoked", "invitations", invitation._id);
      return invitation._id;
    }
    if (action === "settingsSave") {
      administrator(actor);
      const school = await ctx.db.query("schools").take(2);
      if (school.length !== 1) invalid("School configuration is unavailable.");
      keys(s, [
        "name",
        "tagline",
        "currentTerm",
        "contactEmail",
        "contactPhone",
        ...FEATURE_MODULES.map((m) => `flag_${m}`),
      ]);
      const contactEmail = text(s, "contactEmail", 254, true);
      if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))
        invalid("Enter a valid contact email.");
      const featureFlags = { ...school[0].featureFlags };
      for (const module of FEATURE_MODULES) featureFlags[module] = toggle(s, `flag_${module}`);
      await ctx.db.patch("schools", school[0]._id, {
        name: text(s, "name"),
        tagline: text(s, "tagline"),
        currentTerm: text(s, "currentTerm"),
        contactEmail,
        contactPhone: text(s, "contactPhone", 30, true),
        featureFlags,
        updatedAt: now,
      });
      await ctx.audit("settings.updated", "schools", school[0]._id);
      return school[0]._id;
    }
    if (action === "profileSave") {
      keys(s, [
        "name",
        "phone",
        "pushEnabled",
        "emailEnabled",
        "mutedCategories",
        "quietHoursStart",
        "quietHoursEnd",
      ]);
      const phone = text(s, "phone", 30, true);
      if (phone && !/^[+\d][\d ()-]{6,29}$/.test(phone)) invalid("Enter a valid phone number.");
      const muted = text(s, "mutedCategories", 200, true)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      if (muted.some((c) => !NOTICE_CATEGORIES.includes(c as (typeof NOTICE_CATEGORIES)[number])))
        invalid("Choose valid muted categories.");
      const quietHoursStart = text(s, "quietHoursStart", 5, true),
        quietHoursEnd = text(s, "quietHoursEnd", 5, true);
      if (
        !!quietHoursStart !== !!quietHoursEnd ||
        [quietHoursStart, quietHoursEnd].some((v) => v && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v))
      )
        invalid("Quiet hours need two valid HH:mm values.");
      await ctx.db.patch("users", actor.user._id, {
        name: text(s, "name"),
        phone,
        phoneVerificationTime: undefined,
        updatedAt: now,
      });
      const prior = await ctx.db
        .query("notificationPreferences")
        .withIndex("by_userId", (q) => q.eq("userId", actor.user._id))
        .unique();
      const data = {
        pushEnabled: toggle(s, "pushEnabled"),
        emailEnabled: toggle(s, "emailEnabled"),
        mutedCategories: [...new Set(muted)] as (typeof NOTICE_CATEGORIES)[number][],
        quietHoursStart: quietHoursStart || undefined,
        quietHoursEnd: quietHoursEnd || undefined,
      };
      const target = prior
        ? prior._id
        : await ctx.db.insert("notificationPreferences", { ...data, userId: actor.user._id });
      if (prior) await ctx.db.patch("notificationPreferences", target, data);
      await ctx.audit("profile.updated", "users", actor.user._id);
      await ctx.audit("preferences.updated", "notificationPreferences", target);
      return actor.user._id;
    }
    invalid("This operation needs its dedicated upload or invitation action.");
  },
});
const reportArgs = {
  learnerId: v.id("learners"),
  title: v.string(),
  term: v.string(),
  fileName: v.string(),
};
export const reportPermission = internalQuery({
  args: { learnerId: v.id("learners"), uploadHash: v.string() },
  returns: v.union(v.null(), v.id("reports")),
  handler: async (ctx, { learnerId, uploadHash }) => {
    const actor = await requireActor(ctx);
    requireModule(actor, "reports");
    await learnerWriter(ctx, actor, learnerId);
    return (
      (
        await ctx.db
          .query("reports")
          .withIndex("by_uploadedBy_and_uploadHash", (q) =>
            q.eq("uploadedBy", actor.user._id).eq("uploadHash", uploadHash),
          )
          .unique()
      )?._id ?? null
    );
  },
});
export const saveReport = internalMutation({
  args: { ...reportArgs, storageId: v.id("_storage"), uploadHash: v.string() },
  returns: v.object({ id: v.id("reports"), created: v.boolean() }),
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    requireModule(actor, "reports");
    await learnerWriter(ctx, actor, args.learnerId);
    const meta = await ctx.db.system.get("_storage", args.storageId);
    if (!meta || meta.contentType !== "application/pdf" || meta.size > 524288)
      invalid("Invalid report PDF.");
    const prior = await ctx.db
      .query("reports")
      .withIndex("by_uploadedBy_and_uploadHash", (q) =>
        q.eq("uploadedBy", actor.user._id).eq("uploadHash", args.uploadHash),
      )
      .unique();
    if (prior) return { id: prior._id, created: false };
    const target = await ctx.db.insert("reports", {
      uploadHash: args.uploadHash,
      learnerId: args.learnerId,
      title: text(args, "title"),
      term: text(args, "term", 100),
      status: "Draft",
      uploadedBy: actor.user._id,
      file: {
        storageId: args.storageId,
        fileName: text(args, "fileName", 150),
        contentType: "application/pdf",
        size: meta.size,
      },
    });
    await ctx.db.insert("managedFiles", {
      storageId: args.storageId,
      target: { kind: "report", id: target },
    });
    await writeAudit(ctx, actor, "report.uploaded", "reports", target);
    return { id: target, created: true };
  },
});
export const uploadReport = authedAction({
  args: { ...reportArgs, bytes: v.bytes() },
  returns: v.id("reports"),
  handler: async (ctx, args): Promise<Id<"reports">> => {
    if (
      args.bytes.byteLength > 524288 ||
      args.bytes.byteLength < 5 ||
      new TextDecoder().decode(new Uint8Array(args.bytes).slice(0, 5)) !== "%PDF-"
    )
      invalid("Choose a PDF no larger than 512 KiB.");
    const fields = { title: args.title, term: args.term, fileName: args.fileName };
    text(fields, "title");
    text(fields, "term", 100);
    text(fields, "fileName", 150);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", args.bytes));
    const metadata = new TextEncoder().encode(
      JSON.stringify([args.learnerId, args.title.trim(), args.term.trim(), Array.from(digest)]),
    );
    const uploadHash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", metadata)),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    const existing = await ctx.runQuery(internal.workflows.reportPermission, {
      learnerId: args.learnerId,
      uploadHash,
    });
    if (existing) return existing;
    const storageId = await ctx.storage.store(new Blob([args.bytes], { type: "application/pdf" }));
    try {
      const saved = await ctx.runMutation(internal.workflows.saveReport, {
        learnerId: args.learnerId,
        title: args.title,
        term: args.term,
        fileName: args.fileName,
        storageId,
        uploadHash,
      });
      if (!saved.created) await ctx.storage.delete(storageId);
      return saved.id;
    } catch (error) {
      await ctx.storage.delete(storageId);
      throw error;
    }
  },
});
export const reportAccess = internalQuery({
  args: { reportId: v.id("reports") },
  returns: v.object({ storageId: v.id("_storage"), fileName: v.string() }),
  handler: async (ctx, { reportId }) => {
    const actor = await requireActor(ctx),
      r = await get(ctx, "reports", reportId);
    if (actor.disabledModules?.includes("reports")) denied();
    const learner = await get(ctx, "learners", r.learnerId);
    const staff =
      wholeSchool(actor) ||
      (hasRole(actor, "Teacher") && actor.teachingClasses.some((c) => c._id === learner.classId));
    if (staff) requireModule(actor, "reports");
    else {
      requireModule(actor, "children");
      await requireGuardianOf(ctx, learner._id, actor);
      if (r.status !== "Released") denied();
    }
    if (!r.file || r.file.contentType !== "application/pdf")
      invalid("This record has no uploaded PDF.");
    return { storageId: r.file.storageId, fileName: r.file.fileName };
  },
});
export const reportFile = authedAction({
  args: { reportId: v.id("reports") },
  returns: v.object({ name: v.string(), bytes: v.bytes() }),
  handler: async (ctx, args): Promise<{ name: string; bytes: ArrayBuffer }> => {
    const file = await ctx.runQuery(internal.workflows.reportAccess, args);
    const blob = await ctx.storage.get(file.storageId);
    if (!blob || blob.size > 524288)
      invalid("Report file is unavailable or exceeds the supported size.");
    const bytes = await blob.arrayBuffer();
    await ctx.runQuery(internal.workflows.reportAccess, args);
    return { name: file.fileName, bytes };
  },
});
