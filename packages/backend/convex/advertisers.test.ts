/// <reference types="vite/client" />
import aggregateTest from "@convex-dev/aggregate/test";
import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { unsubscribeToken } from "./lib/advertiserToken";
import { sequenceEmail } from "./advertiserEmail";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts", "!./convex.config.ts"]);
const DAY = 86400000;
const sent: { to: string[]; subject: string; text: string; headers: Record<string, string> }[] = [];

beforeEach(() => {
  sent.length = 0;
  vi.stubEnv("ENABLE_DEMO_ACCOUNTS", "true");
  vi.stubEnv("AD_MEDIA_SIGNING_KEY", "k".repeat(48));
  vi.stubEnv("SITE_URL", "https://school.example");
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("AUTH_EMAIL_FROM", "WGJS <hello@school.example>");
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    if (url.startsWith("https://api.resend.com/")) {
      sent.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ id: `email-${sent.length}` }), { status: 200 });
    }
    if (url.includes("turnstile")) {
      const ok = String(init.body).includes("response=good");
      return new Response(JSON.stringify({ success: ok }), { status: 200 });
    }
    throw new Error(`Unexpected fetch ${url}`);
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function setup() {
  const t = convexTest(schema, modules);
  aggregateTest.register(t, "dashboardAggregate");
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
      ctx.db.insert("authSessions", { userId: user._id, expirationTime: Date.now() + DAY }),
    );
    return t.withIdentity({ subject: `${user._id}|${session}` });
  };
  return {
    t,
    principal: await login("principal@wgjs.example"),
    teacher: await login("teacher@wgjs.example"),
    parent: await login("parent@wgjs.example"),
  };
}
const enquiry = (over: Partial<Record<string, unknown>> = {}) => ({
  businessName: "Sunny Bakery",
  contactName: "Thandi Mokoena",
  email: "Thandi@SunnyBakery.co.za",
  phone: "082 555 0100",
  category: "Food & drink",
  message: "Interested in the term package",
  consentEmail: true,
  consentWhatsApp: false,
  website: "",
  turnstileToken: "",
  ...over,
});
const lead = (t: Awaited<ReturnType<typeof setup>>["t"]) =>
  t.run((ctx) =>
    ctx.db
      .query("advertisers")
      .withIndex("by_email", (q) => q.eq("email", "thandi@sunnybakery.co.za"))
      .unique(),
  );

it("stores a consented enquiry and runs the follow-up sequence with unsubscribe links", async () => {
  const { t } = await setup();
  expect(await t.action(api.advertise.enquire, enquiry())).toEqual({ ok: true });
  const created = await lead(t);
  expect(created).toMatchObject({
    status: "Lead",
    source: "Website",
    consentEmail: true,
    sequenceStep: 0,
    seenByStaff: false,
  });
  expect(created!.consentText).toMatch(/email me about advertising/);

  await t.action(internal.advertiserEmail.sendDue, {});
  expect(sent).toHaveLength(1);
  expect(sent[0]!.to).toEqual(["thandi@sunnybakery.co.za"]);
  expect(sent[0]!.subject).toMatch(/Sunny Bakery/);
  const token = unsubscribeToken(created!._id);
  expect(sent[0]!.text).toContain(`/advertise/unsubscribe?a=${created!._id}&t=${token}`);
  expect(sent[0]!.headers["List-Unsubscribe"]).toContain("/advertise/unsubscribe");
  const afterFirst = await lead(t);
  expect(afterFirst!.sequenceStep).toBe(1);
  expect(afterFirst!.nextSendAt! - Date.now()).toBeGreaterThan(2.9 * DAY);

  // Not due yet: nothing else goes out.
  await t.action(internal.advertiserEmail.sendDue, {});
  expect(sent).toHaveLength(1);

  // Unsubscribing (with the right token only) stops the sequence for good.
  expect(
    await t.mutation(api.advertise.unsubscribe, {
      advertiserId: created!._id,
      token: "0".repeat(64),
    }),
  ).toEqual({ ok: false });
  expect(
    await t.mutation(api.advertise.unsubscribe, { advertiserId: created!._id, token: token! }),
  ).toEqual({ ok: true });
  await t.run((ctx) => ctx.db.patch("advertisers", created!._id, { nextSendAt: Date.now() - 1 }));
  await t.action(internal.advertiserEmail.sendDue, {});
  expect(sent).toHaveLength(1);
  expect(await lead(t)).toMatchObject({ status: "Unsubscribed", consentEmail: false });
});

it("never emails a lead without consent and skips when email is not configured", async () => {
  const { t } = await setup();
  await t.action(api.advertise.enquire, enquiry({ consentEmail: false }));
  await t.action(internal.advertiserEmail.sendDue, {});
  expect(sent).toHaveLength(0);
  expect((await lead(t))!.nextSendAt).toBeUndefined();

  vi.stubEnv("RESEND_API_KEY", "");
  await t.action(api.advertise.enquire, enquiry());
  await t.action(internal.advertiserEmail.sendDue, {});
  expect(sent).toHaveLength(0);
  const log = await t.run((ctx) => ctx.db.query("advertiserEmails").take(5));
  expect(log).toMatchObject([{ status: "Skipped" }]);
  expect((await lead(t))!.sequenceStep).toBe(0);
});

it("validates input, ignores the honeypot, checks Turnstile and rate-limits per email", async () => {
  const { t } = await setup();
  await expect(t.action(api.advertise.enquire, enquiry({ email: "nope" }))).rejects.toThrow(
    /valid email/,
  );
  await expect(
    t.action(api.advertise.enquire, enquiry({ consentWhatsApp: true, phone: "" })),
  ).rejects.toThrow(/phone number for WhatsApp/);
  expect(await t.action(api.advertise.enquire, enquiry({ website: "spam.example" }))).toEqual({
    ok: true,
  });
  expect(await lead(t)).toBeNull();

  vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
  await expect(t.action(api.advertise.enquire, enquiry({ turnstileToken: "bad" }))).rejects.toThrow(
    /security check/,
  );
  for (let i = 0; i < 3; i++)
    await t.action(api.advertise.enquire, enquiry({ turnstileToken: "good" }));
  await expect(
    t.action(api.advertise.enquire, enquiry({ turnstileToken: "good" })),
  ).rejects.toThrow();
  // Repeats update one lead instead of creating duplicates.
  const rows = await t.run((ctx) => ctx.db.query("advertisers").take(10));
  expect(rows).toHaveLength(1);
});

it("publishes only rounded reach figures", async () => {
  const { t } = await setup();
  await t.mutation(internal.advertisers.refreshReach, {});
  const stored = await t.run((ctx) => ctx.db.query("siteStats").unique());
  const reach = await t.query(api.advertise.reach, {});
  expect(reach.families % 10).toBe(0);
  expect(reach.families).toBeLessThanOrEqual(stored!.families);
  expect(Object.keys(reach).sort()).toEqual(
    ["adViews30", "families", "learners", "school", "updatedAt", "weeklyFamilies"].sort(),
  );
});

it("lets school leaders manage advertisers, link ads and nobody else", async () => {
  const { t, principal, teacher, parent } = await setup();
  await t.action(api.advertise.enquire, enquiry());
  for (const client of [teacher, parent]) {
    await expect(client.query(api.advertisers.list, {})).rejects.toThrow(/cannot access/);
    expect(await client.query(api.advertisers.unseen, {})).toBe(0);
  }
  expect(await principal.query(api.advertisers.unseen, {})).toBe(1);
  const [row] = await principal.query(api.advertisers.list, {});
  expect(row).toMatchObject({ businessName: "Sunny Bakery", isNew: true, consentEmail: true });
  await principal.mutation(api.advertisers.update, { advertiserId: row!.id, seen: true });
  await principal.mutation(api.advertisers.update, { advertiserId: row!.id, status: "Active" });
  await expect(
    principal.mutation(api.advertisers.update, { advertiserId: row!.id, status: "Unsubscribed" }),
  ).rejects.toThrow(/Only the business/);

  const manual = await principal.mutation(api.advertisers.create, {
    businessName: "Corner Pharmacy",
    contactName: "Ravi Naidoo",
    email: "ravi@pharmacy.example",
    phone: "",
    category: "Health & beauty",
    notes: "Met at the market day",
    consentEmail: false,
  });
  await expect(
    principal.mutation(api.advertisers.create, {
      businessName: "Again",
      contactName: "Ravi",
      email: "RAVI@pharmacy.example",
      phone: "",
      category: "",
      notes: "",
      consentEmail: false,
    }),
  ).rejects.toThrow(/already in the list/);

  const adId = await t.run(async (ctx) => {
    const author = (await ctx.db.query("users").take(1))[0]!;
    return ctx.db.insert("ads", {
      title: "Fresh bread",
      status: "Published",
      startsAt: Date.now() - DAY,
      endsAt: Date.now() + DAY,
      popup: false,
      audiences: [{ kind: "School" }],
      createdBy: author._id,
      updatedAt: Date.now(),
      revision: 1,
    });
  });
  await principal.mutation(api.advertisers.linkAd, { adId, advertiserId: row!.id });
  await expect(
    teacher.mutation(api.advertisers.linkAd, { adId, advertiserId: manual }),
  ).rejects.toThrow(/cannot access/);
  const listed = await principal.query(api.advertisers.list, {});
  expect(listed.find((a) => a.id === row!.id)!.adIds).toEqual([adId as Id<"ads">]);
});

it("writes friendly follow-up copy for every step", () => {
  const c = {
    contactName: "Thandi Mokoena",
    businessName: "Sunny Bakery",
    school: "WGJS",
    families: 420,
  };
  expect(sequenceEmail(0, c)!.text).toMatch(/Hi Thandi,[\s\S]*more than 420 families/);
  expect(sequenceEmail(1, c)!.subject).toMatch(/parents will see/);
  expect(sequenceEmail(2, c)!.subject).toMatch(/Founding-partner/);
  expect(sequenceEmail(3, c)).toBeNull();
});
