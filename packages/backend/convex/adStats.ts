// Ad Center measurement: impressions, popup views, clicks and parents reached.
// Engagement counters are derived analytics, not school records, so they follow the
// documented derived-data audit exception (like dashboard caches): the public entry
// point is an authenticated action and the write is an internal mutation that
// re-derives the actor from the same session.
import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { authedAction, authedQuery } from "./lib/functions";
import { missing, requireActor } from "./lib/auth";
import { matchesAudience } from "./lib/audiences";
import { adEditor } from "./lib/fileRules";

const DAY = 86400000;
/** South African Standard Time (UTC+2, no daylight saving). */
const SAST = 2 * 3600000;
export const LIFETIME = 0;
const STATS_DAYS = 30;

export const adEvent = v.union(v.literal("banner"), v.literal("popup"), v.literal("click"));
type AdEvent = "banner" | "popup" | "click";
const counterFor = { banner: "impressions", popup: "popupViews", click: "clicks" } as const;
const dayField = { banner: "bannerDay", popup: "popupDay", click: "clickDay" } as const;

export function statsDay(now: number) {
  return Math.floor((now + SAST) / DAY);
}

type Counters = { impressions: number; popupViews: number; clicks: number; viewers: number };
async function bump(ctx: MutationCtx, adId: Id<"ads">, day: number, delta: Partial<Counters>) {
  const row = await ctx.db
    .query("adStats")
    .withIndex("by_adId_and_day", (q) => q.eq("adId", adId).eq("day", day))
    .unique();
  const add = (key: keyof Counters) => (row?.[key] ?? 0) + (delta[key] ?? 0);
  const next = {
    impressions: add("impressions"),
    popupViews: add("popupViews"),
    clicks: add("clicks"),
    viewers: add("viewers"),
  };
  if (row) await ctx.db.patch("adStats", row._id, next);
  else await ctx.db.insert("adStats", { adId, day, ...next });
}

/**
 * Counts one event for the signed-in parent. Each event counts at most once per parent,
 * ad and day; staff previews, ads that are not running for this parent and switched-off
 * Ad Centers are ignored without error so tracking never disturbs the parent's screen.
 */
export const record = internalMutation({
  args: { adId: v.id("ads"), event: adEvent },
  returns: v.boolean(),
  handler: async (ctx, { adId, event }) => {
    const actor = await requireActor(ctx);
    if (actor.learners.length === 0 || actor.disabledModules?.includes("ads")) return false;
    const now = Date.now();
    const ad = await ctx.db.get("ads", adId);
    if (!ad || ad.status !== "Published" || ad.startsAt > now || ad.endsAt <= now) return false;
    if (!(await matchesAudience(ctx, actor, ad.audiences, "guardian"))) return false;
    const day = statsDay(now);
    const viewer = await ctx.db
      .query("adViewers")
      .withIndex("by_adId_and_userId", (q) => q.eq("adId", adId).eq("userId", actor.user._id))
      .unique();
    if (viewer?.[dayField[event]] === day) return false;
    const counter = counterFor[event];
    const firstToday = viewer?.lastSeenDay !== day;
    if (viewer)
      await ctx.db.patch("adViewers", viewer._id, { lastSeenDay: day, [dayField[event]]: day });
    else
      await ctx.db.insert("adViewers", {
        adId,
        userId: actor.user._id,
        lastSeenDay: day,
        [dayField[event]]: day,
      });
    await bump(ctx, adId, day, { [counter]: 1, viewers: firstToday ? 1 : 0 });
    await bump(ctx, adId, LIFETIME, { [counter]: 1, viewers: viewer ? 0 : 1 });
    return true;
  },
});

/** Parent clients report when an ad is shown (banner or popup) or its button is clicked. */
export const track = authedAction({
  args: { adId: v.id("ads"), event: adEvent },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.adStats.record, args);
    return null;
  },
});

const counters = {
  impressions: v.number(),
  popupViews: v.number(),
  clicks: v.number(),
  viewers: v.number(),
};
/** Performance of one ad for its editors: lifetime totals and the last 30 days with activity. */
export const forAd = authedQuery({
  args: { adId: v.id("ads") },
  returns: v.object({
    totals: v.object(counters),
    days: v.array(v.object({ day: v.number(), ...counters })),
  }),
  handler: async (ctx, { adId }) => {
    const ad = await ctx.db.get("ads", adId);
    if (!ad) missing();
    await adEditor(ctx, ctx.actor, ad);
    const rows = await ctx.db
      .query("adStats")
      .withIndex("by_adId_and_day", (q) => q.eq("adId", adId).gt("day", LIFETIME))
      .order("desc")
      .take(STATS_DAYS);
    const total = await ctx.db
      .query("adStats")
      .withIndex("by_adId_and_day", (q) => q.eq("adId", adId).eq("day", LIFETIME))
      .unique();
    const pick = (r: Counters | null) => ({
      impressions: r?.impressions ?? 0,
      popupViews: r?.popupViews ?? 0,
      clicks: r?.clicks ?? 0,
      viewers: r?.viewers ?? 0,
    });
    return {
      totals: pick(total),
      days: rows.map((r) => ({ day: r.day, ...pick(r) })),
    };
  },
});
