import { getAuthSessionId } from "@convex-dev/auth/server";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import {
  NOTIFICATION_STATES,
  NOTIFICATION_KINDS,
  NOTIFICATION_CHANNELS,
} from "@school-connect/core/domain";
import { env } from "./_generated/server";
import { internal } from "./_generated/api";
import { authedMutation, authedQuery } from "./lib/functions";
import { denied, requireModule, wholeSchool, type Actor } from "./lib/auth";
import { canManageNotice } from "./lib/audiences";
import { get, invalid } from "./lib/workflowRules";
import { literals } from "./validators";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

async function noticeManager(ctx: QueryCtx, actor: Actor, noticeId: Id<"notices">) {
  requireModule(actor, "messages");
  const n = await get(ctx, "notices", noticeId);
  if (!canManageNotice(actor, n)) denied();
}
export const registerDevice = authedMutation({
  args: {
    token: v.string(),
    platform: v.union(v.literal("ios"), v.literal("android")),
    projectId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireModule(ctx.actor, "profile");
    if (!env.EXPO_PROJECT_ID || args.projectId !== env.EXPO_PROJECT_ID)
      invalid("The app's notification project is not configured.");
    if (
      args.token.length > 240 ||
      !/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(args.token)
    )
      invalid("Invalid Expo push token.");
    const sessionId = await getAuthSessionId(ctx);
    if (!sessionId) denied();
    const existing = await ctx.db
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    const owned = await ctx.db
      .query("pushTokens")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.actor.user._id))
      .take(11);
    let otherDevices = 0;
    for (const device of owned) {
      if (device._id === existing?._id) continue;
      const session = device.sessionId ? await ctx.db.get("authSessions", device.sessionId) : null;
      if (
        !session ||
        session.userId !== ctx.actor.user._id ||
        session.expirationTime <= Date.now() ||
        (ctx.actor.user.sessionsValidAfter !== undefined &&
          session._creationTime <= ctx.actor.user.sessionsValidAfter)
      )
        await ctx.db.delete("pushTokens", device._id);
      else otherDevices++;
    }
    if (otherDevices >= 10)
      invalid(
        "Sign out everywhere, then sign in to register this phone (maximum ten active phones).",
      );
    const fields = { ...args, userId: ctx.actor.user._id, sessionId, updatedAt: Date.now() };
    const id = existing ? existing._id : await ctx.db.insert("pushTokens", fields);
    if (existing) await ctx.db.patch("pushTokens", id, fields);
    await ctx.audit("notification.deviceRegistered", "pushTokens", id);
    return null;
  },
});
export const unregisterDevice = authedMutation({
  args: { token: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { token }) => {
    const rows = await ctx.db
      .query("pushTokens")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.actor.user._id))
      .take(11);
    if (rows.length > 10) denied();
    const sessionId = await getAuthSessionId(ctx);
    for (const r of rows)
      if ((token && r.token === token) || (!token && r.sessionId === sessionId))
        await ctx.db.delete("pushTokens", r._id);
    await ctx.audit("notification.deviceRemoved", "users", ctx.actor.user._id);
    return null;
  },
});
export const configuration = authedQuery({
  args: {},
  returns: v.object({
    enabled: v.boolean(),
    emailConfigured: v.boolean(),
    pushConfigured: v.boolean(),
    registeredDevices: v.number(),
  }),
  handler: async (ctx) => ({
    enabled: env.NOTIFICATION_DELIVERY_ENABLED === "true",
    emailConfigured:
      !!env.RESEND_API_KEY && !!env.AUTH_EMAIL_FROM && !!env.SITE_URL?.startsWith("https://"),
    pushConfigured: !!env.EXPO_PROJECT_ID,
    registeredDevices: (
      await ctx.db
        .query("pushTokens")
        .withIndex("by_userId", (q) => q.eq("userId", ctx.actor.user._id))
        .take(10)
    ).length,
  }),
});
const historyItem = v.object({
  id: v.id("notificationDeliveries"),
  name: v.string(),
  kind: literals(NOTIFICATION_KINDS),
  channel: literals(NOTIFICATION_CHANNELS),
  state: literals(NOTIFICATION_STATES),
  reason: v.optional(v.string()),
  at: v.number(),
  canRetry: v.boolean(),
});
export const history = authedQuery({
  args: { noticeId: v.optional(v.id("notices")), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(historyItem),
  handler: async (ctx, { noticeId, paginationOpts }) => {
    if (
      !Number.isInteger(paginationOpts.numItems) ||
      paginationOpts.numItems < 1 ||
      paginationOpts.numItems > 50
    )
      invalid("Request 1 to 50 delivery records.");
    if (noticeId) await noticeManager(ctx, ctx.actor, noticeId);
    else requireModule(ctx.actor, "profile");
    const result = noticeId
      ? await ctx.db
          .query("notificationDeliveries")
          .withIndex("by_noticeId", (q) => q.eq("noticeId", noticeId))
          .order("desc")
          .paginate(paginationOpts)
      : await ctx.db
          .query("notificationDeliveries")
          .withIndex("by_userId", (q) => q.eq("userId", ctx.actor.user._id))
          .order("desc")
          .paginate(paginationOpts);
    const page = [];
    for (const d of result.page) {
      const u = await ctx.db.get("users", d.userId);
      page.push({
        id: d._id,
        name: noticeId ? (u?.name ?? "School guardian") : "Your account",
        kind: d.kind,
        channel: d.channel,
        state: d.state,
        ...(d.reason ? { reason: d.reason } : {}),
        at: d.updatedAt,
        canRetry: !!noticeId && ["Blocked", "Failed"].includes(d.state),
      });
    }
    return { ...result, page };
  },
});
export const retry = authedMutation({
  args: { deliveryId: v.id("notificationDeliveries") },
  returns: v.null(),
  handler: async (ctx, { deliveryId }) => {
    const d = await get(ctx, "notificationDeliveries", deliveryId);
    if (d.noticeId) await noticeManager(ctx, ctx.actor, d.noticeId);
    else {
      requireModule(ctx.actor, "forms");
      if (!wholeSchool(ctx.actor)) denied();
    }
    if (!["Blocked", "Failed"].includes(d.state))
      invalid("Only blocked or failed delivery can be retried.");
    if (d.confirmedAt) invalid("This notification has already been confirmed.");
    await ctx.db.patch("notificationDeliveries", d._id, {
      state: "Pending",
      reason: undefined,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.notificationJobs.dispatch, { deliveryId });
    await ctx.audit("notification.retryRequested", "notificationDeliveries", d._id);
    return null;
  },
});
