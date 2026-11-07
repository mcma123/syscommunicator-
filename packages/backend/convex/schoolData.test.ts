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
it("reads bounded live module records for every allowed role without a client repository", async () => {
  const { parent, teacher, finance, admin } = await setup();
  for (const [caller, role] of [
    [parent, "Parent"],
    [teacher, "Teacher"],
    [finance, "Finance"],
    [admin, "Administrator"],
  ] as const) {
    for (const module of MODULE_PERMISSIONS[role]) {
      const page = await caller.client.query(api.schoolData.list, { module });
      expect(page.records.length).toBeLessThanOrEqual(50);
      expect(typeof page.truncated).toBe("boolean");
    }
  }
  const calendar = await parent.client.query(api.schoolData.list, { module: "calendar" });
  expect(calendar.records.length).toBeGreaterThan(0);
  await expect(finance.client.query(api.schoolData.list, { module: "children" })).rejects.toThrow();
  await expect(teacher.client.query(api.schoolData.list, { module: "people" })).rejects.toThrow();
});
it("shares persisted notice receipts and title changes between independent clients", async () => {
  const { t, parent, login } = await setup();
  const mobile = await login("parent@wgjs.example");
  const notice = (
    await t.run((ctx) =>
      ctx.db
        .query("notices")
        .withIndex("by_status_and_publishedAt", (q) => q.eq("status", "Published"))
        .take(5),
    )
  ).find((n) => n.audiences.some((a) => a.kind === "School"))!;
  await parent.client.mutation(api.notices.setReceipt, { noticeId: notice._id, acknowledge: true });
  const first = (
    await mobile.client.query(api.schoolData.list, { module: "messages" })
  ).records.find((r) => r.id === notice._id);
  expect(first).toMatchObject({ read: true, acknowledged: true });
  await parent.client.mutation(api.notices.setReceipt, {
    noticeId: notice._id,
    acknowledge: false,
  });
  expect(
    (await mobile.client.query(api.schoolData.list, { module: "messages" })).records.find(
      (r) => r.id === notice._id,
    )?.acknowledged,
  ).toBe(true);
  await t.run((ctx) => ctx.db.patch("notices", notice._id, { title: "Changed at the source" }));
  expect(
    (await mobile.client.query(api.schoolData.list, { module: "messages" })).records.find(
      (r) => r.id === notice._id,
    )?.title,
  ).toBe("Changed at the source");
  const receipts = await t.run((ctx) =>
    ctx.db
      .query("noticeReceipts")
      .withIndex("by_noticeId_and_guardianId", (q) =>
        q.eq("noticeId", notice._id).eq("guardianId", parent.user._id),
      )
      .take(5),
  );
  expect(receipts).toHaveLength(1);
  expect(
    await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_targetTable_and_targetId", (q) =>
          q.eq("targetTable", "noticeReceipts").eq("targetId", receipts[0]._id),
        )
        .take(5),
    ),
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ actorId: parent.user._id, action: "notice.acknowledged" }),
    ]),
  );
});
it("denies foreign learner selection, private notices, internal messages and spoofed identities", async () => {
  const { t, parent, teacher } = await setup();
  const extra = await t.run(async (ctx) => {
    const gradeId = await ctx.db.insert("grades", { name: "Other grade", sortOrder: 9 });
    const classId = await ctx.db.insert("classes", { name: "9X", gradeId, year: 2026 });
    const learnerId = await ctx.db.insert("learners", {
      firstName: "Other",
      lastName: "Family",
      learnerNumber: "PRIVATE",
      classId,
      gradeId,
      status: "Active",
    });
    const noticeId = await ctx.db.insert("notices", {
      title: "Private class",
      body: "Must be hidden",
      category: "General",
      status: "Published",
      authorId: teacher.user._id,
      audiences: [{ kind: "Class", classId }],
      urgent: false,
      requiresAcknowledgement: false,
      attachments: [],
      publishedAt: 1,
      updatedAt: 1,
    });
    const enquiryId = await ctx.db.insert("enquiries", {
      subject: "Parent conversation",
      department: "Administration",
      status: "Open",
      createdBy: parent.user._id,
      lastMessageAt: 1,
    });
    await ctx.db.insert("enquiryMessages", {
      enquiryId,
      authorId: teacher.user._id,
      body: "INTERNAL NOTE",
      internal: true,
    });
    await ctx.db.insert("guardianLinks", {
      guardianId: teacher.user._id,
      learnerId,
      relationship: "Guardian",
      isPrimaryContact: false,
    });
    await ctx.db.insert("reports", {
      learnerId,
      term: "Term 4",
      title: "PRIVATE UNRELEASED REPORT",
      status: "Draft",
      uploadedBy: teacher.user._id,
    });
    await ctx.db.insert("conductEntries", {
      learnerId,
      type: "Merit",
      title: "PRIVATE PASTORAL RECORD",
      authorId: teacher.user._id,
      visibleToGuardians: false,
      occurredAt: 1,
    });
    return { learnerId, noticeId };
  });
  await expect(
    parent.client.query(api.schoolData.list, { module: "children", learnerId: extra.learnerId }),
  ).rejects.toThrow();
  await expect(
    parent.client.mutation(api.notices.setReceipt, { noticeId: extra.noticeId, acknowledge: true }),
  ).rejects.toThrow();
  expect(
    (await parent.client.query(api.schoolData.list, { module: "messages" })).records.map(
      (r) => r.id,
    ),
  ).not.toContain(extra.noticeId);
  expect(
    JSON.stringify(await parent.client.query(api.schoolData.list, { module: "contact" })),
  ).not.toContain("INTERNAL NOTE");
  expect(
    JSON.stringify(await teacher.client.query(api.schoolData.list, { module: "reports" })),
  ).not.toContain("PRIVATE UNRELEASED REPORT");
  expect(
    JSON.stringify(await teacher.client.query(api.schoolData.list, { module: "conduct" })),
  ).not.toContain("PRIVATE PASTORAL RECORD");
  await expect(t.query(api.schoolData.list, { module: "home" })).rejects.toThrow();
  await expect(
    parent.client.query(api.schoolData.list, { module: "home", userId: teacher.user._id } as never),
  ).rejects.toThrow();
});
it("flags bounded results instead of inventing complete totals", async () => {
  const { t, parent } = await setup();
  await t.run(async (ctx) => {
    for (let i = 0; i < 55; i++)
      await ctx.db.insert("notices", {
        title: `Notice ${i}`,
        body: "Live",
        category: "General",
        status: "Published",
        authorId: parent.user._id,
        audiences: [{ kind: "School" }],
        urgent: false,
        requiresAcknowledgement: false,
        attachments: [],
        publishedAt: i,
        updatedAt: i,
      });
  });
  const page = await parent.client.query(api.schoolData.list, { module: "messages" });
  expect(page.records).toHaveLength(50);
  expect(page.truncated).toBe(true);
});
