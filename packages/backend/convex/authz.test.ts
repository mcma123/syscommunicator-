/// <reference types="vite/client" />
import aggregateTest from "@convex-dev/aggregate/test";
import { convexTest } from "convex-test";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { type PaginationResult, makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import { hashInvitation } from "./authPolicy";
import { authedMutation, staffMutation } from "./lib/functions";

const modules = {
  ...import.meta.glob(["./**/*.ts", "!./**/*.test.ts", "!./convex.config.ts"]),
  "./__auditTest.ts": async () => ({
    unaudited: authedMutation({
      args: {},
      returns: v.null(),
      handler: async (ctx) => {
        await ctx.db.insert("groups", { name: "must roll back", createdBy: ctx.actor.user._id });
        return null;
      },
    }),
    audited: staffMutation(["Administrator"], {
      args: {},
      returns: v.id("groups"),
      handler: async (ctx) => {
        const id = await ctx.db.insert("groups", {
          name: "audited group",
          createdBy: ctx.actor.user._id,
        });
        await ctx.audit("group.created", "groups", id);
        return id;
      },
    }),
  }),
};
const makeTest = () => {
  const t = convexTest(schema, modules);
  aggregateTest.register(t, "dashboardAggregate");
  return t;
};
type Test = ReturnType<typeof makeTest>;
beforeEach(() => vi.stubEnv("ENABLE_DEMO_ACCOUNTS", "true"));
afterEach(() => vi.unstubAllEnvs());

async function asUser(t: Test, email: string) {
  const user = await t.run((ctx) =>
    ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique(),
  );
  if (!user) throw new Error("Test user missing");
  const sessionId = await t.run((ctx) =>
    ctx.db.insert("authSessions", { userId: user._id, expirationTime: Date.now() + 3600000 }),
  );
  return { user, sessionId, client: t.withIdentity({ subject: `${user._id}|${sessionId}` }) };
}
async function fixture<T extends TableNames>(t: Test, table: T, key: string): Promise<Id<T>> {
  return t.run(async (ctx) => {
    const entry = await ctx.db
      .query("seedFixtures")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (!entry || entry.target.kind !== "document") throw new Error("Missing fixture");
    const id = ctx.db.normalizeId(table, entry.target.documentId);
    if (!id) throw new Error("Invalid fixture");
    return id;
  });
}
async function setup() {
  const t = makeTest();
  await t.action(internal.seedFiles.run, {});
  const parent = await asUser(t, "parent@wgjs.example");
  const teacher = await asUser(t, "teacher@wgjs.example");
  const finance = await asUser(t, "finance@wgjs.example");
  const principal = await asUser(t, "principal@wgjs.example");
  const admin = await asUser(t, "admin@wgjs.example");
  const emma = await fixture(t, "learners", "learner:emma");
  const ownClass = await fixture(t, "classes", "class:4B");
  const other = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: "other@school.test",
      name: "Other parent",
      status: "Active",
      emailVerificationTime: 1,
    });
    const gradeId = await ctx.db.insert("grades", { name: "Grade 7", sortOrder: 7 });
    const classId = await ctx.db.insert("classes", { gradeId, name: "7A", year: 2026 });
    const learnerId = await ctx.db.insert("learners", {
      firstName: "Other",
      lastName: "Learner",
      learnerNumber: "OTHER",
      classId,
      gradeId,
      status: "Active",
    });
    await ctx.db.insert("guardianLinks", {
      guardianId: userId,
      learnerId,
      relationship: "Guardian",
      isPrimaryContact: true,
    });
    const chargeId = await ctx.db.insert("charges", {
      learnerId,
      title: "Other family fee",
      amountCents: 99000,
      status: "Due",
      dueAt: 1,
      createdBy: admin.user._id,
      updatedAt: 1,
    });
    return { userId, classId, gradeId, learnerId, chargeId };
  });
  const otherParent = await asUser(t, "other@school.test");
  const notice = async (
    title: string,
    audiences: Doc<"notices">["audiences"],
    status: Doc<"notices">["status"] = "Published",
    authorId: Id<"users"> = admin.user._id,
  ) =>
    t.run((ctx) =>
      ctx.db.insert("notices", {
        title,
        body: title,
        category: "General",
        status,
        authorId,
        audiences,
        urgent: false,
        requiresAcknowledgement: false,
        attachments: [],
        publishedAt: 1,
        updatedAt: 1,
      }),
    );
  return {
    t,
    parent,
    teacher,
    finance,
    principal,
    admin,
    emma,
    ownClass,
    other,
    otherParent,
    notice,
  };
}

describe("server authorization", () => {
  it("isolates parents by learner, class, grade, explicit group and publication status, including direct URLs", async () => {
    const { t, parent, otherParent, other, ownClass, notice } = await setup();
    const classNotice = await notice("Own class", [{ kind: "Class", classId: ownClass }]);
    const otherNotice = await notice("Other class", [{ kind: "Class", classId: other.classId }]);
    const gradeNotice = await notice("Other grade", [{ kind: "Grade", gradeId: other.gradeId }]);
    const draft = await notice(
      "Own private draft",
      [{ kind: "Class", classId: ownClass }],
      "Draft",
      parent.user._id,
    );
    const scheduled = await notice("Scheduled", [{ kind: "School" }], "Scheduled");
    const school = await notice("Whole school", [{ kind: "School" }]);
    const group = await t.run(async (ctx) => {
      const id = await ctx.db.insert("groups", {
        name: "Parent group",
        createdBy: parent.user._id,
      });
      await ctx.db.insert("groupMembers", { groupId: id, userId: parent.user._id });
      return id;
    });
    const groupNotice = await notice("Group only", [{ kind: "Group", groupId: group }]);
    for (const id of [classNotice, groupNotice, school])
      expect((await parent.client.query(api.notices.get, { noticeId: id }))._id).toBe(id);
    for (const id of [otherNotice, gradeNotice, draft, scheduled])
      await expect(parent.client.query(api.notices.get, { noticeId: id })).rejects.toThrow();
    await expect(
      otherParent.client.query(api.notices.get, { noticeId: classNotice }),
    ).rejects.toThrow();
    await expect(
      otherParent.client.query(api.notices.get, { noticeId: groupNotice }),
    ).rejects.toThrow();
    const seen: Id<"notices">[] = [];
    let cursor: string | null = null;
    for (let pageNumber = 0; pageNumber < 20; pageNumber++) {
      const result: PaginationResult<import("../client").PublicNotice> = await parent.client.query(
        api.notices.listForMe,
        { paginationOpts: { numItems: 2, cursor } },
      );
      seen.push(...result.page.map((n) => n._id));
      if (result.isDone) break;
      cursor = result.continueCursor;
    }
    expect(seen).toContain(classNotice);
    expect(seen).toContain(groupNotice);
    expect(seen).not.toContain(otherNotice);
    expect(seen).not.toContain(draft);
    expect(seen).not.toContain(gradeNotice);
  });
  it("does not let missing, inactive or unrelated guardian links widen access", async () => {
    const { t, parent, other, notice } = await setup();
    const target = await notice("Other grade", [{ kind: "Grade", gradeId: other.gradeId }]);
    await expect(parent.client.query(api.notices.get, { noticeId: target })).rejects.toThrow();
    await t.run((ctx) =>
      ctx.db.insert("guardianLinks", {
        guardianId: parent.user._id,
        learnerId: other.learnerId,
        relationship: "Guardian",
        isPrimaryContact: false,
      }),
    );
    expect((await parent.client.query(api.notices.get, { noticeId: target }))._id).toBe(target);
    await t.run((ctx) => ctx.db.patch("learners", other.learnerId, { status: "Withdrawn" }));
    await expect(parent.client.query(api.notices.get, { noticeId: target })).rejects.toThrow();
  });
  it("limits teacher learner access and drafts to assigned classes without an author bypass", async () => {
    const { t, teacher, parent, ownClass, other, emma, notice } = await setup();
    expect((await teacher.client.query(api.learners.get, { learnerId: emma }))._id).toBe(emma);
    expect(
      (await teacher.client.query(api.learners.listForClass, { classId: ownClass })).length,
    ).toBe(5);
    await expect(
      teacher.client.query(api.learners.get, { learnerId: other.learnerId }),
    ).rejects.toThrow();
    await expect(
      teacher.client.query(api.learners.listForClass, { classId: other.classId }),
    ).rejects.toThrow();
    await expect(
      parent.client.query(api.learners.listForClass, { classId: ownClass }),
    ).rejects.toThrow();
    const ownDraft = await notice(
      "Teacher draft",
      [{ kind: "Class", classId: ownClass }],
      "Draft",
      teacher.user._id,
    );
    const outsideDraft = await notice(
      "Teacher outside",
      [{ kind: "Class", classId: other.classId }],
      "Draft",
      teacher.user._id,
    );
    const colleagueDraft = await notice(
      "Colleague draft",
      [{ kind: "Class", classId: ownClass }],
      "Draft",
    );
    expect((await teacher.client.query(api.notices.get, { noticeId: ownDraft }))._id).toBe(
      ownDraft,
    );
    await expect(
      teacher.client.query(api.notices.get, { noticeId: outsideDraft }),
    ).rejects.toThrow();
    await expect(
      teacher.client.query(api.notices.get, { noticeId: colleagueDraft }),
    ).rejects.toThrow();
    await t.run((ctx) =>
      ctx.db.insert("teachingAssignments", {
        staffId: teacher.user._id,
        classId: ownClass,
        subject: "Mathematics",
      }),
    );
    expect((await teacher.client.query(api.learners.get, { learnerId: emma }))._id).toBe(emma);
  });
  it("lets Principals and Administrators read school-wide academic records", async () => {
    const { principal, admin, other, notice } = await setup();
    const id = await notice("Other draft", [{ kind: "Class", classId: other.classId }], "Draft");
    for (const caller of [principal, admin]) {
      expect(
        (await caller.client.query(api.learners.get, { learnerId: other.learnerId }))._id,
      ).toBe(other.learnerId);
      expect((await caller.client.query(api.notices.get, { noticeId: id }))._id).toBe(id);
    }
    await expect(principal.client.query(api.onboarding.invitationOptions, {})).rejects.toThrow();
  });
  it("restricts Finance to financial records and combines independently granted guardian access", async () => {
    const { t, finance, parent, teacher, other, emma, notice } = await setup();
    const academic = await notice("School notice", [{ kind: "School" }]);
    expect(
      (await finance.client.query(api.charges.get, { chargeId: other.chargeId })).amountCents,
    ).toBe(99000);
    await expect(
      finance.client.query(api.learners.get, { learnerId: other.learnerId }),
    ).rejects.toThrow();
    await expect(finance.client.query(api.notices.get, { noticeId: academic })).rejects.toThrow();
    await expect(
      teacher.client.query(api.charges.get, { chargeId: other.chargeId }),
    ).rejects.toThrow();
    await expect(
      parent.client.query(api.charges.get, { chargeId: other.chargeId }),
    ).rejects.toThrow();
    await t.run((ctx) =>
      ctx.db.insert("guardianLinks", {
        guardianId: finance.user._id,
        learnerId: emma,
        relationship: "Guardian",
        isPrimaryContact: false,
      }),
    );
    expect((await finance.client.query(api.learners.get, { learnerId: emma }))._id).toBe(emma);
    expect((await finance.client.query(api.notices.get, { noticeId: academic }))._id).toBe(
      academic,
    );
    await expect(
      finance.client.query(api.learners.get, { learnerId: other.learnerId }),
    ).rejects.toThrow();
  });
  it("checks resource publication and audience before returning storage IDs", async () => {
    const { t, parent, other, admin, finance } = await setup();
    const file = (await t.run((ctx) => ctx.db.query("resources").take(1)))[0].file;
    const id = await t.run((ctx) =>
      ctx.db.insert("resources", {
        title: "Other private document",
        category: "Policies",
        status: "Published",
        file,
        audiences: [{ kind: "Class", classId: other.classId }],
        publishedBy: admin.user._id,
        updatedAt: 1,
      }),
    );
    await expect(parent.client.query(api.resources.get, { resourceId: id })).rejects.toThrow();
    await expect(finance.client.query(api.resources.get, { resourceId: id })).rejects.toThrow();
    expect((await admin.client.query(api.resources.get, { resourceId: id }))._id).toBe(id);
    await t.run((ctx) =>
      ctx.db.patch("resources", id, { audiences: [{ kind: "School" }], status: "Draft" }),
    );
    await expect(parent.client.query(api.resources.get, { resourceId: id })).rejects.toThrow();
  });
  it("rejects signed-out, revoked, deactivated and mismatched-session callers before returning records", async () => {
    const { t, parent, otherParent, emma } = await setup();
    await expect(t.query(api.learners.get, { learnerId: emma })).rejects.toThrow();
    const forged = t.withIdentity({ subject: `${parent.user._id}|${otherParent.sessionId}` });
    await expect(forged.query(api.learners.get, { learnerId: emma })).rejects.toThrow();
    await t.run((ctx) => ctx.db.delete("authSessions", parent.sessionId));
    await expect(parent.client.query(api.learners.get, { learnerId: emma })).rejects.toThrow();
    const fresh = await asUser(t, parent.user.email!);
    await t.run((ctx) => ctx.db.patch("users", parent.user._id, { status: "Deactivated" }));
    await expect(fresh.client.query(api.learners.get, { learnerId: emma })).rejects.toThrow();
  });
  it("fails closed on oversized membership and pagination requests", async () => {
    const { t, parent, teacher, ownClass } = await setup();
    await expect(
      parent.client.query(api.notices.listForMe, {
        paginationOpts: { numItems: 1000, cursor: null },
      }),
    ).rejects.toThrow();
    await t.run(async (ctx) => {
      for (let i = 0; i < 101; i++)
        await ctx.db.insert("teachingAssignments", {
          staffId: teacher.user._id,
          classId: ownClass,
          subject: `Subject ${i}`,
        });
    });
    await expect(
      teacher.client.query(api.learners.listForClass, { classId: ownClass }),
    ).rejects.toThrow();
  });
  it("enforces audit entries and role checks, rolling back unaudited writes", async () => {
    const { t, parent, admin } = await setup();
    const unaudited = makeFunctionReference<"mutation", Record<string, never>, null>(
      "__auditTest:unaudited",
    );
    const audited = makeFunctionReference<"mutation", Record<string, never>, Id<"groups">>(
      "__auditTest:audited",
    );
    await expect(parent.client.mutation(unaudited, {})).rejects.toThrow("audit entry");
    expect(await t.run((ctx) => ctx.db.query("groups").take(10))).toHaveLength(0);
    await expect(parent.client.mutation(audited, {})).rejects.toThrow();
    const id = await admin.client.mutation(audited, {});
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("auditLog")
          .withIndex("by_targetTable_and_targetId", (q) =>
            q.eq("targetTable", "groups").eq("targetId", id),
          )
          .take(10),
      ),
    ).toMatchObject([{ actorId: admin.user._id, action: "group.created" }]);
  });
  it("rejects invitation grants that exceed the account's total guardian limit atomically", async () => {
    const { t, parent, admin, emma, other } = await setup();
    await t.run(async (ctx) => {
      const source = await ctx.db.get("learners", emma);
      await ctx.db.patch("users", parent.user._id, { emailVerificationTime: 1 });
      for (let i = 0; i < 18; i++) {
        const learnerId = await ctx.db.insert("learners", {
          firstName: "Limit",
          lastName: "Learner",
          learnerNumber: `LIMIT-${i}`,
          classId: source!.classId,
          gradeId: source!.gradeId,
          status: "Active",
        });
        await ctx.db.insert("guardianLinks", {
          guardianId: parent.user._id,
          learnerId,
          relationship: "Guardian",
          isPrimaryContact: false,
        });
      }
    });
    const token = "b".repeat(64);
    const invitationId = await admin.client.mutation(internal.onboarding.recordInvitation, {
      email: parent.user.email!,
      kind: "Staff",
      staffRole: "Administrator",
      learnerIds: [other.learnerId],
      tokenHash: await hashInvitation(token),
    });
    await expect(parent.client.mutation(api.onboarding.accept, { token })).rejects.toThrow(
      "membership limit",
    );
    expect((await parent.client.query(api.users.current, {}))?.roles).toEqual([]);
    expect(await t.run((ctx) => ctx.db.get("invitations", invitationId))).toMatchObject({
      status: "Pending",
    });
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("auditLog")
          .withIndex("by_actorId", (q) => q.eq("actorId", parent.user._id))
          .take(20),
      ),
    ).toHaveLength(0);
  });
  it("rejects client identity arguments through registered validators", async () => {
    const { parent, emma, other } = await setup();
    await expect(
      parent.client.query(api.learners.get, { learnerId: emma, userId: other.userId } as never),
    ).rejects.toThrow();
  });
});
