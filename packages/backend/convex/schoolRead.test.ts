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
afterEach(() => vi.unstubAllEnvs());
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

import type { FunctionArgs } from "convex/server";
const pageArgs = { paginationOpts: { numItems: 10, cursor: null } };
async function all(
  c: Awaited<ReturnType<typeof setup>>["parent"]["client"],
  input: Omit<FunctionArgs<typeof api.schoolRead.page>, "paginationOpts">,
) {
  let cursor: string | null = null;
  const rows = [];
  for (let i = 0; i < 100; i++) {
    const page: import("convex/server").PaginationResult<
      import("@school-connect/core/live").ModuleRecord
    > = await c.query(api.schoolRead.page, { ...input, paginationOpts: { numItems: 10, cursor } });
    rows.push(...page.page);
    if (page.isDone) return rows;
    expect(page.continueCursor).not.toBe(cursor);
    cursor = page.continueCursor;
  }
  throw new Error("Pagination did not finish");
}
it("paginates every granted module and rejects forbidden module/identity inputs", async () => {
  const { t, parent, teacher, finance, admin } = await setup();
  for (const [caller, role] of [
    [parent, "Parent"],
    [teacher, "Teacher"],
    [finance, "Finance"],
    [admin, "Administrator"],
  ] as const) {
    for (const module of MODULE_PERMISSIONS[role]) {
      const page = await caller.client.query(api.schoolRead.page, { module, ...pageArgs });
      expect(page.page.length).toBeLessThanOrEqual(10);
    }
  }
  await expect(t.query(api.schoolRead.page, { module: "messages", ...pageArgs })).rejects.toThrow();
  await expect(
    finance.client.query(api.schoolRead.page, { module: "children", ...pageArgs }),
  ).rejects.toThrow();
  await expect(
    teacher.client.query(api.schoolRead.page, { module: "people", ...pageArgs }),
  ).rejects.toThrow();
  await expect(
    parent.client.query(api.schoolRead.page, {
      module: "messages",
      paginationOpts: { numItems: 51, cursor: null },
    }),
  ).rejects.toThrow();
});
it("continues through empty filtered pages beyond 50 and opens fresh details without loading the list", async () => {
  const { t, parent } = await setup();
  const ids = await t.run(async (ctx) => {
    const template = (await ctx.db
      .query("notices")
      .withIndex("by_status_and_publishedAt", (q) => q.eq("status", "Published"))
      .first())!;
    const { _id, _creationTime, ...notice } = template;
    const ids = [];
    for (let i = 0; i < 65; i++)
      ids.push(
        await ctx.db.insert("notices", {
          ...notice,
          audiences: [{ kind: "School" }],
          title: `Historical ${i}`,
          body: i === 0 ? "Needle in the complete archive" : "Other message",
          publishedAt: 100000 + i,
        }),
      );
    return ids;
  });
  const first = await parent.client.query(api.schoolRead.page, {
    module: "messages",
    search: "Needle",
    ...pageArgs,
  });
  expect(first.page).toHaveLength(0);
  expect(first.isDone).toBe(false);
  const found = await all(parent.client, { module: "messages", search: "Needle" });
  expect(found).toHaveLength(1);
  expect(found[0].id).toBe(ids[0]);
  const detail = await parent.client.query(api.schoolRead.detail, {
    module: "messages",
    itemId: ids[0],
  });
  expect(detail.record.body).toContain("Needle");
  const pages = await all(parent.client, { module: "messages" });
  expect(new Set(pages.map((r) => r.id)).size).toBe(pages.length);
  expect(pages.length).toBeGreaterThan(65);
  const category = detail.record.category!;
  expect(
    (await all(parent.client, { module: "messages", category })).every(
      (r) => r.category === category,
    ),
  ).toBe(true);
});
it("checks learner, teacher and financial scope on direct details and contextual history", async () => {
  const { t, parent, teacher, finance, admin } = await setup();
  const data = await t.run(async (ctx) => {
    const gradeId = await ctx.db.insert("grades", { name: "Private grade", sortOrder: 99 });
    const classId = await ctx.db.insert("classes", { name: "Private class", gradeId, year: 2026 });
    const learnerId = await ctx.db.insert("learners", {
      firstName: "Private",
      lastName: "Family",
      learnerNumber: "PRIVATE-READ",
      classId,
      gradeId,
      status: "Active",
    });
    const chargeId = await ctx.db.insert("charges", {
      learnerId,
      title: "Private charge",
      amountCents: 600,
      updatedAt: 500,
      status: "Due",
      dueAt: 500,
      createdBy: admin.user._id,
    });
    const paymentId = await ctx.db.insert("payments", {
      chargeId,
      payerId: admin.user._id,
      amountCents: 600,
      provider: "Fixture",
      status: "Succeeded",
    });
    const reportId = await ctx.db.insert("reports", {
      learnerId,
      title: "Private report",
      term: "Term 4",
      status: "Draft",
      uploadedBy: admin.user._id,
    });
    return { learnerId, chargeId, paymentId, reportId, classId };
  });
  for (const caller of [parent, teacher]) {
    await expect(
      caller.client.query(api.schoolRead.detail, { module: "children", itemId: data.learnerId }),
    ).rejects.toThrow();
    await expect(
      caller.client.query(api.schoolRead.detail, {
        module: "reports",
        learnerId: data.learnerId,
        itemId: data.reportId,
      }),
    ).rejects.toThrow();
    await expect(
      caller.client.query(api.schoolRead.page, {
        module: "classLearners",
        parentId: data.classId,
        ...pageArgs,
      }),
    ).rejects.toThrow();
  }
  await expect(
    parent.client.query(api.schoolRead.detail, { module: "payments", itemId: data.chargeId }),
  ).rejects.toThrow();
  await expect(
    parent.client.query(api.schoolRead.page, {
      module: "paymentHistory",
      parentId: data.chargeId,
      ...pageArgs,
    }),
  ).rejects.toThrow();
  expect(
    (
      await finance.client.query(api.schoolRead.detail, {
        module: "paymentHistory",
        itemId: data.paymentId,
      })
    ).record.amountCents,
  ).toBe(600);
  expect(
    (await admin.client.query(api.schoolRead.detail, { module: "reports", itemId: data.reportId }))
      .record.status,
  ).toBe("Draft");
  const learner = (await parent.client.query(api.users.current, {}))!.learners[0];
  const details = await parent.client.query(api.schoolRead.detail, {
    module: "children",
    itemId: learner.id,
  });
  expect(details.record.fields).toEqual(
    expect.arrayContaining([expect.objectContaining({ label: "Class teacher" })]),
  );
  const timetable = await all(parent.client, { module: "timetable", learnerId: learner.id });
  expect(timetable.length).toBeGreaterThan(0);
  const reports = await all(parent.client, { module: "reports", learnerId: learner.id });
  expect(reports.every((r) => r.status === "Released")).toBe(true);
});

it("filters internal threads, wrong parent contexts, unpublished reports and private guardian contact", async () => {
  const { t, parent, teacher, admin } = await setup();
  const data = await t.run(async (ctx) => {
    const enquiry = (await ctx.db.query("enquiries").first())!;
    await ctx.db.patch("enquiries", enquiry._id, { assigneeId: teacher.user._id });
    const note = await ctx.db.insert("enquiryMessages", {
      enquiryId: enquiry._id,
      authorId: teacher.user._id,
      body: "Staff only",
      internal: true,
    });
    const other = await ctx.db.insert("enquiries", {
      subject: "Other parent",
      createdBy: admin.user._id,
      department: enquiry.department,
      status: enquiry.status,
      lastMessageAt: 5,
    });
    const own = (await ctx.db
      .query("guardianLinks")
      .withIndex("by_guardianId", (q) => q.eq("guardianId", parent.user._id))
      .first())!;
    const form = (await ctx.db.query("consentRequests").first())!;
    const response = await ctx.db.insert("consentResponses", {
      consentRequestId: form._id,
      learnerId: own.learnerId,
      guardianId: admin.user._id,
      decision: "Granted",
      contactPhone: "PRIVATE CONTACT",
      notes: "PRIVATE NOTES",
      respondedAt: 9,
    });
    const draft = await ctx.db.insert("reports", {
      learnerId: own.learnerId,
      title: "Unreleased",
      term: "Term 4",
      status: "Draft",
      uploadedBy: admin.user._id,
    });
    return {
      enquiryId: enquiry._id,
      note,
      other,
      response,
      formId: form._id,
      draft,
      learnerId: own.learnerId,
    };
  });
  expect(
    (await all(parent.client, { module: "enquiryMessages", parentId: data.enquiryId })).some(
      (r) => r.body === "Staff only",
    ),
  ).toBe(false);
  expect(
    (await all(teacher.client, { module: "enquiryMessages", parentId: data.enquiryId })).some(
      (r) => r.body === "Staff only",
    ),
  ).toBe(true);
  await expect(
    parent.client.query(api.schoolRead.detail, {
      module: "enquiryMessages",
      parentId: data.enquiryId,
      itemId: data.note,
    }),
  ).rejects.toThrow();
  await expect(
    parent.client.query(api.schoolRead.page, {
      module: "enquiryMessages",
      parentId: data.other,
      ...pageArgs,
    }),
  ).rejects.toThrow();
  const response = await parent.client.query(api.schoolRead.detail, {
    module: "formResponses",
    parentId: data.formId,
    itemId: data.response,
  });
  expect(JSON.stringify(response)).not.toContain("PRIVATE");
  await expect(
    parent.client.query(api.schoolRead.detail, {
      module: "reports",
      learnerId: data.learnerId,
      itemId: data.draft,
    }),
  ).rejects.toThrow();
  const outstanding = await all(parent.client, {
    module: "forms",
    learnerId: data.learnerId,
    outstandingOnly: true,
  });
  expect(outstanding).toHaveLength(0);
});
it("builds exact scoped aggregate counts beyond one page and invalidates after receipts and membership changes", async () => {
  const { t, parent, teacher } = await setup();
  const extra = await t.run(async (ctx) => {
    const template = (await ctx.db
      .query("notices")
      .withIndex("by_status_and_publishedAt", (q) => q.eq("status", "Published"))
      .first())!;
    const { _id, _creationTime, ...notice } = template;
    for (let i = 0; i < 57; i++)
      await ctx.db.insert("notices", {
        ...notice,
        title: `Count ${i}`,
        audiences: [{ kind: "School" }],
        publishedAt: i + 1,
      });
    return (await ctx.db
      .query("guardianLinks")
      .withIndex("by_guardianId", (q) => q.eq("guardianId", parent.user._id))
      .first())!;
  });
  async function ready(c: typeof parent.client) {
    for (let i = 0; i < 100; i++) {
      const state = await c.query(api.dashboard.current, { now: 0 });
      if (state.ready) return state;
      await c.action(api.dashboard.advance, {});
    }
    throw new Error("Dashboard did not finish");
  }
  expect((await parent.client.query(api.dashboard.current, { now: 0 })).ready).toBe(false);
  const messages = await all(parent.client, { module: "messages" });
  const forms = await all(parent.client, { module: "forms" });
  const charges = await all(parent.client, { module: "payments" });
  const events = await all(parent.client, { module: "calendar" });
  const before = await ready(parent.client);
  expect(before.unread).toBe(messages.filter((r) => !r.read).length);
  expect(before.unread).toBeGreaterThan(50);
  expect(before.upcomingEvents).toBe(events.length);
  expect(before.amountDueCents).toBe(
    charges.filter((r) => r.pending).reduce((n, r) => n + (r.amountCents ?? 0), 0),
  );
  expect(before.pendingActions).toBe(
    forms.filter((r) => r.pending).length +
      charges.filter((r) => r.pending).length +
      messages.filter((r) => r.requiresAcknowledgement && r.canAcknowledge && !r.acknowledged)
        .length,
  );
  const teacherBefore = await ready(teacher.client);
  const notice = messages.find((r) => r.canAcknowledge && !r.read)!;
  await parent.client.mutation(api.notices.setReceipt, {
    noticeId: notice.id as import("./_generated/dataModel").Id<"notices">,
    acknowledge: false,
  });
  expect((await parent.client.query(api.dashboard.current, { now: 0 })).ready).toBe(false);
  expect((await ready(parent.client)).unread).toBe(before.unread! - 1);
  expect((await teacher.client.query(api.dashboard.current, { now: 0 })).revision).toBe(
    teacherBefore.revision,
  );
  await teacher.client.mutation(api.notices.setReceipt, {
    noticeId: notice.id as import("./_generated/dataModel").Id<"notices">,
    acknowledge: false,
  });
  expect((await ready(teacher.client)).unread).toBe(teacherBefore.unread! - 1);
  await t.run((ctx) => ctx.db.delete("guardianLinks", extra._id));
  expect((await parent.client.query(api.dashboard.current, { now: 0 })).ready).toBe(false);
  await ready(parent.client);
  expect(
    (await parent.client.query(api.dashboard.current, { now: Date.parse("2030-01-01") }))
      .upcomingEvents,
  ).toBe(0);
}, 30000);
