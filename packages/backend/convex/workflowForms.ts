import { targetId } from "./schoolRead";
import { v, type Infer } from "convex/values";
type ServerForm = Omit<WorkflowForm, "targetId"> & { targetId?: Infer<typeof targetId> };
import type { WorkflowForm, WorkflowField, WorkflowAction } from "@school-connect/core/workflows";
import { WORKFLOW_ACTIONS } from "@school-connect/core/workflows";
import {
  NOTICE_CATEGORIES,
  CONSENT_DECISIONS,
  DEPARTMENTS,
  ATTENDANCE_STATUSES,
  CONDUCT_TYPES,
  STAFF_ROLES,
  RESOURCE_CATEGORIES,
} from "@school-connect/core/domain";
import { authedQuery } from "./lib/functions";
import { readModule, readDetail, academic, staffForLearner } from "./lib/read";
import { requireModule, requireGuardianOf, wholeSchool, hasRole, denied } from "./lib/auth";
import { get, localTime, FEATURE_MODULES } from "./lib/workflowRules";
import { matchesAudience } from "./lib/audiences";
import { literals } from "./validators";
const optionValidator = v.object({ value: v.string(), label: v.string() });
export const formValidator = v.object({
  targetId: v.optional(targetId),
  action: literals(WORKFLOW_ACTIONS),
  title: v.string(),
  description: v.string(),
  confirm: v.optional(v.boolean()),
  fields: v.array(
    v.object({
      name: v.string(),
      label: v.string(),
      type: literals([
        "text",
        "multiline",
        "select",
        "toggle",
        "datetime",
        "date",
        "file",
      ] as const),
      value: v.string(),
      required: v.boolean(),
      options: v.optional(v.array(optionValidator)),
    }),
  ),
});
const field = (
  name: string,
  label: string,
  value = "",
  type: WorkflowField["type"] = "text",
  required = true,
): WorkflowField => ({ name, label, value, type, required });
const select = (
  name: string,
  label: string,
  options: { value: string; label: string }[],
  value?: string,
): WorkflowField => ({
  ...field(
    name,
    label,
    value ?? options[0]?.value ?? "",
    "select",
    !(name === "learnerId" && options.some((o) => o.value === "")),
  ),
  options,
});
const choices = (items: readonly string[]) => items.map((value) => ({ value, label: value }));
const toggle = (name: string, label: string, on = false) =>
  field(name, label, String(on), "toggle");
export const forms = authedQuery({
  args: {
    module: readModule,
    itemId: v.optional(targetId),
    learnerId: v.optional(v.id("learners")),
  },
  returns: v.array(formValidator),
  handler: async (ctx, { module, itemId, learnerId }): Promise<ServerForm[]> => {
    const actor = ctx.actor,
      isAcademic = academic(actor),
      global = wholeSchool(actor),
      admin = hasRole(actor, "Administrator");
    if (itemId && !["profile", "people"].includes(module))
      await readDetail(ctx, actor, { module, ...(learnerId ? { learnerId } : {}) }, itemId);
    else if (module === "profile") requireModule(actor, "profile");
    else if (module === "people") requireModule(actor, "people");
    else requireModule(actor, module as import("@school-connect/core/permissions").SchoolModule);
    const result: ServerForm[] = [];
    const add = (
      action: WorkflowAction,
      title: string,
      fields: WorkflowField[] = [],
      description = "Changes are saved to your school account.",
      confirm = false,
    ) => result.push({ action, title, fields, description, confirm });
    // Bounded pickers are explicit; target learner profiles also expose creation forms.
    const learnerChoices = async () => {
      const rows = await ctx.db.query("learners").withIndex("by_learnerNumber").take(101);
      const allowed = rows.filter((l) => l.status === "Active" && staffForLearner(actor, l));
      if (learnerId && !allowed.some((l) => l._id === learnerId)) {
        const l = await get(ctx, "learners", learnerId);
        if (staffForLearner(actor, l)) allowed.push(l);
      }
      if (module === "children" && itemId && !allowed.some((l) => l._id === itemId)) {
        const l = await get(ctx, "learners", itemId);
        if (staffForLearner(actor, l)) allowed.push(l);
      }
      return allowed.map((l) => ({
        value: l._id,
        label: `${l.firstName} ${l.lastName} (${l.learnerNumber})`,
      }));
    };
    const classes = async () =>
      global
        ? await ctx.db.query("classes").withIndex("by_year_and_name").take(100)
        : actor.teachingClasses;
    const audienceOptions = async () => {
      const rows: { value: string; label: string }[] = [];
      if (global) rows.push({ value: JSON.stringify([{ kind: "School" }]), label: "Whole school" });
      for (const c of await classes())
        rows.push({
          value: JSON.stringify([{ kind: "Class", classId: c._id }]),
          label: `Class ${c.name} (${c.year})`,
        });
      if (global) {
        for (const g of await ctx.db.query("grades").withIndex("by_sortOrder").take(100))
          rows.push({ value: JSON.stringify([{ kind: "Grade", gradeId: g._id }]), label: g.name });
        for (const g of await ctx.db.query("groups").withIndex("by_name").take(100))
          rows.push({ value: JSON.stringify([{ kind: "Group", groupId: g._id }]), label: g.name });
      }
      return rows;
    };
    if (module === "messages" && itemId) {
      const n = await get(ctx, "notices", itemId);
      if (n.attachments.length) {
        const files = n.attachments.map((f, i) => ({ value: String(i), label: f.fileName }));
        add("noticeDownload", "Download attachment", [select("slot", "Attachment", files)]);
        if (isAcademic && n.status === "Draft" && (global || n.authorId === actor.user._id))
          add(
            "noticeRemoveAttachment",
            "Remove attachment",
            [select("slot", "Attachment", files)],
            "Remove the selected attachment from this draft.",
            true,
          );
      }
      if (
        isAcademic &&
        n.status === "Draft" &&
        n.attachments.length < 10 &&
        (global || n.authorId === actor.user._id)
      )
        add("noticeAttach", "Add attachment", [
          field("file", "PDF (10 MiB), PNG or JPEG (5 MiB)", "", "file"),
        ]);
    }
    if (module === "resources") {
      if (!itemId && isAcademic)
        add(
          "resourceCreate",
          "Upload resource",
          [
            field("title", "Title"),
            field("description", "Description", "", "multiline", false),
            select("category", "Category", choices(RESOURCE_CATEGORIES)),
            select("audience", "Audience", await audienceOptions()),
            field("file", "PDF (10 MiB), PNG or JPEG (5 MiB)", "", "file"),
          ],
          "Saved as a draft for school publication.",
        );
      if (itemId) {
        const r = await get(ctx, "resources", itemId);
        add("resourceDownload", "Download resource");
        if (global && r.status === "Draft")
          add(
            "resourcePublish",
            "Publish resource",
            [],
            "Make this resource available to its audience.",
            true,
          );
        if (global && r.status !== "Archived")
          add(
            "resourceArchive",
            "Archive resource",
            [],
            "Remove this resource from the published library.",
            true,
          );
      }
    }
    if (module === "paymentHistory" && itemId) {
      const receipts = await ctx.db
        .query("receipts")
        .withIndex("by_paymentId", (q) =>
          q.eq("paymentId", itemId as import("./_generated/dataModel").Id<"payments">),
        )
        .take(2);
      if (
        receipts.length === 1 &&
        (global || hasRole(actor, "Finance") || receipts[0]!.guardianId === actor.user._id)
      )
        add(
          "receiptDownload",
          "Download receipt PDF",
          [
            select("receiptId", "Receipt", [
              { value: receipts[0]!._id, label: receipts[0]!.receiptNumber },
            ]),
          ],
          "Generated from the verified successful payment record.",
        );
    }
    if (module === "ads" && isAcademic) {
      const ad = itemId ? await get(ctx, "ads", itemId) : null;
      if (!ad || ad.status === "Draft" || (global && ad.status === "Review")) {
        const options = await audienceOptions();
        const audience = ad ? JSON.stringify(ad.audiences) : undefined;
        if (audience && !options.some((o) => o.value === audience))
          options.push({ value: audience, label: "Current audience" });
        add(
          "adSave",
          ad ? "Save ad details" : "Create ad",
          [
            field("title", "Headline (up to 80 characters)", ad?.title),
            field("caption", "Caption", ad?.caption, "multiline", false),
            field("linkUrl", "Link (https://, optional)", ad?.linkUrl, "text", false),
            field("linkLabel", "Button label (optional)", ad?.linkLabel, "text", false),
            field(
              "startsAt",
              "Show from (Johannesburg)",
              ad ? localTime(ad.startsAt) : "",
              "datetime",
            ),
            field(
              "endsAt",
              "Show until (Johannesburg)",
              ad ? localTime(ad.endsAt) : "",
              "datetime",
            ),
            select("audience", "Audience", options, audience),
            toggle("popup", "Also show as a popup (once per device)", ad?.popup),
          ],
          global
            ? "Ads start as drafts. Add pictures or videos, then publish."
            : "Ads start as drafts for your classes. Add pictures or videos, then submit for approval.",
        );
      }
      if (ad?.status === "Draft" && !global)
        add(
          "adSubmit",
          "Submit for approval",
          [],
          "A Principal or Administrator reviews the ad before parents see it.",
          true,
        );
      if (ad && global && (ad.status === "Draft" || ad.status === "Review"))
        add(
          "adPublish",
          ad.status === "Review" ? "Approve and publish" : "Publish ad",
          [],
          "Parents in the audience see this ad between its start and end times.",
          true,
        );
      if (ad && global && (ad.status === "Review" || ad.status === "Published"))
        add(
          "adReturn",
          "Return to draft",
          [field("note", "Note for the author", "", "multiline", false)],
          "Parents stop seeing the ad until it is published again.",
          true,
        );
      if (ad && global && ad.status !== "Archived")
        add("adArchive", "Archive ad", [], "Stops showing this ad to parents.", true);
    }
    if (module === "messages" && isAcademic) {
      const n = itemId ? await get(ctx, "notices", itemId) : null;
      if (!n || (n.status === "Draft" && (global || n.authorId === actor.user._id))) {
        const options = await audienceOptions();
        const audience = n ? JSON.stringify(n.audiences) : undefined;
        if (audience && !options.some((o) => o.value === audience))
          options.push({ value: audience, label: "Current audience" });
        add(
          "noticeSave",
          n ? "Save draft" : "Create notice draft",
          [
            field("title", "Title", n?.title),
            field("body", "Message", n?.body, "multiline"),
            select("category", "Category", choices(NOTICE_CATEGORIES), n?.category),
            select("audience", "Audience", options, audience),
            toggle("urgent", "Urgent", n?.urgent),
            toggle(
              "requiresAcknowledgement",
              "Require acknowledgement",
              n?.requiresAcknowledgement,
            ),
          ],
          "Drafts remain private until reviewed and published. Teacher drafts target assigned classes.",
        );
      }
      if (n?.status === "Draft" && (global || n.authorId === actor.user._id))
        add("noticeReview", "Submit for review");
      if (n?.status === "Review" && global) {
        add(
          "noticePublish",
          "Approve and publish",
          [],
          "Publish to the selected audience and prepare recipient receipts.",
          true,
        );
        add("noticeSchedule", "Approve and schedule", [
          field("publishAt", "Publication time (Johannesburg)", "", "datetime"),
        ]);
      }
      if (n && global && ["Review", "Scheduled"].includes(n.status))
        add(
          "noticeReturn",
          "Return to draft",
          [],
          "Any pending publication schedule will be cancelled.",
          true,
        );
      if (n?.status === "Published" && global)
        add(
          "noticeArchive",
          "Archive notice",
          [],
          "Remove this notice from the published feed.",
          true,
        );
    }
    if (module === "calendar" && isAcademic) {
      const e = itemId ? await get(ctx, "events", itemId) : null;
      if (!e || (e.status === "Scheduled" && (global || e.createdBy === actor.user._id))) {
        const options = await audienceOptions();
        const value = e ? JSON.stringify(e.audiences) : undefined;
        if (value && !options.some((o) => o.value === value))
          options.push({ value, label: "Current audience" });
        add(
          "eventSave",
          e ? "Save event changes" : "Create event",
          [
            field("title", "Title", e?.title),
            field("description", "Description", e?.description, "multiline", false),
            select("category", "Category", choices(NOTICE_CATEGORIES), e?.category),
            select("audience", "Audience", options, value),
            field("startsAt", "Starts (Johannesburg)", e ? localTime(e.startsAt) : "", "datetime"),
            field("endsAt", "Ends (Johannesburg)", e ? localTime(e.endsAt) : "", "datetime"),
            field("location", "Location", e?.location),
            toggle("allDay", "All day", e?.allDay),
          ],
          "All-day events start at midnight and end at midnight on the next day or later.",
        );
        if (e) add("eventCancel", "Cancel event", [], "The event will be marked Cancelled.", true);
      }
    }
    if (module === "forms") {
      if (!itemId && isAcademic)
        add("consentCreate", "Create consent request", [
          field("title", "Title"),
          field("description", "Consent wording", "", "multiline"),
          select("audience", "Audience", await audienceOptions()),
          field("dueAt", "Response deadline (Johannesburg)", "", "datetime"),
        ]);
      if (itemId) {
        const request = await get(ctx, "consentRequests", itemId);
        const eligible = [];
        for (const l of actor.learners)
          if (
            (!learnerId || l._id === learnerId) &&
            (await matchesAudience(ctx, { ...actor, learners: [l] }, request.audiences, "guardian"))
          )
            eligible.push({
              value: l._id,
              label: `${l.firstName} ${l.lastName} (${l.learnerNumber})`,
            });
        if (request.status === "Open" && eligible.length)
          add(
            "consentRespond",
            "Save consent response",
            [
              select("learnerId", "Learner", eligible),
              select("decision", "Decision", choices(CONSENT_DECISIONS)),
              field("contactPhone", "Emergency contact phone", actor.user.phone),
              field("notes", "Notes", "", "multiline", false),
            ],
            "The signed-in guardian and submission time are recorded. Closed or expired requests cannot be submitted. Another guardian's response cannot be overwritten.",
            true,
          );
      }
    }
    if (module === "contact") {
      if (!itemId)
        add("enquiryCreate", "Send an enquiry", [
          field("subject", "Subject"),
          select("department", "Department", choices(DEPARTMENTS)),
          field("body", "Message", "", "multiline"),
          select("learnerId", "Learner (optional)", [
            { value: "", label: "General enquiry" },
            ...actor.learners.map((l) => ({
              value: l._id,
              label: `${l.firstName} ${l.lastName} (${l.learnerNumber})`,
            })),
          ]),
        ]);
      else {
        const e = await get(ctx, "enquiries", itemId);
        const staff = global || (hasRole(actor, "Teacher") && e.assigneeId === actor.user._id);
        if (e.status !== "Resolved")
          add("enquiryReply", "Send reply", [
            field("body", "Reply", "", "multiline"),
            ...(staff ? [toggle("internal", "Internal staff note")] : []),
          ]);
        if (global) {
          const users = await ctx.db.query("users").withIndex("email").take(100);
          const options = [];
          for (const user of users) {
            if (user.status === "Deactivated") continue;
            const roles = await ctx.db
              .query("staffRoles")
              .withIndex("by_userId", (q) => q.eq("userId", user._id))
              .take(5);
            if (roles.some((r) => ["Teacher", "Principal", "Administrator"].includes(r.role)))
              options.push({
                value: user._id,
                label: `${user.name ?? "Staff"} (${user.email ?? "School staff"})`,
              });
          }
          add("enquiryAssign", "Assign responsibility", [
            select("department", "Department", choices(DEPARTMENTS), e.department),
            select("assigneeId", "Responsible person", options, e.assigneeId),
          ]);
        }
        if (staff)
          add(
            e.status === "Resolved" ? "enquiryReopen" : "enquiryResolve",
            e.status === "Resolved" ? "Reopen enquiry" : "Resolve enquiry",
            [],
            "The family sees the saved school status.",
            true,
          );
      }
    }
    if (module === "attendance" && isAcademic) {
      const r = itemId ? await get(ctx, "attendanceRegisters", itemId) : null;
      const options = (await classes()).map((c) => ({
        value: c._id,
        label: `${c.name} (${c.year})`,
      }));
      add(
        "attendanceSave",
        r?.status === "Submitted" ? "Correct attendance mark" : "Save attendance mark",
        [
          select("classId", "Class", options, r?.classId),
          field("date", "Date", r?.date, "date"),
          select("learnerId", "Learner", await learnerChoices()),
          select("status", "Attendance", choices(ATTENDANCE_STATUSES)),
          field("note", "Note", "", "multiline", false),
          field("reason", "Correction reason", "", "text", r?.status === "Submitted"),
        ],
        "Save each active learner's mark, then submit the register. Pickers show up to 100 records; use learner profiles for other learner actions.",
      );
      if (r && r.status === "Open")
        add(
          "attendanceSubmit",
          "Submit complete register",
          [],
          "Every active learner in the class must have a saved mark.",
          true,
        );
    }
    if ((module === "conduct" || module === "children") && isAcademic) {
      const options = await learnerChoices();
      if (options.length)
        add(
          "conductCreate",
          "Add conduct entry",
          [
            select("learnerId", "Learner", options, module === "children" ? itemId : learnerId),
            select("type", "Entry type", choices(CONDUCT_TYPES)),
            field("title", "Title"),
            field("description", "Details", "", "multiline", false),
            toggle("visibleToGuardians", "Visible to linked guardians"),
          ],
          "Private entries are restricted to authorized staff. Pickers show the first 100 learners; open a learner profile for a specific learner.",
        );
    }
    if (((module === "reports" && !itemId) || (module === "children" && itemId)) && isAcademic) {
      const options = await learnerChoices();
      if (options.length)
        add(
          "reportCreate",
          "Upload learner report",
          [
            select("learnerId", "Learner", options, module === "children" ? itemId : learnerId),
            field("title", "Report title"),
            field("term", "Term"),
            field("file", "PDF (maximum 10 MiB)", "", "file"),
          ],
          "The report is saved as Draft and needs school review before release. For other learners, open their profile.",
        );
    }
    if (module === "reports" && itemId) {
      const r = await get(ctx, "reports", itemId);
      if (global && r.file?.contentType === "application/pdf") {
        if (r.status === "Draft")
          add(
            "reportReview",
            "Approve report review",
            [],
            "Confirm that this report is ready for release.",
            true,
          );
        if (r.status === "Reviewed")
          add(
            "reportRelease",
            "Release report",
            [],
            "Linked guardians will be able to open this report.",
            true,
          );
      }
      if (r.file?.contentType === "application/pdf")
        add(
          "reportDownload",
          "Open report PDF",
          [],
          "Downloads are authorized against your current session and learner scope.",
        );
    }
    if (module === "invitations" && itemId && admin) {
      const invite = await get(ctx, "invitations", itemId);
      if (invite.status === "Pending")
        add(
          "invitationRevoke",
          "Revoke invitation",
          [],
          "This invitation will no longer grant access.",
          true,
        );
    }
    if (module === "people" && admin) {
      if (itemId) {
        const user = await get(ctx, "users", itemId);
        if (user._id !== actor.user._id) {
          add(
            "personRole",
            "Change staff role",
            [select("role", "Role", choices(STAFF_ROLES)), toggle("enabled", "Grant role", true)],
            "Role changes take effect immediately.",
            true,
          );
          add(
            "personClass",
            "Assign a teaching class",
            [
              select(
                "classId",
                "Class",
                (await classes()).map((c) => ({ value: c._id, label: `${c.name} (${c.year})` })),
              ),
              toggle("enabled", "Assign class", true),
            ],
            "The Teacher role is required. Assignment changes immediately update class access.",
            true,
          );
          add(
            "personStatus",
            "Change account access",
            [
              select(
                "status",
                "Status",
                choices(["Active", "Deactivated"]),
                user.status ?? "Active",
              ),
            ],
            "Deactivation invalidates existing sessions. Reactivation requires a new sign-in.",
            true,
          );
        }
      } else {
        const learners = (
          await ctx.db.query("learners").withIndex("by_learnerNumber").take(100)
        ).filter((l) => l.status === "Active");
        add(
          "invite",
          "Email school invitation",
          [
            field("email", "Recipient email"),
            select("kind", "Invitation kind", choices(["Guardian", "Staff"])),
            select("staffRole", "Staff role (staff invitation only)", choices(STAFF_ROLES)),
            select("learnerId", "Learner (guardian invitation)", [
              { value: "", label: "None" },
              ...learners.map((l) => ({
                value: l._id,
                label: `${l.firstName} ${l.lastName} (${l.learnerNumber})`,
              })),
            ]),
          ],
          "Email delivery requires the school's configured email service. A failed request never claims delivery.",
        );
        const invites = await ctx.db
          .query("invitations")
          .withIndex("by_status_and_expiresAt", (q) => q.eq("status", "Pending"))
          .take(100);
        for (const invitation of invites) {
          add(
            "invitationRevoke",
            `Revoke invitation: ${invitation.email}`,
            [],
            "Only Pending invitations can be revoked.",
            true,
          );
          result[result.length - 1].targetId = invitation._id;
        }
      }
    }
    if (module === "settings" && admin) {
      const schools = await ctx.db.query("schools").take(1),
        school = schools[0];
      if (school)
        add(
          "settingsSave",
          "Save school settings",
          [
            field("name", "School name", school.name),
            field("tagline", "Tagline", school.tagline),
            field("currentTerm", "Current term", school.currentTerm),
            field("contactEmail", "School email", school.contactEmail, "text", false),
            field("contactPhone", "School phone", school.contactPhone, "text", false),
            ...FEATURE_MODULES.map((m) =>
              toggle(`flag_${m}`, `Enable ${m}`, school.featureFlags[m] !== false),
            ),
          ],
          "Module switches immediately govern server access and navigation. Identity, settings and account access remain available.",
        );
    }
    if (module === "profile") {
      const p = await ctx.db
        .query("notificationPreferences")
        .withIndex("by_userId", (q) => q.eq("userId", actor.user._id))
        .unique();
      add(
        "profileSave",
        "Save profile and preferences",
        [
          field("name", "Your name", actor.user.name),
          field("phone", "Contact phone", actor.user.phone, "text", false),
          toggle("pushEnabled", "Allow push notifications", p?.pushEnabled),
          toggle("emailEnabled", "Allow email notifications", p?.emailEnabled),
          field(
            "mutedCategories",
            "Muted categories (comma separated)",
            p?.mutedCategories.join(", "),
            "text",
            false,
          ),
          field("quietHoursStart", "Quiet hours start (HH:mm)", p?.quietHoursStart, "text", false),
          field("quietHoursEnd", "Quiet hours end (HH:mm)", p?.quietHoursEnd, "text", false),
        ],
        "Preferences persist; delivery depends on the school's notification/email configuration. Sign-in email and school access cannot be changed here.",
      );
    }
    return result;
  },
});
