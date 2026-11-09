import { getAuthSessionId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { authedAction, authedMutation, authedQuery } from "./lib/functions";
import { denied, missing, requireActor, requireModule } from "./lib/auth";
import { matchesAudience } from "./lib/audiences";
import { writeAudit } from "./lib/audit";
import { get, invalid } from "./lib/workflowRules";
import { adEditor, MAX_AD_ITEMS, validateAdMedia, validateSignature } from "./lib/fileRules";
import { adItems, mediaSignature, readyMedia, signatureMatches } from "./lib/adMedia";
import { deleteObject, headObject, presignPut, readPrefix } from "./lib/r2";

const DAY = 86400000;
const RESERVATION_MS = 15 * 60000;
const MAX_ADS = 8;
const item = v.object({
  url: v.string(),
  kind: v.union(v.literal("image"), v.literal("video")),
  contentType: v.string(),
});
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
  items: v.array(item),
});

/**
 * Published ads currently running for the signed-in viewer's audience.
 * `now` is supplied by the client (minute-rounded) because queries never read the clock.
 * Item URLs point at the signed media gateway (http.ts), never at storage directly.
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
      if (ad.startsAt > now) continue;
      if (!(await matchesAudience(ctx, ctx.actor, ad.audiences, "guardian"))) continue;
      const items = (await adItems(ctx, ad, "p")).map(({ id: _id, ...rest }) => rest);
      if (!items.length) continue;
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
        items,
      });
    }
    return visible.sort((a, b) => b.startsAt - a.startsAt).slice(0, MAX_ADS);
  },
});

/**
 * When the current sign-in session started. Clients use it as a per-login marker so popup
 * ads show again after every new login (refreshing tokens keeps the same session).
 */
export const session = authedQuery({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const sessionId = await getAuthSessionId(ctx);
    const current = sessionId ? await ctx.db.get("authSessions", sessionId) : null;
    if (!current) denied();
    return current._creationTime;
  },
});

/** Media of one ad for its editors (composer thumbnails, remove and reorder). */
export const media = authedQuery({
  args: { adId: v.id("ads") },
  returns: v.array(
    v.object({
      id: v.string(),
      url: v.string(),
      kind: v.union(v.literal("image"), v.literal("video")),
      contentType: v.string(),
      fileName: v.string(),
      size: v.number(),
    }),
  ),
  handler: async (ctx, { adId }) => {
    const ad = await ctx.db.get("ads", adId);
    if (!ad) missing();
    await adEditor(ctx, ctx.actor, ad);
    const rows = await readyMedia(ctx, ad._id);
    const items = await adItems(ctx, ad, "e");
    return items.map((i) => {
      const row = rows.find((r) => r._id === i.id);
      return {
        ...i,
        fileName: row?.fileName ?? ad.media?.fileName ?? "Media",
        size: row?.size ?? ad.media?.size ?? 0,
      };
    });
  },
});

async function editableAd(ctx: QueryCtx, adId: string | Id<"ads">) {
  const actor = await requireActor(ctx);
  const ad = await get(ctx, "ads", adId);
  await adEditor(ctx, actor, ad);
  if (ad.status !== "Draft" && ad.status !== "Review")
    invalid("Return this ad to draft before changing its pictures or videos.");
  return { actor, ad };
}
async function attachedCount(ctx: QueryCtx, adId: Id<"ads">, now: number) {
  const rows = await ctx.db
    .query("adMedia")
    .withIndex("by_adId_and_order", (q) => q.eq("adId", adId))
    .take(MAX_AD_ITEMS * 3);
  return rows.filter(
    (m) =>
      m.detachedAt === undefined &&
      (m.status === "Ready" || (m.status === "Pending" && m.expiresAt > now)),
  ).length;
}

/** Reserve an R2 object key for a session-owned upload (internal; audited). */
export const reserveUpload = internalMutation({
  args: { adId: v.id("ads"), fileName: v.string(), contentType: v.string(), size: v.number() },
  returns: v.object({ mediaId: v.id("adMedia"), key: v.string() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const { actor, ad } = await editableAd(ctx, args.adId);
    const rule = validateAdMedia(args.fileName, args.contentType, args.size);
    if ((await attachedCount(ctx, ad._id, now)) >= MAX_AD_ITEMS)
      invalid(`An ad can have up to ${MAX_AD_ITEMS} pictures or videos.`);
    const sessionId = await getAuthSessionId(ctx);
    if (!sessionId) denied();
    const key = `ads/${ad._id}/${now.toString(36)}-${Math.random().toString(36).slice(2, 12)}.${rule.suffix}`;
    const mediaId = await ctx.db.insert("adMedia", {
      adId: ad._id,
      key,
      kind: rule.kind,
      contentType: args.contentType,
      size: args.size,
      fileName: args.fileName,
      order: now,
      status: "Pending",
      uploadedBy: actor.user._id,
      sessionId,
      expiresAt: now + RESERVATION_MS,
    });
    await writeAudit(ctx, actor, "ad.mediaRequested", "ads", ad._id);
    return { mediaId, key };
  },
});

/** Step 1: reserve and return a presigned R2 PUT URL (valid 15 minutes). */
export const prepareUpload = authedAction({
  args: { adId: v.id("ads"), fileName: v.string(), contentType: v.string(), size: v.number() },
  returns: v.object({ mediaId: v.id("adMedia"), uploadUrl: v.string() }),
  handler: async (ctx, args): Promise<{ mediaId: Id<"adMedia">; uploadUrl: string }> => {
    // Fail before reserving when storage is not configured.
    await presignPut("ads/config-check", args.contentType, 60);
    const reserved: { mediaId: Id<"adMedia">; key: string } = await ctx.runMutation(
      internal.ads.reserveUpload,
      args,
    );
    return {
      mediaId: reserved.mediaId,
      uploadUrl: await presignPut(reserved.key, args.contentType),
    };
  },
});

async function ownPending(ctx: QueryCtx, mediaId: Id<"adMedia">, now: number) {
  const row = await ctx.db.get("adMedia", mediaId);
  if (!row) missing();
  const { actor, ad } = await editableAd(ctx, row.adId);
  if (
    row.uploadedBy !== actor.user._id ||
    row.sessionId !== (await getAuthSessionId(ctx)) ||
    row.detachedAt !== undefined
  )
    denied();
  if (row.status === "Pending" && row.expiresAt <= now)
    invalid("This upload expired. Add the file again.");
  return { actor, ad, row };
}
export const uploadContext = internalQuery({
  args: { mediaId: v.id("adMedia"), now: v.number() },
  returns: v.object({
    key: v.string(),
    contentType: v.string(),
    size: v.number(),
    ready: v.boolean(),
  }),
  handler: async (ctx, { mediaId, now }) => {
    const { row } = await ownPending(ctx, mediaId, now);
    return {
      key: row.key,
      contentType: row.contentType,
      size: row.size,
      ready: row.status === "Ready",
    };
  },
});
export const completeUpload = internalMutation({
  args: { mediaId: v.id("adMedia") },
  returns: v.null(),
  handler: async (ctx, { mediaId }) => {
    const { actor, ad, row } = await ownPending(ctx, mediaId, Date.now());
    if (row.status === "Ready") return null;
    if ((await attachedCount(ctx, ad._id, Date.now())) > MAX_AD_ITEMS)
      invalid(`An ad can have up to ${MAX_AD_ITEMS} pictures or videos.`);
    const ready = await readyMedia(ctx, ad._id);
    const order = ready.length ? Math.max(...ready.map((m) => m.order)) + 1 : 1;
    await ctx.db.patch("adMedia", row._id, { status: "Ready", order });
    await ctx.db.patch("ads", ad._id, { revision: ad.revision + 1, updatedAt: Date.now() });
    await writeAudit(ctx, actor, "file.attached", "ads", ad._id);
    return null;
  },
});
/** Discard an upload whose stored object failed verification (object already deleted). */
export const discardUpload = internalMutation({
  args: { mediaId: v.id("adMedia") },
  returns: v.null(),
  handler: async (ctx, { mediaId }) => {
    const { actor, ad, row } = await ownPending(ctx, mediaId, Date.now());
    if (row.status === "Ready") return null;
    await ctx.db.delete("adMedia", row._id);
    await writeAudit(ctx, actor, "ad.mediaRejected", "ads", ad._id);
    return null;
  },
});

/** Step 2 (after the browser/app PUT): verify the stored object, then attach it. */
export const finishUpload = authedAction({
  args: { mediaId: v.id("adMedia") },
  returns: v.id("adMedia"),
  handler: async (ctx, { mediaId }): Promise<Id<"adMedia">> => {
    const upload: { key: string; contentType: string; size: number; ready: boolean } =
      await ctx.runQuery(internal.ads.uploadContext, { mediaId, now: Date.now() });
    if (upload.ready) return mediaId;
    const reject = async (message: string): Promise<never> => {
      await deleteObject(upload.key).catch(() => undefined);
      await ctx.runMutation(internal.ads.discardUpload, { mediaId });
      invalid(message);
    };
    const head = await headObject(upload.key);
    if (!head) invalid("The upload did not reach storage. Please try again.");
    if (head.size !== upload.size || head.contentType !== upload.contentType)
      await reject("The uploaded file does not match what was declared.");
    try {
      validateSignature(await readPrefix(upload.key, 16), upload.contentType);
    } catch {
      await reject("The file contents do not match its type.");
    }
    await ctx.runMutation(internal.ads.completeUpload, { mediaId });
    return mediaId;
  },
});

async function editableMedia(ctx: MutationCtx, mediaId: Id<"adMedia">) {
  const row = await ctx.db.get("adMedia", mediaId);
  if (!row || row.detachedAt !== undefined || row.status !== "Ready") missing();
  return { row, ...(await editableAd(ctx, row.adId)) };
}
export const removeMedia = authedMutation({
  args: { mediaId: v.id("adMedia") },
  returns: v.null(),
  handler: async (ctx, { mediaId }) => {
    const { row, ad } = await editableMedia(ctx, mediaId);
    await ctx.db.patch("adMedia", row._id, { detachedAt: Date.now() });
    await ctx.db.patch("ads", ad._id, { revision: ad.revision + 1, updatedAt: Date.now() });
    await ctx.audit("ad.mediaRemoved", "ads", ad._id);
    return null;
  },
});
export const moveMedia = authedMutation({
  args: { mediaId: v.id("adMedia"), direction: v.union(v.literal(-1), v.literal(1)) },
  returns: v.null(),
  handler: async (ctx, { mediaId, direction }) => {
    const { row, ad } = await editableMedia(ctx, mediaId);
    const ready = await readyMedia(ctx, ad._id);
    const index = ready.findIndex((m) => m._id === row._id);
    const other = ready[index + direction];
    if (!other) return null;
    await ctx.db.patch("adMedia", row._id, { order: other.order });
    await ctx.db.patch("adMedia", other._id, { order: row.order });
    await ctx.db.patch("ads", ad._id, { revision: ad.revision + 1, updatedAt: Date.now() });
    await ctx.audit("ad.mediaMoved", "ads", ad._id);
    return null;
  },
});

/** Gateway lookup: verifies signature scope and current ad state at request time. */
export const resolveMedia = internalQuery({
  args: {
    mediaId: v.string(),
    revision: v.number(),
    scope: v.string(),
    sig: v.string(),
    now: v.number(),
  },
  returns: v.union(v.object({ key: v.string(), contentType: v.string() }), v.null()),
  handler: async (ctx, args) => {
    if (args.scope !== "p" && args.scope !== "e") return null;
    if (!signatureMatches(mediaSignature(args.mediaId, args.revision, args.scope), args.sig))
      return null;
    const id = ctx.db.normalizeId("adMedia", args.mediaId);
    const row = id ? await ctx.db.get("adMedia", id) : null;
    if (!row || row.status !== "Ready" || row.detachedAt !== undefined) return null;
    const ad = await ctx.db.get("ads", row.adId);
    if (!ad || ad.revision !== args.revision) return null;
    if (args.scope === "p") {
      if (ad.status !== "Published" || ad.startsAt > args.now || ad.endsAt <= args.now) return null;
      const school = (await ctx.db.query("schools").take(1))[0];
      if (school?.featureFlags["ads"] === false) return null;
    }
    return { key: row.key, contentType: row.contentType };
  },
});

/** Hourly: delete R2 objects for removed media and abandoned reservations (bounded). */
export const cleanupCandidates = internalQuery({
  args: { now: v.number() },
  returns: v.array(v.object({ id: v.id("adMedia"), key: v.string() })),
  handler: async (ctx, { now }) => {
    const detached = await ctx.db
      .query("adMedia")
      .withIndex("by_detachedAt", (q) => q.gt("detachedAt", 0).lt("detachedAt", now - DAY))
      .take(25);
    const expired = await ctx.db
      .query("adMedia")
      .withIndex("by_status_and_expiresAt", (q) =>
        q.eq("status", "Pending").lt("expiresAt", now - DAY),
      )
      .take(25);
    return [...detached, ...expired].map((m: Doc<"adMedia">) => ({ id: m._id, key: m.key }));
  },
});
export const forgetMedia = internalMutation({
  args: { ids: v.array(v.id("adMedia")) },
  returns: v.null(),
  handler: async (ctx, { ids }) => {
    for (const id of ids) if (await ctx.db.get("adMedia", id)) await ctx.db.delete("adMedia", id);
    return null;
  },
});
export const cleanupMedia = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const rows: { id: Id<"adMedia">; key: string }[] = await ctx.runQuery(
      internal.ads.cleanupCandidates,
      { now: Date.now() },
    );
    const done: Id<"adMedia">[] = [];
    for (const row of rows) {
      try {
        await deleteObject(row.key);
        done.push(row.id);
      } catch {
        // Leave the row; the next run retries.
      }
    }
    if (done.length) await ctx.runMutation(internal.ads.forgetMedia, { ids: done });
    if (rows.length >= 25 && done.length)
      await ctx.scheduler.runAfter(0, internal.ads.cleanupMedia, {});
    return null;
  },
});
