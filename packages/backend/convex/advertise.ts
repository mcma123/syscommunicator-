// Public "Advertise with us" endpoints. These are the documented unauthenticated
// exceptions for advertising (AUTHORIZATION.md): rounded reach figures, the business
// enquiry form and unsubscribing. None of them reveals personal or school records.
import { ConvexError, v } from "convex/values";
import { RateLimiter, HOUR } from "@convex-dev/rate-limiter";
import { normalizeImportEmail, normalizeImportPhone } from "@school-connect/core/imports";
import { ADVERTISER_CATEGORIES, ADVERTISING } from "@school-connect/core/advertising";
import { action, env, internalMutation, mutation, query } from "./_generated/server";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { unsubscribeTokenMatches } from "./lib/advertiserToken";

const limiter = new RateLimiter(components.notificationRateLimiter, {
  advertiseEnquiry: { kind: "fixed window", rate: 30, period: HOUR },
  advertiseEnquiryEmail: { kind: "fixed window", rate: 3, period: 24 * HOUR },
});

/** Rounds down to a multiple of ten so the public page never shows exact small counts. */
const roundDown = (n: number) => (n < 10 ? 0 : Math.floor(n / 10) * 10);

/** Rounded reach figures and the school name, refreshed daily by `advertisers.refreshReach`. */
export const reach = query({
  args: {},
  returns: v.object({
    school: v.string(),
    families: v.number(),
    learners: v.number(),
    weeklyFamilies: v.number(),
    adViews30: v.number(),
    updatedAt: v.union(v.number(), v.null()),
  }),
  handler: async (ctx) => {
    const school = (await ctx.db.query("schools").take(1))[0];
    const stats = await ctx.db
      .query("siteStats")
      .withIndex("by_key", (q) => q.eq("key", "reach"))
      .unique();
    return {
      school: school?.name ?? "our school",
      families: roundDown(stats?.families ?? 0),
      learners: roundDown(stats?.learners ?? 0),
      weeklyFamilies: roundDown(stats?.weeklyFamilies ?? 0),
      adViews30: roundDown(stats?.adViews30 ?? 0),
      updatedAt: stats?.updatedAt ?? null,
    };
  },
});

const enquiryArgs = {
  businessName: v.string(),
  contactName: v.string(),
  email: v.string(),
  phone: v.string(),
  category: v.string(),
  message: v.string(),
  consentEmail: v.boolean(),
  consentWhatsApp: v.boolean(),
};
function invalid(message: string): never {
  throw new ConvexError({ code: "INVALID", message });
}
const text = (value: string, label: string, min: number, max: number) => {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length < min || clean.length > max)
    invalid(`${label}: enter between ${min} and ${max} characters.`);
  return clean;
};

/** Validates and stores an enquiry; repeats from the same email update the existing lead. */
export const createLead = internalMutation({
  args: enquiryArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const email = normalizeImportEmail(args.email);
    if (!email) invalid("Enter a valid email address.");
    const businessName = text(args.businessName, "Business name", 2, 120);
    const contactName = text(args.contactName, "Your name", 2, 120);
    const phoneRaw = args.phone.trim();
    const phone = phoneRaw ? normalizeImportPhone(phoneRaw) : undefined;
    if (phone === null) invalid("Enter a valid phone number.");
    if (args.consentWhatsApp && !phone) invalid("Add a phone number for WhatsApp.");
    const category = (ADVERTISER_CATEGORIES as readonly string[]).includes(args.category)
      ? args.category
      : undefined;
    const message = args.message.trim().slice(0, 1000) || undefined;
    await limiter.limit(ctx, "advertiseEnquiry", { throws: true });
    await limiter.limit(ctx, "advertiseEnquiryEmail", { key: email, throws: true });

    const now = Date.now();
    const consentText = [
      args.consentEmail ? ADVERTISING.consentEmail : "",
      args.consentWhatsApp ? ADVERTISING.consentWhatsApp : "",
    ]
      .filter(Boolean)
      .join(" ");
    const consent = {
      consentEmail: args.consentEmail,
      consentWhatsApp: args.consentWhatsApp,
      ...(consentText ? { consentAt: now, consentText } : {}),
    };
    const existing = await ctx.db
      .query("advertisers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    let id: Id<"advertisers">;
    if (existing) {
      id = existing._id;
      const restart =
        args.consentEmail && existing.nextSendAt === undefined && existing.sequenceStep === 0;
      await ctx.db.patch("advertisers", id, {
        businessName,
        contactName,
        ...(phone ? { phone } : {}),
        ...(category ? { category } : {}),
        ...(message ? { message } : {}),
        ...consent,
        status:
          existing.status === "Unsubscribed"
            ? args.consentEmail
              ? "Lead"
              : "Unsubscribed"
            : existing.status,
        ...(restart ? { nextSendAt: now } : {}),
        ...(args.consentEmail ? {} : { nextSendAt: undefined }),
        seenByStaff: false,
        updatedAt: now,
      });
    } else {
      id = await ctx.db.insert("advertisers", {
        businessName,
        contactName,
        email,
        ...(phone ? { phone } : {}),
        ...(category ? { category } : {}),
        ...(message ? { message } : {}),
        source: "Website",
        status: "Lead",
        ...consent,
        sequenceStep: 0,
        ...(args.consentEmail ? { nextSendAt: now } : {}),
        seenByStaff: false,
        updatedAt: now,
      });
    }
    await ctx.db.insert("auditLog", {
      action: existing ? "advertiser.enquiry.updated" : "advertiser.enquiry.created",
      targetTable: "advertisers",
      targetId: id,
      summary: `Website enquiry: ${businessName}${args.consentEmail ? " (email consent)" : ""}`,
    });
    if (args.consentEmail) await ctx.scheduler.runAfter(0, internal.advertiserEmail.sendDue, {});
    return null;
  },
});

async function turnstileOk(token: string) {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // Not configured: rate limits still apply (see OPERATIONS.md).
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  if (!result.ok) return false;
  const data = (await result.json()) as { success?: boolean };
  return data.success === true;
}

/**
 * Public enquiry form. `website` is a honeypot (humans leave it empty). The reply is the
 * same whether the email is new or known, so the form cannot be used to probe leads.
 */
export const enquire = action({
  args: { ...enquiryArgs, website: v.string(), turnstileToken: v.string() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, { website, turnstileToken, ...args }) => {
    if (website.trim() !== "") return { ok: true };
    if (!(await turnstileOk(turnstileToken)))
      throw new ConvexError({
        code: "INVALID",
        message: "Please complete the security check and try again.",
      });
    await ctx.runMutation(internal.advertise.createLead, args);
    return { ok: true };
  },
});

/** Confirmed from the unsubscribe page; stops all advertising email for this business. */
export const unsubscribe = mutation({
  args: { advertiserId: v.string(), token: v.string() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, { advertiserId, token }) => {
    const id = ctx.db.normalizeId("advertisers", advertiserId);
    if (!id || !unsubscribeTokenMatches(id, token)) return { ok: false };
    const advertiser = await ctx.db.get("advertisers", id);
    if (!advertiser) return { ok: false };
    if (advertiser.status === "Unsubscribed" && !advertiser.consentEmail) return { ok: true };
    await ctx.db.patch("advertisers", id, {
      status: "Unsubscribed",
      consentEmail: false,
      consentWhatsApp: false,
      nextSendAt: undefined,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      action: "advertiser.unsubscribed",
      targetTable: "advertisers",
      targetId: id,
      summary: advertiser.businessName,
    });
    return { ok: true };
  },
});
