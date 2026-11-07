import { v, type Infer } from "convex/values";
import { vOnCompleteArgs, NonRetryableError } from "@convex-dev/workpool";
import {
  env,
  internalAction,
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  notificationEmailPool,
  notificationPool,
  queueNotifications,
} from "./lib/notificationQueue";
import { notificationAudience, nextNotificationTime } from "./lib/notificationRules";
import { loadActor } from "./lib/auth";
import { matchesAudience } from "./lib/audiences";

const verdict = v.object({
  state: v.union(
    v.literal("Ready"),
    v.literal("Skipped"),
    v.literal("Blocked"),
    v.literal("Deferred"),
  ),
  reason: v.optional(v.string()),
  at: v.optional(v.number()),
  to: v.optional(v.string()),
  pushTokenId: v.optional(v.id("pushTokens")),
});
type Verdict = Infer<typeof verdict>;
const deliveryArgs = { deliveryId: v.id("notificationDeliveries") };
const actionArgs = { ...deliveryArgs, run: v.number() };
async function deliveryContext(
  ctx: QueryCtx,
  d: Doc<"notificationDeliveries">,
  now: number,
): Promise<Verdict> {
  const scope = await notificationAudience(ctx, d, now);
  if (!scope)
    return {
      state: "Skipped",
      reason: "This notice or form is no longer available to the recipient.",
    };
  const pref = await ctx.db
    .query("notificationPreferences")
    .withIndex("by_userId", (q) => q.eq("userId", d.userId))
    .unique();
  if (
    (d.channel === "Push" && pref?.pushEnabled === false) ||
    (d.channel === "Email" && pref?.emailEnabled === false) ||
    pref?.mutedCategories.includes(scope.category)
  )
    return { state: "Skipped", reason: "Disabled by notification preferences." };
  const at = nextNotificationTime(now, pref?.quietHoursStart, pref?.quietHoursEnd);
  if (at > now)
    return { state: "Deferred", reason: "Waiting until quiet hours end (Johannesburg).", at };
  if (d.channel === "Push") {
    const p = d.pushTokenId
      ? await ctx.db.get("pushTokens", d.pushTokenId)
      : await ctx.db
          .query("pushTokens")
          .withIndex("by_userId", (q) => q.eq("userId", d.userId))
          .order("desc")
          .first();
    if (!p || !p.sessionId || p.userId !== d.userId || p.projectId !== env.EXPO_PROJECT_ID)
      return {
        state: "Blocked",
        reason: "Sign in to the installed school app and enable phone notifications.",
      };
    const session = await ctx.db.get("authSessions", p.sessionId);
    if (
      !session ||
      session.userId !== d.userId ||
      session.expirationTime <= now ||
      (scope.actor.user.sessionsValidAfter !== undefined &&
        session._creationTime <= scope.actor.user.sessionsValidAfter)
    )
      return { state: "Skipped", reason: "This phone needs to sign in again." };
    if (env.NOTIFICATION_DELIVERY_ENABLED !== "true")
      return { state: "Blocked", reason: "School notification delivery is not enabled yet." };
    return { state: "Ready", to: p.token, pushTokenId: p._id };
  }
  const user = scope.actor.user;
  if (!user.email || !user.emailVerificationTime)
    return { state: "Blocked", reason: "A verified email address is required." };
  if (user.email.endsWith(".example"))
    return { state: "Blocked", reason: "Fictional development email cannot receive messages." };
  if (
    env.NOTIFICATION_DELIVERY_ENABLED !== "true" ||
    !env.RESEND_API_KEY ||
    !env.AUTH_EMAIL_FROM ||
    !env.SITE_URL?.startsWith("https://")
  )
    return {
      state: "Blocked",
      reason: "School email delivery is not ready. Contact the school.",
    };
  return { state: "Ready", to: user.email };
}
export const context = internalQuery({
  args: { ...actionArgs, now: v.number() },
  returns: v.union(verdict, v.null()),
  handler: async (ctx, { deliveryId, run, now }) => {
    const d = await ctx.db.get("notificationDeliveries", deliveryId);
    return d?.state === "Sending" && d.run === run ? deliveryContext(ctx, d, now) : null;
  },
});
export const dispatch = internalMutation({
  args: deliveryArgs,
  returns: v.null(),
  handler: async (ctx, { deliveryId }) => {
    const d = await ctx.db.get("notificationDeliveries", deliveryId);
    if (!d || !["Pending", "Deferred"].includes(d.state)) return null;
    const result = await deliveryContext(ctx, d, Date.now());
    if (result.state !== "Ready") {
      await ctx.db.patch("notificationDeliveries", d._id, {
        state: result.state,
        reason: result.reason,
        updatedAt: Date.now(),
      });
      if (result.state === "Deferred")
        await ctx.scheduler.runAt(result.at!, internal.notificationJobs.dispatch, { deliveryId });
      return null;
    }
    const run = d.run + 1;
    const workId = await (
      d.channel === "Email" ? notificationEmailPool : notificationPool
    ).enqueueAction(
      ctx,
      internal.notificationJobs.send,
      { deliveryId, run },
      {
        retry: d.channel === "Email",
        onComplete: internal.notificationJobs.completed,
        context: { deliveryId, run },
      },
    );
    await ctx.db.patch("notificationDeliveries", d._id, {
      state: "Sending",
      run,
      workId,
      reason: undefined,
      ...(result.pushTokenId ? { pushTokenId: result.pushTokenId } : {}),
      updatedAt: Date.now(),
    });
    return null;
  },
});
export const postpone = internalMutation({
  args: { ...actionArgs, result: verdict },
  returns: v.null(),
  handler: async (ctx, { deliveryId, run, result }) => {
    const d = await ctx.db.get("notificationDeliveries", deliveryId);
    if (d?.state !== "Sending" || d.run !== run || result.state === "Ready") return null;
    await ctx.db.patch("notificationDeliveries", d._id, {
      state: result.state,
      reason: result.reason,
      updatedAt: Date.now(),
    });
    if (result.state === "Deferred")
      await ctx.scheduler.runAt(result.at!, internal.notificationJobs.dispatch, { deliveryId });
    return null;
  },
});
export const source = internalQuery({
  args: deliveryArgs,
  returns: v.union(
    v.null(),
    v.object({
      channel: v.union(v.literal("Push"), v.literal("Email")),
      kind: v.union(v.literal("Notice"), v.literal("ConsentReminder")),
      targetId: v.string(),
    }),
  ),
  handler: async (ctx, { deliveryId }) => {
    const d = await ctx.db.get("notificationDeliveries", deliveryId);
    return d
      ? { channel: d.channel, kind: d.kind, targetId: d.noticeId ?? d.consentRequestId ?? "" }
      : null;
  },
});
const accepted = v.object({
  providerId: v.optional(v.string()),
  reason: v.optional(v.string()),
  failed: v.optional(v.boolean()),
});
export const send = internalAction({
  args: actionArgs,
  returns: accepted,
  handler: async (ctx, args): Promise<Infer<typeof accepted>> => {
    const ready: Verdict | null = await ctx.runQuery(internal.notificationJobs.context, {
      ...args,
      now: Date.now(),
    });
    if (!ready) return {};
    if (ready.state !== "Ready") {
      await ctx.runMutation(internal.notificationJobs.postpone, { ...args, result: ready });
      return {};
    }
    const source: {
      channel: "Push" | "Email";
      kind: "Notice" | "ConsentReminder";
      targetId: string;
    } | null = await ctx.runQuery(internal.notificationJobs.source, {
      deliveryId: args.deliveryId,
    });
    if (!source) return {};
    const body =
      source.kind === "Notice"
        ? "A school update is available. Open WGJS Connect to read it securely."
        : "A consent form needs your response. Open WGJS Connect to review it securely.";
    if (source.channel === "Push") {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(env.EXPO_PUSH_ACCESS_TOKEN
            ? { Authorization: `Bearer ${env.EXPO_PUSH_ACCESS_TOKEN}` }
            : {}),
        },
        body: JSON.stringify({
          to: ready.to,
          title: "Wynberg Girls Junior School",
          body,
          sound: "default",
          channelId: "school-updates",
          ttl: 3600,
          data: { kind: source.kind, id: source.targetId, notificationId: args.deliveryId },
        }),
      });
      if (!response.ok) throw new Error("Push service request failed; outcome may be unknown.");
      const data: unknown = await response.json();
      const ticket = (
        data as { data?: { status?: string; id?: string; details?: { error?: string } } }
      )?.data;
      if (ticket?.status === "ok" && typeof ticket.id === "string")
        return { providerId: ticket.id };
      if (ticket?.details?.error === "DeviceNotRegistered")
        await ctx.runMutation(internal.notificationJobs.removeInvalidDevice, {
          deliveryId: args.deliveryId,
        });
      return {
        failed: true,
        reason:
          ticket?.details?.error === "DeviceNotRegistered"
            ? "Device is no longer registered with Expo."
            : "Phone notification delivery is not ready. Contact the school.",
      };
    }
    const outcome: { httpStatus: number; providerId?: string; skipped?: boolean } =
      await ctx.runAction(internal.notificationEmail.send, args);
    if (outcome.skipped) return {};
    if (outcome.httpStatus === 429 || outcome.httpStatus >= 500)
      throw new Error("Email provider temporarily unavailable.");
    if (outcome.httpStatus < 200 || outcome.httpStatus >= 300)
      throw new NonRetryableError(
        "Email provider rejected the notification. Check sender configuration.",
      );
    if (!outcome.providerId)
      throw new NonRetryableError("Email provider did not confirm acceptance.");
    return { providerId: outcome.providerId };
  },
});
export const completed = internalMutation({
  args: vOnCompleteArgs(v.object(actionArgs)),
  returns: v.null(),
  handler: async (ctx, { context, result }) => {
    const d = await ctx.db.get("notificationDeliveries", context.deliveryId);
    if (!d || d.run !== context.run || d.state !== "Sending") return null;
    const out = result.kind === "success" ? (result.returnValue as Infer<typeof accepted>) : null;
    const ok = out?.providerId && !out.failed;
    await ctx.db.patch("notificationDeliveries", d._id, {
      state: ok ? "Accepted" : "Failed",
      ...(ok
        ? { providerId: out.providerId, submittedAt: Date.now(), checkAt: Date.now() + 15 * 60000 }
        : {}),
      reason: ok
        ? undefined
        : (out?.reason ??
          "Delivery attempt failed. Check provider configuration; push outcome may be unknown."),
      updatedAt: Date.now(),
    });
    return null;
  },
});
export const removeInvalidDevice = internalMutation({
  args: deliveryArgs,
  returns: v.null(),
  handler: async (ctx, { deliveryId }) => {
    const d = await ctx.db.get("notificationDeliveries", deliveryId);
    const p = d?.pushTokenId ? await ctx.db.get("pushTokens", d.pushTokenId) : null;
    if (p && p.userId === d!.userId) await ctx.db.delete("pushTokens", p._id);
    return null;
  },
});
export const pollDue = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    for (const channel of ["Push", "Email"] as const) {
      const rows = await ctx.db
        .query("notificationDeliveries")
        .withIndex("by_channel_and_state_and_checkAt", (q) =>
          q.eq("channel", channel).eq("state", "Accepted").lte("checkAt", Date.now()),
        )
        .take(25);
      for (const d of rows) {
        await ctx.db.patch("notificationDeliveries", d._id, { checkAt: Date.now() + 15 * 60000 });
        await (d.channel === "Email" ? notificationEmailPool : notificationPool).enqueueAction(
          ctx,
          internal.notificationJobs.poll,
          { deliveryId: d._id },
          { retry: false },
        );
      }
      if (rows.length === 25)
        await ctx.scheduler.runAfter(0, internal.notificationJobs.pollDue, {});
    }
    return null;
  },
});
export const pollContext = internalQuery({
  args: deliveryArgs,
  returns: v.union(
    v.null(),
    v.object({
      providerId: v.string(),
      channel: v.union(v.literal("Push"), v.literal("Email")),
      expired: v.boolean(),
    }),
  ),
  handler: async (ctx, { deliveryId }) => {
    const d = await ctx.db.get("notificationDeliveries", deliveryId);
    return d?.state === "Accepted" && d.providerId
      ? { providerId: d.providerId, channel: d.channel, expired: false }
      : null;
  },
});
export const poll = internalAction({
  args: deliveryArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const d: { providerId: string; channel: "Push" | "Email"; expired: boolean } | null =
      await ctx.runQuery(internal.notificationJobs.pollContext, args);
    if (!d) return null;
    let outcome: "Delivered" | "Failed" | "Accepted" = "Accepted",
      reason: string | undefined;
    try {
      if (d.channel === "Push") {
        const res = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(env.EXPO_PUSH_ACCESS_TOKEN
              ? { Authorization: `Bearer ${env.EXPO_PUSH_ACCESS_TOKEN}` }
              : {}),
          },
          body: JSON.stringify({ ids: [d.providerId] }),
        });
        if (!res.ok) throw new Error("Receipt unavailable");
        const json = (await res.json()) as {
          data?: Record<string, { status?: string; details?: { error?: string } }>;
        };
        const receipt = json.data?.[d.providerId];
        if (receipt?.status === "ok") outcome = "Delivered";
        if (receipt?.status === "error") {
          outcome = "Failed";
          reason = "Push provider reported a delivery failure.";
          if (receipt.details?.error === "DeviceNotRegistered")
            await ctx.runMutation(internal.notificationJobs.removeInvalidDevice, args);
        }
      } else {
        const result: { httpStatus: number; lastEvent?: string; skipped?: boolean } =
          await ctx.runAction(internal.notificationEmail.status, {
            deliveryId: args.deliveryId,
            providerId: d.providerId,
          });
        if (result.skipped) return null;
        if (result.httpStatus < 200 || result.httpStatus >= 300)
          throw new Error("Email status unavailable");
        if (["delivered", "opened", "clicked"].includes(result.lastEvent ?? ""))
          outcome = "Delivered";
        if (
          ["failed", "bounced", "complained", "canceled", "suppressed"].includes(
            result.lastEvent ?? "",
          )
        ) {
          outcome = "Failed";
          reason = "Email provider reported a delivery failure.";
        }
      }
    } catch {
      reason =
        "Delivery confirmation is unavailable. School support can check the notification service.";
    }
    await ctx.runMutation(internal.notificationJobs.recordReceipt, {
      ...args,
      providerId: d.providerId,
      outcome,
      ...(reason ? { reason } : {}),
    });
    return null;
  },
});
export const recordReceipt = internalMutation({
  args: {
    ...deliveryArgs,
    providerId: v.string(),
    outcome: v.union(v.literal("Delivered"), v.literal("Failed"), v.literal("Accepted")),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const d = await ctx.db.get("notificationDeliveries", args.deliveryId);
    if (d?.state !== "Accepted" || d.providerId !== args.providerId) return null;
    const expired = (d.submittedAt ?? d._creationTime) < Date.now() - 86400000;
    const state = expired && args.outcome === "Accepted" ? "Failed" : args.outcome;
    await ctx.db.patch("notificationDeliveries", d._id, {
      state,
      reason:
        expired && args.outcome === "Accepted"
          ? "No provider confirmation within 24 hours; delivery is unknown."
          : args.reason,
      ...(state === "Delivered" ? { confirmedAt: Date.now() } : {}),
      updatedAt: Date.now(),
    });
    if (state === "Delivered" && d.noticeId) {
      const receipt = await ctx.db
        .query("noticeReceipts")
        .withIndex("by_noticeId_and_guardianId", (q) =>
          q.eq("noticeId", d.noticeId!).eq("guardianId", d.userId),
        )
        .unique();
      if (receipt && !receipt.notificationDeliveredAt)
        await ctx.db.patch("noticeReceipts", receipt._id, { notificationDeliveredAt: Date.now() });
    }
    return null;
  },
});
export const consentReminders = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.null(),
  handler: async (ctx, { cursor }) => {
    const now = Date.now();
    const page = await ctx.db
      .query("consentRequests")
      .withIndex("by_status_and_dueAt", (q) =>
        q
          .eq("status", "Open")
          .gt("dueAt", now)
          .lte("dueAt", now + 86400000),
      )
      .paginate({ numItems: 10, cursor: cursor ?? null });
    for (const f of page.page)
      await ctx.scheduler.runAfter(0, internal.notificationJobs.consentRecipients, {
        requestId: f._id,
        cursor: null,
      });
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.notificationJobs.consentReminders, {
        cursor: page.continueCursor,
      });
    return null;
  },
});
export const consentRecipients = internalMutation({
  args: { requestId: v.id("consentRequests"), cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const f = await ctx.db.get("consentRequests", args.requestId);
    if (!f || f.status !== "Open" || f.dueAt <= Date.now()) return null;
    const users = await ctx.db
      .query("users")
      .withIndex("email")
      .paginate({ numItems: 25, cursor: args.cursor });
    for (const user of users.page) {
      if (user.status !== "Active") continue;
      const actor = await loadActor(ctx, user);
      if (actor.disabledModules?.includes("forms")) continue;
      for (const learner of actor.learners) {
        if (
          !(await matchesAudience(ctx, { ...actor, learners: [learner] }, f.audiences, "guardian"))
        )
          continue;
        const response = await ctx.db
          .query("consentResponses")
          .withIndex("by_consentRequestId_and_learnerId", (q) =>
            q.eq("consentRequestId", f._id).eq("learnerId", learner._id),
          )
          .unique();
        if (!response) {
          await queueNotifications(ctx, user._id, f);
          break;
        }
      }
    }
    if (!users.isDone)
      await ctx.scheduler.runAfter(0, internal.notificationJobs.consentRecipients, {
        ...args,
        cursor: users.continueCursor,
      });
    return null;
  },
});
export const expireInvitations = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("invitations")
      .withIndex("by_status_and_expiresAt", (q) =>
        q.eq("status", "Pending").lte("expiresAt", Date.now()),
      )
      .take(25);
    for (const r of rows) {
      await ctx.db.patch("invitations", r._id, { status: "Expired" });
      await ctx.db.insert("auditLog", {
        action: "invitation.expired",
        targetTable: "invitations",
        targetId: r._id,
      });
    }
    if (rows.length === 25)
      await ctx.scheduler.runAfter(0, internal.notificationJobs.expireInvitations, {});
    return null;
  },
});
