// Advertiser pipeline for school leaders (Principal/Administrator, Ad Center module):
// enquiries from the public page, leads added in person, linked ads and email history.
// Also the internal reach refresh and email-sequence bookkeeping used by crons.
import { ConvexError, v } from "convex/values";
import { normalizeImportEmail, normalizeImportPhone } from "@school-connect/core/imports";
import { internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { authedMutation, authedQuery } from "./lib/functions";
import { denied, missing, requireModule, wholeSchool, type Actor } from "./lib/auth";
import { advertiserStatus } from "./validators";
import { LIFETIME, statsDay } from "./adStats";

const DAY = 86400000;
/** Follow-up sequence: welcome now, then +3 days, then +7 days. */
export const SEQUENCE_GAPS = [0, 3 * DAY, 7 * DAY] as const;
const SCAN_LIMIT = 5000;

function leader(actor: Actor) {
  requireModule(actor, "ads");
  if (!wholeSchool(actor)) denied();
}
function invalid(message: string): never {
  throw new ConvexError({ code: "INVALID", message });
}

const advertiserView = v.object({
  id: v.id("advertisers"),
  businessName: v.string(),
  contactName: v.string(),
  email: v.string(),
  phone: v.union(v.string(), v.null()),
  category: v.union(v.string(), v.null()),
  message: v.union(v.string(), v.null()),
  source: v.string(),
  status: advertiserStatus,
  consentEmail: v.boolean(),
  consentWhatsApp: v.boolean(),
  consentAt: v.union(v.number(), v.null()),
  notes: v.union(v.string(), v.null()),
  isNew: v.boolean(),
  emailsSent: v.number(),
  nextEmailAt: v.union(v.number(), v.null()),
  adIds: v.array(v.id("ads")),
  createdAt: v.number(),
  updatedAt: v.number(),
});

async function view(ctx: QueryCtx, a: Doc<"advertisers">) {
  const emails = await ctx.db
    .query("advertiserEmails")
    .withIndex("by_advertiserId", (q) => q.eq("advertiserId", a._id))
    .take(50);
  const ads = await ctx.db
    .query("ads")
    .withIndex("by_advertiserId", (q) => q.eq("advertiserId", a._id))
    .take(20);
  return {
    id: a._id,
    businessName: a.businessName,
    contactName: a.contactName,
    email: a.email,
    phone: a.phone ?? null,
    category: a.category ?? null,
    message: a.message ?? null,
    source: a.source,
    status: a.status,
    consentEmail: a.consentEmail,
    consentWhatsApp: a.consentWhatsApp,
    consentAt: a.consentAt ?? null,
    notes: a.notes ?? null,
    isNew: !a.seenByStaff,
    emailsSent: emails.filter((e) => e.status === "Sent").length,
    nextEmailAt: a.nextSendAt ?? null,
    adIds: ads.map((ad) => ad._id),
    createdAt: a._creationTime,
    updatedAt: a.updatedAt,
  };
}

/** Most recently updated advertisers (bounded) for the Ad Center "Advertisers" tab. */
export const list = authedQuery({
  args: {},
  returns: v.array(advertiserView),
  handler: async (ctx) => {
    leader(ctx.actor);
    const rows = await ctx.db
      .query("advertisers")
      .withIndex("by_updatedAt")
      .order("desc")
      .take(200);
    return Promise.all(rows.map((a) => view(ctx, a)));
  },
});

/** Number of enquiries not yet opened by a school leader (Ad Center badge). */
export const unseen = authedQuery({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    if (ctx.actor.disabledModules?.includes("ads") || !wholeSchool(ctx.actor)) return 0;
    const rows = await ctx.db
      .query("advertisers")
      .withIndex("by_seenByStaff", (q) => q.eq("seenByStaff", false))
      .take(100);
    return rows.length;
  },
});

/**
 * Adds a business met in person. Email consent may only be ticked when the business owner
 * agreed to receive advertising emails (POPIA s69); otherwise the school follows up personally.
 */
export const create = authedMutation({
  args: {
    businessName: v.string(),
    contactName: v.string(),
    email: v.string(),
    phone: v.string(),
    category: v.string(),
    notes: v.string(),
    consentEmail: v.boolean(),
  },
  returns: v.id("advertisers"),
  handler: async (ctx, args) => {
    leader(ctx.actor);
    const email = normalizeImportEmail(args.email);
    if (!email) invalid("Enter a valid email address.");
    const businessName = args.businessName.trim();
    const contactName = args.contactName.trim();
    if (businessName.length < 2 || businessName.length > 120) invalid("Enter the business name.");
    if (contactName.length < 2 || contactName.length > 120) invalid("Enter the contact's name.");
    const phone = args.phone.trim() ? normalizeImportPhone(args.phone) : undefined;
    if (phone === null) invalid("Enter a valid phone number.");
    const existing = await ctx.db
      .query("advertisers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existing) invalid(`${existing.businessName} is already in the list.`);
    const now = Date.now();
    const id = await ctx.db.insert("advertisers", {
      businessName,
      contactName,
      email,
      ...(phone ? { phone } : {}),
      ...(args.category.trim() ? { category: args.category.trim().slice(0, 60) } : {}),
      ...(args.notes.trim() ? { notes: args.notes.trim().slice(0, 2000) } : {}),
      source: "Staff",
      status: "Contacted",
      consentEmail: args.consentEmail,
      consentWhatsApp: false,
      ...(args.consentEmail
        ? { consentAt: now, consentText: "Agreed in person to receive advertising emails." }
        : {}),
      sequenceStep: 0,
      ...(args.consentEmail ? { nextSendAt: now } : {}),
      seenByStaff: true,
      createdBy: ctx.actor.user._id,
      updatedAt: now,
    });
    await ctx.audit("advertiser.created", "advertisers", id, businessName);
    return id;
  },
});

/** Status, notes and "opened" marker. Unsubscribed is only set by the business itself. */
export const update = authedMutation({
  args: {
    advertiserId: v.id("advertisers"),
    status: v.optional(advertiserStatus),
    notes: v.optional(v.string()),
    seen: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { advertiserId, status, notes, seen }) => {
    leader(ctx.actor);
    const a = await ctx.db.get("advertisers", advertiserId);
    if (!a) missing();
    if (status === "Unsubscribed" && a.status !== "Unsubscribed")
      invalid("Only the business can unsubscribe, using the link in its emails.");
    if (a.status === "Unsubscribed" && status && status !== "Unsubscribed")
      invalid("This business unsubscribed. Ask them to send a new enquiry to opt in again.");
    await ctx.db.patch("advertisers", a._id, {
      ...(status ? { status } : {}),
      ...(notes !== undefined ? { notes: notes.trim().slice(0, 2000) || undefined } : {}),
      ...(seen ? { seenByStaff: true } : {}),
      ...(status || notes !== undefined ? { updatedAt: Date.now() } : {}),
    });
    await ctx.audit(
      status ? "advertiser.status" : notes !== undefined ? "advertiser.notes" : "advertiser.opened",
      "advertisers",
      a._id,
      status ?? undefined,
    );
    return null;
  },
});

/** Links an ad to the business paying for it (monthly reports use the link), or unlinks it. */
export const linkAd = authedMutation({
  args: { adId: v.id("ads"), advertiserId: v.union(v.id("advertisers"), v.null()) },
  returns: v.null(),
  handler: async (ctx, { adId, advertiserId }) => {
    leader(ctx.actor);
    const ad = await ctx.db.get("ads", adId);
    if (!ad) missing();
    if (advertiserId && !(await ctx.db.get("advertisers", advertiserId))) missing();
    await ctx.db.patch("ads", adId, { advertiserId: advertiserId ?? undefined });
    await ctx.audit(advertiserId ? "ad.advertiser.linked" : "ad.advertiser.unlinked", "ads", adId);
    return null;
  },
});

// ── Internal: reach figures and email bookkeeping ───────────────────────────────

/** Daily: counts families, learners, weekly active families and ad views (bounded scans). */
export const refreshReach = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const links = await ctx.db.query("guardianLinks").take(SCAN_LIMIT);
    const guardians = new Set(links.map((l) => l.guardianId));
    const learners = await ctx.db.query("learners").take(SCAN_LIMIT);
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("by_creation_time", (q) => q.gt("_creationTime", now - 7 * DAY))
      .take(SCAN_LIMIT * 2);
    const weekly = new Set(sessions.map((s) => s.userId).filter((u) => guardians.has(u)));
    const days = await ctx.db
      .query("adStats")
      .withIndex("by_day", (q) => q.gt("day", Math.max(LIFETIME, statsDay(now) - 30)))
      .take(SCAN_LIMIT);
    const stats = {
      families: guardians.size,
      learners: learners.filter((l) => l.status === "Active").length,
      weeklyFamilies: weekly.size,
      adViews30: days.reduce((sum, d) => sum + d.impressions + d.popupViews, 0),
      updatedAt: now,
    };
    const row = await ctx.db
      .query("siteStats")
      .withIndex("by_key", (q) => q.eq("key", "reach"))
      .unique();
    if (row) await ctx.db.patch("siteStats", row._id, stats);
    else await ctx.db.insert("siteStats", { key: "reach", ...stats });
    return null;
  },
});

/** Leads whose next sequence email is due (bounded batch). */
export const dueLeads = internalQuery({
  args: { now: v.number() },
  returns: v.array(v.id("advertisers")),
  handler: async (ctx, { now }) => {
    const rows = await ctx.db
      .query("advertisers")
      .withIndex("by_nextSendAt", (q) => q.gt("nextSendAt", 0).lte("nextSendAt", now))
      .take(20);
    return rows.map((r) => r._id);
  },
});

/**
 * Claims the next sequence email right before sending: rechecks consent and due time, then
 * leases the lead for 10 minutes so a concurrent run (cron and post-enquiry schedule) cannot
 * send the same step twice. Null when nothing may be sent.
 */
export const claimEmail = internalMutation({
  args: { advertiserId: v.id("advertisers"), now: v.number() },
  returns: v.union(
    v.null(),
    v.object({
      step: v.number(),
      email: v.string(),
      contactName: v.string(),
      businessName: v.string(),
      school: v.string(),
      replyTo: v.union(v.string(), v.null()),
      families: v.number(),
    }),
  ),
  handler: async (ctx, { advertiserId, now }) => {
    const a = await ctx.db.get("advertisers", advertiserId);
    if (!a || !a.consentEmail || a.status === "Unsubscribed") return null;
    if (a.nextSendAt === undefined || a.nextSendAt > now) return null;
    if (a.sequenceStep >= SEQUENCE_GAPS.length) return null;
    await ctx.db.patch("advertisers", a._id, { nextSendAt: now + 10 * 60000 });
    const school = (await ctx.db.query("schools").take(1))[0];
    const stats = await ctx.db
      .query("siteStats")
      .withIndex("by_key", (q) => q.eq("key", "reach"))
      .unique();
    return {
      step: a.sequenceStep,
      email: a.email,
      contactName: a.contactName,
      businessName: a.businessName,
      school: school?.name ?? "our school",
      replyTo: school?.contactEmail ?? null,
      families: stats ? Math.floor(stats.families / 10) * 10 : 0,
    };
  },
});

/** Records an attempt and advances (or stops) the sequence. */
export const recordEmail = internalMutation({
  args: {
    advertiserId: v.id("advertisers"),
    kind: v.string(),
    status: v.union(v.literal("Sent"), v.literal("Failed"), v.literal("Skipped")),
    detail: v.optional(v.string()),
    /** Sequence step that was sent; the sequence only advances from that same step. */
    step: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { advertiserId, kind, status, detail, step: sentStep }) => {
    const a = await ctx.db.get("advertisers", advertiserId);
    if (!a) return null;
    const advance = status === "Sent" && sentStep !== undefined && sentStep === a.sequenceStep;
    await ctx.db.insert("advertiserEmails", {
      advertiserId,
      kind,
      status,
      ...(detail ? { detail: detail.slice(0, 300) } : {}),
    });
    if (advance) {
      const step = a.sequenceStep + 1;
      const gap = SEQUENCE_GAPS[step];
      await ctx.db.patch("advertisers", advertiserId, {
        sequenceStep: step,
        nextSendAt: gap === undefined || !a.consentEmail ? undefined : Date.now() + gap,
      });
    } else if (sentStep !== undefined && status !== "Sent" && a.consentEmail) {
      // Retry a failed or unconfigured send in an hour rather than hammering the provider.
      await ctx.db.patch("advertisers", advertiserId, { nextSendAt: Date.now() + 3600000 });
    }
    await ctx.db.insert("auditLog", {
      action: `advertiser.email.${status.toLowerCase()}`,
      targetTable: "advertisers",
      targetId: advertiserId,
      summary: kind,
    });
    return null;
  },
});

/** Monthly report recipients: active advertisers with email consent and their linked ads' totals. */
export const reportTargets = internalQuery({
  args: { fromDay: v.number(), toDay: v.number() },
  returns: v.array(
    v.object({
      advertiserId: v.id("advertisers"),
      email: v.string(),
      contactName: v.string(),
      businessName: v.string(),
      school: v.string(),
      ads: v.array(
        v.object({
          title: v.string(),
          impressions: v.number(),
          popupViews: v.number(),
          clicks: v.number(),
          viewers: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, { fromDay, toDay }) => {
    const school = (await ctx.db.query("schools").take(1))[0];
    const active = await ctx.db
      .query("advertisers")
      .withIndex("by_status", (q) => q.eq("status", "Active"))
      .take(100);
    const out = [];
    for (const a of active) {
      if (!a.consentEmail) continue;
      const ads = await ctx.db
        .query("ads")
        .withIndex("by_advertiserId", (q) => q.eq("advertiserId", a._id))
        .take(10);
      const totals = [];
      for (const ad of ads) {
        const days = await ctx.db
          .query("adStats")
          .withIndex("by_adId_and_day", (q) =>
            q.eq("adId", ad._id).gte("day", fromDay).lte("day", toDay),
          )
          .take(40);
        if (!days.length) continue;
        totals.push({
          title: ad.title,
          impressions: days.reduce((s, d) => s + d.impressions, 0),
          popupViews: days.reduce((s, d) => s + d.popupViews, 0),
          clicks: days.reduce((s, d) => s + d.clicks, 0),
          viewers: days.reduce((s, d) => s + d.viewers, 0),
        });
      }
      if (totals.length)
        out.push({
          advertiserId: a._id,
          email: a.email,
          contactName: a.contactName,
          businessName: a.businessName,
          school: school?.name ?? "our school",
          ads: totals,
        });
    }
    return out;
  },
});

export type AdvertiserId = Id<"advertisers">;
