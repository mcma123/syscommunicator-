/// <reference types="vite/client" />
import aggregateTest from "@convex-dev/aggregate/test";
import { convexTest } from "convex-test";
import { beforeEach, afterEach, it, expect } from "vitest";
import { vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { accessRolesFor, MODULE_PERMISSIONS } from "@school-connect/core/permissions";
const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts", "!./convex.config.ts"]);
beforeEach(() => vi.stubEnv("ENABLE_DEMO_ACCOUNTS", "true"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
async function setup() {
  const t = convexTest(schema, modules);
  aggregateTest.register(t, "dashboardAggregate");
  await t.action(internal.seedFiles.run, {});
  const login = async (email: string) => {
    const user = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .unique(),
    );
    if (!user) throw new Error("Missing fixture user");
    const session = await t.run((ctx) =>
      ctx.db.insert("authSessions", { userId: user._id, expirationTime: Date.now() + 3600000 }),
    );
    return { user, client: t.withIdentity({ subject: `${user._id}|${session}` }) };
  };
  return {
    t,
    login,
    parent: await login("parent@wgjs.example"),
    teacher: await login("teacher@wgjs.example"),
    finance: await login("finance@wgjs.example"),
    admin: await login("admin@wgjs.example"),
  };
}

const page = { paginationOpts: { numItems: 50, cursor: null } };
const schoolAudience = JSON.stringify([{ kind: "School" }]);
const notice = {
  title: "Workflow notice",
  body: "Reviewed school message",
  category: "General",
  audience: schoolAudience,
  urgent: "false",
  requiresAcknowledgement: "true",
};
const local = (at: number) => new Date(at + 7200000).toISOString().slice(0, 16);
it("enforces notice review/publication, scoped fanout and repeat-safe receipts", async () => {
  vi.useFakeTimers();
  const { t, teacher, admin, parent } = await setup();
  await expect(
    parent.client.mutation(api.workflows.submit, { action: "noticeSave", values: notice }),
  ).rejects.toThrow();
  await expect(
    teacher.client.mutation(api.workflows.submit, { action: "noticeSave", values: notice }),
  ).rejects.toThrow();
  const target = await admin.client.mutation(api.workflows.submit, {
    action: "noticeSave",
    values: notice,
  });
  expect(
    (await parent.client.query(api.schoolRead.page, { module: "messages", ...page })).page.some(
      (r) => r.id === target,
    ),
  ).toBe(false);
  await expect(
    admin.client.mutation(api.workflows.submit, {
      action: "noticePublish",
      itemId: target,
      values: {},
    }),
  ).rejects.toThrow();
  await admin.client.mutation(api.workflows.submit, {
    action: "noticeReview",
    itemId: target,
    values: {},
  });
  await expect(
    teacher.client.mutation(api.workflows.submit, {
      action: "noticePublish",
      itemId: target,
      values: {},
    }),
  ).rejects.toThrow();
  await admin.client.mutation(api.workflows.submit, {
    action: "noticePublish",
    itemId: target,
    values: {},
  });
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  const noticeId = target as import("./_generated/dataModel").Id<"notices">;
  const before = await t.run((ctx) =>
    ctx.db
      .query("noticeReceipts")
      .withIndex("by_noticeId", (q) => q.eq("noticeId", noticeId))
      .take(100),
  );
  expect(before).toHaveLength(1);
  await parent.client.mutation(api.notices.setReceipt, { noticeId, acknowledge: true });
  await t.mutation(internal.workflows.receipts, { noticeId, revision: 2, cursor: null });
  const after = await t.run((ctx) =>
    ctx.db
      .query("noticeReceipts")
      .withIndex("by_noticeId", (q) => q.eq("noticeId", noticeId))
      .take(100),
  );
  expect(after).toHaveLength(1);
  expect(after[0].acknowledgedAt).toBeDefined();
  expect(
    (
      await admin.client.query(api.schoolRead.page, {
        module: "noticeReceipts",
        parentId: noticeId,
        ...page,
      })
    ).page[0].status,
  ).toBe("Acknowledged");
  await expect(
    parent.client.query(api.schoolRead.page, {
      module: "noticeReceipts",
      parentId: noticeId,
      ...page,
    }),
  ).rejects.toThrow();
  await expect(
    admin.client.mutation(api.workflows.submit, {
      action: "noticeSave",
      values: { ...notice, authorId: parent.user._id },
    }),
  ).rejects.toThrow();
}, 30000);
it("publishes scheduled notices at their stored time and ignores cancelled schedules", async () => {
  vi.useFakeTimers();
  const { t, admin } = await setup();
  const create = async () => {
    const target = await admin.client.mutation(api.workflows.submit, {
      action: "noticeSave",
      values: notice,
    });
    await admin.client.mutation(api.workflows.submit, {
      action: "noticeReview",
      itemId: target,
      values: {},
    });
    await admin.client.mutation(api.workflows.submit, {
      action: "noticeSchedule",
      itemId: target,
      values: { publishAt: local(Date.now() + 3600000) },
    });
    return target as import("./_generated/dataModel").Id<"notices">;
  };
  const first = await create(),
    cancelled = await create();
  await admin.client.mutation(api.workflows.submit, {
    action: "noticeReturn",
    itemId: cancelled,
    values: {},
  });
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect((await t.run((ctx) => ctx.db.get("notices", first)))?.status).toBe("Published");
  expect((await t.run((ctx) => ctx.db.get("notices", cancelled)))?.status).toBe("Draft");
}, 30000);
it("validates event ownership, date bounds and cancellation with live audience views", async () => {
  const { t, teacher, parent, admin } = await setup();
  const identity = (await teacher.client.query(api.users.current, {}))!;
  const classes = await teacher.client.query(api.schoolRead.page, { module: "classes", ...page });
  const classId = classes.page[0].id;
  const input = {
    title: "Class event",
    description: "School trip",
    category: "Events",
    audience: JSON.stringify([{ kind: "Class", classId }]),
    startsAt: "2027-01-01T08:00",
    endsAt: "2027-01-01T10:00",
    location: "School",
    allDay: "false",
  };
  const eventId = await teacher.client.mutation(api.workflows.submit, {
    action: "eventSave",
    values: input,
  });
  await expect(
    parent.client.mutation(api.workflows.submit, {
      action: "eventCancel",
      itemId: eventId,
      values: {},
    }),
  ).rejects.toThrow();
  await expect(
    teacher.client.mutation(api.workflows.submit, {
      action: "eventSave",
      itemId: eventId,
      values: { ...input, endsAt: input.startsAt },
    }),
  ).rejects.toThrow();
  await teacher.client.mutation(api.workflows.submit, {
    action: "eventCancel",
    itemId: eventId,
    values: {},
  });
  expect(
    (await parent.client.query(api.schoolRead.page, { module: "calendar", ...page })).page.some(
      (r) => r.id === eventId,
    ),
  ).toBe(false);
  expect(
    (
      await teacher.client.query(api.schoolRead.page, { module: "calendar", manage: true, ...page })
    ).page.find((r) => r.id === eventId)?.status,
  ).toBe("Cancelled");
}, 30000);
it("records guardian consent, enforces eligibility/deadlines and prevents another guardian overwriting", async () => {
  const { t, parent, teacher, admin } = await setup();
  const learner = (await parent.client.query(api.users.current, {}))!.learners[0];
  const target = await admin.client.mutation(api.workflows.submit, {
    action: "consentCreate",
    values: {
      title: "Consent",
      description: "I consent to the activity",
      audience: schoolAudience,
      dueAt: local(Date.now() + 86400000),
    },
  });
  const values = {
    learnerId: learner.id,
    decision: "Granted",
    contactPhone: "+27 82 555 1234",
    notes: "Contact me",
  };
  await expect(
    parent.client.mutation(api.workflows.submit, {
      action: "consentRespond",
      itemId: target,
      values: { ...values, contactPhone: "invalid" },
    }),
  ).rejects.toThrow();
  await expect(
    teacher.client.mutation(api.workflows.submit, {
      action: "consentRespond",
      itemId: target,
      values,
    }),
  ).rejects.toThrow();
  const response = await parent.client.mutation(api.workflows.submit, {
    action: "consentRespond",
    itemId: target,
    values,
  });
  expect(
    await t.run((ctx) =>
      ctx.db.get(
        "consentResponses",
        response as import("./_generated/dataModel").Id<"consentResponses">,
      ),
    ),
  ).toMatchObject({ guardianId: parent.user._id, decision: "Granted" });
  await t.run((ctx) =>
    ctx.db.insert("guardianLinks", {
      guardianId: admin.user._id,
      learnerId: learner.id,
      relationship: "Guardian",
      isPrimaryContact: false,
    }),
  );
  await expect(
    admin.client.mutation(api.workflows.submit, {
      action: "consentRespond",
      itemId: target,
      values,
    }),
  ).rejects.toThrow();
  expect(
    (
      await parent.client.query(api.schoolRead.page, {
        module: "forms",
        learnerId: learner.id,
        outstandingOnly: true,
        ...page,
      })
    ).page.some((r) => r.id === target),
  ).toBe(false);
  await t.run((ctx) =>
    ctx.db.patch(
      "consentRequests",
      target as import("./_generated/dataModel").Id<"consentRequests">,
      { dueAt: 0 },
    ),
  );
  await expect(
    parent.client.mutation(api.workflows.submit, {
      action: "consentRespond",
      itemId: target,
      values,
    }),
  ).rejects.toThrow();
}, 30000);
it("persists enquiries, assigned replies and school status while protecting internal notes", async () => {
  const { t, parent, teacher, admin } = await setup();
  const target = await parent.client.mutation(api.workflows.submit, {
    action: "enquiryCreate",
    values: {
      subject: "School question",
      department: "Academic",
      body: "Please advise",
      learnerId: "",
    },
  });
  await expect(
    teacher.client.mutation(api.workflows.submit, {
      action: "enquiryReply",
      itemId: target,
      values: { body: "Unauthorized", internal: "false" },
    }),
  ).rejects.toThrow();
  await admin.client.mutation(api.workflows.submit, {
    action: "enquiryAssign",
    itemId: target,
    values: { department: "Academic", assigneeId: teacher.user._id },
  });
  await teacher.client.mutation(api.workflows.submit, {
    action: "enquiryReply",
    itemId: target,
    values: { body: "Private school note", internal: "true" },
  });
  await teacher.client.mutation(api.workflows.submit, {
    action: "enquiryReply",
    itemId: target,
    values: { body: "Family reply", internal: "false" },
  });
  const messages = await parent.client.query(api.schoolRead.page, {
    module: "enquiryMessages",
    parentId: target as import("./_generated/dataModel").Id<"enquiries">,
    ...page,
  });
  expect(messages.page.some((r) => r.body === "Private school note")).toBe(false);
  expect(messages.page.some((r) => r.body === "Family reply")).toBe(true);
  await expect(
    parent.client.mutation(api.workflows.submit, {
      action: "enquiryResolve",
      itemId: target,
      values: {},
    }),
  ).rejects.toThrow();
  await teacher.client.mutation(api.workflows.submit, {
    action: "enquiryResolve",
    itemId: target,
    values: {},
  });
  await expect(
    parent.client.mutation(api.workflows.submit, {
      action: "enquiryReply",
      itemId: target,
      values: { body: "Follow up", internal: "false" },
    }),
  ).rejects.toThrow();
  await teacher.client.mutation(api.workflows.submit, {
    action: "enquiryReopen",
    itemId: target,
    values: {},
  });
  expect(
    (
      await parent.client.query(api.schoolRead.detail, {
        module: "contact",
        itemId: target as import("./_generated/dataModel").Id<"enquiries">,
      })
    ).record.status,
  ).toBe("Assigned");
}, 30000);
it("submits complete class registers and audits explicit corrections without class escalation", async () => {
  const { t, teacher, parent } = await setup();
  const classroom = (
    await teacher.client.query(api.schoolRead.page, { module: "classes", ...page })
  ).page[0];
  const learners = await teacher.client.query(api.schoolRead.page, {
    module: "classLearners",
    parentId: classroom.id as import("./_generated/dataModel").Id<"classes">,
    ...page,
  });
  let registerId: import("convex/values").Infer<typeof import("./schoolRead").targetId> | undefined;
  for (const l of learners.page)
    registerId = await teacher.client.mutation(api.workflows.submit, {
      action: "attendanceSave",
      values: {
        classId: classroom.id,
        date: "2026-10-25",
        learnerId: l.id,
        status: "Present",
        note: "",
        reason: "",
      },
    });
  await teacher.client.mutation(api.workflows.submit, {
    action: "attendanceSubmit",
    itemId: registerId,
    values: {},
  });
  const values = {
    classId: classroom.id,
    date: "2026-10-25",
    learnerId: learners.page[0].id,
    status: "Late",
    note: "Arrived later",
    reason: "",
  };
  await expect(
    teacher.client.mutation(api.workflows.submit, {
      action: "attendanceSave",
      itemId: registerId,
      values,
    }),
  ).rejects.toThrow();
  await teacher.client.mutation(api.workflows.submit, {
    action: "attendanceSave",
    itemId: registerId,
    values: { ...values, reason: "Corrected arrival time" },
  });
  const audit = await t.run((ctx) =>
    ctx.db
      .query("auditLog")
      .withIndex("by_action", (q) => q.eq("action", "attendance.corrected"))
      .take(10),
  );
  expect(audit.some((a) => a.summary?.includes("Corrected arrival time"))).toBe(true);
  await expect(
    parent.client.mutation(api.workflows.submit, { action: "attendanceSave", values }),
  ).rejects.toThrow();
  const other = (await parent.client.query(api.users.current, {}))!.learners.find(
    (l) => l.classId !== classroom.id,
  )!;
  await expect(
    teacher.client.mutation(api.workflows.submit, {
      action: "attendanceSave",
      values: { ...values, classId: other.classId, learnerId: other.id, reason: "Attempt" },
    }),
  ).rejects.toThrow();
}, 30000);
it("keeps private conduct staff-only and releases actual report bytes only after review", async () => {
  const { t, teacher, parent, admin, finance } = await setup();
  const learner = (await parent.client.query(api.users.current, {}))!.learners[0];
  const conductId = await teacher.client.mutation(api.workflows.submit, {
    action: "conductCreate",
    values: {
      learnerId: learner.id,
      type: "Merit",
      title: "Kindness",
      description: "Helpful",
      visibleToGuardians: "false",
    },
  });
  await expect(
    parent.client.query(api.schoolRead.detail, {
      module: "conduct",
      learnerId: learner.id,
      itemId: conductId as import("./_generated/dataModel").Id<"conductEntries">,
    }),
  ).rejects.toThrow();
  const bytes = new TextEncoder().encode("%PDF-1.4\nFictional isolated report\n%%EOF").buffer;
  const reportId = await teacher.client.action(api.workflows.uploadReport, {
    learnerId: learner.id,
    title: "Term report",
    term: "Term 4",
    fileName: "report.pdf",
    bytes,
  });
  const duplicates = await Promise.all(
    [1, 2].map(() =>
      teacher.client.action(api.workflows.uploadReport, {
        learnerId: learner.id,
        title: "Term report",
        term: "Term 4",
        fileName: "report.pdf",
        bytes,
      }),
    ),
  );
  expect(duplicates).toEqual([reportId, reportId]);
  const matched = await t.run((ctx) =>
    ctx.db
      .query("reports")
      .withIndex("by_learnerId_and_term", (q) => q.eq("learnerId", learner.id).eq("term", "Term 4"))
      .take(20),
  );
  expect(matched.filter((r) => r.title === "Term report")).toHaveLength(1);
  await expect(parent.client.action(api.workflows.reportFile, { reportId })).rejects.toThrow();
  await expect(
    teacher.client.mutation(api.workflows.submit, {
      action: "reportRelease",
      itemId: reportId,
      values: {},
    }),
  ).rejects.toThrow();
  await admin.client.mutation(api.workflows.submit, {
    action: "reportReview",
    itemId: reportId,
    values: {},
  });
  await admin.client.mutation(api.workflows.submit, {
    action: "reportRelease",
    itemId: reportId,
    values: {},
  });
  const file = await parent.client.action(api.workflows.reportFile, { reportId });
  expect(new TextDecoder().decode(file.bytes)).toContain("Fictional isolated report");
  await expect(finance.client.action(api.workflows.reportFile, { reportId })).rejects.toThrow();
  await expect(
    teacher.client.action(api.workflows.uploadReport, {
      learnerId: learner.id,
      title: "Bad file",
      term: "Term",
      fileName: "not-pdf.pdf",
      bytes: new TextEncoder().encode("Not PDF").buffer,
    }),
  ).rejects.toThrow();
}, 30000);
it("applies role/status changes immediately and old sessions cannot return after reactivation", async () => {
  vi.useFakeTimers();
  const { t, parent, teacher, admin, login } = await setup();
  await expect(
    teacher.client.mutation(api.workflows.submit, {
      action: "personRole",
      itemId: parent.user._id,
      values: { role: "Administrator", enabled: "true" },
    }),
  ).rejects.toThrow();
  await expect(
    admin.client.mutation(api.workflows.submit, {
      action: "personStatus",
      itemId: admin.user._id,
      values: { status: "Deactivated" },
    }),
  ).rejects.toThrow();
  await admin.client.mutation(api.workflows.submit, {
    action: "personRole",
    itemId: parent.user._id,
    values: { role: "Teacher", enabled: "true" },
  });
  expect((await parent.client.query(api.users.current, {}))?.roles).toContain("Teacher");
  await admin.client.mutation(api.workflows.submit, {
    action: "personStatus",
    itemId: parent.user._id,
    values: { status: "Deactivated" },
  });
  await expect(
    parent.client.query(api.schoolRead.page, { module: "messages", ...page }),
  ).rejects.toThrow();
  await admin.client.mutation(api.workflows.submit, {
    action: "personStatus",
    itemId: parent.user._id,
    values: { status: "Active" },
  });
  await expect(
    parent.client.query(api.schoolRead.page, { module: "messages", ...page }),
  ).rejects.toThrow();
  vi.advanceTimersByTime(2);
  const fresh = await login("parent@wgjs.example");
  expect((await fresh.client.query(api.users.current, {}))?.status).toBe("Active");
}, 30000);
it("persists profile preferences and enforces Administrator feature flags on actual reads", async () => {
  const { t, parent, teacher, admin } = await setup();
  await parent.client.mutation(api.workflows.submit, {
    action: "profileSave",
    values: {
      name: "Jamie updated",
      phone: "0825551234",
      pushEnabled: "false",
      emailEnabled: "true",
      mutedCategories: "Sport",
      quietHoursStart: "20:00",
      quietHoursEnd: "06:00",
    },
  });
  expect((await parent.client.query(api.users.current, {}))?.name).toBe("Jamie updated");
  const prefs = await t.run((ctx) =>
    ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", parent.user._id))
      .unique(),
  );
  expect(prefs).toMatchObject({ pushEnabled: false, mutedCategories: ["Sport"] });
  const forms = await admin.client.query(api.workflowForms.forms, { module: "settings" });
  const values = Object.fromEntries(forms[0].fields.map((f) => [f.name, f.value]));
  values.flag_messages = "false";
  await admin.client.mutation(api.workflows.submit, { action: "settingsSave", values });
  await expect(
    parent.client.query(api.schoolRead.page, { module: "messages", ...page }),
  ).rejects.toThrow();
  expect((await parent.client.query(api.users.current, {}))?.disabledModules).toContain("messages");
  await expect(
    teacher.client.mutation(api.workflows.submit, { action: "settingsSave", values }),
  ).rejects.toThrow();
  expect((await admin.client.query(api.workflowForms.forms, { module: "settings" })).length).toBe(
    1,
  );
}, 30000);

it("fans out class notices across bounded batches without reaching an unrelated family", async () => {
  vi.useFakeTimers();
  const { t, parent, admin } = await setup();
  const learners = (await parent.client.query(api.users.current, {}))!.learners;
  const eligible = learners[0],
    outside = learners.find((l) => l.classId !== eligible.classId)!;
  const outsider = await t.run(async (ctx) => {
    for (let i = 0; i < 28; i++) {
      const user = await ctx.db.insert("users", {
        name: `Guardian ${i}`,
        email: `batch${i}@school.test`,
        status: "Active",
      });
      await ctx.db.insert("guardianLinks", {
        guardianId: user,
        learnerId: eligible.id,
        relationship: "Guardian",
        isPrimaryContact: false,
      });
    }
    const user = await ctx.db.insert("users", { email: "outside@school.test", status: "Active" });
    await ctx.db.insert("guardianLinks", {
      guardianId: user,
      learnerId: outside.id,
      relationship: "Guardian",
      isPrimaryContact: false,
    });
    return user;
  });
  const noticeId = await admin.client.mutation(api.workflows.submit, {
    action: "noticeSave",
    values: { ...notice, audience: JSON.stringify([{ kind: "Class", classId: eligible.classId }]) },
  });
  await admin.client.mutation(api.workflows.submit, {
    action: "noticeReview",
    itemId: noticeId,
    values: {},
  });
  await admin.client.mutation(api.workflows.submit, {
    action: "noticePublish",
    itemId: noticeId,
    values: {},
  });
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  const receipts = await t.run((ctx) =>
    ctx.db
      .query("noticeReceipts")
      .withIndex("by_noticeId", (q) =>
        q.eq("noticeId", noticeId as import("./_generated/dataModel").Id<"notices">),
      )
      .take(100),
  );
  expect(receipts).toHaveLength(29);
  expect(receipts.some((r) => r.guardianId === outsider)).toBe(false);
}, 30000);
it("grants and revokes teaching scope and exposes sanitized invitation history/revocation", async () => {
  const { t, parent, teacher, admin } = await setup();
  const learner = (await parent.client.query(api.users.current, {}))!.learners[0];
  await expect(
    teacher.client.mutation(api.workflows.submit, {
      action: "personClass",
      itemId: teacher.user._id,
      values: { classId: learner.classId, enabled: "true" },
    }),
  ).rejects.toThrow();
  await admin.client.mutation(api.workflows.submit, {
    action: "personRole",
    itemId: parent.user._id,
    values: { role: "Teacher", enabled: "true" },
  });
  await admin.client.mutation(api.workflows.submit, {
    action: "personClass",
    itemId: parent.user._id,
    values: { classId: learner.classId, enabled: "true" },
  });
  expect(
    (await parent.client.query(api.schoolRead.page, { module: "classes", ...page })).page.some(
      (c) => c.id === learner.classId,
    ),
  ).toBe(true);
  await admin.client.mutation(api.workflows.submit, {
    action: "personClass",
    itemId: parent.user._id,
    values: { classId: learner.classId, enabled: "false" },
  });
  expect(
    (await parent.client.query(api.schoolRead.page, { module: "classes", ...page })).page.some(
      (c) => c.id === learner.classId,
    ),
  ).toBe(false);
  const invitationId = await admin.client.mutation(internal.onboarding.recordInvitation, {
    email: "new@school.test",
    kind: "Guardian",
    learnerIds: [learner.id],
    tokenHash: "private-hash",
  });
  const records = await admin.client.query(api.schoolRead.page, { module: "invitations", ...page });
  expect(JSON.stringify(records)).not.toContain("private-hash");
  await expect(
    parent.client.query(api.schoolRead.page, { module: "invitations", ...page }),
  ).rejects.toThrow();
  await admin.client.mutation(api.workflows.submit, {
    action: "invitationRevoke",
    itemId: invitationId,
    values: {},
  });
  expect((await t.run((ctx) => ctx.db.get("invitations", invitationId)))?.status).toBe("Revoked");
}, 30000);
