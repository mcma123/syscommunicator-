import { v } from "convex/values";
import { authedQuery } from "./lib/functions";
import { requireModule } from "./lib/auth";
import { matchesAudience } from "./lib/audiences";

const MAX_ADS = 8;
export const publicAd = v.object({
  id: v.id("ads"),
  title: v.string(),
  caption: v.string(),
  linkUrl: v.union(v.string(), v.null()),
  linkLabel: v.union(v.string(), v.null()),
  popup: v.boolean(),
  revision: v.number(),
  startsAt: v.number(),
  endsAt: v.number(),
  media: v.union(
    v.object({
      url: v.string(),
      kind: v.union(v.literal("image"), v.literal("video")),
      contentType: v.string(),
    }),
    v.null(),
  ),
});

/**
 * Published ads currently running for the signed-in viewer's audience.
 * `now` is supplied by the client (minute-rounded) because queries never read the clock.
 * Media URLs are Convex storage URLs: FILES.md documents this exception for promotional
 * ad media only; storage IDs are never returned.
 */
export const active = authedQuery({
  args: { now: v.number() },
  returns: v.array(publicAd),
  handler: async (ctx, { now }) => {
    requireModule(ctx.actor, "home");
    if (ctx.actor.disabledModules?.includes("ads") || !Number.isFinite(now)) return [];
    const running = await ctx.db
      .query("ads")
      .withIndex("by_status_and_endsAt", (q) => q.eq("status", "Published").gt("endsAt", now))
      .take(50);
    const visible = [];
    for (const ad of running) {
      if (ad.startsAt > now || !ad.media) continue;
      if (!(await matchesAudience(ctx, ctx.actor, ad.audiences, "guardian"))) continue;
      const url = await ctx.storage.getUrl(ad.media.storageId);
      if (!url) continue;
      visible.push({
        id: ad._id,
        title: ad.title,
        caption: ad.caption ?? "",
        linkUrl: ad.linkUrl ?? null,
        linkLabel: ad.linkLabel ?? null,
        popup: ad.popup,
        revision: ad.revision,
        startsAt: ad.startsAt,
        endsAt: ad.endsAt,
        media: {
          url,
          kind: ad.media.contentType.startsWith("video/") ? ("video" as const) : ("image" as const),
          contentType: ad.media.contentType,
        },
      });
    }
    // Newest-starting first, bounded for the home carousel.
    return visible.sort((a, b) => b.startsAt - a.startsAt).slice(0, MAX_ADS);
  },
});
