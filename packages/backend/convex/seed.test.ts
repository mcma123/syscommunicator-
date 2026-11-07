/// <reference types="vite/client" />
import aggregateTest from "@convex-dev/aggregate/test";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initialState } from "@school-connect/core";
import schema from "./schema";
import { dashboardAggregate } from "./lib/dashboardAggregate";
import { internal } from "./_generated/api";
import { DEV_URL, MAX_ROWS } from "./seedSupport";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts", "!./convex.config.ts"]);
const createTest = () => {
  const t = convexTest(schema, modules);
  aggregateTest.register(t, "dashboardAggregate");
  return t;
};
afterEach(() => vi.unstubAllEnvs());

describe("development fixtures", () => {
  it("seeds the mock school with valid references, dates, money and real sample files", async () => {
    const t = createTest();
    const counts = await t.action(internal.seedFiles.run, {});
    expect(counts).toMatchObject({
      schools: 1,
      users: 5,
      staffRoles: 4,
      grades: 2,
      classes: 2,
      learners: 6,
      guardianLinks: 2,
      teachingAssignments: 2,
      notices: 5,
      noticeReceipts: 4,
      events: 4,
      resources: 4,
      enquiries: 1,
      enquiryMessages: 1,
      attendanceRegisters: 1,
      attendanceMarks: 5,
      conductEntries: 1,
      consentRequests: 1,
      consentResponses: 0,
      charges: 1,
      payments: 0,
      paymentEvents: 0,
      receipts: 0,
      reports: 2,
      notificationPreferences: 5,
      invitations: 0,
      pushTokens: 0,
    });
    expect(await t.query(internal.seed.verify, {})).toMatchObject({ counts, filesChecked: 6 });
    await t.run(async (ctx) => {
      const parent = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", "parent@wgjs.example"))
        .unique();
      expect(parent?.name).toBe("Jamie Williams");
      expect(Object.keys(parent!)).not.toContain("password");
      const links = await ctx.db.query("guardianLinks").take(10);
      for (const link of links) {
        expect(link.guardianId).toBe(parent!._id);
        const learner = await ctx.db.get("learners", link.learnerId);
        expect(await ctx.db.get("classes", learner!.classId)).not.toBeNull();
        expect(await ctx.db.get("grades", learner!.gradeId)).not.toBeNull();
      }
      const notices = await ctx.db.query("notices").take(10);
      for (const notice of notices) {
        expect(await ctx.db.get("users", notice.authorId)).not.toBeNull();
        const receipts = await ctx.db
          .query("noticeReceipts")
          .withIndex("by_noticeId", (q) => q.eq("noticeId", notice._id))
          .take(10);
        expect(receipts).toHaveLength(notice.status === "Published" ? 1 : 0);
        expect(receipts.every((r) => !r.deliveredAt && !r.readAt && !r.acknowledgedAt)).toBe(true);
      }
      const charge = (await ctx.db.query("charges").take(2))[0];
      expect(charge).toMatchObject({
        amountCents: 25000,
        status: "Due",
        dueAt: Date.parse("2026-10-20T23:59:59+02:00"),
      });
      const consent = await ctx.db.get("consentRequests", charge.consentRequestId!);
      expect(consent?.status).toBe("Open");
      const event = await ctx.db.get("events", consent!.eventId!);
      expect(event?.startsAt).toBe(Date.parse("2026-10-23T08:00:00+02:00"));
      const resources = await ctx.db.query("resources").take(10);
      expect(resources.map((r) => r.title).sort()).toEqual(
        initialState.resources.map((r) => r.title).sort(),
      );
      for (const resource of resources) {
        const blob = await ctx.storage.get(resource.file.storageId);
        expect(await blob!.text()).toContain("SAMPLE - FICTIONAL DEVELOPMENT DOCUMENT");
        expect(resource.file.size).toBe(blob!.size);
      }
      const marks = await ctx.db.query("attendanceMarks").take(10);
      expect(marks.filter((m) => m.status === "Absent")).toHaveLength(1);
      for (const mark of marks) {
        expect(await ctx.db.get("learners", mark.learnerId)).not.toBeNull();
        expect(await ctx.db.get("attendanceRegisters", mark.registerId)).not.toBeNull();
      }
    });
  });

  it("is repeatable without duplicate documents or files and preserves renamed fixtures and preferences", async () => {
    const t = createTest();
    const before = await t.action(internal.seedFiles.run, {});
    const storageBefore = await t.run((ctx) => ctx.db.system.query("_storage").take(20));
    await t.run(async (ctx) => {
      const notice = (await ctx.db.query("notices").take(1))[0];
      await ctx.db.patch("notices", notice._id, { title: "Edited title", body: "Edited body" });
      const prefs = (await ctx.db.query("notificationPreferences").take(1))[0];
      await ctx.db.patch("notificationPreferences", prefs._id, { pushEnabled: false });
      const charge = (await ctx.db.query("charges").take(1))[0];
      await ctx.db.patch("charges", charge._id, { status: "Failed" });
    });
    expect(await t.action(internal.seedFiles.run, {})).toEqual(before);
    expect(await t.run((ctx) => ctx.db.system.query("_storage").take(20))).toEqual(storageBefore);
    await t.run(async (ctx) => {
      expect((await ctx.db.query("notices").take(1))[0].title).toBe("Edited title");
      expect((await ctx.db.query("notificationPreferences").take(1))[0].pushEnabled).toBe(false);
      expect((await ctx.db.query("charges").take(1))[0].status).toBe("Failed");
    });
  });

  it("restores deleted fixture documents without duplicating surviving data", async () => {
    const t = createTest();
    const counts = await t.action(internal.seedFiles.run, {});
    await t.run(async (ctx) => {
      await ctx.db.delete("conductEntries", (await ctx.db.query("conductEntries").take(1))[0]._id);
    });
    await expect(t.query(internal.seed.verify, {})).rejects.toThrow("Broken fixture");
    expect(await t.action(internal.seedFiles.run, {})).toEqual(counts);
  });

  it("adopts a unique existing user but rejects duplicate natural keys atomically", async () => {
    const t = createTest();
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", { email: "parent@wgjs.example", name: "Edited parent" }),
    );
    await t.action(internal.seedFiles.run, {});
    await t.run(async (ctx) => {
      expect((await ctx.db.get("users", userId))?.name).toBe("Edited parent");
    });
    const ambiguous = createTest();
    await ambiguous.run(async (ctx) => {
      await ctx.db.insert("users", { email: "parent@wgjs.example" });
      await ctx.db.insert("users", { email: "parent@wgjs.example" });
    });
    await expect(ambiguous.action(internal.seedFiles.run, {})).rejects.toThrow();
    expect(await ambiguous.run((ctx) => ctx.db.query("schools").take(2))).toHaveLength(0);
    expect(await ambiguous.run((ctx) => ctx.db.query("users").take(3))).toHaveLength(2);
  });

  it("refuses a conflicting school before uploading files or inserting records", async () => {
    const t = createTest();
    await t.run((ctx) =>
      ctx.db.insert("schools", {
        name: "Different school",
        appName: "Other",
        shortName: "Other",
        tagline: "Other",
        websiteUrl: "https://example.com",
        timezone: "Africa/Johannesburg",
        currency: "ZAR",
        currentTerm: "Term 4",
        featureFlags: {},
        updatedAt: 0,
      }),
    );
    await expect(t.action(internal.seedFiles.run, {})).rejects.toThrow("Conflicting school");
    expect(await t.run((ctx) => ctx.db.query("users").take(1))).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.system.query("_storage").take(1))).toHaveLength(0);
  });

  it.each([undefined, "https://production.convex.cloud", "https://unknown.convex.cloud"])(
    "blocks every seed/reset entry point on target %s before writes",
    async (url) => {
      const t = createTest();
      vi.stubEnv("CONVEX_CLOUD_URL", url);
      await expect(t.action(internal.seedFiles.run, {})).rejects.toThrow("restricted");
      await expect(t.mutation(internal.seed.run, {})).rejects.toThrow("restricted");
      await expect(t.mutation(internal.seed.reset, {})).rejects.toThrow("restricted");
      await expect(t.query(internal.seed.preflight, {})).rejects.toThrow("restricted");
      await expect(t.query(internal.seed.files, {})).rejects.toThrow("restricted");
      await expect(t.query(internal.seed.verify, {})).rejects.toThrow("restricted");
      expect(await t.run((ctx) => ctx.db.query("schools").take(1))).toHaveLength(0);
    },
  );

  it("reset clears application data, deletes only seed files and allows a fresh seed", async () => {
    const t = createTest();
    const before = await t.action(internal.seedFiles.run, {});
    const seedFiles = await t.query(internal.seed.files, {});
    const unrelatedFile = await t.run((ctx) => ctx.storage.store(new Blob(["Unrelated document"])));
    const buildId = await t.run(async (ctx) => {
      const user = (await ctx.db.query("users").first())!;
      const buildId = await ctx.db.insert("dashboardBuilds", {
        userId: user._id,
        revision: "test",
        phase: "ready",
        moduleIndex: 4,
        progress: 1,
        cursor: null,
      });
      const id = await ctx.db.insert("dashboardItems", {
        buildId,
        kind: "messages",
        pending: true,
        at: 0,
        amount: 0,
        sourceId: "fixture",
      });
      await dashboardAggregate.insert(ctx, (await ctx.db.get("dashboardItems", id))!);
      expect(await dashboardAggregate.count(ctx, { namespace: buildId })).toBe(1);
      return buildId;
    });
    const inventory = await t.query(internal.seed.preflight, {});
    expect(await t.mutation(internal.seed.reset, {})).toEqual(inventory);
    expect(await t.run((ctx) => dashboardAggregate.count(ctx, { namespace: buildId }))).toBe(0);
    await t.run(async (ctx) => {
      for (const table of Object.keys(schema.tables) as (keyof typeof schema.tables)[])
        expect(await ctx.db.query(table).take(1)).toHaveLength(0);
      for (const file of seedFiles) expect(await ctx.storage.get(file.file.storageId)).toBeNull();
      expect(await ctx.storage.get(unrelatedFile)).not.toBeNull();
    });
    expect(await t.action(internal.seedFiles.run, {})).toEqual(before);
  });

  it("oversized reset rejects before deleting any record or file", async () => {
    const t = createTest();
    const file = await t.run((ctx) => ctx.storage.store(new Blob(["keep"])));
    await t.run(async (ctx) => {
      for (let i = 0; i <= MAX_ROWS; i++)
        await ctx.db.insert("users", { email: `fixture-${i}@example.com` });
    });
    await expect(t.mutation(internal.seed.reset, {})).rejects.toThrow("exceeds");
    expect(await t.run((ctx) => ctx.db.query("users").take(MAX_ROWS + 1))).toHaveLength(
      MAX_ROWS + 1,
    );
    expect(await t.run(async (ctx) => (await ctx.storage.get(file)) !== null)).toBe(true);
  });

  it("remains internal and does not expose administrative fixture functions to anonymous clients", async () => {
    const seed = await import("./seed");
    const files = await import("./seedFiles");
    for (const fn of [...Object.values(seed), ...Object.values(files)])
      expect(fn).toHaveProperty("isInternal", true);
    expect(DEV_URL).toBe("https://diligent-bass-226.convex.cloud");
  });
});
