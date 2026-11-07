/// <reference types="vite/client" />
import aggregateTest from "@convex-dev/aggregate/test";
import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import workpoolTest from "@convex-dev/workpool/test";
import type { WorkId } from "@convex-dev/workpool";
import { convexTest } from "convex-test";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import schema from "./schema";
import { CONSENT_DECISIONS } from "@school-connect/core/domain";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { nextNotificationTime } from "./lib/notificationRules";
const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts", "!./convex.config.ts"]);
const PROJECT = "6cd3c02c-5a24-4596-84b0-7048bf2c7ea8";
const TOKEN = "ExpoPushToken[private-test-device]";
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse("2026-11-07T10:00:00Z"));
  vi.stubEnv("ENABLE_DEMO_ACCOUNTS", "true");
  vi.stubEnv("NOTIFICATION_DELIVERY_ENABLED", "true");
  vi.stubEnv("EXPO_PROJECT_ID", PROJECT);
  vi.stubEnv("RESEND_API_KEY", "fake-key");
  vi.stubEnv("AUTH_EMAIL_FROM", "School <school@sender.test>");
  vi.stubEnv("SITE_URL", "https://school.test");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function setup() {
  const t = convexTest(schema, modules);
  aggregateTest.register(t, "dashboardAggregate");
  workpoolTest.register(t, "notificationWorkpool");
  workpoolTest.register(t, "notificationEmailWorkpool");
  registerRateLimiter(t, "notificationRateLimiter");
  await t.action(internal.seedFiles.run, {});
  const login = async (email: string) => {
    const user = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .unique(),
    );
    if (!user) throw new Error("Missing user");
    const session = await t.run((ctx) =>
      ctx.db.insert("authSessions", { userId: user._id, expirationTime: Date.now() + 86400000 }),
    );
    return { user, session, client: t.withIdentity({ subject: `${user._id}|${session}` }) };
  };
  const parent = await login("parent@wgjs.example"),
    admin = await login("admin@wgjs.example"),
    finance = await login("finance@wgjs.example");
  const register = () =>
    parent.client.mutation(api.notifications.registerDevice, {
      token: TOKEN,
      platform: "android",
      projectId: PROJECT,
    });
  const publish = async (urgent = false) => {
    const id = await admin.client.mutation(api.workflows.submit, {
      action: "noticeSave",
      values: {
        title: "Private school title",
        body: "Private learner and school content",
        category: "General",
        audience: JSON.stringify([{ kind: "School" }]),
        urgent: String(urgent),
        requiresAcknowledgement: "true",
      },
    });
    for (const action of ["noticeReview", "noticePublish"] as const)
      await admin.client.mutation(api.workflows.submit, { action, itemId: id, values: {} });
    const n = await t.run((ctx) => ctx.db.get("notices", id as Id<"notices">));
    await t.mutation(internal.workflows.receipts, {
      noticeId: n!._id,
      revision: n!.revision!,
      cursor: null,
    });
    return n!;
  };
  const rows = () =>
    t.run((ctx) =>
      ctx.db
        .query("notificationDeliveries")
        .withIndex("by_userId", (q) => q.eq("userId", parent.user._id))
        .take(50),
    );
  const send = async (deliveryId: Id<"notificationDeliveries">) => {
    await t.mutation(internal.notificationJobs.dispatch, { deliveryId });
    const d = await t.run((ctx) => ctx.db.get("notificationDeliveries", deliveryId));
    if (d?.state !== "Sending") return;
    const result = await t.action(internal.notificationJobs.send, { deliveryId, run: d.run });
    await t.mutation(internal.notificationJobs.completed, {
      context: { deliveryId, run: d.run },
      workId: d.workId as WorkId,
      result: { kind: "success", returnValue: result },
    });
  };
  return { t, parent, admin, finance, register, publish, rows, send };
}
it("binds devices to the current session/project, enforces ownership and hides push tokens", async () => {
  const { t, parent, admin, register } = await setup();
  await expect(
    t.mutation(api.notifications.registerDevice, {
      token: TOKEN,
      platform: "android",
      projectId: PROJECT,
    }),
  ).rejects.toThrow();
  await expect(
    parent.client.mutation(api.notifications.registerDevice, {
      token: TOKEN,
      platform: "android",
      projectId: "other-project",
    }),
  ).rejects.toThrow();
  await expect(
    parent.client.mutation(api.notifications.registerDevice, {
      token: "native-token",
      platform: "android",
      projectId: PROJECT,
    }),
  ).rejects.toThrow();
  await register();
  await register();
  const records = await t.run((ctx) =>
    ctx.db
      .query("pushTokens")
      .withIndex("by_userId", (q) => q.eq("userId", parent.user._id))
      .take(10),
  );
  expect(records).toHaveLength(1);
  expect(records[0].sessionId).toBe(parent.session);
  await admin.client.mutation(api.notifications.unregisterDevice, { token: TOKEN });
  expect((await parent.client.query(api.notifications.configuration, {})).registeredDevices).toBe(
    1,
  );
  expect(
    JSON.stringify(await parent.client.query(api.notifications.configuration, {})),
  ).not.toContain(TOKEN);
  // A phone switching accounts transfers its token; the former account cannot remove it.
  await admin.client.mutation(api.notifications.registerDevice, {
    token: TOKEN,
    platform: "android",
    projectId: PROJECT,
  });
  await parent.client.mutation(api.notifications.unregisterDevice, { token: TOKEN });
  expect((await admin.client.query(api.notifications.configuration, {})).registeredDevices).toBe(1);
  await t.run(async (ctx) => {
    for (let i = 0; i < 2; i++)
      await ctx.db.insert("pushTokens", {
        userId: parent.user._id,
        token: `ExpoPushToken[old-${i}]`,
        platform: "android",
      });
  });
  await register();
  expect((await parent.client.query(api.notifications.configuration, {})).registeredDevices).toBe(
    1,
  );
}, 15000);

it("fans out once, separates provider acceptance/confirmation/read/ack and scopes delivery history", async () => {
  const { t, parent, admin, finance, register, publish, rows, send } = await setup();
  await register();
  await t.run((ctx) =>
    ctx.db.patch("users", parent.user._id, {
      email: "guardian@school.test",
      emailVerificationTime: Date.now(),
    }),
  );
  const fetcher = vi.fn(async (url: string) =>
    url.includes("getReceipts")
      ? Response.json({ data: { ticket1: { status: "ok" } } })
      : url.includes("/emails/email1")
        ? Response.json({ last_event: "delivered" })
        : url.includes("exp.host")
          ? Response.json({ data: { status: "ok", id: "ticket1" } })
          : Response.json({ id: "email1" }),
  );
  vi.stubGlobal("fetch", fetcher);
  const notice = await publish(true);
  await t.mutation(internal.workflows.receipts, {
    noticeId: notice._id,
    revision: notice.revision!,
    cursor: null,
  });
  expect(await rows()).toHaveLength(2);
  for (const d of await rows()) await send(d._id);
  expect((await rows()).every((r) => r.state === "Accepted")).toBe(true);
  expect(
    (
      await t.run((ctx) =>
        ctx.db
          .query("noticeReceipts")
          .withIndex("by_noticeId", (q) => q.eq("noticeId", notice._id))
          .first(),
      )
    )?.notificationDeliveredAt,
  ).toBeUndefined();
  const bodies = fetcher.mock.calls.map((call) => JSON.stringify(call));
  expect(bodies.join()).not.toContain(notice.body);
  for (const d of await rows())
    await t.action(internal.notificationJobs.poll, { deliveryId: d._id });
  expect((await rows()).every((r) => r.state === "Delivered")).toBe(true);
  const receipt = await t.run((ctx) =>
    ctx.db
      .query("noticeReceipts")
      .withIndex("by_noticeId", (q) => q.eq("noticeId", notice._id))
      .first(),
  );
  expect(receipt?.notificationDeliveredAt).toBeDefined();
  expect(receipt?.readAt).toBeUndefined();
  expect(receipt?.acknowledgedAt).toBeUndefined();
  const opts = { paginationOpts: { numItems: 20, cursor: null } };
  expect(
    (await admin.client.query(api.notifications.history, { noticeId: notice._id, ...opts })).page,
  ).toHaveLength(2);
  await expect(
    parent.client.query(api.notifications.history, { noticeId: notice._id, ...opts }),
  ).rejects.toThrow();
  await expect(
    finance.client.query(api.notifications.history, { noticeId: notice._id, ...opts }),
  ).rejects.toThrow();
  expect(JSON.stringify(await parent.client.query(api.notifications.history, opts))).not.toContain(
    TOKEN,
  );
}, 15000);

it("respects disabled channels/categories and never sends outside current guardian scope", async () => {
  const { t, parent, register, publish, rows, send } = await setup();
  await register();
  const pref = await t.run((ctx) =>
    ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", parent.user._id))
      .unique(),
  );
  await t.run((ctx) =>
    ctx.db.patch("notificationPreferences", pref!._id, { pushEnabled: false, emailEnabled: false }),
  );
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await publish(true);
  for (const d of await rows()) await send(d._id);
  expect((await rows()).every((r) => r.state === "Skipped")).toBe(true);
  expect(fetcher).not.toHaveBeenCalled();
  await t.run((ctx) =>
    ctx.db.patch("notificationPreferences", pref!._id, {
      pushEnabled: true,
      mutedCategories: ["General"],
    }),
  );
  await publish();
  for (const d of (await rows()).filter((r) => r.state === "Pending")) await send(d._id);
  expect((await rows()).every((r) => r.state === "Skipped")).toBe(true);
});
it("defers during quiet hours, then rechecks revoked sessions and changed preferences before transport", async () => {
  const { t, parent, register, publish, rows, send } = await setup();
  await register();
  vi.setSystemTime(Date.parse("2026-11-07T20:00:00Z"));
  const pref = await t.run((ctx) =>
    ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", parent.user._id))
      .unique(),
  );
  await t.run((ctx) =>
    ctx.db.patch("notificationPreferences", pref!._id, {
      quietHoursStart: "21:00",
      quietHoursEnd: "06:00",
    }),
  );
  await publish();
  const d = (await rows())[0];
  await send(d._id);
  expect((await rows())[0].state).toBe("Deferred");
  vi.setSystemTime(Date.parse("2026-11-08T04:00:00Z"));
  await t.run((ctx) => ctx.db.delete("authSessions", parent.session));
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await send(d._id);
  expect((await rows())[0].state).toBe("Skipped");
  expect(fetcher).not.toHaveBeenCalled();
});
it("rechecks source visibility and guardian linkage after enqueueing", async () => {
  const { t, parent, register, publish, rows, send } = await setup();
  await register();
  await publish();
  const links = await t.run((ctx) =>
    ctx.db
      .query("guardianLinks")
      .withIndex("by_guardianId", (q) => q.eq("guardianId", parent.user._id))
      .take(20),
  );
  for (const l of links) await t.run((ctx) => ctx.db.delete("guardianLinks", l._id));
  for (const d of await rows()) await send(d._id);
  expect((await rows())[0].state).toBe("Skipped");
});
it("blocks missing configuration honestly, restricts retries and removes invalid Expo devices", async () => {
  const { t, parent, admin, finance, register, publish, rows, send } = await setup();
  await register();
  vi.stubEnv("NOTIFICATION_DELIVERY_ENABLED", "false");
  await publish();
  const d = (await rows())[0];
  await send(d._id);
  expect((await rows())[0].state).toBe("Blocked");
  for (const caller of [parent.client, finance.client])
    await expect(caller.mutation(api.notifications.retry, { deliveryId: d._id })).rejects.toThrow();
  vi.stubEnv("NOTIFICATION_DELIVERY_ENABLED", "true");
  await admin.client.mutation(api.notifications.retry, { deliveryId: d._id });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ data: { status: "error", details: { error: "DeviceNotRegistered" } } }),
    ),
  );
  await send(d._id);
  expect((await rows())[0].state).toBe("Failed");
  expect((await parent.client.query(api.notifications.configuration, {})).registeredDevices).toBe(
    0,
  );
});
it("uses the workpool for bounded provider delivery and retries idempotent email failures", async () => {
  const { t, parent, register, publish, rows } = await setup();
  await register();
  await t.run((ctx) =>
    ctx.db.patch("users", parent.user._id, {
      email: "guardian@school.test",
      emailVerificationTime: Date.now(),
    }),
  );
  let emailAttempts = 0;
  const keys: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("exp.host")) return Response.json({ data: { status: "ok", id: "ticket" } });
      keys.push((init?.headers as Record<string, string>)["Idempotency-Key"]);
      emailAttempts++;
      return emailAttempts === 1
        ? new Response("", { status: 429 })
        : Response.json({ id: "email-retried" });
    }),
  );
  await publish(true);
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(emailAttempts).toBe(2);
  expect(new Set(keys).size).toBe(1);
  expect((await rows()).every((r) => r.state === "Accepted")).toBe(true);
}, 20000);
it("queues one consent reminder per outstanding family/target and cancels sends after a response", async () => {
  const { t, parent, admin, register, rows, send } = await setup();
  await register();
  const requestId = (await admin.client.mutation(api.workflows.submit, {
    action: "consentCreate",
    values: {
      title: "Fictional consent",
      description: "Review the form",
      audience: JSON.stringify([{ kind: "School" }]),
      dueAt: "2026-11-08T10:00",
    },
  })) as Id<"consentRequests">;
  await t.mutation(internal.notificationJobs.consentRecipients, { requestId, cursor: null });
  await t.mutation(internal.notificationJobs.consentRecipients, { requestId, cursor: null });
  expect(await rows()).toHaveLength(2);
  const links = await t.run((ctx) =>
    ctx.db
      .query("guardianLinks")
      .withIndex("by_guardianId", (q) => q.eq("guardianId", parent.user._id))
      .take(20),
  );
  for (const l of links)
    await parent.client.mutation(api.workflows.submit, {
      action: "consentRespond",
      itemId: requestId,
      values: {
        learnerId: l.learnerId,
        decision: CONSENT_DECISIONS[0],
        contactPhone: "+27820000000",
        notes: "",
      },
    });
  for (const d of await rows()) await send(d._id);
  expect((await rows()).every((r) => r.state === "Skipped")).toBe(true);
});
it("expires pending invitations with an audit entry and preserves accepted invitations", async () => {
  const { t, admin } = await setup();
  const ids = await t.run(async (ctx) =>
    Promise.all(
      (["Pending", "Accepted"] as const).map((status) =>
        ctx.db.insert("invitations", {
          email: "invite@school.test",
          kind: "Guardian",
          learnerIds: [],
          tokenHash: status,
          status,
          expiresAt: Date.now() - 1,
          invitedBy: admin.user._id,
        }),
      ),
    ),
  );
  await t.mutation(internal.notificationJobs.expireInvitations, {});
  expect((await t.run((ctx) => ctx.db.get("invitations", ids[0])))?.status).toBe("Expired");
  expect((await t.run((ctx) => ctx.db.get("invitations", ids[1])))?.status).toBe("Accepted");
  expect(
    await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_targetTable_and_targetId", (q) =>
          q.eq("targetTable", "invitations").eq("targetId", ids[0]),
        )
        .take(10),
    ),
  ).toHaveLength(1);
});
it("does not use guardian access to retain staff delivery/receipt access after a teacher loses her class", async () => {
  const { t, parent, admin } = await setup();
  const { classId, assignment } = await t.run(async (ctx) => {
    const link = (await ctx.db
      .query("guardianLinks")
      .withIndex("by_guardianId", (q) => q.eq("guardianId", parent.user._id))
      .first())!;
    const learner = (await ctx.db.get("learners", link.learnerId))!;
    await ctx.db.insert("staffRoles", { userId: parent.user._id, role: "Teacher" });
    const assignment = await ctx.db.insert("teachingAssignments", {
      staffId: parent.user._id,
      classId: learner.classId,
    });
    return { classId: learner.classId, assignment };
  });
  const noticeId = (await parent.client.mutation(api.workflows.submit, {
    action: "noticeSave",
    values: {
      title: "Class notice",
      body: "Class update",
      category: "General",
      audience: JSON.stringify([{ kind: "Class", classId }]),
      urgent: "false",
      requiresAcknowledgement: "false",
    },
  })) as Id<"notices">;
  await parent.client.mutation(api.workflows.submit, {
    action: "noticeReview",
    itemId: noticeId,
    values: {},
  });
  await admin.client.mutation(api.workflows.submit, {
    action: "noticePublish",
    itemId: noticeId,
    values: {},
  });
  const options = { paginationOpts: { numItems: 20, cursor: null } };
  await parent.client.query(api.notifications.history, { noticeId, ...options });
  await t.run((ctx) => ctx.db.delete("teachingAssignments", assignment));
  expect((await parent.client.query(api.notices.get, { noticeId })).status).toBe("Published");
  await expect(
    parent.client.query(api.notifications.history, { noticeId, ...options }),
  ).rejects.toThrow();
  await expect(
    parent.client.query(api.schoolRead.page, {
      module: "noticeReceipts",
      parentId: noticeId,
      ...options,
    }),
  ).rejects.toThrow();
  const detail = await parent.client.query(api.schoolRead.detail, {
    module: "messages",
    itemId: noticeId,
  });
  expect(detail.related.some((r) => r.module === "noticeReceipts")).toBe(false);
});
it("calculates Johannesburg quiet windows across midnight, daytime and equal endpoints", () => {
  const time = (value: string) => Date.parse(`2026-11-07T${value}:00+02:00`);
  expect(nextNotificationTime(time("22:00"), "21:00", "06:00")).toBe(time("06:00") + 86400000);
  expect(nextNotificationTime(time("05:00"), "21:00", "06:00")).toBe(time("06:00"));
  expect(nextNotificationTime(time("12:00"), "09:00", "13:00")).toBe(time("13:00"));
  expect(nextNotificationTime(time("12:00"), "12:00", "12:00")).toBe(time("12:00"));
  expect(nextNotificationTime(time("06:00"), "21:00", "06:00")).toBe(time("06:00"));
});
