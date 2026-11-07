/// <reference types="vite/client" />
// Phase 12 key journeys, driven only through the public client facade (`../client`) that the web
// and Expo apps import, so a facade/reference mismatch fails here even when the generated API works.
// Payment-dependent journeys (excursion: notice -> consent -> payment -> receipt) wait for Phase 9.
import aggregateTest from "@convex-dev/aggregate/test";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { api } from "../client";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts", "!./convex.config.ts"]);
beforeEach(() => vi.stubEnv("ENABLE_DEMO_ACCOUNTS", "true"));
afterEach(() => vi.unstubAllEnvs());
const page = { paginationOpts: { numItems: 50, cursor: null } };

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
    if (!user) throw new Error(`Missing fixture user ${email}`);
    const session = await t.run((ctx) =>
      ctx.db.insert("authSessions", { userId: user._id, expirationTime: Date.now() + 3600000 }),
    );
    return { user, client: t.withIdentity({ subject: `${user._id}|${session}` }) };
  };
  return {
    t,
    parent: await login("parent@wgjs.example"),
    teacher: await login("teacher@wgjs.example"),
    finance: await login("finance@wgjs.example"),
    admin: await login("admin@wgjs.example"),
  };
}

it("enquiry journey: parent asks, school assigns and replies, parent sees only the family reply, staff resolve", async () => {
  const { parent, teacher, finance, admin } = await setup();
  const enquiryId = (await parent.client.mutation(api.workflows.submit, {
    action: "enquiryCreate",
    values: {
      subject: "Homework help",
      department: "Academic",
      body: "Which pages?",
      learnerId: "",
    },
  })) as Id<"enquiries">;

  const mine = await parent.client.query(api.schoolRead.page, { module: "contact", ...page });
  expect(mine.page.map((r) => r.id)).toContain(enquiryId);
  await expect(
    finance.client.query(api.schoolRead.detail, { module: "contact", itemId: enquiryId }),
  ).rejects.toThrow();

  await admin.client.mutation(api.workflows.submit, {
    action: "enquiryAssign",
    itemId: enquiryId,
    values: { department: "Academic", assigneeId: teacher.user._id },
  });
  for (const [body, internal] of [
    ["Staff-only note", "true"],
    ["Pages 12 to 14.", "false"],
  ] as const)
    await teacher.client.mutation(api.workflows.submit, {
      action: "enquiryReply",
      itemId: enquiryId,
      values: { body, internal },
    });

  const thread = await parent.client.query(api.schoolRead.page, {
    module: "enquiryMessages",
    parentId: enquiryId,
    ...page,
  });
  const bodies = thread.page.map((r) => r.body);
  expect(bodies).toContain("Pages 12 to 14.");
  expect(bodies).not.toContain("Staff-only note");

  await teacher.client.mutation(api.workflows.submit, {
    action: "enquiryResolve",
    itemId: enquiryId,
    values: {},
  });
  const resolved = await parent.client.query(api.schoolRead.detail, {
    module: "contact",
    itemId: enquiryId,
  });
  expect(resolved.record.status).toBe("Resolved");
}, 30000);

it("report journey: teacher uploads, Administrator reviews and releases, only the linked guardian downloads", async () => {
  const { parent, teacher, finance, admin } = await setup();
  const learner = (await parent.client.query(api.users.current, {}))!.learners[0]!;
  const bytes = new TextEncoder().encode("%PDF-1.4\nFictional journey report\n%%EOF").buffer;
  const reportId = await teacher.client.action(api.workflows.uploadReport, {
    learnerId: learner.id,
    title: "Journey report",
    term: "Term 4",
    fileName: "journey.pdf",
    bytes,
  });

  // Draft and reviewed reports stay hidden from the guardian.
  await expect(parent.client.action(api.workflows.reportFile, { reportId })).rejects.toThrow();
  await admin.client.mutation(api.workflows.submit, {
    action: "reportReview",
    itemId: reportId,
    values: {},
  });
  await expect(parent.client.action(api.workflows.reportFile, { reportId })).rejects.toThrow();
  await admin.client.mutation(api.workflows.submit, {
    action: "reportRelease",
    itemId: reportId,
    values: {},
  });

  const released = await parent.client.query(api.schoolRead.page, {
    module: "reports",
    learnerId: learner.id,
    ...page,
  });
  expect(released.page.map((r) => r.id)).toContain(reportId);
  const file = await parent.client.action(api.workflows.reportFile, { reportId });
  expect(new TextDecoder().decode(file.bytes)).toContain("Fictional journey report");
  await expect(finance.client.action(api.workflows.reportFile, { reportId })).rejects.toThrow();
}, 30000);
