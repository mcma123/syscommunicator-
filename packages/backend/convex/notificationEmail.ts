"use node";
import { setTimeout as delay } from "node:timers/promises";
import { RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { internalAction, env } from "./_generated/server";
import { internal, components } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
const limiter = new RateLimiter(components.notificationRateLimiter, {
  emailApi: { kind: "token bucket", rate: 1, period: 1000, capacity: 1 },
});
async function reserve(ctx: ActionCtx) {
  const result = await limiter.limit(ctx, "emailApi", { reserve: true });
  if (result.retryAfter) await delay(result.retryAfter);
}
const response = v.object({
  httpStatus: v.number(),
  providerId: v.optional(v.string()),
  lastEvent: v.optional(v.string()),
  skipped: v.optional(v.boolean()),
});
export const send = internalAction({
  args: { deliveryId: v.id("notificationDeliveries"), run: v.number() },
  returns: response,
  handler: async (
    ctx,
    args,
  ): Promise<{ httpStatus: number; providerId?: string; skipped?: boolean }> => {
    await reserve(ctx);
    // The rate reservation can wait, so authorize again immediately before sending.
    const ready: {
      state: "Ready" | "Skipped" | "Blocked" | "Deferred";
      reason?: string;
      at?: number;
      to?: string;
    } | null = await ctx.runQuery(internal.notificationJobs.context, { ...args, now: Date.now() });
    if (!ready) return { httpStatus: 0, skipped: true };
    if (ready.state !== "Ready") {
      await ctx.runMutation(internal.notificationJobs.postpone, { ...args, result: ready });
      return { httpStatus: 0, skipped: true };
    }
    const source: {
      channel: "Push" | "Email";
      kind: "Notice" | "ConsentReminder";
      targetId: string;
    } | null = await ctx.runQuery(internal.notificationJobs.source, {
      deliveryId: args.deliveryId,
    });
    if (source?.channel !== "Email") return { httpStatus: 0, skipped: true };
    const text =
      source.kind === "Notice"
        ? "An urgent school update is available. Open WGJS Connect to read it securely."
        : "A consent form needs your response. Open WGJS Connect to review it securely.";
    const result = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `wgjs-notification-${args.deliveryId}`,
      },
      body: JSON.stringify({
        from: env.AUTH_EMAIL_FROM,
        to: [ready.to],
        subject:
          source.kind === "Notice"
            ? "Urgent school update - WGJS Connect"
            : "Consent reminder - WGJS Connect",
        text: `${text}\n${new URL(source.kind === "Notice" ? "/messages" : "/forms", env.SITE_URL).toString()}`,
      }),
    });
    if (!result.ok) return { httpStatus: result.status };
    const data: unknown = await result.json();
    const id = (data as { id?: unknown })?.id;
    return { httpStatus: result.status, ...(typeof id === "string" ? { providerId: id } : {}) };
  },
});
export const status = internalAction({
  args: { deliveryId: v.id("notificationDeliveries"), providerId: v.string() },
  returns: response,
  handler: async (
    ctx,
    args,
  ): Promise<{ httpStatus: number; lastEvent?: string; skipped?: boolean }> => {
    await reserve(ctx);
    const current: { providerId: string; channel: "Push" | "Email"; expired: boolean } | null =
      await ctx.runQuery(internal.notificationJobs.pollContext, { deliveryId: args.deliveryId });
    if (current?.channel !== "Email" || current.providerId !== args.providerId)
      return { httpStatus: 0, skipped: true };
    const result = await fetch(
      `https://api.resend.com/emails/${encodeURIComponent(args.providerId)}`,
      { headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` } },
    );
    if (!result.ok) return { httpStatus: result.status };
    const data = (await result.json()) as { last_event?: unknown };
    return {
      httpStatus: result.status,
      ...(typeof data?.last_event === "string" ? { lastEvent: data.last_event } : {}),
    };
  },
});
