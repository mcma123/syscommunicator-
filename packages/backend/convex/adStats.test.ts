/// <reference types="vite/client" />
import aggregateTest from "@convex-dev/aggregate/test";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts", "!./convex.config.ts"]);
const HOUR = 3600000;
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
    if (!user) throw new Error("Missing user");
    const session = await t.run((ctx) =>
      ctx.db.insert("authSessions", { userId: user._id, expirationTime: Date.now() + 86400000 }),
    );
    return t.withIdentity({ subject: `${user._id}|${session}` });
  };
  const ad = (status: "Published" | "Draft", startsAt = Date.now() - HOUR) =>
    t.run(async (ctx) => {
      const author = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", "principal@wgjs.example"))
        .unique();
      return ctx.db.insert("ads", {
        title: "Bake sale",
        status,
        startsAt,
        endsAt: Date.now() + 48 * HOUR,
        popup: true,
        audiences: [{ kind: "School" }],
        createdBy: author!._id,
        updatedAt: Date.now(),
        revision: 1,
      });
    });
  return {
    t,
    ad,
    parent: await login("parent@wgjs.example"),
    principal: await login("principal@wgjs.example"),
    teacher: await login("teacher@wgjs.example"),
    finance: await login("finance@wgjs.example"),
  };
}

it("counts each parent once per day per event and tracks lifetime reach", async () => {
  const { ad, parent, principal } = await setup();
  const adId = await ad("Published");
  for (const event of ["banner", "banner", "popup", "click", "click"] as const)
    await parent.action(api.adStats.track, { adId, event });
  const stats = await principal.query(api.adStats.forAd, { adId });
  expect(stats.totals).toEqual({ impressions: 1, popupViews: 1, clicks: 1, viewers: 1 });
  expect(stats.days).toHaveLength(1);
  expect(stats.days[0]).toMatchObject({ impressions: 1, popupViews: 1, clicks: 1, viewers: 1 });
});

it("counts again the next day without double-counting lifetime reach", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-10T08:00:00+02:00"));
  const { ad, parent, principal } = await setup();
  const adId = await ad("Published");
  await parent.action(api.adStats.track, { adId, event: "banner" });
  vi.setSystemTime(new Date("2026-11-11T08:00:00+02:00"));
  await parent.action(api.adStats.track, { adId, event: "banner" });
  const stats = await principal.query(api.adStats.forAd, { adId });
  expect(stats.totals).toMatchObject({ impressions: 2, viewers: 1 });
  expect(stats.days.map((d) => d.viewers)).toEqual([1, 1]);
  expect(stats.days[0]!.day).toBeGreaterThan(stats.days[1]!.day);
});

it("ignores staff, drafts, scheduled ads and a switched-off Ad Center", async () => {
  const { t, ad, parent, principal, teacher } = await setup();
  const live = await ad("Published");
  await principal.action(api.adStats.track, { adId: live, event: "banner" });
  await teacher.action(api.adStats.track, { adId: live, event: "click" });
  const draft = await ad("Draft");
  const later = await ad("Published", Date.now() + 5 * HOUR);
  await parent.action(api.adStats.track, { adId: draft, event: "banner" });
  await parent.action(api.adStats.track, { adId: later, event: "banner" });
  await t.run(async (ctx) => {
    const school = (await ctx.db.query("schools").take(1))[0]!;
    await ctx.db.patch("schools", school._id, {
      featureFlags: { ...school.featureFlags, ads: false },
    });
  });
  await parent.action(api.adStats.track, { adId: live, event: "banner" });
  const rows = await t.run((ctx) => ctx.db.query("adStats").take(10));
  expect(rows).toEqual([]);
});

it("shows performance only to the ad's editors", async () => {
  const { t, ad, parent, teacher, finance } = await setup();
  const adId = await ad("Published");
  for (const client of [parent, finance, teacher])
    await expect(client.query(api.adStats.forAd, { adId })).rejects.toThrow(/cannot access/);
  await expect(t.action(api.adStats.track, { adId, event: "banner" })).rejects.toThrow();
  const missing = (await t.run(async (ctx) => {
    await ctx.db.delete("ads", adId);
    return adId;
  })) as Id<"ads">;
  await parent.action(api.adStats.track, { adId: missing, event: "banner" });
});
